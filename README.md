# Private Chat Exporter

A privacy-first, 100% local browser extension to export ChatGPT and Gemini conversations to Markdown (.md).

## Why this exists

I created this extension because I needed a way to export my AI conversations to consult other AI models or archive them for my own use. While many "Chat Exporter" extensions exist, I discovered that many of them are **shady**:
- They send your conversation data to their own external servers.
- They include tracking and telemetry (like PostHog or Sentry).
- They hide the export logic behind a "Pro" paywall while harvesting your data.

Currently, many AI features are only available via the web browser and haven't been implemented in local CLI tools yet. This extension bridges that gap without compromising your privacy.

**This extension does NOT "call home." No servers, no tracking, no data collection.**

## Features

- **ChatGPT Support:** Exports full conversation threads from `chatgpt.com`.
- **Gemini Support:** Exports full conversation threads from `gemini.google.com`.
- **Markdown Export:** Cleanly converts HTML, code blocks, and formatting into standard Markdown.
- **Privacy-First:** Everything happens locally in your browser.
- **Simple UI:** Adds a single "⬇️ MD Export" button to the chat interface.

## Installation

Since this is a privacy-focused tool, it is best installed manually as an "unpacked extension":

1. Download or clone this repository.
2. Open your browser's extension page (`chrome://extensions` or `arc://extensions`).
3. Enable **Developer Mode** (top right).
4. Click **Load unpacked**.
5. Select the folder containing these files.

## How it works

The extension uses a `content.js` script that:
1. Identifies if you are on ChatGPT or Gemini.
2. Injects a discrete export button.
3. On click, it scrapes the DOM for message turns, converts them to Markdown using local regex-based logic, and triggers a local browser download.

---

Created with ❤️ for privacy.
