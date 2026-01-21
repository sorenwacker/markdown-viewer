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
    await use(window);
  },
});

exports.expect = base.expect;
