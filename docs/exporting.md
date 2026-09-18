# Exporting

A document open in the app can be exported as PDF.

## Exporting a PDF

- The Export PDF button in the header, or `Cmd/Ctrl+P`, exports the active document. The button is hidden until a document is open.
- A save dialog opens with the document's file name and a `.pdf` extension, in the document's folder.
- The export always uses the rendered document, whatever the tab is showing at the time: the source view and edit mode export the rendered result. The document's current text is rendered for the export rather than reusing the preview, so an edit typed a moment earlier is included.

## What the PDF contains

- A4 pages with margins, and the document rendered on white with dark text, regardless of the app's dark mode. Exports are made to be printed and read on paper.
- Mermaid diagrams, rendered as vector graphics.
- Code blocks, tables, and images, including images relative to the document.
- Links, which stay clickable in the PDF.

The sidebar, tab bar, header, and the app's own search highlights are not part of the export.

## How it works

The export does not print the app window. The main process opens a hidden window with `print.html`, sends it the document's HTML, and that page renders it with the document stylesheet and no dark mode. It renders any mermaid diagrams first, reports back how many it drew, and only then does the main process call `printToPDF` and write the file. The hidden window is closed afterwards, whether the export succeeded or failed.

The document HTML is sanitized with DOMPurify before it is inserted, exactly as it is in the main window.

A failed write, for example to a folder that is not writable, is reported in a banner and no file is left behind. Cancelling the save dialog does nothing.
