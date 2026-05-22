-- =============================================================
-- 0037 — hallyu_calendar_events 에 venue/city/country 분리 컬럼 추가
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 배경:
--   Ticketmaster ingest 가 venue/city/country 정보를 받지만 별도 컬럼이 없어
--   "venue · city · country" 합성 문자열을 description 컬럼에 박아 넣고 있었음
--   (lib/ingest/ticketmaster.ts:162). 결과적으로:
--     1) 도시·국가 단위 필터·정렬·검색 불가 (description ilike 만 가능)
--     2) description 컬럼이 source_api 별로 의미가 다름 — Ticketmaster=venue,
--        TMDB/YouTube=Claude 생성 한 줄 요약. 일관성 깨짐.
--
-- 본 마이그레이션 후 ingest 가 신규 컬럼에 직접 저장하고, description 은
-- Ticketmaster 행에서 null 로 비움 (다음 cron 실행 시 자동 갱신).
-- =============================================================

alter table public.hallyu_calendar_events
  add column if not exists venue_name text,
  add column if not exists venue_city text,
  add column if not exists venue_country_code varchar(2);

comment on column public.hallyu_calendar_events.venue_name is
  '공연장 이름 (Ticketmaster venue.name). 콘서트·팬미팅에만 의미. 그 외 source_api 는 NULL.';
comment on column public.hallyu_calendar_events.venue_city is
  '공연 도시 (Ticketmaster venue.city.name).';
comment on column public.hallyu_calendar_events.venue_country_code is
  'ISO 3166-1 alpha-2 국가 코드 (예 US, GB, JP, BR). 캘린더 국가 필터·정렬용. 온라인/스트리밍 이벤트는 NULL.';

-- 캘린더 페이지의 국가 필터에서 자주 쓰일 부분 인덱스 (NOT NULL 만)
create index if not exists idx_hcal_events_venue_country
  on public.hallyu_calendar_events(venue_country_code)
  where venue_country_code is not null;
