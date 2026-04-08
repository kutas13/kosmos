-- Supabase SQL Editor'da çalıştırın (veya CLI migration).

create table if not exists public.musteriler (
  id bigint generated always as identity primary key,
  ad text not null,
  soyad text not null,
  tc text not null,
  dogum_tarihi text not null,
  telefon text not null default '',
  created_at timestamptz not null default now(),
  constraint musteriler_tc_key unique (tc)
);

create index if not exists musteriler_ad_soyad_idx on public.musteriler (lower(ad), lower(soyad));

alter table public.musteriler enable row level security;

drop policy if exists "musteriler_allow_all" on public.musteriler;

-- Next.js API yalnızca sunucuda Supabase anahtarı kullanır; yine de RLS açık kalsın.
-- Service role anahtarı bu politikaları bypass eder.
-- Sadece anon/publishable kullanıyorsanız aşağıdaki policy şarttır:
create policy "musteriler_allow_all"
  on public.musteriler
  for all
  to anon, authenticated
  using (true)
  with check (true);
