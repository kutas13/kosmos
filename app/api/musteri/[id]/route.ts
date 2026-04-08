import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { corsEmpty, corsJson } from "@/lib/cors";
import { isUniqueViolation, parseBody } from "@/lib/musteri";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS() {
  return corsEmpty();
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id < 1) {
      return corsJson({ detail: "Geçersiz ID" }, 400);
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("musteriler")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return corsJson({ detail: error.message }, 500);
    if (!data) return corsJson({ detail: "Müşteri bulunamadı" }, 404);
    return corsJson(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return corsJson({ detail: msg }, 500);
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id < 1) {
      return corsJson({ detail: "Geçersiz ID" }, 400);
    }
    const raw = await req.json().catch(() => null);
    const fields = parseBody(raw);
    if (!fields) {
      return corsJson({ detail: "Geçersiz veya eksik alanlar" }, 422);
    }
    const supabase = getSupabaseAdmin();

    const { data: other } = await supabase
      .from("musteriler")
      .select("id,ad,soyad")
      .eq("tc", fields.tc)
      .neq("id", id)
      .maybeSingle();
    if (other) {
      const o = other as { id: number; ad: string; soyad: string };
      return corsJson(
        {
          detail: `Bu TC (${fields.tc}) zaten #${o.id} numaralı müşteride kayıtlı: ${o.ad} ${o.soyad}`,
        },
        409
      );
    }

    const { data, error } = await supabase
      .from("musteriler")
      .update(fields)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) {
      if (isUniqueViolation(error)) {
        return corsJson({ detail: "Bu TC zaten başka kayıtta" }, 409);
      }
      return corsJson({ detail: error.message }, 500);
    }
    if (!data) return corsJson({ detail: "Müşteri bulunamadı" }, 404);
    return corsJson(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return corsJson({ detail: msg }, 500);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id < 1) {
      return corsJson({ detail: "Geçersiz ID" }, 400);
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("musteriler").delete().eq("id", id);
    if (error) return corsJson({ detail: error.message }, 500);
    return corsJson({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return corsJson({ detail: msg }, 500);
  }
}
