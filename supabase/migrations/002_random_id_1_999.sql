-- Rastgele müşteri ID (1-999), eşzamanlı güvenli atama.
-- Supabase SQL Editor'da çalıştırın (001'den sonra).

-- Mevcut tabloda id > 999 kayıt varsa önce düzeltin veya bu CHECK'i eklemeyin.
ALTER TABLE public.musteriler ALTER COLUMN id DROP IDENTITY IF EXISTS;

ALTER TABLE public.musteriler DROP CONSTRAINT IF EXISTS musteriler_id_range;
ALTER TABLE public.musteriler
  ADD CONSTRAINT musteriler_id_range CHECK (id >= 1 AND id <= 999);

CREATE OR REPLACE FUNCTION public.insert_musteri_random(
  p_ad text,
  p_soyad text,
  p_tc text,
  p_dogum_tarihi text,
  p_telefon text DEFAULT ''
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

  LOOP
    attempts := attempts + 1;
    IF attempts > 800 THEN
      RAISE EXCEPTION 'id_allocate_failed'
        USING ERRCODE = 'P0001',
              MESSAGE = 'Uygun ID atanamadı, tekrar deneyin.';
    END IF;

    cand := floor(random() * 999 + 1)::int;

    BEGIN
      INSERT INTO public.musteriler (id, ad, soyad, tc, dogum_tarihi, telefon)
      VALUES (
        cand,
        trim(p_ad),
        trim(p_soyad),
        trim(p_tc),
        trim(p_dogum_tarihi),
        trim(COALESCE(p_telefon, ''))
      )
      RETURNING * INTO rec;
      RETURN rec;
    EXCEPTION
      WHEN unique_violation THEN
        -- TC yarışı: başka oturum aynı TC'yi önce yazdı
        IF EXISTS (SELECT 1 FROM public.musteriler WHERE tc = trim(p_tc)) THEN
          RAISE EXCEPTION 'duplicate_tc'
            USING ERRCODE = '23505',
                  MESSAGE = 'duplicate_tc';
        END IF;
        -- Sadece ID çakışması: yeni aday
        NULL;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_musteri_random(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_musteri_random(text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_musteri_random(text, text, text, text, text) TO anon, authenticated;
