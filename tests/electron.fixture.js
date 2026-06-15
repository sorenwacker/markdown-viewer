const { test: base, _electron: electron } = require('@playwright/test');
const path = require('path');

exports.test = base.extend({
  electronApp: async ({}, use) => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../main.js')],
    });
    await use(electronApp);
    await electronApp.close();
  },

  window: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    // renderer.js is a synchronous script, so its event/IPC listeners are
    // attached by the time DOMContentLoaded fires. Wait for it so one-shot
    // actions (key presses, IPC sends) are not lost before listeners exist.
    await window.waitForLoadState('domcontentloaded');
    await use(window);
  },
});

exports.expect = base.expect;
