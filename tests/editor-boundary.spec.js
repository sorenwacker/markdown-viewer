const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

// The editor lives in the shared markdown-editor package. Renderer code reaches
// it only through the esbuild bundle, and never redefines its functions: a
// local copy would silently diverge from graph-core's.
const root = path.join(__dirname, '..');
const rendererFiles = [
  'renderer.js',
  ...fs.readdirSync(path.join(root, 'modules')).filter(f => f.endsWith('.js')).map(f => `modules/${f}`),
];
const packageFunctions = ['createMarkdownEditor', 'insertNewlineTightList', 'minimalReplacement', 'multiCursorKeymap'];

test.describe('Editor package boundary', () => {
  for (const file of rendererFiles) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');

    test(`${file} does not import CodeMirror directly`, () => {
      expect(source).not.toMatch(/from\s+['"]@codemirror\//);
    });

    test(`${file} imports the editor only from the bundle`, () => {
      const imports = [...source.matchAll(/from\s+['"]([^'"]*markdown-editor[^'"]*)['"]/g)].map(m => m[1]);
      for (const specifier of imports) {
        expect(specifier).toBe('../vendor/markdown-editor.js');
      }
    });

    test(`${file} does not redefine the package's functions`, () => {
      for (const name of packageFunctions) {
        expect(source).not.toMatch(new RegExp(`(function\\s+${name}\\b|(const|let|var)\\s+${name}\\s*=)`));
      }
    });
  }
});
