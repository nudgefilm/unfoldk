-- =============================================================
-- 0006 — RLS self-reference 무한 재귀 회피
-- 사유: 0005의 users_select_admin 정책이 EXISTS 서브쿼리에서 users 테이블을
--       다시 select 하면서 RLS 평가 무한 재귀(또는 빈 결과 반환) 발생.
--       middleware/requireAdmin이 본인 is_admin=true를 못 읽어 / 로 redirect됨.
-- 해결: SECURITY DEFINER public.is_admin(uid) 함수로 RLS 우회 분리 +
--       admin 정책들을 함수 호출로 재작성.
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================

-- 1. SECURITY DEFINER 함수 — RLS를 우회해 안전하게 is_admin 조회
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select u.is_admin from public.users u where u.id = uid),
    false
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, anon;


-- 2. users 정책 재작성 (self-reference 제거)
drop policy if exists "users_select_admin" on public.users;
drop policy if exists "users_update_admin" on public.users;

create policy "users_select_admin"
  on public.users for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "users_update_admin"
  on public.users for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- 3. fan_event_requests 정책 재작성
drop policy if exists "fan_events_select_admin" on public.fan_event_requests;
drop policy if exists "fan_events_update_admin" on public.fan_event_requests;

create policy "fan_events_select_admin"
  on public.fan_event_requests for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "fan_events_update_admin"
  on public.fan_event_requests for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- 4. cron_logs 정책 재작성
drop policy if exists "cron_logs_select_admin" on public.cron_logs;
create policy "cron_logs_select_admin"
  on public.cron_logs for select
  to authenticated
  using (public.is_admin(auth.uid()));


-- 5. hallyu_calendar_events admin write 정책 재작성
drop policy if exists "events_admin_write" on public.hallyu_calendar_events;
create policy "events_admin_write"
  on public.hallyu_calendar_events for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
