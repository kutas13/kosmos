/**
 * idata.com.tr Almanya pasaport takip otomasyonu (content script).
 *
 * Popup'tan gelen mesajlar:
 *  - ALMANYA_PING                : hayat isareti
 *  - ALMANYA_FILL  { payload }   : pasaport + barkod + captcha alanlarini doldurur
 *  - ALMANYA_CLICK_SORGULA       : Sorgula butonuna tiklar
 *  - ALMANYA_WAIT_RESULT { timeoutMs } : sorgudan sonra sonucu bekler ve durum raporlar
 *  - ALMANYA_CHECK_CIKTI         : anlik durum kontrolu
 *
 * Durum tespiti (sayfa metni / .show_result_area_follow):
 *   - "Sistemimizde boyle bir pasaport tanimli degil" => durum = "hata"
 *   - "Basvuru dosyaniz ilgili Elcilik/Konsoloslugga gonderilmis, islem sureci baslamistir" => durum = "islemde"
 *   - "hazir", "teslim alinabilir", "abholbereit" vb. => durum = "cikmis"
 */

(function () {
  "use strict";

  const ACTIVE_KEY = "almanyaActiveId";

  function setNativeValue(el, value) {
    if (!el) return;
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("keyup", { bubbles: true }));
  }

  function q(sel, root) {
    return (root || document).querySelector(sel);
  }

  function findPassportInput() {
    return (
      q("#pasaport_code") ||
      q('input[name="passport"]') ||
      q("input.passport")
    );
  }

  function findBarcodeInput() {
    return (
      q("#barcode_code") ||
      q('input[name="barcode"]') ||
      q("input.barcode")
    );
  }

  function findCaptchaInput() {
    return (
      q("#mailConfirmCodeControlPost") ||
      q('input[name="mailConfirmCodePost"]') ||
      q('input[placeholder="CONFIRM CODE" i]') ||
      q('input.upperCaseJvns')
    );
  }

  function findCaptchaImg() {
    return (
      q("img.captcha-img") ||
      q('img[src^="data:image/"][src*="captcha" i]') ||
      q('img[alt*="captcha" i]') ||
      q('img[alt*="CAPTCHA" i]') ||
      // Genel: captcha input'unun yakinindaki data-url'li gorsel
      (function () {
        const inp = findCaptchaInput();
        if (!inp) return null;
        let node = inp;
        for (let i = 0; i < 6 && node; i++) {
          node = node.parentElement;
          if (!node) break;
          const im = node.querySelector('img[src^="data:image/"]');
          if (im) return im;
        }
        return null;
      })()
    );
  }

  /**
   * Captcha gorseli icin on-isleme: 3x olcek + grayscale + threshold + gurultu temizligi.
   * Tesseract kucuk goruntulerde zorlaniyor; 3x upscaling OCR dogrulugunu onemli
   * olcude artiriyor.
   */
  function preprocessCaptchaToDataUrl(imgEl, opts) {
    try {
      const o = Object.assign({ scale: 3, thresh: 120, denoise: true }, opts || {});
      const w0 = imgEl.naturalWidth || imgEl.width;
      const h0 = imgEl.naturalHeight || imgEl.height;
      if (!w0 || !h0) return imgEl.src || null;
      const w = Math.round(w0 * o.scale);
      const h = Math.round(h0 * o.scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // Beyaz zemin koy (kenarlari temiz olsun)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(imgEl, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;

      // 1) Grayscale + threshold (koyu -> siyah, diger -> beyaz)
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = lum < o.thresh ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }

      // 2) Opening (erode-1): tek piksel/kucuk gurultu temizle
      if (o.denoise) {
        const getBlk = (x, y) => {
          if (x < 0 || y < 0 || x >= w || y >= h) return 0;
          return d[(y * w + x) * 4] === 0 ? 1 : 0;
        };
        const out = new Uint8ClampedArray(d.length);
        out.set(d);
        // Komsu siyah pikseli <2 olan izole siyahlari sil (erode)
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            if (d[idx] !== 0) continue;
            let n = 0;
            n += getBlk(x - 1, y - 1) + getBlk(x, y - 1) + getBlk(x + 1, y - 1);
            n += getBlk(x - 1, y) + getBlk(x + 1, y);
            n += getBlk(x - 1, y + 1) + getBlk(x, y + 1) + getBlk(x + 1, y + 1);
            if (n < 2) {
              out[idx] = out[idx + 1] = out[idx + 2] = 255;
            }
          }
        }
        for (let i = 0; i < d.length; i++) d[i] = out[i];
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL("image/png");
    } catch (e) {
      console.warn("[idata] preprocess hata:", e);
      try { return imgEl.src || null; } catch { return null; }
    }
  }

  /** Cesitli threshold ve olcek varyantlarinda bir dizi ureten yardimci. */
  function buildCaptchaVariants(imgEl) {
    const variants = [];
    // Olcek 3x, orta esik - en iyi denge
    const v1 = preprocessCaptchaToDataUrl(imgEl, { scale: 3, thresh: 120, denoise: true });
    if (v1) variants.push(v1);
    // Olcek 3x, kaliplar ince ise daha dusuk esik cizgileri yakalar
    const v2 = preprocessCaptchaToDataUrl(imgEl, { scale: 3, thresh: 90, denoise: true });
    if (v2 && v2 !== v1) variants.push(v2);
    // Olcek 4x, daha yumusak (yuksek cozunurluk, basit threshold)
    const v3 = preprocessCaptchaToDataUrl(imgEl, { scale: 4, thresh: 130, denoise: false });
    if (v3) variants.push(v3);
    return variants;
  }

  // ====== OCR via BACKGROUND + OFFSCREEN ======
  // Content script CSP/isolated-world sorunlarini onlemek icin OCR'yi background
  // araciligiyla offscreen document'a delege ediyoruz.

  // Sayfa acildiginda arkaplanda warmup tetikle (ilk sorguda ~1s kazandirir)
  setTimeout(() => {
    try {
      chrome.runtime.sendMessage({ type: "OCR_WARMUP" }, () => {
        // yanit onemsiz; hata olursa sessiz ge
        void chrome.runtime.lastError;
      });
    } catch {
      // extension context invalidated olabilir
    }
  }, 800);

  async function solveCaptchaLocal() {
    const img = findCaptchaImg();
    if (!img) return { ok: false, error: "CAPTCHA gorseli bulunamadi" };
    if (!img.complete || !img.naturalWidth) {
      await new Promise((r) => {
        const done = () => r();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        setTimeout(done, 1500);
      });
    }
    // Birden fazla on-isleme varyanti uret; offscreen hepsini ve tum PSM'leri
    // deneyip en yuksek guvenli 4-haneli sonucu dondurur.
    const variants = buildCaptchaVariants(img);
    if (!variants.length) {
      const fallback = img.src;
      if (!fallback) return { ok: false, error: "On-isleme basarisiz" };
      variants.push(fallback);
    }

    try {
      const res = await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(
            { type: "OCR_CAPTCHA_MULTI", images: variants, expectLen: 4 },
            (r) => {
              if (chrome.runtime.lastError) {
                resolve({ ok: false, error: chrome.runtime.lastError.message });
                return;
              }
              resolve(r || { ok: false, error: "Bos yanit" });
            }
          );
        } catch (e) {
          resolve({ ok: false, error: "Mesaj hatasi: " + String(e && e.message || e) });
        }
      });
      return res;
    } catch (e) {
      return { ok: false, error: "OCR hatasi: " + (e && e.message ? e.message : String(e)) };
    }
  }

  // Geriye uyumluluk icin eski ismi tut
  const solveCaptchaViaServer = solveCaptchaLocal;

  function findSorgulaBtn() {
    return (
      q("#follow_app_action_button") ||
      q('a[id*="follow_app_action"]') ||
      Array.from(document.querySelectorAll("a,button")).find(
        (el) => /sorgula/i.test(el.textContent || "")
      )
    );
  }

  function findResultArea() {
    // Sadece SORGU sonucunun yazildigi kutu. Genel sayfa bildirimleri
    // (ornek: "Randevu sisteminin dogru ve verimli sekilde kullanilmasini...")
    // icindeki kelimeler ("haziran" gibi) false-positive uretmesin diye
    // body'ye asla bakmiyoruz.
    const sels = [
      ".show_result_area_follow",
      "[class*='show_result_area']",
      "#show_result_area_follow",
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (!el) continue;
      const txt = (el.innerText || el.textContent || "").trim();
      // Gercekten gorunen ve anlamli icerik varsa dondur
      if (txt.length >= 5 && el.offsetParent !== null) return el;
    }
    return null;
  }

  function normTr(s) {
    return String(s || "")
      .toLocaleLowerCase("tr")
      .replace(/ı/g, "i")
      .replace(/ş/g, "s")
      .replace(/ğ/g, "g")
      .replace(/ç/g, "c")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Sonuc metnini ve durumunu dondurur. SADECE sorgu sonuc kutusundan okur. */
  function analyzeResult() {
    const area = findResultArea();
    if (!area) return null;
    const areaText = (area.innerText || area.textContent || "").trim();
    if (!areaText) return null;
    const norm = normTr(areaText);

    const pickLine = (rx, fallback) => {
      const line = areaText
        .split("\n").map((s) => s.trim()).filter(Boolean)
        .find((s) => rx.test(s));
      return line || fallback;
    };

    // HATA
    if (
      /sistemimizde b[oö]yle bir pasaport tanimli degil/.test(norm) ||
      /b[oö]yle bir pasaport tanimli degil/.test(norm) ||
      /bilgilerinizi kontrol edin/.test(norm) ||
      /kein pass(port)?/.test(norm) ||
      /nicht gefunden/.test(norm)
    ) {
      return {
        durum: "hata",
        mesaj: pickLine(
          /sistemimizde|kontrol edin|nicht|kein/i,
          "Sistemimizde böyle bir pasaport tanımlı değil."
        ),
      };
    }

    // CIKMIS — cok spesifik ifadeler. "hazir" tek basina YETERLI DEGIL
    // (haziran ayi adina false-match olur). Kelime sinirli veya birlesik eslesme.
    const cikmisRx = new RegExp(
      [
        "islemi tamamlanan pasaportunuz",
        "idata ofisine gelmistir",
        "ofisine gelmistir",
        "pasaport(?:unuz)?\\s+hazir",
        "hazirdir",
        "teslim(e|\\s)alin",
        "teslime hazir",
        "abholbereit",
        "zur abholung",
        "ready for pickup",
        "ready to be collected",
        "kargoya verildi",
        "kuryeye teslim",
      ].join("|"),
      "i"
    );
    if (cikmisRx.test(norm)) {
      return {
        durum: "cikmis",
        mesaj: pickLine(
          /islemi tamamlanan|ofisine gelmiştir|hazır|teslim|abholung|ready|kargoya|kuryeye/i,
          "Elçilik/Konsoloslukta işlemi tamamlanan pasaportunuz, başvuru yapılan iDATA ofisine gelmiştir."
        ),
      };
    }

    // ISLEMDE
    const islemdeRx =
      /basvuru dosyaniz ilgili|konsolosluga (gonderilmis|gonderildi)|islem sureci|in bearbeitung/i;
    if (islemdeRx.test(norm)) {
      return {
        durum: "islemde",
        mesaj: pickLine(
          /başvuru dosyanız|gönderil|işlem süreci|bearbeitung/i,
          "Başvuru dosyanız ilgili Elçilik/Konsolosluğa gönderilmiş, işlem süreci başlamıştır."
        ),
      };
    }

    return null;
  }

  async function getApiBase() {
    const r = await new Promise((resolve) => {
      try { chrome.storage.local.get(["apiBaseUrl"], resolve); }
      catch { resolve({}); }
    });
    const b = String(r.apiBaseUrl || "").trim().replace(/\/$/, "");
    return b || "https://foxvize.info";
  }

  async function sendDurumToServer(id, durum, mesaj) {
    if (!id) return;
    try {
      const base = await getApiBase();
      await fetch(`${base}/api/almanya/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durum, son_mesaj: mesaj || null }),
      });
      if (durum === "cikmis") {
        chrome.storage.local.get(["almanyaCiktiIds"], (res) => {
          const arr = Array.isArray(res.almanyaCiktiIds) ? res.almanyaCiktiIds : [];
          if (!arr.includes(Number(id))) {
            arr.push(Number(id));
            chrome.storage.local.set({ almanyaCiktiIds: arr });
          }
        });
      }
    } catch (e) {
      console.warn("[idata] durum isaretleme hatasi:", e);
    }
  }

  let ciktiReported = false;
  let lastAnalyzed = null;

  function tryReport() {
    const res = analyzeResult();
    if (!res) return null;
    // Ayni sonucu iki kez yollamayalim
    const sig = res.durum + "|" + (res.mesaj || "");
    if (lastAnalyzed === sig) return res;
    lastAnalyzed = sig;

    chrome.storage.local.get([ACTIVE_KEY], (r) => {
      const id = Number(r[ACTIVE_KEY] || 0);
      if (!id) return;
      if (res.durum === "cikmis") ciktiReported = true;
      sendDurumToServer(id, res.durum, res.mesaj);
    });
    return res;
  }

  function observeResult() {
    const observer = new MutationObserver(() => {
      if (ciktiReported) return;
      tryReport();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    setTimeout(() => { if (!ciktiReported) tryReport(); }, 800);
  }

  function fillForm(data) {
    const pas = findPassportInput();
    const brk = findBarcodeInput();
    const cap = findCaptchaInput();
    const filled = { passport: false, barcode: false, captcha: false };
    if (pas && data.pasaport_no) {
      setNativeValue(pas, String(data.pasaport_no).trim());
      filled.passport = true;
    }
    if (brk && data.barkod_no) {
      setNativeValue(brk, String(data.barkod_no).trim());
      filled.barcode = true;
    }
    if (cap && data.captcha) {
      setNativeValue(cap, String(data.captcha).trim().toUpperCase());
      filled.captcha = true;
    } else if (cap) {
      try { cap.focus(); } catch {}
    }
    return filled;
  }

  function waitResult(timeoutMs) {
    return new Promise((resolve) => {
      // Onceki sonuc halen gecerliyse bir sure bekleyip yeni sonuc goruyoruz.
      // Bu yuzden pre-snapshot al, sonrakileri kabul et.
      const start = Date.now();
      let resolved = false;
      const finish = (payload) => {
        if (resolved) return;
        resolved = true;
        try { obs.disconnect(); } catch {}
        clearInterval(tick);
        resolve(payload);
      };

      const obs = new MutationObserver(() => {
        const res = tryReport();
        if (res) finish({ ok: true, ...res });
      });
      obs.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      // periyodik kontrol (bazi siteler metni JS ile degistirir, observer tetiklenmeyebilir)
      const tick = setInterval(() => {
        const res = tryReport();
        if (res) finish({ ok: true, ...res });
        if (Date.now() - start > timeoutMs) {
          finish({ ok: false, error: "timeout" });
        }
      }, 400);
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "ALMANYA_PING") {
      sendResponse({ ok: true, url: location.href });
      return true;
    }

    if (msg.type === "ALMANYA_FILL") {
      const data = msg.payload || {};
      (async () => {
        try {
          ciktiReported = false;
          lastAnalyzed = null;

          // Eger captcha bos ve autoSolve istendiyse OCR dene
          let ocr = null;
          if (!data.captcha && data.autoSolveCaptcha !== false) {
            ocr = await solveCaptchaViaServer();
            if (ocr && ocr.ok && ocr.code) {
              data.captcha = ocr.code;
            }
          }

          const res = fillForm(data);
          if (data.id) {
            chrome.storage.local.set({ [ACTIVE_KEY]: Number(data.id) });
          }
          const hasPas = !!findPassportInput();
          const hasBrk = !!findBarcodeInput();
          sendResponse({
            ok: hasPas && hasBrk,
            filled: res,
            foundPassport: hasPas,
            foundBarcode: hasBrk,
            foundCaptcha: !!findCaptchaInput(),
            ocr: ocr || undefined,
          });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      })();
      return true;
    }

    if (msg.type === "ALMANYA_SOLVE_CAPTCHA") {
      solveCaptchaViaServer().then((r) => {
        try {
          if (r && r.ok && r.code) {
            const cap = findCaptchaInput();
            if (cap) setNativeValue(cap, r.code);
          }
          sendResponse(r);
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      });
      return true;
    }

    if (msg.type === "ALMANYA_CLICK_SORGULA") {
      try {
        const btn = findSorgulaBtn();
        if (!btn) {
          sendResponse({ ok: false, error: "Sorgula butonu bulunamadi" });
          return true;
        }
        // Sonuc beklemeye hazirlik
        lastAnalyzed = null;
        ciktiReported = false;
        btn.click();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return true;
    }

    if (msg.type === "ALMANYA_WAIT_RESULT") {
      const timeoutMs = Number(msg.payload && msg.payload.timeoutMs) || 12000;
      waitResult(timeoutMs).then((r) => {
        try { sendResponse(r); } catch {}
      });
      return true; // async
    }

    if (msg.type === "ALMANYA_CHECK_CIKTI") {
      const r = analyzeResult();
      sendResponse({ ok: true, analysis: r });
      return true;
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeResult, { once: true });
  } else {
    observeResult();
  }
})();
