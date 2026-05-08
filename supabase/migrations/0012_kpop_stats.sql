-- =============================================================
-- 0012 — KpopStats (M+1) 테이블 + 시드 데이터
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 모델:
--   - kpop_artists       : 아티스트 카탈로그 (수동 등록 + Hallyu API 시드)
--   - kpop_stats_daily   : 일별 통계 스냅샷 (YouTube + Last.fm)
--
-- 정책:
--   - 둘 다 anon + authenticated 모두 read 가능 (공개 정보)
--   - 쓰기는 admin (어드민 폼) + service_role (cron) 만
--   - kpop_stats_daily 는 (artist_id, date) unique → cron 재실행 멱등성 보장
-- =============================================================

-- 1. kpop_artists 테이블 ----------------------------------------
create table if not exists public.kpop_artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,                         -- 영어 표기 (BTS, BLACKPINK)
  name_ko text,                               -- 한국어 표기 (방탄소년단)
  debut_year integer,
  youtube_channel_id text,                    -- "UCxxx..." 형식, 비어있으면 YouTube 인제스트 skip
  lastfm_name text,                           -- Last.fm 아티스트명 (대개 영어 표기와 일치)
  thumbnail_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_kpop_artists_active on public.kpop_artists(is_active) where is_active = true;
create unique index if not exists uniq_kpop_artists_name on public.kpop_artists(lower(name));


-- 2. kpop_stats_daily 테이블 ------------------------------------
create table if not exists public.kpop_stats_daily (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.kpop_artists(id) on delete cascade,
  date date not null,
  youtube_subscribers bigint,
  youtube_total_views bigint,
  youtube_weekly_views bigint,                -- 어제 vs 8일전 total_views 차이로 계산
  lastfm_listeners bigint,
  lastfm_playcount bigint,
  lastfm_weekly_rank integer,                 -- Last.fm tag.gettopartists k-pop 내 순위
  created_at timestamptz not null default now(),
  unique (artist_id, date)
);

create index if not exists idx_kpop_stats_daily_artist on public.kpop_stats_daily(artist_id, date desc);
create index if not exists idx_kpop_stats_daily_date on public.kpop_stats_daily(date desc);


-- 3. RLS 활성화 -------------------------------------------------
alter table public.kpop_artists enable row level security;
alter table public.kpop_stats_daily enable row level security;


-- 4. GRANT ------------------------------------------------------
grant select on public.kpop_artists to anon, authenticated;
grant select on public.kpop_stats_daily to anon, authenticated;
grant insert, update, delete on public.kpop_artists to authenticated;     -- admin RLS 통과
grant insert, update, delete on public.kpop_stats_daily to authenticated; -- admin RLS 통과


-- 5. RLS 정책 — kpop_artists ------------------------------------

-- 5-1. 모두 read (활성·비활성 무관 — 어드민도 같은 select 사용)
drop policy if exists "kpop_artists_select_all" on public.kpop_artists;
create policy "kpop_artists_select_all"
  on public.kpop_artists for select
  to anon, authenticated
  using (true);

-- 5-2. admin write
drop policy if exists "kpop_artists_admin_write" on public.kpop_artists;
create policy "kpop_artists_admin_write"
  on public.kpop_artists for all
  to authenticated
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true)
  )
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true)
  );


-- 6. RLS 정책 — kpop_stats_daily --------------------------------

drop policy if exists "kpop_stats_select_all" on public.kpop_stats_daily;
create policy "kpop_stats_select_all"
  on public.kpop_stats_daily for select
  to anon, authenticated
  using (true);

-- write 는 service_role 만 (cron) — 어드민 수동 갱신 시에도 service_role 클라이언트 사용
-- (어드민 RLS 정책 추가는 필요 시 후속 마이그레이션에서)


-- 7. 시드 데이터 ------------------------------------------------
-- ⚠️ youtube_channel_id 는 NULL 로 시작 — 어드민 페이지에서 검증된 ID 입력
--    잘못된 ID 로 cron 돌리면 silent 0 반환되므로 검증 후 활성화
insert into public.kpop_artists (name, name_ko, debut_year, lastfm_name, is_active) values
  ('BTS',          '방탄소년단',  2013, 'BTS',         true),
  ('BLACKPINK',    '블랙핑크',    2016, 'BLACKPINK',   true),
  ('aespa',        '에스파',      2020, 'aespa',       true),
  ('NewJeans',     '뉴진스',      2022, 'NewJeans',    true),
  ('IVE',          '아이브',      2021, 'IVE',         true),
  ('TWICE',        '트와이스',    2015, 'TWICE',       true),
  ('Stray Kids',   '스트레이 키즈', 2018, 'Stray Kids',  true),
  ('EXO',          '엑소',        2012, 'EXO',         true),
  ('SEVENTEEN',    '세븐틴',      2015, 'SEVENTEEN',   true),
  ('NCT',          '엔시티',      2016, 'NCT',         true),
  ('LE SSERAFIM',  '르세라핌',    2022, 'LE SSERAFIM', true),
  ('Red Velvet',   '레드벨벳',    2014, 'Red Velvet',  true),
  ('ITZY',         '있지',        2019, 'ITZY',        true),
  ('TXT',          '투모로우바이투게더', 2019, 'TXT',  true),
  ('BIGBANG',      '빅뱅',        2006, 'BIGBANG',     true),
  ('2NE1',         '투애니원',    2009, '2NE1',        true),
  ('SHINee',       '샤이니',      2008, 'SHINee',      true),
  ('GOT7',         '갓세븐',      2014, 'GOT7',        true),
  ('MONSTA X',     '몬스타엑스',  2015, 'MONSTA X',    true),
  ('(G)I-DLE',     '아이들',      2018, '(G)I-DLE',    true),
  ('NMIXX',        '엔믹스',      2022, 'NMIXX',       true),
  ('ILLIT',        '아일릿',      2024, 'ILLIT',       true),
  ('ATEEZ',        '에이티즈',    2018, 'ATEEZ',       true),
  ('ENHYPEN',      '엔하이픈',    2020, 'ENHYPEN',     true),
  ('Kep1er',       '케플러',      2022, 'Kep1er',      true)
on conflict on constraint uniq_kpop_artists_name do nothing;
