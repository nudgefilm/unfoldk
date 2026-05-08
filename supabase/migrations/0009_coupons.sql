-- =============================================================
-- 0009 — 쿠폰 시스템 + 팬 행사 승인 연동
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 배경:
--   팬 행사 신청이 승인되면 Hallyu Pass 쿠폰을 자동 발급해 신청자에게 이메일로 전달.
--   유저가 /redeem 페이지에서 코드를 입력하면 즉시 monthly 플랜 활성화.
--
-- 모델:
--   - coupons: 발급된 쿠폰 1건 = 1행. code unique, used_by 가 null 이면 미사용
--   - users.plan_expires_at: 쿠폰으로 활성화된 유료 플랜의 만료 시각
--     (Stripe 정식 결제 도입 후엔 stripe_subscription_id 와 분리 운영)
-- =============================================================

-- 1. users.plan_expires_at 추가 ----------------------------------
alter table public.users
  add column if not exists plan_expires_at timestamptz;


-- 2. coupons 테이블 ----------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'monthly'
    check (type in ('monthly', 'annual')),
  created_by uuid references public.users(id) on delete set null,
  used_by uuid references public.users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  fan_event_request_id uuid references public.fan_event_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_coupons_code on public.coupons(code);
create index if not exists idx_coupons_used_by on public.coupons(used_by);
create index if not exists idx_coupons_fan_event on public.coupons(fan_event_request_id);


-- 3. RLS 활성화 ----------------------------------------------------
alter table public.coupons enable row level security;


-- 4. GRANT --------------------------------------------------------
grant select, update on public.coupons to authenticated;
-- insert/delete 는 service_role 또는 어드민 정책으로만 허용 — apply 시 update 만 사용


-- 5. RLS 정책 -----------------------------------------------------

-- 5-1. 본인이 사용한 쿠폰만 조회 가능
drop policy if exists "coupons_select_own_used" on public.coupons;
create policy "coupons_select_own_used"
  on public.coupons for select
  to authenticated
  using (auth.uid() = used_by);

-- 5-2. 본인이 사용 안 한 쿠폰을 자기 ID 로 잠그는 경우만 update 허용
--     (apply-coupon API 가 used_by, used_at 만 업데이트하는 시나리오)
--     ⚠️ code 로 조회 후 잠그는 트랜잭션은 service_role 로 처리하는 게 안전 —
--        이 정책은 fail-safe 용. 실제 적용은 admin 클라이언트로 수행.

-- 5-3. 관리자 — 전체 read
drop policy if exists "coupons_select_admin" on public.coupons;
create policy "coupons_select_admin"
  on public.coupons for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  );

-- 5-4. 관리자 — 전체 update
drop policy if exists "coupons_update_admin" on public.coupons;
create policy "coupons_update_admin"
  on public.coupons for update
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_admin = true
    )
  );

-- (insert/delete 정책 없음 → service_role 만 허용)
