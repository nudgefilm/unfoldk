-- 0059_chart_attack.sql
-- Chart Attack 기능: 팬덤 화력 투표 테이블
-- Supabase SQL Editor 에서 직접 실행 필요
-- 차트 데이터는 기존 kpop_stats_daily + Last.fm 데이터 재활용 (신규 테이블 불필요)

-- chart_attack_votes: 팬덤 화력 투표 (PopCat 방식 — artist당 누적 카운트)
create table if not exists public.chart_attack_votes (
  artist_id   uuid        primary key references public.kpop_artists(id) on delete cascade,
  vote_count  bigint      not null default 0,
  updated_at  timestamptz not null default now()
);

-- RLS
alter table public.chart_attack_votes enable row level security;

-- 공개 읽기
create policy "votes_public_select" on public.chart_attack_votes
  for select using (true);

-- 서비스롤 전체 접근
create policy "votes_service_all" on public.chart_attack_votes
  for all to service_role using (true) with check (true);

-- 인증 유저 투표 허용
create policy "votes_auth_update" on public.chart_attack_votes
  for update to authenticated using (true) with check (true);

create policy "votes_auth_insert" on public.chart_attack_votes
  for insert to authenticated with check (true);
