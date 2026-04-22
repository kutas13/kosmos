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
    return (
      q(".show_result_area_follow") ||
      q("[class*='show_result_area']") ||
      q(".alert-info") ||
      q(".alert-danger") ||
      q(".alert-success")
    );
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

  /** Sonuc metnini ve durumunu dondurur. */
  function analyzeResult() {
    const area = findResultArea();
    const areaText = area ? (area.innerText || area.textContent || "") : "";
    const bodyText = document.body ? (document.body.innerText || "") : "";
    const hay = areaText + "\n" + bodyText;
    const norm = normTr(hay);

    // HATA
    const hataHints = [
      "sistemimizde boyle bir pasaport tanimli degil",
      "boyle bir pasaport tanimli degil",
      "bilgilerinizi kontrol edin",
      "kein passport",
      "nicht gefunden",
    ];
    for (const h of hataHints) {
      if (norm.includes(h)) {
        return {
          durum: "hata",
          mesaj: (areaText || bodyText)
            .split("\n").map((s) => s.trim()).filter(Boolean)
            .find((s) => /sistemimizde|kontrol edin|nicht|kein/i.test(s))
            || "Sistemimizde böyle bir pasaport tanımlı değil.",
        };
      }
    }

    // CIKMIS once kontrol edilir (cunku islemi tamamlanan pasaport mesajinda
    // "Elcilik/Konsoloslukta" ifadesi de gecer ve islemde hint'lerine carpar).
    const cikmisHints = [
      "islemi tamamlanan pasaportunuz",
      "idata ofisine gelmistir",
      "ofisine gelmistir",
      "hazir",
      "teslim alinabilir",
      "teslime hazir",
      "abholbereit",
      "zur abholung",
      "ready for pickup",
      "ready to be collected",
      "pasaport merkezden",
      "kargoya verildi",
      "kuryeye teslim",
      "cikti",
    ];
    for (const h of cikmisHints) {
      if (norm.includes(h)) {
        return {
          durum: "cikmis",
          mesaj: (areaText || bodyText)
            .split("\n").map((s) => s.trim()).filter(Boolean)
            .find((s) => /islemi tamamlanan|ofisine gelmistir|hazir|teslim|abholung|ready|kargoya|kuryeye|çıktı/i.test(s))
            || "Elçilik/Konsoloslukta işlemi tamamlanan pasaportunuz, başvuru yapılan iDATA ofisine gelmiştir.",
        };
      }
    }

    // ISLEMDE (henuz cikmamis) — daha spesifik ifadeler
    const islemdeHints = [
      "basvuru dosyaniz ilgili",
      "konsolosluga gonderilmis",
      "islem sureci baslamistir",
      "islem sureci",
      "in bearbeitung",
    ];
    for (const h of islemdeHints) {
      if (norm.includes(h)) {
        return {
          durum: "islemde",
          mesaj: (areaText || bodyText)
            .split("\n").map((s) => s.trim()).filter(Boolean)
            .find((s) => /basvuru dosyaniz|gönderilmiş|işlem süreci|bearbeitung/i.test(s))
            || "Başvuru dosyanız ilgili Elçilik/Konsolosluğa gönderilmiş, işlem süreci başlamıştır.",
        };
      }
    }

    return null; // henuz belirlenemedi
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
      try {
        // Yeni sorgu basliyor — bayraklari sifirla
        ciktiReported = false;
        lastAnalyzed = null;

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
        });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
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
