const msgEl = document.getElementById("msg");
const btnWizard = document.getElementById("btnWizard");
const btnStep1 = document.getElementById("btnStep1");
const btnLoad = document.getElementById("btnLoad");

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
});

async function getApiBase() {
  const r = await chrome.storage.local.get(["apiBaseUrl"]);
  const b = String(r.apiBaseUrl || "").trim().replace(/\/$/, "");
  return b || (typeof FOXVIZE_API_BASE !== "undefined" ? FOXVIZE_API_BASE : "https://foxvize.info");
}

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

async function sendToTab(type, payload) {
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
    const res = await sendToTab("KOSMOS_FILL_WIZARD", payload);
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
    const res = await sendToTab("KOSMOS_FILL", payload);
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
