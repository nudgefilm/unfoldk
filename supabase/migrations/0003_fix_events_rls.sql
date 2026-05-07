-- =============================================================
-- 0003 — hallyu_calendar_events RLS 정책 분리
-- 사유: 기존 단일 정책은 anon 경로에서도 users 테이블을 참조해
--       "permission denied for table users" 발생.
--       정책을 둘로 쪼개 anon 은 users 를 건드리지 않도록 함.
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================

-- 기존 단일 정책 제거
drop policy if exists "events_select_free_for_all" on public.hallyu_calendar_events;
drop policy if exists "events_select_free" on public.hallyu_calendar_events;
drop policy if exists "events_select_premium_paid" on public.hallyu_calendar_events;

-- 1. anon + authenticated: 비프리미엄 이벤트는 모두 read
create policy "events_select_free"
  on public.hallyu_calendar_events for select
  to anon, authenticated
  using (is_premium = false);

-- 2. authenticated 중 활성 구독자만: 프리미엄 이벤트 read
create policy "events_select_premium_paid"
  on public.hallyu_calendar_events for select
  to authenticated
  using (
    is_premium = true
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.plan_type in ('monthly', 'annual')
        and u.subscription_status = 'active'
    )
  );
