-- =============================================================
-- 0011 — Lemon Squeezy 결제 연동 필드
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 배경:
--   Lemon Squeezy 체크아웃 → webhook(order_created) 수신 후 users 테이블에
--   고객·구독·주문 ID 를 저장해 이후 구독 취소·결제 실패 webhook 시 유저를
--   역추적할 수 있게 한다.
--
-- 주의:
--   custom_data.user_id 가 모든 LMS webhook 페이로드에 보존되므로
--   user_id lookup 은 custom_data 우선, 백업으로 lms_customer_id 매칭.
-- =============================================================

alter table public.users
  add column if not exists lms_customer_id text,
  add column if not exists lms_subscription_id text,
  add column if not exists lms_order_id text;

-- subscription_cancelled 등 webhook 에서 lms_subscription_id 로 유저 조회
create index if not exists idx_users_lms_subscription
  on public.users(lms_subscription_id)
  where lms_subscription_id is not null;
