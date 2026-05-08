-- =============================================================
-- 0005 — 어드민 권한 + 팬 행사 신청 + Cron 로그
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================

-- 1. users.is_admin 추가 ---------------------------------------
alter table public.users
  add column if not exists is_admin boolean not null default false;

create index if not exists idx_users_is_admin on public.users(is_admin) where is_admin = true;


-- 2. fan_event_requests (팬 행사 신청) -------------------------
create table if not exists public.fan_event_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  event_date date not null,
  location text,
  proof_url text,                                    -- Supabase Storage 'fan-event-proofs' 버킷 URL
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id)
);

create index if not exists idx_fan_event_requests_status on public.fan_event_requests(status);
create index if not exists idx_fan_event_requests_user on public.fan_event_requests(user_id);


-- 3. cron_logs (cron 실행 로그) --------------------------------
create table if not exists public.cron_logs (
  id uuid primary key default gen_random_uuid(),
  route text not null,                               -- 'ingest-all', 'send-reminders' 등
  status text not null check (status in ('success', 'failed')),
  result_json jsonb,
  executed_at timestamptz not null default now()
);

create index if not exists idx_cron_logs_route_executed on public.cron_logs(route, executed_at desc);


-- 4. RLS 활성화 ------------------------------------------------
alter table public.fan_event_requests enable row level security;
alter table public.cron_logs enable row level security;


-- 5. GRANT 부여 ------------------------------------------------
grant select, insert on public.fan_event_requests to authenticated;
grant update on public.fan_event_requests to authenticated;     -- admin만 RLS로 통과
grant select on public.cron_logs to authenticated;              -- admin만 RLS로 통과


-- 6. RLS 정책 — fan_event_requests ----------------------------

-- 6-1. 본인 신청 조회
drop policy if exists "fan_events_select_own" on public.fan_event_requests;
create policy "fan_events_select_own"
  on public.fan_event_requests for select
  to authenticated
  using (auth.uid() = user_id);

-- 6-2. 본인 신청 등록 (status는 항상 pending)
drop policy if exists "fan_events_insert_own" on public.fan_event_requests;
create policy "fan_events_insert_own"
  on public.fan_event_requests for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'pending');

-- 6-3. 관리자 전체 조회
drop policy if exists "fan_events_select_admin" on public.fan_event_requests;
create policy "fan_events_select_admin"
  on public.fan_event_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  );

-- 6-4. 관리자 전체 수정 (승인·거절)
drop policy if exists "fan_events_update_admin" on public.fan_event_requests;
create policy "fan_events_update_admin"
  on public.fan_event_requests for update
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  );


-- 7. RLS 정책 — cron_logs (관리자만 read, write는 service_role) ---
drop policy if exists "cron_logs_select_admin" on public.cron_logs;
create policy "cron_logs_select_admin"
  on public.cron_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  );


-- 8. users 테이블 — 관리자 전체 read 정책 추가 ------------------
-- 기존 "users_select_own"은 유지하되, 관리자 별도 정책 추가
drop policy if exists "users_select_admin" on public.users;
create policy "users_select_admin"
  on public.users for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  );

-- 관리자가 다른 유저 plan_type/is_admin 변경 가능
drop policy if exists "users_update_admin" on public.users;
create policy "users_update_admin"
  on public.users for update
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  );


-- 9. hallyu_calendar_events — 관리자 write 정책 ----------------
grant insert, update, delete on public.hallyu_calendar_events to authenticated;

drop policy if exists "events_admin_write" on public.hallyu_calendar_events;
create policy "events_admin_write"
  on public.hallyu_calendar_events for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  );
