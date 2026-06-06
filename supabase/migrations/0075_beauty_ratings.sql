CREATE TABLE IF NOT EXISTS public.beauty_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.beauty_suppliers(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('buyer', 'seller')),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('match', 'sample', 'sourcing')),
  reference_id UUID NOT NULL,
  response_speed INTEGER CHECK (response_speed BETWEEN 1 AND 5),
  product_quality INTEGER CHECK (product_quality BETWEEN 1 AND 5),
  communication INTEGER CHECK (communication BETWEEN 1 AND 5),
  overall_rating NUMERIC(3,2) GENERATED ALWAYS AS (
    (response_speed + product_quality + communication) / 3.0
  ) STORED,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (reviewer_id, reference_type, reference_id)
);

ALTER TABLE public.beauty_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beauty_ratings_insert" ON public.beauty_ratings
  FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "beauty_ratings_select" ON public.beauty_ratings
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT, INSERT ON public.beauty_ratings TO authenticated;

CREATE INDEX IF NOT EXISTS idx_beauty_ratings_supplier_id
  ON public.beauty_ratings(supplier_id);
