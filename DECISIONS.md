# DECISIONS.md — 기술적 결정 누적 기록

> UnfoldK (UnfoldKorea) 프로젝트의 모든 기술적 결정을 시간순으로 누적합니다.
> 외부 API 연동, DB 스키마 변경, 폴더 구조 변경, 라이브러리 채택은 **반드시** 이 파일에 기록.

---

## 작성 형식

```markdown
## YYYY-MM-DD 결정 제목

- 결정 내용:
- 이유:
- 대안으로 고려했던 것:
```

---

## 결정 기록

<!-- 새로운 결정은 이 아래에 최신순(위 → 아래)으로 추가 -->

## 2026-05-09 신규 테이블 추가 시 service_role GRANT 의무화 (인시던트 회고)

- 결정 내용:
  - 모든 신규 마이그레이션은 `public` 스키마에 테이블/시퀀스/함수를 만든 직후 `service_role` 에 명시적 GRANT 를 추가한다.
  - `migration 0013_service_role_grants.sql` 로 누락된 GRANT 를 보강하고, `alter default privileges in schema public ... to service_role` 로 향후 신규 객체에도 자동 부여되도록 박제.
  - `app/admin/users/page.tsx` — service_role 조회 실패 시 빈 배열로 fallback 하지 않고 화면 상단에 배너로 가시화 (code/message/hint 합쳐 노출). 동일 패턴을 다른 어드민 페이지에도 점진 적용.
- 이유:
  - 인시던트: `/admin/users` 가 빈 화면 → 추적 결과 service_role 이 `public.users` SELECT 권한 없어 PostgREST 가 403 (code 42501) 반환. JS SDK 가 PostgrestError 를 `error.message=""` 로 마스킹해 `console.error` 만 찍히고 페이지는 0행 fallback 으로 정상처럼 보임.
  - 신규 발급된 Supabase publishable/secret 키 시스템에선 옛 service_role 자동 bypass 가 보장되지 않음 — 명시 GRANT 가 사실상 표준.
  - 같은 사고가 새 테이블(KpopStats, fan_event_requests, coupons 등) 추가할 때마다 반복 가능 → default privileges 로 일괄 처리.
- 대안으로 고려했던 것:
  - 페이지마다 `try/catch` + `error.code === "42501"` 분기: 어드민 페이지 N개에 보일러플레이트만 늘어남.
  - service_role 대신 RPC SECURITY DEFINER 함수로 우회: GRANT 를 함수 레벨로 옮기는 표면적 해결.
  - Dashboard 에서 GRANT 만 한 번 박고 끝: DB 리셋·신규 테이블 추가 시 재발 — 거부.

## 2026-05-08 HallyuCalendar M+0 Phase 3.5 — 리마인더 영속화 + Resend D-Day 알림

- 결정 내용:
  - **DB**: `0004_reminder_sent_flags.sql` — `user_calendar_subscriptions` 에 `sent_d7/sent_d1/sent_dayof` boolean 컬럼 추가 (default false). 별도 `user_reminders`/`reminder_sends` 테이블 생성 안 함 — 토글이 이미 한 행에 있으니 같은 행에 sent 플래그 두는 게 단순.
  - **API**: `app/api/calendar/reminders/route.ts`
    - `GET ?event_id=` — 로그인 사용자의 해당 이벤트 리마인더 설정 (없으면 모두 false 디폴트)
    - `POST { event_id, remind_d7, remind_d1, remind_dayof }` — upsert. `notification_enabled` = OR. sent 플래그는 안 건드림.
    - 인증은 `createSupabaseServerClient` 의 `auth.getUser()` 로, RLS 가 본인 데이터 보장.
  - **Cron**: `app/api/cron/send-reminders/route.ts`
    - UTC day window `[D, D+1)` 으로 D-7 / D-1 / D-0 이벤트 조회 → 알림 켠 비발송 구독자 → Resend 발송 → `sent_*=true` 업데이트
    - 발송 실패와 플래그 update 실패를 분리 로깅 (후자는 다음 cron 에서 중복 발송 가능성)
    - `Promise.all` 로 3 kind 병렬, 내부 이벤트 루프는 직렬 (Resend rate 보호)
  - **인제스트 리팩토링**: `lib/ingest/{tmdb,youtube,lastfm}.ts` 로 로직 추출. 기존 라우트 3개는 thin wrapper 로 유지하고, 신규 `app/api/cron/ingest-all/route.ts` 가 동일 함수를 차례로 호출.
  - **vercel.json**: cron 슬롯 2개로 압축 (Hobby plan 한도)
    - `/api/cron/ingest-all` 04:00 UTC
    - `/api/cron/send-reminders` 09:00 UTC (= KST 18:00)
  - **EventDetailModal**: 로그인 시 `GET /api/calendar/reminders` 로 초기화, 토글 변경 시 300ms debounce 후 POST. 비로그인 사용자가 토글 클릭하면 `/login?redirect=/calendar` 로 이동.
- 이유:
  - sent 플래그를 같은 행에 두면 cron 쿼리가 join 없이 `eq(remind_X, true).eq(sent_X, false)` 한 줄로 끝나 단순. 감사 로그가 필요하면 Phase 3.6 에 별도 `reminder_sends` 도입 가능.
  - UTC 윈도우 기준 — cron 이 09:00 UTC (= KST 18:00) 에 돌아 그 시점의 "오늘 UTC 날짜"로 D-N 계산. 사용자가 KST 라 약간의 경계 케이스가 있지만 MVP 로 허용.
  - Resend `from` 형식 `"HallyuCalendar <noreply@unfoldk.com>"` — display name 포함해 인박스에서 브랜드 인식.
  - 인제스트 로직 추출은 ingest-all 재활용 + 단위 테스트 가능성 + 라우트 파일은 인증 어댑터 역할만 분리.
- 대안으로 고려했던 것:
  - `reminder_sends` 별도 로그 테이블: 멱등 dedup 와 감사에 우월하지만 MVP 에는 과해 보류.
  - cron 을 KST 자정 기준으로 맞추기 위해 `Asia/Seoul` 변환: UTC 윈도우 한 줄로 처리하는 단순함을 우선.
  - ingest-all 단일 라우트로 통합하고 기존 3개 라우트 삭제: 사용자 지시(개별 라우트 유지)에 따라 미실행. 디버깅·수동 트리거 편의도 같이 유지됨.

## 2026-05-08 HallyuCalendar M+0 Phase 3 — Auth (Google + 이메일, Apple 제거)

- 결정 내용:
  - **Apple OAuth 제거** (관리자 결정): 웹 전용 MVP 단계라 Apple Sign In 의무 없음, Apple Developer 연 $99·private email relay 복잡도 절약
    - login/signup 페이지의 "Continue with Apple" 버튼·SVG·Link 블록 전체 삭제
    - privacy/page.tsx 영·한 4곳에서 "Google/Apple OAuth" → "Google OAuth"
  - **middleware.ts** (프로젝트 루트): Supabase 세션 자동 갱신 + `/mypage` 가드
    - matcher 에서 `_next/static`·이미지 제외
    - 미로그인 + `/mypage/*` → `/login?redirect=...` 리디렉트
  - **app/api/auth/callback/route.ts**: OAuth code → session 교환
    - 성공 시 `/mypage` (또는 `?next=`)
    - 실패 시 `/login?error=auth` 또는 `?error=missing_code`
  - **login 페이지**: Google `signInWithOAuth` + 이메일 `signInWithPassword`
    - `redirectTo: ${origin}/api/auth/callback`
    - 성공 시 `router.push('/mypage')` + `router.refresh()` (RSC 캐시 무효화)
  - **signup 페이지**: Google + `signUp({ email, password, options.data: { plan, billing } })`
    - validation: 약관 미동의 → "Please agree...", 비밀번호 불일치 → "Passwords do not match"
    - 기존 `<Link href="/verify-email"><Button></Link>` 구조 → `<div><Button onClick></div>` (form scope 변화 최소화)
    - plan/billing 정보는 raw_user_meta_data 로 전달 (Stripe webhook 이 후일 public.users 갱신)
  - 기존 `lib/supabase/{browser,server}.ts` 그대로 사용 (사용자 plan 의 `client.ts` 명칭과 무관 — Phase 1 에 이미 생성됨)
- 이유:
  - middleware 에서 `getUser()` 호출이 세션 갱신을 트리거 — Supabase SSR 공식 패턴
  - `router.refresh()` 없으면 새 세션 쿠키를 RSC 가 인지 못 해 `/mypage` 가 여전히 미인증으로 보일 수 있음
  - signUp 시 plan/billing 을 `data` 에 넣으면 `auth.users.raw_user_meta_data` 에 저장 — public.users 트리거가 name/avatar 만 읽지만, 후일 Stripe 결제 webhook 에서 plan_type 업데이트 시 활용 가능
  - Link → button 변경은 §15 에 따라 v0 영역 수정으로 분류 — 사용자 명시 요청이라 진행
- 대안으로 고려했던 것:
  - Apple OAuth 유지 (Phase 3 에서 함께 구현): MVP 비용·복잡도 증가, App Store 미배포 단계라 우선순위 낮음
  - middleware 가드 제거하고 클라이언트에서만 redirect: SSR 보호 누락, 보안 약함
  - signUp 직후 자동 로그인 후 `/mypage` 이동: 이메일 인증 강제 흐름이 깨짐 — `/verify-email` 안내 페이지로 보내는 기존 흐름 유지

## 2026-05-08 HallyuCalendar M+0 Phase 2.5 — 캘린더 월 navigation 동적화

- 결정 내용:
  - `viewDate: Date` 단일 상태로 표시 월 관리 (월 1일 자정 로컬 기준)
    - `goPrev` / `goNext` 가 `setViewDate` 로 새 Date 생성 → React 가 re-render + useEffect 재호출
  - 파생값을 매 render 계산 (메모이제이션 미적용 — 비용 미미):
    - `monthQuery`(API 호출용 `YYYY-MM`)
    - `currentMonth` / `monthShort`(UI 라벨, en-US locale)
    - `firstDayOfWeek` / `daysInMonth`(달력 그리드 offset·반복 횟수)
    - `today`(실제 현재 월일 때만 양수, 아니면 `-1` 로 highlight 비활성)
  - useEffect dep `[monthQuery]` — 월 string 동등성으로 리페치 트리거
  - `AbortController` 도입 — 빠른 연속 클릭 시 stale 응답 덮어쓰기 방지
  - Modal·Upcoming 배지에 viewDate 전파 → 하드코딩 "May"/"2026"/"MAY" 제거
  - Upcoming 필터: 표시 월이 실제 현재 월일 때만 `e.date >= today` cutoff, 아니면 전체 노출
- 이유:
  - Date 한 개로 관리하면 month 산술(prev/next)이 `new Date(y, m-1, 1)` / `new Date(y, m+1, 1)` 로 자동 wrap (Dec→Jan, year 증감 포함)
  - useState(() => initial) 형태로 SSR mismatch 회피 — 첫 렌더에서만 new Date() 호출
  - useEffect dep 을 viewDate(객체) 가 아니라 monthQuery(문자열) 로 둔 이유: viewDate 는 매 렌더 새 객체일 수 있어 무한 루프 위험. 문자열은 값 동등성.
- 대안으로 고려했던 것:
  - `{year, month}` 객체 상태: 산술 시 wrap 직접 처리 필요해 더 번거로움
  - `useMemo` 로 파생값 캐싱: 월 1회 변경되는 값들이라 비용·코드 복잡도 대비 이득 미미
  - URL 쿼리(`?month=YYYY-MM`)로 상태 동기화 + 공유 가능 링크: Phase 3 후보 (현재는 SPA 내 로컬 상태로 충분)

## 2026-05-08 HallyuCalendar M+0 Phase 2 — TMDB / YouTube / Last.fm 자동 인제스트

- 결정 내용:
  - 외부 API 래퍼 3종 (`lib/api/{tmdb,youtube,lastfm}.ts`)
    - TMDB: v4 Bearer 토큰, `discover/tv?with_origin_country=KR` 인기순 fetch
    - YouTube: `googleapis` SDK, `search.list` (eventType=upcoming) + `videos.list` (liveStreamingDetails)
    - Last.fm: `tag.gettopartists?tag=k-pop`
  - Cron 스타일 라우트 3종 (`app/api/cron/ingest-{tmdb,youtube,lastfm}/route.ts`)
    - 인증: `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron 자동 헤더 호환)
    - 적재: `createSupabaseAdminClient` (service_role) 로 RLS 우회 upsert
    - 멱등성: `(source_api, source_id)` unique 제약으로 onConflict 갱신
  - 역할 분리:
    - **TMDB → 'drama'**: 미래 first_air_date 만 필터, KST 21시로 가정
    - **YouTube → 'comeback'**: Last.fm 시드 아티스트 15명 × 검색 3건 (≈1,500 quota units/run)
    - **Last.fm → 시드 전용**: release date 가 없어 직접 이벤트 생성 안 함
  - `vercel.json` cron 스케줄: TMDB 04:00 / YouTube 05:00 / Last.fm 06:00 UTC
  - `.env.local` 에 `CRON_SECRET` 항목 추가 (사용자가 직접 채움)
- 이유:
  - Last.fm 자체 API 에 album release date 가 없음 — 트렌딩 시그널은 있지만 미래 이벤트 생성에 부적합. MusicBrainz 2-hop 조회는 Phase 2.5 로 분리.
  - YouTube `eventType=upcoming` 은 Premiere(예약 영상)·Live 모두 포함 — 컴백 M/V 가 보통 Premiere 로 예약되므로 신뢰도 높음.
  - 쿼터 보호: 아티스트당 search.list(100u) + videos.list(1u) = 101u, 15명 = 1,515u 로 일일 10,000u 한도의 15% 만 사용. 다른 서비스 확장 여유 확보.
  - service_role 클라이언트 분리 (`lib/supabase/admin.ts`) 로 인제스트 잡이 RLS 정책 작성 부담 없이 동작.
- 대안으로 고려했던 것:
  - Vercel Cron 단일 `ingest-all` 라우트로 통합 (Hobby plan 2개 cron 한도 회피) → Pro 가정으로 분리 유지 (디버깅/재실행 편의)
  - Last.fm + MusicBrainz 2-hop 으로 정확한 신보 감지 → 복잡도 증가, Phase 2.5 로 미룸
  - YouTube 아티스트 리스트 하드코딩 → Last.fm 동적 시드가 트렌드 반영에 유리

## 2026-05-08 HallyuCalendar M+0 Phase 1 — 인프라 + DB 스키마 + 캘린더 API 연결

- 결정 내용:
  - 백엔드 SDK 설치: `@supabase/supabase-js`, `@supabase/ssr`, `resend`, `googleapis`
  - Supabase 클라이언트 3분기: `lib/supabase/{server,browser,admin}.ts`
    - server: `createServerClient` + Next 15 async cookies (RLS용 세션 전달)
    - browser: `createBrowserClient`
    - admin: service_role 직결, 인제스트 잡·웹훅 전용 (클라이언트 import 금지)
  - DB 스키마 4개 테이블 (`supabase/migrations/0001_init.sql`):
    - `users` — auth.users 확장 프로필 (plan_type, subscription_status)
    - `subscriptions` — Stripe 구독 기록 (월/연 + expires_at)
    - `hallyu_calendar_events` — 이벤트 마스터, `(source_api, source_id)` unique 로 인제스트 중복 방지
    - `user_calendar_subscriptions` — 사용자별 리마인더(d7/d1/dayOf) 토글
  - RLS 정책:
    - `is_premium=false` 이벤트는 `anon`+`authenticated` 모두 read 허용 (랜딩에서도 미리보기 가능)
    - `is_premium=true` 는 `users.plan_type in ('monthly','annual') AND subscription_status='active'` 만 read
    - 이벤트 write 는 service_role 전용 (정책 미부여)
  - `auth.users` insert 트리거 → `public.users` 자동 프로필 생성 (Google/Apple OAuth 대비)
  - API 라우트: `GET /api/calendar/events?month=YYYY-MM` — zod 검증, RLS 가 게이팅 처리
  - 이벤트 타입 매핑은 API 레이어에서 처리 (DB: `comeback/drama/concert/fanmeet` ↔ UI: `K-pop/K-drama/Concert/Fan Meet`)
  - 시드 5개(현재 mock) → `supabase/seed.sql` 로 이전, `(source_api='manual', source_id)` 충돌 시 skip
- 이유:
  - 클라이언트 분기는 Next.js App Router + Supabase SSR 공식 패턴 — RSC 에서 cookies 미사용 시 RLS 우회 발생
  - `is_premium` 을 RLS 레벨에서 처리 → 클라이언트 코드에서 가드 누락해도 안전 (defence in depth)
  - 타입 매핑을 API 레이어에 두면 v0 UI 의 EventType union 을 건드리지 않아도 됨 (CLAUDE.md §10-9)
  - source_api/source_id unique 는 향후 Phase 2 인제스트(YouTube/TMDB/Last.fm)에서 멱등성 확보
- 대안으로 고려했던 것:
  - DB 와 UI 의 type 라벨을 통일 (UI 변경 필요 — v0 원칙 위배)
  - 클라이언트에서 직접 supabase-js 로 read (RLS 정책 작성 부담은 동일하나 SSR/SEO 미래 확장에 불리)
  - `is_premium` 게이팅을 API 레이어에서 처리 (RLS 가 더 안전)

