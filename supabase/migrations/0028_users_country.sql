-- =============================================================
-- 0028 — users.country (ISO 3166-1 alpha-2) 추가
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 푸터 통계 ("Fans from N countries · M members" + 국기 마퀴) 용도.
--
-- 값 출처: complete-signup 라우트에서 Vercel `x-vercel-ip-country` 헤더
-- (대문자 2자리, 예 "US"/"TH"/"KR") 를 한 번에 저장. 로컬·미지정은 NULL.
-- 추후 사용자가 직접 변경할 수 있게 두지만 현재 UI 는 미노출 (자동 추정만).
-- =============================================================

alter table public.users
  add column if not exists country varchar(2);

-- 국가별 집계가 빈번 — distinct/group by 빠르게.
-- 부분 인덱스 (country IS NOT NULL) 로 NULL row 제외해 사이즈 최소화.
create index if not exists idx_users_country
  on public.users(country)
  where country is not null;
