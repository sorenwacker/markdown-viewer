<p align="center">
  <img src="assets/logo.png" alt="Markdown Viewer logo" width="160">
</p>

<h1 align="center">Markdown Viewer</h1>

A cross-platform Electron-based markdown viewer for macOS, Windows, and Linux.

## Documentation

- [README](../README.md) — features, installation, usage, and keyboard shortcuts.
- [Edit mode](editing.md) — editing and saving documents, unsaved-change handling, and the shared editor package.
- [Codebase review](REVIEW.md) — baseline gates, confirmed findings, and remediation status.

## At a glance

- Clean, distraction-free markdown viewing with in-document search.
- Toggle between the rendered document and its raw markdown source, remembered per tab.
- Edit a document next to a live preview and save it back to its file.
- Copy the raw markdown source of the active document to the clipboard.
- Mermaid diagrams and syntax-highlighted code blocks.
- Embedded images: external (`http`/`https`), `data:`, and local files.
- File browser, document outline, recent documents, and live file watching.
- Rendered HTML is sanitized with DOMPurify before display.
