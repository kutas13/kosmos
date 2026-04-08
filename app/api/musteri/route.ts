import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { corsEmpty, corsJson } from "@/lib/cors";
import { parseBody, type Musteri } from "@/lib/musteri";
import { NextRequest } from "next/server";

export async function OPTIONS() {
  return corsEmpty();
}

/** GET /api/musteri?q=... */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    let query = supabase.from("musteriler").select("*").order("created_at", { ascending: true });
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

/** POST /api/musteri — ID: 1-999 arası rastgele, DB fonksiyonu ile eşzamanlı güvenli */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => null);
    const fields = parseBody(raw);
    if (!fields) {
      return corsJson({ detail: "Geçersiz veya eksik alanlar" }, 422);
    }
    const supabase = getSupabaseAdmin();

    // Telefon tekrar kontrolu (bos degilse)
    if (fields.telefon) {
      const { data: phoneDup } = await supabase
        .from("musteriler")
        .select("id,ad,soyad")
        .eq("telefon", fields.telefon)
        .maybeSingle();
      if (phoneDup) {
        const p = phoneDup as { id: number; ad: string; soyad: string };
        return corsJson(
          { detail: `Bu telefon (${fields.telefon}) zaten #${p.id} numaralı müşteride kayıtlı: ${p.ad} ${p.soyad}` },
          409
        );
      }
    }

    const { data, error } = await supabase.rpc("insert_musteri_random", {
      p_ad: fields.ad,
      p_soyad: fields.soyad,
      p_tc: fields.tc,
      p_dogum_tarihi: fields.dogum_tarihi,
      p_telefon: fields.telefon,
    });

    if (error) {
      const code = error.code;
      const msg = String(error.message || "");
      if (code === "23505" || msg.includes("duplicate_tc")) {
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
      if (code === "P0001" || msg.includes("capacity_full") || msg.includes("999 müşteri")) {
        return corsJson(
          { detail: "En fazla 999 müşteri kaydı oluşturulabilir." },
          503
        );
      }
      if (msg.includes("id_allocate_failed") || msg.includes("Uygun ID")) {
        return corsJson({ detail: "Şu an ID atanamadı, birkaç saniye sonra tekrar deneyin." }, 503);
      }
      if (msg.includes("insert_musteri_random") || msg.includes("function") || code === "42883") {
        return corsJson(
          {
            detail:
              "Sunucu henüz güncellenmedi. Supabase SQL Editor'da supabase/migrations/002_random_id_1_999.sql dosyasını çalıştırın.",
          },
          503
        );
      }
      return corsJson({ detail: error.message }, 500);
    }

    const row = (Array.isArray(data) ? data[0] : data) as Musteri | undefined;
    if (!row?.id) {
      return corsJson({ detail: "Kayıt oluşturulamadı" }, 500);
    }
    return corsJson(row, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return corsJson({ detail: msg }, 500);
  }
}
