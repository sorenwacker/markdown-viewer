const { test, expect } = require('./electron.fixture');

test.describe('Search UI', () => {
  test('should have search bar hidden by default', async ({ window }) => {
    const searchBar = window.locator('#searchBar');
    await expect(searchBar).not.toBeVisible();
  });

  test('should have search bar elements present', async ({ window }) => {
    // Check search elements exist in DOM
    await expect(window.locator('#searchInput')).toBeAttached();
    await expect(window.locator('#searchCount')).toBeAttached();
    await expect(window.locator('#searchPrev')).toBeAttached();
    await expect(window.locator('#searchNext')).toBeAttached();
    await expect(window.locator('#searchClose')).toBeAttached();
  });

  test('should open search bar with the Find shortcut', async ({ window }) => {
    const searchBar = window.locator('#searchBar');
    await expect(searchBar).not.toBeVisible();

    // Drive the app's real Cmd/Ctrl+F handler, not the inline style.
    await window.keyboard.press('ControlOrMeta+f');

    await expect(searchBar).toBeVisible();
    await expect(window.locator('#searchInput')).toBeVisible();
    await expect(window.locator('#searchInput')).toBeFocused();
  });

  test('should close search bar with close button', async ({ window }) => {
    const searchBar = window.locator('#searchBar');

    await window.keyboard.press('ControlOrMeta+f');
    await expect(searchBar).toBeVisible();

    // Click close button
    await window.locator('#searchClose').click();
    await expect(searchBar).not.toBeVisible();
  });
});
