# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.0] - 2026-09-18

### Added
- Export the open document as PDF, from the header button or Cmd/Ctrl+P: A4 pages, always light, with mermaid diagrams rendered

## [1.4.0] - 2026-09-18

### Added
- Edit mode (Cmd/Ctrl+E): a per-tab split view with a markdown editor and a live preview, with the editor coming from the shared markdown-editor package
- Save button in the header and Cmd/Ctrl+S; documents with unsaved changes are marked in the header and tab bar
- Confirmation before unsaved changes are lost when closing a tab, reloading, or quitting, with Save All on quit
- Banner when a file open for editing changes on disk, offering Reload or Keep Mine

### Changed
- Tests run without showing app windows; `npm run test:headed` shows them

### Fixed
- Release builds failed on every tag because electron-builder published implicitly without permission
- Release candidate tags are published as prereleases

## [1.4.0-rc.5] - 2026-09-18

### Fixed
- Selecting text in the editor showed no highlight: CodeMirror's selection layer was painted behind the editor background, and the opaque active-line color covered the selection on the line being selected (markdown-editor v1.0.2)

## [1.4.0-rc.4] - 2026-09-18

### Added
- Save button in the header, shown while editing or while changes are unsaved

### Changed
- Closing the window or quitting with unsaved changes now offers Save All, Don't Save, or Cancel; it previously only offered discarding

## [1.4.0-rc.3] - 2026-09-18

### Fixed
- Editor selection was nearly invisible in dark mode, and CodeMirror's default green match and magenta search highlights hid the text under them; all highlights are now translucent layers over the editor background, and the find panel follows the app theme (markdown-editor v1.0.1)

## [1.4.0-rc.2] - 2026-09-17

### Fixed
- Release builds no longer fail on tags: electron-builder published implicitly without permission (also the cause of the failed v1.2.0 release run)
- Release candidate tags are published as prereleases

## [1.4.0-rc.1] - 2026-09-17

### Added
- Edit mode (Cmd/Ctrl+E): split view with the shared markdown-editor package and a live preview, explicit saving (Cmd/Ctrl+S), unsaved-change confirmations, and a banner when a modified file changes on disk
- Tests run without showing app windows; `npm run test:headed` shows them
- Playwright test suite for automated testing
- ESLint for code quality
- GitHub Actions CI/CD workflows

## [1.1.0] - 2026-01-21

### Added
- In-document search functionality (Cmd/Ctrl+F)
- Mermaid diagram support
- Recent documents list
- File watching with auto-reload
- Outline navigation in sidebar
- File associations for .md files
- Dark mode toggle
- Font size controls
- A4/full-width view modes

### Changed
- Outline tab is now the default sidebar view
- Scroll position preserved on reload (Cmd+R and auto-reload)
- Updated Electron to v39.2.4

### Security
- Fixed security vulnerabilities in dependencies

## [1.0.0] - 2024-11-27

### Added
- Initial release
- Markdown rendering with marked library
- Sidebar with file tree navigation
- Cross-platform support (macOS, Windows, Linux)

[Unreleased]: https://github.com/sorenwacker/markdown-viewer/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/sorenwacker/markdown-viewer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/sorenwacker/markdown-viewer/releases/tag/v1.0.0
