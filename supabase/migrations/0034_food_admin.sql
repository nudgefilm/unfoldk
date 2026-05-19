-- =============================================================
-- 0034 — KfoodKit admin: food-images Storage 버킷 + image_source enum 확장
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 목적:
--   1) /admin/food 페이지에서 어드민이 레시피 이미지를 직접 업로드 가능하게 함.
--   2) 어드민 직접 URL 입력 케이스를 'manual' image_source 로 추적.
--
-- 변경:
--   - food-images Storage 버킷 신규 (public read · admin write only)
--   - food_recipes.image_source check 제약 확장:
--       기존: 'mfds' | 'unsplash' | NULL
--       신규: 'mfds' | 'unsplash' | 'upload' | 'manual' | NULL
--
-- 정책:
--   - fan-event-proofs 와 달리 일반 유저 업로드 없음. 어드민만 가능 (public.is_admin).
--   - 파일 경로 컨벤션: food-images/{recipe_id}.{ext} (jpg|png|webp).
--     같은 경로 재업로드는 supabase-js .upload({ upsert: true }) 로 덮어쓰기.
-- =============================================================


-- 1. food-images Storage 버킷 ----------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'food-images',
  'food-images',
  true,                                          -- public read (카드·모달에서 직접 노출)
  5242880,                                       -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- 2. RLS — 어드민만 insert / update / delete ------------------
-- (select 는 버킷 public=true 로 처리 — 별도 정책 불필요)
drop policy if exists "food-images admin insert" on storage.objects;
create policy "food-images admin insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'food-images'
    and public.is_admin(auth.uid())
  );

drop policy if exists "food-images admin update" on storage.objects;
create policy "food-images admin update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'food-images'
    and public.is_admin(auth.uid())
  );

drop policy if exists "food-images admin delete" on storage.objects;
create policy "food-images admin delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'food-images'
    and public.is_admin(auth.uid())
  );


-- 3. food_recipes.image_source check 확장 ---------------------
-- 기존 check 제약을 drop 하고 신규 enum 으로 재구성.
-- (Postgres check 제약 이름은 자동 부여 — 0033 에서 명시 안 했으면 시스템 이름).
-- 안전하게: 모든 check 제약 중 image_source 컬럼 관련만 골라 drop.
do $$
declare
  con record;
begin
  for con in
    select conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'food_recipes'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%image_source%'
  loop
    execute format('alter table public.food_recipes drop constraint %I', con.conname);
  end loop;
end$$;

alter table public.food_recipes
  add constraint food_recipes_image_source_check
  check (image_source is null or image_source in ('mfds', 'unsplash', 'upload', 'manual'));

comment on column public.food_recipes.image_source is
  '이미지 출처. mfds=식약처 매칭 / unsplash=Claude→Unsplash fallback / upload=어드민 직접 업로드 / manual=어드민 URL 직접 입력 / NULL=미설정.';
