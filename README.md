# Confluence Markdown Exporter Browser Extension

This repository contains a Chromium Manifest V3 extension for Confluence. It's in development phase.

## Problem scope

Confluence does not provide a native Markdown export flow for selected page content.

This extension adds a context menu action:

1. Select content on a Confluence page.
2. Right-click and choose Copy to Markdown.
3. The selected content is converted to Markdown and copied to the clipboard.

## Feasibility

The project is feasible and implementation has started.

- No hard technical blocker exists for a pragmatic MVP.
- Perfect fidelity is not realistic for every Confluence macro or card type.
- Complex/unsupported blocks are exported with readable fallback placeholders.

## Current implementation status

Implemented in this repo:

1. Manifest V3 scaffold.
2. Service worker that registers a context menu action for selected text.
3. Confluence URL guard for the command flow.
4. Content script runtime injection on demand.
5. Selection extraction and Markdown conversion pipeline.
6. Clipboard copy via Clipboard API with fallback to execCommand copy.
7. In-page toast feedback and background badge status.

## Architecture (MVP)

- manifest.json
	- Declares MV3 extension with required permissions.
- src/background.js
	- Creates context menu and triggers conversion flow.
	- Injects scripts and sends COPY_SELECTION_AS_MARKDOWN message.
- src/contentScript.js
	- Handles conversion request.
	- Reads selection, calls converter, writes clipboard, shows toast, returns result.
- src/markdownConverter.js
	- Normalizes Confluence-specific nodes (mentions, emojis, cards).
	- Converts common structures to Markdown.
	- Returns unsupported node summary for diagnostics.

## Permissions

The extension currently uses a least-privilege activeTab flow:

- contextMenus
- activeTab
- scripting
- clipboardWrite

No broad host permissions are required for the current MVP flow.

## Local run instructions

1. Open Chromium/Chrome and go to chrome://extensions.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project root folder.
5. Open a Confluence page in the browser.
6. Select content, right-click, and click Copy to Markdown.
7. Paste into any editor to verify output.

## Supported content (current)

- Paragraphs
- Headings (h1-h6)
- Inline formatting (bold, italic, strike, code)
- Links
- Unordered and ordered lists
- Task list checkboxes (basic)
- Blockquotes
- Fenced code blocks
- Basic tables
- Inline images

## Known limitations (current)

- Some Confluence macros are lossy and rendered as fallback placeholders.
- Complex smart cards and app-specific blocks are not fully represented.
- Advanced table semantics such as merged cells are not preserved.
- Markdown output is best-effort for deeply nested mixed-format selections.

## Next milestones

1. Add richer Confluence block/macro mapping.
2. Add fixture-based regression tests for converter behavior.
3. Add configurable Markdown style options.
4. Improve unsupported-content diagnostics and reporting.