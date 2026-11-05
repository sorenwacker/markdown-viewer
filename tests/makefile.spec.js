const { execFileSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');

const root = path.join(__dirname, '..');

// `cp -R src.app /Applications/` onto an existing bundle copies the new app
// inside the old one and leaves the old one in place, so the install target
// must remove the installed app before copying. See README, "Building".
test.describe('Makefile install target', () => {
  test.skip(process.platform === 'win32', 'make is not available on Windows runners');

  test('removes the installed app before copying the new build', () => {
    const recipe = execFileSync('make', ['-n', 'install'], { cwd: root, encoding: 'utf8' });
    const removeAt = recipe.search(/rm -rf "\/Applications\/Markdown Viewer\.app"/);
    const copyAt = recipe.search(/cp -R "dist\/mac-arm64\/Markdown Viewer\.app"/);
    expect(removeAt).toBeGreaterThanOrEqual(0);
    expect(copyAt).toBeGreaterThan(removeAt);
  });
});
