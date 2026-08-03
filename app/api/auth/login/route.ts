import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "fx-auth";
const DEFAULT_PASSWORD = "4750";
const DEFAULT_SESSION_TOKEN = "foxvize-session-2026-internal-do-not-share";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 gun

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, detail: "Gecersiz istek" }, { status: 400 });
  }
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const submitted = String(raw.password ?? "").trim();
  const expected = process.env.SITE_PASSWORD || DEFAULT_PASSWORD;

  if (!submitted) {
    return NextResponse.json({ ok: false, detail: "Sifre girin" }, { status: 400 });
  }
  if (submitted !== expected) {
    // Kaba brute force yavaslatmasi
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ ok: false, detail: "Sifre yanlis" }, { status: 401 });
  }

  const token = process.env.SITE_SESSION_TOKEN || DEFAULT_SESSION_TOKEN;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}
