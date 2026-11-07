const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { buildFileTree } = require('../file-tree');

// navigate-folder reports success:false only when buildFileTree throws, so a
// missing folder has to fail instead of looking like an empty one.
test.describe('buildFileTree', () => {
  let root;

  test.beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-tree-'));
  });

  test.afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('rejects when the folder does not exist', async () => {
    await expect(buildFileTree(path.join(root, 'missing'))).rejects.toThrow(/ENOENT/);
  });

  test('rejects when the path is a file, not a folder', async () => {
    const file = path.join(root, 'a.md');
    fs.writeFileSync(file, '# a');
    await expect(buildFileTree(file)).rejects.toThrow(/ENOTDIR/);
  });

  test('lists markdown files with folders first', async () => {
    fs.mkdirSync(path.join(root, 'sub'));
    fs.writeFileSync(path.join(root, 'sub', 'b.md'), '# b');
    fs.writeFileSync(path.join(root, 'a.md'), '# a');
    fs.writeFileSync(path.join(root, 'notes.txt'), 'x');
    const tree = await buildFileTree(root);
    expect(tree.map(n => n.name)).toEqual(['sub', 'a.md']);
    expect(tree[0].children.map(n => n.name)).toEqual(['b.md']);
  });

  test('an unreadable subfolder is shown empty instead of failing the tree', async () => {
    test.skip(process.platform === 'win32' || process.getuid?.() === 0, 'needs POSIX permissions as a normal user');
    const locked = path.join(root, 'locked');
    fs.mkdirSync(locked);
    fs.writeFileSync(path.join(root, 'a.md'), '# a');
    fs.chmodSync(locked, 0o000);
    try {
      const tree = await buildFileTree(root);
      expect(tree).toEqual([
        { name: 'locked', path: locked, type: 'folder', children: [] },
        { name: 'a.md', path: path.join(root, 'a.md'), type: 'file' },
      ]);
    } finally {
      fs.chmodSync(locked, 0o755);
    }
  });
});
