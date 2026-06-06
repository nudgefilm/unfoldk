-- beauty_matches: initiated_by 컬럼 추가 (공급사 발신 매칭 구분)
ALTER TABLE public.beauty_matches
  ADD COLUMN IF NOT EXISTS initiated_by TEXT DEFAULT 'buyer'
  CHECK (initiated_by IN ('buyer', 'supplier'));

-- beauty_buyers: 공급사 → 승인된 바이어 탐색용 SELECT 정책
-- (buyer_db_access=true 인 공급사만 stage1_approved 바이어 열람 가능)
DROP POLICY IF EXISTS "beauty_buyers_supplier_view" ON public.beauty_buyers;
CREATE POLICY "beauty_buyers_supplier_view" ON public.beauty_buyers
  FOR SELECT TO authenticated
  USING (
    stage1_approved = true
    AND EXISTS (
      SELECT 1 FROM public.beauty_suppliers s
      WHERE s.user_id = auth.uid() AND s.buyer_db_access = true
    )
  );

-- beauty_matches: 공급사 → 바이어 컨택 INSERT 정책
DROP POLICY IF EXISTS "beauty_matches_supplier_insert" ON public.beauty_matches;
CREATE POLICY "beauty_matches_supplier_insert" ON public.beauty_matches
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.beauty_suppliers s
      WHERE s.id = supplier_id AND s.user_id = auth.uid()
    )
  );
