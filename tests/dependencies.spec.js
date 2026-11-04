const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lockfile = fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8');

test.describe('Dependencies', () => {
  // npm records a git dependency as git+ssh whenever it resolves one locally,
  // and CI runners have no ssh key, so an ssh URL in the lockfile breaks every
  // install there. It has to be rewritten to https after any npm install.
  test('the lockfile has no ssh git URLs', () => {
    const sshEntries = [...lockfile.matchAll(/"resolved": "(git\+ssh:[^"]+)"/g)].map(m => m[1]);
    expect(sshEntries).toEqual([]);
  });

  // An unbounded range lets a future major release break a fresh install while
  // lockfile-based tests stay green.
  test('every dependency is bounded below its next major version', () => {
    const unbounded = [];
    for (const field of ['dependencies', 'devDependencies']) {
      for (const [name, range] of Object.entries(manifest[field] || {})) {
        const bounded = /^\^[1-9]\d*\./.test(range)       // ^6.7.1
          || /^\^0\.\d+\./.test(range)                     // ^0.25.12 (bounded below 0.26)
          || /<\s*\d/.test(range)                          // >=6.7 <7
          || /^github:[^#]+#v\d+\.\d+\.\d+$/.test(range);  // pinned git tag
        if (!bounded) unbounded.push(`${field}.${name}: ${range}`);
      }
    }
    expect(unbounded).toEqual([]);
  });

  // Everything the app requires at runtime must be declared, never relied on
  // through another package's dependencies.
  test('packages loaded by the app are declared as dependencies', () => {
    const declared = Object.keys(manifest.dependencies || {});
    const loadedFromNodeModules = new Set();
    for (const file of ['renderer.html', 'print.html']) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      for (const match of source.matchAll(/node_modules\/([^/"']+)/g)) {
        loadedFromNodeModules.add(match[1]);
      }
    }
    for (const name of loadedFromNodeModules) {
      expect(declared, `${name} is loaded by the app`).toContain(name);
    }
  });
});
