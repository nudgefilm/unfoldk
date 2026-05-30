-- =============================================================
-- 0054 — kpop_artist_follows
-- KpopStats "Track this artist" 버튼 → 아티스트 단위 직접 팔로우.
-- user_calendar_subscriptions 는 이벤트 단위라 이벤트 없는 아티스트는 유실됨.
-- 이 테이블은 이벤트 유무와 무관하게 팔로우 상태를 보존한다.
-- =============================================================

create table if not exists public.kpop_artist_follows (
  user_id    uuid not null references public.users(id) on delete cascade,
  artist_id  uuid not null references public.kpop_artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create index if not exists idx_kpop_artist_follows_user
  on public.kpop_artist_follows(user_id);

-- RLS
alter table public.kpop_artist_follows enable row level security;

-- 자신의 팔로우만 조회
create policy "follows_select_own"
  on public.kpop_artist_follows
  for select
  using (auth.uid() = user_id);

-- 자신의 팔로우만 삽입
create policy "follows_insert_own"
  on public.kpop_artist_follows
  for insert
  with check (auth.uid() = user_id);

-- 자신의 팔로우만 삭제
create policy "follows_delete_own"
  on public.kpop_artist_follows
  for delete
  using (auth.uid() = user_id);

-- service_role 전체 접근
grant all on public.kpop_artist_follows to service_role;
grant select, insert, delete on public.kpop_artist_follows to authenticated;
