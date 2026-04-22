import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { corsEmpty, corsJson } from "@/lib/cors";
import { isValidAlmanyaId, parseAlmanyaBody } from "@/lib/almanya";

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

    // Ozel endpoint benzeri: sadece cikti isaretle
    if (raw && typeof raw === "object" && "cikti" in (raw as object)) {
      const body = raw as { cikti?: boolean };
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("almanya_pasaport")
        .update({
          cikti: Boolean(body.cikti),
          cikti_at: body.cikti ? new Date().toISOString() : null,
        })
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
