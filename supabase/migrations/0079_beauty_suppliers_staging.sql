CREATE TABLE IF NOT EXISTS public.beauty_suppliers_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 식약처 원본 데이터 (한글)
  company_name_ko TEXT NOT NULL,
  address_ko TEXT,
  business_registration_number TEXT,
  license_number TEXT,
  license_type TEXT,
  status_ko TEXT,
  -- Claude Haiku 영문 변환 결과
  company_name_en TEXT,
  address_en TEXT,
  city_en TEXT,
  state_en TEXT,
  country TEXT DEFAULT 'Republic of Korea',
  -- Apollo.io 매핑 결과
  contact_email TEXT,
  contact_name TEXT,
  contact_title TEXT,
  linkedin_url TEXT,
  apollo_mapped BOOLEAN DEFAULT false,
  -- 처리 상태
  translate_status TEXT DEFAULT 'pending'
    CHECK (translate_status IN ('pending', 'completed', 'failed')),
  apollo_status TEXT DEFAULT 'pending'
    CHECK (apollo_status IN ('pending', 'mapped', 'not_found', 'failed')),
  invite_status TEXT DEFAULT 'pending'
    CHECK (invite_status IN ('pending', 'sent', 'bounced', 'unsubscribed')),
  invite_sent_at TIMESTAMPTZ,
  imported_to_suppliers BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.beauty_suppliers_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beauty_suppliers_staging_admin" ON public.beauty_suppliers_staging
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.beauty_suppliers_staging TO authenticated;

CREATE INDEX IF NOT EXISTS idx_staging_translate_status
  ON public.beauty_suppliers_staging (translate_status);
CREATE INDEX IF NOT EXISTS idx_staging_apollo_status
  ON public.beauty_suppliers_staging (apollo_status);
CREATE INDEX IF NOT EXISTS idx_staging_invite_status
  ON public.beauty_suppliers_staging (invite_status);
