const fs = require('fs');
const { test, expect } = require('./electron.fixture');
const { tempMarkdownFile, openFile, answerDialogs, typeAtEnd } = require('./edit-helpers');

const editor = (window) => window.locator('#editorPane .cm-editor:visible');
const preview = (window) => window.locator('#markdownContent');

test.describe('Edit mode: entering and leaving', () => {
  test('the edit button is hidden until a document is open', async ({ window }) => {
    await expect(window.locator('#editToggleBtn')).not.toBeVisible();
  });

  test('the edit button shows the editor with the file text next to the preview', async ({ electronApp, window }) => {
    const file = tempMarkdownFile('# Title\n\nBody text.\n');
    await openFile(electronApp, window, file);

    await window.locator('#editToggleBtn').click();

    await expect(editor(window)).toBeVisible();
    await expect(editor(window).locator('.cm-content')).toContainText('# Title');
    await expect(preview(window).locator('h1')).toHaveText('Title');
    await expect(window.locator('#sourceToggleBtn')).not.toBeVisible();
  });

  test('Cmd/Ctrl+E toggles edit mode', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Title\n'));

    await window.keyboard.press('ControlOrMeta+E');
    await expect(editor(window)).toBeVisible();

    await window.keyboard.press('ControlOrMeta+E');
    await expect(window.locator('#editorPane')).not.toBeVisible();
    await expect(window.locator('#sourceToggleBtn')).toBeVisible();
  });

  test('Cmd/Ctrl+Shift+S has no effect in edit mode', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Title\n'));
    await window.keyboard.press('ControlOrMeta+E');
    await expect(editor(window)).toBeVisible();

    await window.keyboard.press('ControlOrMeta+Shift+S');
    await expect(preview(window).locator('.markdown-source')).toHaveCount(0);
    await expect(preview(window).locator('h1')).toBeVisible();
  });

  test('edit mode is remembered per tab', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# One\n', 'one.md'));
    await openFile(electronApp, window, tempMarkdownFile('# Two\n', 'two.md'));

    await window.keyboard.press('ControlOrMeta+E');
    await expect(editor(window).locator('.cm-content')).toContainText('# Two');

    await window.locator('#tabBarContent .tab-item').nth(0).click();
    await expect(window.locator('#editorPane')).not.toBeVisible();

    await window.locator('#tabBarContent .tab-item').nth(1).click();
    await expect(editor(window).locator('.cm-content')).toContainText('# Two');
  });

  test('leaving edit mode keeps unsaved edits in the rendered view and copy', async ({ electronApp, window }) => {
    const file = tempMarkdownFile('# Title\n');
    await openFile(electronApp, window, file);
    await window.keyboard.press('ControlOrMeta+E');
    await typeAtEnd(window, '\n## Draft heading\n');
    await expect(preview(window).locator('h2')).toHaveText('Draft heading');

    await window.keyboard.press('ControlOrMeta+E');
    await expect(preview(window).locator('h2')).toHaveText('Draft heading');
    await expect(window.locator('#fileInfo')).toContainText('•');

    await window.locator('#copySourceBtn').click();
    expect(await electronApp.evaluate(({ clipboard }) => clipboard.readText())).toContain('## Draft heading');
    expect(fs.readFileSync(file, 'utf8')).toBe('# Title\n');
  });
});

test.describe('Edit mode: preview', () => {
  test('the preview and outline follow the typed text', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Title\n'));
    await window.keyboard.press('ControlOrMeta+E');

    await typeAtEnd(window, '\n## Added section\n');

    await expect(preview(window).locator('h2')).toHaveText('Added section');
    await expect(window.locator('#outlineContainer .outline-item', { hasText: 'Added section' })).toHaveCount(1);
  });
});

test.describe('Edit mode: saving', () => {
  test('typing marks the tab modified in the header and tab bar', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# One\n', 'one.md'));
    await openFile(electronApp, window, tempMarkdownFile('# Two\n', 'two.md'));
    await window.keyboard.press('ControlOrMeta+E');

    await expect(window.locator('#fileInfo')).not.toContainText('•');
    await typeAtEnd(window, 'x');

    await expect(window.locator('#fileInfo')).toContainText('•');
    await expect(window.locator('#tabBarContent .tab-item.active .tab-item-modified')).toBeVisible();
    await expect(window.locator('#tabBarContent .tab-item:not(.active) .tab-item-modified')).toHaveCount(0);
  });

  test('Cmd/Ctrl+S writes the text to the file and clears the marker', async ({ electronApp, window }) => {
    const file = tempMarkdownFile('# Title\n');
    await openFile(electronApp, window, file);
    await window.keyboard.press('ControlOrMeta+E');
    await typeAtEnd(window, 'Saved line');

    await window.keyboard.press('ControlOrMeta+S');

    await expect(window.locator('#fileInfo')).not.toContainText('•');
    expect(fs.readFileSync(file, 'utf8')).toBe('# Title\nSaved line');
  });

  test('the app\'s own save does not report a change on disk', async ({ electronApp, window }) => {
    const file = tempMarkdownFile('# Title\n');
    await openFile(electronApp, window, file);
    await window.keyboard.press('ControlOrMeta+E');
    await typeAtEnd(window, 'one');
    await window.keyboard.press('ControlOrMeta+S');
    await expect(window.locator('#fileInfo')).not.toContainText('•');

    // Keep typing so the tab is modified when the watcher event arrives.
    await typeAtEnd(window, ' two');
    await window.waitForTimeout(800);

    await expect(window.locator('#diskChangeBanner')).not.toBeVisible();
    await expect(editor(window).locator('.cm-content')).toContainText('one two');
  });

  test('a failed write shows an error and keeps the tab modified', async ({ electronApp, window }) => {
    const file = tempMarkdownFile('# Title\n');
    await openFile(electronApp, window, file);
    await window.keyboard.press('ControlOrMeta+E');
    await typeAtEnd(window, 'change');
    fs.chmodSync(file, 0o444);

    try {
      await window.keyboard.press('ControlOrMeta+S');
      await expect(window.locator('#saveErrorBanner')).toBeVisible();
      await expect(window.locator('#fileInfo')).toContainText('•');

      await window.locator('#saveErrorDismissBtn').click();
      await expect(window.locator('#saveErrorBanner')).not.toBeVisible();
      await expect(window.locator('#fileInfo')).toContainText('•');
    } finally {
      fs.chmodSync(file, 0o644);
    }
  });
});

test.describe('Edit mode: unsaved changes', () => {
  test('closing a modified tab can be cancelled', async ({ electronApp, window }) => {
    const file = tempMarkdownFile('# Title\n');
    await openFile(electronApp, window, file);
    await window.keyboard.press('ControlOrMeta+E');
    await typeAtEnd(window, 'unsaved');

    await answerDialogs(electronApp, 2); // Cancel
    await window.keyboard.press('ControlOrMeta+w');

    await expect(editor(window).locator('.cm-content')).toContainText('unsaved');
    await expect(window.locator('#welcomeScreen')).not.toBeVisible();
  });

  test('closing a modified tab with Don\'t Save discards the edits', async ({ electronApp, window }) => {
    const file = tempMarkdownFile('# Title\n');
    await openFile(electronApp, window, file);
    await window.keyboard.press('ControlOrMeta+E');
    await typeAtEnd(window, 'unsaved');

    await answerDialogs(electronApp, 1); // Don't Save
    await window.keyboard.press('ControlOrMeta+w');

    await expect(window.locator('#welcomeScreen')).toBeVisible();
    expect(fs.readFileSync(file, 'utf8')).toBe('# Title\n');
  });

  test('closing a modified tab with Save writes the file first', async ({ electronApp, window }) => {
    const file = tempMarkdownFile('# Title\n');
    await openFile(electronApp, window, file);
    await window.keyboard.press('ControlOrMeta+E');
    await typeAtEnd(window, 'kept');

    await answerDialogs(electronApp, 0); // Save
    await window.keyboard.press('ControlOrMeta+w');

    await expect(window.locator('#welcomeScreen')).toBeVisible();
    expect(fs.readFileSync(file, 'utf8')).toBe('# Title\nkept');
  });

  test('reloading a modified tab asks before discarding', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Title\n'));
    await window.keyboard.press('ControlOrMeta+E');
    await typeAtEnd(window, 'unsaved');

    await answerDialogs(electronApp, 1); // Cancel
    await window.keyboard.press('ControlOrMeta+r');
    await window.waitForTimeout(300);
    await expect(editor(window).locator('.cm-content')).toContainText('unsaved');

    await answerDialogs(electronApp, 0); // Discard Changes
    await window.keyboard.press('ControlOrMeta+r');
    await expect(editor(window).locator('.cm-content')).not.toContainText('unsaved');
    await expect(window.locator('#fileInfo')).not.toContainText('•');
  });

  test('closing the window with unsaved edits can be cancelled', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Title\n'));
    await window.keyboard.press('ControlOrMeta+E');
    await typeAtEnd(window, 'unsaved');
    await expect(window.locator('#fileInfo')).toContainText('•');

    await answerDialogs(electronApp, 1); // Cancel
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await window.waitForTimeout(300);

    expect(await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  });
});

test.describe('Edit mode: changes on disk', () => {
  test('an unmodified tab takes the new file content', async ({ electronApp, window }) => {
    const file = tempMarkdownFile('# Title\n');
    await openFile(electronApp, window, file);
    await window.keyboard.press('ControlOrMeta+E');
    await expect(editor(window)).toBeVisible();

    fs.writeFileSync(file, '# Title\n\nWritten elsewhere.\n');

    await expect(editor(window).locator('.cm-content')).toContainText('Written elsewhere.');
    await expect(preview(window)).toContainText('Written elsewhere.');
    await expect(window.locator('#diskChangeBanner')).not.toBeVisible();
  });

  test('a modified tab keeps its edits and Keep Mine dismisses the banner', async ({ electronApp, window }) => {
    const file = tempMarkdownFile('# Title\n');
    await openFile(electronApp, window, file);
    await window.keyboard.press('ControlOrMeta+E');
    await typeAtEnd(window, 'mine');

    fs.writeFileSync(file, '# Title\n\nTheirs.\n');

    await expect(window.locator('#diskChangeBanner')).toBeVisible();
    await expect(editor(window).locator('.cm-content')).toContainText('mine');

    await window.locator('#diskKeepBtn').click();
    await expect(window.locator('#diskChangeBanner')).not.toBeVisible();
    await expect(editor(window).locator('.cm-content')).toContainText('mine');
    await expect(window.locator('#fileInfo')).toContainText('•');
  });

  test('Reload in the banner discards the edits and loads the file', async ({ electronApp, window }) => {
    const file = tempMarkdownFile('# Title\n');
    await openFile(electronApp, window, file);
    await window.keyboard.press('ControlOrMeta+E');
    await typeAtEnd(window, 'mine');

    fs.writeFileSync(file, '# Title\n\nTheirs.\n');
    await expect(window.locator('#diskChangeBanner')).toBeVisible();

    await window.locator('#diskReloadBtn').click();
    await expect(window.locator('#diskChangeBanner')).not.toBeVisible();
    await expect(editor(window).locator('.cm-content')).toContainText('Theirs.');
    await expect(editor(window).locator('.cm-content')).not.toContainText('mine');
    await expect(window.locator('#fileInfo')).not.toContainText('•');
  });
});

test.describe('Edit mode: main process', () => {
  test('save-file refuses a path that is not open in a tab', async ({ electronApp, window }) => {
    const file = tempMarkdownFile('# Untouched\n');
    const result = await window.evaluate((p) => window.electronAPI.saveFile(p, 'overwritten'), file);
    expect(result.success).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe('# Untouched\n');
    void electronApp;
  });

  test('the editor follows dark mode', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Title\n'));
    await window.keyboard.press('ControlOrMeta+E');
    await expect(editor(window)).toBeVisible();
    const before = await editor(window).getAttribute('class');

    await window.locator('#darkModeToggle').click();

    await expect.poll(() => editor(window).getAttribute('class')).not.toBe(before);
  });
});

test.describe('Edit mode: highlight visibility', () => {
  // Highlights are translucent layers over the editor background. A layer that
  // is too faint leaves selected text looking unselected, which is what the
  // editor's first dark mode did.
  const MIN_CONTRAST = 1.8;

  // Contrast ratio between a highlight composited over the editor background
  // and that background, measured from the live computed styles.
  async function highlightContrast(window, selector) {
    return window.evaluate((sel) => {
      const parse = (value) => {
        const [r, g, b, a = 1] = [...value.matchAll(/[\d.]+/g)].map(m => Number(m[0]));
        return value.startsWith('color(') ? [r * 255, g * 255, b * 255, a] : [r, g, b, a];
      };
      const luminance = ([r, g, b]) => {
        const channel = (c) => {
          const v = c / 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const pane = document.getElementById('editorPane');
      const background = parse(getComputedStyle(pane).backgroundColor);
      const layer = parse(getComputedStyle(document.querySelector(sel)).backgroundColor);
      const composited = [0, 1, 2].map(i => layer[i] * layer[3] + background[i] * (1 - layer[3]));
      const [light, dark] = [luminance(composited), luminance(background)].sort((a, b) => b - a);
      return (light + 0.05) / (dark + 0.05);
    }, selector);
  }

  for (const dark of [false, true]) {
    test(`the selection is visible in ${dark ? 'dark' : 'light'} mode`, async ({ electronApp, window }) => {
      await openFile(electronApp, window, tempMarkdownFile('# Title\n\nSelect this sentence here.\n'));
      await window.evaluate((d) => document.body.classList.toggle('dark-mode', d), dark);
      await window.keyboard.press('ControlOrMeta+e');
      await editor(window).locator('.cm-content').click();
      await window.keyboard.press('ControlOrMeta+a');
      await expect(window.locator('.cm-selectionBackground').first()).toBeVisible();

      expect(await highlightContrast(window, '.cm-selectionBackground')).toBeGreaterThan(MIN_CONTRAST);
    });
  }

  test('other occurrences of the selected text are marked without hiding them', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Title\n\nSelect this sentence here.\n\nAnother sentence again.\n'));
    await window.evaluate(() => document.body.classList.add('dark-mode'));
    await window.keyboard.press('ControlOrMeta+e');
    await window.getByText('Select this sentence here.').first().dblclick();
    await expect(window.locator('.cm-selectionMatch').first()).toBeVisible();

    // Visible against the background, and translucent so the text shows through.
    expect(await highlightContrast(window, '.cm-selectionMatch')).toBeGreaterThan(1.2);
    const alpha = await window.evaluate(() => {
      const value = getComputedStyle(document.querySelector('.cm-selectionMatch')).backgroundColor;
      const parts = [...value.matchAll(/[\d.]+/g)].map(m => Number(m[0]));
      return parts.length > 3 ? parts[3] : 1;
    });
    expect(alpha).toBeLessThan(0.5);
  });
});
