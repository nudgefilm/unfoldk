-- =============================================================
-- 0038 — food_recipes.youtube_url 컬럼 drop
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 배경:
--   RecipeDetailDialog 의 "Watch on YouTube" 섹션을 UI 에서 제거한 뒤,
--   해당 컬럼·관련 코드 (lib/api/youtube.ts searchCookingVideo 함수 +
--   /api/food/recipes/[id] 의 lazy 검색·write-back 블록) 가 모두 미사용
--   상태가 됨. 본 마이그레이션으로 DB 컬럼까지 완전 정리.
--
--   기존 데이터 (이미 캐싱된 youtube_url 값) 는 함께 손실됨 — 복원이
--   필요하면 컬럼 재추가 + 다음 첫 조회마다 search.list 100 units 로
--   다시 채워짐.
--
-- 부수 효과:
--   - YouTube API daily quota 압박 감소 (search.list 100 units/recipe-detail
--     첫 조회 호출이 영구히 사라짐). KpopStats 채널 매핑이 같은 GCP
--     프로젝트의 10,000 units/일 쿼터를 더 안정적으로 쓸 수 있게 됨.
--   - food_recipes 의 row size 약간 감소 (text 컬럼 1개 제거).
-- =============================================================

alter table public.food_recipes
  drop column if exists youtube_url;
