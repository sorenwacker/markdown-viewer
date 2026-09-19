const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // Generous: each test launches a real Electron app, and a cold first launch
  // on CI can take a minute.
  timeout: 90000,
  // Electron occasionally fails to start on the Windows runner ("Process failed
  // to launch!"), roughly once per full run and never twice on the same test.
  // Retries absorb that without hiding a test that genuinely fails.
  retries: process.env.CI ? 2 : 0,
  // One worker on CI: every test starts its own Electron app, and simultaneous
  // launches are what the Windows runner struggles with.
  workers: process.env.CI ? 1 : undefined,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.js',
    },
  ],
});
