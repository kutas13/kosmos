/**
 * Offscreen document: tesseract.js ile CAPTCHA OCR yapar.
 * Background service worker tarafindan DOM sahibi olabilsin diye olusturulur.
 *
 * Mesajlar:
 *   { target: "offscreen", type: "OCR_WARMUP" }
 *   { target: "offscreen", type: "OCR_CAPTCHA", image: <dataUrl> }
 */

let workerPromise = null;
let warmedUp = false;

function extUrl(p) {
  return chrome.runtime.getURL(p);
}

async function getWorker() {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    if (typeof Tesseract === "undefined") {
      throw new Error("Tesseract global yok (tesseract.min.js yuklenmedi)");
    }
    const opts = {
      workerPath: extUrl("lib/tesseract/worker.min.js"),
      corePath: extUrl("lib/tesseract/tesseract-core-simd-lstm.wasm.js"),
      langPath: extUrl("lib/tessdata"),
      logger: () => {},
      cacheMethod: "none",
      gzip: true,
    };
    const w = await Tesseract.createWorker("eng", 1, opts);
    await w.setParameters({
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: "7",
      classify_bln_numeric_mode: "1",
    });
    warmedUp = true;
    return w;
  })().catch((e) => {
    workerPromise = null;
    throw e;
  });
  return workerPromise;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== "offscreen") return false;

  if (msg.type === "OCR_WARMUP") {
    getWorker()
      .then(() => sendResponse({ ok: true, warmedUp }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true;
  }

  if (msg.type === "OCR_CAPTCHA") {
    (async () => {
      try {
        if (!msg.image || typeof msg.image !== "string") {
          sendResponse({ ok: false, error: "image gerekli" });
          return;
        }
        const t0 = performance.now();
        const w = await getWorker();
        const { data } = await w.recognize(msg.image);
        const ms = Math.round(performance.now() - t0);
        const raw = String(data?.text || "").trim();
        const digits = raw.replace(/\D/g, "").slice(0, 4);
        sendResponse({
          ok: digits.length >= 3,
          code: digits,
          raw,
          confidence: Math.round(Number(data?.confidence || 0)),
          ms,
          error: digits.length >= 3 ? undefined : "OCR dusuk guven — okunan: '" + (raw.slice(0, 20) || "(bos)") + "'",
        });
      } catch (e) {
        sendResponse({ ok: false, error: "OCR hatasi: " + (e && e.message ? e.message : String(e)) });
      }
    })();
    return true;
  }

  return false;
});

// Olusur olusmaz warmup baslat (ilk CAPTCHA cagrisi daha hizli olsun)
getWorker().catch(() => {});
