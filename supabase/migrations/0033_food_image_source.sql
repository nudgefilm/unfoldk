-- =============================================================
-- 0033 — food_recipes.image_source 추가 (출처 추적)
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 이유:
--   image_url 채워지는 경로가 2개 됨:
--     'mfds'     — 식약처 COOKRCP01 매칭 (기존 backfill)
--     'unsplash' — Claude 영문 쿼리 → Unsplash 검색 (fallback)
--   카드·모달이 Unsplash 사진 가져갈 때 "Photo from Unsplash" 출처 표기 의무 →
--   소스 구분 컬럼 필요.
--
-- check 제약:
--   'mfds' | 'unsplash' | NULL. 신규 소스 추가 시 ALTER 로 갱신.
--
-- backfill:
--   현재 image_url != null 인 row 는 모두 MFDS 경로로 채워진 것 → 'mfds' 일괄 set.
-- =============================================================

alter table public.food_recipes
  add column if not exists image_source text
    check (image_source is null or image_source in ('mfds', 'unsplash'));

comment on column public.food_recipes.image_source is
  '이미지 출처. mfds=식약처 COOKRCP01 매칭 / unsplash=Claude 쿼리→Unsplash / NULL=미설정.';

-- 기존 매칭 row backfill — image_url != null 인 모든 row 는 MFDS 매칭 결과
update public.food_recipes
  set image_source = 'mfds'
  where image_url is not null and image_source is null;

-- Unsplash fallback 대상 빠르게 조회 — image_url=null AND image_source=null
create index if not exists idx_food_recipes_image_pending
  on public.food_recipes(id)
  where image_url is null;
