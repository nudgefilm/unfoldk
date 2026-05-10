-- 0016_fan_events_owner_update.sql
--
-- 본인이 제출한 fan_event_requests 의 pending 행을 본인이 수정할 수 있도록 허용.
-- 기존 정책:
--   - fan_events_select_own  : 본인 행 select 허용
--   - fan_events_insert_own  : 본인 user_id 로 insert 허용
--   - fan_events_select_admin: admin 전체 select
--   - fan_events_update_admin: admin 전체 update
--
-- 추가:
--   - fan_events_update_own  : 본인 + status='pending' 일 때만 update 허용
--     using/with check 양쪽에 status 조건을 두어 status 자체를 바꾸는 시도도 차단
--     (예: 사용자가 status='approved' 로 set 하려 해도 with check 통과 못함).
--     admin 우대 정책은 별도(fan_events_update_admin)로 이미 존재하므로 손대지 않음.

drop policy if exists "fan_events_update_own" on public.fan_event_requests;

create policy "fan_events_update_own"
  on public.fan_event_requests for update
  to authenticated
  using (
    auth.uid() = user_id
    and status = 'pending'
  )
  with check (
    auth.uid() = user_id
    and status = 'pending'
  );
