-- =============================================================
-- 0030 — KfoodKit (M+4) 테이블 4종 + RLS
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 모델:
--   - drama_foods           : 드라마-음식 연계 마스터 (Claude Haiku 자동 생성)
--   - food_recipes          : Spoonacular 한식 레시피 마스터 (외부 ingest)
--   - user_food_collections : 사용자 저장 레시피 (락인 효과)
--   - food_challenges       : 주간 K푸드 챌린지 (어드민 큐레이션)
--
-- 정책 (0023/0027 패턴 일관):
--   - 마스터 3종 (drama_foods / food_recipes / food_challenges) — anon+auth read,
--     authenticated 쓰기는 admin RLS, service_role 전체
--   - user_food_collections — 본인 행 전권 (auth.uid()=user_id)
--   - service_role GRANT 명시 (0013 패턴 — alter default privileges 가 있어도 보강)
-- =============================================================


-- 1. drama_foods ──────────────────────────────────────────────
-- 드라마에서 등장한 음식의 연계 정보. Claude Haiku 가 KdramaMatch dramas DB
-- 기준으로 자동 추출 → 어드민에서 검토·수정만.
create table if not exists public.drama_foods (
  id uuid primary key default gen_random_uuid(),
  drama_id uuid not null references public.dramas(id) on delete cascade,
  food_name text not null,                       -- 영문 음식명 (예: "Jjajangmyeon")
  food_name_ko text,                             -- 한글 음식명 (예: "짜장면")
  description text,                              -- Claude 생성 영문 설명 (팬 감성)
  episode_context text,                          -- "Season 1 Ep 3 — dinner scene" 등
  image_url text,                                -- 대표 이미지 (외부 URL, 서버 저장 금지)
  created_at timestamptz not null default now(),
  unique (drama_id, food_name)                   -- 같은 드라마에 같은 음식 중복 방지
);

create index if not exists idx_drama_foods_drama on public.drama_foods(drama_id);


-- 2. food_recipes ─────────────────────────────────────────────
-- Spoonacular 한식 레시피. drama_food_id 로 드라마-음식 연계 가능 (nullable).
create table if not exists public.food_recipes (
  id uuid primary key default gen_random_uuid(),
  spoonacular_id integer unique,                 -- Spoonacular 고유 id — upsert 충돌키
  title text not null,
  image_url text,
  ingredients jsonb,                             -- [{ name, amount, unit }] 형태
  instructions jsonb,                            -- [{ step, instruction }] 형태
  nutrition jsonb,                               -- Spoonacular nutrition.nutrients 원본
  ready_in_minutes integer,
  servings integer,
  source_url text,                               -- 원본 레시피 페이지
  youtube_url text,                              -- 관련 요리 영상 (Phase 2 enrichment)
  drama_food_id uuid references public.drama_foods(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_food_recipes_drama_food on public.food_recipes(drama_food_id);
create index if not exists idx_food_recipes_created on public.food_recipes(created_at desc);


-- 3. user_food_collections ────────────────────────────────────
-- 본인이 저장한 레시피. Free 5개 cap 은 app 레벨에서 강제 (DB 무제한).
create table if not exists public.user_food_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  recipe_id uuid not null references public.food_recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create index if not exists idx_user_food_collections_user on public.user_food_collections(user_id);


-- 4. food_challenges ──────────────────────────────────────────
-- 주간 챌린지 — 어드민 큐레이션. (week_start, week_end) 가 노출 기준.
create table if not exists public.food_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  food_name text,
  image_url text,
  week_start date not null,
  week_end date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_food_challenges_week on public.food_challenges(week_start desc);


-- 5. RLS 활성화 ───────────────────────────────────────────────
alter table public.drama_foods enable row level security;
alter table public.food_recipes enable row level security;
alter table public.user_food_collections enable row level security;
alter table public.food_challenges enable row level security;


-- 6. GRANT — 0013/0027 패턴 일관 ─────────────────────────────
-- drama_foods / food_recipes / food_challenges — 공개 카탈로그
grant select on public.drama_foods to anon, authenticated;
grant insert, update, delete on public.drama_foods to authenticated;
grant select, insert, update, delete on public.drama_foods to service_role;

grant select on public.food_recipes to anon, authenticated;
grant insert, update, delete on public.food_recipes to authenticated;
grant select, insert, update, delete on public.food_recipes to service_role;

grant select on public.food_challenges to anon, authenticated;
grant insert, update, delete on public.food_challenges to authenticated;
grant select, insert, update, delete on public.food_challenges to service_role;

-- user_food_collections — 본인 데이터 전권
grant select, insert, update, delete on public.user_food_collections to authenticated;
grant select, insert, update, delete on public.user_food_collections to service_role;


-- 7. RLS 정책 — drama_foods (공개 read, admin write) ──────────
drop policy if exists "drama_foods_select_all" on public.drama_foods;
create policy "drama_foods_select_all"
  on public.drama_foods for select
  to anon, authenticated
  using (true);

drop policy if exists "drama_foods_admin_write" on public.drama_foods;
create policy "drama_foods_admin_write"
  on public.drama_foods for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- 8. RLS 정책 — food_recipes (공개 read, admin write) ─────────
drop policy if exists "food_recipes_select_all" on public.food_recipes;
create policy "food_recipes_select_all"
  on public.food_recipes for select
  to anon, authenticated
  using (true);

drop policy if exists "food_recipes_admin_write" on public.food_recipes;
create policy "food_recipes_admin_write"
  on public.food_recipes for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- 9. RLS 정책 — user_food_collections (본인 전권) ─────────────
drop policy if exists "user_food_collections_all_own" on public.user_food_collections;
create policy "user_food_collections_all_own"
  on public.user_food_collections for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 어드민은 전체 read (진단·통계용)
drop policy if exists "user_food_collections_select_admin" on public.user_food_collections;
create policy "user_food_collections_select_admin"
  on public.user_food_collections for select
  to authenticated
  using (public.is_admin(auth.uid()));


-- 10. RLS 정책 — food_challenges (공개 read, admin write) ─────
drop policy if exists "food_challenges_select_all" on public.food_challenges;
create policy "food_challenges_select_all"
  on public.food_challenges for select
  to anon, authenticated
  using (true);

drop policy if exists "food_challenges_admin_write" on public.food_challenges;
create policy "food_challenges_admin_write"
  on public.food_challenges for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
