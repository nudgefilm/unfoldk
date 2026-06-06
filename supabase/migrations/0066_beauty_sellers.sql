-- beauty_sellers 테이블: 해외 셀러 (Amazon / Shopify / TikTok Shop)
-- seller_type TEXT[] — 복수 채널 선택 가능
-- 실제 Supabase에는 이미 적용 완료 (2026-06-06)

CREATE TABLE IF NOT EXISTS beauty_sellers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name         TEXT NOT NULL,
  business_email       TEXT,
  seller_type          TEXT[] NOT NULL,
  marketplace_url      TEXT,
  instagram_handle     TEXT,
  linkedin_url         TEXT,
  country              TEXT,
  state                TEXT,
  zip_code             TEXT,
  categories           TEXT[],
  annual_sales_volume  TEXT,
  contact_verified     BOOLEAN DEFAULT false,
  bounce_count         INTEGER DEFAULT 0,
  status               TEXT DEFAULT 'active',
  source               TEXT DEFAULT 'direct_signup',
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE beauty_sellers ENABLE ROW LEVEL SECURITY;

-- 본인 레코드만 조회
CREATE POLICY "beauty_sellers_select_own"
  ON beauty_sellers FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 레코드만 수정
CREATE POLICY "beauty_sellers_update_own"
  ON beauty_sellers FOR UPDATE
  USING (auth.uid() = user_id);

-- 가입 시 INSERT (anon 포함 — signup API가 서버사이드에서 세션 확보 후 호출)
CREATE POLICY "beauty_sellers_insert_anon"
  ON beauty_sellers FOR INSERT
  WITH CHECK (true);

-- 인증된 사용자 INSERT (세션 기반 직접 삽입)
GRANT INSERT ON beauty_sellers TO authenticated;
GRANT SELECT ON beauty_sellers TO authenticated;
GRANT UPDATE ON beauty_sellers TO authenticated;
