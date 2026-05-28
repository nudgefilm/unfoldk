# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.

---

## 현재 상태 (2026-05-29 세션 29 / 버그 수정 + Discord Webhook 전환 + KpopStats 개선)

### 완료

#### A. 이번 세션 작업 (세션 29)

- **빌링/취소 버튼 404 수정** (`app/mypage/subscription/page.tsx`)
  - Cancel subscription 버튼 2곳 + Download 링크 → PaymentComingSoonModal 연결

- **"Start for free" 버튼 로그인 분기** (`components/cta-section.tsx`, `app/about/page.tsx`, `components/hero-cta-buttons.tsx`, `components/early-access-section.tsx`)
  - 로그인 상태 → /mypage 이동 / 비로그인 → 기존 StartModal 유지

- **계정 삭제 버튼** (`app/mypage/settings/page.tsx`, `app/api/account/delete/route.ts`)
  - Privacy & Data 카드 하단 AlertDialog + DELETE 확인 → 계정 삭제 + 자동 로그아웃
  - 기존 "이메일로 요청" 안내 문구 제거

- **푸터 Discord 단일 아이콘 교체** (`components/footer-section.tsx`)
  - X·Instagram·TikTok 제거 → Discord SVG 아이콘 (https://discord.gg/MEdWGvgy)

- **agreed_to_terms 미완료 유저 /start 리디렉트** (`middleware.ts`)
  - /mypage 진입 시 agreed_to_terms ≠ true → /start?new=true 강제 이동

- **KpopStats More Artists 섹션 개선** (`app/kpop/page.tsx`)
  - 카드 21개, 섹션 하단 중앙 "View all artists" 버튼

- **KpopStats 30-Day Trend 차트 0값 gap 처리** (`components/kpop/artist-trend-chart.tsx`)
  - youtube_weekly_views = 0 → null 취급 (수집 오류 gap 표시)

- **Discord Webhook 방식 전환** — Bot 토큰 403 우회
  - `lib/discord/bot.ts`: `postWebhookMessage()` 추가
  - `app/api/cron/discord-daily/route.ts`: DISCORD_WEBHOOK_* 4개 env 시 Webhook 우선, 미설정 시 Bot 토큰 fallback
  - `app/api/discord/test-send/route.ts`: 동일 우선순위 로직 적용
  - Vercel 환경변수 4개 추가 완료, 4개 채널 모두 posted 확인 ✅

- **Discord 디버그 엔드포인트** (`app/api/discord/debug/route.ts`)
  - cron_logs 컬럼명 수정 (`source`→`route`, `created_at`→`executed_at`)
  - DB 채널설정·봇 멤버십·채널 접근 가능 여부 통합 진단

#### B. 이전 세션 작업 (세션 28)

- **KfoodKit 어드민 레시피 목록 페이지네이션** (`components/admin/food-admin-table.tsx`)
  - 페이지당 50개 표시 (`PAGE_SIZE = 50`)
  - 이전/다음 버튼 + "현재p / 전체p" 카운트 표시
  - 필터·검색 변경 시 1페이지 자동 리셋
  - totalPages ≤ 1이면 컨트롤 미노출

- **KfoodKit 어드민 이미지 검수 페이지** (`app/admin/food/images/page.tsx`, `components/admin/food-image-review.tsx`, `app/api/admin/food/images/route.ts`)
  - image_source IN ('mfds', 'unsplash') OR NULL 레시피 카드 목록
  - 업로드 or URL 입력 후 저장 시 카드 즉시 제거 (낙관적 업데이트)
  - 사이드바 배지: 검수 대상 건수 실시간 표시 (`?count_only=true`)
  - KfoodKit 사이드바 링크 exact 매칭 적용 (이중 하이라이트 방지)

- **KfoodKit Drama Food Guide 개선** (`components/food/drama-food-guide-section.tsx`, `app/api/food/drama-guide/route.ts`)
  - 장면 설명 텍스트 line-clamp-2 → line-clamp-5
  - 드라마별 음식 목록 정렬: upload > manual > unsplash > mfds 순 (업로드 이미지 우선 노출)

- **Curation K 쇼핑 탭 추가** (`app/api/curation-k/stats/route.ts`, `app/api/curation-k/spots/route.ts`, `app/curation-k/page.tsx`)
  - content_type_id=38 쇼핑 카테고리 전 레이어(stats·spots·탭·RegionBreakdown)에 반영
  - 히어로 섹션 shopping 카운트 노출 (데이터 있을 때만)
  - 탭 바: shopping 데이터 없으면 탭 자동 미노출

- **KpopStats 순위 변동 인사이트 텍스트** (`app/kpop/page.tsx`)
  - 글로벌 차트 Change 컬럼: 아이콘+숫자 → 서술형 텍스트
    - null → "NEW" 그린 배지
    - ≥10 → "↑N 급상승" / 1~9 → "↑N 상승" (green)
    - ≤-10 → "↓N 급하락" / -1~-9 → "↓N 하락" (red)
    - 0 → 미노출

- **KpopStats "이번 주 급상승 아티스트 TOP 3" 섹션** (`app/kpop/page.tsx`)
  - 메인 차트 상단 (Trending↔Global Chart 사이)
  - rank_change 상위 3명 자동 선정, 데이터 없으면 섹션 미노출
  - 카드: 그린 상승폭 배지 + 아티스트명 + 인사이트 한 줄

- **HallyuCalendar "이번 주 놓치면 안 될 한류 일정 TOP 3" 섹션** (`app/calendar/page.tsx`)
  - 페이지 헤더↔필터 바 사이 삽입, 데이터 없으면 미노출
  - 선정 기준: K-pop > Concert > Fan Meet > K-drama → 날짜순
  - 카드: TOP N 배지 + 이벤트 타입 컬러 배지 + 제목 + 날짜/아티스트
  - K-pop 이벤트 + kpopArtistMap 매칭 시 "View artist stats →" /kpop/[id] 링크
  - "Updated every Monday" 문구 + RefreshCw 아이콘

#### B. 이전 세션 작업 (세션 27)

- **KfoodKit DramaFoodGuideSection 데이터 파이프라인** (`scripts/tag-food-drama.ts`)
  - Claude Haiku 배치 API로 food_recipes에 drama_title·episode_tag·scene_description 자동 태깅
  - `category` 컬럼 오류 수정 (존재하지 않는 컬럼 제거)
  - featured_week 자동 설정 (드라마별 최대 3개 × 3드라마)

- **Cron 개편 + 어드민 수집 현황 동적화**
  - vercel.json: KdramaMatch·KfoodKit 주 1회(월), ingest-curation-k 통합 cron 추가
  - lib/ingest/tour-spots.ts: 쇼핑(38) 카테고리 추가, route 필터 수정
  - app/admin/page.tsx: 수집 현황 hardcoded "수동관리" → cron_logs 기반 동적 상태 조회
  - supabase/migrations/0047·0048 적용 완료 ✅

- **결제 버튼 임시 안내 모달** (`components/payment-coming-soon-modal.tsx`)
  - 모든 결제 버튼(start·subscription 페이지) 클릭 시 결제 준비 중 안내 모달 표시
  - support@unfoldk.com 수동 멤버십 활성화 안내 포함

- **KpopStats 30-Day Trend 차트 개선** (`components/kpop/artist-trend-chart.tsx`)
  - recharts 기반 클라이언트 컴포넌트로 교체
  - x축 날짜(May 1, May 7…)·y축 조회수(1M, 10M…) 표시, 호버 툴팁, 기간 레이블 추가

- **HallyuCalendar 아티스트 stats 연결** (`app/calendar/page.tsx`)
  - K-pop 이벤트 카드 하단에 "View artist stats →" 링크 추가
  - events 로드 후 kpop_artists 룩업 → /kpop/[id] 연결, 미매칭 시 미노출

#### B. UI 버그 수정 2건 (세션 26)

- **KpopStats 히어로 가림 수정** (`app/kpop/page.tsx`)
  - 공지 배너 + Trial 배너 2개 동시 표시 시 히어로 섹션 상단이 fixed 헤더에 가리는 문제
  - `main` 클래스 `py-12` → `pt-28 pb-12` (48px → 112px) — 최대 배너 2개(~76px) + 여백 확보

- **KfoodKit 레시피 복사 버그 수정** (`components/food/recipe-detail-dialog.tsx`)
  - 복사 버튼이 한글 메뉴명만 클립보드에 복사하던 버그
  - 메뉴명(한글+영문) + 설명 + 재료 목록 + 조리법 전체를 포맷해 복사하도록 변경
  - 툴팁 "Copy to Ingredient Finder" → "Copy full recipe"

#### B. Trial 14일 변경 + 이메일 중복 가입 방지 (세션 25)

**DB / 인프라**
- 마이그레이션 0043: `trial_used_emails` 테이블 신설 (이메일 기반 중복 추적, RLS 전면 차단)
- 기존 `trial_started_email_sent=true` 유저 이메일 backfill
- `trial_ends_at IS NULL` free 유저 → now()+14일 소급 적용 — Supabase에서 실행 확인 ✅

**가입 흐름 (`app/api/auth/complete-signup/route.ts`)**
- Trial 기간 30일 → 14일로 변경
- Trial 부여 전 3중 중복 검사:
  1. `trial_started_email_sent = true` — 이전 trial 수령 이력
  2. `trial_ends_at IS NOT NULL` — 이미 설정된 trial
  3. `trial_used_emails` 테이블 — 탈퇴 후 동일 이메일 재가입 차단
- Trial 부여 즉시 `trial_used_emails`에 이메일 기록 (이메일 발송 실패와 무관)
- Trial 미부여 시 "Trial 시작" 이메일 발송도 생략

#### B. 30일 무료 체험(Trial) 시스템 전체 구현 (세션 24)

**DB / 인프라**
- 마이그레이션 0042: `users.trial_ends_at` + 이메일 플래그 4개 컬럼 (`trial_started/d7/d1/ended_email_sent`)
- 기존 free 유저 전체 소급 적용 (now()+30일) — Supabase에서 실행 확인 ✅

**가입 흐름**
- `app/api/auth/complete-signup/route.ts`: 가입 시 `trial_ends_at` 자동 설정
- 가입 직후 "Trial 시작" 이메일 fire-and-forget 발송 (실패해도 가입 차단 없음)

**이메일 (lib/email/send-trial-emails.ts)**
- `sendTrialStartedEmail` — 가입 직후: "Your 30-day free trial has started"
- `sendTrialD7Email` — 만료 7일 전: "Your free trial ends in 7 days"
- `sendTrialD1Email` — 만료 1일 전: "Your free trial ends tomorrow"
- `sendTrialEndedEmail` — 만료 후: "Your free trial has ended — upgrade to continue"
- 디자인: 기존 UnfoldK 이메일 템플릿 동일 (dark #0d0d0f, 핑크 #FF4B6E)
- 모든 이메일에 /pricing 업그레이드 버튼 포함

**Cron**
- `app/api/cron/trial-notifications/route.ts`: D-7·D-1 이메일 (매일 09:15 UTC)
  - `trial_ends_at ≤ now()+N일` 조건 + 플래그로 중복 방지
  - paid 플랜 제외, 배치 500명 cap
- `app/api/cron/expire-trials/route.ts`: 만료 후 ended 이메일 (매일 10:15 UTC)
- `vercel.json`: 2개 cron 스케줄 추가

**플랜 체크 로직 (lib/auth/plan.ts)**
- `isInTrial(trialEndsAt)`: trial 활성 여부 순수 함수
- `trialDaysRemaining(trialEndsAt)`: 남은 일수 계산
- `hasProAccess()`: isAdmin · isInTrial · isProPlan 순 체크로 확장

**Trial 배너 (components/trial-banner.tsx)**
- 로그인 + free 플랜 + trial 활성 유저에게만 표시
- 헤더 EarlyAccessBanner 바로 아래 위치 (fixed, 동일 영역)
- 정상: 핑크 계열 "Free Trial · D-XX remaining"
- D-7 이하: 오렌지 강조 + "⚠️ Trial D-XX — X days left" 긴급 문구
- 클릭 시 /pricing 이동

**어드민 유저 관리**
- `app/admin/users/page.tsx`: `trial_ends_at` 조회 추가
- `components/admin/users-table.tsx`: Trial 컬럼 추가 — 활성(핑크 D-XX) / D-7이하(오렌지) / 만료(회색 Expired) / 없음(—)

#### B. Discord 봇 /quiz · /koreanname 슬래시 커맨드 추가 (세션 23)
#### C. 푸터 국기 중복 버그 수정 (세션 23)

### 다음 세션 후보
- Discord 봇 Embed 포맷 개선 (디자인·카피 완성도 향상)
- 결제 연동사 변경 검토 (LMS → Paddle)
- Trial 만료 유저 → Hallyu Pass 전환 퍼널 최적화 (/pricing 랜딩 개선)
- filming_spots backfill 잔여 처리 확인 (매일 KST 13:30 cron)
- Google 색인 추가 페이지 모니터링

### 블로커
- LMS 재심사 대기 → Paddle 전환 검토 중
- top.gg 심사 재제출 완료 → 1~2주 대기 중
- Google 색인 생성 대기

---

## 개발 원칙 (전체 사이트 공통)

> **자동화 우선**: 수동 데이터 투입이나 별도 운영 작업이 선행되어야 서비스 품질이 확보되는 로직은 전체 사이트 모든 작업에서 반영하지 않는다. 모든 기능은 자동화로 동작해야 한다.

> **DB 컬럼 확인 필수**: 코드 작성 전 반드시 실제 DB 테이블 구조를 먼저 확인하고 존재하는 컬럼명만 사용할 것. 가정하거나 추측으로 컬럼명을 사용하지 않는다.

> **PROGRESS.md 파일 관리**: PROGRESS.md 파일이 너무 길어지면 컨텍스트 창을 과도하게 소모함. 정기적으로 (또는 파일이 커질 때) 날짜별로 분리 보관할 것 (예: `PROGRESS_2026_05.md` 로 월별 분리). 현재 진행 중인 내용만 PROGRESS.md에 유지.

> **UI/기능 구현 완료 전 체크리스트**: 모든 UI/기능 구현 시 아래 항목을 반드시 체크하고 조치할 것.
> 1. 유저가 보기에 어색한 부분이 없는가
> 2. 빠진 UI 요소가 없는가 (축 표시, 툴팁, 레이블, 날짜 등)
> 3. 모바일 반응형이 적용됐는가
> 4. 데이터 없을 때 빈 화면/오류 없이 처리되는가
> 5. 프로토타입 수준이 아닌 실제 서비스 수준인가

---

## 개선 플랜 (세션 27~ / 콘텐츠 깊이 + 서비스 간 연결 강화)

> 목표: 기존 뼈대는 유지하면서 콘텐츠 맥락과 서비스 간 연결 고리 추가  
> 원칙: 외부 API 영상 임베드 제외, 개발 부담 최소화, 다른 파일 건드리지 않음  
> 진행: 메뉴 하나씩 순서대로 사용자가 전달 → 작업

### 1. KfoodKit — 드라마 스토리텔링 연결
- [ ] 각 레시피에 드라마명 + 에피소드 태그 추가
- [ ] 등장 장면 설명 한 줄 추가 ("시즌 1, 3화에서 박새로이가 처음 먹은 그 메뉴")
- [ ] 드라마 검색 시 해당 드라마에 등장한 음식 모아보기 기능
- [ ] "이 드라마에 나온 다른 음식 보기" 연결 링크

### 2. HangeulGo — 드라마 대사 맥락 강화
- [ ] 드라마 + 화수 + 장면 설명 추가
- [ ] 감정 태그 추가 (로맨틱/코믹/감동/일상 등)
- [ ] 같은 드라마의 다른 표현 연결
- [ ] 비슷한 감정의 다른 표현 추천

### 3. KdramaMatch — 서비스 간 연결 고리
- [ ] 드라마 클릭 시 하단에 연관 콘텐츠 크로스링크 추가
  - "이 드라마에서 배울 수 있는 한국어 표현 → HangeulGo"
  - "이 드라마에 나온 음식 → KfoodKit"
  - "이 드라마 촬영지 → Curation K"
- [ ] 감정선 기반 추천 태그 세분화

### 4. Curation K — 한류 감성 레이어
- [ ] 각 촬영지에 드라마 장면 맥락 설명 추가
- [ ] 베스트 포토존 팁 추가
- [ ] 연관 대사 → HangeulGo 링크
- [ ] 연관 음식 → KfoodKit 링크

### 5. HallyuCalendar — 큐레이션 강화
- [x] "이번 주 놓치면 안 될 한류 일정 TOP 3" 편집 큐레이션 뷰 추가 (세션 28 완료)
- [x] 해당 아티스트 KpopStats 차트 연결 링크 (세션 27 완료)

### 6. KpopStats — 스토리 있는 데이터
- [x] 순위 변동에 한 줄 인사이트 추가 — "↑N 급상승" / "↓N 하락" / "NEW" 형식 (세션 28 완료)
- [x] "이번 주 급상승 아티스트 TOP 3" 섹션 (세션 28 완료)
- [ ] 관련 HallyuCalendar 컴백 일정 연결 링크

