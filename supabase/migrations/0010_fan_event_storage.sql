-- =============================================================
-- 0010 — 팬 행사 증빙 파일 Storage 버킷
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 배경:
--   /mypage/fan-events 에서 유저가 행사 증빙 파일(이미지/PDF) 을 업로드.
--   admin 이 fan_event_requests.proof_url 을 보고 승인 여부 판단.
--
-- 정책:
--   - 버킷 fan-event-proofs : public read (URL 알면 누구나 조회 — 어드민이 별도 인증 없이 빠르게 검토)
--   - 업로드: 로그인 유저만, 자기 폴더 ({user_id}/...) 에만 가능
--   - 5MB 제한, image/jpeg, image/png, application/pdf 만 허용
--   - 파일명 컨벤션: {user_id}/{timestamp}-{slug}.{ext}
--
-- ⚠️ Supabase Storage RLS 는 storage.objects 테이블에 정책을 부여하는 형태.
--    버킷 자체는 storage.buckets 에 1행 insert.
-- =============================================================

-- 1. 버킷 생성 ----------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fan-event-proofs',
  'fan-event-proofs',
  true,                                  -- public read
  5242880,                               -- 5 MiB
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- 2. RLS 정책 — 업로드 (insert) ----------------------------------
-- {user_id}/... 형태 경로만 허용 — auth.uid() 와 첫 폴더명 일치 필수
drop policy if exists "fan-event-proofs upload own folder" on storage.objects;
create policy "fan-event-proofs upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fan-event-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- 3. RLS 정책 — 자기 파일 update / delete (재업로드·취소 대비) ----
drop policy if exists "fan-event-proofs update own" on storage.objects;
create policy "fan-event-proofs update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fan-event-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fan-event-proofs delete own" on storage.objects;
create policy "fan-event-proofs delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fan-event-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ※ select(read) 는 버킷의 public=true 로 처리 — 별도 select 정책 불필요.
--   비공개로 전환할 경우 아래 패턴으로 본인 + admin select 정책 추가:
--
-- create policy "fan-event-proofs read own or admin"
--   on storage.objects for select
--   to authenticated
--   using (
--     bucket_id = 'fan-event-proofs'
--     and (
--       (storage.foldername(name))[1] = auth.uid()::text
--       or exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true)
--     )
--   );
