/**
 * foxvize.info sayfasinda calisir (content script).
 * Sayfa postMessage ile musteri/almanya verisini gonderir;
 * bu script chrome.storage.local'a yazar, popup acildiginda ID hazir olur.
 */
window.addEventListener("message", (e) => {
  if (e.source !== window) return;
  const t = e.data && e.data.type;

  // Yunan (Kosmos) musteri kaydi
  if (t === "FOXVIZE_MUSTERI_SAVED") {
    const d = e.data.payload;
    if (!d || !d.id) return;
    chrome.storage.local.set({
      lastMusteriId: Number(d.id),
      lastFill: {
        ad: d.ad || "",
        soyad: d.soyad || "",
        tc: d.tc || "",
        dogum_tarihi: d.dogum_tarihi || "",
        telefon: d.telefon || "",
      },
      activeTab: "yunan",
    });
    return;
  }

  // Almanya pasaport kaydi
  if (t === "FOXVIZE_ALMANYA_SAVED") {
    const d = e.data.payload;
    if (!d || !d.id) return;
    chrome.storage.local.set({
      lastAlmanyaId: Number(d.id),
      lastAlmFill: {
        ad_soyad: d.ad_soyad || "",
        pasaport_no: d.pasaport_no || "",
        barkod_no: d.barkod_no || "",
      },
      activeTab: "almanya",
    });
  }
});
