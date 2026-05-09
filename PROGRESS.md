# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.

---

## 현재 상태 (2026-05-09 / Pro 잠금 판별 유틸 통일 + is_admin 우대)

- **완료**:
  - **전수 점검** — `plan_type` 비교 / `isPro|isPaid|isSubscribed` 변수 / `monthly|annual` 패턴 모두 검색
    - **annual 누락 케이스 0건** — 모든 곳이 이미 `monthly || annual` 둘 다 체크 (사용자 우려 1번 해소)
    - **`is_admin` 우대 전혀 미구현** — 어드민이 free 면 일반 서비스 잠금됐던 갭 발견
    - **인라인 비교 9곳** — 같은 로직 산재, 향후 변경 시 누락 위험
  - **`lib/auth/plan.ts` 신규** — 유틸 3개:
    - `hasProAccess({ planType, isAdmin })`: 일반 서비스 잠금 분기 표준
    - `isProPlan(planType)`: 결제·관리 UI 한정 (admin 무시)
    - `normalizePlanType(value)`: DB 값 → 안전한 union 정규화
  - **5개 파일 수정** — UI/스타일 무변경, 판별 로직만:
    - `app/api/dramas/route.ts` — `is_admin` select + `hasProAccess`
    - `app/api/dramas/recommend/route.ts` — 동일
    - `app/kpop/page.tsx` — `is_admin` select + `isPro` 상태 도입 + 분기 2곳 (visibleLimit, Pro overlay)
    - `app/api/calendar/events/route.ts` — 어드민이면 service role 클라이언트로 RLS 우회
  - **의도적으로 수정 안 한 파일** — 결제 페이지·사이드바 라벨은 사실관계 표시라 어드민 우대 무관 (`/mypage/subscription`, `/mypage`, `/mypage/fan-events`)
- **다음 (사용자 작업)**:
  1. **로컬 `pnpm dev` 검증** — 어드민 계정으로 `/kpop`, `/drama`, `/calendar` 진입 → Top 20 / Pro overlay 미노출 / premium events 노출 확인
  2. **Vercel 자동 배포 확인** — 푸시 후 새 빌드 성공
- **별도 작업 권장 (다음 세션)**:
  - **RLS 정책에 `is_admin=true` 분기 추가** (SQL migration) — calendar API 의 service role 우회를 SQL 레벨에서 처리하면 다른 보호 테이블도 같은 패턴 일괄 적용 가능
  - **`subscription_status === 'active'` 검증** — cancel 후 expires 까지 race window 정책 결정 후 `hasProAccess` 에 status 인자 추가
- **블로커**: 없음 (직전 블록의 LMS Products Publish / USD 심사 대기는 외부)

---

## 현재 상태 (2026-05-09 / LMS 운영 준비 — webhook 8 이벤트 + 환경변수 + 심사 발송)

- **완료**:
  - **webhook 처리 이벤트 6 → 8 완성** — `subscription_expired` + `subscription_payment_success` 핸들러 추가
    - `subscription_expired`: `plan_type='free'` + `subscription_status='expired'` (cancelled 와 status 만 차이)
    - `subscription_payment_success`: `plan_expires_at` 갱신
      - payload 가 invoice 객체라 `renews_at` 없음 → `created_at + plan_type 기간(1m/1y)` 으로 추정
      - `subscription_updated` 가 함께 발송될 때 정확한 `renews_at` 로 덮어씀 (안전망)
    - `InvoiceAttributes` 인터페이스 신규 + `WebhookData.attributes` 타입 인터섹션 확장
    - 헤더 주석 8 이벤트 갱신
  - **Vercel 환경변수 17개 등록 완료** (사용자 직접) — LMS 7개 + 신규 `ANTHROPIC_API_KEY` + 기존 Supabase·Resend·LASTFM·TMDB·YOUTUBE·CRON·NEXT_PUBLIC_SITE_URL 9개
  - **LMS variant ID 확인** — Monthly: `1628505` / Annual: `1628480` (LMS API `/v1/variants` 호출 결과)
  - **`.env.local` Stripe → Lemon Squeezy 정리** — Stripe 5 자리 → LMS 7개 (`API_KEY/STORE_ID/WEBHOOK_SECRET/MONTHLY_URL/ANNUAL_URL/VARIANT_ID_MONTHLY/VARIANT_ID_ANNUAL`)
  - **LMS USD 통화 심사 메일 답장 발송** — 현재 KRW 등록 상태(₩21,900/월·₩175,000/년)를 USD($15/$120) 로 변경 신청. 답장 대기 중.
  - **직전 커밋(a9ef950) 보강 작업** 다수 — Switch Plan 라우트, webhook 3 case (created/updated/resumed), CLAUDE.md §2/§7/§11/§12/§13 정정, 백필 7건
- **다음 (사용자 작업)**:
  1. **LMS Webhooks 이벤트 8개 체크 갱신** — 기존 6개에 `subscription_updated`, `subscription_resumed` 추가
  2. **Vercel Redeploy** — 본 커밋 후 자동 배포 또는 수동 Redeploy ("Use existing Build Cache" 해제 권장)
  3. **LMS Products Publish** — 두 product 모두 현재 `pending` → 결제 차단 상태
  4. **LMS USD 심사 결과 대기** — 승인 시 product 재설정 + variant ID 갱신 (env 만 수정해 코드 재배포 없이 대응 가능)
- **블로커**:
  - LMS 두 product `status=pending` — Publish 전 결제 차단
  - LMS USD 심사 대기 — 승인 후 KRW → USD 전환 + variant ID 재발급 가능성. variant ID env 관리 패턴이 사전 대비.

---

## 현재 상태 (2026-05-09 / Lemon Squeezy Switch Plan + webhook 보강)

- **완료**:
  - **`.env.local` 정리** — Stripe 자리 → Lemon Squeezy 5개 키. 추가로 `LEMONSQUEEZY_VARIANT_ID_MONTHLY=1628505`, `LEMONSQUEEZY_VARIANT_ID_ANNUAL=1628480` (LMS API `/v1/variants` 호출로 확정)
  - **`/api/lemonsqueezy/switch` 신규** — `updateSubscription(subscriptionId, { variantId })` 로 기존 구독 prorate 변경. 미구독 유저는 `/checkout` 으로 자동 위임. DB 갱신은 안 함(webhook 단일 진실)
  - **webhook 보강**:
    - `SubscriptionAttributes` 인터페이스 확장 (`variant_id`, `renews_at`, `ends_at`)
    - `variantIdToPlan()` 헬퍼 (env 기반 매핑, 하드코딩 금지)
    - `subscription_created`: order_created 가 이미 처리, 보강 로그
    - `subscription_updated`: variant_id → plan_type 재매핑 + plan_expires_at 갱신 (`ends_at` 우선, 없으면 `renews_at`)
    - `subscription_resumed`: cancel 후 재구독 시 plan_type 복구
    - 헤더 주석에도 6개 이벤트 모두 명시
  - **`/mypage/subscription`** Switch Plan 버튼 2곳 href: `/checkout` → `/switch` (UI 무변경)
- **다음 (사용자 작업)**:
  1. **LMS 대시보드 → Webhooks** — URL이 `https://unfoldk.com/api/lemonsqueezy/webhook` 인지 + 6개 이벤트 모두 체크돼 있는지 확인:
     `order_created`, `subscription_created`, `subscription_updated`, `subscription_resumed`, `subscription_cancelled`, `subscription_payment_failed`
  2. **Vercel 환경변수 7개 등록** — 기존 5개(`LEMONSQUEEZY_API_KEY/STORE_ID/WEBHOOK_SECRET`, `NEXT_PUBLIC_LMS_MONTHLY_URL/ANNUAL_URL`) + 신규 2개(`LEMONSQUEEZY_VARIANT_ID_MONTHLY/ANNUAL`)
  3. **LMS product Publish** — 두 product 모두 현재 `status=pending`. Publish 전엔 결제 차단됨.
- **블로커**:
  - **LMS 가격 단위 KRW** — 글로벌(영어권+동남아) 타깃에 부적합. USD 변경은 LMS 심사 대기 (이메일 발송 완료). 심사 결과 후 product 재설정 필요. variant ID 가 바뀔 가능성 있어 env 관리 패턴이 사전 대비됨.
  - LMS 두 product 모두 `status=pending` — Publish 처리 전까지 결제 차단.

---

## 현재 상태 (2026-05-09 / KdramaMatch M+2 데이터 연동)

- **완료**:
  - **migration 0014** — `dramas`, `user_watchlist` 테이블 + RLS + service_role GRANT (0013 패턴)
  - **`lib/api/tmdb.ts` 확장** — `fetchTopRatedKoreanDramas`, `fetchTvDetail`, `fetchTvGenreMap`, `normalizeGenre`, `mapTmdbStatus`
  - **`lib/ingest/dramas.ts`** — TMDB 인기·top_rated 두 소스 통합 인제스트, `tmdb_id` 멱등 upsert
  - **`/api/cron/ingest-tmdb-dramas`** + vercel.json 매일 UTC 05:30 cron (현재 4개 슬롯 — Pro plan 가정)
  - **`/api/dramas` GET** — genre/platform/year 필터 + q 검색, plan-based limit (anon 6 / free 12 / paid 100)
  - **`lib/claude/recommend-dramas.ts` + `/api/dramas/recommend` POST** — Claude Haiku 추천 + JSON 파싱 + fallback (genre 매칭 + rating 정렬)
  - **`/api/dramas/watchlist`** GET/POST/PATCH/DELETE — 로그인 필수, RLS 본인 행 격리, drama join
  - **`next.config.mjs`** — `image.tmdb.org` remotePatterns 추가
  - **`app/drama/page.tsx` 리팩토링** — Mock 제거 + 4개 API 연동 (필터·추천·시청 목록·등록), UI className/style/DOM 무변경
- **다음 (사용자 작업)**:
  1. **Supabase**: `0014_kdrama_match.sql` SQL Editor 실행
  2. **Vercel cron 한도 확인**: 현재 4개 cron 등록 — Hobby plan 은 2개 한도. Pro 면 정상, Hobby 면 ingest-all 통합 필요
  3. **인제스트 트리거 테스트**: `Invoke-RestMethod -Uri "http://localhost:3000/api/cron/ingest-tmdb-dramas" -Headers @{ Authorization = "Bearer ${env:CRON_SECRET}" }` → JSON 응답에 `scanned`, `upserted` 확인
  4. **/drama 페이지 검증**: 로컬에서 칩 선택 → "Get my recommendations" → 카드 노출, 로그인 후 + 버튼 → wantToWatch 탭 갱신
- **다음 세션 후보**:
  - **MyDramaList API 연동** (TMDB 보강용 — 키 신청 수일 소요)
  - **TMDB watch/providers 인제스트** — `platform` 필드 채우기 (region 정책 결정 후)
  - **AI Drama Summary (Pro 잠금 해제)** — Claude 로 에피소드 요약, 캐릭터 관계도 — 현재 blur 처리만 있음
- **블로커**: 없음

---

## 현재 상태 (2026-05-09 / 어드민 인시던트 + 에러 가시화)

- **완료**:
  - **`/admin/users` 빈 화면 인시던트 해결** — service_role 이 `public.users` SELECT 권한 없어 PostgREST 가 403 (code 42501) 반환. JS SDK 가 `error.message=""` 로 마스킹해 0행 fallback. 빈 배열을 정상으로 오인.
  - **migration 0013_service_role_grants.sql 추가** — `public` 스키마 전체에 service_role GRANT + `alter default privileges` 로 신규 객체 자동 부여 + `handle_new_user` 트리거 idempotent 재설치
  - **Supabase Dashboard 적용 완료** (사용자 직접 실행) → 4명 모두 `public.users` 에 정상 존재 확인 (트리거는 처음부터 잘 작동 중이었음 — 단지 service_role 이 못 읽었을 뿐)
  - **admin 권한 부여**: `nudgefilm@gmail.com` → `is_admin = true`
  - **`app/admin/users/page.tsx` 개선** — 조회 실패 시 빈 배열로 숨기지 않고 화면 상단에 빨간 배너로 code/message/hint 노출 (재발 시 1초 만에 진단 가능)
  - **DECISIONS.md 갱신** — 신규 테이블 추가 시 service_role GRANT 의무화 정책 박제
- **진행 중**: 없음
- **다음 세션 후보**:
  - 다른 어드민 페이지(`/admin/events`, `/admin/fan-events`, `/admin/kpop`, `/admin/cron`)에도 동일한 에러 가시화 패턴 적용 검토
  - `app/api/admin/*` 라우트들도 PostgrestError 가시화 동일 적용
- **블로커**: 없음

---

## 현재 상태 (2026-05-08)

- **완료 (이번 세션)**:
  - 히어로 섹션 ghost globe 마크 추가 + float 애니메이션 (motion-reduce 대응)
  - 파비콘 교체 + 브라우저 탭 타이틀 'UnfoldK' 단순화
  - `Work/` 폴더 `.gitignore` 추가
  - 이용약관 언어 토글을 Privacy 와 동일 위치·스타일로 통일
  - **HallyuCalendar M+0 Phase 1 완료** — 인프라 / DB 스키마 / RLS / API / UI 연동
    - 0001 + 0002 GRANT + 0003 events RLS 정책 분리 모두 적용
    - /calendar 비프리미엄 3개 정상 노출 확인
  - **HallyuCalendar M+0 Phase 2 완료** — 외부 API 자동 인제스트
    - `lib/api/{tmdb,youtube,lastfm}.ts` 래퍼
    - `lib/cron/auth.ts` — CRON_SECRET 검증
    - `app/api/cron/ingest-{tmdb,youtube,lastfm}/route.ts` 3종
    - `vercel.json` — daily cron schedule (UTC 04/05/06시)
    - 디버그 강화: cron auth 진단·funnel 카운트·source_id dedup·PostgrestError 풀필드 응답
    - **검증 완료**: TMDB 40건 스캔 / YouTube 9건 적재 성공 (사용자 확인)
  - **HallyuCalendar M+0 Phase 2.5 완료** — 캘린더 월 navigation 동적화
    - `viewDate: Date` 상태 + `goPrev` / `goNext` 핸들러
    - `monthQuery` 변경 시 events API 자동 재호출 (AbortController 로 stale 방지)
    - 빈 칸 offset / 일수 / today highlight / Modal 월·년 / Upcoming 배지 전부 동적
    - UI 스타일 무변경 (CLAUDE.md §10-9)
    - "Upcoming this month" 제목 동적화 (비현재 월은 "Events in {month}")
  - **CLAUDE.md §15 규칙 우선순위 추가** — 사용자 명시 요청이 모든 원칙보다 우선, UI 변화 사전 안내 의무
  - **HallyuCalendar M+0 Phase 3 (Auth) 완료** — Google + 이메일 (Apple 제거)
    - 사용자 검증 완료: Google 로그인 → /mypage 이동 정상
  - **HallyuCalendar M+0 Phase 3.5 완료** — 리마인더 영속화 + Resend D-Day 알림
    - `0004_reminder_sent_flags.sql` — sent_d7/d1/dayof boolean 컬럼 추가
    - `app/api/calendar/reminders/route.ts` — GET/POST (로그인 가드 + RLS)
    - `app/api/cron/send-reminders/route.ts` — UTC day window 로 D-7/D-1/D-0 발송, sent 플래그 갱신
    - `lib/ingest/{tmdb,youtube,lastfm}.ts` — 라우트에서 로직 추출 (재사용용)
    - `app/api/cron/ingest-all/route.ts` — 3개 인제스트 통합 (Vercel Hobby cron 한도 대응)
    - `vercel.json` — cron 2개로 압축: ingest-all 04:00 UTC + send-reminders 09:00 UTC (KST 18:00)
    - `EventDetailModal` — 로그인 시 GET 초기화 + 토글 변경 시 300ms debounce POST + 비로그인 토글은 /login?redirect=/calendar
- **진행 중**: 없음
- **다음 (사용자 작업)**:
  1. **Supabase**: `0004_reminder_sent_flags.sql` 실행
  2. **Resend**:
     - https://resend.com/domains 에서 `unfoldk.com` 도메인 verify (DNS SPF/DKIM 레코드 추가)
     - 발송 발신자 `noreply@unfoldk.com` 사용 가능 상태 확인
     - 도메인 verify 전엔 본인 이메일로 테스트 가능 (resend 디폴트 sandbox)
  3. **로컬 테스트**:
     - 로그인 후 `/calendar` 이벤트 클릭 → 모달의 D-7/D-1/Day of 토글 → Supabase Table Editor 에서 `user_calendar_subscriptions` 행 확인
     - 발송 테스트 (PowerShell):
       ```
       Invoke-RestMethod -Uri "http://localhost:3000/api/cron/send-reminders" `
         -Headers @{ Authorization = "Bearer 8F4BA657F21F2651B53488BFB128D91A" }
       ```
       → JSON 응답에 `summary.sent`, `breakdown.{d7,d1,dayof}` 표시
     - 시드 이벤트 날짜가 2026-05-15 / 21 / 28 등이라 오늘(2026-05-08)이 D-7 매칭되면 발송 발생
- **다음 세션 (확정)**:
  1. **Google 프로필 바인딩** — OAuth 로그인 시 `raw_user_meta_data` 의 name/avatar_url 을 `public.users` 에 반영. `handle_new_user` 트리거 외에 OAuth 재로그인 시 갱신 로직 + `/mypage` 헤더에 표시.
  2. **Phase 4 어드민 페이지** — 수동 인제스트 트리거 (TMDB/YouTube/all 버튼), 이벤트 목록·편집, 발송 로그 뷰. 어드민 권한은 `users.role='admin'` 또는 환경변수 화이트리스트 (둘 중 채택은 다음 세션에서).
  3. **Resend 도메인 verify** — `unfoldk.com` DNS 에 SPF/DKIM TXT 레코드 등록 (사용자 작업), verify 후 `noreply@unfoldk.com` 으로 운영 발송 가능.
- **이후 후보**:
  - **Phase 4 결제**: Stripe Hallyu Pass 구독 + webhook plan_type 갱신
  - **Phase 2.6**: URL 쿼리 month 동기화, MusicBrainz 신보 감지
- **블로커**:
  - Google Calendar OAuth 앱 심사 신청 (출시 6주 전, 별도 트랙)
  - Stripe 키 미입력 (Phase 3 결제 단계에서 필요)
  - Vercel Cron Hobby plan 은 2개 한도 — Pro 또는 라우트 통합 필요
  - `next.config.mjs` 의 `typescript.ignoreBuildErrors: true` 아직 활성 — strict 전환은 Phase 3 끝에 검토

---

## 이전 세션 기록

### 2026-05-09 (세션 4 — KpopStats M+1 + 결제 페이지 분기) — 백필 (2026-05-09 정리)

> ⚠️ 백필 항목. 당시 PROGRESS.md 즉시 갱신 누락 → 이후 세션에서 회고 기록.

- **KpopStats (M+1) 구현 완료** (commit `cde3955`)
  - migration 0012: `kpop_artists` / `kpop_stats_daily` + RLS + 25명 시드 (lastfm_name 채움, youtube_channel_id 어드민 입력 대기)
  - `lib/api/youtube.ts::getChannelStats()` — channels.list 50명/call (1 unit)
  - `lib/api/lastfm.ts::getArtistInfo()` — listeners + playcount
  - `lib/ingest/kpop-stats.ts` — YouTube + Last.fm 병렬 호출 + 7일전 total_views 비교로 weekly_views 계산
  - `/api/cron/ingest-kpop-stats` (vercel.json 매일 07:00 UTC) — vercel.json cron 슬롯 3개 도달
  - 공개 API: `/api/kpop/{artists,artists/[id],charts}` — 비회원 Top 5 / 로그인 Top 10 / 유료 Top 20 분기
  - `/kpop` 페이지: mock 제거 + spotlight 클릭 시 30일 트렌드 SVG
  - `/admin/kpop` + `/api/admin/kpop[/id][/refresh]` — CRUD + 단건 즉시 갱신
- **migration 0012 재적용 핫픽스** (commit `6f41e27`) — `create unique index on (lower(name))` 가 INDEX 일 뿐 constraint 가 아니라 `on conflict on constraint` 매칭 실패(42704). 함수 unique index 폐기 + 일반 unique constraint 로 교체 + 시드 `on conflict (name)` 으로 변경.
- **/mypage/subscription plan_type 분기** (commit `62d652f` + `ae7a4c2`)
  - 기존 mock 데이터로 모든 유저에게 Hallyu Pass Active UI 노출되던 버그 수정
  - Free 유저: 업그레이드 카드 2개 + 쿠폰 보유자용 /redeem 안내
  - 유료 유저: Active 카드 + Switch Plan (월간↔연간 양방향 대칭)
  - 사이드바: mock("Mia T.") → Google full_name + avatar fallback
- **히어로 고스트 지구본 렌더 부하 절감** (commit `5db1b78`)
  - 화면 밖에서 frameloop "never" (IntersectionObserver, rootMargin 100px)
  - 도시 마커 80개 opacity 갱신 매 프레임 → 0.5초 단위 step (~30배 절감)

### 2026-05-08 (세션 3 — Phase 4 + 인증 개편 + 결제 + 쿠폰) — 백필 (2026-05-09 정리)

> ⚠️ 백필 항목. 당시 PROGRESS.md 즉시 갱신 누락 → 이후 세션에서 회고 기록.

- **HallyuCalendar M+0 Phase 4 — 어드민 페이지** (commits `60dd46a`, `f498992`)
  - migration 0005: `users.is_admin` + `fan_event_requests` + `cron_logs` + RLS 8개
  - middleware: `/admin` 가드 (미로그인→/login, 비관리자→/)
  - `/admin` 5페이지: 대시보드(MRR/MAU), 유저 관리(검색·플랜·is_admin 토글), 이벤트 CRUD, 팬 행사 승인·거절, Cron 모니터(수동 실행 프록시)
  - `/api/admin` 5개 라우트 + `requireAdmin` 헬퍼
  - 기존 cron 라우트 instrument: 결과를 `cron_logs` 에 기록
  - footer ©를 /admin 진입점으로 wrap
  - Google 프로필 바인딩: 사이드바·헤더에 full_name·avatar 동적 표시
- **세션·Auth 안정화 디버깅 (다수 커밋)** — Supabase SSR cookie 처리 버그 추적
  - `setAll` 멀티 호출 시 쿠키 유실 → callback 쿠키 버퍼 패턴(A안) 적용
  - middleware/callback redirect 응답에 refresh 쿠키 명시 복사
  - mypage 클라 redirect 제거 + 보호 라우트 prefetch=false + ?next= 파라미터 일원화
  - header 깜빡임 방지 — `isAuthReady` gate 추가
  - 어드민 접근 거부 토스트 — `?toast=unauthorized` 미들웨어 부착 + 랜딩 1초 노출
- **인증 플로우 개편 — Start 버튼 단일화** (commit `7bf5cbc`)
  - "Log in / Try for Free" → 단일 "Start" 버튼 (Header·Hero·CTA 모두 StartModal 트리거)
  - StartModal: Google OAuth 진입만 담당, 신규/기존 분기는 callback 에서
  - migration 0007: `users.agreed_to_terms` / `agreed_at` 컬럼 + 기존 유저 백필
  - `/api/auth/callback`: `agreed_to_terms` 조회로 신규 → `/start`, 기존 → next
  - `/start`: 신규 가입자 플랜 선택 + 약관 동의 화면 (signup UI 재활용)
  - `/api/auth/complete-signup`: plan_type, agreed_to_terms, agreed_at 업데이트
  - `/login`, `/signup`: 폐지 — `/` 로 리디렉트만
- **AI 이벤트 한 줄 설명** (commit `a11675d`)
  - `lib/claude/generate-event-description.ts` — Haiku 4.5 + system prompt cache_control(현재 임계 미만이라 silent no-op)
  - `lib/ingest/{tmdb,youtube}.ts` upsert 직전 Promise.all 병렬 호출. 실패 시 source description fallback
  - migration 0008: description 컬럼 idempotent 보장 (0001 에 이미 존재했음)
  - 어드민 events-manager + 캘린더 EventDetailModal 에 description 노출
  - `@anthropic-ai/sdk` 0.95.1 설치
  - **비용 절감 후속** (commit `cbdafb3`) — 기존 description 있는 이벤트는 Claude 호출 skip
- **쿠폰 시스템 + 팬 행사 승인 자동 발급** (commit `54c5c88`)
  - migration 0009: `coupons` 테이블 + `users.plan_expires_at` + RLS (본인 쿠폰만 select, admin 전체 read/update, insert/delete service_role 전용)
  - `lib/coupons/generate-code.ts` — 8자리 XXXX-XXXX (0/O/I/1 제외) + DB unique 충돌 시 재시도
  - `lib/email/send-coupon-email.ts` — Resend HTML+text
  - 팬 행사 승인 라우트: 캘린더 등록 + 쿠폰 발급 + 이메일 (각 단계 실패해도 승인 유지, warning 누적)
  - `/api/auth/apply-coupon` — 정규화(toUpperCase) + 조건부 update 로 동시 적용 차단
  - `/redeem` 페이지 신설 (subscription UI 보존 위해 별도 페이지)
  - 어드민 대시보드: 발급/사용 쿠폰 카드 (사용률 %)
- **/mypage/fan-events — 팬 행사 신청 유저 UI** (commit `d5cdd9c`)
  - 본인 신청 목록 + 신규 신청 폼
  - 상태 배지 (Under Review / Approved / Not Approved) + 승인 시 쿠폰 + /redeem 링크 + 거절 시 admin_note
  - migration 0010: `fan-event-proofs` Storage 버킷 + auth upload to own folder + public read
  - 파일: JPG/PNG/PDF · 5 MB · `{user_id}/{ts}-{slug}.{ext}` 경로
  - 업로드 실패해도 `proof_url=null` 로 신청 자체는 계속 (spec)
  - `/mypage` 사이드바에 "My Fan Events" (PartyPopper) 추가
- **Lemon Squeezy 결제 연동** (commit `bb8ee8b`) — ⚠️ **CLAUDE.md §2 Stripe 확정과 충돌하는 결제수단 전환** (DECISIONS.md 박제됨)
  - `@lemonsqueezy/lemonsqueezy.js` 4.0.0 설치
  - migration 0011: `users.lms_customer_id` / `lms_subscription_id` / `lms_order_id`
  - `lib/lemonsqueezy.ts` — SDK 초기화 + 체크아웃 URL 빌더
  - `/api/lemonsqueezy/checkout` — 로그인 검증 후 LMS 호스팅 결제로 302
  - `/api/lemonsqueezy/webhook` — HMAC-SHA256 raw body 서명 검증(timingSafeEqual) + order_created/subscription_cancelled/subscription_payment_failed 처리
  - `/start`: Free → /mypage, 유료 → /api/lemonsqueezy/checkout. complete-signup 은 항상 free 락인(webhook 이 결제 시 업그레이드)
  - `/payment/{success,fail}` 안내 페이지
  - `lib/email/send-payment-failed-email.ts` — Resend 결제 실패 안내
  - **운영 환경변수 필요**: `LEMONSQUEEZY_API_KEY` / `LEMONSQUEEZY_STORE_ID` / `LEMONSQUEEZY_WEBHOOK_SECRET` / `NEXT_PUBLIC_LMS_MONTHLY_URL` / `NEXT_PUBLIC_LMS_ANNUAL_URL`

### 2026-05-08 (세션 2) — 마일스톤 태그 `v0.3.5`
- HallyuCalendar M+0 Phase 1~3.5 전 단계 완료
  - Phase 1: Supabase 인프라 + DB 스키마(0001~0003) + `/api/calendar/events` + `/calendar` 페이지 연동
  - Phase 2: TMDB/YouTube/Last.fm 자동 인제스트 + cron 라우트 + 진단 강화 (funnel 카운트, source_id dedup)
  - Phase 2.5: 캘린더 월 navigation 동적화 (viewDate 상태 + AbortController)
  - Phase 3: Auth (Google OAuth + 이메일, Apple 제거) + middleware 가드
  - Phase 3.5: 리마인더 영속화(0004) + Resend D-Day 알림 + ingest-all 통합
- 부가 작업: 히어로 ghost globe + float 애니메이션, 파비콘 교체, 이용약관 토글 통일, CLAUDE.md §15 (규칙 우선순위) 추가
- 릴리즈 브랜치: `release/v0.3.5`

### 2026-05-07 (세션 1)
- v0 UI 17개 페이지 로컬 세팅
- ESLint 설정 정리
- GitHub 레포 `nudgefilm/unfoldk` 생성 및 초기 push 완료
- 브랜치 네이밍을 `main`으로 통일

<!-- 세션이 끝날 때마다 위 "현재 상태" 블록을 아래로 이동시키며 누적 -->
