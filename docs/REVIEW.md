# Codebase Review

Date: 260615 (initial), re-reviewed 260618
Scope: full source tree of markdown-viewer (Electron) — `main.js`, `preload.js`, `renderer.js`, `renderer.html`, `styles.css`, `tests/`, and config files.
Method: per-module review (one agent per group) followed by adversarial verification of every high/medium finding. 21 files reviewed, 22 findings produced; 11 confirmed, 1 refuted, 10 lower-confidence notes retained as an appendix. The 260618 re-review is recorded in the section below; the 260615 record follows it unchanged.

## Re-review (260618)

Re-ran the review after the copy-source feature was added (clipboard IPC in `main.js`, `copyToClipboard` in `preload.js`, `handleCopySource` + header button + `Cmd/Ctrl+Shift+C` in `renderer.js`/`renderer.html`, `.copied` state in `styles.css`). The multi-agent verification workflow could not run (account session limit), so findings were verified inline by reading the cited code and, where behavior was in doubt, by executing it.

### Baseline gates (260618)

| Gate | Command | Result |
|------|---------|--------|
| Lint / format | `npm run lint` (`eslint .`) | PASS (clean) |
| Tests | `npm test` (`playwright test`) | PASS (23/23) |
| Dead code | `eslint` `no-unused-vars` (error) | PASS — no unused vars/imports |
| File-size rule (<=1000 LOC) | style guide | PASS (after remediation) — `renderer.js` split into ES modules (largest 233 LOC); `styles.css` split into `css/` partials via `@import` (largest 368 LOC) |
| TODO/FIXME markers | grep | none |
| Pre-commit hooks | n/a | not configured |
| Type checker | n/a | not configured (plain JS) |

### Prior findings

All 11 confirmed findings and the appendix items from 260615 remain fixed; no regressions found. The DOMPurify sanitization, escaped-interpolation, `open-external` scheme allow-list, per-parse `Marked` instance, and watcher-timer fixes are all still in place.

### New / remaining findings (260618)

Verified by direct code inspection. No high-severity findings.

#### Medium

- **renderer.js (file-level) / styles.css (file-level) — exceeded the 1000-LOC rule.** `renderer.js` was 1196 LOC and `styles.css` 1100 LOC; deferred at 260615. **Fixed (260618):** `renderer.html` now loads `renderer.js` as `type="module"`, and the renderer was split into `modules/` (dom, html, state, view, tabs, copy, recent, filetree, search, prefs) wired by a 233-LOC bootstrap. `styles.css` became a list of `@import`s pulling `css/{base,sidebar,header,content,components}.css`. Largest files are now `css/content.css` (368) and `modules/tabs.js` (224). ESLint gained a `sourceType: 'module'` block for the renderer files; `package.json` `build.files` now bundles `modules/**/*.js` and `css/**/*.css`. All 25 tests pass.

#### Low

- **renderer.js:354 (correctness) — `getRecentDocuments` parses `localStorage` without a guard.** `return stored ? JSON.parse(stored) : []` throws if `recentDocuments` holds invalid JSON. It is called from `renderRecentDocuments()`, which runs at renderer init, so a corrupt/legacy value breaks startup of the recent-documents panel. Fix: wrap in `try/catch` and fall back to `[]` (and clear the bad key).
- **renderer.js:144 vs 665 (naming) — `switchToTab` and `switchTab` are near-identical names for unrelated concepts.** `switchToTab(tabId)` activates a document tab; `switchTab(tabName)` toggles the sidebar Files/Outline panes. The names invite confusion. Fix: rename the sidebar one (e.g. `switchSidebarPane`).
- **main.js:155 (design) — `watchFile` reload parses the file before checking `mainWindow`.** The debounced callback does `await parseMarkdownFile(filePath)` and only then `if (mainWindow)`. On macOS the app stays alive with the window closed, so a watched file changing still triggers disk read + parse with no consumer. Fix: check `if (!mainWindow) return` before parsing.
- **renderer.js:869 (design/security) — mermaid runs with `securityLevel: 'loose'` and `htmlLabels: true`.** Diagram-defined links/HTML render with loose security after the container is sanitized, leaving a residual injection surface for a crafted diagram in an opened file. Threat model is a user-opened local file, so severity is low; consider `securityLevel: 'strict'` unless loose features are required.
- **renderer.js:164 (correctness, cosmetic) — copy-source button icon state is not reset on tab switch.** `switchToTab` shows the button but does not restore the copy/checkmark icons, so a checkmark shown just before switching tabs lingers on the next document until the 1.5s timer fires. Fix: reset the icon state (and clear `copyFeedbackTimer`) in `switchToTab`.
- **tests/copy.spec.js (test hygiene) — the copy tests read/write the real system clipboard.** Running the suite overwrites whatever the user had on the clipboard. Acceptable for a local Electron test, but worth noting; there is no isolation.

### Remediation status (260618)

Fixed in the same session (gates after: ESLint clean, 25/25 Playwright tests pass):

| Finding | Status |
|---------|--------|
| `getRecentDocuments` unguarded `JSON.parse` | Fixed — `try/catch`, non-array guard, and removal of the corrupt key; covered by `tests/recent-docs.spec.js` |
| Copy-source checkmark lingers on tab switch | Fixed — `resetCopyFeedback` helper called from `switchToTab`; covered by a new `tests/copy.spec.js` case |
| `switchTab`/`switchToTab` name collision | Fixed — sidebar function renamed to `switchSidebarPane` |
| `watchFile` parses before the `mainWindow` check | Fixed — early `return` when no window before the disk read/parse |
| mermaid `securityLevel: 'loose'` | Left as-is by decision — `'strict'` disables `htmlLabels` and diagram links; not justified for the user-opened-local-file threat model with a sanitized container |
| Copy tests touch the real system clipboard | Accepted — no isolation available in the Electron test harness; documented |

The file-size rule (`renderer.js`, `styles.css`) — previously deferred — was also resolved this session via the ES-module and `@import` splits described in the Medium finding above.

### Refuted (260618)

- **Headings drop inline markdown formatting.** Candidate finding: the custom `heading` renderer in `main.js` returns `token.text`, suspected to be raw markdown, losing bold/code/links. Refuted by execution: with marked 11.2.0, `token.text` already contains rendered inline HTML, so ``# Hello **bold** and `code` and [link](...)`` produces `<strong>`, `<code>`, and `<a>` correctly — identical to marked's default heading output. The custom renderer only adds the `id`, and `generateSlug` strips the inline tags for the slug.
- **Outline text injected without escaping** (re-confirming the 260615 refutation). `extractOutline` strips tags and marked already entity-escapes inline text, so the value inserted into the outline is inert.

---

## Initial review (260615)

## Baseline gates

| Gate | Command | Result |
|------|---------|--------|
| Lint / format | `eslint .` | PASS (clean) |
| Tests | `playwright test` | PASS (17/17) |
| File-size rule (<=1000 LOC) | style guide | FAIL — `renderer.js` 1133 LOC, `styles.css` 1103 LOC |
| TODO/FIXME markers | grep | none |
| Pre-commit hooks | n/a | not configured |
| Type checker | n/a | not configured (JS project) |

## Remediation status (260615)

All confirmed findings and the cheap appendix items were fixed in the same session. Gates after remediation: ESLint clean, 18/18 Playwright tests pass.

| Finding | Status |
|---------|--------|
| Unsanitized markdown → innerHTML | Fixed — DOMPurify vendored into the renderer (`sanitizeHtml`), applied at all three `markdownContent.innerHTML` sites |
| Unescaped file paths/names in innerHTML | Fixed — `escapeHtml` helper applied in `renderTabBar`, `renderRecentDocuments`, `buildTreeHtml`, parent-folder row, and the error message |
| `open-external` scheme not validated | Fixed — handler now allow-lists `http/https/mailto/file` |
| Dead `read-file` / `reload-file` / `export-pdf` IPC + bridge methods | Removed (handlers and preload methods) |
| `_currentOutline` / `_currentFolderPath` write-only state | Removed |
| `currentFilePath` (dead once `reload-file` removed) | Removed, including the `watchFile` assignment |
| `watchFile` debounce timer never clearable | Fixed — timer stored on the map entry |
| `marked.use()` mutating global on every parse | Fixed — per-parse `new Marked(...)` instance |
| Dead `.sidebar-title` CSS / orphaned `Export PDF Group` comment | Removed |
| Tests assert presence, not behavior | Fixed — see below |

Test changes: added `tests/rendering.spec.js` (verifies DOMPurify strips `onerror`/`<script>`/`javascript:` while keeping benign markup) and a tab-bar filename-escaping test; rewrote `tests/tabs.spec.js` to drive real tab creation via the `load-markdown` IPC (removing the unused temp-file fixture) with honest describe names; rewrote search tests to drive the real Cmd/Ctrl+F path instead of mutating inline style and de-duplicated the hidden-by-default test; deleted the orphaned `tests/fixtures/test.md`. The `window` test fixture now waits for `domcontentloaded` so one-shot actions are not lost before listeners attach.

Embedded media: external (`http`/`https`), `data:`, and local images now display. The CSP gained `img-src 'self' data: file: http: https:`; relative image sources are rewritten to absolute `file://` URLs in `parseMarkdownFile` (`resolveImageSrc`), and the renderer sanitizer's URI allow-list was extended to permit `file:` so local images survive sanitization. Mermaid code blocks continue to render (their `<div class="mermaid">` survives sanitization and is processed after insertion).

Deferred (not code defects; left for an explicit decision):

- **File size** — `renderer.js` (~1170 LOC) and `styles.css` (1094 LOC) still exceed the 1000-LOC rule. Splitting them is a larger refactor (the renderer loads as a single plain script with no module system) and was not attempted as part of this sweep.

## Summary

| Severity | Confirmed findings |
|----------|--------------------|
| High | 0 |
| Medium | 5 |
| Low | 6 |

Recurring themes:

1. **Unsanitized HTML reaches `innerHTML`.** The core rendering path inserts both `marked`-generated HTML and string-interpolated file metadata into the DOM with no escaping. The verifiers downgraded the severity from high to medium because the renderer CSP (`script-src 'self' 'unsafe-eval'`, no `'unsafe-inline'`) blocks inline event handlers and `<script>` tags do not execute via `innerHTML`, but `javascript:` URIs, HTML injection, and attribute breakage remain real for untrusted markdown.
2. **Half-wired / dead IPC surface.** Three contextBridge methods (`readFile`, `reloadFile`, `exportPdf`) and their main-process handlers have no caller anywhere. This widens the Electron security boundary for no functional gain.
3. **Write-only dead state.** Two underscore-prefixed renderer variables (`_currentFolderPath`, `_currentOutline`) are assigned but never read; the `^_` lint ignore pattern hides them from `no-unused-vars`.
4. **Tests assert presence, not behavior.** The `tabs.spec.js` fixture machinery and the `test.md` fixture are unused; search tests bypass the real toggle logic by mutating inline style.

## Confirmed findings

### Medium

#### main.js:271 — Markdown rendered to HTML without sanitization (XSS)
`parseMarkdownFile` does `marked.parse(content)` with no sanitizer (`marked` v4+ removed the `sanitize` option; no DOMPurify anywhere in the project). The HTML travels over IPC (`load-markdown` / `file-changed` / `open-file-in-tab`) and is inserted via `markdownContent.innerHTML = tab.html` (renderer.js:133, 449, 479). Raw HTML in a `.md` file passes through verbatim.

Verifier note: `<script>` set via `innerHTML` does not execute, and the CSP (no `'unsafe-inline'`) blocks `onerror`/`onclick` attributes, so the most direct script paths are mitigated. Genuine remaining vectors: `javascript:` URIs in `<a href>`, HTML/phishing injection, and inline-CSS attacks (`style-src 'unsafe-inline'`). Requires the user to open an untrusted file.

Fix: run the generated HTML through DOMPurify (in main via jsdom, or in the renderer immediately before `innerHTML`); at minimum strip event-handler attributes and dangerous URI schemes. Also escape the heading text and `id` in the custom `heading` renderer (main.js:231), which currently emits them raw.

#### main.js:439 — `open-external` IPC handler does not validate the URL scheme
`ipcMain.handle('open-external', async (event, url) => { await shell.openExternal(url); })` forwards any string to `shell.openExternal`, which can launch arbitrary protocol handlers (`file:`, `smb:`, OS-registered custom schemes). The renderer-side checks (renderer.js:285, 301) are not a security boundary — the channel is directly callable from any renderer-context JS, and unsanitized markdown (finding above) makes the renderer attacker-influenced.

Fix: validate in the handler — `const u = new URL(url); if (!['http:','https:','mailto:'].includes(u.protocol)) return;` (add `file:` only if intended).

#### main.js:389 — IPC handlers `read-file` and `reload-file` are never invoked
No call to `electronAPI.readFile` or `electronAPI.reloadFile` exists in renderer.js, renderer.html, or tests. The renderer opens files via `openFileInTab`/`createTab` and the open dialog only. The menu's `{ role: 'reload' }` is Electron's built-in window reload, not this custom IPC. (`navigate-folder` IS used; only these two are dead.)

Fix: remove the `read-file` and `reload-file` `ipcMain.handle` blocks and their preload wrappers, or wire `reload-file` to a real menu/keyboard action if manual reload is intended.

#### renderer.js:43 — `_currentOutline` is write-only dead state
`let _currentOutline = []` is assigned only at line 863 (inside `renderOutline`) and never read anywhere. The `^_` prefix exempts it from `no-unused-vars`.

Fix: remove the declaration and the assignment at line 863.

#### renderer.js:206 — Unescaped file paths/names interpolated into innerHTML
`renderTabBar` interpolates `tab.filePath` and `tab.fileName` directly into `innerHTML` (lines 206-207); `renderRecentDocuments` does the same with `doc.path`/`doc.name` (lines 386-391). A file named e.g. `x"><img src=x onerror=alert(1)>.md` breaks the attribute/markup and can inject DOM. File names are attacker-influenced when opening from untrusted folders.

Fix: escape interpolated values with a small `escapeHtml` helper, or build the nodes with DOM APIs / `textContent` / `dataset` instead of raw template strings.

#### tabs.spec.js:8 — `beforeAll`/`afterAll` fixture setup is never used by any test
`beforeAll` creates a temp dir and writes three cross-linking markdown files; `afterAll` cleans up. `tempDir` is read only inside those hooks. No test opens or references the files — every test asserts DOM element presence/CSS that holds regardless of any open file. The file-creation machinery and the `fs`/`os` write logic are dead.

Fix: remove the unused setup (and the now-unneeded `fs`/`os` requires), or add tests that open these files via the open-file IPC to exercise tab creation and intra-folder link navigation as the fixture content intends.

### Low

#### main.js:144 — `watchFile` overwrites `currentFilePath` for every watched file
`watchFile` sets `currentFilePath = filePath` unconditionally; `open-file-in-tab` calls it per tab, so `currentFilePath` tracks the most-recently-watched file, not the active document. This conflates "which file am I watching" with "which file is active". Matters only if `reload-file` (dead, above) is kept.

Fix: remove the `currentFilePath` assignment from `watchFile`; track the active document explicitly when a tab becomes active.

#### preload.js:9 — `readFile` bridge method is never used
Exposes `readFile -> 'read-file'`; no consumer in the renderer. Object-property dead code that `no-unused-vars` cannot catch. Widens the contextBridge surface with no consumer.

Fix: remove `readFile` from preload.js (and its orphaned `read-file` handler in main.js).

#### preload.js:10 — `reloadFile` bridge method is never used
Exposes `reloadFile -> 'reload-file'`; no reference anywhere. Matching handler at main.js:395 is never triggered.

Fix: remove `reloadFile` from preload.js and the `reload-file` handler from main.js, or wire it to an actual UI affordance.

#### preload.js:11 — `exportPdf` bridge method is never used
Exposes `exportPdf -> 'export-pdf'`; no `electronAPI.exportPdf` call and no menu item invokes the channel. The `export-pdf` handler at main.js:404 is unreachable. The PDF-export feature is half-wired.

Fix: either add a UI control (menu/button) that calls `electronAPI.exportPdf`, or remove the bridge method and its handler.

#### renderer.js:42 — `_currentFolderPath` is write-only dead state
Assigned at lines 635 and 647, never read; the actual folder state lives in `currentFolder`. The `^_` prefix hides it from the linter.

Fix: remove the declaration and the two assignments; `currentFolder` already holds this value.

## Refuted findings

- `renderer.js:868` — "Outline heading text inserted into innerHTML without entity-escaping." Refuted on verification (the verifier could not confirm the unescaped path from the actual code).

## Appendix — unverified lower-confidence notes

These were not run through adversarial verification (low severity). Treat as leads, not confirmed defects.

- **main.js:169 (correctness)** — `debounceTimer` stored in the `fileWatchers` map is captured as `null` at registration; the watcher callback reassigns only the local, so `unwatchFile`'s `clearTimeout` branch is dead and a pending reload can fire after unwatch. Fix: store/update the timer on the map entry.
- **main.js:264 (design)** — `marked.use()` is called on every parse, mutating the global `marked` singleton cumulatively. Fix: configure once at module load, or use a per-parse `new marked.Marked({...})` instance.
- **renderer.js:915 (correctness)** — error message interpolated into `innerHTML` unescaped (error-path only; same pattern as renderer.js:206). Fix: use `textContent` or escape.
- **styles.css:85 (dead-code)** — `.sidebar-title` rule is never referenced. Fix: remove.
- **styles.css:347 (dead-code)** — orphaned `/* Export PDF Group */` comment mislabels the Icon Buttons section (no PDF feature exists). Fix: delete the comment.
- **renderer.html:6 (design)** — CSP has no `img-src`, so external markdown images are blocked by `default-src 'self'` (silent functional limitation). Fix: add explicit `img-src` if external images are intended, or document the deliberate block.
- **tabs.spec.js:50 (naming)** — "Tab Manager State" / "Link Interception" describe blocks only assert element presence; names overstate coverage. Fix: rename or implement real assertions.
- **test.md:0 (dead-code)** — `tests/fixtures/test.md` is referenced by no test. Fix: wire into a real search/outline test, or delete.
- **search.spec.js:4 (consistency)** — "should have search bar hidden by default" is duplicated in app.spec.js:25. Fix: keep one copy (search.spec.js).
- **search.spec.js:18 (design)** — search tests force the bar open by mutating inline `style.display` instead of triggering the real toggle (Cmd/Ctrl+F / `toggleSearch`), so the real open path is never tested. Fix: drive via the real shortcut/control.
</content>
</invoke>
