# Changelog

All notable changes to this project should be documented in this file.

## 1.3.1 - 2026-03-13

### Fixed

- Removed leftover standalone rating numbers from exported ChatGPT result-card sections.
- Normalized inline `Sources:` spacing so source annotations no longer stick to the preceding sentence.

## 1.3 - 2026-03-12

### Changed

- Compacted ChatGPT result cards into short Markdown list items instead of exporting large thumbnail blocks.
- Improved prompt quoting so user-entered `>` lines are preserved as literal text inside the export.
- Improved list post-processing so lead-in bullet points can keep nested sub-items readable in the final Markdown.

### Fixed

- Fixed a Markdown normalization issue that removed indentation and flattened nested lists.
- Fixed readability regressions caused by ChatGPT product cards being exported too literally.
- Fixed quoted prompt formatting for structured prompts with manual quote markers.

## 1.2 - 2026-03-12

### Added

- Added extension icons in `assets/` and wired them into the manifest.
- Added `todo.md` with a grouped product backlog for future features.
- Added `changelog.md` to track extension releases and changes over time.

### Changed

- Improved full-chat export loading so older messages are loaded before export.
- Improved ChatGPT message detection using author-role containers to capture prompts and responses more reliably.
- Reworked the Markdown export format with a clearer metadata header and stronger separation between user prompts and AI responses.
- Changed user prompts to export as quoted blocks for better readability.
- Reduced the floating export button size and moved it to be less intrusive in the chat UI.
- Renamed the reference extension folders to clearer names for local comparison work.
- Updated the manifest branding to `Private AI Chat Exporter`.
- Updated local export filenames to use the format `chat-export-gpt-YYYY-MM-DD-HH-MM.md` and `chat-export-gemini-YYYY-MM-DD-HH-MM.md`.

### Fixed

- Fixed Gemini export deduplication so identical legitimate messages are not dropped.
- Fixed the export flow so scroll restoration happens after the export has been generated.
- Fixed Markdown conversion for lists, code blocks, headings, links, and several common rich-text structures.
- Fixed multiple export artifacts caused by chat UI controls, reasoning labels, and action buttons leaking into the output.
- Fixed a ChatGPT edge case where the first prompt could be missed in the export.

## 1.0 - 2026-03-12

### Added

- Initial open source release of the Chrome extension.
- Local Markdown export support for ChatGPT and Gemini conversations.
- Privacy-first approach with no backend, no telemetry, and no external export service.
