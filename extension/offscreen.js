/**
 * Offscreen document: tesseract.js ile CAPTCHA OCR yapar.
 * Background service worker tarafindan DOM sahibi olabilsin diye olusturulur.
 *
 * Mesajlar:
 *   { target:"offscreen", type:"OCR_WARMUP" }
 *   { target:"offscreen", type:"OCR_CAPTCHA", image:<dataUrl> }       // tek resim, eski API
 *   { target:"offscreen", type:"OCR_CAPTCHA_MULTI", images:[...], expectLen:4 }
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
      // Blob URL kullanilirsa worker origin "null" olur ve chrome-extension://
      // kaynaklarini importScripts edemez. Direkt URL ile olustur.
      workerBlobURL: false,
    };
    const w = await Tesseract.createWorker("eng", 1, opts);
    // Default: PSM 7 + sadece rakam + numeric mode
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

/**
 * Bir image icin birden fazla PSM modu dener, en iyi sonucu dondurur.
 * PSM 7 = tek metin satiri, 8 = tek kelime, 13 = raw line (layout yok).
 */
async function recognizeWithPsms(worker, image, expectLen) {
  const psms = ["7", "8", "13"];
  const attempts = [];
  for (const psm of psms) {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: psm,
        tessedit_char_whitelist: "0123456789",
      });
      const { data } = await worker.recognize(image);
      const raw = String(data?.text || "").trim();
      const digits = raw.replace(/\D/g, "");
      attempts.push({
        psm,
        raw,
        digits,
        confidence: Number(data?.confidence || 0),
      });
    } catch (e) {
      attempts.push({ psm, raw: "", digits: "", confidence: 0, error: String(e) });
    }
  }

  // Skoru: hedef uzunlukta olanlar > uzun olanlar, sonra guven
  attempts.sort((a, b) => {
    const aExact = a.digits.length === expectLen ? 1 : 0;
    const bExact = b.digits.length === expectLen ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    const aLenScore = Math.abs(a.digits.length - expectLen);
    const bLenScore = Math.abs(b.digits.length - expectLen);
    if (aLenScore !== bLenScore) return aLenScore - bLenScore;
    return b.confidence - a.confidence;
  });
  return attempts[0] || { digits: "", confidence: 0, raw: "", psm: "-" };
}

/** Coklu goruntu + coklu PSM ile en iyi sonucu bul. */
async function recognizeMulti(images, expectLen) {
  const worker = await getWorker();
  const all = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      const best = await recognizeWithPsms(worker, img, expectLen);
      all.push({ ...best, variantIndex: i });
    } catch (e) {
      all.push({ digits: "", confidence: 0, raw: "", psm: "-", variantIndex: i, error: String(e) });
    }
  }
  // En iyi: hedef uzunlukta + en yuksek guven
  all.sort((a, b) => {
    const aExact = a.digits.length === expectLen ? 1 : 0;
    const bExact = b.digits.length === expectLen ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    const aLenScore = Math.abs(a.digits.length - expectLen);
    const bLenScore = Math.abs(b.digits.length - expectLen);
    if (aLenScore !== bLenScore) return aLenScore - bLenScore;
    return b.confidence - a.confidence;
  });
  return all;
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
        const worker = await getWorker();
        const best = await recognizeWithPsms(worker, msg.image, 4);
        const ms = Math.round(performance.now() - t0);
        const code = best.digits.slice(0, 4);
        sendResponse({
          ok: code.length >= 3,
          code,
          raw: best.raw,
          psm: best.psm,
          confidence: Math.round(best.confidence),
          ms,
          error: code.length >= 3 ? undefined : ("OCR dusuk guven — okunan: '" + (best.raw.slice(0, 20) || "(bos)") + "'"),
        });
      } catch (e) {
        sendResponse({ ok: false, error: "OCR hatasi: " + (e && e.message ? e.message : String(e)) });
      }
    })();
    return true;
  }

  if (msg.type === "OCR_CAPTCHA_MULTI") {
    (async () => {
      try {
        const imgs = Array.isArray(msg.images) ? msg.images.filter((s) => typeof s === "string" && s) : [];
        if (!imgs.length) {
          sendResponse({ ok: false, error: "images[] gerekli" });
          return;
        }
        const expectLen = Number(msg.expectLen) > 0 ? Number(msg.expectLen) : 4;
        const t0 = performance.now();
        const ranked = await recognizeMulti(imgs, expectLen);
        const ms = Math.round(performance.now() - t0);
        const best = ranked[0];
        const code = (best?.digits || "").slice(0, expectLen);
        sendResponse({
          ok: code.length === expectLen,
          code,
          raw: best?.raw || "",
          psm: best?.psm || "-",
          variantIndex: best?.variantIndex ?? -1,
          confidence: Math.round(best?.confidence || 0),
          ms,
          tried: ranked.length,
          error:
            code.length === expectLen
              ? undefined
              : ("OCR " + expectLen + " haneli kod bulamadi (en iyi: '" + (best?.raw || "(bos)").slice(0, 20) + "' / " + Math.round(best?.confidence || 0) + "%)"),
        });
      } catch (e) {
        sendResponse({ ok: false, error: "OCR hatasi: " + (e && e.message ? e.message : String(e)) });
      }
    })();
    return true;
  }

  return false;
});

// Ilk acilista warmup baslat
getWorker().catch(() => {});
