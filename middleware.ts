import { NextRequest, NextResponse } from "next/server";

/**
 * Siteyi ve API'yi giris duvari arkasina alir.
 * - Cookie yoksa /login'e yonlendir.
 * - /api/* icin ek olarak x-api-key header'i da kabul et (eklenti icin).
 * - /login, /api/auth/*, /robots.txt, /favicon.ico serbest.
 * - OPTIONS (CORS preflight) her zaman serbest.
 */

const AUTH_COOKIE = "fx-auth";
const API_KEY_HEADER = "x-api-key";
const DEFAULT_SESSION_TOKEN = "foxvize-session-2026-internal-do-not-share";
const DEFAULT_API_KEY = "foxvize-api-2026-internal-do-not-share";

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/robots.txt",
  "/favicon.ico",
]);

function isCookieValid(req: NextRequest): boolean {
  const c = req.cookies.get(AUTH_COOKIE)?.value;
  if (!c) return false;
  const expected = process.env.SITE_SESSION_TOKEN || DEFAULT_SESSION_TOKEN;
  return c === expected;
}

function isApiKeyValid(req: NextRequest): boolean {
  const key = req.headers.get(API_KEY_HEADER);
  if (!key) return false;
  const expected = process.env.SITE_API_KEY || DEFAULT_API_KEY;
  return key === expected;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Next internals ve public assets serbest
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Beyaz liste
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // CORS preflight her zaman serbest — API route'lari OPTIONS'a 204 doner
  if (req.method === "OPTIONS") return NextResponse.next();

  // API rotalari: cookie VEYA x-api-key
  if (pathname.startsWith("/api/")) {
    if (isCookieValid(req) || isApiKeyValid(req)) {
      return NextResponse.next();
    }
    return NextResponse.json(
      { detail: "Yetkisiz. Giris yapin veya gecerli x-api-key gonderin." },
      { status: 401 }
    );
  }

  // Diger sayfalar: sadece cookie
  if (isCookieValid(req)) return NextResponse.next();

  // Cookie yok -> /login'e yonlendir, hedefi query'ye koy
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  const nextPath = pathname === "/login" ? "/" : pathname + (req.nextUrl.search || "");
  url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url);
}

export const config = {
  // _next ve favicon disinda her yolda calis
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
