-- =============================================================
-- 0021 — blog_comments 테이블 + RLS (블로그 자체 댓글 시스템)
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 모델:
--   - blog_comments: content/blog/*.mdx 포스트별 댓글 (slug 으로 식별)
--   - 블로그 포스트는 파일 시스템에 있어 외부키 못 검 — slug 는 text 자유.
--     클라이언트가 잘못된 slug 로 작성해도 단순 고아 row 가 될 뿐 데이터 일관성 영향 없음.
--   - user_id 는 프로젝트 컨벤션대로 public.users(id) 참조 (CLAUDE.md §5)
--     → 댓글 UI 에서 users.name + users.avatar_url 직접 join 가능.
--     스펙은 auth.users 였지만 단일 users 테이블 정책 + UI 표시 요구 충족 위해 public.users.
--
-- 정책:
--   - SELECT: 전체 공개 (블로그 댓글은 비로그인도 읽기)
--   - INSERT: 로그인 + auth.uid() = user_id 본인만
--   - UPDATE: 본인만 (현재 UI 는 미사용 — 향후 편집 기능 대비)
--   - DELETE: 본인만 + 관리자 (악성 댓글 처리)
--
-- 인덱스:
--   - (slug, created_at desc) — 포스트 상세에서 최신순 조회 핫패스
--   - (user_id, created_at desc) — 내 댓글 모아보기 향후 대비
-- =============================================================


-- 1. blog_comments 테이블 ---------------------------------------
create table if not exists public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blog_comments_slug_created
  on public.blog_comments(slug, created_at desc);
create index if not exists idx_blog_comments_user_created
  on public.blog_comments(user_id, created_at desc);


-- 2. RLS 활성화 ------------------------------------------------
alter table public.blog_comments enable row level security;


-- 3. GRANT — 0013/0015 패턴 일관 -----------------------------
grant select on public.blog_comments to anon, authenticated;
grant insert, update, delete on public.blog_comments to authenticated;
grant select, insert, update, delete on public.blog_comments to service_role;


-- 4. RLS 정책 --------------------------------------------------

-- 4-1. 전체 읽기 (비로그인 포함)
drop policy if exists "blog_comments_select_all" on public.blog_comments;
create policy "blog_comments_select_all"
  on public.blog_comments for select
  to anon, authenticated
  using (true);

-- 4-2. 본인만 작성
drop policy if exists "blog_comments_insert_own" on public.blog_comments;
create policy "blog_comments_insert_own"
  on public.blog_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 4-3. 본인만 수정 (현재 UI 미사용 — 정책만 선반영)
drop policy if exists "blog_comments_update_own" on public.blog_comments;
create policy "blog_comments_update_own"
  on public.blog_comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4-4. 본인 삭제
drop policy if exists "blog_comments_delete_own" on public.blog_comments;
create policy "blog_comments_delete_own"
  on public.blog_comments for delete
  to authenticated
  using (auth.uid() = user_id);

-- 4-5. 관리자 삭제 — 악성·스팸 댓글 대응
drop policy if exists "blog_comments_delete_admin" on public.blog_comments;
create policy "blog_comments_delete_admin"
  on public.blog_comments for delete
  to authenticated
  using (public.is_admin(auth.uid()));


-- 5. updated_at 자동 갱신 트리거 -----------------------------
-- 동일 패턴이 다른 테이블에 있다면 generic 함수 재사용 가능. 본 마이그레이션에서는
-- 단일 테이블 전용 함수로 자족적 (idempotent)
create or replace function public.set_blog_comments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_blog_comments_updated_at on public.blog_comments;
create trigger trg_blog_comments_updated_at
  before update on public.blog_comments
  for each row
  execute function public.set_blog_comments_updated_at();
