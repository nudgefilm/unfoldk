-- Hallyu Pass 전용 기능 테이블
-- /mypage/hallyu-pass 페이지: 아티스트 위클리 리포트, 컴백 가이드, 월간 트렌드 리포트, 한류 루틴

-- 1. 유저 루틴 설정 (user 1:1)
CREATE TABLE IF NOT EXISTS hallyu_routine_preferences (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  interests     text[]      NOT NULL DEFAULT '{}',
  daily_minutes int         NOT NULL DEFAULT 15 CHECK (daily_minutes IN (5, 15, 30)),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hallyu_routine_preferences ENABLE ROW LEVEL SECURITY;

-- 본인 + Pro 유저만 SELECT
CREATE POLICY "hrp_select_own_pro" ON hallyu_routine_preferences
  FOR SELECT USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND plan_type IN ('monthly', 'annual')
    )
  );

-- INSERT/UPDATE: service_role 전용 (no client-side write policy)

-- 2. 주간 루틴 결과 (user + week_start 복합 unique)
CREATE TABLE IF NOT EXISTS hallyu_routines (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start      date        NOT NULL,
  routine_items   jsonb       NOT NULL DEFAULT '[]',
  completed_items jsonb       NOT NULL DEFAULT '{}',
  streak_count    int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

ALTER TABLE hallyu_routines ENABLE ROW LEVEL SECURITY;

-- 본인 + Pro 유저만 SELECT
CREATE POLICY "hr_select_own_pro" ON hallyu_routines
  FOR SELECT USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND plan_type IN ('monthly', 'annual')
    )
  );

-- completed_items: 본인이 직접 체크 가능 (routine_items 는 서버 삽입, 완료 표시만 클라이언트)
CREATE POLICY "hr_update_own" ON hallyu_routines
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. 아티스트 위클리 리포트 (Claude 생성 요약 포함)
CREATE TABLE IF NOT EXISTS artist_weekly_reports (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id        uuid        NOT NULL REFERENCES kpop_artists(id) ON DELETE CASCADE,
  week_start       date        NOT NULL,
  listener_count   int,
  listener_change  int,
  top_countries    jsonb       NOT NULL DEFAULT '[]',
  new_events_count int         NOT NULL DEFAULT 0,
  summary_text     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artist_id, week_start)
);

ALTER TABLE artist_weekly_reports ENABLE ROW LEVEL SECURITY;

-- Pro 유저만 SELECT
CREATE POLICY "awr_select_pro" ON artist_weekly_reports
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND plan_type IN ('monthly', 'annual')
    )
  );

-- 4. 컴백 가이드 (Claude 생성)
CREATE TABLE IF NOT EXISTS comeback_guides (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id     uuid        NOT NULL REFERENCES kpop_artists(id) ON DELETE CASCADE,
  event_id      uuid        REFERENCES hallyu_calendar_events(id) ON DELETE SET NULL,
  release_date  timestamptz,
  guide_content text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comeback_guides ENABLE ROW LEVEL SECURITY;

-- Pro 유저만 SELECT
CREATE POLICY "cg_select_pro" ON comeback_guides
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND plan_type IN ('monthly', 'annual')
    )
  );

-- 5. 월간 트렌드 리포트 (year_month unique)
CREATE TABLE IF NOT EXISTS monthly_trend_reports (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  year_month     text        NOT NULL UNIQUE,
  report_content jsonb       NOT NULL DEFAULT '{}',
  summary_text   text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE monthly_trend_reports ENABLE ROW LEVEL SECURITY;

-- Pro 유저만 SELECT
CREATE POLICY "mtr_select_pro" ON monthly_trend_reports
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND plan_type IN ('monthly', 'annual')
    )
  );

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_hallyu_routines_user       ON hallyu_routines(user_id);
CREATE INDEX IF NOT EXISTS idx_awr_artist_week            ON artist_weekly_reports(artist_id, week_start);
CREATE INDEX IF NOT EXISTS idx_comeback_guides_artist     ON comeback_guides(artist_id);
CREATE INDEX IF NOT EXISTS idx_monthly_trend_year_month   ON monthly_trend_reports(year_month);
