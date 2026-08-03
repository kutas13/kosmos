/** Müşteri API kök adresi (sonda / yok). Yerel kullanım yok; foxvize.info üzerinden çekilir. */
const FOXVIZE_API_BASE = "https://foxvize.info";
/**
 * Site middleware'ini bypass etmek icin API'ye gonderilen paylasilan sir.
 * Server tarafinda SITE_API_KEY env var'i ile ayni olmali.
 * Bu deger degisirse eklentiyi de guncellemek gerekir.
 */
const FOXVIZE_API_KEY = "foxvize-api-2026-internal-do-not-share";
