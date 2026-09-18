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
    // window-close confirmation; answer it with "Don't Save".
    await electronApp.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1 });
      dialog.showMessageBoxSync = () => 1;
    }).catch(() => {});
    await electronApp.close();
  },

  window: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    // The window is handed over before it navigates to the app, so wait for the
    // page itself; otherwise the navigation destroys the context mid-test.
    await window.waitForURL(/renderer\.html$/);
    // renderer.js is a synchronous script, so its event/IPC listeners are
    // attached by the time DOMContentLoaded fires. Wait for it so one-shot
    // actions (key presses, IPC sends) are not lost before listeners exist.
    await window.waitForLoadState('domcontentloaded');
    await use(window);
  },
});

exports.expect = base.expect;
