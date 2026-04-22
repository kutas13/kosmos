import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { corsEmpty, corsJson } from "@/lib/cors";
import { isValidAlmanyaId, isValidDurum, parseAlmanyaBody } from "@/lib/almanya";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS() {
  return corsEmpty();
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!isValidAlmanyaId(id)) {
      return corsJson({ detail: "Gecersiz ID (1-999 arasi olmali)" }, 400);
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("almanya_pasaport")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return corsJson({ detail: error.message }, 500);
    if (!data) return corsJson({ detail: "Kayit bulunamadi" }, 404);
    return corsJson(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatasi";
    return corsJson({ detail: msg }, 500);
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!isValidAlmanyaId(id)) {
      return corsJson({ detail: "Gecersiz ID" }, 400);
    }
    const raw = await req.json().catch(() => null);

    // Durum / cikti isaretleme (eklenti tarafindan cagrilir)
    if (
      raw &&
      typeof raw === "object" &&
      ("durum" in (raw as object) || "cikti" in (raw as object) || "son_mesaj" in (raw as object))
    ) {
      const body = raw as { durum?: unknown; cikti?: unknown; son_mesaj?: unknown };
      const patch: Record<string, unknown> = {};

      if ("durum" in body) {
        if (!isValidDurum(body.durum)) {
          return corsJson({ detail: "Gecersiz durum degeri" }, 422);
        }
        patch.durum = body.durum;
        // cikti alanini durum ile senkron tut
        patch.cikti = body.durum === "cikmis";
        patch.cikti_at = body.durum === "cikmis" ? new Date().toISOString() : null;
      } else if ("cikti" in body) {
        const c = Boolean(body.cikti);
        patch.cikti = c;
        patch.cikti_at = c ? new Date().toISOString() : null;
        if (c) patch.durum = "cikmis";
      }

      if ("son_mesaj" in body) {
        const m = body.son_mesaj;
        patch.son_mesaj = m == null ? null : String(m).slice(0, 500);
      }

      patch.sorgu_at = new Date().toISOString();

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("almanya_pasaport")
        .update(patch)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) return corsJson({ detail: error.message }, 500);
      if (!data) return corsJson({ detail: "Kayit bulunamadi" }, 404);
      return corsJson(data);
    }

    const fields = parseAlmanyaBody(raw);
    if (!fields) {
      return corsJson({ detail: "Gecersiz veya eksik alanlar" }, 422);
    }
    const supabase = getSupabaseAdmin();

    const { data: other } = await supabase
      .from("almanya_pasaport")
      .select("id,ad_soyad")
      .eq("pasaport_no", fields.pasaport_no)
      .neq("id", id)
      .maybeSingle();
    if (other) {
      const o = other as { id: number; ad_soyad: string };
      return corsJson(
        {
          detail: `Bu pasaport (${fields.pasaport_no}) zaten #${o.id} numarali kayitta: ${o.ad_soyad}`,
        },
        409
      );
    }

    const { data, error } = await supabase
      .from("almanya_pasaport")
      .update(fields)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return corsJson({ detail: error.message }, 500);
    if (!data) return corsJson({ detail: "Kayit bulunamadi" }, 404);
    return corsJson(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatasi";
    return corsJson({ detail: msg }, 500);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!isValidAlmanyaId(id)) {
      return corsJson({ detail: "Gecersiz ID" }, 400);
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("almanya_pasaport").delete().eq("id", id);
    if (error) return corsJson({ detail: error.message }, 500);
    return corsJson({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatasi";
    return corsJson({ detail: msg }, 500);
  }
}
