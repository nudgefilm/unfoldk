-- =============================================================
-- 0007 — Start 플로우 단일화: 약관 동의 + 가입 완료 시점 기록
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 배경:
--   "Try for Free" / "Log in" 두 진입을 단일 "Start" 버튼으로 통합.
--   Google OAuth 후 users.agreed_to_terms 가 false 면 /start 로 보내
--   플랜 선택 + 약관 동의를 받고, true 면 곧장 /mypage 로 보낸다.
--
-- 컬럼:
--   - agreed_to_terms : 약관/개인정보처리방침 동의 여부 (default false)
--   - agreed_at       : 동의 시각 (NULL 가능 — 아직 미동의)
--
-- 백필 정책:
--   마이그레이션 적용 시점 이전에 가입한 유저는 기존 signup 페이지 흐름에서
--   이미 약관에 동의한 상태이므로 일괄 true 로 맞춘다 (=재로그인 시 /start 진입 방지).
--   agreed_at 은 created_at 으로 회복.
-- =============================================================

-- 1. 컬럼 추가 ----------------------------------------------------
alter table public.users
  add column if not exists agreed_to_terms boolean not null default false,
  add column if not exists agreed_at timestamptz;


-- 2. 기존 유저 백필 ----------------------------------------------
-- (이 마이그레이션 이전 가입자 = 기존 약관 흐름 통과자로 간주)
update public.users
  set agreed_to_terms = true,
      agreed_at = created_at
  where agreed_to_terms = false;


-- 3. 인덱스 — 필요 시 미동의 유저 추적용 -------------------------
create index if not exists idx_users_pending_terms
  on public.users(id)
  where agreed_to_terms = false;
