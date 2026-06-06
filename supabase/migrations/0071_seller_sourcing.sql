-- ────────────────────────────────────────────────────────────────────────────
-- 0071_seller_sourcing.sql
-- 셀러 소싱 인프라 + beauty_sellers 컬럼 추가
-- ────────────────────────────────────────────────────────────────────────────

-- 1. beauty_sellers: 누락 컬럼 추가
ALTER TABLE public.beauty_sellers
  ADD COLUMN IF NOT EXISTS platform_urls JSONB;

ALTER TABLE public.beauty_sellers
  ADD COLUMN IF NOT EXISTS target_countries TEXT[];

-- 2. beauty_post_matching_services: buyer_id nullable + seller_id 추가
--    (셀러 샘플 요청 시 buyer_id 불필요)
ALTER TABLE public.beauty_post_matching_services
  ALTER COLUMN buyer_id DROP NOT NULL;

ALTER TABLE public.beauty_post_matching_services
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.beauty_sellers(id);

-- seller SELECT 정책
DROP POLICY IF EXISTS "beauty_post_matching_seller_select" ON public.beauty_post_matching_services;
CREATE POLICY "beauty_post_matching_seller_select" ON public.beauty_post_matching_services
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.beauty_sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
  );

-- seller INSERT 정책
DROP POLICY IF EXISTS "beauty_post_matching_seller_insert" ON public.beauty_post_matching_services;
CREATE POLICY "beauty_post_matching_seller_insert" ON public.beauty_post_matching_services
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.beauty_sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
  );

-- 3. beauty_seller_sourcing: 셀러 소싱 요청 테이블 (seller ↔ supplier)
CREATE TABLE IF NOT EXISTS public.beauty_seller_sourcing (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    UUID        NOT NULL REFERENCES public.beauty_sellers(id)  ON DELETE CASCADE,
  supplier_id  UUID        NOT NULL REFERENCES public.beauty_suppliers(id) ON DELETE CASCADE,
  product_id   UUID        REFERENCES public.beauty_products(id),
  initiated_by TEXT        NOT NULL DEFAULT 'seller'
               CHECK (initiated_by IN ('seller', 'supplier')),
  status       TEXT        NOT NULL DEFAULT 'requested'
               CHECK (status IN ('requested', 'approved', 'rejected', 'completed')),
  message      TEXT,
  requested_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.beauty_seller_sourcing ENABLE ROW LEVEL SECURITY;

-- seller: 본인 소싱 요청 SELECT
DROP POLICY IF EXISTS "beauty_seller_sourcing_seller_select" ON public.beauty_seller_sourcing;
CREATE POLICY "beauty_seller_sourcing_seller_select" ON public.beauty_seller_sourcing
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.beauty_sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
  );

-- supplier: 자신에게 들어온 소싱 요청 SELECT (본인이 개시한 요청 포함)
DROP POLICY IF EXISTS "beauty_seller_sourcing_supplier_select" ON public.beauty_seller_sourcing;
CREATE POLICY "beauty_seller_sourcing_supplier_select" ON public.beauty_seller_sourcing
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.beauty_suppliers s WHERE s.id = supplier_id AND s.user_id = auth.uid())
  );

-- seller INSERT (본인 소싱 요청)
DROP POLICY IF EXISTS "beauty_seller_sourcing_seller_insert" ON public.beauty_seller_sourcing;
CREATE POLICY "beauty_seller_sourcing_seller_insert" ON public.beauty_seller_sourcing
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.beauty_sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
  );

-- supplier INSERT (공급사 → 셀러 컨택)
DROP POLICY IF EXISTS "beauty_seller_sourcing_supplier_insert" ON public.beauty_seller_sourcing;
CREATE POLICY "beauty_seller_sourcing_supplier_insert" ON public.beauty_seller_sourcing
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.beauty_suppliers s WHERE s.id = supplier_id AND s.user_id = auth.uid())
  );

GRANT SELECT, INSERT ON public.beauty_seller_sourcing TO authenticated;

-- 4. beauty_sellers: 공급사 → 전체 셀러 탐색 SELECT 정책
--    (buyer_db_access=true 인 공급사만 허용)
DROP POLICY IF EXISTS "beauty_sellers_supplier_view" ON public.beauty_sellers;
CREATE POLICY "beauty_sellers_supplier_view" ON public.beauty_sellers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.beauty_suppliers s
      WHERE s.user_id = auth.uid() AND s.buyer_db_access = true
    )
  );

-- 5. beauty_products / beauty_suppliers: 셀러 탐색용 SELECT 정책
DROP POLICY IF EXISTS "beauty_products_seller_select" ON public.beauty_products;
CREATE POLICY "beauty_products_seller_select" ON public.beauty_products
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND EXISTS (SELECT 1 FROM public.beauty_sellers s WHERE s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "beauty_suppliers_seller_select" ON public.beauty_suppliers;
CREATE POLICY "beauty_suppliers_seller_select" ON public.beauty_suppliers
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.beauty_sellers s WHERE s.user_id = auth.uid())
  );
