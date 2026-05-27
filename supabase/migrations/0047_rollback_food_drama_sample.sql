-- =============================================================
-- 0047 — food_recipes drama 컬럼 샘플 데이터 초기화
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 목적:
--   0044 에서 추가된 drama_title / episode_tag / scene_description / featured_week
--   컬럼에 테스트·수동 입력된 샘플 값 전체 초기화.
--   실제 데이터는 scripts/tag-food-drama.ts (Claude Haiku 배치) 로만 투입.
--
-- 원칙: 테스트/샘플 데이터는 실제 DB에 INSERT하지 않는다.
-- =============================================================

update public.food_recipes
set
  drama_title       = null,
  episode_tag       = null,
  scene_description = null,
  featured_week     = null
where drama_title is not null
   or episode_tag is not null
   or scene_description is not null
   or featured_week is not null;
