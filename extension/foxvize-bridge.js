/**
 * foxvize.info sayfasında çalışır.
 * Sayfa müşteri kaydettikten sonra CustomEvent ateşler;
 * bu script eklenti storage'ına yazar, popup açıldığında ID hazır olur.
 */
window.addEventListener("FOXVIZE_MUSTERI_SAVED", (e) => {
  const d = e.detail;
  if (!d || !d.id) return;
  const fill = {
    ad: d.ad || "",
    soyad: d.soyad || "",
    tc: d.tc || "",
    dogum_tarihi: d.dogum_tarihi || "",
    telefon: d.telefon || "",
  };
  chrome.storage.local.set({
    lastMusteriId: Number(d.id),
    lastFill: fill,
  });
});
