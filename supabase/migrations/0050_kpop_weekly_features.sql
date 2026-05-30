-- =============================================================
-- 0050 — KpopStats 스토리텔링 강화 4개 기능
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 테이블:
--   1. kpop_weekly_insights  — 아티스트별 이번 주 동향 한 줄 요약 (Claude Haiku)
--   2. kpop_weekly_report    — 주간 K팝 트렌드 전체 요약 (3~5문장)
--   3. kpop_country_charts   — 국가별 Top 3 K팝 아티스트 (Last.fm geo)
--   4. kpop_artist_guides    — 아티스트 입문 가이드 (최초 1회 온디맨드 생성, 영구 캐싱)
--
-- 정책: 전체 공개 read (KpopStats 마케팅 목적, 비로그인 포함), service_role write
-- =============================================================


-- 1. kpop_weekly_insights ─────────────────────────────────────
create table if not exists public.kpop_weekly_insights (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  artist_id uuid not null references public.kpop_artists(id) on delete cascade,
  insight_text text not null,
  created_at timestamptz not null default now(),
  unique (week_start, artist_id)
);

create index if not exists idx_kpop_weekly_insights_week
  on public.kpop_weekly_insights(week_start desc);


-- 2. kpop_weekly_report ───────────────────────────────────────
create table if not exists public.kpop_weekly_report (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  report_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_kpop_weekly_report_week
  on public.kpop_weekly_report(week_start desc);


-- 3. kpop_country_charts ──────────────────────────────────────
-- artist_id nullable: Last.fm 매칭 실패 시 이름만 보관
create table if not exists public.kpop_country_charts (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  country_code char(2) not null,  -- ISO 3166-1 alpha-2
  artist_id uuid references public.kpop_artists(id) on delete set null,
  artist_name text not null,
  rank integer not null check (rank between 1 and 3),
  listeners bigint,
  created_at timestamptz not null default now(),
  unique (week_start, country_code, rank)
);

create index if not exists idx_kpop_country_charts_week_country
  on public.kpop_country_charts(week_start desc, country_code);


-- 4. kpop_artist_guides ───────────────────────────────────────
-- guide_text JSON 형식: {"intro":"...","songs":[{"title":"...","description":"..."},...]}
create table if not exists public.kpop_artist_guides (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null unique references public.kpop_artists(id) on delete cascade,
  guide_text text not null,
  generated_at timestamptz not null default now()
);


-- RLS 활성화 ─────────────────────────────────────────────────
alter table public.kpop_weekly_insights enable row level security;
alter table public.kpop_weekly_report    enable row level security;
alter table public.kpop_country_charts   enable row level security;
alter table public.kpop_artist_guides    enable row level security;


-- GRANT (0013 패턴) ───────────────────────────────────────────
grant select on public.kpop_weekly_insights to anon, authenticated;
grant select on public.kpop_weekly_report   to anon, authenticated;
grant select on public.kpop_country_charts  to anon, authenticated;
grant select on public.kpop_artist_guides   to anon, authenticated;
grant all    on public.kpop_weekly_insights to service_role;
grant all    on public.kpop_weekly_report   to service_role;
grant all    on public.kpop_country_charts  to service_role;
grant all    on public.kpop_artist_guides   to service_role;


-- RLS 정책: 공개 read ─────────────────────────────────────────
drop policy if exists "kpop_weekly_insights_select_all" on public.kpop_weekly_insights;
create policy "kpop_weekly_insights_select_all"
  on public.kpop_weekly_insights for select to anon, authenticated using (true);

drop policy if exists "kpop_weekly_report_select_all" on public.kpop_weekly_report;
create policy "kpop_weekly_report_select_all"
  on public.kpop_weekly_report for select to anon, authenticated using (true);

drop policy if exists "kpop_country_charts_select_all" on public.kpop_country_charts;
create policy "kpop_country_charts_select_all"
  on public.kpop_country_charts for select to anon, authenticated using (true);

drop policy if exists "kpop_artist_guides_select_all" on public.kpop_artist_guides;
create policy "kpop_artist_guides_select_all"
  on public.kpop_artist_guides for select to anon, authenticated using (true);
