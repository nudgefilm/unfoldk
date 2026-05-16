-- =============================================================
-- 0022 — user_watchlist 에 rating + review 컬럼 추가
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 스펙은 `drama_watchlist (tmdb_id)` 신규 테이블이었으나, 이미 0014 에서
-- `user_watchlist (drama_id uuid → dramas.id)` 가 존재하고 /api/dramas/watchlist
-- 가 이 스키마로 동작 중. 신규 테이블 추가 시:
--   - 기존 데이터 마이그레이션 부담
--   - /api/dramas/watchlist 재작성 + UI 동시 교체 필요
--   - 같은 도메인 두 테이블 (long-term 혼란)
-- → ALTER 로 rating + review 만 확장. 기존 인프라 100% 호환.
--
-- 컬럼:
--   rating numeric(2,1) check 0~5 — 0.5 단위 별점 (UI 가 강제)
--   review text         check ≤500자
--
-- RLS·GRANT 는 0014 의 "watchlist_all_own" / authenticated CRUD GRANT 그대로 적용됨
-- (ALTER 는 정책 영향 없음).
-- =============================================================

alter table public.user_watchlist
  add column if not exists rating numeric(2, 1)
    check (rating is null or (rating >= 0 and rating <= 5));

alter table public.user_watchlist
  add column if not exists review text
    check (review is null or char_length(review) <= 500);

comment on column public.user_watchlist.rating is
  '본인 평점 (0~5, 0.5 단위). NULL=미입력.';
comment on column public.user_watchlist.review is
  '본인 한줄평 (≤500자). NULL=미입력.';

-- /api/dramas/trending 의 "이번 주 추가 많은 드라마" 핫패스용 인덱스.
-- (created_at, drama_id) 정렬·집계에 사용. partial index 로 최근 데이터만 hot.
-- 단순 비편향 분포 가정 — 데이터 누적 후 효과 미미하면 drop 검토.
create index if not exists idx_watchlist_created_drama
  on public.user_watchlist(created_at desc, drama_id);
