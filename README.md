# Private AI Chat Exporter

A Chrome extension that exports ChatGPT and Gemini conversations completely locally as Markdown files (`.md`).

## Why I built this extension

I built this extension because I needed a simple and trustworthy way to export my AI conversations from the browser. I often want to keep useful chats, move them into my notes, reuse them with other AI models, or archive them for later reference. In practice, that turns out to be surprisingly difficult when the conversation only exists inside a browser UI.

I looked at a number of existing "Chat Exporter" extensions first, but many of them felt like the exact opposite of what a privacy-sensitive export tool should be. Too often, they ask users to trust a black box while handling highly personal or sensitive chat content. Some push conversation data through their own external servers. Some ship with tracking or telemetry tools such as PostHog or Sentry. Others lock the real export functionality behind a "Pro" paywall while still collecting usage data along the way.

That was the main reason for this project: I wanted a version that stays easy to inspect, easy to install, and easy to trust. No backend. No account. No cloud dependency. No hidden processing outside the browser. Just a small extension that loads the conversation inside the browser, converts it into Markdown locally, and downloads the result directly to your machine.

Another part of the motivation is practical. A lot of AI functionality is still only available in the web interface and not yet available in local tools or clean export workflows. This extension helps bridge that gap while keeping ownership of the data with the user.

In short, this project exists as a privacy-first, open source alternative to opaque chat export tools:

- No external servers for handling your conversations.
- No tracking or telemetry built into the export flow.
- No paywall around the core export feature.
- No unnecessary complexity between your browser and your Markdown file.

**This extension does not call home: no servers, no tracking, no data collection.**

## What this repo contains

This repo contains a Chrome extension for ChatGPT and Gemini. It injects an export button only on `chatgpt.com`, `chat.openai.com`, and `gemini.google.com`, then saves the current chat locally as a Markdown file.

## Features

- Exports full conversations from ChatGPT.
- Exports full conversations from Gemini.
- Automatically scrolls upward before export to load lazy-loaded messages when needed.
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
3. Scrolls upward first when the site lazy-loads older messages.
4. Reads the loaded messages from the DOM.
5. Converts the content to Markdown locally.
6. Triggers a local browser download.

## Privacy

All data stays in the browser. There is no backend, no cloud connection, and no sending of conversation content to third parties.

## Contributing

This project is open source. If you want to improve it, extend it, or make the export logic more robust, contributions are welcome.

## License

This project is released under the MIT License. See the `LICENSE` file for details.

Created with ❤️ for privacy.
