const fs = require('fs');
const os = require('os');
const path = require('path');

// Write a markdown file into a fresh temporary directory and return its path.
function tempMarkdownFile(content, name = 'doc.md') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-edit-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Open a file through the main process's real load path (parse, send to the
// renderer, start watching), as the macOS open-file event does.
async function openFile(electronApp, window, filePath) {
  await electronApp.evaluate(({ app }, p) => {
    app.emit('open-file', { preventDefault() {} }, p);
  }, filePath);
  await window.locator('#fileInfo', { hasText: path.basename(filePath) }).waitFor();
}

// Answer the next native message boxes with the given button index.
async function answerDialogs(electronApp, response) {
  await electronApp.evaluate(({ dialog }, r) => {
    dialog.showMessageBox = async () => ({ response: r });
    dialog.showMessageBoxSync = () => r;
  }, response);
}

// Type at the end of the active editor.
async function typeAtEnd(window, text) {
  await window.locator('#editorPane .cm-editor:visible .cm-content').click();
  await window.keyboard.press('ControlOrMeta+End');
  await window.keyboard.type(text);
}

module.exports = { tempMarkdownFile, openFile, answerDialogs, typeAtEnd };
