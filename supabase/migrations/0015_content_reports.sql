-- =============================================================
-- 0015 — content_reports 테이블 + RLS (콘텐츠 신고 시스템)
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 모델:
--   - content_reports: 전체 서비스 공통 신고 테이블
--     content_type 으로 event/artist/drama/phrase/recipe 구분
--   - HallyuCalendar 이벤트부터 우선 적용 (M+0 차원 보완책)
--
-- 정책:
--   - 로그인 유저만 insert (본인 user_id 로만)
--   - 본인 신고만 select
--   - 관리자는 전체 read + status 업데이트
--   - 0013 패턴대로 service_role GRANT 명시
-- =============================================================


-- 1. content_reports 테이블 -----------------------------------
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('event', 'artist', 'drama', 'phrase', 'recipe')),
  content_id uuid not null,
  user_id uuid not null references public.users(id) on delete cascade,
  reason text not null check (reason in ('mismapping', 'date_error', 'duplicate', 'cancelled', 'other')),
  note text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null
);

create index if not exists idx_content_reports_status_created
  on public.content_reports(status, created_at desc);
create index if not exists idx_content_reports_content
  on public.content_reports(content_type, content_id);
create index if not exists idx_content_reports_user
  on public.content_reports(user_id, created_at desc);


-- 2. RLS 활성화 ------------------------------------------------
alter table public.content_reports enable row level security;


-- 3. GRANT — authenticated/service_role 명시 (0013 패턴) -------
grant select, insert on public.content_reports to authenticated;
grant update on public.content_reports to authenticated;          -- admin만 RLS 통과
grant select, insert, update, delete on public.content_reports to service_role;


-- 4. RLS 정책 --------------------------------------------------

-- 4-1. 본인 신고만 select
drop policy if exists "content_reports_select_own" on public.content_reports;
create policy "content_reports_select_own"
  on public.content_reports for select
  to authenticated
  using (auth.uid() = user_id);

-- 4-2. 관리자 전체 select
drop policy if exists "content_reports_select_admin" on public.content_reports;
create policy "content_reports_select_admin"
  on public.content_reports for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- 4-3. 로그인 유저만 insert (본인 user_id 로만)
drop policy if exists "content_reports_insert_own" on public.content_reports;
create policy "content_reports_insert_own"
  on public.content_reports for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 4-4. 관리자만 update (status/reviewed_at/reviewed_by)
drop policy if exists "content_reports_update_admin" on public.content_reports;
create policy "content_reports_update_admin"
  on public.content_reports for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
