-- beauty_suppliers 인증·서류 컬럼 추가
ALTER TABLE public.beauty_suppliers
  ADD COLUMN IF NOT EXISTS cosmetic_license_type       TEXT,
  ADD COLUMN IF NOT EXISTS cosmetic_license_url        TEXT,
  ADD COLUMN IF NOT EXISTS fda_registration_number     TEXT,
  ADD COLUMN IF NOT EXISTS iso_22716                   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS iso_22716_url               TEXT,
  ADD COLUMN IF NOT EXISTS vegan_certified             BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vegan_cert_org              TEXT,
  ADD COLUMN IF NOT EXISTS vegan_cert_url              TEXT,
  ADD COLUMN IF NOT EXISTS cruelty_free_certified      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cruelty_free_cert_org       TEXT,
  ADD COLUMN IF NOT EXISTS cruelty_free_cert_url       TEXT,
  ADD COLUMN IF NOT EXISTS export_experience           TEXT,
  ADD COLUMN IF NOT EXISTS export_countries            TEXT;

-- kbeauty-documents 스토리지 버킷 생성 (이미 존재하면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kbeauty-documents', 'kbeauty-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 스토리지 RLS: 공급사 본인만 업로드·조회 가능
CREATE POLICY IF NOT EXISTS "kbeauty_documents_supplier_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kbeauty-documents'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY IF NOT EXISTS "kbeauty_documents_supplier_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kbeauty-documents'
    AND auth.uid() IS NOT NULL
  );
