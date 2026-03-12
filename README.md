# Private AI Chat Exporter

A Chrome extension that exports ChatGPT and Gemini conversations completely locally as Markdown files (`.md`).

## Why I built this extension

I wanted a clean way to export my AI conversations from the browser so I could reuse them with other models later or archive them for myself. Many existing "Chat Exporter" extensions were not a good option:

- They send conversation content to their own external servers.
- They include tracking or telemetry, for example through analytics or error-reporting services.
- They hide the actual export feature behind a paywall while still collecting data.

Because many AI features are still only available in the browser and not in local CLI tools, this extension closes that gap without giving up privacy.

**This extension does not call home: no servers, no tracking, no data collection.**

## What this repo contains

This repo contains a Chrome extension for ChatGPT and Gemini. It injects an export button on `chatgpt.com`, `chat.openai.com`, and `gemini.google.com`, then saves the current chat locally as a Markdown file.

## Features

- Exports full conversations from ChatGPT.
- Exports full conversations from Gemini.
- Converts HTML, code blocks, and formatting into Markdown.
- Runs entirely locally in the browser.
- Adds a simple export button to the chat UI.
- Saves files as `chat-export-gpt-YYYY-MM-DD-HH-MM.md` or `chat-export-gemini-YYYY-MM-DD-HH-MM.md`.

## Installation in Chrome

The extension is intentionally designed to be installed manually as an unpacked Chrome extension:

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable Developer Mode.
4. Click `Load unpacked`.
5. Select this project folder.

Note: Other Chromium-based browsers such as Arc can usually load the extension the same way.

## How the export works

The `content.js` script:

1. Detects whether you are on ChatGPT or Gemini.
2. Injects a discrete Markdown export button.
3. Reads the visible messages from the DOM.
4. Converts the content to Markdown locally.
5. Triggers a local browser download.

## Privacy

All data stays in the browser. There is no backend, no cloud connection, and no sending of conversation content to third parties.

## Contributing

This project is open source. If you want to improve it, extend it, or make the export logic more robust, contributions are welcome.

## License

This project is released under the MIT License. See the `LICENSE` file for details.

Created with ❤️ for privacy.
