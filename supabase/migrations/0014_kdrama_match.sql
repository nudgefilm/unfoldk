-- =============================================================
-- 0014 — KdramaMatch (M+2) 테이블 + 시청 목록 + RLS
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 모델:
--   - dramas         : 드라마 마스터 (TMDB 인제스트 + 추후 수동 큐레이션)
--   - user_watchlist : 사용자별 시청 상태 + 진행 에피소드
--
-- 정책:
--   - dramas read 는 anon + authenticated 모두 허용 (랜딩에서 미리보기 가능)
--   - dramas write 는 service_role 전용 (인제스트 잡)
--   - user_watchlist 는 본인 행 read/write 만 — RLS 로 격리
--   - 0013 패턴대로 모든 신규 객체에 service_role GRANT 명시
-- =============================================================


-- 1. dramas 마스터 ---------------------------------------------
create table if not exists public.dramas (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer unique not null,                    -- 멱등 인제스트 키
  title text not null,                                -- TMDB original_name 또는 name (en-US)
  title_ko text,                                      -- 한국어 표기 (수동 큐레이션 여지)
  genre text,                                         -- TMDB genre_ids[0] 매핑 결과 (Romance/Thriller 등)
  year integer,                                       -- first_air_date 의 연도
  platform text,                                      -- Netflix / Viki / Disney+ — 현재는 NULL, 추후 watch/providers 인제스트
  poster_url text,                                    -- TMDB poster_path 절대 URL (서버 저장 금지 — 링크만)
  rating numeric(3, 1),                               -- TMDB vote_average (소수점 1자리)
  overview text,                                      -- TMDB overview (en-US)
  episode_count integer,                              -- TMDB number_of_episodes
  status text,                                        -- 'ongoing' | 'completed' (TMDB status 매핑)
  is_active boolean not null default true,            -- 서비스 노출 여부 (어드민 토글 여지)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dramas_genre on public.dramas(genre) where is_active = true;
create index if not exists idx_dramas_platform on public.dramas(platform) where is_active = true;
create index if not exists idx_dramas_year on public.dramas(year) where is_active = true;
create index if not exists idx_dramas_rating on public.dramas(rating desc) where is_active = true;


-- 2. user_watchlist (사용자 시청 목록) -------------------------
create table if not exists public.user_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  drama_id uuid not null references public.dramas(id) on delete cascade,
  status text not null check (status in ('watching', 'want_to_watch', 'completed')),
  current_episode integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, drama_id)
);

create index if not exists idx_watchlist_user_status
  on public.user_watchlist(user_id, status);


-- 3. updated_at 자동 갱신 트리거 -------------------------------
-- (set_updated_at 함수는 0001 에서 이미 정의됨)
drop trigger if exists trg_dramas_updated_at on public.dramas;
create trigger trg_dramas_updated_at
  before update on public.dramas
  for each row execute function public.set_updated_at();

drop trigger if exists trg_watchlist_updated_at on public.user_watchlist;
create trigger trg_watchlist_updated_at
  before update on public.user_watchlist
  for each row execute function public.set_updated_at();


-- 4. RLS 활성화 ------------------------------------------------
alter table public.dramas enable row level security;
alter table public.user_watchlist enable row level security;


-- 5. GRANT — anon/authenticated/service_role 모두 명시 (0013 패턴) ---
grant select on public.dramas to anon, authenticated;
grant select, insert, update, delete on public.user_watchlist to authenticated;

-- service_role 은 0013 의 default privileges 가 적용되지만, 명시적 보강
grant select, insert, update, delete on public.dramas to service_role;
grant select, insert, update, delete on public.user_watchlist to service_role;


-- 6. RLS 정책 — dramas -----------------------------------------

-- 6-1. 활성화된 드라마는 누구나 read
drop policy if exists "dramas_select_active" on public.dramas;
create policy "dramas_select_active"
  on public.dramas for select
  to anon, authenticated
  using (is_active = true);

-- 6-2. 관리자는 비활성 포함 전체 read
drop policy if exists "dramas_select_admin" on public.dramas;
create policy "dramas_select_admin"
  on public.dramas for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- 6-3. 관리자는 write 가능 (어드민 페이지에서 큐레이션 시)
drop policy if exists "dramas_admin_write" on public.dramas;
create policy "dramas_admin_write"
  on public.dramas for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- 7. RLS 정책 — user_watchlist (본인 데이터 전권) ---------------
drop policy if exists "watchlist_all_own" on public.user_watchlist;
create policy "watchlist_all_own"
  on public.user_watchlist for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 관리자는 전체 read (어드민 진단·통계 용)
drop policy if exists "watchlist_select_admin" on public.user_watchlist;
create policy "watchlist_select_admin"
  on public.user_watchlist for select
  to authenticated
  using (public.is_admin(auth.uid()));
