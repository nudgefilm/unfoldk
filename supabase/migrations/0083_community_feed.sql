-- 유저 커뮤니티 피드 + 신고 테이블
CREATE TABLE community_feeds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  content       text NOT NULL,
  artist_keyword text,
  status        text NOT NULL DEFAULT 'published', -- 'published' | 'hidden'
  report_count  integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE community_feed_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id    uuid REFERENCES community_feeds(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  reason     text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(feed_id, user_id)
);

CREATE INDEX idx_community_feeds_status  ON community_feeds(status);
CREATE INDEX idx_community_feeds_user    ON community_feeds(user_id);
CREATE INDEX idx_community_feeds_created ON community_feeds(created_at DESC);
CREATE INDEX idx_community_feed_reports_feed ON community_feed_reports(feed_id);

ALTER TABLE community_feeds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_feed_reports ENABLE ROW LEVEL SECURITY;

-- published 피드는 전체 공개
CREATE POLICY "published feeds public" ON community_feeds
  FOR SELECT USING (status = 'published');

-- 본인 피드 전체 접근
CREATE POLICY "user own feeds" ON community_feeds
  FOR ALL USING (auth.uid() = user_id);

-- 어드민 전체 접근
CREATE POLICY "admin full access feeds" ON community_feeds
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- 신고: 로그인 유저만 1회
CREATE POLICY "user report once" ON community_feed_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON community_feeds TO anon, authenticated;
GRANT ALL    ON community_feeds TO service_role;
GRANT INSERT ON community_feed_reports TO authenticated;
GRANT ALL    ON community_feed_reports TO service_role;
