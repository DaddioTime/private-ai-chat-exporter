/**
 * Private AI Chat Exporter for Markdown.
 * Runs fully locally in the browser, with no tracking or backend.
 */

const EXPORT_BUTTON_ID = "private-md-export-btn";
const EXPORT_SEPARATOR = "\n\n---\n\n";

/**
 * Converts basic HTML content to Markdown.
 * @param {string} html
 * @returns {string}
 */
function htmlToMarkdown(html) {
  if (!html) return "";

  const markdown = html
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
      const sanitizedCode = code.replace(/<[^>]+>/g, "");
      return "```\n" + sanitizedCode + "\n```";
    })
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "_$1_")
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "_$1_")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, "$1\n")
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, "$1\n")
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(
      /Powered by \[ChatGPT Exporter\]\(https:\/\/www\.chatgptexporter\.com\)/gi,
      ""
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return markdown.trim();
}

/**
 * Triggers a local file download.
 * @param {string} content
 * @param {string} filename
 */
function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats a local timestamp for export filenames.
 * @param {Date} date
 * @returns {string}
 */
function formatFilenameTimestamp(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}-${hours}-${minutes}`;
}

/**
 * Detects the current export platform from the hostname.
 * @param {string} host
 * @returns {"gpt" | "gemini" | null}
 */
function detectPlatform(host) {
  if (host.includes("chatgpt.com") || host.includes("openai.com")) {
    return "gpt";
  }

  if (host.includes("gemini.google.com")) {
    return "gemini";
  }

  return null;
}

/**
 * Collects messages from ChatGPT.
 * @returns {{ markdown: string, count: number }}
 */
function exportChatGpt() {
  let markdown =
    "# ChatGPT Export (" + new Date().toLocaleDateString("en-US") + ")\n\n";
  let count = 0;
  const conversationTurns = document.querySelectorAll(
    '[data-testid^="conversation-turn"]'
  );

  conversationTurns.forEach((turn) => {
    const userMessage = turn.querySelector('[data-testid^="user-message"]');
    const aiMessage = turn.querySelector(".markdown");

    if (userMessage) {
      markdown +=
        "**User:**\n" + htmlToMarkdown(userMessage.innerHTML) + EXPORT_SEPARATOR;
      count++;
      return;
    }

    if (aiMessage) {
      markdown +=
        "**ChatGPT:**\n" +
        htmlToMarkdown(aiMessage.innerHTML) +
        EXPORT_SEPARATOR;
      count++;
    }
  });

  return { markdown, count };
}

/**
 * Collects messages from Gemini.
 * @returns {{ markdown: string, count: number }}
 */
function exportGemini() {
  let markdown =
    "# Gemini Export (" + new Date().toLocaleDateString("en-US") + ")\n\n";
  let count = 0;
  const selectors = "user-query, .model-response-text, message-content";
  const conversationEntries = Array.from(
    document.querySelectorAll(selectors)
  ).filter((element) => {
    const parentMatch = element.parentElement?.closest(selectors);
    return !parentMatch;
  });

  conversationEntries.forEach((entry) => {
    const content = entry.innerHTML.trim();
    if (!content) return;

    const isUser =
      entry.matches("user-query") || Boolean(entry.closest("user-query"));
    const role = isUser ? "**User:**" : "**Gemini:**";

    markdown += role + "\n" + htmlToMarkdown(content) + EXPORT_SEPARATOR;
    count++;
  });

  return { markdown, count };
}

/**
 * Runs the export for the current platform.
 */
function startExport() {
  const host = window.location.hostname;
  const platform = detectPlatform(host);
  let result = { markdown: "", count: 0 };

  if (platform === "gpt") {
    result = exportChatGpt();
  } else if (platform === "gemini") {
    result = exportGemini();
  }

  if (result.count === 0) {
    result.markdown +=
      "_No messages found. Please make sure the chat is fully loaded._\n\n";
  }

  result.markdown += "Created with ❤️ for privacy.";

  const timestamp = formatFilenameTimestamp(new Date());
  const platformName = platform || "chat";
  triggerDownload(
    result.markdown,
    `chat-export-${platformName}-${timestamp}.md`
  );
}

/**
 * Inserts the export button into the page.
 */
function injectExportButton() {
  if (document.getElementById(EXPORT_BUTTON_ID) || !document.body) return;

  const button = document.createElement("button");
  button.id = EXPORT_BUTTON_ID;
  button.type = "button";
  button.textContent = "⬇️ Markdown Export";
  button.addEventListener("click", startExport);

  document.body.appendChild(button);
}

setInterval(injectExportButton, 2000);
injectExportButton();
