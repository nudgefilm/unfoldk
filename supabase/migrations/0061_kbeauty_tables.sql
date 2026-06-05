-- =============================================================
-- UnfoldK Beauty B2B 플랫폼 전용 테이블 (6개)
-- 기존 UnfoldK 테이블 충돌 없음 확인 후 beauty_ 프리픽스 통일 적용
-- KBEAUTY.md §11 기준 | beauty_suppliers / beauty_buyers /
-- beauty_products / beauty_matches / beauty_trade_analytics /
-- beauty_post_matching_services
-- =============================================================

-- 1. beauty_suppliers (공급사) ----------------------------------
CREATE TABLE IF NOT EXISTS public.beauty_suppliers (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name_ko                 TEXT        NOT NULL,
  company_name_en                 TEXT        NOT NULL,
  business_registration_number    TEXT        UNIQUE NOT NULL,
  business_registration_verified  BOOLEAN     NOT NULL DEFAULT false,
  cosmetic_license_url            TEXT,
  cosmetic_license_verified       BOOLEAN     NOT NULL DEFAULT false,
  cosmetic_license_type           TEXT        CHECK (cosmetic_license_type IN ('manufacturer', 'responsible_seller')),
  buyer_db_access                 BOOLEAN     NOT NULL DEFAULT false,
  fda_registration_number         TEXT,
  categories                      TEXT[],
  moq                             INTEGER,
  price_range_min                 NUMERIC,
  price_range_max                 NUMERIC,
  lead_time_days                  INTEGER,
  export_countries                TEXT[],
  status                          TEXT        NOT NULL DEFAULT 'pre_registered'
                                              CHECK (status IN ('pre_registered', 'active', 'suspended')),
  source                          TEXT        NOT NULL DEFAULT 'direct_signup'
                                              CHECK (source IN ('fda_api', 'kcia', 'direct_signup')),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 2. beauty_buyers (바이어) -------------------------------------
CREATE TABLE IF NOT EXISTS public.beauty_buyers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name          TEXT        NOT NULL,
  country               TEXT        NOT NULL,
  website               TEXT        NOT NULL,
  business_email        TEXT        NOT NULL,
  ein_number            TEXT,
  business_doc_url      TEXT,
  categories            TEXT[],
  business_type         TEXT        CHECK (business_type IN ('importer', 'distributor', 'wholesaler', 'retailer', 'ecommerce', 'other')),
  annual_import_volume  TEXT        CHECK (annual_import_volume IN ('under_50k', '50k_500k', 'over_500k')),
  contact_verified      BOOLEAN     NOT NULL DEFAULT false,
  linkedin_verified     BOOLEAN     NOT NULL DEFAULT false,
  bounce_count          INTEGER     NOT NULL DEFAULT 0,
  stage1_approved       BOOLEAN     NOT NULL DEFAULT false,
  stage2_approved       BOOLEAN     NOT NULL DEFAULT false,
  status                TEXT        NOT NULL DEFAULT 'pre_registered'
                                    CHECK (status IN ('pre_registered', 'invited', 'active')),
  source                TEXT        NOT NULL DEFAULT 'direct_signup'
                                    CHECK (source IN ('importgenius', 'fda_api', 'direct_signup')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 3. beauty_products (제품) -------------------------------------
CREATE TABLE IF NOT EXISTS public.beauty_products (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id             UUID        NOT NULL REFERENCES public.beauty_suppliers(id) ON DELETE CASCADE,
  product_name_ko         TEXT        NOT NULL,
  product_name_en         TEXT        NOT NULL,
  brand_name              TEXT        NOT NULL,
  category                TEXT        NOT NULL
                                      CHECK (category IN ('skincare', 'makeup', 'haircare', 'suncare', 'derma')),
  certifications          TEXT[],
  fda_registration_number TEXT,
  moq                     INTEGER,
  price_range_min         NUMERIC,
  price_range_max         NUMERIC,
  lead_time_days          INTEGER,
  export_countries        TEXT[],
  images                  JSONB,      -- [{url, alt}]
  status                  TEXT        NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'inactive')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 4. beauty_matches (매칭) --------------------------------------
CREATE TABLE IF NOT EXISTS public.beauty_matches (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  UUID        NOT NULL REFERENCES public.beauty_suppliers(id) ON DELETE CASCADE,
  buyer_id     UUID        NOT NULL REFERENCES public.beauty_buyers(id) ON DELETE CASCADE,
  product_id   UUID        REFERENCES public.beauty_products(id) ON DELETE SET NULL,
  message      TEXT,
  status       TEXT        NOT NULL DEFAULT 'requested'
                           CHECK (status IN ('requested', 'stage2_pending', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at  TIMESTAMPTZ
);


-- 5. beauty_trade_analytics (Trade Analytics Engine 결과) -------
CREATE TABLE IF NOT EXISTS public.beauty_trade_analytics (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type    TEXT        NOT NULL
                             CHECK (report_type IN ('trend_velocity', 'spec_filter', 'hallyu_correlation', 'monthly_summary')),
  hs_code        TEXT,
  period         TEXT        NOT NULL,
  raw_data       JSONB,
  computed_score NUMERIC,
  insight_text   TEXT,       -- Claude Haiku 생성 인사이트 문장
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 6. beauty_post_matching_services (Post-Matching 서비스) -------
CREATE TABLE IF NOT EXISTS public.beauty_post_matching_services (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID        NOT NULL REFERENCES public.beauty_matches(id) ON DELETE CASCADE,
  service_type TEXT        NOT NULL
                           CHECK (service_type IN ('contract_template_download', 'logistics_referral', 'insight_report')),
  status       TEXT        NOT NULL DEFAULT 'completed'
                           CHECK (status IN ('pending', 'completed', 'failed')),
  affiliate_fee NUMERIC,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 인덱스 --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_beauty_suppliers_user   ON public.beauty_suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_beauty_suppliers_status ON public.beauty_suppliers(status);
CREATE INDEX IF NOT EXISTS idx_beauty_buyers_user      ON public.beauty_buyers(user_id);
CREATE INDEX IF NOT EXISTS idx_beauty_buyers_status    ON public.beauty_buyers(status);
CREATE INDEX IF NOT EXISTS idx_beauty_products_supplier ON public.beauty_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_beauty_products_category ON public.beauty_products(category);
CREATE INDEX IF NOT EXISTS idx_beauty_matches_supplier ON public.beauty_matches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_beauty_matches_buyer    ON public.beauty_matches(buyer_id);
CREATE INDEX IF NOT EXISTS idx_beauty_matches_status   ON public.beauty_matches(status);
CREATE INDEX IF NOT EXISTS idx_beauty_analytics_type   ON public.beauty_trade_analytics(report_type);
CREATE INDEX IF NOT EXISTS idx_beauty_analytics_period ON public.beauty_trade_analytics(period);


-- RLS 활성화 ----------------------------------------------------
ALTER TABLE public.beauty_suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beauty_buyers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beauty_products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beauty_matches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beauty_trade_analytics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beauty_post_matching_services ENABLE ROW LEVEL SECURITY;


-- GRANT ---------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.beauty_suppliers              TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.beauty_buyers                 TO authenticated;
GRANT SELECT                 ON public.beauty_products               TO authenticated;
GRANT SELECT, INSERT         ON public.beauty_matches                TO authenticated;
GRANT SELECT                 ON public.beauty_trade_analytics        TO authenticated;
GRANT SELECT                 ON public.beauty_post_matching_services TO authenticated;

GRANT ALL ON public.beauty_suppliers              TO service_role;
GRANT ALL ON public.beauty_buyers                 TO service_role;
GRANT ALL ON public.beauty_products               TO service_role;
GRANT ALL ON public.beauty_matches                TO service_role;
GRANT ALL ON public.beauty_trade_analytics        TO service_role;
GRANT ALL ON public.beauty_post_matching_services TO service_role;


-- RLS 정책 ------------------------------------------------------

-- beauty_suppliers: 본인 CRUD
DROP POLICY IF EXISTS "beauty_suppliers_select_own"  ON public.beauty_suppliers;
DROP POLICY IF EXISTS "beauty_suppliers_insert_own"  ON public.beauty_suppliers;
DROP POLICY IF EXISTS "beauty_suppliers_update_own"  ON public.beauty_suppliers;

CREATE POLICY "beauty_suppliers_select_own" ON public.beauty_suppliers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "beauty_suppliers_insert_own" ON public.beauty_suppliers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "beauty_suppliers_update_own" ON public.beauty_suppliers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);


-- beauty_buyers: 본인 CRUD
DROP POLICY IF EXISTS "beauty_buyers_select_own" ON public.beauty_buyers;
DROP POLICY IF EXISTS "beauty_buyers_insert_own" ON public.beauty_buyers;
DROP POLICY IF EXISTS "beauty_buyers_update_own" ON public.beauty_buyers;

CREATE POLICY "beauty_buyers_select_own" ON public.beauty_buyers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "beauty_buyers_insert_own" ON public.beauty_buyers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "beauty_buyers_update_own" ON public.beauty_buyers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);


-- beauty_products: 공급사 본인 관리 / stage1 승인 바이어 조회
DROP POLICY IF EXISTS "beauty_products_supplier_all"   ON public.beauty_products;
DROP POLICY IF EXISTS "beauty_products_buyer_select"   ON public.beauty_products;

CREATE POLICY "beauty_products_supplier_all" ON public.beauty_products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.beauty_suppliers s
      WHERE s.id = supplier_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "beauty_products_buyer_select" ON public.beauty_products
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.beauty_buyers b
      WHERE b.user_id = auth.uid() AND b.stage1_approved = true
    )
  );


-- beauty_matches: 당사자(공급사/바이어) 조회 / stage1 바이어 요청
DROP POLICY IF EXISTS "beauty_matches_own"          ON public.beauty_matches;
DROP POLICY IF EXISTS "beauty_matches_buyer_insert" ON public.beauty_matches;

CREATE POLICY "beauty_matches_own" ON public.beauty_matches
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.beauty_suppliers s WHERE s.id = supplier_id AND s.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.beauty_buyers    b WHERE b.id = buyer_id    AND b.user_id = auth.uid())
  );

CREATE POLICY "beauty_matches_buyer_insert" ON public.beauty_matches
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.beauty_buyers b
      WHERE b.id = buyer_id AND b.user_id = auth.uid() AND b.stage1_approved = true
    )
  );


-- beauty_trade_analytics: 국세청 인증 공급사 or stage1 바이어 조회
DROP POLICY IF EXISTS "beauty_trade_analytics_select" ON public.beauty_trade_analytics;

CREATE POLICY "beauty_trade_analytics_select" ON public.beauty_trade_analytics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.beauty_suppliers s
      WHERE s.user_id = auth.uid() AND s.business_registration_verified = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.beauty_buyers b
      WHERE b.user_id = auth.uid() AND b.stage1_approved = true
    )
  );


-- beauty_post_matching_services: 해당 매칭 당사자만 조회
DROP POLICY IF EXISTS "beauty_post_matching_own" ON public.beauty_post_matching_services;

CREATE POLICY "beauty_post_matching_own" ON public.beauty_post_matching_services
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.beauty_matches m
      JOIN public.beauty_suppliers s ON s.id = m.supplier_id
      WHERE m.id = match_id AND s.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.beauty_matches m
      JOIN public.beauty_buyers b ON b.id = m.buyer_id
      WHERE m.id = match_id AND b.user_id = auth.uid()
    )
  );
