-- =============================================================
-- 0048 — tour_spots: 쇼핑(38) 카테고리 추가
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 목적:
--   TourAPI contentTypeId 38 (쇼핑) 수집 허용.
--   기존 CHECK 제약(12,14,15,32,39) 에 38 추가.
--   0027 에서 인라인으로 생성된 자동 명칭 제약을 DROP 후 재생성.
--
-- 0027 마이그레이션 CHECK 원문:
--   check (content_type_id in (12, 14, 15, 32, 39))
-- PostgreSQL 자동 생성 제약명: tour_spots_content_type_id_check
-- =============================================================

alter table public.tour_spots
  drop constraint if exists tour_spots_content_type_id_check;

alter table public.tour_spots
  add constraint tour_spots_content_type_id_check
  check (content_type_id in (12, 14, 15, 32, 38, 39));

comment on column public.tour_spots.content_type_id is
  'TourAPI contentTypeId.
   12=관광지 / 14=문화시설 / 15=축제·행사 / 32=숙박 / 38=쇼핑 / 39=음식점';
