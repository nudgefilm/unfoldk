-- =============================================================
-- 0032 — KfoodKit: food_recipes 영문 컬럼 + weekly_picks 캐시
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 컬럼 추가 (food_recipes):
--   - title_en        : Claude Haiku 가 한글 RECIPE_NM_KO 를 영문으로 변환 (예: "비빔밥" → "Bibimbap")
--   - description_en  : Claude Haiku 가 SUMRY + 재료/과정 일부로부터 생성한 영문 한 줄 설명
--   둘 다 nullable — 모달 오픈 시 없으면 lazy 생성·캐싱 (tour_spots translation 패턴 일관).
--
-- 신규 테이블 (food_weekly_picks):
--   - 이번 주 추천 레시피 (Pro 전용) 캐싱.
--   - week_start (월요일 date) 단위 1 row. picks 는 [{ recipe_id, reason }] 배열.
--   - 매주 월요일 첫 요청 시 Claude Haiku 가 생성 → 다음 월요일까지 동일 응답.
-- =============================================================


-- 1. food_recipes 영문 컬럼 ────────────────────────────────────
alter table public.food_recipes
  add column if not exists title_en text;

alter table public.food_recipes
  add column if not exists description_en text;

comment on column public.food_recipes.title_en is
  'Claude Haiku 영문 음식명 (예: 비빔밥 → Bibimbap). 모달 오픈 시 lazy 생성.';
comment on column public.food_recipes.description_en is
  'Claude Haiku 영문 한 줄 설명. 모달 오픈 시 lazy 생성.';

-- 번역 대기열 — title_en 비어있는 row 빠르게 조회 (모달 lazy 처리 외에 cron 백필도 가능)
create index if not exists idx_food_recipes_translate_pending
  on public.food_recipes(id)
  where title_en is null;


-- 2. food_weekly_picks (Pro 전용 추천 캐싱) ────────────────────
create table if not exists public.food_weekly_picks (
  id uuid primary key default gen_random_uuid(),
  week_start date unique not null,                 -- 월요일 date — week 식별자
  theme text not null,                             -- 계절·시기 테마 (예: "Spring", "Late Spring")
  picks jsonb not null,                            -- [{ recipe_id: uuid, reason: string }, ...] 3~5건
  created_at timestamptz not null default now()
);

create index if not exists idx_food_weekly_picks_week_start
  on public.food_weekly_picks(week_start desc);


-- 3. RLS 활성화 ────────────────────────────────────────────────
alter table public.food_weekly_picks enable row level security;


-- 4. GRANT — 0013/0027 패턴 일관 ─────────────────────────────
grant select on public.food_weekly_picks to anon, authenticated;
grant insert, update, delete on public.food_weekly_picks to authenticated;
grant select, insert, update, delete on public.food_weekly_picks to service_role;


-- 5. RLS 정책 — 공개 read, admin write ────────────────────────
drop policy if exists "food_weekly_picks_select_all" on public.food_weekly_picks;
create policy "food_weekly_picks_select_all"
  on public.food_weekly_picks for select
  to anon, authenticated
  using (true);

drop policy if exists "food_weekly_picks_admin_write" on public.food_weekly_picks;
create policy "food_weekly_picks_admin_write"
  on public.food_weekly_picks for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
