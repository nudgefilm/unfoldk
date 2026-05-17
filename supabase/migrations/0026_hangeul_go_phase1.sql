-- =============================================================
-- 0026 — HangeulGo (M+3) Phase 1: 학습 컨텐츠 + 진행 트래킹
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 모델:
--   - korean_phrases             : 학습 표현 마스터 (Claude Haiku 자동 생성)
--   - user_learning_progress     : 사용자별 phrase 학습 상태
--   - user_quiz_results          : 사용자별 퀴즈 응시 기록
--   - user_streaks               : 사용자별 학습 연속일
--   - grammar_explanations       : Pro 전용 AI 문법 설명 캐시
--
-- 정책:
--   - phrase / grammar 본문 read 는 anon + authenticated 허용 (학습 콘텐츠는 공개)
--   - phrase write 는 service_role 전용 (Claude 자동 생성 잡)
--   - user_* 테이블은 본인 행만 read/write
--   - 0013 패턴대로 service_role GRANT 명시
-- =============================================================


-- 1. korean_phrases — 학습 표현 마스터 ---------------------------
create table if not exists public.korean_phrases (
  id uuid primary key default gen_random_uuid(),
  drama_id uuid references public.dramas(id) on delete set null,  -- nullable: Claude 생성 drama_name 매칭 못 할 수 있음
  drama_name text,                                                 -- 원본 드라마명 (Claude 응답 그대로)
  korean text not null,                                            -- 한국어 표현 (예: "보고 싶었어")
  romanization text,                                               -- 로마자 표기 (예: "Bogo sipeosseo")
  english text not null,                                           -- 영어 의미
  word_breakdown jsonb,                                            -- [{word, romanization, meaning}]
  synonyms text[],                                                 -- 유사 표현 (텍스트 배열, 학습 카드 접이식 노출)
  antonyms text[],                                                 -- 반의 표현
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),
  audio_url text,                                                  -- ElevenLabs TTS URL (Phase 3 — 현재 null)
  -- 오늘의 표현 회전 — 결정적 일별 매핑. nullable + UNIQUE partial 로 1일 1건 보장.
  featured_date date,
  created_at timestamptz not null default now()
);

-- featured_date 가 있는 row 는 날짜당 1건만 허용 (NULL 은 unique 무시)
create unique index if not exists uniq_korean_phrases_featured_date
  on public.korean_phrases(featured_date)
  where featured_date is not null;

create index if not exists idx_korean_phrases_drama_id
  on public.korean_phrases(drama_id) where drama_id is not null;
create index if not exists idx_korean_phrases_difficulty
  on public.korean_phrases(difficulty) where difficulty is not null;


-- 2. user_learning_progress — 사용자별 phrase 학습 상태 -------
create table if not exists public.user_learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  phrase_id uuid not null references public.korean_phrases(id) on delete cascade,
  status text not null check (status in ('new', 'learning', 'mastered')),
  last_studied_at timestamptz not null default now(),
  unique (user_id, phrase_id)
);

create index if not exists idx_user_learning_progress_user_status
  on public.user_learning_progress(user_id, status);


-- 3. user_quiz_results — 사용자별 퀴즈 응시 기록 ---------------
create table if not exists public.user_quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  phrase_id uuid not null references public.korean_phrases(id) on delete cascade,
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

create index if not exists idx_user_quiz_results_user_phrase
  on public.user_quiz_results(user_id, phrase_id);


-- 4. user_streaks — 사용자별 학습 연속일 -----------------------
create table if not exists public.user_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  streak_days integer not null default 0,
  last_studied_date date,                  -- Asia/Seoul 기준 마지막 학습 날짜
  updated_at timestamptz not null default now()
);


-- 5. grammar_explanations — Pro 전용 AI 문법 설명 캐시 ----------
create table if not exists public.grammar_explanations (
  id uuid primary key default gen_random_uuid(),
  phrase_id uuid not null unique references public.korean_phrases(id) on delete cascade,
  explanation text not null,                -- Claude Haiku 생성 결과
  model text not null default 'claude-haiku-4-5',
  created_at timestamptz not null default now()
);


-- 6. updated_at 트리거 -------------------------------------------
drop trigger if exists trg_user_streaks_updated_at on public.user_streaks;
create trigger trg_user_streaks_updated_at
  before update on public.user_streaks
  for each row execute function public.set_updated_at();


-- 7. RLS 활성화 -------------------------------------------------
alter table public.korean_phrases       enable row level security;
alter table public.user_learning_progress enable row level security;
alter table public.user_quiz_results    enable row level security;
alter table public.user_streaks         enable row level security;
alter table public.grammar_explanations enable row level security;


-- 8. GRANT ------------------------------------------------------
-- korean_phrases: 공개 read
grant select on public.korean_phrases to anon, authenticated;
grant select, insert, update, delete on public.korean_phrases to service_role;

-- user_learning_progress: 본인만 read/write (RLS 로 격리)
grant select, insert, update, delete on public.user_learning_progress to authenticated;
grant select, insert, update, delete on public.user_learning_progress to service_role;

-- user_quiz_results: 본인만 read/write
grant select, insert on public.user_quiz_results to authenticated;
grant select, insert, update, delete on public.user_quiz_results to service_role;

-- user_streaks: 본인만 read/write
grant select, insert, update on public.user_streaks to authenticated;
grant select, insert, update, delete on public.user_streaks to service_role;

-- grammar_explanations: Pro 유저 read, service_role write
grant select on public.grammar_explanations to authenticated;
grant select, insert, update, delete on public.grammar_explanations to service_role;


-- 9. RLS 정책 ---------------------------------------------------

-- korean_phrases: 공개 read (학습 콘텐츠는 비로그인도 접근 가능)
drop policy if exists "korean_phrases_select_all" on public.korean_phrases;
create policy "korean_phrases_select_all"
  on public.korean_phrases for select
  to anon, authenticated
  using (true);

-- 어드민은 write 가능
drop policy if exists "korean_phrases_admin_write" on public.korean_phrases;
create policy "korean_phrases_admin_write"
  on public.korean_phrases for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- user_learning_progress: 본인 행 전권
drop policy if exists "user_learning_progress_all_own" on public.user_learning_progress;
create policy "user_learning_progress_all_own"
  on public.user_learning_progress for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- user_quiz_results: 본인 행 read/insert
drop policy if exists "user_quiz_results_select_own" on public.user_quiz_results;
create policy "user_quiz_results_select_own"
  on public.user_quiz_results for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_quiz_results_insert_own" on public.user_quiz_results;
create policy "user_quiz_results_insert_own"
  on public.user_quiz_results for insert
  to authenticated
  with check (auth.uid() = user_id);

-- user_streaks: 본인 행 전권
drop policy if exists "user_streaks_all_own" on public.user_streaks;
create policy "user_streaks_all_own"
  on public.user_streaks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- grammar_explanations: Pro 유저만 read (drama_ai_summaries 패턴)
drop policy if exists "grammar_explanations_select_pro" on public.grammar_explanations;
create policy "grammar_explanations_select_pro"
  on public.grammar_explanations for select
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

drop policy if exists "grammar_explanations_admin_write" on public.grammar_explanations;
create policy "grammar_explanations_admin_write"
  on public.grammar_explanations for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- 10. 코멘트 -----------------------------------------------------
comment on column public.korean_phrases.featured_date is '오늘의 표현 회전 키 — Asia/Seoul 기준 날짜. UNIQUE partial index 로 1일 1건 보장';
comment on column public.korean_phrases.audio_url is 'ElevenLabs TTS CDN URL — Phase 3 도입 (현재 null). 그 때까지 클라이언트 Web Speech API 폴백';
comment on column public.user_streaks.last_studied_date is 'Asia/Seoul 기준 마지막 학습 날짜 (YYYY-MM-DD). 어제+1=+1 / 오늘=유지 / 이틀+공백=리셋(1)';
