# PROGRESS.md — 현재 상태 스냅샷

> 세션별 전체 기록 → PROGRESS_2026_05.md / PROGRESS_2026_06.md

---

## 현재 상태 (2026-06-22 세션 76 기준)

### 어드민 Cron 아코디언 + K-Inbound 사이드바 + 버그 수정 3건

**완료 항목**

- **어드민 Cron 페이지 아코디언 구조 전면 개편** (`app/admin/cron/page.tsx` + `components/admin/cron-monitor.tsx`)
  - 기존: 16개 버튼 평면 나열 → 수정: 7개 서비스 그룹 아코디언 (HallyuCalendar / KpopStats / KdramaMatch / HangeulGo / KfoodKit / Hallyu Pass / System)
  - `ROUTES` 배열 + `SERVICE_GROUPS` 구조 분리, `CronLogRow` / `RouteSummary` / `ServiceGroup` 타입 export
  - 그룹별 상태 점 표시 (green=최근 성공 / red=최근 실패 / gray=미실행), ChevronDown 회전 애니메이션
  - 기존 flat 버튼 row → displayName + 마지막 실행 시각 + 지표 + Run 버튼 인라인 수평 배치

- **어드민 수동 트리거 4개 누락 라우트 등록** (`app/api/admin/cron/run/route.ts`)
  - `generate-artist-reports` / `generate-comeback-guides` / `generate-monthly-report` / `generate-weekly-routines` 4개 import + zod enum + CRON_HANDLERS 추가
  - 이전: 어드민에서 버튼 클릭 시 404 반환

- **Hallyu Routine 모달 X 버튼 동작 수정** (`components/mypage/routine-onboarding-modal.tsx`)
  - 원인: `<Dialog open={open}>` — `onOpenChange` prop 없으면 shadcn Dialog X 버튼 이벤트 미처리
  - 수정: `onOpenChange={(v) => { if (!v && isUpdate) onClose?.() }}` 추가, `isUpdate` 가드로 첫 설정 모달은 X 강제 차단 유지

- **K-Inbound 우측 사이드바 'Arriving at ICN Today' 패널 신규** (`components/k-inbound/icn-arrivals-panel.tsx` + `app/api/k-inbound/arrivals/route.ts`)
  - AeroDataBox FIDS API로 당일 ICN 도착 국제선 조회, 10분 모듈 캐시
  - 필터: 국내선(KOREA_AIRPORTS) 제외 / Landed 제외 / ETA < 현재 시각 제외
  - 정렬: ETA 오름차순, 최대 15편
  - 표시 형식 한 줄: `편명  |  도시명  |  HH:MM`
  - 클릭 시 해당 항공편 검색 + 출발지→ICN 궤적 arc 표시

- **K-Inbound 도착편 도시명 해결 개선** (`app/api/k-inbound/arrivals/route.ts`)
  - 우선순위: AeroDataBox `departure.airport.municipalityName` → IATA_CITY 폴백 맵(230개+ 공항) → IATA code 최종 fallback
  - 일본 지방 소공항(AOJ·SDJ·AXT 등) / 중국 내륙(TAO·WUH·CSX 등) / 러시아(VVO·KHV) 포함
  - `originCity` 필드를 서버에서 resolve → 클라이언트 IATA 맵 불필요(제거)

- **K-Inbound 지구본 Arc 잔상 제거** (`components/k-inbound/globe.tsx`)
  - 항공편 전환 시 이전 arc 즉시 제거: `clearArcRef` 플래그 → 다음 프레임에 `scene.remove(arcLine)` + `arcLine = null`

- **K-Inbound 지구본 비행기 역방향 버그 수정** (`components/k-inbound/globe.tsx`)
  - 원인: `nextFt = Math.min(ft + 0.01, 0.99)` — `ft = 1.0`이면 `nextFt = 0.99 < ft` → forward 벡터 역방향
  - `ft = 1.0` (착륙 완료): `ft = 0.99, nextFt = 1.0` 고정 → 최종 진입 방향 유지
  - `0.95 ≤ ft < 1.0` (착륙 임박): `nextFt = min(ft + 0.01, 1.0)` (clamp 상한 0.99 → 1.0)
  - `ft < 0.95`: 기존 로직 유지

**다음 세션**
- GA4 Realtime 리포트 PageView 확인 (Vercel Redeploy 후)
- Polar 만료 시 자동 downgrade cron 구현

---

## 현재 상태 (2026-06-22 세션 75 기준)

### Cron 버그 수정 + 브라우저 번역 hydration 에러 방지

**완료 항목**

- **cron 4개 POST → GET 수정** (Vercel Cron은 GET 요청 전송)
  - 원인: Vercel 로그에서 `GET /api/cron/generate-artist-reports → 405` 확인
    → 4개 cron 라우트만 `POST`로 선언, 나머지 29개는 모두 `GET`
  - `app/api/cron/generate-artist-reports/route.ts` — `artist_weekly_reports` 매주 월요일 01:00 UTC
  - `app/api/cron/generate-comeback-guides/route.ts` — 매일 02:00 UTC
  - `app/api/cron/generate-monthly-report/route.ts` — 매월 1일 02:00 UTC
  - `app/api/cron/generate-weekly-routines/route.ts` — 매주 일요일 23:00 UTC
  - **주의**: `artist_weekly_reports` 이번 주(2026-06-22) 데이터는 다음 자동 실행(2026-06-29)까지 공백.
    즉시 필요 시 Vercel Dashboard → Functions → `generate-artist-reports` 수동 실행 필요

- **브라우저 번역 hydration 에러 방지** (`components/translation-guard.tsx` 신규)
  - 증상: Google 번역 등 활성 상태에서 SPA 라우팅 시 React DOM reconcile 실패 → 페이지 먹통
  - 해결: `usePathname()` 구독 → 경로 변경 시 `translated-ltr`/`translated-rtl` 클래스 감지
    → 번역 활성 상태에서만 `window.location.href = pathname` (full reload), 미활성 시 SPA 그대로
  - 번역 자체는 허용 (`translate="no"` 미적용) — DOM 조작 충돌만 차단
  - `app/layout.tsx`에 `<TranslationGuard />` 마운트

- **Error Boundary 신규 생성**
  - `app/error.tsx` — 페이지 단위 에러 경계, Refresh 버튼으로 `reset()` 재시도
  - `app/global-error.tsx` — 루트 레이아웃 에러까지 잡는 최상위 경계 (자체 `<html>/<body>` 포함, inline 스타일)

**다음 세션**
- GA4 Realtime 리포트 PageView 확인 (Vercel Redeploy 후)
- Polar 만료 시 자동 downgrade cron 구현
- `artist_weekly_reports` 이번 주 데이터 필요 시 수동 실행

---

## 현재 상태 (2026-06-22 세션 74 기준)

### 홈페이지 콜드 트래픽 최적화 + GA4 연동

**완료 항목**

- **홈페이지 구조 단순화** (`app/page.tsx`)
  - 제거: THIS MONTH IN HALLYU · GLOBAL HALLYU PULSE · HALLYU THIS WEEK · K-pop TOP 30 차트 + 9개 fetch 함수
  - 최종 구조: Hero → BentoSection(6카드) → Hallyu Feed → Quiz/Name 독립 2카드 → Footer
  - Quiz(Sparkles)/Name(Flower2) 카드 BentoSection 밖으로 분리, 인라인 JSX로 구현

- **BentoSection 6카드 정리** (`components/bento-section.tsx`)
  - Quiz·Korean Name 카드 2개 제거 → 서비스 6개만 (HallyuCalendar/KpopStats/KdramaMatch/HangeulGo/KfoodKit/Curation K)
  - Sparkles·Flower2 미사용 import 제거

- **서비스 페이지 섹션 이관**
  - `/kpop` (`app/kpop/page.tsx`): Charts 탭 상단 **GLOBAL HALLYU PULSE** + Top 20 아래 **K-pop TOP 30 Bar Chart** 추가
  - `/calendar` (`app/calendar/page.tsx`): 헤더 아래 **THIS MONTH IN HALLYU** + **Countdown D-day 카드** 4개 추가
  - `/korean` (`app/korean/korean-content.tsx`): Today's Lesson 위 **This Week's Expression** 컴팩트 카드 추가 (기존 `phrase` 상태 재활용, 신규 API 없음)
  - `/food` (`app/food/page.tsx`): Weekly Challenge 위 **K-Food Spotlight** 카드 추가

- **신규 API 라우트 5개**
  - `GET /api/kpop/global-pulse` → risingArtists·countryTopArtists·topDramas
  - `GET /api/kpop/top30` → lastfm_listeners 기준 TOP 30 아티스트
  - `GET /api/calendar/this-month` → 이달 컴백·드라마·도시 통계
  - `GET /api/calendar/countdown` → 7일 이내 D-day 이벤트 (revalidate 600)
  - `GET /api/food/spotlight` → 이주의 주요 레시피 1건

- **GA4 전체 사이트 연동**
  - `@next/third-parties 16.2.9` 설치 → `GoogleAnalytics` 컴포넌트 루트 레이아웃에 추가
  - `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-WZ6NXWCX91` `.env.local` 추가
  - `GA_ID` 있을 때만 활성화 (production 환경)
  - `app/start/page.tsx`: 가입 완료 시 `window.gtag?.('event', 'sign_up', { method: 'google' })` 추가
    - Meta Pixel `CompleteRegistration` 바로 다음 줄 → 두 도구에서 동일 전환 비교 가능
  - `window.gtag` 타입 선언 추가 (`declare global { interface Window { gtag? } }`)

**사용자 액션 필요**
- **Vercel 환경변수 추가 후 Redeploy**:
  ```
  NEXT_PUBLIC_GA_MEASUREMENT_ID=G-WZ6NXWCX91
  ```
  추가 전까지 GA4 스크립트 미렌더 (GA_ID undefined). Redeploy 후 GA4 Realtime 리포트에서 PageView 확인.

**다음 세션**
- GA4 Realtime 리포트 PageView 확인 (Vercel Redeploy 후)
- Polar 만료 시 자동 downgrade cron 구현

---

## 현재 상태 (2026-06-21 세션 73 기준)

### Polar 결제 전체 라이프사이클 완성 + E2E 검증

**완료 항목**

- **PaymentComingSoonModal 완전 제거 → Polar Customer Portal 연동**
  - `components/payment-coming-soon-modal.tsx` 삭제
  - `app/api/polar/customer-portal/route.ts` 신규 (`customerSessions:write` 스코프 필요)
    - Supabase JWT 검증 → `polar_customer_id` 조회 → `polar.customerSessions.create()` → `customerPortalUrl` 반환
    - migration 0086 미적용 시 `POLAR_ID_UNAVAILABLE`, polar_customer_id 미설정 시 `POLAR_ID_NOT_SET` 에러
  - `app/mypage/subscription/page.tsx`: 5개 버튼(Cancel subscription / Change payment method / Switch to Monthly / Switch to Annual / Cancel Note 버튼) 모두 `handlePortal` 연결
    - `portalLoading / portalError` 상태 추가, 버튼 disabled + "Opening…" 표시

- **Polar 결제 전체 라이프사이클 E2E 검증 완료**
  - 가입 → 체크아웃(Polar 호스팅) → 웹훅 반영(`plan_type='monthly'`, `subscription_status='active'`) → 취소 → 접근 유지(만료일까지) → 자동 downgrade(만료 시 예정)
  - 세션 71→72→73 하루 작업으로 완성:
    Paddle KYB 무응답 → Polar 대체 결정 / Polar 체크아웃·웹훅 구현 / DB 버그 3건 수정 / Footer 결제사 분리 / Billing History 실데이터화($0 영수증 없음 처리 포함) / Customer Portal 연동

**다음 세션**
- 마케팅 진입 가능 상태 — 결제 연동 전체 완료
- Polar 만료 시 자동 downgrade cron 구현 (구독 만료 → `plan_type='free'` 자동 전환)
- `app/start/page.tsx` 주석 "Paddle webhook(subscription.activated)" → Polar 업데이트 (마이너)

---

## 현재 상태 (2026-06-21 세션 72 기준)

### Billing History — Polar 실 주문 내역 연동

**완료 항목**

- **`app/api/polar/orders/route.ts` 신규**
  - Supabase JWT 검증 → `polar_customer_id` 조회 → `polar.orders.list({ customerId, limit: 100 })` 호출
  - `for await` 페이지 순회, `page.result.items` 수집 → 최신순 정렬
  - `BillingEntry`: id / date / description / amountCents / currency / status / **hasReceipt** (`receiptNumber !== null`)
  - migration 0086 미적용 시 컬럼 없음 에러 → 경고 후 빈 배열 반환 (graceful fallback)
  - `orders:read` 스코프 누락 시 `"MISSING_SCOPE_ORDERS_READ"` 에러 반환

- **`app/api/polar/orders/receipt/route.ts` 신규**
  - Supabase JWT 검증 → `polar.orders.receipt({ id: orderId })` → presigned PDF URL 반환
  - on-demand 방식 (페이지 로드 시 일괄 fetch 대신 Download 버튼 클릭 시 개별 fetch)

- **`app/mypage/subscription/page.tsx` 개편**
  - mock 배열 `billingHistory` 완전 제거
  - `accessToken` 상태 추가 (Supabase `getSession()`에서 Bearer 토큰 추출)
  - `billingOrders / billingLoading / billingError / receiptLoading` 상태 추가
  - billing fetch useEffect: `isLoaded && isPaid && accessToken` 트리거
  - `handleReceiptDownload`: `/api/polar/orders/receipt?orderId=` 호출 → `window.open()` 새 탭
  - Billing History 테이블: 로딩 스피너 / 에러 표시 / 빈 상태 / 실 데이터 3단계 분기
  - `formatAmount(cents, currency)` / `formatBillingDate(iso)` / `STATUS_DISPLAY` 헬퍼 추가

- **$0/100% 할인 주문 영수증 없음 정상 처리** (`fix` 커밋)
  - Polar 동작 확인: `receiptNumber === null` → receipt endpoint 없음 (정상 동작)
  - Download 버튼: `hasReceipt=false` 시 "—" 표시 (에러 alert 대신 자연스러운 UI)
  - `hasReceipt=true`인 유료 결제 건만 Download 버튼 활성

**사용자 액션 필요**
- **migration 0086** (polar_customer_id 컬럼) Supabase SQL Editor 실행:
  ```sql
  ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS polar_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;
  ```
- **POLAR_ACCESS_TOKEN `orders:read` 스코프 추가** → Polar 대시보드 토큰 재발급 → `.env.local` + Vercel 교체 + Redeploy
- **테스트 계정 `polar_customer_id` 설정**: Polar 대시보드 Customers에서 `tubewatchlab@gmail.com` Customer ID 확인 후:
  ```sql
  UPDATE public.users SET polar_customer_id = 'YOUR_POLAR_CUSTOMER_ID'
  WHERE email = 'tubewatchlab@gmail.com';
  ```

**다음 세션**
- 위 3단계 완료 후 `/mypage/subscription`에서 실 주문 내역 표시 확인
- Vercel Redeploy 후 실 결제 → Polar 웹훅 → plan_type='monthly' 반영 E2E 테스트
- `app/start/page.tsx` 주석 "Paddle webhook(subscription.activated)" → Polar로 업데이트 (마이너)

---

## 현재 상태 (2026-06-21 세션 71 기준)

### Polar.sh 결제 연동 — 완성 + 웹훅 버그 수정

**완료 항목**

- **Polar 결제 인프라 신규** (Paddle KYB 무응답으로 대체)
  - `lib/polar/constants.ts`: `POLAR_PRODUCT_IDS` (monthly/annual) + `HALLYU_PASS_PRODUCT_ID_SET`
  - `components/PolarProvider.tsx`: `usePolar()` hook — `/api/polar/checkout?plan=...` GET 리다이렉트
  - `app/api/polar/checkout/route.ts`: plan → productId 서버 매핑, Polar SDK 호스팅 체크아웃 → 302 리다이렉트
  - `app/api/polar/webhook/route.ts`: `Webhooks()` 어댑터 — subscription.active/updated/canceled/revoked/uncanceled + order.paid 처리
  - `supabase/migrations/0086_polar_columns.sql`: `users.polar_customer_id`, `users.polar_subscription_id` 컬럼 추가

- **기존 파일 교체** (Paddle → Polar, Hallyu Pass 한정)
  - `components/pricing-section.tsx`: `usePaddle` → `usePolar`, disabled 제거
  - `app/mypage/subscription/page.tsx`: `usePaddle` → `usePolar`, `FreeUserView` paddle prop 제거
  - `app/start/page.tsx`: `usePaddle` → `usePolar`, `openCheckout()` 직접 호출
  - `app/layout.tsx`: `PaddleProvider` 유지 (kbeauty 상품은 계속 Paddle 사용)

- **scripts/register-polar-webhook.ts 신규** (1회성 등록 스크립트)
  - dry-run 기본 / `--force` 플래그로 실제 등록
  - 중복 URL 감지, 등록 완료 시 `POLAR_WEBHOOK_SECRET` 출력
  - `pnpm add -D dotenv` 설치 (`.env.local` 명시 로드)
  - 실행 결과: `https://www.unfoldk.com/api/polar/webhook` 이미 등록 확인, POLAR_WEBHOOK_SECRET 재발급 완료

- **Polar 상품 ID 자동 조회 + `.env.local` 입력**
  - `POLAR_PRODUCT_ID_MONTHLY`: `ba73deac-6d5d-4dae-b569-aae467a4e2e0` ($9.00)
  - `POLAR_PRODUCT_ID_ANNUAL`: `6a14e3a3-0deb-4b08-b6f2-dbafb3fe44b4` ($72.00)
  - `POLAR_WEBHOOK_SECRET` 재발급 후 `.env.local` 입력 완료

- **웹훅 버그 수정 3건** (Vercel 로그로 원인 확인 후 수정)
  1. `HALLYU_PASS_PRODUCT_ID_SET` 빈 Set 시 warn 로그 추가 — Vercel env var 미설정 시 진단 가능
  2. `plan_type: "pro"` → DB check constraint 위반 (`'free'|'monthly'|'annual'`만 허용)
     - `activateHallyuPass`에 `planType: "monthly" | "annual"` 파라미터 추가
     - `onSubscriptionActive`: `productId === POLAR_PRODUCT_IDS.annual` 비교로 분기
  3. plan_type 업데이트와 polar_* 컬럼 업데이트 분리 — migration 0086 미적용 시에도 plan_type 반영됨

- **테스트 유저 수동 정정** (`tubewatchlab@gmail.com`, userId `ec21e940-...`)
  - `plan_type: 'free'` → `'monthly'`, `subscription_status: 'inactive'` → `'active'`

- **Footer 결제 처리자 문구 경로별 분리** (`components/footer-section.tsx`)
  - `usePathname`으로 런타임 감지
  - `/kbeauty/*` → "kbeauty service payments are processed by Paddle.com."
  - 그 외 전체 → "Hallyu Pass payments are processed by Polar Software, Inc."

**사용자 액션 필요**
- **Vercel 환경변수 추가** (추가 후 Redeploy 필수):
  ```
  POLAR_ACCESS_TOKEN=polar_oat_AR0C...
  POLAR_WEBHOOK_SECRET=polar_whs_SkVw...
  POLAR_PRODUCT_ID_MONTHLY=ba73deac-6d5d-4dae-b569-aae467a4e2e0
  POLAR_PRODUCT_ID_ANNUAL=6a14e3a3-0deb-4b08-b6f2-dbafb3fe44b4
  ```
- **Supabase SQL Editor** — migration 0086 실행:
  ```sql
  ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS polar_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;
  ```

**다음 세션**
- Vercel Redeploy 후 실 결제 → Polar 웹훅 → plan_type='monthly' 반영 E2E 테스트
- `app/start/page.tsx` 주석 "Paddle webhook(subscription.activated)" → Polar로 업데이트 (마이너)

---

## 현재 상태 (2026-06-21 세션 70 기준)

### Hallyu Pass — 기능 완성 + 추적 아티스트 조회 공통화

**완료 항목**

- **F. 월간 한류 트렌드 리포트 (`app/api/cron/generate-monthly-report/route.ts` 신규)**
  - cron `0 2 1 * *` (매월 1일 02:00 UTC)
  - 지난달 집계: kpop_stats_daily 리스너 증가율 TOP 5 / kpop_country_charts 1위 변동 / dramas popularity TOP 5 / 다음달 이벤트
  - Claude Haiku 3~4문장 인사이트 생성 → `monthly_trend_reports` 저장
  - `verifyCronAuth` 패턴 수정 (always-truthy 버그 → `!auth.ok` 체크로 교체)

- **GET /api/hallyu-pass/monthly-report (`app/api/hallyu-pass/monthly-report/route.ts` 신규)**
  - 로그인 + Pro 체크 → 가장 최신 리포트 1건 반환

- **`components/mypage/monthly-trend-report-card.tsx` 신규**
  - Top Rising Artists / Trending Countries / Most Talked-About Dramas / Coming Up Next Month 4섹션
  - 데이터 없으면 "First monthly report coming on the 1st." 빈 상태

- **`app/mypage/hallyu-pass/page.tsx` 갱신**
  - Monthly Hallyu Trend Report 플레이스홀더 → `MonthlyTrendReportCard` 교체
  - ArtistWeeklyReportsCard / ComebackGuideCard 실제 컴포넌트 사용 확인

- **`vercel.json`**: `generate-monthly-report` cron 추가

- **cron verifyCronAuth 버그 수정** (4개 파일)
  - `generate-weekly-routines`, `generate-artist-reports`, `generate-comeback-guides`, `generate-monthly-report`
  - `const authError = verifyCronAuth(request); if (authError) return authError` (객체 항상 truthy → 크론 미실행)
  - → `const auth = verifyCronAuth(request); if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })`

- **ESLint 오류 수정** (`generate-artist-reports/route.ts` 95번 줄)
  - `@typescript-eslint/no-explicit-any` 플러그인 미설치 프로젝트에 eslint-disable 주석 → 제거

- **추적 아티스트 처리 개선** (`generate-artist-reports` 응답)
  - `ProcessResult`: `"saved"|"skipped"|"error"` 문자열 → `{ status, reason? }` 객체
  - 응답에 `details[]` 추가 (아티스트별 name·status·reason 로그)

- **추적 아티스트 Source B 추가** (HallyuCalendar 구독 경유)
  - 기존 Source A(`kpop_artist_follows`)만 조회 → Stray Kids 1명만 처리
  - Source B 추가: `user_calendar_subscriptions → hallyu_calendar_events → kpop_artists` 이름 매칭
  - `generate-artist-reports` cron + `generate-comeback-guides` cron 양쪽에 적용

- **공통 함수 `lib/hallyu-pass/get-tracked-artists.ts` 신규** (커밋 `20b4b0c`)
  - `getTrackedArtists(admin, userId?)` — Source A+B 병합
  - `userId` 생략 = 전체 유저 합산 (cron), 제공 = 해당 유저 (표시 API)
  - `generate-artist-reports` cron, `hallyu-pass/artist-reports`, `hallyu-pass/comeback-guides` 모두 동일 함수 사용

**확인 완료 (수정 없음)**
- `artist_weekly_reports`: `user_id` 컬럼 없음 — 아티스트 1명 × 주 1개, Pro 유저 전체 공유 구조
- `comeback-guides` 표시 API: `getTrackedArtists()` 이미 적용 완료 (커밋 동일)
- 추적 아티스트 4명 (BTS·NewJeans·RM·TWICE/IVE 포함) 정상 반영 확인

**다음 세션**
- Supabase SQL Editor에서 TWICE·IVE Source B 경유 여부 확인 (위 쿼리 실행)
- Paddle KYB 심사 통과 후: 샌드박스 → 프로덕션 전환, 웹훅 실서버 등록

---

## 현재 상태 (2026-06-18 세션 69 기준)

### K-Inbound — UI 개선 및 버그 수정

**완료 항목**

- **`components/k-inbound/route-progress-bar.tsx`**
  - depTime/arrTime 미표시 버그 수정: `{flight && depTime && ...}` 빈 문자열 falsy 차단 제거, `|| "—"` fallback 추가
  - extractTime 정규식: `/[T ](\d{2}:\d{2})/` (T/공백 구분자 모두 처리)
  - 레이아웃 2줄 재구성:
    - Row1 (가운데): `ICN(KST) | KE17 · 0% · 9,627km 🕐 SCHEDULED | (PDT)LAX`
    - Row2 (가운데): `🛫14:30 Seoul Incheon — Los Angeles 09:40🛬`
  - 텍스트 색상 30% 밝게 (흰색과 혼합): `#4a9eff→#80bbff`, `#94a3b8→#b4bfcd`, `#ffd700→#ffe34d`, 뱃지 색상 전부 갱신
  - 컨테이너: `backdrop-blur-sm px-4 pt-1.5 pb-2 font-mono rounded-xl`
  - do-not-modify 주석 추가 (파일 최상단)

- **`components/k-inbound/global-comms.tsx`**
  - `GlobalCommsProps { isExpanded: boolean; onToggle: () => void }` 추가 — 펼침/접힘 상태 page.tsx로 끌어올림 (controlled)
  - 내부 `expanded` state 제거
  - 컨테이너 최종: `className="w-full h-full font-mono flex flex-col"` — 배경·테두리·overflow 없음, 완전 투명
  - 메시지 영역: `flex-1 min-h-0 overflow-y-auto` (부모 50vh 자동 채움)
  - 접힌 상태: 헤더 1줄만 (lastMsg 미리보기 제거)
  - do-not-modify 주석 추가 (파일 최상단)

- **`app/k-inbound/page.tsx`**
  - `const [isCommsExpanded, setIsCommsExpanded] = useState(false)` 추가
  - 좌측 패널 구조 재편 — 상단 카드 영역(`flex-1 min-h-0 overflow-hidden`) + 하단 채팅 영역(펼침 시 50vh)
  - GlobalComms `isExpanded` / `onToggle` props 전달
  - do-not-modify 주석 추가 (파일 최상단)

- **`app/api/k-inbound/cron/route.ts`**
  - FIDS 상태 필터 버그 수정: `"EnRoute" | "Departed"` → `"Active" | "EnRoute" | "Departed"` (AeroDataBox in-flight 실제 상태값 `"Active"` 추가)

- **`app/api/k-inbound/suggest/route.ts`** (신규)
  - cron 캐시(`cache.entries()`)에서 가장 최근 항공편 번호 반환, 캐시 없으면 `"KE017"` 기본값

- **`components/k-inbound/search-bar.tsx`**
  - 마운트 + 매시간 `/api/k-inbound/suggest` 호출 → `placeholderFlight` 상태 자동 갱신
  - `setInterval(3_600_000)` + unmount clearInterval

**진단 완료 (데이터 품질 이슈)**
- KE017 14:30 + 0%: AeroDataBox `departure.actualTime.local` 필드 미제공 (구독 티어 또는 데이터 갭 추정). 코드 동작은 정상 — actualTime 없으면 GROUND HOLD + progress=0. AeroDataBox 대시보드 구독 티어 확인 필요.

**다음 세션**
- Paddle KYB 심사 통과 후: 샌드박스 → 프로덕션 전환, 웹훅 실서버 등록
- cron `"Active"` 필터 수정 Vercel 배포 반영 여부 확인
- AeroDataBox actualTime 데이터 갭 — 구독 티어 확인

---

## 현재 상태 (2026-06-18 세션 68 기준)

### K-Inbound — 세부 기능 개선

**완료 항목**

- **`components/k-inbound/global-comms.tsx`**
  - 시스템 메시지 자동 표시: 1시간마다 `SYSTEM_MESSAGES` 3개 순환
  - 로컬 state에만 추가 (Supabase 저장 없음, 다른 유저에 미노출)
  - `[SYSTEM]` 태그 초록(#4ade80) + 이탤릭 회색 + 연초록 배경
  - 접힌 상태 미리보기도 시스템/유저 분기 처리

- **`components/k-inbound/route-progress-bar.tsx`**
  - 출발·도착 시각 표시 → 공항 현지 시각(IATA→IANA) + 시간대 약어
  - scheduledTime은 이미 로컬 시각 → HH:MM 직접 추출 (브라우저 TZ 변환 없음)
  - IATA_TZ 매핑 테이블 추가 (ICN/LAX/JFK/NRT/LHR/CDG/DXB/SIN/SYD 등)
  - Intl.DateTimeFormat 서머타임 자동 반영 (현재 PDT/EDT/BST/CEST 등)
  - 비행 단계별 상태 뱃지 추가: SCHEDULED(회색)/GROUND HOLD(노란)/EN ROUTE(초록)/ARRIVED(파란)/CANCELLED(빨간)
  - 상단 레이블 행을 3행으로 분리:
    - Row1: IATA + 시간대 약어 (ICN(KST) / (PDT)LAX)
    - Row2: 🛫 출발시각 TZ / 🛬 도착시각 TZ — actualTime/estimatedTime 우선
    - Row3: 항공편 정보 + 상태 뱃지

- **`components/k-inbound/globe.tsx`**
  - ✈ 유니코드 캔버스 스프라이트 → `THREE.ShapeGeometry` Mesh 교체
  - `AIRCRAFT_FORWARD = new THREE.Vector3(1, 0, 0)` 앞방향 명시적 정의
  - `makeAircraftShape()`: 기체/주익/꼬리날개 실루엣 XY 평면 Shape (길이 정규화 1.0)
  - `calcAircraftQuaternion()`: 구 법선 + 진행방향으로 우수 기저 행렬 → 매 프레임 정확한 3D 회전
  - atan2 2D 회전·카메라 공간 탄젠트 변환 완전 제거
  - 색상: 더미 #FF4B6E, 주 항공편 #ffffff (기존 Sprite와 동일)
  - 크기: Sprite scale 그대로 유지 (0.0504 / 0.0336)
  - 더미 항공기 한국(ICN/GMP) 출발·도착 경로 5개 제거 → 7개 비한국 경로만 유지

- **`app/api/k-inbound/flight/route.ts`**
  - `actualTime.local` 기준 이륙 완료 판단 (scheduledTime fallback 제거)
  - 이륙 전: `progressRatio=0` 강제, `status='GROUND HOLD'` 반환
  - `recompute()` 동일 로직 적용 — 캐시 히트 시에도 이륙 전은 progress 0 유지
  - `cache`, `CacheEntry`, `AeroRaw`, `buildFlightData` export 추가 (cron 공유)

- **`app/api/k-inbound/cron/route.ts`** (신규)
  - 매시 UTC 정각 실행, ICN 당일 도착 FIDS 조회
  - EnRoute/Departed 필터 → ETA 기준 현재 시각 가장 가까운 편 선정
  - 기존 flight API 캐시에 동일 방식으로 저장

- **`vercel.json`** — `/api/k-inbound/cron` `0 * * * *` 추가

- **`components/k-inbound/search-bar.tsx`**
  - `placeholderFlight='KE017'` 상태 추가
  - Track 빈 입력 클릭 → placeholder 항공편 자동 검색

**다음 세션**
- Paddle KYB 심사 통과 후: 샌드박스 → 프로덕션 전환, 웹훅 실서버 등록
- K-Inbound: 실제 항공편 API 검색 추가 테스트

---

## 현재 상태 (2026-06-18 세션 67 기준)

### K-Inbound Flight Simulator — 지구본 + UI 전면 개선

**완료 항목**

- **`components/k-inbound/globe.tsx` 전면 재작성**
  - 12개 주요 항공 경로 실제 비행시간(ms) 기반 시뮬레이션 (`progress = (now - startTime) / duration`)
  - 지구 자전: `THREE.Clock` + `camera.position.applyAxisAngle` (20분/회전, 방향 보정)
  - 대륙선 back-face fading: 버텍스별 카메라 dot product → brightness 매핑
  - trail: 시간 기반 샘플링(60초/점) + 초기화 시 30% 범위 50점 pre-populate + 0.003 gap
  - 더미 항공기 방향: 카메라 공간 탄젠트 벡터 smoothing
  - 메인 항공편 방향: `AIRCRAFT_ROTATION_OFFSET = Math.PI` (상수화)
  - 메인 항공편 스프라이트 크기: 0.07 → 0.042 (40% 축소) → 0.0504 (20% 확대)
  - 더미 스프라이트 크기: 0.028 → 0.0336 (20% 확대)
  - **항공편 검색 시 현재 위치 자동 flyTo**: `setFlight`에서 `progressRatio + 경과시간`으로 추정 위치 계산 → vec3 역변환 lat/lng → 1.5초 slerp 애니메이션

- **`components/k-inbound/route-progress-bar.tsx`**
  - 전체 너비 → 중앙 고정 카드 (`width: 600px, max-width: 60%`, `left: 50%`)
  - 검정 배경 제거 (다른 패널 카드와 동일 투명 처리)
  - 폰트: `9~10px` → `11~13px` (사이드 패널 통일)
  - z-index `z-[5]` (사이드바 z-10보다 낮게)

- **패널 카드 줄간격 일괄 축소** (4개 파일)
  - `flight-info-panel.tsx` / `aircraft-info-panel.tsx` / `flight-status-panel.tsx` / `live-telemetry-panel.tsx`
  - `py-px` → `py-0`, 섹션 헤더 `mb-1` → `mb-0.5`, 구분선 `my-1~1.5` → `my-0.5~1`

- **`components/k-inbound/search-bar.tsx`**
  - Track 버튼: `text-[#4a9eff]` → `text-white`
  - Placeholder: `/35` → `/40`

- **`components/k-inbound/flight-suggestions-modal.tsx`** (신규)
  - 항공편 404 시 ICN 도착 FIDS 목록 표시
  - 유저 국가(ipapi.co) 기준 정렬, 클릭 시 자동 검색어 입력

- **`components/k-inbound/global-comms.tsx`** (신규)
  - Supabase Realtime 익명 채팅 (kinbound_messages 테이블)
  - ipapi.co 도시명 표시, 100자 제한, 욕설 필터
  - 쿨다운 제거 (100자 제한만 유지)
  - 중복 메시지 버그 수정: reload() fallback 제거, Realtime 이벤트에서 id 중복 체크
  - expanded/collapsed 토글: expanded=true → ▼, false → ▲
  - 접힌 상태: 헤더 + 최근 메시지 1줄 미리보기
  - 위치 `bottom-16` → `bottom-4` (경로 바 카드 제거 후 맞춤)

- **`app/api/k-inbound/flight/route.ts`**
  - 404 시 `fetchICNSuggestions()` → suggestions 배열 응답에 포함
  - `FlightData.timestamp` 필드 추가

- **`supabase/migrations/0084_kinbound_messages.sql`** (신규, Supabase 수동 실행 완료)

**다음 세션**
- Paddle KYB 심사 통과 후: 샌드박스 → 프로덕션 전환, 웹훅 실서버 등록
- K-Inbound: 실제 항공편 API 검색 추가 테스트

---

## 현재 상태 (2026-06-17 세션 66 기준)

### Paddle 결제 연동 + 메인 페이지 전면 재편

**완료 항목**

- **Paddle 결제 연동 — UI 플로우 완성**
  - `app/mypage/subscription/page.tsx`: `PaymentComingSoonModal` 업그레이드 버튼 → `paddle.Checkout.open()` 오버레이 전환
    - `PlanType` 타입에 `"pro"` 추가 (Paddle webhook은 "pro" 로 설정하는데 기존에는 "monthly"/"annual"만 인식하던 버그 수정)
    - Monthly/Annual 각각 Price ID 분기 (`PADDLE_PRICE_IDS.hallyu_pass_monthly/annual`)
  - `app/start/page.tsx`: Pro 플랜 선택 시 `PaymentComingSoonModal` → `paddle.Checkout.open()` 직접 진입, 폴백 유지
  - `app/terms/page.tsx` · `app/cookie/page.tsx` · `app/gdpr/page.tsx` · `components/footer-section.tsx` · `app/payment/fail/page.tsx` · `app/payment/success/page.tsx` · `lib/email/send-payment-failed-email.ts`: LemonSqueezy → Paddle 표기 전면 교체
  - `CLAUDE.md` 결제 섹션: "Lemon Squeezy 확정" → "Paddle 확정 (KYB 심사 중, 2026-06-17 제출)"
  - `DECISIONS.md`: "2026-06-17 결제 수단 전환 현황" 신규 항목 추가
  - 잔존 LemonSqueezy 파일 (`app/api/lemonsqueezy/*`, `lib/lemonsqueezy.ts`) — 의도적 유지 (backward compat)

- **메인 페이지 (`app/page.tsx`) 전면 재편**
  - **섹션 순서**: 히어로 → A → B → C → TOP30차트 → 서비스허브 → Hallyu Feed → 푸터
  - **섹션 A — THIS MONTH IN HALLYU** (`components/home/this-month-hallyu.tsx` 신규)
    - `hallyu_calendar_events` 이달 전체 조회 → 국가 수·도시 수·Top 4 도시 통계
    - 이달 컴백 / 방영 예정 드라마 최대 4개씩 리스트
  - **섹션 B — GLOBAL HALLYU PULSE** (`components/home/global-hallyu-pulse.tsx` 신규)
    - 7일 증가량 기준 Rising 아티스트 Top 5 (`kpop_stats_daily` 7일 전 대비)
    - 국가별 1위 아티스트 (`kpop_country_charts.rank=1`) 최대 10개국
    - 인기 드라마 Top 5 (`dramas.popularity DESC`)
    - "Powered by Last.fm" 출처 표기 포함
  - **섹션 C — HALLYU THIS WEEK** (`components/home/hallyu-this-week.tsx` 신규)
    - D-Day 카운트다운 (향후 7일 이내 이벤트 최대 4개)
    - 이번 주 방영 드라마 (`hallyu_calendar_events type=drama` 이번 주)
    - 오늘의 한국어 표현 (`korean_phrases.featured_date` 오늘)
    - 주간 K-Food 레시피 (`food_recipes.featured_week` ISO week)
  - **제거**: showDataHub(K-pop 차트 미니+이벤트), YoutubeVideoSection, HomePhraseCard, K-dramas 6 카드, 구 GlobalHallyuPulse, HomeCTASection, Pricing 섹션(이전 세션 이미 제거)

**다음 세션**
- Paddle KYB 심사 통과 후: 샌드박스 → 프로덕션 전환, 웹훅 실서버 등록 확인
- migration 0074 실행 여부 재확인

---

## 현재 상태 (2026-06-13 세션 65 기준)

### 메인 페이지 K-pop TOP 30 차트 디자인 개선

**완료 항목**

- **`components/home/kpop-top30-chart.tsx` 전면 재설계**
  - 컨테이너 높이 200px → 240px
  - 막대 바닥 고정: `flex items-end` → 각 컬럼 `flex-col` (순위 행 + 막대 영역 분리)
  - 아티스트명 막대 외부 → 막대 내부 하단 세로 텍스트 (`writing-mode: vertical-rl` + `rotate(180deg)`, 36px 이상 막대만 표시)
  - 순위별 막대 너비 미세 변화: `max(70%, 100% - (rank-1)*0.8%)`
  - 리스너 비율 기반 opacity: `0.4 + heightRatio * 0.6` (높은 막대 진한 핑크, 낮은 막대 연한 핑크)

- **툴팁 overflow 클리핑 수정**
  - `outerRef(relative)` + 내부 차트박스(`overflow:hidden`) 2레이어 분리
  - `onMouseEnter`에서 `getBoundingClientRect()`로 막대 상단 중앙 좌표 계산
  - 툴팁을 `outerRef` 내부 `z-50`으로 렌더링 → 슬라이더 `overflow:hidden`에 잘리지 않음

- **순위 번호 동일 라인 정렬**
  - 기존: `position: absolute; top: -16px` → 막대 높이마다 y위치 상이
  - 수정: 각 컬럼 `flex-col` — 순위 행(`h-5` 20px 고정) + 막대 영역(`flex-1`) → 모든 순위 번호 상단 동일 라인
  - 순위 폰트: `text-[9px] font-bold rgba(255,255,255,0.50)`

---

## 현재 상태 (2026-06-13 세션 64 기준)

### Hallyu Feed 전면 개편

**완료 항목**

- **Hallyu News → Hallyu Feed 전체 명칭 변경**
  - `git mv` 5개 폴더 이름 변경 (app/hallyu-news → app/hallyu-feed 등)
  - 내부 문자열 일괄 교체 (hallyu-news / hallyuNews / HallyuNews → feed)
  - `app/api/admin/hallyu-feed/route.ts` 신규 — `createSupabaseAdminClient()` (service_role 키, 어드민 데이터 미노출 수정)
  - `next.config.mjs` 301 리다이렉트: `/hallyu-news` → `/hallyu-feed`
  - `vercel.json` cron 경로 + admin-sidebar API 호출 경로 갱신

- **타임아웃 방지**
  - `CLAUDE_MAX_PER_RUN` 30 → 5
  - `vercel.json functions` maxDuration 300 (cron + admin 라우트)
  - cron 스케줄: 하루 4회 → 매일 01:00 UTC 1회

- **유저 커뮤니티 피드** (`migration 0083`)
  - `community_feeds` + `community_feed_reports` 테이블 (신고 5회 → 자동 hidden, UNIQUE 1회 제약)
  - `GET/POST /api/community-feeds` — 목록 조회 / Pro 유저 작성
  - `GET/DELETE /api/community-feeds/[id]` — 단건 / 본인 삭제
  - `POST /api/community-feeds/[id]/report` — 신고 (중복 409, 5회→hidden 자동)
  - `GET /api/admin/community-feeds/list` + `PATCH /api/admin/community-feeds/[id]`
  - `WriteFeedModal` 컴포넌트 (title / content / artist_keyword)
  - `/hallyu-feed` **AI Feed / Community / My Feed** 3탭 구조
  - `/admin/hallyu-feed/community` 신고 피드 관리 (부활/삭제)
  - `AdminSidebar` 커뮤니티 관리 링크 + 신고 건수 배지

- **콘텐츠 구조 전면 개편** (RSS → Sonnet 4.6 독자 콘텐츠)
  - RSS: 제목만 파싱 → 키워드 추출 (본문 fetch / og:image / YouTube 썸네일 완전 제거)
  - RSS 키워드 5건 + 내부 데이터(`kpop_artists` / `hallyu_calendar_events` / `dramas`) 3건 → Sonnet 4.6 독자 콘텐츠 생성
  - 카드·상세 페이지: 이미지 제거, "Read original" 제거, "Curated by UnfoldK" 단일 표기, HTML 엔티티 디코딩
  - `/api/hallyu-feed` `Cache-Control` 제거 (빈 응답 5분 캐싱 방지)

- **related_artist 링크 category 기반 내부 연동**
  - `/api/hallyu-feed/[id]` `resolveRelatedLink()`: kpop → `kpop_artists.name ILIKE` → `/kpop/[id]` / kdrama → `dramas.title ILIKE` → `/drama/[id]` / 매칭 실패·kbeauty·general → 미노출

**사용자 액션 필요**
- Supabase SQL Editor에서 migration 0083 실행:
  ```sql
  -- supabase/migrations/0083_community_feed.sql 내용 붙여넣기 후 실행
  ```
- 기존 데이터 정리:
  ```sql
  DELETE FROM hallyu_news;
  ```
- 어드민 `/admin/hallyu-feed` → "뉴스 수집 실행" 버튼으로 첫 콘텐츠 생성

**다음 세션**
- Apollo.io 매핑 파이프라인 구현
- Paddle 웹훅 실서버 등록 및 실결제 테스트

---

## 현재 상태 (2026-06-12 세션 63 기준)

### 전 서비스 YouTube 영상 섹션

**완료 항목**

- **DB 마이그레이션** (`supabase/migrations/0080_youtube_videos.sql`)
  - `youtube_videos` 테이블: service / ref_id / ref_type / video_id / title / thumbnail_url / **view_count** / status(pending|published|rejected)
  - UNIQUE: `(service, ref_id, video_id)` — 동일 영상이 서비스별 ref 에 각각 존재 가능
  - RLS: published → public, admin → full access

- **YouTube 수집 API** (`app/api/youtube/collect/route.ts`)
  - POST `{ service, ref_id, ref_type, query }` → 2단계: search.list(10건, publishedAfter 1년) → videos.list(통계)
  - 블랙리스트: 제목에 "reaction", "fan made" 포함 시 제외
  - 서비스별 최소 조회수: kpop 20만 / calendar·kdrama 10만 / hangeul 5만 / curation 1만
  - 수집 결과: `{ collected, filtered, videos }` 반환
  - 어드민 전용

- **어드민 영상 관리 API**
  - `app/api/admin/videos/route.ts` — GET 목록(view_count 포함) + `count_only=true` pending 카운트
  - `app/api/admin/videos/[id]/route.ts` — PATCH status / DELETE

- **공개 영상 조회 API** (`app/api/videos/route.ts`)
  - GET `?service=&ref_id=&ref_type=` → published 영상 반환 (RLS 적용, Cache-Control 5분)

- **어드민 영상 관리 페이지** (`app/admin/videos/page.tsx`)
  - 서비스 탭 + 상태 탭 필터, 카드 그리드, 승인/삭제 버튼
  - 카드에 조회수(K/M 단위) 표시 + 필터 제외 건수 표시
  - 서비스별 권장 키워드 힌트 표시
  - 어드민 사이드바 "YouTube 영상" 메뉴 + pending 배지

- **공통 YoutubeVideoSection 컴포넌트** (`components/shared/youtube-video-section.tsx`)
  - 가로 스크롤 카드(썸네일+제목+Play 오버레이) + YouTube embed 모달(iframe autoplay)
  - published 영상 없으면 null return (섹션 미노출)

- **5개 서비스 적용**
  - HallyuCalendar: 이벤트 상세 모달 하단 (`app/calendar/page.tsx`)
  - KpopStats: 아티스트 상세 페이지 Explore More 앞 (`app/kpop/[id]/page.tsx`)
  - KdramaMatch: 드라마 상세 모달 하단 (`app/drama/page.tsx`)
  - HangeulGo: 학습팩 모달 상단 (`app/korean/korean-content.tsx`)
  - Curation K: SpotDetailDialog NearbyPlaces 뒤 (`app/curation-k/page.tsx`)

**사용자 액션 필요**
- Supabase SQL 편집기에서 마이그레이션 실행:
  ```sql
  -- supabase/migrations/0080_youtube_videos.sql 내용 붙여넣기 후 실행
  ```

**다음 세션**
- Apollo.io 매핑 파이프라인 구현
- Paddle 웹훅 실서버 등록 및 실결제 테스트
- 어드민 `/admin/videos` → 서비스별 영상 수집 후 승인 테스트

---

## 현재 상태 (2026-06-11 세션 62 기준)

### KpopStats + 가격 개편 + 공통 UX

**완료 항목**

- **About 페이지 헤드 카피 수정** (`app/about/page.tsx`)
  - "Built by a solo indie developer" → "Built by an indie developer"

- **메인 우측 하단 캘린더 위젯 동적 월 표시** (`components/floating-calendar-widget.tsx`)
  - "May 2026" 하드코딩 → `new Date()` 기반 동적 계산 (월명·연도·달력 그리드 모두)

- **KpopStats Chart Attack — Fan Power Ranking 개선**
  - 타이틀 "UnfoldK Fan Power Ranking" → "UnfoldK Fan Power Ranking TOP 5"
  - 아티스트 클릭 시 실시간 카운트 복구: 투표 후 `loadRankings()` 재조회가 optimistic update 덮어쓰던 버그 제거
  - 가이드 텍스트: 투표 후 `"Today's votes: N/5"` 실시간 카운트 표시
  - 투표 안내 모달 트리거를 `ChartAttackTab` 내부 → `kpop/page.tsx` 최상위로 이동
    - 기존: chart-attack 탭 전환 시에만 모달 표시 (default "charts" 탭 진입 시 미표시)
    - 수정: `authChecked && isLoggedIn` 조건으로 페이지 진입 1.5초 후 모달 표시
    - 모달 "투표하기" 클릭 → chart-attack 탭 자동 전환
  - 투표 모달 자동 닫힘: 3초 → 5초
  - 투표 모달: 탭 전환 시 재표시 방지 (`pageNavToken` 패턴 → 페이지 레벨 트리거로 대체)

- **KpopStats Artist 상세 "Report incorrect info" 모달화** (`components/common/report-button.tsx`)
  - 기존 전체 페이지 이동 → Dialog 모달로 변경, 헤더 위로 올라오던 z-index 버그 수정

- **Pro 플랜 가격 전면 개편** (`components/pricing-section.tsx`)
  - Monthly: `$9` → `$4.99/월`
  - Annual: `$6` → `$3.33/월` (연간 $39.99, 33% 절약)
  - Annual 배지: "2 months free" → "Billed $39.99/year · Save 33%"
  - Monthly 카드 하단: "or $39.99/year — save 33%" 안내 추가
  - Free/Pro 기능 목록 카피 전면 교체 (팬덤 감성 카피)

- **HallyuPassBanner 공통 컴포넌트** (`components/hallyu-pass-banner.tsx` 신규)
  - Free 유저 대상 Pro 업그레이드 배너 (Crown 아이콘 + "Get Hallyu Pass" 링크)
  - 6개 서비스 페이지 모두 `<FooterSection />` 위에 삽입:
    calendar · kpop · drama · korean · food · curation-k

- **마이페이지 VIP Crown 배지** (`app/mypage/page.tsx`)
  - Pro 유저(monthly/annual) 사이드바 프로필에 `Crown` 아이콘 표시

**다음 세션**
- Apollo.io 매핑 파이프라인 구현
- Paddle 웹훅 실서버 등록 및 실결제 테스트

---

## 현재 상태 (2026-06-10 세션 61 기준)

### 채팅 위젯 → 텔레그램 버튼 교체

**완료 항목**

- **Crisp 채팅 위젯 완전 제거** (`app/layout.tsx`)
  - Crisp 스크립트 (`id="crisp-chat"`) 제거

- **메인 사이트 텔레그램 버튼** (`components/floating-calendar-widget.tsx`)
  - `handleChatOpen` / `$crisp` 참조 제거, `MessageCircle` import 제거
  - 채팅 버튼 → `<a href="https://t.me/+Mv3BgRXVS94wMzVl" target="_blank">` 텔레그램 아이콘 버튼 (`#FF4B6E` 색상 유지)

- **kbeauty 텔레그램 버튼** (`app/kbeauty/page.tsx`)
  - `TelegramButton` 컴포넌트 신규 추가 — `fixed bottom-8 right-8`, `#1A3A5C` kbeauty 브랜드 컬러
  - 기존 `ScrollTopButton` 위치 `bottom-8 → bottom-24`로 이동 (겹침 방지)

---

## 현재 상태 (2026-06-10 세션 60 기준)

### HallyuCalendar + 공통 UX 개선

**완료 항목**

- **HallyuCalendar 가로 스크롤바 완전 제거** (`app/calendar/page.tsx`)
  - 필터 탭 컨테이너(`overflow-x-auto`) + 캘린더 그리드 컨테이너(`overflow-x-auto + min-w-[600px]`) 양쪽에 `[&::-webkit-scrollbar]:hidden` + `style={{ scrollbarWidth: "none" }}` 추가
  - WebKit(Chrome/Safari/Edge)·Firefox 모두 커버

- **HallyuCalendar 이벤트 모달 상단 2문장 설명 추가**
  - `app/api/calendar/description/route.ts` 신규 — DB 우선 조회 → 없으면 Claude Haiku 2문장 생성 → DB 저장
  - `app/calendar/page.tsx` `EventDetailModal` — 제목 직후 설명 표시. 로딩 중 skeleton pulse 2줄
  - 설명 로드 우선순위: ① `event.description`(이벤트 목록 DB 값) → ② 세션 캐시(`descCacheRef`) → ③ API 호출
  - API 내 DB 저장 확실화: `createSupabaseAdminClient()` 로 교체 + `update()` 에러 로깅 추가
  - 세션 내 동일 이벤트 재클릭 시 API 미호출 (캐시 히트)

- **quiz·name 페이지 공유 버튼 로그인 유도 모달** (`components/common/login-prompt-modal.tsx` 신규)
  - `app/quiz/page.tsx` — "Share my result" 클릭 시 비로그인이면 모달 표시
  - `app/name/page.tsx` — "Share" 클릭 시 비로그인이면 모달 표시 (Copy name은 클립보드라 자유 유지)
  - 모달: title/message props 커스터마이즈 가능, Log in + Create free account 버튼 → `/login`, `/signup`
  - 퀴즈·이름 생성 자체는 비로그인 이용 가능 유지

- **어드민 KpopStats "오늘 추가" 수치 버그 수정** (`app/admin/page.tsx`)
  - 기존: `kpop_stats_daily.date = today` → 매일 cron이 전체 아티스트 upsert하므로 총 수치와 동일
  - 수정: `kpop_artists.created_at >= startOfDay` → 다른 서비스들과 동일 패턴으로 통일

**다음 세션**
- Apollo.io 매핑 파이프라인 구현
- Paddle 웹훅 실서버 등록 및 실결제 테스트

---

## 현재 상태 (2026-06-09 세션 59 기준)

### UnfoldK Beauty (kbeauty) — 어드민 대시보드 프리뷰 + 기타 수정

**완료 항목**

- **어드민 대시보드 프리뷰 모드** (5개 파일)
  - `middleware.ts`: `is_admin` RPC 1회 선호출 → 어드민이면 모든 `/kbeauty/dashboard/*` 라우트 통과
  - `dashboard/supplier/page.tsx`, `buyer/page.tsx`, `seller/page.tsx`: `?preview=<id>` 파라미터 감지 → 해당 유저 데이터 로드, 상단 네이비 프리뷰 배너 + 패널 복귀 링크
  - `admin/page.tsx`: 공급사·바이어·셀러 테이블 각 행 끝에 "보기" 외부 링크 추가
  - 사용법: 어드민 패널 → 각 탭 → 행의 **보기** 클릭 → 새 탭에서 해당 유저 대시보드 열림

**다음 세션**
- Apollo.io 매핑 파이프라인 구현
- Paddle 웹훅 실서버 등록 및 실결제 테스트

---

## 현재 상태 (2026-06-09 세션 58 기준)

### UnfoldK Beauty (kbeauty) — 공급사 가입 서류 필수 해제 + 대시보드 구현 + 인프라

**완료 항목**

- **번역 파이프라인 Supabase Edge Function 전환** (`supabase/functions/translate-pipeline/index.ts`)
  - 로컬 스크립트 → 서버사이드 자동화 전환
  - pending 건만 처리, completed/failed 건 건드리지 않음
  - 페이지네이션으로 Supabase 1,000행 캡 우회
  - max_batches 파라미터로 호출당 처리량 제어

- **번역 파이프라인 Vercel Cron 자동화** (`vercel.json`, `app/api/cron/translate-pipeline/route.ts`)
  - 매 10분 자동 호출, pending 0건 시 자동 no-op (자연 종료)
  - 17,839건 → 500건/회 × 36회 ≈ 6시간 완료 예상

- **미구현 대시보드 페이지 3개 신규 구현**
  - `app/kbeauty/dashboard/supplier/matches/page.tsx` — 매칭 관리 (전체/대기중/승인/거절 탭, 승인·거절 액션, Pro 게이트)
  - `app/kbeauty/dashboard/supplier/settings/page.tsx` — 공급사 계정 설정 (알림 설정, 비밀번호 변경, Danger Zone)
  - `app/kbeauty/dashboard/seller/settings/page.tsx` — 셀러 계정 설정 (동일 구조, 골드 accent)

- **공급사 가입 서류 필수 해제** (`app/kbeauty/supplier/register/page.tsx`)
  - "준비 중 — 가입 후 대시보드에서 제출" 체크박스 추가
  - 체크 시 라디오·파일 피커 숨김, 필수 검증·Submit 비활성화 해제
  - DB 삽입 시 `cosmetic_license_type: "준비중"` 저장

- **공급사 프로필 서류 업로드 섹션 추가** (`app/kbeauty/dashboard/supplier/profile/page.tsx`)
  - 미제출 / 검토 중 / 인증 완료 3단계 상태 UI
  - 파일 업로드 후 `cosmetic_license_type`, `cosmetic_license_url` DB 갱신
  - 어드민 승인 전까지 `cosmetic_license_verified = false` 유지

- **바이어 공급사 목록 인증 필터** (`app/kbeauty/dashboard/buyer/suppliers/page.tsx`)
  - `cosmetic_license_verified = true` 공급사 제품만 바이어에게 노출

- **푸터 Discord 링크 교체** (`components/footer-section.tsx`)
  - `discord.gg/MEdWGvgy` → `discord.gg/EcQr36AqtC`

**다음 세션**
- Apollo.io 매핑 파이프라인 구현
- Paddle 웹훅 실서버 등록 및 실결제 테스트

---

## 현재 상태 (2026-06-08 세션 57 기준)

### UnfoldK Beauty (kbeauty) — 파이프라인 어드민 UI 개선 + 번역 파이프라인 실행

**완료 항목**

- **파이프라인 탭 스테이징 목록 아코디언 통합** (`app/kbeauty/admin/page.tsx`)
  - 공급사 아코디언 펼침 시: 현황 카드 + 실행 버튼 + 스테이징 목록(필터·테이블·페이지네이션) 한 블록
  - 바이어·셀러 아코디언: "스테이징 목록 — 준비중입니다" placeholder
  - 외부 스테이징 섹션 + 파이프라인 필터 탭(공급사/바이어/셀러) 완전 제거
  - `stagingListPipeline` state, `switchStagingPipeline` 함수 제거

- **`scripts/translate-pipeline.ts` 백그라운드 실행**
  - 대상: `translate_status='pending'` 28,879건
  - `Start-Process cmd` + `> translate.log 2>&1` 로 세션 종료 후에도 계속 실행
  - 재실행 안전성 확인: 두 쿼리 모두 `.eq("translate_status", "pending")` 필터 → completed/failed 행 건드리지 않음
  - 로그 확인: `Get-Content translate.log -Wait -Tail 5 -Encoding UTF8`

**다음 세션**
- 번역 완료 후 translate.log 결과 확인
- Apollo.io 매핑 파이프라인 구현

---

## 현재 상태 (2026-06-08 세션 56 기준)

### UnfoldK Beauty (kbeauty) — BeautyNavbar 표시명 + Market Intelligence 배지 문구 수정

**완료 항목**

- **Step 01 배지 문구 수정** (`app/kbeauty/market-intelligence/page.tsx`)
  - "Trend Radar · 1 vote/user/day" → "Trend Radar · Daily Vote Limit Applied"

- **BeautyNavbar 네비 표시명 수정** (`components/kbeauty/BeautyNavbar.tsx`)
  - 데스크톱·모바일 모두 "Trend Radar" → "Market Intelligence" (href `/kbeauty/market-intelligence` 유지)

---

## 현재 상태 (2026-06-08 세션 55 기준)

### UnfoldK Beauty (kbeauty) — 공통 BeautyNavbar + AdBanner 빈 슬롯 + Market Intelligence 신규

**완료 항목**

- **HallyuCalendar 가로 스크롤 제거** (`app/calendar/page.tsx`)
  - 루트 `<div>`에 `overflow-x-hidden` 추가

- **AdBanner 빈 슬롯 UI** (`components/kbeauty/AdBanner.tsx`)
  - 광고 없을 때 `return null` → 점선 테두리 + "Advertise Here · Reach verified K-beauty partners" + "Apply →" 플레이스홀더 표시
  - `SLOT_EMPTY_HEIGHT` 맵으로 슬롯별 높이 분기

- **공통 BeautyNavbar 컴포넌트** (`components/kbeauty/BeautyNavbar.tsx`) 신규
  - 인증 상태 내부 관리, 3 variant (light / dark / black), 골드 아바타 드롭다운
  - 9개 kbeauty 페이지 일괄 적용, 860줄 중복 코드 제거
  - 네비 표시명 "Trend Radar" (href `/kbeauty/market-intelligence` 유지)

- **Data Sources → Market Intelligence 전환**
  - `app/kbeauty/data-sources/page.tsx`: `redirect("/kbeauty/market-intelligence")` 리다이렉트만
  - `app/kbeauty/market-intelligence/page.tsx` 신규 (3섹션: Sourcing Sniper Top 3 / AdBanner / How UnfoldK Works 타임라인)
  - 사용자 노출 텍스트에서 snake_case DB 식별자 전부 제거

**다음 세션**
- Paddle 웹훅 실서버 등록 및 실결제 테스트
- Pro 유저 UX 확인 (proActive=true 상태 대시보드 흐름)

---

## 현재 상태 (2026-06-08 세션 54 기준)

### UnfoldK Beauty (kbeauty) — Supplier Pro 결제 + 네비 개선 + Sourcing Sniper Annual

**완료 항목**

- **K-Beauty 네비게이션 전체 정비**
  - `app/kbeauty/page.tsx` / `buyer/page.tsx` / `seller/page.tsx` / `supplier/page.tsx`: sticky top-0 + 스크롤 시 bg-white/95 + shadow-sm + backdrop-blur
  - 공급사·셀러 랜딩 (dark hero): `absolute→sticky` 전환 버그 수정 — `bg-transparent` → `bg-[#1A3A5C]` 미스크롤 상태 (sticky 시 흰 바디 노출 문제)
  - `buyer/register/page.tsx` / `seller/register/page.tsx`: sticky nav + 스크롤 shadow + "How It Works" 제거 + Data Sources 링크 수정
  - 전체 4개 랜딩 + 2개 가입 페이지: `ScrollTopButton` (fixed bottom-8 right-8, Navy 원형, ChevronUp) 추가
  - `trend-radar/page.tsx`: 다크 테마 Navbar (bg-[#0F0F0F] 고정) + ScrollTopButton 신규 추가

- **Data Sources 페이지 신규** (`app/kbeauty/data-sources/page.tsx`)
  - 5개 섹션, 13개 데이터 카드: 공급사 (MFDS·NTS·FDA MoCRA) / 바이어 (관세·Apollo.io) / 셀러 (Amazon·Shopify·TikTok Shop) / 컴플라이언스 (FDA·ISO 22716·CPNP) / 마켓인텔리전스 (UN Comtrade·Hallyu Fan Vote)
  - government/trade/marketplace/compliance/proprietary 뱃지 분류

- **Supplier Pro 구독 결제 연동**
  - `lib/paddle/constants.ts`: `supplier_pro_monthly` / `supplier_pro_annual` Price ID + `SUPPLIER_PRO_PRICE_IDS` Set
  - `supabase/migrations/0077_beauty_suppliers_pro.sql`: `beauty_suppliers`에 `pro_active BOOLEAN DEFAULT false`, `paddle_customer_id TEXT`, `paddle_subscription_id TEXT` 추가 **(실행 완료)**
  - `app/api/paddle/webhook/route.ts`: Supplier Pro activation (`pro_active=true`) / cancellation (`pro_active=false`) 처리. 취소 fallback 조회: `users → beauty_suppliers` 순 확장
  - `app/kbeauty/dashboard/supplier/page.tsx`:
    - `ProUpgradeModal` 컴포넌트 (CheckCircle2 피처 리스트 + 월간 $49 / 연간 $399 Paddle Overlay 체크아웃)
    - `proActive` / `showProModal` / `userEmail` 상태 추가, load() 에서 `pro_active` 패치
    - 매칭 승인 버튼 → `!proActive` 시 Pro 모달 트리거 (`Lock` 아이콘 표시)
    - 샘플 승인 버튼 → 동일 게이팅
    - 추천 바이어·셀러 섹션 헤더: PRO 뱃지 / idx ≥ 3 항목 `blur-sm pointer-events-none` / 전체 열람 링크
    - 기존 "Pro 업그레이드 배너" `onClick` 연결 + `proActive` 시 자동 숨김
  - `app/kbeauty/supplier/page.tsx`: `PricingSection` (Free vs Pro 2단 카드, `PADDLE_PRICE_IDS` 연동) BenefitsSection 직후 삽입

- **Sourcing Sniper Annual 플랜 추가**
  - `lib/paddle/constants.ts`: `sourcing_sniper_annual: 'pri_01kthga3328gjmwhqs32t0sgqq'` + `SOURCING_SNIPER_PRICE_IDS` Set 포함 (webhook 자동 커버)
  - `app/kbeauty/sourcing-sniper/page.tsx`: Monthly / **Annual $249/년 (28% OFF)** / One-time 3단 플랜 UI

**다음 세션**
- Paddle 웹훅 실서버 등록 및 실결제 테스트 (샌드박스 → 프로덕션)
- Pro 유저 UX 확인 (proActive=true 상태 대시보드 흐름)

---

## 현재 상태 (2026-06-07 세션 53 기준)

### UnfoldK Beauty (kbeauty) — 공급사 프로필 관리 페이지

**완료 항목**

- **공급사 프로필 관리 페이지 신규 생성** (`app/kbeauty/dashboard/supplier/profile/page.tsx`)
  - ① 헤더: 뒤로가기 브레드크럼 (대시보드 / 프로필 관리)
  - ② 기본 정보: 회사명(ko/en), 웹사이트, 담당자 이름·이메일·전화 — 편집 가능
  - ③ 인증 정보: 사업자등록번호·인증 상태, 화장품 허가 유형·인증, FDA 상태·등록번호 — 읽기 전용
  - ④ 취급 카테고리: 스킨케어 등 7개 토글 버튼
  - ⑤ 인증 보유 현황: ISO 22716 / 비건 / 크루얼티프리 — 토글 ON 시 URL·기관 입력 노출
  - ⑥ 수출 정보: 경험 textarea + 국가 태그 입력 (Enter/쉼표로 추가, × 제거)
  - `beauty_suppliers` UPDATE (인증 필드 제외), `export_countries` TEXT[]/TEXT 양방향 대응
  - 미로그인 시 `/kbeauty/supplier/login` 리다이렉트
- **공급사 대시보드 사이드바 "프로필 관리 →" 항목 추가** (`app/kbeauty/dashboard/supplier/page.tsx`)
  - NAV_ITEMS에 `{ label: "프로필 관리", icon: UserCircle, href: ".../profile" }` 추가
  - `UserCircle` lucide-react 아이콘 import 추가

**다음 세션**
- Migration 0074 (paddle_columns), 0075 (beauty_ratings) Supabase 수동 실행 확인
- Paddle 웹훅 실제 엔드포인트 등록 및 테스트

---

## 현재 상태 (2026-06-06 세션 52 기준)

### UnfoldK Beauty (kbeauty) — 공급사 평점 시스템 + 결제 연동 + 환불 정책

**완료 항목**

- **Paddle 결제 연동 (세션 51 연속)**
  - `@paddle/paddle-js` 설치, `lib/paddle/constants.ts` (Price ID 4개)
  - `components/PaddleProvider.tsx` + `app/layout.tsx` 전역 래핑
  - `components/pricing-section.tsx`: Hallyu Pass Overlay 체크아웃 (customerEmail + userId customData)
  - `app/kbeauty/sourcing-sniper/page.tsx`: `sourcing_sniper_active` 게이팅 + 월 $29 / 평생 $79 결제 버튼
  - `app/api/paddle/webhook/route.ts`: HMAC-SHA256 서명 검증 + subscription.activated / transaction.completed / subscription.canceled / subscription.paused 핸들러
  - `supabase/migrations/0074_paddle_columns.sql`: users.paddle_customer_id / paddle_subscription_id, beauty_sellers.sourcing_sniper_active

- **공급사 평점 시스템**
  - `supabase/migrations/0075_beauty_ratings.sql`: `beauty_ratings` 테이블 (response_speed / product_quality / communication / overall_rating GENERATED, RLS, unique constraint)
  - `components/kbeauty/RatingModal.tsx`: 별점 3항목 + 선택 코멘트, INSERT 후 "Thank you for your review!" toast, 중복 방지
  - `supplier/page.tsx`: 헤더에 평균 평점 (★ X.X / 5.0, N reviews / "No ratings yet") + 매칭·샘플 승인 시 바이어에게 "Rate your experience" 알림 추가 발송
  - `buyer/page.tsx`: Matching Status approved 행에 "Rate Supplier" 버튼 / 이미 평점 시 "Rated ✓"
  - `seller/page.tsx`: "My Sourcing Requests" 섹션 신규 (approved/completed 행에 Rate Supplier) + Discover 카드 공급사 평점 배지
  - `buyer/suppliers/page.tsx`: 제품 카드 공급사 평균 평점 배지 (products 변경 시 batch 로드)

- **환불 정책 페이지**
  - `app/refund/page.tsx`: UnfoldK 메인 환불 정책 (terms 다크 테마, 영어)
    - 월간 구독: 당월 잔여 환불 없음 / 연간: 14일 이내 전액 / Sourcing Sniper: 7일+미사용 조건
  - `app/kbeauty/refund/page.tsx`: kbeauty 환불 정책 (네이비 #1A3A5C / 골드 #C8A882 테마, 동일 내용)
  - `components/footer-section.tsx` Legal 섹션에 Refund Policy 링크 추가
  - `app/kbeauty/page.tsx` kbeauty 푸터에 Refund Policy 링크 추가

---

## 현재 상태 (2026-06-06 세션 51 기준)

### UnfoldK Beauty (kbeauty) — 공급사 가입·대시보드 개선

**완료 항목**

- **로그인 페이지 한영혼용 정책** (`app/kbeauty/login/page.tsx`)
  - 제목 "Login" / 부제 "공급사 · 바이어 공통 로그인 / Supplier & Buyer Login"
  - Email·Password·Forgot password·New here → 영문만 / 공급사 "공급사 가입" / 바이어 "Buyer Sign Up"

- **Get Started 모달** (`app/kbeauty/auth/page.tsx`): 타이틀 "어떤 분이신가요? / Who are you?"

- **미들웨어 통과 실패 버그 수정**
  - 원인: `signUp()` + 이메일 인증 활성화 → `session=null` → 미들웨어 차단
  - 해결: `app/api/kbeauty/auth/signup/route.ts` 신설 — Admin API `createUser({ email_confirm: true })` → 이메일 미발송 + 즉시 인증 상태 → `signInWithPassword`로 세션 획득
  - `app/kbeauty/supplier/page.tsx` + `app/kbeauty/buyer/register/page.tsx` 동일 적용

- **공급사 가입 폼 "인증 및 서류" 섹션 추가** (`app/kbeauty/supplier/page.tsx`)
  - 화장품 등록필증 유형 + 파일 업로드 (필수)
  - FDA 등록번호 / ISO 22716 / 비건 인증 / 크루얼티프리 / 수출 경험 (선택)
  - `kbeauty-documents/suppliers/{uid}/{파일명}` 스토리지 업로드

- **Migration `0065_beauty_suppliers_certifications.sql` 실행 완료**
  - `beauty_suppliers` 13개 컬럼 추가 (`cosmetic_license_url`, `fda_registration_number`, `iso_22716_url`, `vegan_cert_org/url`, `cruelty_free_cert_org/url` 등)
  - `kbeauty-documents` 스토리지 버킷 + RLS 정책

- **공급사 대시보드 북미 수출 준비 가이드 편집 기능** (`app/kbeauty/dashboard/supplier/page.tsx`)
  - 읽기 전용 → 인라인 편집 폼 전환 (텍스트 인풋 + 파일 업로드)
  - 화장품 등록필증 (파일) / FDA 등록번호 (텍스트) / ISO 22716 (파일) / 비건 (기관명+파일) / 크루얼티프리 (기관명+파일) / 수출국 (텍스트)
  - 저장: 파일 → Storage 업로드 → `beauty_suppliers` UPDATE → 로컬 상태 반영
  - 케이스별 에러 토스트: 용량초과(10MB) / 형식오류(PDF·JPG·PNG) / Storage 실패 / 네트워크 / JWT만료(로그인 액션버튼) / 그외 오류코드
  - `<Toaster richColors />` 로컬 마운트 (비-admin 페이지 규칙)

---

## 현재 상태 (2026-06-05 세션 50 기준)

### UnfoldK Beauty (kbeauty) — MVP 1차 개발

**완료 항목**
- KBEAUTY.md v4.1 기준 파일 확정 (beauty_ 프리픽스 테이블명 반영)
- P01 B2B 랜딩 / P02 공급사 신청 / P05 바이어 랜딩 / P06 바이어 가입 페이지 배포
- `app/kbeauty/layout.tsx`: Cormorant Garamond 폰트 + `-mt-[72px]` (UnfoldK header offset)
- `components/header.tsx`: `HIDE_HEADER_PREFIXES`에 `/kbeauty` 추가

**Supabase 마이그레이션**
- `0061`: `beauty_suppliers` / `beauty_buyers` / `beauty_products` / `beauty_matches` / `beauty_trade_analytics` / `beauty_post_matching_services` 6개 테이블 (beauty_ 프리픽스 통일)
- `0062`: `beauty_suppliers` 연락처 필드 추가 (`contact_name` / `contact_email` / `contact_phone` / `website` / `fda_status`)
- `0063`: `beauty_suppliers` anon INSERT 정책 (공급사 신청 공개 페이지)
- `0064`: `beauty_buyers` 추가 필드 (`state` / `handling_korean_products` / `linkedin_url` / `known_suppliers`) + status CHECK에 `pending` 추가 + anon INSERT 정책

**미들웨어 role 가드** (`middleware.ts`)
- `/kbeauty/dashboard/supplier/*` → `beauty_suppliers` 레코드 필요
- `/kbeauty/dashboard/buyer/*` → `beauty_buyers` 레코드 필요
- `/kbeauty/admin` → `is_admin` RPC
- 미인증·불일치 → `/kbeauty` 리다이렉트

**국세청 API 공급사 1단계 인증** (`app/api/kbeauty/verify-business/route.ts`)
- `nts-businessman/v1/status` POST 연동
- `b_stt_cd === "01"` (계속사업자) → `{ verified: true }`
- 10초 타임아웃, 휴업·폐업 422 처리
- `.env.local` `NTSAPI_KEY` 추가

**공급사 폼 저장** (`app/kbeauty/supplier/page.tsx`)
- 인증 성공 후 `beauty_suppliers` INSERT → `/kbeauty/dashboard/supplier` 리다이렉트
- 웹사이트 인풋 `https://` prefix UI

**바이어 폼 저장** (`app/kbeauty/buyer/register/page.tsx`)
- `beauty_buyers` INSERT (`status: 'active'`, `stage1_approved: true`) → `/kbeauty/dashboard/buyer` 리다이렉트
- Business Type 라디오 → 체크박스 복수선택으로 변경
- 웹사이트 인풋 `https://` prefix UI

---

## 현재 상태 (2026-06-04 세션 49 기준)

### Curation K — My Hallyu Course 추가 개선 (세션 49 후속)

**stop 좌표 보완 4단계 순차 매칭** (`save/route.ts`)
- 1차: `eng_title ILIKE %name%`
- 2차: `title ILIKE %name%`
- 3차: 괄호 내용 추출 후 eng_title / title 재시도 (`"낙타트레킹 (Camel Trekking)"` → `"Camel Trekking"`)
- 4차: 모두 실패 시 lat/lng null 유지

**CourseMiniMap 핀 불일치 안내**
- `totalStops` useMemo: 선택된 day 전체 stop 수
- `dayStops.length < totalStops` 시 `AlertTriangle` + "{n} of {total} stops could not be mapped" 표시

---

### Curation K — My Hallyu Course 전면 개편 (세션 49)

**My Hallyu Course 입력 UI 개편**
- FROM: ip-api.com 3초 타임아웃 IP 위치 감지 → 자동 입력, 감지 실패 시 안내 문구
- TO: City(REGION_OPTIONS 드롭다운) / Keyword(tour_spots 실시간 검색) 탭 전환
  - 탭: 배경 없이 텍스트 컬러만 (`#FF4B6E` 선택 / `rgba(255,255,255,0.35)` 미선택)
  - Keyword 탭: 한글(title) + 영문(eng_title) + 주소(addr1) 동시 검색, placeholder 업데이트
- FROM↔TO 직선거리 Haversine 배지 표시
- Travel Style 버튼 완전 제거 → 고정 안내 문구 교체
- Generate 버튼 하단 재검색 안내 추가

**코스 생성 로직 개선**
- drama_title 필수 필드 제거 (PostSchema, save route, page.tsx 전체)
- LENGTH_CONTENT_TYPES: 1d=숙박제외 / 2d+=전체 카테고리
- `computeAllocations` + `selectByCategory`: 카테고리별 균등 배분 (비율 기반)
- Haversine 반경 필터: 1d=10km / 2d=20km / 3d+=30km (좌표 없는 spot은 통과)
- Fisher-Yates 셔플: 재검색마다 다른 spot 조합
- System prompt: Travel Style 스타일 분기 제거, 하루 최대 5 stops 명시
- max_tokens 증가: 1d=3072 / 2d=4096 / 3d=5120 / 5d=6144 / 7d=7168

**travel_info (출발→목적지 이동 정보)**
- Claude tool schema에 travel_info 필드 추가 (required)
- 교통수단별 포맷(✈️⛴️🚂🚌) + 가격(₩) + 팁(💡🌤️💳🗣️) 생성
- CourseMiniMap 범례 하단 표시: 줄별 스타일 분리 (제목/교통수단 mono/팁)
- 저장 시 enrichedItinerary에 travel_info 포함 (누락 버그 수정)

**코스 저장 개선**
- stop lat/lng 없는 경우 tour_spots eng_title ILIKE 매칭으로 보완 (Promise.all 병렬)
- StopSchema에 lat/lng optional 추가 (Zod strip 방지)

**CourseMiniMap 개선**
- 나침반: 사방 텍스트 → 좌상단 컴팩트 십자+북쪽 pulse 애니메이션
- meta prop 추가: departure≠arrival 시 Day 1 SVG 우상단 직선거리 텍스트
- travel_info prop 추가: Day 1 범례 하단 구분선+멀티라인 표시

**StopNearbyBox (신규)**
- stop 카드 하단: lat/lng 있는 stop마다 주변 2km 내 tour_spots 자동 조회
- 결과 2단 그리드: [type 배지] 장소명 · 거리(m/km)
- nearby-spots route에 POST 핸들러 추가 (bounding box + Haversine 필터, top 10)

**저장 코스 UX**
- 카드 전체 너비 (grid-cols-2 → grid-cols-1)
- 펼칠 때 compact 제거 → 헤더+지도 풀 표시
- ChevronRight → ChevronDown (펼침 방향 표시)

**spot-search 개선**
- lat/lng IS NOT NULL 필터 제거 (좌표 없는 spot도 검색 포함)
- title(한글) ILIKE 추가 → 한글 키워드 검색 지원
- 서버 로깅 추가 (디버깅용)

---

### UI 개선 — KpopStats 탭 / KfoodKit 레시피 랜덤

**KpopStats 탭 개선**
- 탭 스타일 Curation K 기준으로 통일: `inline-flex gap-1.5 px-4 py-2 rounded-full text-xs font-medium border` + inline style 색상 분기
- 활성: `#FF4B6E` 배경+테두리+흰 텍스트 / 비활성: `#1a1a1a` 배경+`rgba(255,255,255,0.1)` 테두리+`rgba(255,255,255,0.7)` 텍스트
- Sticky 고정 `top-[72px]`, 탭 클릭 시 `window.scrollTo({ top: 0, behavior: "smooth" })` — scroll-to-top 버그 수정
- 이모지 span → lucide 아이콘: Charts `BarChart2`, Chart Attack `Flame`
- Chart Attack 비활성 시 `animate-pulse` 빨간 점 진입 유도

**Chart Attack 탭 이모지 전체 교체**
- JSX 내 🔥 7곳 → `<Flame />` 교체 (JS 템플릿 문자열·주석은 이모지 유지)

**KfoodKit 레시피 랜덤 노출**
- `app/api/food/recipes/route.ts`: `.order(created_at)` 제거 → Fisher-Yates shuffle + JS 페이지네이션
- `revalidate = 0` + `force-dynamic`, `MAX_POOL = 1000` 상한

**코딩 원칙 추가**
- `CLAUDE.md §6` 10번: UI 아이콘 lucide-react 기본 채택

---

## 다음 할 일

- [ ] **drama_items migration 0058 실행** (`supabase/migrations/0058_drama_items.sql`)
- [ ] `npx tsx scripts/generate-drama-items.ts --dry-run` 확인 후 실행
- [ ] KpopStats Today's Trending Top 5 → Free / 나머지 상세 → Pro 잠금
- [ ] kpop_albums 초기 수집: `npx tsx scripts/sync-musicbrainz-releases.ts --dry-run` 확인 후 실행
- [ ] KpopStats → HallyuCalendar 컴백 연결
- [ ] filming_spots 어드민 Phase 2
- [ ] 결제 연동 (Lemon Squeezy 재심사 완료 후)

---

## 사용자 액션 필요

**migration 0075** (`supabase/migrations/0075_beauty_ratings.sql`) Supabase SQL Editor 실행 → beauty_ratings 테이블 생성

**migration 0074** (`supabase/migrations/0074_paddle_columns.sql`) Supabase SQL Editor 실행 → users.paddle_customer_id/paddle_subscription_id, beauty_sellers.sourcing_sniper_active

**migration 0058** (`supabase/migrations/0058_drama_items.sql`) Supabase SQL Editor 실행 → drama_items 테이블 생성

**migration 0059** (`supabase/migrations/0059_chart_attack.sql`) → chart_attack_votes 테이블

**migration 0060** (`supabase/migrations/0060_kpop_milestone_cache.sql`) → kpop_milestone_cache 테이블

**korean_grammar_cache** (신규):
```sql
CREATE TABLE IF NOT EXISTS korean_grammar_cache (
  phrase_id   text        PRIMARY KEY,
  grammar_text text       NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE korean_grammar_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pro_users_read_grammar_cache"
  ON korean_grammar_cache FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid()
        AND (u.plan_type IN ('monthly', 'annual') OR u.is_admin = true)
    )
  );
```

**migration 0056** (fan_event_requests / hallyu_calendar_events contact_email + registration_link 컬럼):
```sql
ALTER TABLE public.fan_event_requests
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS registration_link text;
ALTER TABLE public.hallyu_calendar_events
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS registration_link text;
```

**migration 0057** (kpop_albums 테이블):
```sql
CREATE TABLE IF NOT EXISTS public.kpop_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.kpop_artists(id) ON DELETE CASCADE,
  mbid text NOT NULL,
  title text NOT NULL,
  release_date date,
  type text NOT NULL CHECK (type IN ('album', 'single', 'ep')),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artist_id, mbid)
);
CREATE INDEX IF NOT EXISTS idx_kpop_albums_artist_release ON public.kpop_albums(artist_id, release_date DESC);
ALTER TABLE public.kpop_albums ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.kpop_albums TO anon, authenticated;
GRANT ALL ON public.kpop_albums TO service_role;
CREATE POLICY "kpop_albums_select_all" ON public.kpop_albums FOR SELECT TO anon, authenticated USING (true);
```

---

## 블로커

- top.gg 심사 대기
- r/Korean 포스팅 승인 대기

**Paddle KYB** — Hallyu Pass는 Polar로 대체 완료(E2E 검증 2026-06-21). kbeauty(Sourcing Sniper, Supplier Pro)는 여전히 Paddle 사용 중이므로 KYB 통과 후 프로덕션 전환은 kbeauty 한정으로 필요.
