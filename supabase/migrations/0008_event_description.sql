-- =============================================================
-- 0008 — hallyu_calendar_events.description 보장 + 정책 노트
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 배경:
--   인제스트 시 Claude Haiku 4.5 로 한 줄 설명을 자동 생성해 description 에 저장.
--   description 컬럼은 0001 에서 이미 생성되어 있지만 (text, nullable),
--   다른 환경에서 재구축할 때 안전하도록 idempotent 하게 add column if not exists 로
--   재선언. 이미 존재하는 환경에선 사실상 no-op.
--
-- 컬럼 정책:
--   - description text NULL 가능 — Claude 호출 실패 시 인제스트는 계속 진행하므로
--     원본 source description (TMDB overview, YouTube description) 또는 NULL 로 남을 수 있음
--   - 길이 제약 없음 (CHECK 미설정) — 모델이 100자 권고 어겨도 인제스트 차단 방지
--   - 어드민 폼 입력 시엔 PatchSchema/PostSchema 가 max(2000) 으로 검증
-- =============================================================

-- 1. description 컬럼 보장 -----------------------------------
alter table public.hallyu_calendar_events
  add column if not exists description text;
