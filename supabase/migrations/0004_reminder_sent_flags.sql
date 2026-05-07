-- =============================================================
-- 0004 — user_calendar_subscriptions 에 sent 플래그 추가
-- 목적: D-7 / D-1 / D-0 알림 중복 발송 방지 (Phase 3.5)
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================

alter table public.user_calendar_subscriptions
  add column if not exists sent_d7 boolean not null default false,
  add column if not exists sent_d1 boolean not null default false,
  add column if not exists sent_dayof boolean not null default false;

-- RLS 정책은 기존 "user_calsubs_all_own" 그대로 유지 (sent 플래그도 본인 데이터)
