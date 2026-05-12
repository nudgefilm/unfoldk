# STRUCTURE.md — 폴더 구조 / 페이지 목록 / 링크맵 / API·저작권·법무 레퍼런스

> CLAUDE.md 본문에서 분리. 운영 시 빠르게 찾아보는 정적 레퍼런스.

---

## 1. 완성된 페이지 목록 (v0 UI 완성)

모든 페이지는 v0에서 UI 가 완성된 상태입니다.
Claude Code 는 UI 를 수정하지 말고 API 연동·로직·인증만 붙이세요.

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
| /mypage/fan-events | 팬 이벤트 신청·수정 (본인 pending 만 편집 가능) |
| /mypage/calendar | 내 캘린더 (※ 미구현) |
| /mypage/artists | 내 아티스트 (※ 미구현) |
| /mypage/dramas | 내 드라마 (※ 미구현) |
| /mypage/learning | 학습 진도 (※ 미구현) |
| /mypage/recipes | 저장한 레시피 (※ 미구현) |
| /mypage/settings | 설정 (※ 미구현) |

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
| /cookie | 쿠키 정책 (EN/KO 토글) |
| /start | 신규 가입자 약관 동의 + 플랜 선택 |
| /redeem | 쿠폰 코드 적용 (`/mypage/fan-events` 의 redeem 모달과 동일 API 사용) |
| /404 | 에러 페이지 |

### 어드민 페이지 (`/admin/*` — `is_admin=true` 만 진입)
| 라우트 | 페이지 |
|--------|--------|
| /admin | 대시보드 (MRR / MAU / 쿠폰) |
| /admin/users | 유저 관리 — plan_type 변경 시 subscription_status 자동 sync |
| /admin/events | 캘린더 이벤트 CRUD (썸네일 URL 입력 + 3:4 미리보기) |
| /admin/fan-events | 팬 이벤트 승인·거절 (이전 승인 N회 + 소셜링크 노출) |
| /admin/kpop | KpopStats 아티스트 관리 |
| /admin/reports | 콘텐츠 신고 처리 |
| /admin/cron | Cron 모니터·수동 실행 |

---

## 2. 전체 링크 맵 (연동 완료)

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

## 3. 폴더 구조

### 3-A. 현재 실제 구조 (Actual, 2026-05-10 기준)

```
UnfoldKorea/
├── CLAUDE.md / DECISIONS.md / PROGRESS.md   ← 누적 운영
├── HALLYUMAP.md / COPY.md / STRUCTURE.md    ← 분리 박제 (2026-05-12)
├── .env.local                                ← LMS / Supabase / Anthropic / Resend / TMDB / YouTube / Last.fm / CRON 모두 등록
├── middleware.ts                             ← /admin 가드 + 비관리자 ?toast=unauthorized redirect
├── vercel.json                               ← cron 슬롯 (ingest-all 04:00 UTC, send-reminders 09:00 UTC, ingest-kpop-stats 07:00 UTC, ingest-tmdb-dramas 05:30 UTC)
├── next.config.mjs                          (ignoreBuildErrors: true / images.unoptimized: true / image.tmdb.org remotePatterns)
├── components.json                          (shadcn/ui new-york, neutral)
├── app/
│   ├── layout.tsx                           (Metadata + <Header /> 단일 마운트, body pt-[72px])
│   ├── page.tsx                              ← 랜딩
│   ├── globals.css / not-found.tsx
│   ├── (auth 분리 안 됨 — flat 구조 유지)
│   │   ├── login/, signup/, forgot-password/, verify-email/, start/, redeem/
│   ├── mypage/
│   │   ├── page.tsx (대시보드) / subscription/, fan-events/
│   │   (※ calendar / artists / dramas / learning / recipes / settings 미구현)
│   ├── calendar/, kpop/, drama/, korean/, food/        ← 5개 서비스
│   ├── about/, privacy/, terms/, cookie/                ← 정적·법적 페이지 (모두 EN/KO 토글)
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
│   ├── header.tsx               ← root layout 단일 마운트, usePathname 가드로 admin/login 등에서 null 반환
│   ├── footer-section.tsx       ← Lemon Squeezy / TMDB 라이선스 표기, 쿠키 배너 트리거
│   ├── cookie-consent-banner.tsx ← Dialog 패턴, IntersectionObserver 1회 트리거
│   ├── floating-calendar-widget.tsx / start-modal.tsx / unauthorized-toast.tsx
│   ├── hero-section.tsx 등 랜딩 컴포넌트
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
│   ├── calendar/                ← event-type-colors.ts (타입별 색상 헬퍼)
│   ├── coupons/                 ← generate-code.ts
│   ├── email/                   ← send-coupon-email.ts / send-payment-failed-email.ts
│   ├── auth/                    ← plan.ts (hasProAccess / isProPlan / normalizePlanType)
│   ├── admin/                   ← auth.ts (requireAdmin) / format-error.ts
│   └── cron/                    ← auth.ts (CRON_SECRET 검증)
├── supabase/
│   ├── seed.sql
│   └── migrations/              ← 0001 ~ 0017 (init / grants / events RLS / reminder flags / admin+fan_events / admin security definer / signup terms / event description / coupons / fan_event_storage / lms_fields / kpop_stats / service_role_grants / kdrama_match / content_reports / fan_events_owner_update / fan_events_social_links)
├── public/                       ← favicon.png / og-image.png / apple-icon.png / icon.svg / unfoldk_ghost_globe_white.png 등
└── styles/
```

> ✅ 3-B 목표 구조에 거의 도달. 차이: `(auth)` route group 미사용(flat 유지), `types/` 미생성(공용 타입은 각 모듈에서 export), `docs/` 미생성.

### 3-B. 목표 구조 (Target, M+0 완료 시점)

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

## 4. API 사용 원칙

### 공통
- **캐싱 우선**: 외부 API 호출 전 항상 DB/Redis 캐시 확인
- **쿼터 관리**: YouTube API 는 tubewatch.kr 와 **반드시 별도 GCP 프로젝트** 사용
- **환경변수**: 모든 API 키는 `.env` 에만, 코드 하드코딩 절대 금지

### 서비스별 API 목록

**HallyuCalendar (현재)**
```
YouTube Data API v3   무료, 10,000유닛/일   컴백 영상 감지
TMDB API              무료, 초당 40req       드라마 방영 일정
Google Calendar API   무료, OAuth 기반       유저 캘린더 연동
Last.fm API           무료, 5req/초          아티스트 신보 감지
Resend                무료, 월 3,000건       D-Day 알림 이메일
```

**KpopStats (M+1)**
```
YouTube Data API v3   무료 (HallyuCalendar GCP 프로젝트 재활용)
Last.fm API           무료
Hallyu API (GitHub)   무료 오픈소스, 1992~2020 K팝 DB
X(Twitter) Basic      $100/월 — MAU 500명+ 달성 후 도입
```

**KdramaMatch (M+2)**
```
TMDB API              무료
MyDramaList API       무료, 키 신청 필요 (수일 소요)
Claude Haiku 4.5      $1/$5 per 1M 토큰, 드라마 요약 1건 ≈ 500토큰
```

**HangeulGo (M+3)**
```
TMDB API              무료
Naver 사전 API        무료, 일 25,000건 — 백엔드 연동 필수
Claude Haiku 4.5      $1/$5 per 1M 토큰, 카드 1장 ≈ 300토큰
ElevenLabs Creator    $22/월 — 음성 사전 생성 후 CDN 캐싱으로 요청 70% 절감
```

**KfoodKit (M+4)**
```
YouTube Data API v3   무료
Spoonacular Starter   $29/월 — Free(150pt/일)로 MVP 테스트 후 전환
Claude Haiku 4.5      $1/$5 per 1M 토큰, 레시피 1건 ≈ 400토큰
```

**Curation K / HallyuMap (M+5, 기획)**
→ HALLYUMAP.md 참조 (TourAPI / Mapbox / Claude Haiku)

> ⚠️ Spotify API 사용 금지 — 2025.05 부터 법인만 가능. Last.fm 대체.

---

## 5. 저작권 & 이미지 사용 원칙

```
- TMDB 이미지: URL 링크로만 사용. 서버에 직접 저장 금지
- 아티스트 사진: 실제 사진 직접 사용 금지. YouTube 썸네일 링크 방식 권장
- TMDB 출처 표기 필수: "This product uses the TMDB API but is not endorsed or certified by TMDB."
- 드라마 클립·장면: 직접 사용 절대 금지
- TMDB 상업 라이선스: 출시 전 sales@themoviedb.org 협의 필요
```

---

## 6. 보안 & 법무 체크리스트

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
