ALTER TABLE public.beauty_post_matching_services
  ADD COLUMN IF NOT EXISTS buyer_id    UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS product_id  UUID REFERENCES public.beauty_products(id),
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.beauty_suppliers(id),
  ADD COLUMN IF NOT EXISTS message     TEXT,
  ADD COLUMN IF NOT EXISTS quantity    INTEGER DEFAULT 1;

GRANT INSERT, SELECT ON public.beauty_post_matching_services TO authenticated;
