ALTER TABLE public.beauty_suppliers
  ADD COLUMN IF NOT EXISTS pro_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;
