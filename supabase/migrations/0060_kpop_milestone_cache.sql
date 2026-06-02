-- 0060_kpop_milestone_cache.sql
-- Chart Insight (Pro) AI 예측 결과 캐시 테이블
-- Supabase SQL Editor 에서 직접 실행 필요

CREATE TABLE IF NOT EXISTS public.kpop_milestone_cache (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id    uuid        NOT NULL REFERENCES public.kpop_artists(id) ON DELETE CASCADE,
  prediction_text text     NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 아티스트별 최신순 조회 최적화
CREATE INDEX IF NOT EXISTS idx_milestone_cache_artist_time
  ON public.kpop_milestone_cache (artist_id, created_at DESC);

-- RLS: 서비스롤 전용 (클라이언트 직접 접근 불필요)
ALTER TABLE public.kpop_milestone_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestone_cache_service_all" ON public.kpop_milestone_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
