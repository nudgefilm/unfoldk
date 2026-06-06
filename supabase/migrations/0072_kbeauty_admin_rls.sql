-- ────────────────────────────────────────────────────────────────────────────
-- 0072_kbeauty_admin_rls.sql
-- 어드민 전체 KBeauty 테이블 조회·수정 RLS 정책
-- 기존 public.is_admin(uid uuid) 함수 (0006) 재사용
-- ────────────────────────────────────────────────────────────────────────────

-- ── GRANT UPDATE (어드민 토글 작업에 필요한 테이블) ──────────────────────────
GRANT UPDATE ON public.beauty_suppliers TO authenticated;
GRANT UPDATE ON public.beauty_buyers    TO authenticated;
GRANT UPDATE ON public.beauty_matches   TO authenticated;
GRANT UPDATE ON public.beauty_seller_sourcing TO authenticated;

-- ── beauty_suppliers ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "beauty_suppliers_admin_select" ON public.beauty_suppliers;
CREATE POLICY "beauty_suppliers_admin_select" ON public.beauty_suppliers
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "beauty_suppliers_admin_update" ON public.beauty_suppliers;
CREATE POLICY "beauty_suppliers_admin_update" ON public.beauty_suppliers
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── beauty_buyers ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "beauty_buyers_admin_select" ON public.beauty_buyers;
CREATE POLICY "beauty_buyers_admin_select" ON public.beauty_buyers
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "beauty_buyers_admin_update" ON public.beauty_buyers;
CREATE POLICY "beauty_buyers_admin_update" ON public.beauty_buyers
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── beauty_sellers ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "beauty_sellers_admin_select" ON public.beauty_sellers;
CREATE POLICY "beauty_sellers_admin_select" ON public.beauty_sellers
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "beauty_sellers_admin_update" ON public.beauty_sellers;
CREATE POLICY "beauty_sellers_admin_update" ON public.beauty_sellers
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── beauty_products ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "beauty_products_admin_select" ON public.beauty_products;
CREATE POLICY "beauty_products_admin_select" ON public.beauty_products
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "beauty_products_admin_update" ON public.beauty_products;
CREATE POLICY "beauty_products_admin_update" ON public.beauty_products
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── beauty_matches ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "beauty_matches_admin_select" ON public.beauty_matches;
CREATE POLICY "beauty_matches_admin_select" ON public.beauty_matches
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "beauty_matches_admin_update" ON public.beauty_matches;
CREATE POLICY "beauty_matches_admin_update" ON public.beauty_matches
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── beauty_post_matching_services ─────────────────────────────────────────────
DROP POLICY IF EXISTS "beauty_post_matching_admin_select" ON public.beauty_post_matching_services;
CREATE POLICY "beauty_post_matching_admin_select" ON public.beauty_post_matching_services
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "beauty_post_matching_admin_update" ON public.beauty_post_matching_services;
CREATE POLICY "beauty_post_matching_admin_update" ON public.beauty_post_matching_services
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ── beauty_seller_sourcing ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "beauty_seller_sourcing_admin_select" ON public.beauty_seller_sourcing;
CREATE POLICY "beauty_seller_sourcing_admin_select" ON public.beauty_seller_sourcing
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "beauty_seller_sourcing_admin_update" ON public.beauty_seller_sourcing;
CREATE POLICY "beauty_seller_sourcing_admin_update" ON public.beauty_seller_sourcing
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
