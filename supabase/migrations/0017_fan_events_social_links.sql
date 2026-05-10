-- 0017_fan_events_social_links.sql
--
-- 팬 행사 신청 폼에 소셜 링크 (선택) 필드 추가.
-- 사용자가 이벤트 홍보 채널을 함께 제출하면 어드민 검토 시 진위 확인이 쉬워짐.
--
-- 컬럼:
--   social_instagram — Instagram 계정명 (@ 없이 username 만, 폼에서 prefix 'instagram.com/' 표시)
--   social_x         — X(Twitter) 계정명 (동일 규칙)
--   social_other     — 기타 URL 직접 입력 (Discord / TikTok / Naver Cafe 등)
--
-- 모두 nullable. 기존 행은 NULL 로 유지.
-- RLS 변경 없음 — 기존 정책이 본인 행 전체를 select / insert 허용해 신규 컬럼도 자동 포함.

alter table public.fan_event_requests
  add column if not exists social_instagram text,
  add column if not exists social_x text,
  add column if not exists social_other text;
