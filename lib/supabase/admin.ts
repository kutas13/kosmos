import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/** Sunucu tarafı (Route Handlers) — tarayıcıya sızmamalı. */
export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();
  const anon =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const key = service || anon;
  if (!url || !key) {
    throw new Error(
      "Eksik: NEXT_PUBLIC_SUPABASE_URL ve (SUPABASE_SERVICE_ROLE_KEY | SUPABASE_SECRET_KEY | SUPABASE_ANON_KEY | SUPABASE_PUBLISHABLE_KEY)"
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
