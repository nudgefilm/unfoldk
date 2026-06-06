-- ────────────────────────────────────────────────────────────────────────────
-- 0073_beauty_notifications.sql
-- KBeauty 플랫폼 내 실시간 알림 테이블
-- INSERT 정책: 인증 유저라면 누구든 가능 (교차 유저 알림 발송용)
-- SELECT/UPDATE 정책: 본인 알림만
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.beauty_notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN (
    'match_request',    'match_approved',    'match_rejected',
    'sample_request',   'sample_approved',   'sample_rejected',
    'sourcing_request', 'sourcing_approved', 'sourcing_rejected',
    'product_approved'
  )),
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  link       TEXT,
  is_read    BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.beauty_notifications ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자라면 누구든 INSERT 가능 (교차 유저 알림 발송)
CREATE POLICY "beauty_notifications_insert" ON public.beauty_notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 본인 알림만 조회
CREATE POLICY "beauty_notifications_select" ON public.beauty_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 읽음 처리 — 본인 알림만
CREATE POLICY "beauty_notifications_update" ON public.beauty_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.beauty_notifications TO authenticated;

-- 빠른 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_beauty_notifications_user_id
  ON public.beauty_notifications(user_id, created_at DESC);
