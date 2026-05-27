-- =============================================================
-- 0044 — KfoodKit: food_recipes 드라마 스토리텔링 컬럼 추가
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 목적:
--   "This Week's K-Drama Food Guide" 섹션 구현을 위한 컬럼 추가.
--   레시피에 드라마 맥락 정보를 직접 저장 (drama_foods JOIN 불필요).
--
-- 추가 컬럼:
--   - drama_title       : 드라마명 (노출용 — 영문 기준)
--   - episode_tag       : 에피소드 정보 (예: "Season 1, Ep 3")
--   - scene_description : 장면 설명 한 줄 (예: "박새로이가 처음 먹은 그 메뉴")
--   - featured_week     : 노출 주차 — ISO 형식 "2026-W22"
--                         NULL = 피처드 아님 / 값 있으면 해당 주차 가이드 섹션에 노출
-- =============================================================


-- 1. 컬럼 추가 ─────────────────────────────────────────────────
alter table public.food_recipes
  add column if not exists drama_title       text;

alter table public.food_recipes
  add column if not exists episode_tag       text;

alter table public.food_recipes
  add column if not exists scene_description text;

alter table public.food_recipes
  add column if not exists featured_week     text;


-- 2. 인덱스 — featured_week 기반 주간 조회 최적화 ──────────────
create index if not exists idx_food_recipes_featured_week
  on public.food_recipes(featured_week)
  where featured_week is not null;

-- drama_title 있는 레시피만 빠르게 조회 (폴백 쿼리용)
create index if not exists idx_food_recipes_drama_title
  on public.food_recipes(drama_title)
  where drama_title is not null;


-- 3. 코멘트 ────────────────────────────────────────────────────
comment on column public.food_recipes.drama_title is
  '드라마 스토리텔링용 드라마명 (영문). NULL = 드라마 연계 없음.';

comment on column public.food_recipes.episode_tag is
  '에피소드 정보 (예: "Season 1, Ep 3"). drama_title 있는 경우만 유효.';

comment on column public.food_recipes.scene_description is
  '장면 설명 한 줄 (예: "박새로이가 처음 먹은 그 메뉴"). 팬 감성 한국어 또는 영문 혼용 가능.';

comment on column public.food_recipes.featured_week is
  'ISO 주차 문자열 "YYYY-Www" (예: "2026-W22"). This Week''s K-Drama Food Guide 노출 주차.
   NULL = 피처드 아님. 어드민에서 직접 set 하거나 cron 으로 자동 선정.';
