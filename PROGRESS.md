# PROGRESS.md — 현재 상태 스냅샷

> 세션별 전체 기록 → PROGRESS_2026_05.md / PROGRESS_2026_06.md

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

- Paddle 실제 결제 테스트 필요 (샌드박스 환경변수 설정 완료, 웹훅 실서버 연결 확인 필요)
- top.gg 심사 대기
- r/Korean 포스팅 승인 대기
