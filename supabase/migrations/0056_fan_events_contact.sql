-- 0056_fan_events_contact.sql
-- Fan Meet 탭 유저 등록 행사 연동을 위한 연락처·신청 링크 컬럼 추가.
--
-- fan_event_requests:
--   contact_email     — 주최자가 공개할 연락처 이메일 (신청자 이메일 수신용)
--   registration_link — Google Form 등 신청 URL (캘린더 카드 "Register" 버튼)
--
-- hallyu_calendar_events:
--   contact_email     — 승인 시 fan_event_requests 에서 복사
--   registration_link — 동일

alter table public.fan_event_requests
  add column if not exists contact_email text,
  add column if not exists registration_link text;

alter table public.hallyu_calendar_events
  add column if not exists contact_email text,
  add column if not exists registration_link text;
