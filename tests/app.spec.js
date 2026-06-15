const { test, expect } = require('./electron.fixture');

test.describe('Application Launch', () => {
  test('should launch and show welcome screen', async ({ window }) => {
    const welcomeScreen = window.locator('#welcomeScreen');
    await expect(welcomeScreen).toBeVisible();

    const title = await window.title();
    expect(title).toBe('Markdown Viewer');
  });

  test('should have sidebar with outline tab active by default', async ({ window }) => {
    const outlineTab = window.locator('#outlineTab');
    await expect(outlineTab).toHaveClass(/active/);
  });

  test('should have all header buttons visible', async ({ window }) => {
    await expect(window.locator('#reloadBtn')).toBeVisible();
    await expect(window.locator('#fontDecreaseBtn')).toBeVisible();
    await expect(window.locator('#fontIncreaseBtn')).toBeVisible();
    await expect(window.locator('#viewModeToggle')).toBeVisible();
    await expect(window.locator('#darkModeToggle')).toBeVisible();
  });

  test('should have sidebar visible by default', async ({ window }) => {
    const sidebar = window.locator('#sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });
});

test.describe('UI Elements', () => {
  test('should have welcome screen with action buttons', async ({ window }) => {
    await expect(window.locator('#welcomeOpenFileBtn')).toBeVisible();
    await expect(window.locator('#welcomeOpenFolderBtn')).toBeVisible();
  });

  test('should have sidebar tabs', async ({ window }) => {
    await expect(window.locator('#filesTab')).toBeVisible();
    await expect(window.locator('#outlineTab')).toBeVisible();
  });

  test('should have sidebar toggle button', async ({ window }) => {
    await expect(window.locator('#sidebarToggleMain')).toBeVisible();
  });
});
