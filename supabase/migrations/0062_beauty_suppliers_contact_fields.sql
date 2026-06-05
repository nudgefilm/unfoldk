-- beauty_suppliers 공급사 신청 폼 저장 필드 추가
-- 0061에서 누락된 연락처·웹사이트·FDA 상태 컬럼

ALTER TABLE public.beauty_suppliers
  ADD COLUMN IF NOT EXISTS contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS website       TEXT,
  ADD COLUMN IF NOT EXISTS fda_status    TEXT
    CHECK (fda_status IN ('등록 완료', '진행 중', '미등록'));
