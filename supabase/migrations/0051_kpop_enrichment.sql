-- =============================================================
-- 0051 — KpopStats 데이터 강화 (Last.fm tags · MusicBrainz · Wikidata)
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- kpop_artists 테이블에 컬럼 추가:
--   lastfm_tags    — Last.fm 상위 태그 3개 (text[])
--   musicbrainz_id — MusicBrainz 아티스트 ID (uuid-v4 형식 문자열)
--   mb_members     — 현재 멤버 목록 [{name, role}] (jsonb)
--   mb_debut_date  — 데뷔일 (date)
--   mb_country     — 출신국 코드 (KR 등)
--   mb_official_urls — 공식 URL 목록 [{type, url}] (jsonb)
--   wd_agency      — 소속사명 (Wikidata P137)
--   wikidata_id    — Wikidata QID (Q12345)
--   wd_awards      — 수상 이력 [{award, year}] (jsonb)
--
-- ADD COLUMN IF NOT EXISTS — 재실행 안전.
-- =============================================================

-- Last.fm 태그 ─────────────────────────────────────────────
alter table public.kpop_artists
  add column if not exists lastfm_tags text[];

comment on column public.kpop_artists.lastfm_tags is
  'Last.fm artist.getInfo → tags.tag 상위 3개. 장르·스타일 배지용.';

-- MusicBrainz ──────────────────────────────────────────────
alter table public.kpop_artists
  add column if not exists musicbrainz_id text;

alter table public.kpop_artists
  add column if not exists mb_members jsonb;

alter table public.kpop_artists
  add column if not exists mb_debut_date date;

alter table public.kpop_artists
  add column if not exists mb_country text;

alter table public.kpop_artists
  add column if not exists mb_official_urls jsonb;

comment on column public.kpop_artists.musicbrainz_id is
  'MusicBrainz 아티스트 UUID. sync-musicbrainz.ts 스크립트로 수집.';
comment on column public.kpop_artists.mb_members is
  '[{name:string, role?:string, active:boolean}]. 현재 활동 멤버 목록.';
comment on column public.kpop_artists.mb_official_urls is
  '[{type:string, url:string}]. type: "official homepage" | "social network" | etc.';

-- Wikidata ─────────────────────────────────────────────────
alter table public.kpop_artists
  add column if not exists wikidata_id text;

alter table public.kpop_artists
  add column if not exists wd_agency text;

alter table public.kpop_artists
  add column if not exists wd_awards jsonb;

comment on column public.kpop_artists.wikidata_id is
  'Wikidata QID (예: Q494287). sync-wikidata.ts 스크립트로 수집.';
comment on column public.kpop_artists.wd_agency is
  'Wikidata P137 (operator/agency). 소속사명 영문. mb 데이터 없을 때 UI fallback.';
comment on column public.kpop_artists.wd_awards is
  '[{award:string, year?:number}]. 수상 이력. UI 미구현 (데이터 수집만).';

-- 인덱스 ────────────────────────────────────────────────────
create unique index if not exists idx_kpop_artists_musicbrainz_id
  on public.kpop_artists(musicbrainz_id)
  where musicbrainz_id is not null;

create unique index if not exists idx_kpop_artists_wikidata_id
  on public.kpop_artists(wikidata_id)
  where wikidata_id is not null;
