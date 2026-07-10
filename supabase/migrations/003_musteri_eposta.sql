-- 003: Yunan musteri kaydina e-posta alani ekle.
-- Supabase SQL Editor'da 001 ve 002'den sonra calistirin.

-- 1) Kolonu ekle (varsa dokunma). Default vize@foxturizm.com.
ALTER TABLE public.musteriler
  ADD COLUMN IF NOT EXISTS eposta text NOT NULL DEFAULT 'vize@foxturizm.com';

-- 2) Mevcut bos/NULL kayitlari default'a cek (paranoyaklık).
UPDATE public.musteriler
  SET eposta = 'vize@foxturizm.com'
  WHERE eposta IS NULL OR btrim(eposta) = '';

-- 3) insert_musteri_random RPC'yi p_eposta parametresi ile yeniden olustur.
--    Eski (5 parametreli) imzayi kaldiriyoruz ki cakisma olmasin.
DROP FUNCTION IF EXISTS public.insert_musteri_random(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.insert_musteri_random(
  p_ad text,
  p_soyad text,
  p_tc text,
  p_dogum_tarihi text,
  p_telefon text DEFAULT '',
  p_eposta text DEFAULT 'vize@foxturizm.com'
)
RETURNS public.musteriler
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cand int;
  attempts int := 0;
  rec public.musteriler;
  v_eposta text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.musteriler WHERE tc = trim(p_tc)) THEN
    RAISE EXCEPTION 'duplicate_tc'
      USING ERRCODE = '23505',
            MESSAGE = 'duplicate_tc';
  END IF;

  IF (SELECT count(*)::int FROM public.musteriler) >= 999 THEN
    RAISE EXCEPTION 'capacity_full'
      USING ERRCODE = 'P0001',
            MESSAGE = 'En fazla 999 müşteri kaydı oluşturulabilir.';
  END IF;

  v_eposta := NULLIF(btrim(COALESCE(p_eposta, '')), '');
  IF v_eposta IS NULL THEN
    v_eposta := 'vize@foxturizm.com';
  END IF;

  LOOP
    attempts := attempts + 1;
    IF attempts > 800 THEN
      RAISE EXCEPTION 'id_allocate_failed'
        USING ERRCODE = 'P0001',
              MESSAGE = 'Uygun ID atanamadı, tekrar deneyin.';
    END IF;

    cand := floor(random() * 999 + 1)::int;

    BEGIN
      INSERT INTO public.musteriler (id, ad, soyad, tc, dogum_tarihi, telefon, eposta)
      VALUES (
        cand,
        trim(p_ad),
        trim(p_soyad),
        trim(p_tc),
        trim(p_dogum_tarihi),
        trim(COALESCE(p_telefon, '')),
        v_eposta
      )
      RETURNING * INTO rec;
      RETURN rec;
    EXCEPTION
      WHEN unique_violation THEN
        IF EXISTS (SELECT 1 FROM public.musteriler WHERE tc = trim(p_tc)) THEN
          RAISE EXCEPTION 'duplicate_tc'
            USING ERRCODE = '23505',
                  MESSAGE = 'duplicate_tc';
        END IF;
        NULL;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_musteri_random(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_musteri_random(text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_musteri_random(text, text, text, text, text, text) TO anon, authenticated;
