const MENU_ID = "copy-selection-to-markdown";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Copy to Markdown",
    contexts: ["selection"]
  });
});

function isConfluenceUrl(url) {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const hostLooksConfluence = parsed.hostname.endsWith("atlassian.net");
    const pathLooksConfluence = parsed.pathname.startsWith("/wiki") || parsed.pathname.startsWith("/display/");
    return hostLooksConfluence && pathLooksConfluence;
  } catch {
    return false;
  }
}

function setBadgeState(tabId, text, color) {
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color });
}

async function ensureContentScript(tabId, frameId) {
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    files: ["src/markdownConverter.js", "src/contentScript.js"]
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab || typeof tab.id !== "number") {
    return;
  }

  const tabId = tab.id;
  const frameId = info.frameId ?? 0;

  if (!isConfluenceUrl(info.pageUrl || tab.url || "")) {
    setBadgeState(tabId, "NO", "#8B0000");
    console.warn("Confluence Markdown Exporter: current page is not a supported Confluence URL.");
    return;
  }

  try {
    await ensureContentScript(tabId, frameId);

    const response = await chrome.tabs.sendMessage(tabId, { action: "COPY_SELECTION_AS_MARKDOWN" }, { frameId });

    if (!response || !response.ok) {
      setBadgeState(tabId, "ERR", "#8B0000");
      console.error("Confluence Markdown Exporter:", response?.error || "Unknown conversion error");
      return;
    }

    setBadgeState(tabId, "OK", "#1B5E20");
    console.info(
      "Confluence Markdown Exporter: copied",
      response.characters,
      "characters with",
      response.unsupportedCount,
      "unsupported element(s)."
    );
  } catch (error) {
    setBadgeState(tabId, "ERR", "#8B0000");
    console.error("Confluence Markdown Exporter failed:", error);
  }
});
