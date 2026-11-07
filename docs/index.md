<p align="center">
  <img src="assets/logo.png" alt="Markdown Viewer logo" width="160">
</p>

<h1 align="center">Markdown Viewer</h1>

A cross-platform Electron-based markdown viewer for macOS, Windows, and Linux.

## Documentation

- [README](../README.md) — features, installation, usage, and keyboard shortcuts.
- [Edit mode](editing.md) — editing and saving documents, unsaved-change handling, and the shared editor package.
- [Exporting](exporting.md) — exporting a document as PDF.
- [Codebase review](REVIEW.md) — baseline gates, confirmed findings, and remediation status.

## At a glance

- Clean, distraction-free markdown viewing with in-document search.
- Toggle between the rendered document and its raw markdown source, remembered per tab.
- Edit a document next to a live preview and save it back to its file.
- Export a document as PDF, with diagrams, on A4 pages.
- Copy the raw markdown source of the active document to the clipboard.
- Mermaid diagrams and syntax-highlighted code blocks.
- Embedded images: external (`http`/`https`), `data:`, and local files.
- File browser, document outline, recent documents, and live file watching.
- Rendered HTML is sanitized with DOMPurify before display.

## Recent documents

The Files pane shows up to 15 recently opened documents when no folder is open. Each time the list is shown (at startup, after closing a folder, and after opening a document), the main process checks every listed path, and paths that no longer exist on disk are removed from the stored list before it is drawn. A document that is deleted while the list is visible is removed the next time the list is shown. Clicking an entry whose file is missing also removes it. The list lives in `modules/recent.js`.

## Selecting and copying rendered text

List markers in the rendered view are part of the document text, not the browser's `::marker` pseudo-elements, which Chromium neither highlights in a selection nor copies. After each render, every list item gets a leading `<span class="list-marker">` holding `•` for unordered lists or `N.` for ordered lists, honouring an explicit `start` value. Selecting a list therefore highlights its bullets and numbers with the item text, and copying the selection includes them. Task-list items (those starting with a checkbox) get no marker; the checkbox is their marker. The native markers are turned off in CSS and the spans are laid out with a hanging indent, so nested lists keep their indentation. PDF export runs the same pass. The pass lives in `modules/list-markers.js`.
