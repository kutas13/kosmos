/**
 * İlk kurulum / güncellemede API adresini foxvize.info yapar (localhost boş veya eski port ise).
 */
const FOXVIZE_API_BASE = "https://foxvize.info";

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get(["apiBaseUrl"], (r) => {
    const v = String(r.apiBaseUrl || "").trim();
    const isLocalOrEmpty =
      !v ||
      v.includes("127.0.0.1") ||
      v.includes("localhost") ||
      /:(3000|8765)\b/.test(v);
    if (details.reason === "install") {
      if (!v || isLocalOrEmpty) {
        chrome.storage.local.set({ apiBaseUrl: FOXVIZE_API_BASE });
      }
      return;
    }
    if (details.reason === "update" && isLocalOrEmpty) {
      chrome.storage.local.set({ apiBaseUrl: FOXVIZE_API_BASE });
    }
  });
});
