-- korean_phrases 에 이미지 URL 컬럼 추가
-- 어드민에서 이미지 등록 → Grammar Explanation 카드 상단 표시
-- Reddit 포스팅 소재용

ALTER TABLE korean_phrases
  ADD COLUMN IF NOT EXISTS image_url TEXT;
