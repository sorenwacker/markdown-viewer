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

  test('should have search bar hidden by default', async ({ window }) => {
    const searchBar = window.locator('#searchBar');
    await expect(searchBar).not.toBeVisible();
  });
});

test.describe('Sidebar', () => {
  test('should toggle sidebar visibility', async ({ window }) => {
    const sidebar = window.locator('#sidebar');
    const toggleBtn = window.locator('#sidebarToggleMain');

    await expect(sidebar).not.toHaveClass(/collapsed/);

    await toggleBtn.click();
    await expect(sidebar).toHaveClass(/collapsed/);

    await toggleBtn.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('should switch between tabs', async ({ window }) => {
    const filesTab = window.locator('#filesTab');
    const outlineTab = window.locator('#outlineTab');
    const filesContent = window.locator('.tab-content[data-tab="files"]');
    const outlineContent = window.locator('.tab-content[data-tab="outline"]');

    // Outline is default active
    await expect(outlineContent).toHaveClass(/active/);

    // Click files tab
    await filesTab.click();
    await expect(filesContent).toHaveClass(/active/);

    // Click outline tab back
    await outlineTab.click();
    await expect(outlineContent).toHaveClass(/active/);
  });
});

test.describe('UI Elements', () => {
  test('should have welcome screen with action buttons', async ({ window }) => {
    await expect(window.locator('#welcomeOpenFileBtn')).toBeVisible();
    await expect(window.locator('#welcomeOpenFolderBtn')).toBeVisible();
  });

  test('should have sidebar with file and folder buttons', async ({ window }) => {
    // Switch to files tab first
    await window.locator('#filesTab').click();
    await window.waitForTimeout(200);
    // Check buttons are visible
    await expect(window.locator('#openFileBtn')).toBeVisible({ timeout: 10000 });
    await expect(window.locator('#openFolderBtn')).toBeVisible();
  });
});
