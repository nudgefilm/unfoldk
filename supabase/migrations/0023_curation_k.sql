-- =============================================================
-- 0023 — Curation K (M+5 / HallyuMap) 테이블 + RLS
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 모델:
--   - filming_spots  : K드라마 촬영지 마스터 (Claude 추출 + TourAPI 매핑)
--   - kpop_spots     : K팝 성지 마스터 (어드민 큐레이션 + Claude 보조)
--   - hallyu_courses : 사용자별 AI 1일 코스 (Pro 전용 — Phase 2 에서 생성 UI 결합)
--
-- 스펙과 차이 (프로젝트 컨벤션 따라):
--   - drama_id 는 uuid (스펙: integer) → dramas.id 가 uuid 라서 정합 필요
--   - artist_id 는 uuid → kpop_artists.id 가 uuid
--   - user_id 는 public.users (스펙: auth.users) → CLAUDE.md §5 단일 users 정책 + 프로필 join 호환
--
-- 정책:
--   - filming_spots / kpop_spots: 공개 카탈로그라 anon + auth 모두 read
--     · filming_spots 는 status='confirmed' 만 공개. pending 은 어드민만.
--   - hallyu_courses: 본인 행만 전권 + 어드민 read
--   - 0013/0014/0015 패턴대로 service_role GRANT 명시
-- =============================================================


-- 1. filming_spots ---------------------------------------------
-- TMDB·KdramaMatch dramas 와 연결. drama 메타 변경에 영향 안 받도록 drama_title snapshot 도 유지.
create table if not exists public.filming_spots (
  id uuid primary key default gen_random_uuid(),
  drama_id uuid references public.dramas(id) on delete set null,
  drama_title text not null,                          -- 추출 시점 스냅샷 (드라마 row 삭제돼도 보존)
  spot_name text not null,                            -- 예 "Goblin Café (재인의 집)"
  region text,                                        -- 예 "Seoul", "Gangwon-do"
  address text,                                       -- TourAPI addr1 (한국어)
  latitude numeric(10, 7),                            -- WGS84
  longitude numeric(10, 7),
  tour_content_id text,                               -- TourAPI contentId — 이미지/상세 후속 fetch 키
  image_url text,                                     -- TourAPI firstImage(2) snapshot — UI 카드용
  confidence numeric(3, 2) not null default 0.8,      -- 0.00~1.00 Claude 추정 신뢰도
  status text not null default 'confirmed'
    check (status in ('confirmed', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drama_title, spot_name)                     -- 중복 추출 방지 (cron 재실행 멱등)
);

create index if not exists idx_filming_spots_drama
  on public.filming_spots(drama_id) where status = 'confirmed';
create index if not exists idx_filming_spots_status
  on public.filming_spots(status);
create index if not exists idx_filming_spots_region
  on public.filming_spots(region) where status = 'confirmed';


-- 2. kpop_spots ------------------------------------------------
create table if not exists public.kpop_spots (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references public.kpop_artists(id) on delete set null,
  artist_name text not null,                          -- 스냅샷 (kpop_artists 변경 영향 회피)
  spot_name text not null,
  spot_type text not null
    check (spot_type in ('agency', 'mv_location', 'cafe', 'concert_venue')),
  region text,
  address text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  tour_content_id text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_name, spot_name, spot_type)
);

create index if not exists idx_kpop_spots_artist on public.kpop_spots(artist_id);
create index if not exists idx_kpop_spots_type on public.kpop_spots(spot_type);


-- 3. hallyu_courses --------------------------------------------
-- course_data jsonb 스키마 (Phase 2 확장):
--   { region: "Seoul", duration_hours: 6,
--     stops: [{ time: "10:00", type: "filming_spot", name: "...", lat, lng, notes: "..." }, ...],
--     generated_at: "..." }
create table if not exists public.hallyu_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  region text,
  course_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hallyu_courses_user
  on public.hallyu_courses(user_id, created_at desc);


-- 4. updated_at 트리거 (set_updated_at 은 0001 에서 정의)
drop trigger if exists trg_filming_spots_updated_at on public.filming_spots;
create trigger trg_filming_spots_updated_at
  before update on public.filming_spots
  for each row execute function public.set_updated_at();

drop trigger if exists trg_kpop_spots_updated_at on public.kpop_spots;
create trigger trg_kpop_spots_updated_at
  before update on public.kpop_spots
  for each row execute function public.set_updated_at();

drop trigger if exists trg_hallyu_courses_updated_at on public.hallyu_courses;
create trigger trg_hallyu_courses_updated_at
  before update on public.hallyu_courses
  for each row execute function public.set_updated_at();


-- 5. RLS 활성화 ------------------------------------------------
alter table public.filming_spots enable row level security;
alter table public.kpop_spots enable row level security;
alter table public.hallyu_courses enable row level security;


-- 6. GRANT — 0013/0015 패턴 일관 -------------------------------
grant select on public.filming_spots to anon, authenticated;
grant select on public.kpop_spots to anon, authenticated;
grant insert, update, delete on public.filming_spots to authenticated;  -- admin RLS 만 통과
grant insert, update, delete on public.kpop_spots to authenticated;     -- admin RLS 만 통과
grant select, insert, update, delete on public.hallyu_courses to authenticated;
grant select, insert, update, delete on public.filming_spots to service_role;
grant select, insert, update, delete on public.kpop_spots to service_role;
grant select, insert, update, delete on public.hallyu_courses to service_role;


-- 7. RLS 정책 — filming_spots ---------------------------------

-- 7-1. confirmed 만 공개
drop policy if exists "filming_spots_select_confirmed" on public.filming_spots;
create policy "filming_spots_select_confirmed"
  on public.filming_spots for select
  to anon, authenticated
  using (status = 'confirmed');

-- 7-2. 관리자 전체 read (pending 포함 검토용)
drop policy if exists "filming_spots_select_admin" on public.filming_spots;
create policy "filming_spots_select_admin"
  on public.filming_spots for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- 7-3. 관리자만 write
drop policy if exists "filming_spots_admin_write" on public.filming_spots;
create policy "filming_spots_admin_write"
  on public.filming_spots for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- 8. RLS 정책 — kpop_spots ------------------------------------

drop policy if exists "kpop_spots_select_all" on public.kpop_spots;
create policy "kpop_spots_select_all"
  on public.kpop_spots for select
  to anon, authenticated
  using (true);

drop policy if exists "kpop_spots_admin_write" on public.kpop_spots;
create policy "kpop_spots_admin_write"
  on public.kpop_spots for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- 9. RLS 정책 — hallyu_courses --------------------------------

drop policy if exists "hallyu_courses_all_own" on public.hallyu_courses;
create policy "hallyu_courses_all_own"
  on public.hallyu_courses for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 관리자 read — 사용성 진단용
drop policy if exists "hallyu_courses_select_admin" on public.hallyu_courses;
create policy "hallyu_courses_select_admin"
  on public.hallyu_courses for select
  to authenticated
  using (public.is_admin(auth.uid()));
