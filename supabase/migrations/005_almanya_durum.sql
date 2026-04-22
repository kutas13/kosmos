-- Almanya pasaport takip icin sorgu durumu.
-- 'beklemede' = henuz sorgulanmadi
-- 'islemde'   = idata.com.tr: "Basvuru dosyaniz ilgili Elciliğe/Konsoloslugga gönderilmis, islem sureci baslamistir."
-- 'cikmis'    = pasaport hazir / teslim alinabilir
-- 'hata'      = "Sistemimizde boyle bir pasaport tanimli degil."

ALTER TABLE public.almanya_pasaport
  ADD COLUMN IF NOT EXISTS durum text NOT NULL DEFAULT 'beklemede';

ALTER TABLE public.almanya_pasaport
  ADD COLUMN IF NOT EXISTS son_mesaj text;

ALTER TABLE public.almanya_pasaport
  ADD COLUMN IF NOT EXISTS sorgu_at timestamptz;

ALTER TABLE public.almanya_pasaport
  DROP CONSTRAINT IF EXISTS almanya_pasaport_durum_chk;

ALTER TABLE public.almanya_pasaport
  ADD CONSTRAINT almanya_pasaport_durum_chk
  CHECK (durum IN ('beklemede', 'islemde', 'cikmis', 'hata'));

-- cikti alani artik durum = 'cikmis' ile senkron. Mevcut kayitlari senkronla:
UPDATE public.almanya_pasaport
  SET durum = 'cikmis'
  WHERE cikti = true AND durum = 'beklemede';
