-- 0040 — kpop_spots eng_title 추가
-- Claude 직접 생성 스팟의 영문 장소명 저장 (tour_spots.eng_title 패턴 통일)
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행

alter table public.kpop_spots
  add column if not exists eng_title text;
