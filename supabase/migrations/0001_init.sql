-- =============================================================
-- UnfoldK 초기 스키마 (M+0 HallyuCalendar)
-- 5개 서비스가 단일 Supabase 프로젝트를 공유하는 통합 구조
-- 적용 방법: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================

-- 0. 확장 ------------------------------------------------------
create extension if not exists "uuid-ossp";


-- 1. users (auth.users 확장 프로필) ----------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  avatar_url text,
  plan_type text not null default 'free'
    check (plan_type in ('free', 'monthly', 'annual')),
  subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'active', 'past_due', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- 2. subscriptions (Stripe 구독 기록) --------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_type text not null check (plan_type in ('monthly', 'annual')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'annual')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  stripe_subscription_id text unique,
  status text not null default 'active'
    check (status in ('active', 'canceled', 'past_due')),
  created_at timestamptz not null default now()
);


-- 3. hallyu_calendar_events (이벤트 마스터) --------------------
create table if not exists public.hallyu_calendar_events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('comeback', 'drama', 'concert', 'fanmeet')),
  title text not null,
  artist_or_drama text not null,
  event_date timestamptz not null,
  event_time_label text,                   -- "7:00 PM KST" 같은 표시용 라벨
  description text,
  source_api text,                          -- 'youtube', 'tmdb', 'lastfm', 'manual'
  source_id text,                           -- 외부 API 의 원본 ID (중복 인제스트 방지)
  thumbnail_url text,
  is_premium boolean not null default false, -- Concert/Fan Meet 등 유료 컨텐츠
  created_at timestamptz not null default now(),
  unique (source_api, source_id)
);


-- 4. user_calendar_subscriptions (사용자 구독·리마인더) --------
create table if not exists public.user_calendar_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.hallyu_calendar_events(id) on delete cascade,
  remind_d7 boolean not null default false,
  remind_d1 boolean not null default true,
  remind_dayof boolean not null default true,
  notification_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);


-- 5. 인덱스 ----------------------------------------------------
create index if not exists idx_events_date on public.hallyu_calendar_events(event_date);
create index if not exists idx_events_type on public.hallyu_calendar_events(type);
create index if not exists idx_user_subs_user on public.user_calendar_subscriptions(user_id);
create index if not exists idx_subs_user on public.subscriptions(user_id);


-- 6. updated_at 자동 갱신 트리거 -------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();


-- 7. auth.users → public.users 자동 프로필 생성 ----------------
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


-- 8. RLS 활성화 ------------------------------------------------
alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.hallyu_calendar_events enable row level security;
alter table public.user_calendar_subscriptions enable row level security;


-- 9. 테이블 GRANT (anon/authenticated 권한 부여) ----------------
-- Supabase 자동 grant 가 항상 적용되지는 않으므로 명시적으로 부여
grant usage on schema public to anon, authenticated;
grant select on public.hallyu_calendar_events to anon, authenticated;
grant select, update on public.users to authenticated;
grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.user_calendar_subscriptions to authenticated;


-- 10. RLS 정책 -------------------------------------------------

-- 10-1. users: 본인만 조회·수정
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id);

-- 10-2. subscriptions: 본인 구독 조회만 허용 (insert/update 는 service_role 또는 Stripe webhook 만)
drop policy if exists "subs_select_own" on public.subscriptions;
create policy "subs_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- 10-3. hallyu_calendar_events:
--   - 무료 이벤트(is_premium=false): 모두에게 read 허용 (비로그인 포함)
--   - 유료 이벤트(is_premium=true): plan 활성 사용자만 read
--   - write 는 service_role 전용 (인제스트 잡)
drop policy if exists "events_select_free_for_all" on public.hallyu_calendar_events;
create policy "events_select_free_for_all"
  on public.hallyu_calendar_events for select
  to anon, authenticated
  using (
    is_premium = false
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.plan_type in ('monthly', 'annual')
        and u.subscription_status = 'active'
    )
  );

-- 10-4. user_calendar_subscriptions: 본인 데이터 전권
drop policy if exists "user_calsubs_all_own" on public.user_calendar_subscriptions;
create policy "user_calsubs_all_own"
  on public.user_calendar_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
