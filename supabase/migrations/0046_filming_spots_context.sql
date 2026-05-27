-- =============================================================
-- 0046 — filming_spots: 장면 설명 + 포토존 팁 컬럼 추가
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 목적:
--   - scene_description : 한 줄 장면 callout (Claude 배치 생성)
--       예: "공유가 처음 김고은에게 나타난 그 골목"
--   - photo_tip         : 베스트 포토존 팁 (Claude 배치 생성)
--       예: "골목 입구 가로등 아래 50mm 표준화각 추천"
--
-- 비고:
--   - 모두 nullable — 기존 row 영향 없음
--   - scripts/tag-filming-spots.ts 로 기존 데이터 일괄 자동 태깅
-- =============================================================

alter table public.filming_spots
  add column if not exists scene_description text;  -- 장면 callout 한 줄 (Claude 생성)

alter table public.filming_spots
  add column if not exists photo_tip text;           -- 포토존 팁 한 줄 (Claude 생성)
