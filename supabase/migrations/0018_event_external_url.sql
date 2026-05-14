-- =============================================================
-- 0018_event_external_url.sql
-- hallyu_calendar_events 에 외부 티켓 예매·상세 페이지 URL 컬럼 추가
-- - Ticketmaster: ev.url (각 이벤트의 공식 티켓 페이지)
-- - KOPIS (향후): Melon Ticket 외부 링크 — 현재 캘린더 노출 차단 중이라 보류
-- - UI: source_api='ticketmaster' + url not null 일 때만 'Get Tickets' 버튼 노출
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================

alter table public.hallyu_calendar_events
  add column if not exists url text;

comment on column public.hallyu_calendar_events.url is
  '외부 티켓 예매·상세 페이지 URL (예: Ticketmaster ev.url). UI 의 Get Tickets 버튼 링크.';
