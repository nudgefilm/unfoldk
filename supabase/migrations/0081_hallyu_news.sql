CREATE TABLE hallyu_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL, -- 'koreaboo' | 'allkpop' | 'soompi'
  title text NOT NULL,
  url text NOT NULL UNIQUE,
  thumbnail_url text,
  published_at timestamptz,
  category text, -- 'kpop' | 'kdrama' | 'kbeauty' | 'general'
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_hallyu_news_source ON hallyu_news(source);
CREATE INDEX idx_hallyu_news_published ON hallyu_news(published_at DESC);
CREATE INDEX idx_hallyu_news_category ON hallyu_news(category);

ALTER TABLE hallyu_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hallyu_news public read" ON hallyu_news
  FOR SELECT USING (true);
CREATE POLICY "admin full access" ON hallyu_news
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
