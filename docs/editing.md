# Edit mode

Edit mode lets a document be changed in the app and written back to its file. It is a per-tab mode, separate from the read-only source view: viewing a document, rendered or as source, never changes it.

## Entering and leaving

- The Edit button in the header, or `Cmd/Ctrl+E`, toggles edit mode for the active tab. The button is hidden until a document is open.
- Each tab remembers its mode independently, as the source view does.
- While a tab is in edit mode, the source view toggle is hidden and `Cmd/Ctrl+Shift+S` has no effect; the editor already shows the source.
- Leaving edit mode keeps unsaved changes. The tab stays marked as modified and its rendered view, source view, and Copy Markdown Source all use the edited text, not the file on disk.

## Layout

The content area splits into two panes:

- **Editor** (left): the markdown text in the editor from the `markdown-editor` package (CodeMirror 6). It provides undo/redo, find (`Cmd/Ctrl+F` while the editor has focus), multiple cursors (`Cmd/Ctrl+Alt+Up/Down`), list continuation on Enter without blank lines between items, and line wrapping.
- **Preview** (right): the rendered document. It updates 300 ms after typing pauses. The text is rendered by the main process with the same parser used for opening files, so the preview matches what the saved file will look like, including mermaid diagrams, tables, image paths relative to the file, and DOMPurify sanitization.

The outline in the sidebar follows the preview.

## Saving

- `Cmd/Ctrl+S` writes the tab's text to its file. Saving is explicit; there is no autosave.
- A tab whose text differs from the file on disk is modified. Modified tabs show a dot before the file name in the tab bar and in the header.
- If writing fails (for example, the file is read-only), an error banner is shown until it is dismissed or a later save succeeds, and the tab stays modified.

## Unsaved changes

Unsaved text is never discarded without confirmation:

- **Closing a modified tab** (`Cmd/Ctrl+W` or the tab close button) asks: Save, Don't Save, or Cancel.
- **Reloading a modified tab** (`Cmd/Ctrl+R`) asks whether to discard the changes and reload from disk.
- **Closing the window** with modified tabs asks whether to discard all unsaved changes and close.

## Changes on disk

The file watcher keeps running while a tab is edited.

- **Tab not modified:** the editor and preview take the new file content. The text is applied as the smallest differing span, so the caret keeps its position unless the change touched it.
- **Tab modified:** the edited text is kept and a banner reports that the file changed on disk, with two actions. *Reload* discards the edits and loads the file. *Keep Mine* dismisses the banner; the next save overwrites the file.
- The app's own save also triggers the watcher. A change event whose content equals the text just saved is ignored.

## Architecture

- **Colors.** The editor's colors, including the selection, matching occurrences of the selected text, and search matches, come from the package's CSS custom properties mapped to the app palette in `css/editor.css`. Highlights are translucent layers over the editor background, so dark mode sets stronger values; a test fails if the selection's contrast against the background drops below 1.8:1.
- **Editor package.** The editor is the `markdown-editor` package, shared with graph-core so fixes land once. `npm start`, `npm test`, and the build scripts first bundle it with esbuild into `vendor/markdown-editor.js` (generated, not committed), because the renderer loads plain ES modules without a bundler. A gate test fails if any renderer module imports `@codemirror/*` directly or defines its own copy of the package's editing functions.
- **Rendering.** `parseMarkdown(content, filePath)` in `main.js` turns text into `{ html, outline }`. Opening a file reads it and calls this function; the `render-markdown` IPC channel calls it for the preview.
- **Saving.** The `save-file` IPC channel writes the text and returns the parsed result. It only writes to files that are open in a tab, so the channel cannot be used to write arbitrary paths.
- **Tab state.** A tab holds `markdown` (the content last read from or written to disk), `draft` (the edited text, `null` when there are no edits), and `editMode`. A tab is modified when `draft` is not `null` and differs from `markdown`.
- **Window close.** The renderer reports the number of modified tabs to the main process, which shows the confirmation on the window `close` event.
