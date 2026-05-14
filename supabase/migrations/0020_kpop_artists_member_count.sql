-- =============================================================
-- 0020_kpop_artists_member_count.sql
-- kpop_artists 에 member_count 컬럼 추가 — 그룹/솔로 필터용.
--
-- 값 의미:
--   NULL = 미분류 (어드민이 아직 입력 안 함). 기본 필터 "All" 에서만 노출.
--   1    = 솔로
--   2+   = 그룹 (인원 수)
--
-- /kpop/artists 페이지의 그룹/솔로 필터에서 사용.
-- 신규 시드 (255명) 는 NULL 로 시작 — 어드민 페이지에서 점진적 backfill.
-- 기존 25명 시드는 전부 그룹이라 별도 백필 SQL 로 추후 처리 권장.
-- =============================================================

alter table public.kpop_artists
  add column if not exists member_count integer check (member_count is null or member_count >= 1);

comment on column public.kpop_artists.member_count is
  'NULL=미분류 / 1=솔로 / 2+=그룹. 어드민 backfill. /kpop/artists 필터용.';
