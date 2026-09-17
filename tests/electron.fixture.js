const { test: base, _electron: electron } = require('@playwright/test');
const path = require('path');

exports.test = base.extend({
  // Playwright's headless option (false with --headed) decides whether the app
  // shows its window.
  electronApp: async ({ headless }, use) => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../main.js')],
      env: { ...process.env, MARKDOWN_VIEWER_HEADLESS: headless ? '1' : '0' },
    });
    await use(electronApp);
    // A test that ends with unsaved edits would otherwise block quitting on the
    // window-close confirmation; answer it with "discard".
    await electronApp.evaluate(({ dialog }) => {
      dialog.showMessageBoxSync = () => 0;
    }).catch(() => {});
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
