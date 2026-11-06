# Codebase review: markdown-viewer

Reviewed 2026-11-06 by an automated multi-agent pass. Each high and medium finding was checked by a second agent that tried to refute it against the code. Low findings were not verified.

## Baseline gates

| Gate | Result |
|---|---|
| Lint (eslint) | pass |
| Dependency tests | 3/3 pass |
| Electron e2e (playwright) | not run: Electron sandbox blocked on this machine (AppArmor userns) |
| npm audit | 8 left (6 moderate, 2 low); fixes need major bumps |

## Summary

Confirmed: 11 (high 1, medium 6, low 4). Unverified low-confidence notes: 12. Refuted: 1.

## High

### Mermaid runs with securityLevel 'loose' and its links are not intercepted

`modules/view.js:23` - correctness

mermaid.initialize({ securityLevel: 'loose', ... }) turns on `click NODE href "..."` and callback directives in untrusted documents. renderMermaidDiagrams is async and is not awaited in renderActiveTabContent, so setupLinkInterception() runs before the diagram's <a> elements exist and they never get handleLinkClick. main.js has no will-navigate / setWindowOpenHandler guard (grep found none), so clicking such a node navigates the main window, which has the preload's electronAPI (saveFile, etc.), to an arbitrary remote page.

**Fix:** Use securityLevel 'strict', or 'antiscript' if htmlLabels are needed. Also intercept links with one delegated click listener on markdownContent instead of per-anchor listeners, so content inserted later is covered. Separately, add a will-navigate guard in main.

## Medium

### save-file write guard can be bypassed through open-file-in-tab

`main.js:541` - correctness

The comment at line 19 says `openDocuments` stops save-file from writing arbitrary files. But the 'open-file-in-tab' handler takes any renderer-supplied path with no check on extension or location, reads it, and runs `openDocuments.add(filePath)`. Renderer code can call `electronAPI.openFileInTab('/home/u/.bashrc')` and then `electronAPI.saveFile('/home/u/.bashrc', payload)`, which passes the guard and overwrites the file. The renderer runs mermaid with securityLevel 'loose' on untrusted documents, so this matters: an XSS in the renderer becomes an arbitrary file read and write.

**Fix:** Only add paths to openDocuments that came from a trusted source: the open dialog, the argv/open-file events, or a link resolved from an already-open document. At minimum, require a markdown extension and an existing regular file in open-file-in-tab, and normalise the path with path.resolve before adding or checking it.

### closeConfirmed is never reset, so a recreated window loses unsaved edits without asking

`main.js:71` - correctness

`closeConfirmed = true` is set when the close prompt is answered, and nothing ever sets it back to false. On macOS the app keeps running after the window closes, and 'activate' calls createWindow(). The 'close' handler for the new window then returns early (`if (unsavedCount === 0 || closeConfirmed) return;`), so closing it with unsaved edits discards them without a prompt.

**Fix:** Reset closeConfirmed (and quitting) in createWindow or in the 'closed' handler, or keep the flag per window.

### open-external allows file: URLs, so a document link can launch local executables

`main.js:526` - correctness

The allow-list is `['http:', 'https:', 'mailto:', 'file:']`. view.js sends `file://${resolvedPath}` for any existing linked file that is not markdown, and shell.openExternal with a file: URL opens it with the OS default handler. A link in an untrusted markdown file to a nearby `.exe`, `.desktop`, `.command` or script file therefore runs it with one click. The handler also passes the original `url` string rather than `parsed.href`.

**Fix:** Send local files through shell.openPath after checking the extension against a deny-list of executable types (or ask the user first), and drop file: from open-external. Pass parsed.href to openExternal.

### Outline HTML goes into innerHTML without DOMPurify or escaping

`modules/view.js:90` - correctness

renderOutline interpolates `${item.text}` and `data-id="${item.id}"` straight into outlineContainer.innerHTML. item.text comes from extractOutline in main.js, which only strips tags with the regex `/<[^>]*>/g` over `(.*?)<\/h\1>`. A heading containing raw HTML such as `# a <img src=x onerror=... title="</h1>">` gets cut at the first `</h1>`, which leaves an unclosed `<img ...` that the regex cannot strip, and that tag is then parsed in the outline panel. Every other markdown-derived HTML goes through sanitizeHtml, so this is the one path that skips DOMPurify. The CSP (no 'unsafe-inline') blocks inline event handlers, but arbitrary markup, links and forms can still be injected, and the panel layout breaks.

**Fix:** Build the outline items with createElement and textContent / dataset.id, or at least escapeHtml(item.text) and escapeHtml(item.id), the same way filetree.js and recent.js do.

### Relative links with #fragment, %-encoding or non-file schemes fail silently

`modules/view.js:147` - correctness

Every href that is not '#...' or http(s) is passed unchanged to resolveLink, which runs path.resolve(baseDir, href). `other.md#section` resolves to a path ending in '#section', so exists is false and nothing happens. `my%20file.md` is not decoded. `mailto:` links also arrive here, and since e.preventDefault() has already run they do nothing, even though the main open-external handler allows mailto:.

**Fix:** Parse href with new URL(href, pathToFileURL-like base) or split off the fragment and decodeURIComponent the path before resolving, and send mailto: to openExternal. After opening the target tab, scroll to the fragment.

### Non-markdown link targets are opened with a hand-built, unencoded file:// URL

`modules/view.js:156` - correctness

`window.electronAPI.openExternal(`file://${result.resolvedPath}`)` concatenates a raw filesystem path. Paths containing '#', '?', '%' or spaces turn into a different URL, and a Windows path (C:\x\y) gives the malformed `file://C:\x\y`. Clicking a link in an untrusted document also opens any existing local file with the OS default handler, which includes executables and scripts (for example .exe or .desktop on some platforms). Nothing prompts the user or restricts by file type.

**Fix:** Build the URL in main with pathToFileURL(resolvedPath).href (or use shell.openPath), and consider confirming or blocking executable file types.

## Low

### Mermaid source is inserted into HTML without escaping

`main.js:367` - correctness

`return `<div class="mermaid">${codeText}</div>\n`;` puts the raw fenced-code text into HTML. The text is then parsed as HTML and run through DOMPurify before mermaid reads it back from innerHTML. Diagram text containing `<`, `&` or tag-like sequences (for example `A --> B : x<y` or `<br>` labels) gets mangled or stripped. Raw HTML inside the block also reaches the sanitizer as markup, and mermaid then renders it with securityLevel 'loose'. Ordinary code blocks are escaped a few lines below, so this branch is inconsistent with them.

**Fix:** Escape codeText with the existing escapeAttribute/escape helper. Mermaid entity-decodes node content before parsing, so diagrams still render correctly.

### navigate-folder never returns success:false because buildFileTree swallows its errors

`main.js:504` - correctness

buildFileTree catches every error and returns `[]` (lines 763-766). The try/catch in the 'navigate-folder' handler can therefore never fire. A missing or unreadable folder returns `{ success: true, tree: [] }`, so the renderer shows an empty folder instead of handling the failure. The handler also accepts any renderer-supplied path without validation.

**Fix:** Let buildFileTree throw at the top level (depth 0) and swallow errors only for subdirectories, or stat the folder in the handler before building the tree.

### Heading lookups use document.getElementById and can collide with app element IDs

`modules/view.js:103` - correctness

Outline clicks (`document.getElementById(id)`) and anchor links (`document.getElementById(targetId)`) search the whole document. generateSlug lowercases heading text, so a heading named "Sidebar" gets id="sidebar", the same id as the app's #sidebar element, which comes earlier in the document. The outline item and `#sidebar` links then scroll to the wrong element. table-wrapper lookups at line 50 have the same problem with raw-HTML ids.

**Fix:** Scope the lookup to the document content: markdownContent.querySelector(`#${CSS.escape(id)}`).

### createTab has a check-then-await race that creates duplicate tabs

`modules/tabs.js:61` - correctness

createTab runs findTabByPath(filePath) and then awaits openFileInTab before registering the tab. Two quick calls for the same path (two clicks on a tree item or recent doc, or a link click during a tree click) both pass the duplicate check and create two tabs for one file. Those two tabs then have independent drafts, and the main-process watcher is released when either one closes.

**Fix:** Track in-flight opens in a Map<filePath, Promise> and return the pending promise, or re-check findTabByPath after the await.

## Appendix: unverified notes

- `main.js:187` (consistency) Command-line file check accepts only '.md' with exact case
- `main.js:371` (consistency) Code-block language is interpolated into an attribute unescaped; escape logic is duplicated
- `main.js:311` (docstring) Comment says 'marked v11+' uses token objects, but the installed v11.2 does not
- `main.js:413` (dead-code) setupWatcher parameter is never passed
- `main.js:207` (correctness) Watchers, openDocuments and fileToOpen outlive the window on macOS
- `main.js:655` (correctness) print-ready/print-failed listeners are global and do not check the sender
- `modules/search.js:72` (correctness) Search: overlapping matches, stale matches after re-render, and no results in source view
- `renderer.js:122` (correctness) Active highlight on recent documents is lost when a file is opened via the dialog
- `modules/edit-mode.js:115` (correctness) Async IPC rejections are unhandled in refreshPreview and handleExportPdf
- `modules/filetree.js:15` (consistency) handleOpenFolder duplicates navigateToFolder but does not clear expandedFolders
- `modules/copy.js:22` (consistency) Active tab is looked up two different ways
- `modules/recent.js:59` (correctness) getDirectoryPath only recognizes '/' separators

## Refuted during verification

- print.js:17 Mermaid runs with securityLevel 'loose' and htmlLabels on untrusted documents
