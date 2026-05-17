-- =============================================================
-- 0025 — KdramaMatch Phase 2: dramas 테이블 확장
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 목적:
--   - TMDB append_to_response=credits,videos,watch/providers 결과 저장
--   - 드라마 ↔ 캘린더 연결 (calendar_event_id)
--   - OST 아티스트 ↔ kpop_artists 연결 (ost_artist_ids)
--   - Pro 전용 AI 캐시 (drama_ai_summaries, drama_ai_characters)
--
-- 멱등성: 모든 alter / create 에 IF NOT EXISTS 적용
-- =============================================================


-- 1. dramas 테이블 컬럼 추가 -----------------------------------
alter table public.dramas
  add column if not exists original_name text,           -- 원제 한글 (TMDB original_name)
  add column if not exists backdrop_path text,           -- 백드롭 이미지 URL
  add column if not exists number_of_episodes integer,   -- 에피소드 수 (episode_count 와 병존 — episode_count 는 기존 호환)
  add column if not exists number_of_seasons integer,    -- 시즌 수
  add column if not exists last_air_date date,           -- 방영 종료일
  add column if not exists networks jsonb,               -- [{id,name,logo_path}]
  add column if not exists cast_members jsonb,           -- [{name,character,profile_path}] Top 10
  add column if not exists trailer_key text,             -- YouTube 예고편 key (https://youtube.com/watch?v=KEY)
  add column if not exists popularity numeric,           -- TMDB 인기 지수
  add column if not exists watch_providers jsonb,        -- {flatrate:[{provider_id,provider_name,logo_path}], link}
  add column if not exists next_episode_date date,       -- 다음 화 방영일 (D-Day 계산)
  add column if not exists on_the_air boolean default false,  -- 현재 방영 중 여부
  add column if not exists calendar_event_id uuid,       -- hallyu_calendar_events FK (nullable)
  add column if not exists ost_artist_ids jsonb;         -- kpop_artists.id 배열 (nullable)


-- 2. FK 제약 — calendar_event_id ------------------------------
-- hallyu_calendar_events 가 다른 reason 으로 삭제되어도 dramas 가 살아 있어야 함 → on delete set null
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'dramas_calendar_event_id_fkey'
      and table_name = 'dramas'
  ) then
    alter table public.dramas
      add constraint dramas_calendar_event_id_fkey
      foreign key (calendar_event_id)
      references public.hallyu_calendar_events(id)
      on delete set null;
  end if;
end $$;


-- 3. 인덱스 ---------------------------------------------------
create index if not exists idx_dramas_on_the_air
  on public.dramas(on_the_air) where on_the_air = true and is_active = true;
create index if not exists idx_dramas_popularity
  on public.dramas(popularity desc nulls last) where is_active = true;
create index if not exists idx_dramas_next_episode_date
  on public.dramas(next_episode_date) where on_the_air = true and is_active = true;
create index if not exists idx_dramas_calendar_event_id
  on public.dramas(calendar_event_id) where calendar_event_id is not null;


-- 4. drama_ai_summaries — Pro 전용 AI 에피소드 요약 캐시 -------
create table if not exists public.drama_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  drama_id uuid not null references public.dramas(id) on delete cascade,
  summary text not null,                         -- Claude Haiku 생성 결과
  model text not null,                           -- 'claude-haiku-4-5' 등
  created_at timestamptz not null default now(),
  unique (drama_id)                              -- 드라마당 1개 캐시 (재생성 필요 시 update)
);

alter table public.drama_ai_summaries enable row level security;

grant select on public.drama_ai_summaries to authenticated;
grant select, insert, update, delete on public.drama_ai_summaries to service_role;

-- Pro 유저(monthly/annual) + admin 만 read
drop policy if exists "drama_ai_summaries_select_pro" on public.drama_ai_summaries;
create policy "drama_ai_summaries_select_pro"
  on public.drama_ai_summaries for select
  to authenticated
  using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.plan_type in ('monthly', 'annual')
        and u.subscription_status in ('active', 'trialing')
    )
  );

drop policy if exists "drama_ai_summaries_admin_write" on public.drama_ai_summaries;
create policy "drama_ai_summaries_admin_write"
  on public.drama_ai_summaries for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- 5. drama_ai_characters — Pro 전용 AI 캐릭터 관계도 캐시 ------
create table if not exists public.drama_ai_characters (
  id uuid primary key default gen_random_uuid(),
  drama_id uuid not null references public.dramas(id) on delete cascade,
  content text not null,                         -- 텍스트 형태 관계도
  model text not null,
  created_at timestamptz not null default now(),
  unique (drama_id)
);

alter table public.drama_ai_characters enable row level security;

grant select on public.drama_ai_characters to authenticated;
grant select, insert, update, delete on public.drama_ai_characters to service_role;

drop policy if exists "drama_ai_characters_select_pro" on public.drama_ai_characters;
create policy "drama_ai_characters_select_pro"
  on public.drama_ai_characters for select
  to authenticated
  using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.plan_type in ('monthly', 'annual')
        and u.subscription_status in ('active', 'trialing')
    )
  );

drop policy if exists "drama_ai_characters_admin_write" on public.drama_ai_characters;
create policy "drama_ai_characters_admin_write"
  on public.drama_ai_characters for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- 6. 코멘트 ---------------------------------------------------
comment on column public.dramas.original_name is 'TMDB original_name — 한국어 원제';
comment on column public.dramas.backdrop_path is 'TMDB backdrop_path 절대 URL (w1280)';
comment on column public.dramas.networks is 'jsonb [{id,name,logo_path}] — tvN/Netflix/MBC 등';
comment on column public.dramas.cast_members is 'jsonb [{name,character,profile_path}] — credits.cast Top 10';
comment on column public.dramas.trailer_key is 'YouTube key — videos.results 중 type=Trailer 첫 번째';
comment on column public.dramas.watch_providers is 'jsonb {flatrate:[...], link} — US region 기준';
comment on column public.dramas.next_episode_date is 'TMDB next_episode_to_air.air_date — D-Day 계산';
comment on column public.dramas.on_the_air is 'status=Returning Series 또는 next_episode_to_air 존재 시 true';
comment on column public.dramas.calendar_event_id is 'hallyu_calendar_events FK — 자동 매핑 (source_api=tmdb + title ILIKE)';
comment on column public.dramas.ost_artist_ids is 'kpop_artists.id 배열 — 어드민 수동 매핑';
