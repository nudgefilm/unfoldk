-- =============================================================
-- 0002 — anon/authenticated 테이블 GRANT 보강
-- 0001 실행 후 "permission denied for table" 발생 시 적용
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================

-- 스키마 사용 권한
grant usage on schema public to anon, authenticated;

-- hallyu_calendar_events: anon/authenticated read (RLS 가 row 게이팅)
grant select on public.hallyu_calendar_events to anon, authenticated;

-- users: 본인 프로필 (RLS 가 row 게이팅)
grant select, update on public.users to authenticated;

-- subscriptions: 본인 구독 read
grant select on public.subscriptions to authenticated;

-- user_calendar_subscriptions: 본인 데이터 전권
grant select, insert, update, delete on public.user_calendar_subscriptions to authenticated;
