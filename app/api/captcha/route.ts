import { corsEmpty, corsJson } from "@/lib/cors";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

// Tesseract worker'i lambda'nin yasam suresi boyunca yeniden kullan (cold start'ta bir kez).
type TessWorker = { recognize: (img: string | Buffer) => Promise<{ data: { text: string; confidence: number } }>; terminate: () => Promise<void>; setParameters?: (p: Record<string, unknown>) => Promise<void> };
let workerPromise: Promise<TessWorker> | null = null;

async function getWorker(): Promise<TessWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const base = process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
      const opts: Record<string, unknown> = {
        cacheMethod: "refresh",
        // Tesseract gercekte dil dosyasini indirecek; Vercel'da /tmp yazilabilir.
        cachePath: "/tmp",
      };
      if (base) {
        opts.langPath = `${base}/tessdata`;
      }
      const worker = (await createWorker("eng", 1, opts)) as unknown as TessWorker;
      if (typeof worker.setParameters === "function") {
        await worker.setParameters({
          tessedit_char_whitelist: "0123456789",
          // PSM 7 = single text line, 8 = single word, 10 = single char.
          // 4 haneli sabit sayisal captcha icin 7 ve 8 iyi sonuc veriyor.
          tessedit_pageseg_mode: "7",
          classify_bln_numeric_mode: "1",
        });
      }
      return worker;
    })();
  }
  return workerPromise;
}

/** Gelen data URL veya saf base64'ten buffer uretir. */
function parseImageInput(input: string): Buffer | null {
  try {
    const m = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(input.trim());
    const b64 = m ? m[1] : input.trim();
    const buf = Buffer.from(b64, "base64");
    if (buf.length < 100) return null; // cok kucuk, muhtemelen gecersiz
    return buf;
  } catch {
    return null;
  }
}

export async function OPTIONS() {
  return corsEmpty();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return corsJson({ detail: "JSON govde bekleniyor" }, 400);
    }
    const imgRaw = (body as { image?: unknown }).image;
    if (typeof imgRaw !== "string" || !imgRaw) {
      return corsJson({ detail: "image (base64 veya data URL) gerekli" }, 400);
    }
    const buf = parseImageInput(imgRaw);
    if (!buf) {
      return corsJson({ detail: "Gecersiz resim verisi" }, 422);
    }

    const worker = await getWorker();
    const { data } = await worker.recognize(buf);
    const raw = String(data?.text || "");
    const digitsOnly = raw.replace(/\D/g, "");
    // 4 haneli hedef; ama bazi durumlarda daha az/cok okuyabilir.
    let code = digitsOnly;
    if (digitsOnly.length >= 4) {
      code = digitsOnly.slice(0, 4);
    }
    return corsJson({
      code,
      length: code.length,
      confidence: Math.round(Number(data?.confidence || 0)),
      raw: raw.trim().slice(0, 40),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OCR hatasi";
    return corsJson({ detail: msg }, 500);
  }
}
