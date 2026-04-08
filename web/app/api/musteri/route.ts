import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { corsEmpty, corsJson } from "@/lib/cors";
import { isUniqueViolation, parseBody, type Musteri } from "@/lib/musteri";
import { NextRequest } from "next/server";

export async function OPTIONS() {
  return corsEmpty();
}

/** GET /api/musteri?q=... */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    let query = supabase.from("musteriler").select("*").order("id", { ascending: true });
    if (q) {
      const safe = q.replace(/[,%()]/g, "").slice(0, 80);
      if (safe) {
        const needle = `%${safe}%`;
        query = query.or(
          `ad.ilike.${needle},soyad.ilike.${needle},tc.ilike.${needle}`
        );
      }
    }
    const { data, error } = await query;
    if (error) return corsJson({ detail: error.message }, 500);
    const rows = (data || []) as Musteri[];
    return corsJson({ musteriler: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return corsJson({ detail: msg }, 500);
  }
}

/** POST /api/musteri */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => null);
    const fields = parseBody(raw);
    if (!fields) {
      return corsJson({ detail: "Geçersiz veya eksik alanlar" }, 422);
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("musteriler")
      .insert(fields)
      .select()
      .single();
    if (error) {
      if (isUniqueViolation(error)) {
        const { data: existing } = await supabase
          .from("musteriler")
          .select("id,ad,soyad")
          .eq("tc", fields.tc)
          .maybeSingle();
        const ex = existing as { id: number; ad: string; soyad: string } | null;
        const detail = ex
          ? `Bu TC (${fields.tc}) zaten #${ex.id} numaralı müşteride kayıtlı: ${ex.ad} ${ex.soyad}`
          : "Bu TC zaten kayıtlı";
        return corsJson({ detail }, 409);
      }
      return corsJson({ detail: error.message }, 500);
    }
    return corsJson(data, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return corsJson({ detail: msg }, 500);
  }
}
