-- ── Paddle 결제 연동 컬럼 추가 ──────────────────────────────────────────────
-- public.users: Paddle 고객 ID / 구독 ID
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;

-- beauty_sellers: Sourcing Sniper 활성화 플래그
ALTER TABLE public.beauty_sellers
  ADD COLUMN IF NOT EXISTS sourcing_sniper_active BOOLEAN NOT NULL DEFAULT false;
