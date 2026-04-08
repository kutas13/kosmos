/**
 * foxvize.info sayfasinda calisir (content script).
 * Sayfa postMessage ile musteri verisini gonderir;
 * bu script chrome.storage.local'a yazar, popup acildiginda ID hazir olur.
 */
window.addEventListener("message", (e) => {
  if (e.source !== window) return;
  if (!e.data || e.data.type !== "FOXVIZE_MUSTERI_SAVED") return;

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
  });
});
