/**
 * idata.com.tr Almanya pasaport takip otomasyonu.
 * Popup'tan gelen ALMANYA_FILL mesajiyla:
 *  - #pasaport_code ve #barcode_code alanlarini doldurur.
 *  - CAPTCHA'yi kullanici manuel girer (resim degisken).
 *  - Kullanici Sorgula'ya bastiktan sonra sayfa sonucunu izler.
 *  - "cikti" / "hazir" / "teslim alinabilir" gibi ifadeler gorulurse,
 *    aktif ID'yi /api/almanya/[id] PUT { cikti: true } ile isaretler.
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
      q('input[placeholder="CONFIRM CODE" i]')
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

  /** Sayfada "cikti" / "hazir" / "teslim" benzeri durum tespit eder. */
  function detectCiktiStatus() {
    const txt = (document.body?.innerText || "").toLowerCase();
    // Turkce / Almanca anahtar ifadeler
    const positiveHints = [
      "çıktı",
      "cikti",
      "hazır",
      "hazir",
      "teslim alınabilir",
      "teslim alinabilir",
      "teslime hazır",
      "teslime hazir",
      "ready for pickup",
      "ready to be collected",
      "zur abholung bereit",
      "abholbereit",
      "pasaport merkezden",
      "kuryeye teslim",
      "kargoya verildi",
    ];
    for (const h of positiveHints) {
      if (txt.includes(h)) return true;
    }
    return false;
  }

  async function markCiktiOnServer(id) {
    try {
      const r = await chrome.storage.local.get(["apiBaseUrl"]);
      const base =
        String(r.apiBaseUrl || "").trim().replace(/\/$/, "") ||
        "https://foxvize.info";
      await fetch(`${base}/api/almanya/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cikti: true }),
      });
      // local cache de guncelle
      chrome.storage.local.get(["almanyaCiktiIds"], (res) => {
        const arr = Array.isArray(res.almanyaCiktiIds) ? res.almanyaCiktiIds : [];
        if (!arr.includes(Number(id))) {
          arr.push(Number(id));
          chrome.storage.local.set({ almanyaCiktiIds: arr });
        }
      });
    } catch (e) {
      console.warn("[idata] cikti isaretleme hatasi:", e);
    }
  }

  let ciktiReported = false;

  function observeResult() {
    // Sorgu yapildiktan sonra DOM degisikliklerini gozle
    const observer = new MutationObserver(() => {
      if (ciktiReported) return;
      if (!detectCiktiStatus()) return;
      chrome.storage.local.get([ACTIVE_KEY], (res) => {
        const id = Number(res[ACTIVE_KEY] || 0);
        if (!id) return;
        ciktiReported = true;
        markCiktiOnServer(id);
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Ilk yuklemede de bir kez kontrol et
    setTimeout(() => {
      if (!ciktiReported && detectCiktiStatus()) {
        chrome.storage.local.get([ACTIVE_KEY], (res) => {
          const id = Number(res[ACTIVE_KEY] || 0);
          if (!id) return;
          ciktiReported = true;
          markCiktiOnServer(id);
        });
      }
    }, 800);
  }

  function fillForm(data) {
    const pas = findPassportInput();
    const brk = findBarcodeInput();
    const filled = { passport: false, barcode: false };
    if (pas && data.pasaport_no) {
      setNativeValue(pas, String(data.pasaport_no).trim());
      filled.passport = true;
    }
    if (brk && data.barkod_no) {
      setNativeValue(brk, String(data.barkod_no).trim());
      filled.barcode = true;
    }
    // Captcha'ya odaklan (kullanici yazsin)
    const cap = findCaptchaInput();
    if (cap) {
      try { cap.focus(); } catch {}
    }
    return filled;
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
        const res = fillForm(data);
        if (data.id) {
          chrome.storage.local.set({ [ACTIVE_KEY]: Number(data.id) });
          ciktiReported = false;
        }
        const hasPas = !!findPassportInput();
        const hasBrk = !!findBarcodeInput();
        sendResponse({
          ok: hasPas && hasBrk,
          filled: res,
          foundPassport: hasPas,
          foundBarcode: hasBrk,
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
        btn.click();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return true;
    }

    if (msg.type === "ALMANYA_CHECK_CIKTI") {
      sendResponse({ ok: true, cikti: detectCiktiStatus() });
      return true;
    }
  });

  // Sayfa yuklendiginde sonuc izleyicisini baslat
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeResult, { once: true });
  } else {
    observeResult();
  }
})();
