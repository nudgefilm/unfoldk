-- =============================================================
-- 0057 — kpop_albums: KpopStats 앨범 히스토리 (MusicBrainz release-group 기반)
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 데이터 소스: MusicBrainz /ws/2/release-group?artist={mbid}&type=album|single|ep
--
-- type 값:
--   album  — 정규 앨범
--   single — 싱글
--   ep     — EP (미니앨범)
--
-- 수집 제외:
--   secondary-type: Compilation / Live / Remix / DJ-mix / Mixtape/Street
--   (스튜디오 결과물만 보관)
--
-- image_url:
--   Cover Art Archive 기반 (https://coverartarchive.org/release-group/{mbid}/front-250)
--   존재 여부 미검증 — 404 가능, 향후 backfill 스크립트로 보완
--
-- 동기화 방식:
--   - 초기: scripts/sync-musicbrainz-releases.ts (수동 1회)
--   - 증분: /api/cron/ingest-musicbrainz-releases (매주 화요일 05:00 UTC)
-- =============================================================

create table if not exists public.kpop_albums (
  id           uuid        primary key default gen_random_uuid(),
  artist_id    uuid        not null references public.kpop_artists(id) on delete cascade,
  mbid         text        not null,                          -- MusicBrainz release-group UUID
  title        text        not null,
  release_date date,                                          -- first-release-date (null = 미상)
  type         text        not null
    check (type in ('album', 'single', 'ep')),
  image_url    text,                                          -- CAA front cover URL (nullable)
  created_at   timestamptz not null default now(),
  unique (artist_id, mbid)                                   -- 동일 release-group 중복 방지
);

-- 아티스트별 발매일 내림차순 (앨범 히스토리 조회 메인 쿼리)
create index if not exists idx_kpop_albums_artist_release
  on public.kpop_albums(artist_id, release_date desc);

-- 최신 앨범 전체 조회 (KpopStats 상세 페이지 "Recent Releases" 섹션)
create index if not exists idx_kpop_albums_release_date
  on public.kpop_albums(release_date desc);

-- RLS 활성화
alter table public.kpop_albums enable row level security;

-- GRANT
grant select on public.kpop_albums to anon, authenticated;
grant all    on public.kpop_albums to service_role;

-- 공개 read 정책 (KpopStats 는 비로그인 포함 전체 공개)
drop policy if exists "kpop_albums_select_all" on public.kpop_albums;
create policy "kpop_albums_select_all"
  on public.kpop_albums for select to anon, authenticated using (true);
