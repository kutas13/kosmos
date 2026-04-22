-- Almanya pasaport takip tablosu (idata.com.tr sorgulari icin)
-- Supabase SQL Editor'da 003'ten sonra calistirin.

CREATE TABLE IF NOT EXISTS public.almanya_pasaport (
  id           int PRIMARY KEY,
  ad_soyad     text NOT NULL,
  pasaport_no  text NOT NULL,
  barkod_no    text NOT NULL,
  cikti        boolean NOT NULL DEFAULT false,
  cikti_at     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT almanya_pasaport_id_range CHECK (id >= 1 AND id <= 999)
);

CREATE INDEX IF NOT EXISTS almanya_pasaport_ad_idx
  ON public.almanya_pasaport (lower(ad_soyad));

CREATE INDEX IF NOT EXISTS almanya_pasaport_pasaport_idx
  ON public.almanya_pasaport (pasaport_no);

ALTER TABLE public.almanya_pasaport ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "almanya_pasaport_allow_all" ON public.almanya_pasaport;
CREATE POLICY "almanya_pasaport_allow_all"
  ON public.almanya_pasaport
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Rastgele 1-999 ID ile insert (esanli guvenli)
CREATE OR REPLACE FUNCTION public.insert_almanya_random(
  p_ad_soyad    text,
  p_pasaport_no text,
  p_barkod_no   text
)
RETURNS public.almanya_pasaport
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cand int;
  attempts int := 0;
  rec public.almanya_pasaport;
BEGIN
  IF EXISTS (SELECT 1 FROM public.almanya_pasaport WHERE pasaport_no = trim(p_pasaport_no)) THEN
    RAISE EXCEPTION 'duplicate_pasaport'
      USING ERRCODE = '23505',
            MESSAGE = 'duplicate_pasaport';
  END IF;

  IF (SELECT count(*)::int FROM public.almanya_pasaport) >= 999 THEN
    RAISE EXCEPTION 'capacity_full'
      USING ERRCODE = 'P0001',
            MESSAGE = 'En fazla 999 Almanya pasaport kaydi olusturulabilir.';
  END IF;

  LOOP
    attempts := attempts + 1;
    IF attempts > 800 THEN
      RAISE EXCEPTION 'id_allocate_failed'
        USING ERRCODE = 'P0001',
              MESSAGE = 'Uygun ID atanamadi, tekrar deneyin.';
    END IF;

    cand := floor(random() * 999 + 1)::int;

    BEGIN
      INSERT INTO public.almanya_pasaport (id, ad_soyad, pasaport_no, barkod_no)
      VALUES (
        cand,
        trim(p_ad_soyad),
        trim(p_pasaport_no),
        trim(p_barkod_no)
      )
      RETURNING * INTO rec;
      RETURN rec;
    EXCEPTION
      WHEN unique_violation THEN
        IF EXISTS (SELECT 1 FROM public.almanya_pasaport WHERE pasaport_no = trim(p_pasaport_no)) THEN
          RAISE EXCEPTION 'duplicate_pasaport'
            USING ERRCODE = '23505',
                  MESSAGE = 'duplicate_pasaport';
        END IF;
        NULL;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_almanya_random(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_almanya_random(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_almanya_random(text, text, text) TO anon, authenticated;
