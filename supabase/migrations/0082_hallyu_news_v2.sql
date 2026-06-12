-- Hallyu News v2: AI 큐레이션 컬럼 추가 + generated 콘텐츠 타입
ALTER TABLE hallyu_news
  ADD COLUMN IF NOT EXISTS summary        text,
  ADD COLUMN IF NOT EXISTS image_url      text,
  ADD COLUMN IF NOT EXISTS sources        text[],
  ADD COLUMN IF NOT EXISTS related_artist text,
  ADD COLUMN IF NOT EXISTS content_type   text DEFAULT 'rss'; -- 'rss' | 'generated'

-- summary 미처리 기사 빠른 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_hallyu_news_summary_null
  ON hallyu_news(id) WHERE summary IS NULL;

-- content_type 필터 인덱스
CREATE INDEX IF NOT EXISTS idx_hallyu_news_content_type
  ON hallyu_news(content_type);
