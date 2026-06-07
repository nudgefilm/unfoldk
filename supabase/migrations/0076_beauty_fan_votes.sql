CREATE TABLE IF NOT EXISTS public.beauty_fan_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  category_name TEXT NOT NULL,
  broad_category TEXT NOT NULL,
  custom_product_input TEXT,
  country_code TEXT,
  vote_date DATE DEFAULT current_date,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, category_name, vote_date)
);

ALTER TABLE public.beauty_fan_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beauty_fan_votes_insert" ON public.beauty_fan_votes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "beauty_fan_votes_select" ON public.beauty_fan_votes
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT, INSERT ON public.beauty_fan_votes TO authenticated;

CREATE INDEX IF NOT EXISTS idx_fan_votes_calculation
  ON public.beauty_fan_votes (category_name, created_at DESC);
