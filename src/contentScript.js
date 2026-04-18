(() => {
  if (window.__confluenceMarkdownExporterInjected) {
    return;
  }

  window.__confluenceMarkdownExporterInjected = true;

  function getSelectedFragment() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      return null;
    }

    return range.cloneContents();
  }

  async function writeToClipboard(text) {
    if (!text) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    }
  }

  function showToast(message, variant) {
    const existing = document.getElementById("confluence-md-exporter-toast");
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement("div");
    toast.id = "confluence-md-exporter-toast";
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "2147483647";
    toast.style.maxWidth = "420px";
    toast.style.padding = "10px 12px";
    toast.style.borderRadius = "8px";
    toast.style.background = variant === "error" ? "#B71C1C" : "#1B5E20";
    toast.style.color = "white";
    toast.style.fontSize = "13px";
    toast.style.fontFamily = "system-ui, -apple-system, Segoe UI, sans-serif";
    toast.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.35)";

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.action !== "COPY_SELECTION_AS_MARKDOWN") {
      return false;
    }

    (async () => {
      const fragment = getSelectedFragment();
      if (!fragment) {
        showToast("Select content first, then use Copy to Markdown.", "error");
        sendResponse({ ok: false, error: "No selected content." });
        return;
      }

      const converter = window.ConfluenceMarkdownConverter;
      if (!converter || typeof converter.convertFragmentToMarkdown !== "function") {
        sendResponse({ ok: false, error: "Converter unavailable." });
        return;
      }

      const result = converter.convertFragmentToMarkdown(fragment);
      if (!result.markdown) {
        showToast("Selection could not be converted.", "error");
        sendResponse({ ok: false, error: "Empty markdown output." });
        return;
      }

      const copied = await writeToClipboard(result.markdown);
      if (!copied) {
        showToast("Failed to copy markdown to clipboard.", "error");
        sendResponse({ ok: false, error: "Clipboard write failed." });
        return;
      }

      if (result.unsupported.length > 0) {
        showToast(`Copied with ${result.unsupported.length} unsupported block type(s).`, "success");
      } else {
        showToast("Markdown copied to clipboard.", "success");
      }

      sendResponse({
        ok: true,
        markdown: result.markdown,
        characters: result.markdown.length,
        unsupportedCount: result.unsupported.length,
        unsupported: result.unsupported
      });
    })().catch((error) => {
      showToast("Unexpected conversion error.", "error");
      sendResponse({ ok: false, error: String(error) });
    });

    return true;
  });
})();
