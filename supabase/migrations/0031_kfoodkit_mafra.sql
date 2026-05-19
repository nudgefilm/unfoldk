-- =============================================================
-- 0031 — KfoodKit: Spoonacular → MAFRA 전환 (food_recipes 컬럼 교체)
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 변경 사유:
--   Spoonacular ($29/월 유료) → 농림수산식품교육문화정보원 레시피 API (data.go.kr, 무료).
--   기본정보 / 재료정보 / 과정정보 3종 승인 + 1,000~10,000건/일 쿼터.
--
-- 컬럼 변경:
--   spoonacular_id integer  →  mafra_rcp_seq text
--   MAFRA rcpSeq 는 공공데이터포털 일관 패턴상 문자열 식별자 (예: "20140304")
--   이라 text 로 저장. unique 키도 재구성.
--
-- 안전성:
--   0030 적용 직후 (데이터 0건) 라 DROP COLUMN + ADD COLUMN 안전.
--   기존 unique(spoonacular_id) 는 DROP COLUMN 시 자동 제거됨.
-- =============================================================


-- 1. spoonacular_id 컬럼 제거 (unique constraint 자동 소거) ────
alter table public.food_recipes
  drop column if exists spoonacular_id;


-- 2. mafra_rcp_seq 컬럼 추가 + unique ──────────────────────────
alter table public.food_recipes
  add column if not exists mafra_rcp_seq text unique;

comment on column public.food_recipes.mafra_rcp_seq is
  '농림수산식품교육문화정보원 레시피 API rcpSeq (멱등 인제스트 키).';
