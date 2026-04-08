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
