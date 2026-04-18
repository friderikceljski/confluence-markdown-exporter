(() => {
  function escapeInline(text) {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/([*_`~])/g, "\\$1")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]");
  }

  function normalizeWhitespace(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  function isBlockElement(tagName) {
    return [
      "P",
      "DIV",
      "SECTION",
      "ARTICLE",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "UL",
      "OL",
      "LI",
      "PRE",
      "BLOCKQUOTE",
      "TABLE",
      "THEAD",
      "TBODY",
      "TR"
    ].includes(tagName);
  }

  function joinBlocks(parts) {
    return parts.filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function textFromNode(node) {
    return normalizeWhitespace(node.textContent || "");
  }

  function convertInline(node, ctx) {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeInline(node.nodeValue || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node;
    const tag = element.tagName;

    if (tag === "BR") {
      return "  \n";
    }

    if (tag === "A") {
      const label = normalizeWhitespace(convertInlineChildren(element, ctx));
      const href = element.getAttribute("href") || "";
      if (!href) {
        return label;
      }
      return `[${label || href}](${href})`;
    }

    if (tag === "STRONG" || tag === "B") {
      const content = convertInlineChildren(element, ctx);
      return content ? `**${content}**` : "";
    }

    if (tag === "EM" || tag === "I") {
      const content = convertInlineChildren(element, ctx);
      return content ? `*${content}*` : "";
    }

    if (tag === "CODE") {
      const content = textFromNode(element);
      return content ? `\`${content.replace(/`/g, "\\`")}\`` : "";
    }

    if (tag === "S" || tag === "STRIKE" || tag === "DEL") {
      const content = convertInlineChildren(element, ctx);
      return content ? `~~${content}~~` : "";
    }

    if (tag === "IMG") {
      const alt = element.getAttribute("alt") || "image";
      const src = element.getAttribute("src") || "";
      return src ? `![${escapeInline(alt)}](${src})` : "";
    }

    if (isBlockElement(tag)) {
      return convertNode(element, ctx, 0);
    }

    return convertInlineChildren(element, ctx);
  }

  function convertInlineChildren(element, ctx) {
    let output = "";
    for (const child of element.childNodes) {
      output += convertInline(child, ctx);
    }
    return output;
  }

  function convertList(element, ctx, depth) {
    const ordered = element.tagName === "OL";
    const items = [];

    let index = 1;
    for (const child of element.children) {
      if (child.tagName !== "LI") {
        continue;
      }

      const marker = ordered ? `${index}. ` : "- ";
      index += 1;
      const content = convertListItem(child, ctx, depth + 1);
      const indent = "  ".repeat(depth);
      const normalized = content.replace(/\n/g, `\n${indent}  `).trim();
      items.push(`${indent}${marker}${normalized}`);
    }

    return items.join("\n");
  }

  function convertListItem(element, ctx, depth) {
    const checkbox = element.querySelector('input[type="checkbox"]');
    const checkboxMarker = checkbox ? (checkbox.checked ? "[x] " : "[ ] ") : "";

    const contentParts = [];
    for (const child of element.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "UL") {
        contentParts.push(`\n${convertList(child, ctx, depth)}`);
        continue;
      }

      if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "OL") {
        contentParts.push(`\n${convertList(child, ctx, depth)}`);
        continue;
      }

      if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "INPUT") {
        continue;
      }

      contentParts.push(convertInline(child, ctx));
    }

    return checkboxMarker + normalizeWhitespace(contentParts.join(""));
  }

  function convertTable(element) {
    const rows = Array.from(element.querySelectorAll("tr"));
    if (!rows.length) {
      return "";
    }

    const parsed = rows.map((row) =>
      Array.from(row.children)
        .filter((cell) => cell.tagName === "TH" || cell.tagName === "TD")
        .map((cell) => normalizeWhitespace(cell.textContent || "").replace(/\|/g, "\\|"))
    );

    const firstRow = parsed[0] || [];
    if (!firstRow.length) {
      return "";
    }

    const header = firstRow.map((cell) => cell || " ");
    const divider = header.map(() => "---");
    const bodyRows = parsed.slice(1);

    const lines = [];
    lines.push(`| ${header.join(" | ")} |`);
    lines.push(`| ${divider.join(" | ")} |`);

    for (const row of bodyRows) {
      const padded = [...row];
      while (padded.length < header.length) {
        padded.push(" ");
      }
      lines.push(`| ${padded.join(" | ")} |`);
    }

    return lines.join("\n");
  }

  function convertChildrenToBlocks(element, ctx, depth) {
    const blocks = [];
    let inlineBuffer = "";

    function flushInline() {
      const normalized = normalizeWhitespace(inlineBuffer);
      if (normalized) {
        blocks.push(normalized);
      }
      inlineBuffer = "";
    }

    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        inlineBuffer += child.nodeValue || "";
        continue;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      if (isBlockElement(child.tagName)) {
        flushInline();
        blocks.push(convertNode(child, ctx, depth));
        continue;
      }

      inlineBuffer += convertInline(child, ctx);
    }

    flushInline();
    return joinBlocks(blocks);
  }

  function noteUnsupported(element, ctx) {
    const id = element.getAttribute("data-node-type") || element.tagName;
    if (!ctx.unsupported.includes(id)) {
      ctx.unsupported.push(id);
    }
  }

  function convertNode(node, ctx, depth) {
    if (node.nodeType === Node.TEXT_NODE) {
      return normalizeWhitespace(node.nodeValue || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node;
    const tag = element.tagName;

    if (tag === "P") {
      return normalizeWhitespace(convertInlineChildren(element, ctx));
    }

    if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4" || tag === "H5" || tag === "H6") {
      const level = Number(tag.slice(1));
      const text = normalizeWhitespace(convertInlineChildren(element, ctx));
      return `${"#".repeat(level)} ${text}`;
    }

    if (tag === "UL" || tag === "OL") {
      return convertList(element, ctx, depth);
    }

    if (tag === "PRE") {
      const code = element.textContent || "";
      return `\`\`\`\n${code.trimEnd()}\n\`\`\``;
    }

    if (tag === "BLOCKQUOTE") {
      const inner = convertChildrenToBlocks(element, ctx, depth);
      return inner
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }

    if (tag === "TABLE") {
      return convertTable(element);
    }

    if (tag === "DIV" || tag === "SECTION" || tag === "ARTICLE") {
      const nodeType = element.getAttribute("data-node-type");
      if (nodeType && ["panel", "expand", "inlineCard", "blockCard", "embedCard"].includes(nodeType)) {
        noteUnsupported(element, ctx);
        const title = normalizeWhitespace(element.textContent || "") || nodeType;
        return `> [Unsupported ${nodeType}] ${title}`;
      }
      return convertChildrenToBlocks(element, ctx, depth);
    }

    if (tag === "LI") {
      return convertListItem(element, ctx, depth);
    }

    noteUnsupported(element, ctx);
    const fallback = normalizeWhitespace(element.textContent || "");
    return fallback;
  }

  function normalizeFragment(root) {
    // Convert Confluence mention chips and emoji wrappers to readable text before markdown conversion.
    const mentionNodes = root.querySelectorAll('[data-mention-id], [data-type="mention"]');
    for (const node of mentionNodes) {
      const mentionText = normalizeWhitespace(node.textContent || "") || "@mention";
      node.replaceWith(document.createTextNode(mentionText));
    }

    const emojiNodes = root.querySelectorAll('[data-emoji-shortname]');
    for (const node of emojiNodes) {
      const emojiText = node.getAttribute("data-emoji-shortname") || node.textContent || ":emoji:";
      node.replaceWith(document.createTextNode(emojiText));
    }

    const smartLinkNodes = root.querySelectorAll('[data-node-type="inlineCard"], [data-node-type="blockCard"], [data-node-type="embedCard"]');
    for (const node of smartLinkNodes) {
      const anchor = node.querySelector("a[href]");
      const href = anchor?.getAttribute("href") || "";
      const text = normalizeWhitespace(node.textContent || "") || href || "card";
      const replacement = href ? `[${text}](${href})` : text;
      node.replaceWith(document.createTextNode(replacement));
    }
  }

  function convertFragmentToMarkdown(fragment) {
    const container = document.createElement("div");
    container.appendChild(fragment.cloneNode(true));
    normalizeFragment(container);

    const ctx = { unsupported: [] };
    const markdown = convertChildrenToBlocks(container, ctx, 0).trim();
    return {
      markdown,
      unsupported: ctx.unsupported
    };
  }

  window.ConfluenceMarkdownConverter = {
    convertFragmentToMarkdown
  };
})();
