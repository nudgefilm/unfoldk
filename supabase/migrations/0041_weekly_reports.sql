-- weekly_reports 테이블 — 매주 월요일 Claude Haiku 자동 생성 리포트 캐싱
-- RLS: select 전체 공개 / write는 service_role 전용 (cron에서만 INSERT)

create table if not exists weekly_reports (
  id          uuid        primary key default gen_random_uuid(),
  week_start  date        not null unique,   -- 해당 주 월요일 (YYYY-MM-DD)
  content_json jsonb      not null,          -- 7섹션 구조화 JSON
  created_at  timestamptz not null default now()
);

alter table weekly_reports enable row level security;

-- 전체 유저(비로그인 포함) select 허용 — Pro 게이팅은 앱 레이어에서 처리
create policy "weekly_reports_select_public"
  on weekly_reports for select
  using (true);

-- write는 service_role 키만 (RLS bypass) — 일반 유저 write 차단
-- INSERT/UPDATE/DELETE 정책 없음 = 일반 유저 완전 차단

-- anon/authenticated 롤에 SELECT 권한 명시 부여 (RLS policy 만으론 부족한 경우 대비)
GRANT SELECT ON weekly_reports TO anon;
GRANT SELECT ON weekly_reports TO authenticated;
