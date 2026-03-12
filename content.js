/**
 * Private Chat Exporter - Markdown
 * Purely local, no tracking, no backend.
 */

/**
 * Basic HTML to Markdown converter.
 * @param {string} html - The HTML content to convert.
 * @returns {string} - Cleaned Markdown string.
 */
function convertToMarkdown(html) {
  if (!html) return "";
  let md = html
    // Handle code blocks (common in AI responses)
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, code) => "```\n" + code.replace(/<[^>]+>/g, '') + "\n```")
    // Bold and Italic
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '_$1_')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '_$1_')
    // Headers
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n')
    // Lists
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n')
    // Links
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // Paragraphs and breaks
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Cleanup branding or common footers
    .replace(/Powered by \[ChatGPT Exporter\]\(https:\/\/www\.chatgptexporter\.com\)/gi, '')
    // Decode common HTML entities
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  return md.trim();
}

/**
 * Triggers a local file download.
 */
function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Logic for ChatGPT (chatgpt.com / openai.com)
 */
function exportChatGPT() {
  let markdown = "# ChatGPT Export (" + new Date().toLocaleDateString() + ")\n\n";
  const turns = document.querySelectorAll('[data-testid^="conversation-turn"]');
  let count = 0;

  turns.forEach(turn => {
    // Check if user message
    const userMsg = turn.querySelector('[data-testid^="user-message"]');
    // Check if AI message (usually inside a div with class "markdown")
    const aiMsg = turn.querySelector('.markdown');

    if (userMsg) {
      markdown += `**User:**\n${convertToMarkdown(userMsg.innerHTML)}\n\n---\n\n`;
      count++;
    } else if (aiMsg) {
      markdown += `**AI:**\n${convertToMarkdown(aiMsg.innerHTML)}\n\n---\n\n`;
      count++;
    }
  });

  return { markdown, count };
}

/**
 * Logic for Gemini (gemini.google.com)
 */
function exportGemini() {
  let markdown = "# Gemini Export (" + new Date().toLocaleDateString() + ")\n\n";
  let count = 0;

  // We look for top-level containers to avoid duplicating nested elements
  const chatEntries = document.querySelectorAll('user-query, .model-response-text, message-content');
  
  // Track processed elements to prevent duplicates if selectors overlap
  const seen = new Set();

  chatEntries.forEach(entry => {
    // Avoid processing the same text twice if nested
    if (seen.has(entry.innerText.trim())) return;
    
    const isUser = entry.tagName.toLowerCase() === 'user-query' || entry.closest('user-query');
    const role = isUser ? "**User:**" : "**Gemini:**";
    
    const content = entry.innerHTML;
    if (content) {
      markdown += `${role}\n${convertToMarkdown(content)}\n\n---\n\n`;
      seen.add(entry.innerText.trim());
      count++;
    }
  });

  return { markdown, count };
}

/**
 * Main export handler.
 */
function handleExport() {
  const host = window.location.hostname;
  let result = { markdown: "", count: 0 };

  if (host.includes('chatgpt.com') || host.includes('openai.com')) {
    result = exportChatGPT();
  } else if (host.includes('gemini.google.com')) {
    result = exportGemini();
  }

  if (result.count === 0) {
    result.markdown += "_No messages found. Please ensure the chat is fully loaded._\n\n";
  }

  result.markdown += "Created with ❤️ for privacy.";
  
  const dateStr = new Date().toISOString().split('T')[0];
  triggerDownload(result.markdown, `Chat-Export-${dateStr}.md`);
}

/**
 * Injects the export button into the UI.
 */
function injectButton() {
  if (document.getElementById('private-md-export-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'private-md-export-btn';
  btn.innerHTML = '⬇️ MD Export';
  btn.onclick = handleExport;
  
  // Style the button
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '10000',
    padding: '10px 15px',
    backgroundColor: '#10a37f', // ChatGPT/Gemini UI green-ish
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    fontFamily: 'sans-serif'
  });

  document.body.appendChild(btn);
}

// Initial injection and periodic check for SPA navigation
setInterval(injectButton, 2000);
injectButton();
