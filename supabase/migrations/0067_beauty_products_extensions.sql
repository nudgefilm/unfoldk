-- beauty_products 테이블 확장 + kbeauty-products Storage 버킷
-- 실제 Supabase에 적용 필요 (2026-06-06)

-- 1. 신규 컬럼 추가
ALTER TABLE public.beauty_products
  ADD COLUMN IF NOT EXISTS consumer_price_krw NUMERIC,
  ADD COLUMN IF NOT EXISTS description_ko     TEXT,
  ADD COLUMN IF NOT EXISTS description_en     TEXT;

-- 2. category CHECK 확장 (cleansing · body 추가)
ALTER TABLE public.beauty_products
  DROP CONSTRAINT IF EXISTS beauty_products_category_check;

ALTER TABLE public.beauty_products
  ADD CONSTRAINT beauty_products_category_check
  CHECK (category IN ('skincare', 'makeup', 'haircare', 'suncare', 'derma', 'cleansing', 'body'));

-- 3. status CHECK에 'pending' 추가
ALTER TABLE public.beauty_products
  DROP CONSTRAINT IF EXISTS beauty_products_status_check;

ALTER TABLE public.beauty_products
  ADD CONSTRAINT beauty_products_status_check
  CHECK (status IN ('active', 'inactive', 'pending'));

-- 4. status 기본값 'pending' 으로 변경 (신규 등록 시 관리자 승인 대기)
ALTER TABLE public.beauty_products
  ALTER COLUMN status SET DEFAULT 'pending';

-- 5. INSERT · UPDATE 권한 부여 (기존은 SELECT만 있음)
GRANT INSERT, UPDATE ON public.beauty_products TO authenticated;

-- 6. Supabase Storage 버킷 생성 (kbeauty-products, public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kbeauty-products',
  'kbeauty-products',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage RLS 정책 (CREATE POLICY IF NOT EXISTS 미지원 → DROP 후 CREATE)
DROP POLICY IF EXISTS "kbeauty_products_upload" ON storage.objects;
CREATE POLICY "kbeauty_products_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'kbeauty-products');

DROP POLICY IF EXISTS "kbeauty_products_read" ON storage.objects;
CREATE POLICY "kbeauty_products_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'kbeauty-products');

DROP POLICY IF EXISTS "kbeauty_products_update" ON storage.objects;
CREATE POLICY "kbeauty_products_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'kbeauty-products');
