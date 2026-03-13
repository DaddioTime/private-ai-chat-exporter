/**
 * Private AI Chat Exporter for Markdown.
 * Runs fully locally in the browser, with no tracking or backend.
 */

const EXPORT_BUTTON_ID = "private-md-export-btn";
const EXPORT_SEPARATOR = "\n\n---\n\n";
const BUTTON_IDLE_LABEL = "⬇️ Markdown Export";
const BUTTON_LOADING_LABEL = "Loading chat...";
const BUTTON_EXPORTING_LABEL = "Exporting...";
const LOAD_WAIT_MS = 350;
const LOAD_MAX_STEPS = 60;
const LOAD_STABLE_ROUNDS = 4;
const LOAD_TOP_SETTLE_MAX_ATTEMPTS = 12;
const MESSAGE_CONTENT_SEPARATOR = "\n\n";
const BLOCK_TAG_NAMES = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DETAILS",
  "DIV",
  "DL",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "UL",
]);
const UI_ARTIFACT_SELECTORS = [
  "script",
  "style",
  "noscript",
  "button",
  "textarea",
  "input",
  "select",
  "option",
  "form",
  "nav",
  "aside",
  ".sr-only",
  '[data-testid*="copy"]',
  '[data-testid*="thumb"]',
  '[data-testid*="voice"]',
  '[aria-label*="Copy"]',
  '[aria-label*="Like"]',
  '[aria-label*="Dislike"]',
  '[aria-label*="Read aloud"]',
  '[aria-label*="Good response"]',
  '[aria-label*="Bad response"]',
  '[aria-label*="Retry"]',
  '[aria-label*="Regenerate"]',
  '[aria-label*="Share"]',
].join(", ");
const UI_ARTIFACT_TEXT_PATTERNS = [
  /^copy$/i,
  /^copy code$/i,
  /^like$/i,
  /^dislike$/i,
  /^read aloud$/i,
  /^share$/i,
  /^edit$/i,
  /^retry$/i,
  /^regenerate$/i,
  /^good response$/i,
  /^bad response$/i,
  /^continue generating$/i,
  /^nachgedacht für\b/i,
  /^thought for\b/i,
  /^reasoned for\b/i,
  /^längerer denkvorgang$/i,
];

let exportInProgress = false;

/**
 * Normalizes plain text from HTML nodes.
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ");
}

/**
 * Normalizes inline text while preserving explicit line breaks.
 * @param {string} text
 * @returns {string}
 */
function normalizeInlineText(text) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n");
}

/**
 * Cleans up generated Markdown spacing.
 * @param {string} markdown
 * @returns {string}
 */
function normalizeMarkdown(markdown) {
  return markdown
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Removes obvious UI artifact lines outside fenced code blocks.
 * @param {string} markdown
 * @returns {string}
 */
function stripUiArtifactLines(markdown) {
  let insideCodeBlock = false;

  return markdown
    .split("\n")
    .filter((line) => {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("```")) {
        insideCodeBlock = !insideCodeBlock;
        return true;
      }

      if (insideCodeBlock) {
        return true;
      }

      const normalizedLine = trimmedLine.replace(/^>\s?/, "");
      if (!normalizedLine) {
        return true;
      }

      return !UI_ARTIFACT_TEXT_PATTERNS.some((pattern) =>
        pattern.test(normalizedLine)
      );
    })
    .join("\n");
}

/**
 * Returns whether a Markdown block is a single image.
 * @param {string} block
 * @returns {string}
 */
function getMarkdownImageUrl(block) {
  const match = block
    .trim()
    .match(/^!\[[^\]]*\]\((https?:\/\/[^)]+)\)$/);

  return match ? match[1] : "";
}

/**
 * Returns whether a Markdown block is a short plain-text line.
 * @param {string} block
 * @returns {boolean}
 */
function isShortPlainMarkdownBlock(block) {
  const text = block.trim();

  return (
    Boolean(text) &&
    !text.includes("\n") &&
    text.length <= 90 &&
    !/^(#|>|- |\* |\d+\. |```|Sources: |\|)/.test(text)
  );
}

/**
 * Returns whether a Markdown block looks like a price.
 * @param {string} block
 * @returns {boolean}
 */
function isPriceMarkdownBlock(block) {
  const text = block.trim();

  return (
    /^(CHF|EUR|USD|GBP|CAD|AUD)\s*\d/.test(text) ||
    /^[$€£]\s*\d/.test(text) ||
    /^\d[\d.,]*\s?(CHF|EUR|USD|GBP|CAD|AUD|[$€£])$/.test(text)
  );
}

/**
 * Returns whether a Markdown block looks like a vendor/source label.
 * @param {string} block
 * @returns {boolean}
 */
function isVendorMarkdownBlock(block) {
  const text = block.trim();

  return (
    isShortPlainMarkdownBlock(text) &&
    !isPriceMarkdownBlock(text) &&
    !/^Sources: /.test(text)
  );
}

/**
 * Collapses remote result cards into a compact Markdown list.
 * @param {string} markdown
 * @returns {string}
 */
function compactRemoteResultCards(markdown) {
  const blocks = normalizeMarkdown(markdown).split("\n\n");
  const compactedBlocks = [];

  for (let index = 0; index < blocks.length; index++) {
    const cardLines = [];

    while (index < blocks.length) {
      const imageUrl = getMarkdownImageUrl(blocks[index]);

      if (!imageUrl || !imageUrl.includes("images.openai.com/thumbnails/url/")) {
        break;
      }

      const titleBlock = blocks[index + 1];
      if (!isShortPlainMarkdownBlock(titleBlock || "")) {
        break;
      }

      let nextIndex = index + 2;
      let priceBlock = "";
      let vendorBlock = "";

      if (isPriceMarkdownBlock(blocks[nextIndex] || "")) {
        priceBlock = blocks[nextIndex].trim();
        nextIndex++;
      }

      if ((blocks[nextIndex] || "").trim() === "•") {
        nextIndex++;
      }

      if (isVendorMarkdownBlock(blocks[nextIndex] || "")) {
        vendorBlock = blocks[nextIndex].trim();
        nextIndex++;
      }

      if (!priceBlock && !vendorBlock) {
        break;
      }

      const compactParts = [titleBlock.trim()];
      if (priceBlock) {
        compactParts.push(priceBlock);
      }
      if (vendorBlock) {
        compactParts.push(vendorBlock);
      }

      cardLines.push(`- ${compactParts.join(" - ")}`);
      index = nextIndex;
    }

    if (cardLines.length > 0) {
      compactedBlocks.push(cardLines.join("\n"));
      index -= 1;
      continue;
    }

    compactedBlocks.push(blocks[index]);
  }

  return compactedBlocks.join("\n\n");
}

/**
 * Removes isolated card-rating blocks that remain after card cleanup.
 * @param {string} markdown
 * @returns {string}
 */
function removeStandaloneRatingBlocks(markdown) {
  const blocks = normalizeMarkdown(markdown).split("\n\n");

  return blocks
    .filter((block, index) => {
      const trimmedBlock = block.trim();
      const previousBlock = (blocks[index - 1] || "").trim();
      const nextBlock = (blocks[index + 1] || "").trim();

      if (!/^\d([.,]\d+)?$/.test(trimmedBlock)) {
        return true;
      }

      const ratingValue = Number(trimmedBlock.replace(",", "."));
      if (Number.isNaN(ratingValue) || ratingValue < 0 || ratingValue > 5) {
        return true;
      }

      const followsHeading = /^#{1,6}\s/.test(previousBlock);
      const precedesStructuredContent =
        /^\*\*/.test(nextBlock) ||
        /^Sources: /.test(nextBlock) ||
        /^[-*] /.test(nextBlock);

      return !(followsHeading && precedesStructuredContent);
    })
    .join("\n\n");
}

/**
 * Ensures inline source annotations are separated from preceding text.
 * @param {string} markdown
 * @returns {string}
 */
function normalizeInlineSourcesSpacing(markdown) {
  return markdown.replace(/(\S)(Sources:\s)/g, "$1 $2");
}

/**
 * Indents sibling list items after a lead-in list item ending with a colon.
 * @param {string} markdown
 * @returns {string}
 */
function indentLeadInListItems(markdown) {
  const lines = markdown.split("\n");

  for (let index = 0; index < lines.length; index++) {
    const leadInMatch = lines[index].match(/^(\s*)([-*]|\d+\.)\s+.+:\s*$/);
    if (!leadInMatch) {
      continue;
    }

    const baseIndent = leadInMatch[1];
    let nestedCount = 0;
    let lineIndex = index + 1;

    while (lineIndex < lines.length) {
      const line = lines[lineIndex];

      if (!line.trim()) {
        break;
      }

      const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+/);
      if (!listMatch || listMatch[1] !== baseIndent) {
        break;
      }

      lines[lineIndex] = `  ${line}`;
      nestedCount++;
      lineIndex++;
    }

    if (nestedCount > 0) {
      index = lineIndex - 1;
    }
  }

  return lines.join("\n");
}

/**
 * Escapes prompt lines before they are wrapped into a blockquote.
 * @param {string} markdown
 * @returns {string}
 */
function normalizePromptMarkdown(markdown) {
  return normalizeMarkdown(markdown)
    .split("\n")
    .map((line) => line.replace(/^(\s*)>\s?/, "$1\\> "))
    .join("\n");
}

/**
 * Applies message-specific Markdown cleanup.
 * @param {"prompt" | "response"} roleType
 * @param {string} markdown
 * @returns {string}
 */
function postProcessMessageMarkdown(roleType, markdown) {
  let processedMarkdown = normalizeMarkdown(markdown);

  if (roleType === "prompt") {
    return normalizePromptMarkdown(processedMarkdown);
  }

  processedMarkdown = compactRemoteResultCards(processedMarkdown);
  processedMarkdown = removeStandaloneRatingBlocks(processedMarkdown);
  processedMarkdown = indentLeadInListItems(processedMarkdown);
  processedMarkdown = normalizeInlineSourcesSpacing(processedMarkdown);

  return normalizeMarkdown(processedMarkdown);
}

/**
 * Returns a cleaned download/source URL.
 * @param {string | null} href
 * @returns {string}
 */
function sanitizeHref(href) {
  if (!href) return "";

  try {
    const url = new URL(href, window.location.href);

    Array.from(url.searchParams.keys()).forEach((key) => {
      if (key.startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    });

    return url.toString();
  } catch {
    return href;
  }
}

/**
 * Returns whether a node should be handled as a block.
 * @param {Node} node
 * @returns {boolean}
 */
function isBlockNode(node) {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    BLOCK_TAG_NAMES.has(node.nodeName.toUpperCase())
  );
}

/**
 * Returns whether an element is a short source/link group.
 * @param {Element} element
 * @returns {boolean}
 */
function isSourceListElement(element) {
  if (!(element instanceof Element)) return false;
  if (["A", "P", "LI", "H1", "H2", "H3", "H4", "H5", "H6"].includes(element.tagName)) {
    return false;
  }

  const links = Array.from(element.querySelectorAll("a[href]"));
  if (links.length === 0) return false;
  if (element.querySelector("pre, code, ul, ol, table, img")) return false;

  const plainText = normalizeText(element.textContent || "").trim();
  if (!plainText || plainText.length > 120) return false;

  const textWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textOutsideLinks = [];

  while (textWalker.nextNode()) {
    const textNode = textWalker.currentNode;
    const parentElement = textNode.parentElement;

    if (parentElement?.closest("a")) {
      continue;
    }

    const value = normalizeText(textNode.textContent || "").trim();
    if (value) {
      textOutsideLinks.push(value);
    }
  }

  return textOutsideLinks.every((value) => /^[,:;+•|/()\-\s]*$/.test(value));
}

/**
 * Removes obvious UI elements from an HTML fragment before conversion.
 * @param {string} html
 * @returns {DocumentFragment}
 */
function sanitizeHtmlFragment(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  template.content.querySelectorAll(UI_ARTIFACT_SELECTORS).forEach((element) => {
    element.remove();
  });

  Array.from(template.content.querySelectorAll("*"))
    .reverse()
    .forEach((element) => {
      const textContent = normalizeText(element.textContent || "").trim();

      if (
        textContent &&
        !element.querySelector("a, code, pre, img") &&
        UI_ARTIFACT_TEXT_PATTERNS.some((pattern) => pattern.test(textContent))
      ) {
        element.remove();
      }
    });

  return template.content;
}

/**
 * Renders inline Markdown from a list of nodes.
 * @param {Node[]} nodes
 * @returns {string}
 */
function renderInlineNodes(nodes) {
  return nodes.map((node) => renderInlineNode(node)).join("");
}

/**
 * Renders block Markdown from a list of nodes.
 * @param {Node[]} nodes
 * @param {{ listDepth: number }} context
 * @returns {string}
 */
function renderBlockNodes(nodes, context) {
  const blocks = [];
  let inlineBuffer = "";

  const flushInlineBuffer = () => {
    const normalizedInline = normalizeMarkdown(normalizeInlineText(inlineBuffer));
    if (normalizedInline) {
      blocks.push(normalizedInline);
    }
    inlineBuffer = "";
  };

  nodes.forEach((node) => {
    if (isBlockNode(node)) {
      flushInlineBuffer();

      const block = renderBlockNode(node, context);
      if (block) {
        blocks.push(block);
      }

      return;
    }

    inlineBuffer += renderInlineNode(node);
  });

  flushInlineBuffer();
  return blocks.join("\n\n");
}

/**
 * Renders a source/link group in place.
 * @param {Element} element
 * @returns {string}
 */
function renderSourceList(element) {
  const seenHrefs = new Set();
  const links = Array.from(element.querySelectorAll("a[href]"))
    .map((link) => {
      const href = sanitizeHref(link.getAttribute("href"));
      const label = normalizeText(link.textContent || "").trim() || href;

      if (!href || seenHrefs.has(href)) {
        return "";
      }

      seenHrefs.add(href);
      return `[${label}](${href})`;
    })
    .filter(Boolean);

  return links.length > 0 ? `Sources: ${links.join(", ")}` : "";
}

/**
 * Returns the code language from a code block if present.
 * @param {Element | null} codeElement
 * @returns {string}
 */
function getCodeLanguage(codeElement) {
  if (!(codeElement instanceof Element)) return "";

  const classNames = (codeElement.getAttribute("class") || "").split(/\s+/);
  const languageClass = classNames.find((className) =>
    /^language-/.test(className)
  );

  return languageClass ? languageClass.replace(/^language-/, "") : "";
}

/**
 * Renders an inline code span.
 * @param {string} text
 * @returns {string}
 */
function renderInlineCode(text) {
  const code = text.replace(/\u00a0/g, " ").trim();
  if (!code) return "";

  const fence = code.includes("`") ? "``" : "`";
  return `${fence}${code}${fence}`;
}

/**
 * Renders an HTML table as Markdown.
 * @param {HTMLTableElement} table
 * @returns {string}
 */
function renderTable(table) {
  const rowElements = Array.from(table.querySelectorAll("tr"));
  if (rowElements.length === 0) return "";

  const rows = rowElements
    .map((row) => {
      const cells = Array.from(row.children)
        .filter((cell) => ["TH", "TD"].includes(cell.tagName))
        .map((cell) =>
          normalizeText(renderInlineNodes(Array.from(cell.childNodes)))
            .trim()
            .replace(/\|/g, "\\|")
        );

      return cells;
    })
    .filter((cells) => cells.length > 0);

  if (rows.length === 0) return "";

  const columnCount = Math.max(...rows.map((cells) => cells.length));
  const normalizedRows = rows.map((cells) => {
    const row = cells.slice();

    while (row.length < columnCount) {
      row.push("");
    }

    return row;
  });

  const header = normalizedRows[0];
  const separator = header.map(() => "---");
  const bodyRows = normalizedRows.slice(1);

  return [
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...bodyRows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

/**
 * Renders a blockquote with proper prefixes.
 * @param {string} markdown
 * @returns {string}
 */
function toBlockquote(markdown) {
  return markdown
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

/**
 * Renders a single inline node.
 * @param {Node} node
 * @returns {string}
 */
function renderInlineNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeInlineText(node.textContent || "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = /** @type {Element} */ (node);
  const tagName = element.tagName.toUpperCase();

  if (isSourceListElement(element)) {
    return renderSourceList(element);
  }

  switch (tagName) {
    case "BR":
      return "\n";
    case "STRONG":
    case "B": {
      const content = renderInlineNodes(Array.from(element.childNodes)).trim();
      return content ? `**${content}**` : "";
    }
    case "EM":
    case "I": {
      const content = renderInlineNodes(Array.from(element.childNodes)).trim();
      return content ? `_${content}_` : "";
    }
    case "CODE":
      return element.parentElement?.tagName.toUpperCase() === "PRE"
        ? ""
        : renderInlineCode(element.textContent || "");
    case "A": {
      const href = sanitizeHref(element.getAttribute("href"));
      const label =
        normalizeText(renderInlineNodes(Array.from(element.childNodes))).trim() ||
        href;

      return href ? `[${label}](${href})` : label;
    }
    case "IMG": {
      const src = sanitizeHref(element.getAttribute("src"));
      const alt = normalizeText(element.getAttribute("alt") || "").trim() || "Image";
      return src ? `![${alt}](${src})` : alt;
    }
    default:
      return isBlockNode(element)
        ? renderBlockNode(element, { listDepth: 0 })
        : renderInlineNodes(Array.from(element.childNodes));
  }
}

/**
 * Renders a single block node.
 * @param {Node} node
 * @param {{ listDepth: number }} context
 * @returns {string}
 */
function renderBlockNode(node, context) {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeText(node.textContent || "").trim();
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = /** @type {Element} */ (node);
  const tagName = element.tagName.toUpperCase();

  if (isSourceListElement(element)) {
    return renderSourceList(element);
  }

  switch (tagName) {
    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6": {
      const level = Number(tagName.slice(1));
      const content = normalizeText(renderInlineNodes(Array.from(element.childNodes))).trim();
      return content ? `${"#".repeat(level)} ${content}` : "";
    }
    case "P":
      return normalizeMarkdown(renderInlineNodes(Array.from(element.childNodes)));
    case "PRE": {
      const codeElement = element.querySelector("code");
      const language = getCodeLanguage(codeElement);
      const codeText = (codeElement?.textContent || element.textContent || "")
        .replace(/\u00a0/g, " ")
        .replace(/\n+$/g, "");

      return codeText ? `\`\`\`${language}\n${codeText}\n\`\`\`` : "";
    }
    case "BLOCKQUOTE": {
      const content = renderBlockNodes(Array.from(element.childNodes), context);
      return content ? toBlockquote(content) : "";
    }
    case "UL":
    case "OL":
      return renderList(element, context);
    case "TABLE":
      return renderTable(/** @type {HTMLTableElement} */ (element));
    case "HR":
      return "---";
    case "DETAILS": {
      const summaryElement = element.querySelector("summary");
      const summaryText = summaryElement
        ? normalizeText(summaryElement.textContent || "").trim()
        : "Details";
      const bodyNodes = Array.from(element.childNodes).filter(
        (child) => child !== summaryElement
      );
      const body = renderBlockNodes(bodyNodes, context);

      if (!body) {
        return "";
      }

      return `<details>\n<summary>${summaryText}</summary>\n\n${body}\n</details>`;
    }
    default:
      return renderBlockNodes(Array.from(element.childNodes), context);
  }
}

/**
 * Renders a Markdown list.
 * @param {Element} listElement
 * @param {{ listDepth: number }} context
 * @returns {string}
 */
function renderList(listElement, context) {
  const isOrdered = listElement.tagName.toUpperCase() === "OL";
  const items = Array.from(listElement.children).filter(
    (child) => child.tagName.toUpperCase() === "LI"
  );

  return items
    .map((item, index) => renderListItem(item, index, isOrdered, context))
    .filter(Boolean)
    .join("\n");
}

/**
 * Renders a Markdown list item.
 * @param {Element} itemElement
 * @param {number} index
 * @param {boolean} isOrdered
 * @param {{ listDepth: number }} context
 * @returns {string}
 */
function renderListItem(itemElement, index, isOrdered, context) {
  const indent = "  ".repeat(context.listDepth);
  const marker = isOrdered ? `${index + 1}. ` : "- ";
  const continuationIndent = indent + " ".repeat(marker.length);
  const contentParts = [];
  const nestedLists = [];

  Array.from(itemElement.childNodes).forEach((childNode) => {
    if (
      childNode.nodeType === Node.ELEMENT_NODE &&
      ["UL", "OL"].includes(childNode.nodeName.toUpperCase())
    ) {
      const nestedList = renderList(/** @type {Element} */ (childNode), {
        listDepth: context.listDepth + 1,
      });

      if (nestedList) {
        nestedLists.push(nestedList);
      }

      return;
    }

    if (isBlockNode(childNode)) {
      const blockContent = renderBlockNode(childNode, context);
      if (blockContent) {
        contentParts.push(blockContent);
      }
      return;
    }

    contentParts.push(renderInlineNode(childNode));
  });

  const content = normalizeMarkdown(contentParts.join("\n")).replace(/\n\n+/g, "\n");
  const contentLines = content ? content.split("\n") : [""];
  let itemMarkdown = `${indent}${marker}${contentLines[0] || ""}`.trimEnd();

  if (contentLines.length > 1) {
    itemMarkdown +=
      "\n" +
      contentLines
        .slice(1)
        .map((line) => `${continuationIndent}${line}`)
        .join("\n");
  }

  if (nestedLists.length > 0) {
    itemMarkdown += `${content ? "\n" : ""}${nestedLists.join("\n")}`;
  }

  return itemMarkdown.trimEnd();
}

/**
 * Converts HTML content to cleaner Markdown.
 * @param {string} html
 * @returns {string}
 */
function htmlToMarkdown(html) {
  if (!html) return "";
  const sanitizedFragment = sanitizeHtmlFragment(html);
  const markdown = renderBlockNodes(Array.from(sanitizedFragment.childNodes), {
    listDepth: 0,
  });

  return normalizeMarkdown(stripUiArtifactLines(markdown));
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
 * Waits for a short period of time.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
 * Formats a local timestamp for the export document body.
 * @param {Date} date
 * @returns {string}
 */
function formatDocumentTimestamp(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
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
 * Returns all ChatGPT conversation turns currently present in the DOM.
 * @returns {Element[]}
 */
function getChatGptConversationTurns() {
  return Array.from(
    document.querySelectorAll('[data-testid^="conversation-turn"]')
  );
}

/**
 * Returns top-level elements for a selector list without nested duplicates.
 * @param {string} selectors
 * @returns {Element[]}
 */
function getTopLevelElements(selectors) {
  return Array.from(document.querySelectorAll(selectors)).filter((element) => {
    const parentMatch = element.parentElement?.closest(selectors);
    return !parentMatch;
  });
}

/**
 * Returns ChatGPT message containers in DOM order.
 * @returns {Element[]}
 */
function getChatGptMessageContainers() {
  const roleSelectors =
    '[data-message-author-role="user"], [data-message-author-role="assistant"]';
  const roleContainers = getTopLevelElements(roleSelectors).filter((element) => {
    const role = element.getAttribute("data-message-author-role");
    return role === "user" || role === "assistant";
  });

  if (roleContainers.length > 0) {
    return roleContainers;
  }

  return getChatGptConversationTurns();
}

/**
 * Returns top-level Gemini conversation entries without nested duplicates.
 * @returns {Element[]}
 */
function getGeminiConversationEntries() {
  const selectors = "user-query, .model-response-text, message-content";
  return getTopLevelElements(selectors);
}

/**
 * Returns the export context for the current platform.
 * @param {"gpt" | "gemini" | null} platform
 * @returns {{ exportMessages: () => { markdown: string, count: number }, getMessageCount: () => number } | null}
 */
function getExportContext(platform) {
  if (platform === "gpt") {
    return {
      exportMessages: exportChatGpt,
      getMessageCount: () => getChatGptMessageContainers().length,
    };
  }

  if (platform === "gemini") {
    return {
      exportMessages: exportGemini,
      getMessageCount: () => getGeminiConversationEntries().length,
    };
  }

  return null;
}

/**
 * Checks whether the element is a useful scroll container.
 * @param {Element} element
 * @returns {boolean}
 */
function isScrollableElement(element) {
  if (!(element instanceof HTMLElement)) return false;

  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const canScroll =
    overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";

  return (
    canScroll &&
    element.clientHeight > 200 &&
    element.scrollHeight > element.clientHeight + 200
  );
}

/**
 * Finds the most likely scroll container for the current conversation.
 * @param {"gpt" | "gemini" | null} platform
 * @returns {HTMLElement}
 */
function findConversationScrollContainer(platform) {
  const exportContext = getExportContext(platform);
  const messageElements = exportContext
    ? platform === "gpt"
      ? getChatGptMessageContainers()
      : getGeminiConversationEntries()
    : [];
  const candidates = new Set();
  const defaultContainer =
    document.scrollingElement instanceof HTMLElement
      ? document.scrollingElement
      : document.documentElement;

  candidates.add(defaultContainer);

  ["main", "section", "article", "div"].forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (isScrollableElement(element)) {
        candidates.add(element);
      }
    });
  });

  let bestContainer = defaultContainer;
  let bestScore = Number.NEGATIVE_INFINITY;

  candidates.forEach((candidate) => {
    let score = candidate.scrollHeight - candidate.clientHeight;

    if (messageElements.length > 0) {
      const containedMessages = messageElements.filter((element) =>
        candidate.contains(element)
      ).length;
      score += containedMessages * 1000;
    }

    if (candidate === defaultContainer) {
      score += 250;
    }

    if (score > bestScore) {
      bestScore = score;
      bestContainer = candidate;
    }
  });

  return bestContainer;
}

/**
 * Reads the current scroll metrics for a container.
 * @param {HTMLElement} container
 * @returns {{ top: number, height: number, viewport: number }}
 */
function readScrollMetrics(container) {
  const scrollingElement = document.scrollingElement;
  const usesWindowScroll =
    container === scrollingElement ||
    container === document.documentElement ||
    container === document.body;

  if (usesWindowScroll) {
    return {
      top: window.scrollY,
      height: scrollingElement ? scrollingElement.scrollHeight : document.body.scrollHeight,
      viewport: window.innerHeight,
    };
  }

  return {
    top: container.scrollTop,
    height: container.scrollHeight,
    viewport: container.clientHeight,
  };
}

/**
 * Scrolls the selected container to a specific position.
 * @param {HTMLElement} container
 * @param {number} top
 */
function setScrollTop(container, top) {
  const targetTop = Math.max(0, top);
  const scrollingElement = document.scrollingElement;
  const usesWindowScroll =
    container === scrollingElement ||
    container === document.documentElement ||
    container === document.body;

  if (usesWindowScroll) {
    window.scrollTo(0, targetTop);
    return;
  }

  container.scrollTop = targetTop;
}

/**
 * Captures the user's relative scroll position so it can be restored later.
 * @param {HTMLElement} container
 * @returns {{ bottomOffset: number }}
 */
function captureScrollState(container) {
  const metrics = readScrollMetrics(container);

  return {
    bottomOffset: Math.max(0, metrics.height - metrics.top - metrics.viewport),
  };
}

/**
 * Restores the previous relative scroll position after lazy-loading messages.
 * @param {HTMLElement} container
 * @param {{ bottomOffset: number }} state
 */
function restoreScrollState(container, state) {
  const metrics = readScrollMetrics(container);
  const targetTop = metrics.height - metrics.viewport - state.bottomOffset;

  setScrollTop(container, targetTop);
}

/**
 * Scrolls upward until the page stops loading additional messages.
 * @param {"gpt" | "gemini" | null} platform
 * @returns {Promise<{ container: HTMLElement, originalScrollState: { bottomOffset: number } } | null>}
 */
async function loadAllMessages(platform) {
  const exportContext = getExportContext(platform);
  if (!exportContext) return null;

  const container = findConversationScrollContainer(platform);
  const originalScrollState = captureScrollState(container);

  let stableRounds = 0;
  let previousSignature = "";

  for (let step = 0; step < LOAD_MAX_STEPS; step++) {
    const metrics = readScrollMetrics(container);
    const messageCount = exportContext.getMessageCount();
    const signature = [
      Math.round(metrics.top),
      metrics.height,
      metrics.viewport,
      messageCount,
    ].join(":");

    if (signature === previousSignature) {
      stableRounds++;
    } else {
      stableRounds = 0;
      previousSignature = signature;
    }

    if (metrics.top <= 0 && stableRounds >= LOAD_STABLE_ROUNDS) {
      break;
    }

    const scrollStep = Math.max(400, Math.floor(metrics.viewport * 0.9));
    setScrollTop(container, metrics.top - scrollStep);
    await sleep(LOAD_WAIT_MS);
  }

  return { container, originalScrollState };
}

/**
 * Waits briefly at the top of the conversation so the oldest messages can load.
 * @param {HTMLElement} container
 * @param {{ getMessageCount: () => number }} exportContext
 * @returns {Promise<void>}
 */
async function settleConversationAtTop(container, exportContext) {
  let stableRounds = 0;
  let previousCount = exportContext.getMessageCount();
  let attempts = 0;

  while (
    stableRounds < LOAD_STABLE_ROUNDS &&
    attempts < LOAD_TOP_SETTLE_MAX_ATTEMPTS
  ) {
    attempts++;
    setScrollTop(container, 0);
    await sleep(LOAD_WAIT_MS);

    const messageCount = exportContext.getMessageCount();
    if (messageCount === previousCount) {
      stableRounds++;
      continue;
    }

    previousCount = messageCount;
    stableRounds = 0;
  }
}

/**
 * Updates the floating export button state.
 * @param {string} label
 * @param {boolean} disabled
 */
function setExportButtonState(label, disabled) {
  const button = document.getElementById(EXPORT_BUTTON_ID);
  if (!(button instanceof HTMLButtonElement)) return;

  button.textContent = label;
  button.disabled = disabled;
  button.style.opacity = disabled ? "0.75" : "1";
}

/**
 * Finds the first matching element in or below a root element.
 * @param {Element} root
 * @param {string[]} selectors
 * @returns {Element | null}
 */
function findFirstMatchingElement(root, selectors) {
  for (const selector of selectors) {
    if (root.matches(selector)) {
      return root;
    }

    const match = root.querySelector(selector);
    if (match) {
      return match;
    }
  }

  return null;
}

/**
 * Converts an HTML fragment into a normalized export message.
 * @param {string} roleLabel
 * @param {"prompt" | "response"} roleType
 * @param {string} html
 * @returns {{ roleLabel: string, roleType: "prompt" | "response", markdown: string } | null}
 */
function createExportMessage(roleLabel, roleType, html) {
  const markdown = postProcessMessageMarkdown(
    roleType,
    htmlToMarkdown(html).trim()
  );
  if (!markdown) return null;

  return { roleLabel, roleType, markdown };
}

/**
 * Formats one export section.
 * @param {{ roleLabel: string, roleType: "prompt" | "response", markdown: string }} message
 * @param {number} roleIndex
 * @returns {string}
 */
function formatExportSection(message, roleIndex) {
  const labelLine = `**${message.roleLabel} ${roleIndex}**`;
  const body =
    message.roleType === "prompt"
      ? toBlockquote(message.markdown)
      : message.markdown;

  return `${labelLine}\n\n${body}`;
}

/**
 * Builds the final Markdown document for an export.
 * @param {string} platformLabel
 * @param {{ roleLabel: string, roleType: "prompt" | "response", markdown: string }[]} messages
 * @returns {{ markdown: string, count: number }}
 */
function buildExportMarkdown(platformLabel, messages) {
  const promptCount = messages.filter(
    (message) => message.roleType === "prompt"
  ).length;
  const responseCount = messages.length - promptCount;
  const headerLines = [
    `# ${platformLabel} Conversation Export`,
    "",
    `- Platform: ${platformLabel}`,
    `- Exported: ${formatDocumentTimestamp(new Date())}`,
    `- Messages: ${messages.length}`,
    `- User prompts: ${promptCount}`,
    `- ${platformLabel} responses: ${responseCount}`,
  ];

  if (messages.length === 0) {
    return {
      markdown:
        headerLines.join("\n") +
        MESSAGE_CONTENT_SEPARATOR +
        "_No messages found. Please make sure the chat is fully loaded._",
      count: 0,
    };
  }

  const roleCounters = {
    prompt: 0,
    response: 0,
  };
  const sections = messages.map((message) => {
    roleCounters[message.roleType] += 1;
    return formatExportSection(message, roleCounters[message.roleType]);
  });

  return {
    markdown: headerLines.join("\n") + EXPORT_SEPARATOR + sections.join(EXPORT_SEPARATOR),
    count: messages.length,
  };
}

/**
 * Collects messages from ChatGPT.
 * @returns {{ markdown: string, count: number }}
 */
function exportChatGpt() {
  const userSelectors = [
    '[data-testid^="user-message"]',
    ".whitespace-pre-wrap",
    '[class*="whitespace-pre-wrap"]',
  ];
  const assistantSelectors = [
    ".markdown",
    '[class*="markdown"]',
    ".prose",
    '[class*="prose"]',
  ];
  const roleContainers = getChatGptMessageContainers().filter((element) =>
    element.hasAttribute("data-message-author-role")
  );

  if (roleContainers.length > 0) {
    const messages = roleContainers
      .map((container) => {
        const role = container.getAttribute("data-message-author-role");

        if (role === "user") {
          const contentElement = findFirstMatchingElement(container, userSelectors);
          const contentHtml = contentElement ? contentElement.innerHTML : container.innerHTML;
          return createExportMessage("User Prompt", "prompt", contentHtml);
        }

        if (role === "assistant") {
          const contentElement = findFirstMatchingElement(
            container,
            assistantSelectors
          );
          const contentHtml = contentElement ? contentElement.innerHTML : container.innerHTML;
          return createExportMessage("ChatGPT Response", "response", contentHtml);
        }

        return null;
      })
      .filter(Boolean);

    return buildExportMarkdown("ChatGPT", messages);
  }

  const messages = [];

  getChatGptConversationTurns().forEach((turn) => {
    const userMessage = findFirstMatchingElement(turn, userSelectors);
    const aiMessage = findFirstMatchingElement(turn, assistantSelectors);

    if (userMessage) {
      const exportMessage = createExportMessage(
        "User Prompt",
        "prompt",
        userMessage.innerHTML
      );
      if (exportMessage) {
        messages.push(exportMessage);
      }
    }

    if (aiMessage) {
      const exportMessage = createExportMessage(
        "ChatGPT Response",
        "response",
        aiMessage.innerHTML
      );
      if (exportMessage) {
        messages.push(exportMessage);
      }
    }
  });

  return buildExportMarkdown("ChatGPT", messages);
}

/**
 * Collects messages from Gemini.
 * @returns {{ markdown: string, count: number }}
 */
function exportGemini() {
  const messages = getGeminiConversationEntries()
    .map((entry) => {
      const content = entry.innerHTML.trim();
      if (!content) return null;

      const isUser =
        entry.matches("user-query") || Boolean(entry.closest("user-query"));

      return createExportMessage(
        isUser ? "User Prompt" : "Gemini Response",
        isUser ? "prompt" : "response",
        content
      );
    })
    .filter(Boolean);

  return buildExportMarkdown("Gemini", messages);
}

/**
 * Runs the export for the current platform.
 */
async function startExport() {
  if (exportInProgress) return;

  const host = window.location.hostname;
  const platform = detectPlatform(host);
  const exportContext = getExportContext(platform);
  let loadedConversation = null;
  let result = { markdown: "", count: 0 };

  exportInProgress = true;
  setExportButtonState(BUTTON_LOADING_LABEL, true);

  try {
    loadedConversation = await loadAllMessages(platform);
    if (loadedConversation && exportContext) {
      await settleConversationAtTop(loadedConversation.container, exportContext);
    }

    setExportButtonState(BUTTON_EXPORTING_LABEL, true);

    if (exportContext) {
      result = exportContext.exportMessages();
    }

    const timestamp = formatFilenameTimestamp(new Date());
    const platformName = platform || "chat";
    triggerDownload(
      result.markdown,
      `chat-export-${platformName}-${timestamp}.md`
    );
  } finally {
    if (loadedConversation) {
      restoreScrollState(
        loadedConversation.container,
        loadedConversation.originalScrollState
      );
    }

    exportInProgress = false;
    setExportButtonState(BUTTON_IDLE_LABEL, false);
  }
}

/**
 * Inserts the export button into the page.
 */
function injectExportButton() {
  if (document.getElementById(EXPORT_BUTTON_ID) || !document.body) return;

  const button = document.createElement("button");
  button.id = EXPORT_BUTTON_ID;
  button.type = "button";
  button.textContent = BUTTON_IDLE_LABEL;
  button.addEventListener("click", startExport);

  document.body.appendChild(button);
}

setInterval(injectExportButton, 2000);
injectExportButton();
