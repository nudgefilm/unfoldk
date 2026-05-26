-- Trial 기간 14일로 변경 + 이메일 중복 방지
-- 기존 0042_trial_system.sql 의 30일 정책을 14일로 교체

-- 1. 이메일 기반 trial 중복 방지 테이블 (탈퇴 후 재가입 차단용)
CREATE TABLE IF NOT EXISTS public.trial_used_emails (
  email            text        PRIMARY KEY,
  first_trial_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS 활성화 — 정책 없음 = 일반 유저 전면 차단, service_role(admin 클라이언트)만 우회
ALTER TABLE public.trial_used_emails ENABLE ROW LEVEL SECURITY;

-- 2. 기존 trial 수령 유저 이메일 backfill (재가입 시 중복 차단 소급 적용)
INSERT INTO public.trial_used_emails (email, first_trial_at)
SELECT email, COALESCE(created_at, now())
FROM   public.users
WHERE  trial_started_email_sent = true
ON CONFLICT (email) DO NOTHING;

-- 3. trial_ends_at NULL인 free 유저 → now() + 14일 적용
--    (0042 에서 이미 30일 받은 유저는 NULL 아니므로 영향 없음)
UPDATE public.users
SET    trial_ends_at = now() + INTERVAL '14 days'
WHERE  trial_ends_at IS NULL
  AND  (plan_type IS NULL OR plan_type NOT IN ('monthly', 'annual'));
