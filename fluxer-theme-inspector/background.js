/* Fluxer Theme Inspector — Background Service Worker */
"use strict";

const STORAGE_URLS_KEY = "ti_custom_urls";
const DYNAMIC_SCRIPT_ID = "ti-dynamic-content";

// ── Register dynamic content scripts for custom URL patterns ─────────────

async function registerDynamicScripts() {
  // First, unregister any existing dynamic scripts
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [DYNAMIC_SCRIPT_ID] });
  } catch (_) {
    // Ignore if not registered
  }

  // Load custom URLs from storage
  const result = await chrome.storage.sync.get([STORAGE_URLS_KEY]);
  const customUrls = result[STORAGE_URLS_KEY] || [];

  if (customUrls.length === 0) return;

  // Register a single dynamic content script with all custom patterns
  try {
    await chrome.scripting.registerContentScripts([
      {
        id: DYNAMIC_SCRIPT_ID,
        matches: customUrls,
        js: ["content.js"],
        css: ["content.css"],
        runAt: "document_idle",
      },
    ]);
    console.log("[Theme Inspector] Registered dynamic scripts for:", customUrls);
  } catch (e) {
    console.error("[Theme Inspector] Failed to register dynamic scripts:", e);
  }
}

// ── Event Listeners ──────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Theme Inspector] Extension installed/updated");
  registerDynamicScripts();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[Theme Inspector] Browser startup — re-registering scripts");
  registerDynamicScripts();
});

// ── Message Handler (from popup) ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "addUrl" || msg.action === "removeUrl") {
    // Re-register all dynamic scripts after URL changes
    registerDynamicScripts().then(() => {
      sendResponse({ success: true });
    });
    return true; // async response
  }
});
