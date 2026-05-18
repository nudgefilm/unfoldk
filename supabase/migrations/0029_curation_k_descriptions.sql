-- =============================================================
-- 0029 — Curation K: 카드 상세 모달 보강 컬럼 추가
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 목적:
--   - filming_spots.spot_description : 촬영 장면·맥락 설명 (Claude 추출)
--   - kpop_spots.visit_reason        : K팝 팬이 이곳을 방문하는 이유 (이미 추출 중 — 영구화)
--   - kpop_spots.homepage            : 공식 홈페이지 (있는 경우만)
--
-- 비고:
--   - 모두 nullable — 기존 row 영향 없음. 모달은 NULL 일 때 섹션 숨김.
--   - filming_spots.spot_description 은 다음 cron 부터 자동 채워짐 (lib/curation-k/filming-spots.ts).
--   - kpop_spots.visit_reason 은 lib/curation-k/kpop-spots.ts 가 이미 추출 — upsert 에 추가됨.
-- =============================================================

alter table public.filming_spots
  add column if not exists spot_description text;

alter table public.kpop_spots
  add column if not exists visit_reason text;

alter table public.kpop_spots
  add column if not exists homepage text;
