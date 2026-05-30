-- =============================================================
-- 0053 — kpop_country_charts rank 제약 확대 (3 → 50)
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
-- 배경: rank 1~3 제약으로 인해 국가별 Top 3 이외 아티스트 데이터 미수집.
--       Artist Comparison 글로벌 분포 섹션에서 대부분의 아티스트가 데이터 없음.
--       Top 10으로 확대하여 더 많은 아티스트 커버.

-- 기존 체크 제약 제거
alter table public.kpop_country_charts
  drop constraint if exists kpop_country_charts_rank_check;

-- 새 체크 제약 적용 (1~50)
alter table public.kpop_country_charts
  add constraint kpop_country_charts_rank_check
  check (rank between 1 and 50);

-- unique 제약도 (week_start, country_code, rank) 이므로 rank 50까지 허용하면 OK
-- 별도 unique 제약 변경 불필요 (컬럼 타입 변경 없음)
