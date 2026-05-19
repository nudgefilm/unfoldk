-- =============================================================
-- 0035 — food_recipes 재료·조리법 영문 번역 컬럼
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 컬럼 추가:
--   - ingredients_en  jsonb : 재료 영문명 배열 [string, ...]
--                              ingredients (한글) 와 같은 인덱스 매핑.
--                              capacity 는 한글 그대로 (대부분 숫자 + 단위).
--   - instructions_en jsonb : 조리 과정 영문 텍스트 배열 [string, ...]
--                              instructions 와 같은 인덱스 매핑.
--
-- 채움 전략:
--   모달 오픈 시 `/api/food/recipes/[id]` 가 null 검출하면 Claude Haiku 로 lazy 생성·캐싱.
--   (cron Phase 4 backfill 은 title_en 만 처리 — 카드 그리드 영역에 영향 없는 콘텐츠는 lazy 만)
-- =============================================================

alter table public.food_recipes
  add column if not exists ingredients_en jsonb;

alter table public.food_recipes
  add column if not exists instructions_en jsonb;

comment on column public.food_recipes.ingredients_en is
  'Claude Haiku 재료 영문명 배열 — ingredients 배열과 동일 인덱스 매핑. 모달 오픈 시 lazy 생성.';
comment on column public.food_recipes.instructions_en is
  'Claude Haiku 조리 과정 영문 텍스트 배열 — instructions 배열과 동일 인덱스 매핑. 모달 오픈 시 lazy 생성.';

-- 콘텐츠 번역 대기열 — 둘 중 하나라도 비어있는 row 빠르게 조회
create index if not exists idx_food_recipes_content_translate_pending
  on public.food_recipes(id)
  where ingredients_en is null or instructions_en is null;
