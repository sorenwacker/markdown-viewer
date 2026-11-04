const { test, expect } = require('./electron.fixture');

// List markers must be real text so a selection highlights and copies them.
// See docs/index.md, "Selecting and copying rendered text".
async function loadHtml(electronApp, html) {
  await electronApp.evaluate(({ BrowserWindow }, payload) => {
    BrowserWindow.getAllWindows()[0].webContents.send('load-markdown', payload);
  }, { html, markdown: '', fileName: 'list.md', filePath: '/tmp/list.md', outline: [] });
}

// Select the whole rendered document and return the selected text.
async function selectAllText(window) {
  return window.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('markdownContent'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString();
  });
}

test.describe('Selectable list markers', () => {
  test('a selected ordered list includes its numbers', async ({ electronApp, window }) => {
    await loadHtml(electronApp, '<ol><li>First item</li><li>Second item</li></ol>');
    await expect(window.locator('#markdownContent li').first()).toBeVisible();

    const text = await selectAllText(window);
    expect(text).toMatch(/1\.\s*First item/);
    expect(text).toMatch(/2\.\s*Second item/);
  });

  test('a selected unordered list includes its bullets', async ({ electronApp, window }) => {
    await loadHtml(electronApp, '<ul><li>Apple</li><li>Pear</li></ul>');
    await expect(window.locator('#markdownContent li').first()).toBeVisible();

    const text = await selectAllText(window);
    expect(text).toMatch(/•\s*Apple/);
    expect(text).toMatch(/•\s*Pear/);
  });

  test('an ordered list honours its start value', async ({ electronApp, window }) => {
    await loadHtml(electronApp, '<ol start="3"><li>Third</li><li>Fourth</li></ol>');
    await expect(window.locator('#markdownContent li').first()).toBeVisible();

    const text = await selectAllText(window);
    expect(text).toMatch(/3\.\s*Third/);
    expect(text).toMatch(/4\.\s*Fourth/);
  });

  test('task-list items keep their checkbox and get no marker', async ({ electronApp, window }) => {
    await loadHtml(electronApp, '<ul><li><input type="checkbox" disabled> Todo</li></ul>');
    await expect(window.locator('#markdownContent li').first()).toBeVisible();

    await expect(window.locator('#markdownContent .list-marker')).toHaveCount(0);
  });

  test('native markers are hidden so numbers are not drawn twice', async ({ electronApp, window }) => {
    await loadHtml(electronApp, '<ol><li>Only</li></ol>');
    await expect(window.locator('#markdownContent li').first()).toBeVisible();

    const style = await window.locator('#markdownContent li').first()
      .evaluate(el => getComputedStyle(el).listStyleType);
    expect(style).toBe('none');
  });
});
