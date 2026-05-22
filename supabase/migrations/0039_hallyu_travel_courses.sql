-- =============================================================
-- 0039 — hallyu_travel_courses 테이블 신설
-- Plan Your Trip (K-Travel Planner Phase 2) Pro 저장 기능용
-- =============================================================
--
-- 배경:
--   기존 hallyu_courses 는 My Hallyu Course (multi-day, Pro only) 전용.
--   Plan Your Trip 은 드라마별 filming_spots 기반 1일 코스 — 별도 테이블 분리.
--   course_data jsonb: { stops, gmaps_url, description, generated_at }
--
-- RLS: 본인 row 만 all 허용.

create table if not exists public.hallyu_travel_courses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  drama_title  text,
  course_data  jsonb not null default '{}',
  created_at   timestamptz default now()
);

alter table public.hallyu_travel_courses enable row level security;

create policy "travel_courses_own" on public.hallyu_travel_courses
  for all using (user_id = auth.uid());

-- 사용자별 코스 목록 조회 성능
create index if not exists idx_travel_courses_user
  on public.hallyu_travel_courses (user_id, created_at desc);
