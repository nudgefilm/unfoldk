-- 30일 무료 체험(Trial) 시스템
-- trial_ends_at: 체험 만료 시각 (NULL = 체험 없음)
-- trial_*_email_sent: 이메일 중복 발송 방지 플래그 (daily cron 멱등성 보장)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_ends_at              timestamptz,
  ADD COLUMN IF NOT EXISTS trial_started_email_sent   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_d7_email_sent        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_d1_email_sent        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_ended_email_sent     boolean NOT NULL DEFAULT false;

-- 기존 가입자 소급 적용: free 플랜 (또는 plan_type NULL) + trial_ends_at 없는 유저
-- paid 플랜(monthly/annual)은 이미 유료 접근권 있으므로 제외
UPDATE users
SET trial_ends_at = now() + INTERVAL '30 days'
WHERE trial_ends_at IS NULL
  AND (plan_type IS NULL OR plan_type NOT IN ('monthly', 'annual'));
