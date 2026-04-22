import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { corsEmpty, corsJson } from "@/lib/cors";
import { parseAlmanyaBody, type AlmanyaPasaport } from "@/lib/almanya";
import { NextRequest } from "next/server";

export async function OPTIONS() {
  return corsEmpty();
}

/** GET /api/almanya?q=... */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    let query = supabase
      .from("almanya_pasaport")
      .select("*")
      .order("created_at", { ascending: true });
    if (q) {
      const safe = q.replace(/[,%()]/g, "").slice(0, 80);
      if (safe) {
        const needle = `%${safe}%`;
        query = query.or(
          `ad_soyad.ilike.${needle},pasaport_no.ilike.${needle},barkod_no.ilike.${needle}`
        );
      }
    }
    const { data, error } = await query;
    if (error) return corsJson({ detail: error.message }, 500);
    const rows = (data || []) as AlmanyaPasaport[];
    return corsJson({ kayitlar: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatasi";
    return corsJson({ detail: msg }, 500);
  }
}

/** POST /api/almanya */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => null);
    const fields = parseAlmanyaBody(raw);
    if (!fields) {
      return corsJson({ detail: "Gecersiz veya eksik alanlar" }, 422);
    }
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc("insert_almanya_random", {
      p_ad_soyad: fields.ad_soyad,
      p_pasaport_no: fields.pasaport_no,
      p_barkod_no: fields.barkod_no,
    });

    if (error) {
      const code = error.code;
      const msg = String(error.message || "");
      if (code === "23505" || msg.includes("duplicate_pasaport")) {
        const { data: existing } = await supabase
          .from("almanya_pasaport")
          .select("id,ad_soyad")
          .eq("pasaport_no", fields.pasaport_no)
          .maybeSingle();
        const ex = existing as { id: number; ad_soyad: string } | null;
        const detail = ex
          ? `Bu pasaport (${fields.pasaport_no}) zaten #${ex.id} numarali kayitta: ${ex.ad_soyad}`
          : "Bu pasaport zaten kayitli";
        return corsJson({ detail }, 409);
      }
      if (code === "P0001" || msg.includes("capacity_full")) {
        return corsJson(
          { detail: "En fazla 999 Almanya pasaport kaydi olusturulabilir." },
          503
        );
      }
      if (msg.includes("id_allocate_failed")) {
        return corsJson({ detail: "Su an ID atanamadi, birkac saniye sonra tekrar deneyin." }, 503);
      }
      if (msg.includes("insert_almanya_random") || msg.includes("function") || code === "42883") {
        return corsJson(
          {
            detail:
              "Sunucu henuz guncellenmedi. Supabase SQL Editor'da supabase/migrations/004_almanya_pasaport.sql dosyasini calistirin.",
          },
          503
        );
      }
      return corsJson({ detail: error.message }, 500);
    }

    const row = (Array.isArray(data) ? data[0] : data) as AlmanyaPasaport | undefined;
    if (!row?.id) {
      return corsJson({ detail: "Kayit olusturulamadi" }, 500);
    }
    return corsJson(row, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatasi";
    return corsJson({ detail: msg }, 500);
  }
}
