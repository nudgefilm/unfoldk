CREATE TABLE youtube_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL, -- 'calendar' | 'kpop' | 'kdrama' | 'hangeul' | 'curation'
  ref_id text,           -- 연관 엔티티 ID (artist_id, drama_id, spot_id, event_id 등)
  ref_type text,         -- 'artist' | 'drama' | 'expression' | 'spot' | 'event'
  video_id text NOT NULL UNIQUE,
  title text,
  thumbnail_url text,
  published_at timestamptz,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'published' | 'rejected'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_youtube_videos_service ON youtube_videos(service);
CREATE INDEX idx_youtube_videos_status ON youtube_videos(status);
CREATE INDEX idx_youtube_videos_ref ON youtube_videos(ref_id, ref_type);

ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "published videos are public" ON youtube_videos
  FOR SELECT USING (status = 'published');

CREATE POLICY "admin full access" ON youtube_videos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
