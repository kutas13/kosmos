const msgEl = document.getElementById("msg");
const btnWizard = document.getElementById("btnWizard");
const btnStep1 = document.getElementById("btnStep1");
const btnLoad = document.getElementById("btnLoad");

const msgAlmEl = document.getElementById("msgAlm");
const btnAlmLoad = document.getElementById("btnAlmLoad");
const btnAlmSorgula = document.getElementById("btnAlmSorgula");
const btnAlmFillOnly = document.getElementById("btnAlmFillOnly");
const almWarn = document.getElementById("almWarn");

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
});

// ── TAB SWITCHER ──
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanes = document.querySelectorAll(".tab-pane");
function activateTab(name) {
  tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  tabPanes.forEach((p) => p.classList.toggle("active", p.id === `pane-${name}`));
  chrome.storage.local.set({ activeTab: name });
}
tabButtons.forEach((b) => b.addEventListener("click", () => activateTab(b.dataset.tab)));
chrome.storage.local.get(["activeTab"], (r) => {
  if (r.activeTab === "almanya") activateTab("almanya");
});

async function getApiBase() {
  const r = await chrome.storage.local.get(["apiBaseUrl"]);
  const b = String(r.apiBaseUrl || "").trim().replace(/\/$/, "");
  return b || (typeof FOXVIZE_API_BASE !== "undefined" ? FOXVIZE_API_BASE : "https://foxvize.info");
}

// ─────────────────────────────────────────────
// YUNAN (Kosmos) — mevcut davranis
// ─────────────────────────────────────────────

function payloadFromForm() {
  return {
    ad: document.getElementById("ad").value.trim(),
    soyad: document.getElementById("soyad").value.trim(),
    tc: document.getElementById("tc").value.trim(),
    dogum_tarihi: document.getElementById("dogum_tarihi").value.trim(),
    telefon: document.getElementById("telefon").value.trim(),
  };
}

function loadDraft() {
  chrome.storage.local.get(["lastFill", "lastMusteriId"], (r) => {
    if (r.lastMusteriId != null) document.getElementById("musteri_id").value = String(r.lastMusteriId);
    const d = r.lastFill;
    if (!d) return;
    ["ad", "soyad", "tc", "dogum_tarihi", "telefon"].forEach((k) => {
      const el = document.getElementById(k);
      if (el && d[k]) el.value = d[k];
    });
  });
}
loadDraft();

btnLoad.addEventListener("click", async () => {
  msgEl.textContent = "";
  msgEl.className = "";
  const idRaw = document.getElementById("musteri_id").value.trim();
  if (!idRaw) {
    msgEl.className = "err";
    msgEl.textContent = "Müşteri ID girin.";
    return;
  }
  const idNum = Number(idRaw);
  if (!Number.isInteger(idNum) || idNum < 1 || idNum > 999) {
    msgEl.className = "err";
    msgEl.textContent = "Müşteri ID 1 ile 999 arasında olmalı.";
    return;
  }
  btnLoad.disabled = true;
  try {
    const base = await getApiBase();
    const r = await fetch(`${base}/api/musteri/${encodeURIComponent(idRaw)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      msgEl.className = "err";
      msgEl.textContent = j.detail || `Sunucu hatası (${r.status}). API: ${base}`;
      return;
    }
    document.getElementById("ad").value = j.ad || "";
    document.getElementById("soyad").value = j.soyad || "";
    document.getElementById("tc").value = j.tc || "";
    document.getElementById("dogum_tarihi").value = j.dogum_tarihi || "";
    document.getElementById("telefon").value = j.telefon || "";
    chrome.storage.local.set({ lastFill: payloadFromForm(), lastMusteriId: Number(idRaw) });
    msgEl.textContent = `Müşteri #${j.id} yüklendi.`;
  } catch (e) {
    msgEl.className = "err";
    msgEl.textContent =
      "Bağlanılamadı. foxvize.info açılıyor mu? Ayarlar → API adresi doğru mu?\n" +
      String(e);
  } finally {
    btnLoad.disabled = false;
  }
});

async function sendToKosmosTab(type, payload) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    msgEl.className = "err";
    msgEl.textContent = "Sekme bulunamadı.";
    return;
  }
  const url = tab.url || "";
  if (!url.includes("basvuru.kosmosvize.com.tr")) {
    msgEl.className = "err";
    msgEl.textContent = "Önce Kosmos başvuru sayfasını bu sekmede açın.";
    return;
  }
  return chrome.tabs.sendMessage(tab.id, { type, payload });
}

document.getElementById("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  msgEl.textContent = "";
  msgEl.className = "";
  btnWizard.disabled = true;

  const payload = payloadFromForm();
  chrome.storage.local.set({ lastFill: payload });

  try {
    const res = await sendToKosmosTab("KOSMOS_FILL_WIZARD", payload);
    if (!res) return;
    if (!res.ok) {
      msgEl.className = "err";
      msgEl.textContent = res.wizardError || "Sihirbaz hatası";
      return;
    }
    const bits = [
      "Kimlik → … → masraflar (7) → KVKK (8, metin kaydır + onaylar) → Sonraki tamam.",
    ];
    if (res.passportNo) bits.push("Pasaport: " + res.passportNo);
    if (res.visaEntryDate) bits.push("Vize giriş: " + res.visaEntryDate);
    if (res.visaReturnDate) bits.push("Vize dönüş: " + res.visaReturnDate);
    msgEl.textContent = bits.join("\n");
  } catch {
    msgEl.className = "err";
    msgEl.textContent =
      "İçerik betiği yok. Sayfayı yenileyin veya eklentiyi yeniden yükleyin.";
  } finally {
    btnWizard.disabled = false;
  }
});

btnStep1.addEventListener("click", async () => {
  msgEl.textContent = "";
  msgEl.className = "";
  btnStep1.disabled = true;
  const payload = payloadFromForm();
  chrome.storage.local.set({ lastFill: payload });
  try {
    const res = await sendToKosmosTab("KOSMOS_FILL", payload);
    if (!res) return;
    if (!res.ok) {
      msgEl.className = "err";
      msgEl.textContent = "Yanıt alınamadı.";
      return;
    }
    const bad = [
      ...(res.dynamic || []),
      ...(res.static || []),
      ...(res.step1Extra || []),
    ].filter((x) => !x.ok);
    if (bad.length) {
      msgEl.className = "err";
      msgEl.textContent =
        "Eksik alanlar: " + bad.map((x) => x.key || x.label || x.name).join(", ");
      return;
    }
    msgEl.textContent = "1. sayfa dolduruldu (şehir, sokak, e-posta, telefon dahil).";
  } catch {
    msgEl.className = "err";
    msgEl.textContent = "İçerik betiği yüklenemedi.";
  } finally {
    btnStep1.disabled = false;
  }
});

// ─────────────────────────────────────────────
// ALMANYA (idata.com.tr)
// ─────────────────────────────────────────────

const almIdInput = document.getElementById("alm_id");
const almAd = document.getElementById("alm_ad_soyad");
const almPas = document.getElementById("alm_pasaport_no");
const almBrk = document.getElementById("alm_barkod_no");
const almCap = document.getElementById("alm_captcha");
const btnAlmSolveCap = document.getElementById("btnAlmSolveCap");

function setAlmMsg(text, kind) {
  msgAlmEl.textContent = text || "";
  msgAlmEl.className = kind || "";
}

function almPayloadFromForm() {
  return {
    ad_soyad: almAd.value.trim(),
    pasaport_no: almPas.value.trim(),
    barkod_no: almBrk.value.trim(),
  };
}

function loadAlmDraft() {
  chrome.storage.local.get(["lastAlmFill", "lastAlmanyaId"], (r) => {
    if (r.lastAlmanyaId != null) almIdInput.value = String(r.lastAlmanyaId);
    const d = r.lastAlmFill;
    if (d) {
      if (d.ad_soyad) almAd.value = d.ad_soyad;
      if (d.pasaport_no) almPas.value = d.pasaport_no;
      if (d.barkod_no) almBrk.value = d.barkod_no;
    }
    // Yazili ID'ye gore butonu baslangicta da dogrula
    updateAlmIdState();
  });
}
loadAlmDraft();

/** Yazilan ID cikti olarak isaretliyse sorgula butonlarini kilitle. */
async function isIdMarkedCikti(id) {
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum < 1 || idNum > 999) return false;

  // Once lokal cache'e bak
  const cached = await new Promise((resolve) => {
    chrome.storage.local.get(["almanyaCiktiIds"], (res) => {
      const arr = Array.isArray(res.almanyaCiktiIds) ? res.almanyaCiktiIds : [];
      resolve(arr.map(Number));
    });
  });
  if (cached.includes(idNum)) return true;

  // Sonra sunucudan teyit
  try {
    const base = await getApiBase();
    const r = await fetch(`${base}/api/almanya/${idNum}`);
    if (!r.ok) return false;
    const j = await r.json();
    if (j && j.cikti === true) {
      // lokal cache'i guncelle
      chrome.storage.local.get(["almanyaCiktiIds"], (res) => {
        const arr = Array.isArray(res.almanyaCiktiIds) ? res.almanyaCiktiIds : [];
        if (!arr.includes(idNum)) {
          arr.push(idNum);
          chrome.storage.local.set({ almanyaCiktiIds: arr });
        }
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

let almIdCheckTimer = null;
async function updateAlmIdState() {
  const idRaw = almIdInput.value.trim();
  if (!idRaw) {
    almWarn.classList.remove("on");
    btnAlmSorgula.disabled = false;
    btnAlmFillOnly.disabled = false;
    return;
  }
  const blocked = await isIdMarkedCikti(idRaw);
  almWarn.classList.toggle("on", blocked);
  btnAlmSorgula.disabled = blocked;
  btnAlmFillOnly.disabled = blocked;
  btnAlmLoad.disabled = false; // yine de yukleyebilsin
}

almIdInput.addEventListener("input", () => {
  if (almIdCheckTimer) clearTimeout(almIdCheckTimer);
  almIdCheckTimer = setTimeout(updateAlmIdState, 250);
});

btnAlmLoad.addEventListener("click", async () => {
  setAlmMsg("");
  const idRaw = almIdInput.value.trim();
  if (!idRaw) {
    setAlmMsg("Almanya ID girin.", "err");
    return;
  }
  const idNum = Number(idRaw);
  if (!Number.isInteger(idNum) || idNum < 1 || idNum > 999) {
    setAlmMsg("ID 1 ile 999 arasında olmalı.", "err");
    return;
  }
  btnAlmLoad.disabled = true;
  try {
    const base = await getApiBase();
    const r = await fetch(`${base}/api/almanya/${encodeURIComponent(idRaw)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setAlmMsg(j.detail || `Sunucu hatası (${r.status}). API: ${base}`, "err");
      return;
    }
    almAd.value = j.ad_soyad || "";
    almPas.value = j.pasaport_no || "";
    almBrk.value = j.barkod_no || "";
    chrome.storage.local.set({
      lastAlmFill: almPayloadFromForm(),
      lastAlmanyaId: idNum,
    });

    if (j.cikti) {
      // lokal cache'e ekle
      chrome.storage.local.get(["almanyaCiktiIds"], (res) => {
        const arr = Array.isArray(res.almanyaCiktiIds) ? res.almanyaCiktiIds : [];
        if (!arr.includes(idNum)) {
          arr.push(idNum);
          chrome.storage.local.set({ almanyaCiktiIds: arr });
        }
      });
      almWarn.classList.add("on");
      btnAlmSorgula.disabled = true;
      btnAlmFillOnly.disabled = true;
      setAlmMsg(`#${j.id} yüklendi — pasaport zaten ÇIKTI olarak işaretli. Yeniden sorgulama engellendi.`, "err");
    } else {
      almWarn.classList.remove("on");
      btnAlmSorgula.disabled = false;
      btnAlmFillOnly.disabled = false;
      setAlmMsg(`#${j.id} yüklendi.`, "ok");
    }
  } catch (e) {
    setAlmMsg("Bağlanılamadı. API adresi doğru mu?\n" + String(e), "err");
  } finally {
    btnAlmLoad.disabled = false;
  }
});

async function sendToIdataTab(type, payload) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setAlmMsg("Sekme bulunamadı.", "err");
    return null;
  }
  const url = tab.url || "";
  if (!/idata\.com\.tr/i.test(url)) {
    setAlmMsg("Önce idata.com.tr başvuru takip sayfasını bu sekmede açın.", "err");
    return null;
  }
  const send = () => chrome.tabs.sendMessage(tab.id, { type, payload });
  try {
    return await send();
  } catch (e) {
    // İçerik betiği yoksa (eklenti güncellendi ama sayfa yenilenmedi vs.) elle inject et
    try {
      if (chrome.scripting && chrome.scripting.executeScript) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["idata-content.js"],
        });
        // Inject sonrasi biraz soluklan, sonra tekrar dene
        await new Promise((r) => setTimeout(r, 150));
        return await send();
      }
    } catch (e2) {
      setAlmMsg(
        "İçerik betiği yüklenemedi. Sayfayı yenileyin.\n" + String(e2 && e2.message || e2),
        "err"
      );
      return null;
    }
    setAlmMsg("İçerik betiği yüklenemedi. Sayfayı yenileyin.\n" + String(e), "err");
    return null;
  }
}

async function runAlmFill(alsoClick) {
  setAlmMsg("");
  const idRaw = almIdInput.value.trim();
  const idNum = Number(idRaw);
  if (!Number.isInteger(idNum) || idNum < 1 || idNum > 999) {
    setAlmMsg("Önce geçerli bir Almanya ID girin ve Yükle butonuna basın.", "err");
    return;
  }
  if (await isIdMarkedCikti(idNum)) {
    almWarn.classList.add("on");
    btnAlmSorgula.disabled = true;
    btnAlmFillOnly.disabled = true;
    setAlmMsg(`#${idNum} pasaportu zaten ÇIKTI. Yeniden sorgulama engellendi.`, "err");
    return;
  }
  const captcha = (almCap.value || "").trim();
  const payload = {
    ...almPayloadFromForm(),
    id: idNum,
    captcha,
    autoSolveCaptcha: !captcha, // bos ise OCR denesin
  };
  if (!payload.pasaport_no || !payload.barkod_no) {
    setAlmMsg("Pasaport ve Barkod alanlari dolu olmalidir. Önce Yükle butonuna basın.", "err");
    return;
  }
  chrome.storage.local.set({ lastAlmFill: almPayloadFromForm(), lastAlmanyaId: idNum });

  btnAlmSorgula.disabled = true;
  btnAlmFillOnly.disabled = true;
  try {
    const res = await sendToIdataTab("ALMANYA_FILL", payload);
    if (!res) return;
    if (!res.ok) {
      const miss = [];
      if (!res.foundPassport) miss.push("pasaport alanı");
      if (!res.foundBarcode) miss.push("barkod alanı");
      setAlmMsg(
        "Sayfa alanları bulunamadı: " +
          (miss.join(", ") || "(bilinmeyen)") +
          ". idata.com.tr başvuru takip sayfasında olduğunuzdan emin olun.",
        "err"
      );
      return;
    }

    // OCR sonucunu forma yaz (kullanici gorsun)
    if (res.ocr && res.ocr.ok && res.ocr.code && !almCap.value) {
      almCap.value = res.ocr.code;
    }

    // Eger OCR basarisiz olduysa ve captcha halen bossa, kullaniciyi uyar
    const haveCaptcha = !!(almCap.value && almCap.value.trim().length >= 3);
    if (alsoClick && !haveCaptcha) {
      setAlmMsg(
        (res.ocr && res.ocr.error
          ? `CAPTCHA OCR başarısız: ${res.ocr.error}. `
          : "CAPTCHA çözülemedi. ") +
          "Sayfadaki kodu manuel girip tekrar deneyin.",
        "err"
      );
      return;
    }

    if (!alsoClick) {
      const okMsg = res.ocr && res.ocr.ok
        ? `Alanlar dolduruldu (CAPTCHA OCR: ${res.ocr.code}, güven ${res.ocr.confidence || "?"}). Sorgula'ya siz basın.`
        : "Alanlar dolduruldu. CAPTCHA'yı girip Sorgula'ya siz basın.";
      setAlmMsg(okMsg, "ok");
      return;
    }

    setAlmMsg(
      res.ocr && res.ocr.ok
        ? `Sorgulanıyor… (OCR: ${res.ocr.code})`
        : "Sorgulanıyor…",
      "ok"
    );
    const clickRes = await sendToIdataTab("ALMANYA_CLICK_SORGULA", {});
    if (!clickRes || !clickRes.ok) {
      setAlmMsg((clickRes && clickRes.error) || "Sorgula butonu çalıştırılamadı.", "err");
      return;
    }

    // Sonucu bekle (en fazla ~15sn)
    const waitRes = await sendToIdataTab("ALMANYA_WAIT_RESULT", { timeoutMs: 15000 });
    if (!waitRes || !waitRes.ok) {
      setAlmMsg("Sonuç zaman aşımı — sayfaya bakıp tekrar deneyin.", "err");
      return;
    }

    const d = waitRes.durum || "beklemede";
    const mesaj = waitRes.mesaj || "";
    if (d === "cikmis") {
      setAlmMsg(`✓ ÇIKTI — pasaport hazır. (${mesaj || "hazır"})`, "ok");
    } else if (d === "hata") {
      setAlmMsg(`✗ HATA — ${mesaj || "Sistemimizde böyle bir pasaport tanımlı değil."}`, "err");
    } else if (d === "islemde") {
      setAlmMsg(`⏳ İŞLEMDE — ${mesaj || "Başvuru süreci devam ediyor."}`, "warn");
    } else {
      setAlmMsg("Sonuç: beklemede", "warn");
    }
  } finally {
    updateAlmIdState();
  }
}

document.getElementById("fAlm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await runAlmFill(true);
});

btnAlmFillOnly.addEventListener("click", async () => {
  await runAlmFill(false);
});

if (btnAlmSolveCap) {
  btnAlmSolveCap.addEventListener("click", async () => {
    btnAlmSolveCap.disabled = true;
    const oldTxt = btnAlmSolveCap.textContent;
    btnAlmSolveCap.textContent = "…";
    try {
      setAlmMsg("CAPTCHA OCR ile çözülüyor…", "ok");
      const r = await sendToIdataTab("ALMANYA_SOLVE_CAPTCHA", {});
      if (!r) return;
      if (r.ok && r.code) {
        almCap.value = r.code;
        setAlmMsg(`OCR sonucu: ${r.code} (güven ${r.confidence || "?"}).`, "ok");
      } else {
        setAlmMsg("OCR başarısız: " + (r.error || "bilinmeyen hata"), "err");
      }
    } catch (e) {
      setAlmMsg("OCR hatası: " + String(e), "err");
    } finally {
      btnAlmSolveCap.textContent = oldTxt;
      btnAlmSolveCap.disabled = false;
    }
  });
}
