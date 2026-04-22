export const ALMANYA_ID_MIN = 1;
export const ALMANYA_ID_MAX = 999;

export type AlmanyaDurum = "beklemede" | "islemde" | "cikmis" | "hata";

export const ALMANYA_DURUM_VALUES: AlmanyaDurum[] = [
  "beklemede",
  "islemde",
  "cikmis",
  "hata",
];

export type AlmanyaPasaport = {
  id: number;
  ad_soyad: string;
  pasaport_no: string;
  barkod_no: string;
  cikti: boolean;
  cikti_at: string | null;
  durum: AlmanyaDurum;
  son_mesaj: string | null;
  sorgu_at: string | null;
  created_at?: string;
};

export type AlmanyaInput = Pick<AlmanyaPasaport, "ad_soyad" | "pasaport_no" | "barkod_no">;

export function parseAlmanyaBody(body: unknown): AlmanyaInput | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const ad_soyad = String(o.ad_soyad ?? "").trim();
  const pasaport_no = String(o.pasaport_no ?? "").trim();
  const barkod_no = String(o.barkod_no ?? "").trim();
  if (!ad_soyad || !pasaport_no || !barkod_no) return null;
  if (pasaport_no.length > 20 || barkod_no.length > 30 || ad_soyad.length > 120) return null;
  return { ad_soyad, pasaport_no, barkod_no };
}

export function isValidAlmanyaId(id: number): boolean {
  return Number.isInteger(id) && id >= ALMANYA_ID_MIN && id <= ALMANYA_ID_MAX;
}

export function isValidDurum(v: unknown): v is AlmanyaDurum {
  return typeof v === "string" && (ALMANYA_DURUM_VALUES as string[]).includes(v);
}

export function isUniqueViolation(err: { code?: string; message?: string }) {
  return err.code === "23505" || String(err.message || "").includes("duplicate key");
}
