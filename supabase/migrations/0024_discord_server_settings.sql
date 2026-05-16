-- =============================================================
-- 0024 — discord_server_settings (HallyuBot multi-server enrollment)
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================
--
-- 모델:
--   - 각 Discord 서버(guild)의 4 채널 ID 매핑 저장
--   - /setup 슬래시 명령으로 enrollment + upsert
--   - cron(/api/cron/discord-daily)이 모든 row 순회해 자동 포스팅
--
-- 정책:
--   - 사용자 가시 데이터 아님 → anon/authenticated 모두 access 없음
--   - service_role 만 read/write (lib/supabase/admin.ts → admin client)
--   - RLS 활성화하되 정책 부재 → public 접근 자동 차단
-- =============================================================

-- 1. 테이블 ----------------------------------------------------
create table if not exists public.discord_server_settings (
  guild_id text primary key,                       -- Discord guild snowflake (string — 64bit overflow 회피)
  schedule_channel_id text,                        -- daily-schedule (오늘의 K-pop/K-drama 일정)
  charts_channel_id text,                          -- kpop-charts (Top 10)
  drama_channel_id text,                           -- drama-updates (방영 드라마)
  korean_channel_id text,                          -- korean-phrase (오늘의 표현)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- 2. updated_at 트리거 — 0001 의 public.set_updated_at 재사용 --
drop trigger if exists trg_discord_settings_updated_at on public.discord_server_settings;
create trigger trg_discord_settings_updated_at
  before update on public.discord_server_settings
  for each row execute function public.set_updated_at();


-- 3. RLS 활성화 ------------------------------------------------
-- 정책 미정의 → anon/authenticated 자동 차단. service_role 은 RLS bypass.
alter table public.discord_server_settings enable row level security;


-- 4. GRANT — service_role 만 -----------------------------------
-- 봇 백엔드(admin client)만 접근. 일반 사용자 노출 경로 없음.
grant select, insert, update, delete on public.discord_server_settings to service_role;
