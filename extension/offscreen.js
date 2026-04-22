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
 * PSM 7 = tek metin satiri, 8 = tek kelime, 10 = tek karakter,
 * 13 = raw line (layout yok).
 */
async function recognizeWithPsms(worker, image, expectLen, psms) {
  const modes = Array.isArray(psms) && psms.length ? psms : ["7", "8", "13"];
  const attempts = [];
  for (const psm of modes) {
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
  const target = expectLen || 0;
  attempts.sort((a, b) => {
    const aExact = target && a.digits.length === target ? 1 : 0;
    const bExact = target && b.digits.length === target ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    const aLenScore = target ? Math.abs(a.digits.length - target) : -a.digits.length;
    const bLenScore = target ? Math.abs(b.digits.length - target) : -b.digits.length;
    if (aLenScore !== bLenScore) return aLenScore - bLenScore;
    return b.confidence - a.confidence;
  });
  return attempts[0] || { digits: "", confidence: 0, raw: "", psm: "-" };
}

/** Tek rakam gorseli icin en iyi karakteri dondurur. */
async function recognizeSingleDigit(worker, image) {
  // Tek karakter icin PSM 10 ideal; ama bazen 8 / 7 daha iyi okuyabilir.
  const candidates = await recognizeWithPsms(worker, image, 1, ["10", "8", "7"]);
  // En iyi dondu; digits uzunlugu >=1 olabilir.
  const ch = (candidates.digits || "").charAt(0) || "";
  return {
    ch,
    confidence: candidates.confidence || 0,
    raw: candidates.raw || "",
    psm: candidates.psm || "-",
  };
}

/** 4 segment -> 4 karakter, her birinin guveni ile birlikte dondurulur. */
async function recognizeSegments(worker, segments) {
  const out = [];
  for (let i = 0; i < segments.length; i++) {
    const r = await recognizeSingleDigit(worker, segments[i]);
    out.push(r);
  }
  const digits = out.map((r) => r.ch).join("");
  const confSum = out.reduce((s, r) => s + (r.confidence || 0), 0);
  const confidence = out.length ? confSum / out.length : 0;
  return { digits, confidence, perDigit: out };
}

/** Coklu goruntu + coklu PSM + (varsa) segment-group ile en iyi sonucu bul. */
async function recognizeMulti(images, segmentGroups, expectLen) {
  const worker = await getWorker();
  const all = [];

  // 1) Whole-image OCR (multi-PSM)
  for (let i = 0; i < images.length; i++) {
    try {
      const best = await recognizeWithPsms(worker, images[i], expectLen);
      all.push({
        source: "whole",
        variantIndex: i,
        psm: best.psm,
        raw: best.raw,
        digits: best.digits,
        confidence: best.confidence,
      });
    } catch (e) {
      all.push({
        source: "whole",
        variantIndex: i,
        digits: "",
        confidence: 0,
        raw: "",
        psm: "-",
        error: String(e),
      });
    }
  }

  // 2) Segmentasyon: 4 ayri rakam, her biri PSM 10 + fallbacks
  if (Array.isArray(segmentGroups) && segmentGroups.length) {
    for (let g = 0; g < segmentGroups.length; g++) {
      const grp = segmentGroups[g];
      if (!grp || !Array.isArray(grp.segments) || grp.segments.length !== expectLen) {
        continue;
      }
      try {
        const seg = await recognizeSegments(worker, grp.segments);
        all.push({
          source: "segments",
          variantIndex: g,
          label: grp.label || "",
          digits: seg.digits,
          confidence: seg.confidence,
          raw: seg.digits,
          perDigit: seg.perDigit,
          psm: "seg",
        });
      } catch (e) {
        all.push({
          source: "segments",
          variantIndex: g,
          digits: "",
          confidence: 0,
          raw: "",
          psm: "seg",
          error: String(e),
        });
      }
    }
  }

  // 3) Oy verme: her pozisyon icin en cok goren rakam
  // Sadece expectLen uzunlugundaki sonuclari say. Segment sonuclari double-weight.
  const votes = Array.from({ length: expectLen }, () => ({}));
  let votedCount = 0;
  for (const a of all) {
    if (!a.digits || a.digits.length !== expectLen) continue;
    const weight =
      a.source === "segments"
        ? 2 + (a.confidence / 100) // segmentasyona guveniyoruz
        : 1 + (a.confidence / 100);
    for (let p = 0; p < expectLen; p++) {
      const ch = a.digits.charAt(p);
      votes[p][ch] = (votes[p][ch] || 0) + weight;
    }
    votedCount++;
  }

  let voted = null;
  if (votedCount >= 2) {
    let code = "";
    let minVote = Infinity;
    for (let p = 0; p < expectLen; p++) {
      const v = votes[p];
      let bestCh = "";
      let bestW = -1;
      for (const ch in v) {
        if (v[ch] > bestW) {
          bestW = v[ch];
          bestCh = ch;
        }
      }
      if (bestW < minVote) minVote = bestW;
      code += bestCh;
    }
    if (code.length === expectLen && /^\d+$/.test(code)) {
      voted = {
        source: "voting",
        digits: code,
        raw: code,
        psm: "vote",
        confidence: Math.min(99, Math.round(minVote * 20)),
        tried: votedCount,
      };
      all.push(voted);
    }
  }

  // Siralama: exact-length > length-closer > source priority (voted/segments > whole) > confidence
  const sourceRank = (s) => (s === "voting" ? 3 : s === "segments" ? 2 : 1);
  all.sort((a, b) => {
    const aExact = a.digits.length === expectLen ? 1 : 0;
    const bExact = b.digits.length === expectLen ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    const aLenScore = Math.abs(a.digits.length - expectLen);
    const bLenScore = Math.abs(b.digits.length - expectLen);
    if (aLenScore !== bLenScore) return aLenScore - bLenScore;
    const sa = sourceRank(a.source);
    const sb = sourceRank(b.source);
    if (sa !== sb) return sb - sa;
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
        const imgs = Array.isArray(msg.images)
          ? msg.images.filter((s) => typeof s === "string" && s)
          : [];
        const groups = Array.isArray(msg.segmentGroups) ? msg.segmentGroups : [];
        if (!imgs.length && !groups.length) {
          sendResponse({ ok: false, error: "images[] veya segmentGroups[] gerekli" });
          return;
        }
        const expectLen = Number(msg.expectLen) > 0 ? Number(msg.expectLen) : 4;
        const t0 = performance.now();
        const ranked = await recognizeMulti(imgs, groups, expectLen);
        const ms = Math.round(performance.now() - t0);
        const best = ranked[0];
        const code = (best?.digits || "").slice(0, expectLen);
        sendResponse({
          ok: code.length === expectLen,
          code,
          raw: best?.raw || "",
          psm: best?.psm || "-",
          source: best?.source || "-",
          variantIndex: best?.variantIndex ?? -1,
          confidence: Math.round(best?.confidence || 0),
          ms,
          tried: ranked.length,
          error:
            code.length === expectLen
              ? undefined
              : "OCR " + expectLen + " haneli kod bulamadi (en iyi: '" +
                (best?.raw || "(bos)").slice(0, 20) + "' / " +
                Math.round(best?.confidence || 0) + "%)",
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
