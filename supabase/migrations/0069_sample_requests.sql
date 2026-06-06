-- beauty_post_matching_services: 샘플 요청 기능 확장
-- 1) service_type CHECK에 'sample' 추가
-- 2) status CHECK에 'approved', 'rejected' 추가
-- 3) match_id NOT NULL 해제 (샘플 요청은 match 없이 생성)
-- 4) buyer_email 컬럼 추가 (denormalized — 공급사 대시보드 표시용)
-- 5) RLS SELECT/INSERT/UPDATE 정책 재작성

-- ── 1. service_type CHECK ────────────────────────────────────────────────────
ALTER TABLE public.beauty_post_matching_services
  DROP CONSTRAINT IF EXISTS beauty_post_matching_services_service_type_check;

ALTER TABLE public.beauty_post_matching_services
  ADD CONSTRAINT beauty_post_matching_services_service_type_check
  CHECK (service_type IN ('contract_template_download', 'logistics_referral', 'insight_report', 'sample'));


-- ── 2. status CHECK ──────────────────────────────────────────────────────────
ALTER TABLE public.beauty_post_matching_services
  DROP CONSTRAINT IF EXISTS beauty_post_matching_services_status_check;

ALTER TABLE public.beauty_post_matching_services
  ADD CONSTRAINT beauty_post_matching_services_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'approved', 'rejected'));


-- ── 3. match_id NOT NULL 해제 ────────────────────────────────────────────────
ALTER TABLE public.beauty_post_matching_services
  ALTER COLUMN match_id DROP NOT NULL;


-- ── 4. buyer_email 컬럼 추가 ─────────────────────────────────────────────────
ALTER TABLE public.beauty_post_matching_services
  ADD COLUMN IF NOT EXISTS buyer_email TEXT;


-- ── 5. GRANT UPDATE (공급사 승인·거절) ──────────────────────────────────────
GRANT UPDATE ON public.beauty_post_matching_services TO authenticated;


-- ── 6. SELECT RLS: supplier_id / buyer_id 직접 접근 추가 ────────────────────
DROP POLICY IF EXISTS "beauty_post_matching_own" ON public.beauty_post_matching_services;
CREATE POLICY "beauty_post_matching_own" ON public.beauty_post_matching_services
  FOR SELECT TO authenticated
  USING (
    -- 기존: match_id 기반 당사자
    (match_id IS NOT NULL AND (
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
    ))
    -- 샘플 요청: buyer_id 직접 접근
    OR buyer_id = auth.uid()
    -- 샘플 요청: 공급사 supplier_id 직접 접근
    OR EXISTS (
      SELECT 1 FROM public.beauty_suppliers s
      WHERE s.id = supplier_id AND s.user_id = auth.uid()
    )
  );


-- ── 7. INSERT RLS: 바이어 샘플 요청 ──────────────────────────────────────────
DROP POLICY IF EXISTS "beauty_post_matching_buyer_insert" ON public.beauty_post_matching_services;
CREATE POLICY "beauty_post_matching_buyer_insert" ON public.beauty_post_matching_services
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.beauty_buyers b
      WHERE b.user_id = auth.uid() AND b.buyer_db_access = true
    )
  );


-- ── 8. UPDATE RLS: 공급사 샘플 요청 상태 변경 ───────────────────────────────
DROP POLICY IF EXISTS "beauty_post_matching_supplier_update" ON public.beauty_post_matching_services;
CREATE POLICY "beauty_post_matching_supplier_update" ON public.beauty_post_matching_services
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.beauty_suppliers s
      WHERE s.id = supplier_id AND s.user_id = auth.uid()
    )
  );
