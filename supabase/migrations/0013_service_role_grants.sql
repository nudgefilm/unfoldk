-- =============================================================
-- 0013 — service_role GRANT 보강 + handle_new_user 트리거 재설치
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 인시던트 (2026-05-09):
--   /admin/users 페이지가 빈 화면. service_role 클라이언트가 public.users 를
--   SELECT 시 PostgREST 가 403 (code 42501, "permission denied for table users")
--   반환. JS SDK 가 error.message="" 로 마스킹해 console.error 만 찍히고
--   페이지는 0행 fallback 으로 정상처럼 보임.
--
-- 원인:
--   0001_init.sql 의 grant 절이 authenticated 만 부여하고 service_role 누락.
--   신규 Supabase publishable/secret key 시스템에선 service_role 자동 bypass 가
--   더 이상 보장되지 않아 명시 GRANT 가 필수.
--
-- 정책 (재발 방지):
--   1) public 스키마 전체 객체에 service_role 일괄 GRANT
--   2) alter default privileges 로 향후 신규 테이블/시퀀스에도 자동 부여
--   3) handle_new_user 트리거는 0001 에 이미 정의돼있으나 idempotent 재설치
--      (DB 가 부분 reset 되거나 트리거가 누락된 환경 대비)
-- =============================================================


-- 1. service_role 에 누락된 GRANT 보강 -----------------------------
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;


-- 2. 향후 신규 객체에도 자동 부여 -----------------------------------
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;


-- 3. handle_new_user 트리거 idempotent 재설치 ----------------------
-- (0001 과 동일 — 부분 reset 환경에서 트리거 누락 시 복구)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
