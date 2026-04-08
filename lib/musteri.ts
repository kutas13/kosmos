export const MUSTERI_ID_MIN = 1;
export const MUSTERI_ID_MAX = 999;

export type Musteri = {
  id: number;
  ad: string;
  soyad: string;
  tc: string;
  dogum_tarihi: string;
  telefon: string;
};

export function parseBody(body: unknown): Omit<Musteri, "id"> | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const ad = String(o.ad ?? "").trim();
  const soyad = String(o.soyad ?? "").trim();
  const tc = String(o.tc ?? "").trim();
  const dogum_tarihi = String(o.dogum_tarihi ?? "").trim();
  const telefon = String(o.telefon ?? "").trim();
  if (!ad || !soyad || tc.length !== 11 || !/^\d{11}$/.test(tc) || !dogum_tarihi) {
    return null;
  }
  return { ad, soyad, tc, dogum_tarihi, telefon };
}

export function isValidMusteriId(id: number): boolean {
  return Number.isInteger(id) && id >= MUSTERI_ID_MIN && id <= MUSTERI_ID_MAX;
}

export function isUniqueViolation(err: { code?: string; message?: string }) {
  return err.code === "23505" || String(err.message || "").includes("duplicate key");
}

/** GG.AA.YYYY formatindan yas hesapla. Gecersizse null. */
export function calcAgeFromDogum(ddmmyyyy: string): number | null {
  const m = ddmmyyyy.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const birth = new Date(+m[3], +m[2] - 1, +m[1]);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
