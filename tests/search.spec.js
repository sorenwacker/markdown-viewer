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

  test('should open search bar when style is changed to visible', async ({ window }) => {
    const searchBar = window.locator('#searchBar');

    // Manually show the search bar
    await window.evaluate(() => {
      document.getElementById('searchBar').style.display = 'flex';
    });

    await expect(searchBar).toBeVisible();

    // Verify all controls are visible
    await expect(window.locator('#searchInput')).toBeVisible();
    await expect(window.locator('#searchClose')).toBeVisible();
  });

  test('should close search bar with close button', async ({ window }) => {
    const searchBar = window.locator('#searchBar');

    // Show search bar
    await window.evaluate(() => {
      document.getElementById('searchBar').style.display = 'flex';
    });
    await expect(searchBar).toBeVisible();

    // Click close button
    await window.locator('#searchClose').click();
    await expect(searchBar).not.toBeVisible();
  });
});
