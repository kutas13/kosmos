/**
 * Background service worker.
 * - Ilk kurulum / guncelleme: API adresini foxvize.info yapar (lokal / bos ise).
 * - CAPTCHA OCR istekleri icin offscreen document olusturur ve mesaj relay'i yapar.
 */
const FOXVIZE_API_BASE = "https://foxvize.info";
const OFFSCREEN_URL = "offscreen.html";

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
    } else if (details.reason === "update" && isLocalOrEmpty) {
      chrome.storage.local.set({ apiBaseUrl: FOXVIZE_API_BASE });
    }
  });

  // Guncelleme / kurulum anlaminda offscreen'i onceden isit
  ensureOffscreen()
    .then(() =>
      chrome.runtime.sendMessage({ target: "offscreen", type: "OCR_WARMUP" })
    )
    .catch(() => {});
});

/** Offscreen document'in var oldugundan emin ol. */
let creatingOffscreen = null;
async function ensureOffscreen() {
  // MV3: chrome.offscreen.hasDocument() Chrome 116+
  const has =
    (chrome.offscreen && typeof chrome.offscreen.hasDocument === "function"
      ? await chrome.offscreen.hasDocument()
      : false) ||
    (chrome.runtime.getContexts
      ? (
          await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] })
        ).length > 0
      : false);
  if (has) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }
  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["WORKERS"],
    justification: "Tesseract.js ile CAPTCHA OCR icin DOM/worker calistirilir.",
  });
  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

/** Content script / popup tarafindan gelen OCR isteklerini offscreen'e ilet. */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return false;

  if (msg.type === "OCR_CAPTCHA" && msg.target !== "offscreen") {
    (async () => {
      try {
        await ensureOffscreen();
        const r = await chrome.runtime.sendMessage({
          target: "offscreen",
          type: "OCR_CAPTCHA",
          image: msg.image,
        });
        sendResponse(r || { ok: false, error: "Offscreen yanit vermedi" });
      } catch (e) {
        sendResponse({ ok: false, error: "BG relay hatasi: " + String(e && e.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === "OCR_WARMUP" && msg.target !== "offscreen") {
    (async () => {
      try {
        await ensureOffscreen();
        const r = await chrome.runtime.sendMessage({
          target: "offscreen",
          type: "OCR_WARMUP",
        });
        sendResponse(r || { ok: false, error: "Offscreen yanit vermedi" });
      } catch (e) {
        sendResponse({ ok: false, error: "BG warmup hatasi: " + String(e && e.message || e) });
      }
    })();
    return true;
  }

  return false;
});
