# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
