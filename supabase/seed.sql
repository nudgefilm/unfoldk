-- =============================================================
-- HallyuCalendar 시드 데이터 (현재 mock 5개를 DB로 이전)
-- 적용 방법: Supabase Dashboard > SQL Editor 에서 마이그레이션 후 실행
-- ⚠️ 재실행 가능 — source_api='manual' + source_id 로 중복 방지
-- =============================================================

insert into public.hallyu_calendar_events
  (type, title, artist_or_drama, event_date, event_time_label, source_api, source_id, is_premium)
values
  ('concert',  'BTS Concert',           'BTS',        '2026-05-10 19:00:00+09', '7:00 PM KST',  'manual', 'seed-001', true),
  ('comeback', 'BLACKPINK Comeback',    'BLACKPINK',  '2026-05-15 12:00:00+09', '12:00 PM KST', 'manual', 'seed-002', false),
  ('fanmeet',  'NewJeans Fan Meet',     'NewJeans',   '2026-05-21 15:00:00+09', '3:00 PM KST',  'manual', 'seed-003', true),
  ('drama',    'Queen of Tears Finale', 'tvN Drama',  '2026-05-23 21:00:00+09', '9:00 PM KST',  'manual', 'seed-004', false),
  ('comeback', 'aespa Album Drop',      'aespa',      '2026-05-28 18:00:00+09', '6:00 PM KST',  'manual', 'seed-005', false)
on conflict (source_api, source_id) do nothing;
