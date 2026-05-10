# CLAUDE.md — UnfoldK 프로젝트 개발 가이드
> Claude Code가 세션 시작 시 반드시 읽는 파일입니다.
> 코드 작성 전 이 파일을 숙지하고, 결정 사항은 DECISIONS.md에 누적하세요.

---

## 🎯 현재 개발 중
**HallyuCalendar (M+0)** — K팝·K드라마 이벤트 통합 캘린더 구독
- 목표: MVP 2~3주 내 출시
- 다음 예정: KpopStats (M+1, YouTube API 인프라 공유)

---

## 1. 프로젝트 개요

- **서비스명**: UnfoldK
- **도메인**: unfoldk.com
- **운영사**: UNFOLD LAB (unfoldlab.net / tubewatch.kr 운영)
- **형태**: 한류 팬 대상 통합 구독 SaaS (B2C, 글로벌, 영어권 + 동남아)
- **구성**: 5개 마이크로 서비스를 하나의 플랫폼에서 운영
- **브랜드 컬러**: #FF4B6E (핑크레드)

---

## 2. 기술 스택 (확정)

| 영역 | 기술 | 비고 |
|------|------|------|
| 프론트엔드 | Next.js (App Router) | React 기반, TypeScript 필수 |
| 백엔드 | Python FastAPI | Railway 배포 |
| DB | Supabase (PostgreSQL) | Auth 포함 |
| 인증 | Supabase Auth | Google OAuth, Apple OAuth, 이메일 로그인 |
| 결제 | Lemon Squeezy | Merchant of Record. 글로벌 세금·인보이스·환불 대행. TossPayments 사용 금지 |
| 프론트 배포 | Vercel | |
| 백엔드 배포 | Railway | |
| AI | Claude API (Haiku 4.5) | $1/$5 per 1M 토큰, 배치 API 활용 |
| TTS | ElevenLabs Creator | HangeulGo 전용, $22/월 |
| 이메일 | Resend | 무료 3,000건/월 |

> ⚠️ 결제는 Lemon Squeezy(MoR)로 확정 — 2026-05-08 Stripe 에서 전환. 자세한 내용은 DECISIONS.md 참조. TossPayments 는 해외 유저 경험 불량으로 영구 제외.
> ⚠️ 백엔드 SDK 설치 완료 — `@supabase/*`, `@lemonsqueezy/lemonsqueezy.js`, `@anthropic-ai/sdk`, `resend`, `googleapis` 등 package.json에 반영됨.

### UI 시스템 (확정)
- **shadcn/ui** (style: `new-york`, base: `neutral`, RSC on) — `components.json` 기준
- 기본 컴포넌트는 `@/components/ui/*`에서 import (Radix UI primitives + Tailwind)
- 아이콘: **lucide-react** / 폼: **react-hook-form + zod** / 테마: **next-themes** / 차트: **recharts** / 토스트: **sonner**
- 새 UI 컴포넌트가 필요하면 임의 작성 전에 shadcn 표준 컴포넌트가 있는지 먼저 확인할 것

---

## 개발 명령어 (Commands)

```bash
pnpm dev       # 로컬 개발 서버 (http://localhost:3000)
pnpm build     # 프로덕션 빌드
pnpm start     # 빌드 결과 실행
pnpm lint      # ESLint (※ 현재 eslint config 파일 미설정 — 추가 필요)
```

**패키지 매니저: pnpm 전용** — `pnpm-lock.yaml` 사용 중. npm/yarn 사용 금지 (lockfile 충돌·node_modules 구조 차이로 빌드 깨짐).

**경로 alias**: `@/*` → 레포 루트 (예: `@/components/ui/button`, `@/lib/utils`, `@/hooks/use-toast`).

**빌드 설정 주의**: `next.config.mjs`에서 `typescript.ignoreBuildErrors: true`, `images.unoptimized: true` 상태. API 연동 시작 전에 strict 빌드로 전환 필요.

---

## 3. 구독 플랜 구조

```
Free          무료       전 서비스 기본 기능 (제한적)
Hallyu Pass   $15/월    5개 서비스 Pro 전체
Hallyu Pass   $120/년   통합 Pro + 20% 할인 ($10/월)
```

> ⚠️ DB 설계 시 반드시 이 3가지 플랜을 전제로 users, subscriptions 테이블 설계.
> 회원가입 시 Hallyu Pass가 기본 선택으로 표시됨 (전환율 최적화).
> Hallyu Pass 카드 내부에 Monthly/Annually 토글 포함.

---

## 4. 서비스 출시 로드맵 (전체)

| 시기 | 서비스 | 월 API 비용 | 핵심 |
|------|--------|------------|------|
| M+0 | HallyuCalendar | $0 | API 전부 무료, 즉시 수익화 |
| M+1 | KpopStats | $0~100 | YouTube 인프라 재활용 |
| M+2 | KdramaMatch | $5~15 | Claude Haiku 종량제 |
| M+3 | HangeulGo | $30~129 | ElevenLabs TTS 필수 |
| M+4 | KfoodKit | $31~87 | Spoonacular 필수 |

> M+0 개발 시에도 M+1~4를 고려한 확장 가능한 구조로 설계할 것.

---

## 5. 완성된 페이지 목록 (v0에서 UI 완성)

모든 페이지는 v0에서 UI가 완성된 상태입니다.
Claude Code는 UI를 수정하지 말고 API 연동·로직·인증만 붙이세요.

### 서비스 페이지
| 라우트 | 페이지 | 비고 |
|--------|--------|------|
| / | 랜딩 페이지 | 완성 |
| /calendar | HallyuCalendar | M+0 개발 중 |
| /kpop | KpopStats | M+1 |
| /drama | KdramaMatch | M+2 |
| /korean | HangeulGo | M+3 |
| /food | KfoodKit | M+4 |

### 인증 페이지
| 라우트 | 페이지 |
|--------|--------|
| /login | 로그인 |
| /signup | 회원가입 (Hallyu Pass 기본 선택) |
| /forgot-password | 비밀번호 찾기 |
| /verify-email | 이메일 인증 |

### 마이페이지
| 라우트 | 페이지 |
|--------|--------|
| /mypage | 대시보드 |
| /mypage/subscription | 구독 관리 |
| /mypage/calendar | 내 캘린더 |
| /mypage/artists | 내 아티스트 |
| /mypage/dramas | 내 드라마 |
| /mypage/learning | 학습 진도 |
| /mypage/recipes | 저장한 레시피 |
| /mypage/settings | 설정 |

### 결제 페이지
| 라우트 | 페이지 |
|--------|--------|
| /payment/success | 결제 완료 |
| /payment/fail | 결제 실패 |

### 기타 페이지
| 라우트 | 페이지 |
|--------|--------|
| /about | About |
| /privacy | 개인정보처리방침 (EN/KO 토글) |
| /terms | 이용약관 (EN/KO 토글) |
| /404 | 에러 페이지 |

---

## 6. 전체 링크 맵 (연동 완료)

```
Navbar:
  UnfoldK 로고 → /
  Services > HallyuCalendar → /calendar
  Services > KpopStats → /kpop
  Services > KdramaMatch → /drama
  Services > HangeulGo → /korean
  Services > KfoodKit → /food
  Services > View Hallyu Pass → /#pricing
  About → /about
  My Page → /mypage
  Log in → /login
  Try for Free → /signup

인증:
  로그인 > Forgot password → /forgot-password
  로그인 > Sign up → /signup
  회원가입 > Log in → /login
  회원가입 완료 → /verify-email

결제:
  결제 완료 > Go to Dashboard → /mypage
  결제 완료 > View receipt → /mypage/subscription
  결제 실패 > Try again → /signup

마이페이지:
  Subscription 메뉴 → /mypage/subscription
  Continue (HangeulGo) → /korean
  Manage subscription → /mypage/subscription

서비스 업셀:
  모든 Upgrade 버튼 → /signup
  Add to Calendar → /login (로그인 유도)

Footer:
  서비스 5개 링크 → 각 서비스 라우트
  About → /about
  Privacy Policy → /privacy
  Terms of Use → /terms
```

---

## 7. DB 설계 원칙

```
- 모든 서비스가 단일 Supabase 프로젝트를 공유
- users 테이블: 5개 서비스 공통 계정
- subscriptions 테이블: plan_type, billing_cycle, expires_at 포함
- 서비스별 데이터는 별도 테이블로 분리
- RLS(Row Level Security) 초기부터 적용 필수
```

**핵심 테이블 구조 (최소)**
```sql
users
  id, email, created_at, plan_type, subscription_status

subscriptions
  id, user_id, plan_type, billing_cycle(monthly/annual),
  starts_at, expires_at, lms_subscription_id

hallyu_calendar_events
  id, type(comeback/drama/concert/fanmeet),
  artist_or_drama, event_date, source_api, created_at

user_calendar_subscriptions
  id, user_id, artist_or_drama_id, notification_enabled
```

---

## 8. API 사용 원칙

### 공통
- **캐싱 우선**: 외부 API 호출 전 항상 DB/Redis 캐시 확인
- **쿼터 관리**: YouTube API는 tubewatch.kr와 **반드시 별도 GCP 프로젝트** 사용
- **환경변수**: 모든 API 키는 .env에만 관리, 코드 하드코딩 절대 금지

### 서비스별 API 목록

**HallyuCalendar (현재)**
```
YouTube Data API v3   무료, 10,000유닛/일   컴백 영상 감지
TMDB API             무료, 초당 40req       드라마 방영 일정
Google Calendar API  무료, OAuth 기반       유저 캘린더 연동
Last.fm API          무료, 5req/초          아티스트 신보 감지
Resend               무료, 월 3,000건       D-Day 알림 이메일
```

**KpopStats (M+1)**
```
YouTube Data API v3   무료 (HallyuCalendar GCP 프로젝트 재활용)
Last.fm API          무료
Hallyu API (GitHub)  무료 오픈소스, 1992~2020 K팝 DB
X(Twitter) Basic     $100/월 — MAU 500명+ 달성 후 도입
```

**KdramaMatch (M+2)**
```
TMDB API             무료
MyDramaList API      무료, 키 신청 필요 (수일 소요)
Claude Haiku 4.5     $1/$5 per 1M 토큰, 드라마 요약 1건 ≈ 500토큰
```

**HangeulGo (M+3)**
```
TMDB API             무료
Naver 사전 API       무료, 일 25,000건 — 백엔드 연동 필수
Claude Haiku 4.5     $1/$5 per 1M 토큰, 카드 1장 ≈ 300토큰
ElevenLabs Creator   $22/월 — 음성 사전 생성 후 CDN 캐싱으로 요청 70% 절감
```

**KfoodKit (M+4)**
```
YouTube Data API v3  무료
Spoonacular Starter  $29/월 — Free(150pt/일)로 MVP 테스트 후 전환
Claude Haiku 4.5     $1/$5 per 1M 토큰, 레시피 1건 ≈ 400토큰
```

> ⚠️ Spotify API 사용 금지 — 2025.05부터 법인만 가능. Last.fm으로 대체

---

## 9. 저작권 & 이미지 사용 원칙

```
- TMDB 이미지: URL 링크로만 사용. 서버에 직접 저장 금지
- 아티스트 사진: 실제 사진 직접 사용 금지. YouTube 썸네일 링크 방식 권장
- TMDB 출처 표기 필수: "This product uses the TMDB API but is not endorsed or certified by TMDB."
- 드라마 클립·장면: 직접 사용 절대 금지
- TMDB 상업 라이선스: 출시 전 sales@themoviedb.org 협의 필요
```

---

## 10. 코딩 원칙

```
1. TypeScript strict 모드 — any 타입 사용 금지
2. 컴포넌트 단위 분리 — 페이지당 로직과 UI 분리
3. API 라우트는 /app/api/ 하위에 서비스별 폴더로 분리
4. 에러 핸들링 — 외부 API 실패 시 fallback 처리 필수
5. 캐싱 — 외부 API 응답은 Supabase 또는 Next.js cache에 저장
6. 환경변수 — .env.local (개발) / Vercel 환경변수 (운영) 분리
7. 주석 — 핵심 비즈니스 로직에 한국어 주석 필수
8. 커밋 — 기능 단위로 커밋, 메시지는 한국어로 작성
9. UI 수정 금지 — v0에서 완성된 UI 스타일은 건드리지 말 것
```

---

## 11. 폴더 구조

### 11-A. 현재 실제 구조 (Actual, 2026-05-10 기준)

```
UnfoldKorea/
├── CLAUDE.md / DECISIONS.md / PROGRESS.md   ← 누적 운영
├── .env.local                                ← LMS / Supabase / Anthropic / Resend / TMDB / YouTube / Last.fm / CRON 모두 등록
├── middleware.ts                             ← /admin 가드 + 비관리자 ?toast=unauthorized redirect
├── vercel.json                               ← cron 슬롯 (ingest-all 04:00 UTC, send-reminders 09:00 UTC, ingest-kpop-stats 07:00 UTC, ingest-tmdb-dramas 05:30 UTC)
├── next.config.mjs                          (ignoreBuildErrors: true / images.unoptimized: true / image.tmdb.org remotePatterns)
├── components.json                          (shadcn/ui new-york, neutral)
├── app/
│   ├── layout.tsx                           (Metadata: title/description/icons/openGraph/twitter)
│   ├── page.tsx                              ← 랜딩
│   ├── globals.css / not-found.tsx
│   ├── (auth 분리 안 됨 — flat 구조 유지)
│   │   ├── login/, signup/, forgot-password/, verify-email/, start/, redeem/
│   ├── mypage/
│   │   ├── page.tsx (대시보드) / subscription/, fan-events/
│   │   (※ calendar / artists / dramas / learning / recipes / settings 미구현)
│   ├── calendar/, kpop/, drama/, korean/, food/        ← 5개 서비스
│   ├── about/, privacy/, terms/                        ← 정적 페이지
│   ├── payment/{success,fail}/
│   ├── admin/                                          ← is_admin 가드
│   │   ├── layout.tsx (Toaster 마운트, requireAdmin 가드)
│   │   ├── page.tsx (대시보드 — MRR/MAU/쿠폰)
│   │   ├── events/, fan-events/, users/, kpop/, reports/, cron/
│   └── api/
│       ├── auth/                ← callback / apply-coupon / complete-signup
│       ├── calendar/            ← events / reminders
│       ├── cron/                ← ingest-all / ingest-kpop-stats / ingest-tmdb-dramas / send-reminders
│       ├── dramas/              ← list / recommend / watchlist
│       ├── kpop/                ← artists / charts
│       ├── lemonsqueezy/        ← checkout / switch / webhook
│       ├── mypage/              ← fan-events / fan-events/[id]
│       ├── reports/             ← 콘텐츠 신고
│       └── admin/               ← events / fan-events / kpop / reports / cron 트리거
├── components/
│   ├── ui/                      ← shadcn 컴포넌트
│   ├── admin/                   ← events-manager / fan-events-table / users-table / kpop-artists-manager / cron-monitor / reports-table 등
│   ├── common/                  ← report-button / redeem-coupon-modal
│   ├── bento/                   ← v0 템플릿 잔재 (랜딩 전용)
│   ├── floating-calendar-widget.tsx / start-modal.tsx / unauthorized-toast.tsx
│   ├── header.tsx / footer-section.tsx / hero-section.tsx 등 랜딩 컴포넌트
│   ├── ghost-globe.tsx / ghost-globe-dynamic.tsx       ← 히어로 3D
│   └── theme-provider.tsx
├── hooks/                       ← use-mobile.ts / use-toast.ts
├── lib/
│   ├── utils.ts                 ← cn() 헬퍼
│   ├── supabase/                ← server.ts / browser.ts / admin.ts 분리
│   ├── lemonsqueezy.ts          ← SDK 초기화 + 체크아웃 URL 빌더
│   ├── api/                     ← youtube.ts / tmdb.ts / lastfm.ts (외부 API 래퍼)
│   ├── ingest/                  ← youtube.ts / tmdb.ts / lastfm.ts / kpop-stats.ts / dramas.ts
│   ├── claude/                  ← generate-event-description.ts / recommend-dramas.ts
│   ├── coupons/                 ← generate-code.ts
│   ├── email/                   ← send-coupon-email.ts / send-payment-failed-email.ts
│   ├── auth/                    ← plan.ts (hasProAccess / isProPlan / normalizePlanType)
│   ├── admin/                   ← auth.ts (requireAdmin) / format-error.ts
│   └── cron/                    ← auth.ts (CRON_SECRET 검증)
├── supabase/
│   ├── seed.sql
│   └── migrations/              ← 0001 ~ 0016 (init / grants / events RLS / reminder flags / admin+fan_events / admin security definer / signup terms / event description / coupons / fan_event_storage / lms_fields / kpop_stats / service_role_grants / kdrama_match / content_reports / fan_events_owner_update)
├── public/                       ← favicon.png / og-image.png / apple-icon.png / icon.svg / unfoldk_ghost_globe_white.png 등
└── styles/
```

> ✅ §11-B 목표 구조에 거의 도달. 차이: `(auth)` route group 미사용(flat 유지), `types/` 미생성(공용 타입은 각 모듈에서 export), `docs/` 미생성.

### 11-B. 목표 구조 (Target, M+0 완료 시점)

```
UnfoldKorea/
├── app/
│   ├── (auth)/                     ← route group으로 재구성
│   │   ├── login/, signup/, forgot-password/, verify-email/
│   ├── (dashboard)/mypage/         ← 8개 서브라우트 추가
│   │   ├── subscription/, calendar/, artists/, dramas/,
│   │   ├── learning/, recipes/, settings/
│   └── api/                        ← 신규 추가 영역
│       ├── calendar/               ← HallyuCalendar API
│       ├── kpop/, drama/, korean/, food/
│       ├── auth/                   ← Supabase Auth 콜백
│       └── lemonsqueezy/           ← 결제 웹훅
├── components/
│   ├── common/                     ← navbar, footer 이동
│   └── [service]/                  ← 서비스별 컴포넌트
├── lib/
│   ├── supabase.ts                 ← 클라이언트 초기화
│   ├── lemonsqueezy.ts
│   ├── api/                        ← 외부 API 래퍼 (youtube, tmdb, lastfm, ...)
│   └── utils/                      ← utils.ts에서 폴더로 확장
├── types/                          ← 공용 타입
└── docs/
```

---

## 12. 보안 & 법무 체크리스트

```
- [ ] TMDB 상업 라이선스 협의 (sales@themoviedb.org)
- [ ] Google Calendar OAuth 앱 심사 신청 (출시 6주 전)
- [ ] GDPR / CCPA 준수 — 해외 유저 대상, 개인정보 수집 동의 필수
- [ ] 이용약관 & 개인정보처리방침 — 법무 검토 예정 (현재 초안 운영 중)
- [ ] unfoldk.com 상표권 출원 (kipris.or.kr 선행 조회)
- [ ] Supabase RLS 설정 확인 — 배포 전 필수
- [ ] API 키 노출 여부 — 배포 전 전체 코드 검토
- [ ] Lemon Squeezy 계약 완료 확인 (Store ID, API Key, Webhook Secret 운영 환경변수 등록)
- [ ] MyDramaList 상업적 사용 조건 별도 협의
```

---

## 13. 자주 하는 실수 (하지 말 것)

```
❌ YouTube API를 tubewatch.kr GCP 프로젝트와 공유
   → 쿼터 초과 시 두 서비스 모두 중단됨

❌ Spotify API 사용
   → 2025.05부터 법인 계정 필수. Last.fm으로 대체

❌ TossPayments 사용
   → 해외 유저 대상 서비스. Lemon Squeezy로 확정

❌ 서비스별 별도 users 테이블 생성
   → Hallyu Pass 통합 구독 구현 불가

❌ ElevenLabs TTS를 요청마다 실시간 호출
   → 비용 폭증. 사전 생성 + CDN 캐싱 필수

❌ Supabase RLS 나중에 추가하려는 계획
   → 초기부터 설정하지 않으면 전체 보안 재작업

❌ v0 UI 컴포넌트 스타일 임의 수정
   → UI는 v0에서 완성된 상태. 로직·API 연동만 추가할 것

❌ 아티스트 이미지 서버에 직접 저장
   → 저작권 문제. URL 링크 방식으로만 사용

❌ 한 세션에서 여러 서비스 동시 개발
   → 컨텍스트 분산으로 품질 저하. 서비스 하나씩 완성 후 다음으로

❌ 새 필드 추가 시 서버 zod 스키마만 점검하고 UI 폼 누락
   → 서버 라우트는 받게 돼있는데 폼에 입력칸 없으면 항상 빈값(NULL)으로 저장됨.
     에러 안 뜨고 "성공" 토스트만 떠서 데이터 안 들어가는 걸 한참 모름.
     필드 1개 추가 = 다음 6단계 모두 동기화 필수:
     ① 마이그레이션 컬럼 / ② 서버 zod 스키마(POST + PATCH 둘 다) /
     ③ 서버 응답 매핑(snake_case → camelCase) / ④ 클라이언트 type 인터페이스 /
     ⑤ FormState + EMPTY_FORM + startEdit pre-fill / ⑥ 폼 JSX 입력 + handleSubmit body
     2026-05-10 thumbnail_url 누락 인시던트 — 서버는 받게 돼있었지만 어드민 폼이 없어
     사용자 입장에선 "저장 성공"인데 DB는 NULL. 진단에 시간 소요.

❌ Toaster 마운트 안 된 영역에서 useToast 호출
   → 토스트가 silently no-op. 사용자는 작업 결과를 모르고, 개발자는 "왜 토스트 안 뜨지?"
     로 시간 낭비. 현재 root layout 에 Toaster 미마운트 — admin 영역만 마운트됨.
     비-admin 페이지에서 useToast 쓰려면 해당 페이지에 <Toaster /> 로컬 마운트 필수.
     ReportButton 도 admin 외에선 silent fail 상태 (의도적 미해결, 다음 세션 후보).

❌ RLS 정책 변경했는데 마이그레이션 SQL 실행 누락
   → 코드만 배포되고 DB 정책 미적용 시 silent fail. 본인 데이터 update 가 RLS 차단으로
     0행 update 되며 에러도 안 남. 마이그레이션 추가 시 PROGRESS.md "사용자 액션 필요"
     섹션에 SQL 명시 박제 + 사용자 직접 Supabase Dashboard 에서 실행 의무화.
```

---

## 14. 세션 운영 규칙

### 세션 시작 시
```
1. PROGRESS.md 를 먼저 읽고 현재 상태 파악
2. 이번 세션 목표를 한 줄로 확인 후 작업 시작
3. 목표 범위 밖의 작업은 하지 않음 (다음 세션으로)
```

### 작업 중
```
1. 새로운 기술적 결정을 내릴 때마다 DECISIONS.md 에 즉시 기록
   형식: ## [날짜] 결정 제목
         - 결정 내용:
         - 이유:
         - 대안으로 고려했던 것:

2. 외부 API 연동, DB 스키마 변경, 폴더 구조 변경은
   반드시 DECISIONS.md 에 기록
```

### 세션 종료 시
```
1. PROGRESS.md 업데이트
   형식: ## 현재 상태
         - 완료: (이번 세션에서 완료한 것)
         - 진행 중: (미완성 작업)
         - 다음 세션: (다음에 할 것)
         - 블로커: (막힌 것, 결정 필요한 것)

2. 미완성 코드가 있으면 TODO 주석으로 표시
   // TODO: [다음 세션] 구글 캘린더 웹훅 처리 추가 필요
```

### DECISIONS.md 작성 예시
```markdown
## 2026-05-07 결제 수단 Stripe 확정

- 결정 내용: TossPayments 대신 Stripe 사용
- 이유: 해외 유저 대상 서비스. TossPayments는 해외 카드 경험 불량
- 대안으로 고려했던 것: TossPayments, Paddle, Lemon Squeezy
```

### PROGRESS.md 작성 예시
```markdown
## 현재 상태 (2026-05-07)

- 완료: v0 UI 17개 페이지 완성, 링크 연동 완료
- 진행 중: 로컬 폴더 구조 정리 중
- 다음 세션: HallyuCalendar YouTube API 연동 시작
- 블로커: Google Calendar OAuth 앱 심사 신청 필요 (6주 소요)
```

---

## 15. 규칙 우선순위

- 사용자(관리자)의 명시적 요청은 모든 원칙보다 우선한다
- "UI 수정 금지" 원칙은 AI가 임의로 판단해 스타일을 바꾸는 것을 막기 위함
- 사용자가 직접 수정을 지시한 경우에는 v0 영역의 스타일 변화가 어느 정도인지를 미리 알리고 관리자와 상의해 처리한다

---

*UNFOLD LAB | unfoldk.com | 2026년 5월 | v3.0*
