-- Musterilere olusturma zamani ekle (siralama icin).
-- Supabase SQL Editor'da calistirin.

ALTER TABLE public.musteriler
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
