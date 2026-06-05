-- beauty_buyers: 바이어 가입 폼 저장 필드 추가 + anon INSERT 허용
-- 0061에서 누락된 컬럼 및 공개 신청 페이지 RLS 정책

ALTER TABLE public.beauty_buyers
  ADD COLUMN IF NOT EXISTS state                     TEXT,
  ADD COLUMN IF NOT EXISTS handling_korean_products  BOOLEAN,
  ADD COLUMN IF NOT EXISTS linkedin_url              TEXT,
  ADD COLUMN IF NOT EXISTS known_suppliers           TEXT;

-- status CHECK 에 'pending' 추가 (바이어 가입 후 관리자 승인 대기 상태)
ALTER TABLE public.beauty_buyers
  DROP CONSTRAINT IF EXISTS beauty_buyers_status_check;

ALTER TABLE public.beauty_buyers
  ADD CONSTRAINT beauty_buyers_status_check
    CHECK (status IN ('pre_registered', 'pending', 'invited', 'active'));

-- /kbeauty/buyer/register 는 공개 페이지 — anon 유저도 INSERT 가능
CREATE POLICY "바이어 신청 누구나 가능"
  ON public.beauty_buyers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
