-- 0086_polar_columns.sql
-- Polar 결제 연동용 컬럼 추가
-- paddle_customer_id / paddle_subscription_id 는 기존 데이터 보존을 위해 유지
--
-- 적용 방법: Supabase 대시보드 → SQL Editor 에서 직접 실행
-- (supabase db push 사용 시 자동 적용)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS polar_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;

COMMENT ON COLUMN public.users.polar_customer_id     IS 'Polar 고객 ID (subscription.active 웹훅에서 저장)';
COMMENT ON COLUMN public.users.polar_subscription_id IS 'Polar 구독 ID (subscription.active 웹훅에서 저장)';
