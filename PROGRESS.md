# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.

---

## 현재 상태 (2026-05-10 세션 3 / Header 영속화·Drama 3-tier·인플레이스 OAuth 통합·법적 표기)

> 이번 세션은 "근본 원인 먼저" 원칙이 박제된 세션. 사용자가 직접 "임시방편 경향 감지 시 짚어달라"
> 고 메모리에 남기게 했고 (`feedback_root_cause_first.md`), 곧이어 plan_type ↔
> subscription_status 동기화 누락이라는 클래스 버그를 6개 write path 전수 점검 후
> 어드민 라우트 + complete-signup 양쪽에서 fix.

### A. Header 깜빡임 — 3단계 점진적 해결
- **`5e9776e`** Header `fixed top-0 left-0 right-0 z-50 bg-background` + body `pt-[72px]` + admin layout `-mt-[72px]` 보정
- **`cca2f4c`** 인증 슬롯 `min-w-[100px] flex justify-end` 로 고정폭 reserve — 페이지 이동 시 우측 메뉴 layout shift 제거
- **`a42e4b4`** 아바타 Link 높이 `h-10` 명시 — row 높이 wobble (avatar Link 가 다른 메뉴보다 12px 더 컸던 문제) 제거
- **`03fc378`** 아키텍처 fix — Header 를 12개 페이지 + hero-section.tsx 에서 모두 제거하고 `app/layout.tsx` 단일 마운트. usePathname 가드로 admin / login / signup / start / redeem / forgot-password / verify-email / payment 미노출. navigation 시 unmount 안 돼서 인증 fetch / 프로필 깜빡임 완전 제거. 드롭다운·시트는 pathname 변경 시 자동 close.

### B. 인플레이스 OAuth 진입점 통합
- **`5e9776e`** 비로그인 My Page 클릭 → StartModal (next='/mypage')
- **`1d092b5`** + **`dc5cd86`** Pricing Get started / Join now → 비로그인 StartModal / 로그인 `/mypage/subscription` 분기
- **`3827c52`** Calendar My Fan Events 안내 링크 → 비로그인 StartModal (next='/mypage/fan-events')
- **`845168f`** Upcoming 카드 Add to Calendar — 기존 `<Link href="/login">` 하드코딩 버그 fix. 로그인이면 GCal TEMPLATE URL 즉시 오픈, 비로그인이면 StartModal (next='/calendar'). 모듈 레벨 `buildGoogleCalendarUrl(event, viewDate)` 헬퍼 추출해 모달과 양쪽 재사용.
- 결과: Header / Hero / Pricing / ReportButton / Calendar 안내 / Upcoming 카드 모든 보호 진입점이 동일 StartModal 패턴.

### C. KdramaMatch 3-tier 노출 정책
- **`ee8a751`** 페이지가 호출하던 `/api/dramas/recommend` 의 Claude system prompt 가 "up to 10" 으로 캡 박혀 paid 유저도 10건만 보던 데드코드 PAID_LIMIT 발견.
  - Claude 캡 10→30 (prompt + break + fallback slice + max_tokens 1500→3000)
  - recommend API: anon 6→3 / free 12→5 / paid 30 유지
  - `/api/dramas` (Browse all) — plan 분기 완전 제거, BROWSE_LIMIT=100 단일
  - 페이지에 Browse all 섹션 신설 (Top picks 아래) + 라벨 "Recommended for You" → "Top picks for you"
  - 노출 매트릭스: 비로그인=Browse 전체+Top 3 / Free=Browse 전체+Top 5 / Pro=Browse 전체+Top 30 / Watchlist 는 plan 무관 로그인만

### D. 캘린더 이벤트 타입별 색상 통일
- **`ea22b20`** `lib/calendar/event-type-colors.ts` 신규 — K-pop #FF4B6E / K-drama #8B5CF6 / Concert #F97316 / Fan Meet #06B6D4 + alpha 합성 헬퍼.
- 5개 적용 위치 (그리드 뱃지 / Upcoming 날짜 배지 / 모달 타입 태그 / 랜딩 위젯 그리드+태그 / Featured 카드 날짜).
- 의도적 유지된 #FF4B6E 16곳 (CTA / 토글 / today highlight / 위젯 헤더 등 — 이벤트 타입 무관 chrome).

### E. KpopStats — Last.fm 7일 증감 트렌드
- **`67c012f`** spotlight API 가 30일 history 를 이미 반환하므로 새 API 없이 클라이언트 useMemo 로 계산.
  - 7일치 미만 / |%| 0.0 → 미표시
  - 증가: 그린 #22c55e / 감소: muted-foreground (절제 톤)
  - "Listeners up X.X% this week" / "Listeners down X.X% this week" 50자 이내

### F. 데이터 정합성 — plan_type ↔ subscription_status 동기화 (중요)
- **`de2cd3a`** 캘린더에서 월간 Pro 가 5건만 보이는 버그 진단:
  - 증상은 데이터 오염처럼 보이지만 근본 원인은 어드민 `/admin/users` PATCH 가 plan_type 만 update 하고 subscription_status 미동기화. RLS `events_select_premium_paid` 가 `(plan_type IN ('monthly','annual') AND subscription_status='active')` 라 status 가 null/'pending' 인 broken row 는 통과 못함.
  - 사용자가 "임시방편 패턴 감지" 피드백 줌 → 메모리 박제 (`feedback_root_cause_first.md`).
  - write path 전수 점검 후 admin/users PATCH + complete-signup schema 양쪽 fix:
    - admin PATCH: plan_type='monthly'|'annual' → status='active' / plan_type='free' → status='canceled' 자동 sync
    - complete-signup: ALLOWED_PLANS 를 ['free'] 로 좁힘. paid 플랜은 LMS webhook / apply-coupon 만 정당 경로.

### G. Upcoming 리스트 인라인 아코디언
- **`845168f`** 모달 → 인라인 아코디언으로 동작 변경.
  - 1개만 expanded (다른 항목 클릭 시 자동 close).
  - 확장 노출: AI description / Add to Google Calendar / D-7·D-1·Day of 리마인더 토글 / Report.
  - 리마인더 — 확장 시점에 1회 fetch (지연 로딩) + 토글 변경 300ms debounce save.
  - 모달은 Featured 카드 + 캘린더 그리드 클릭에서만 유지 (handleEventClick 흐름 동결).

### H. 팬이벤트 소셜링크 + 반려 표시 (6단계 동기화 풀세트)
- **`2d153d2`** migration 0017 + API zod (POST/PATCH) + 응답 매핑 + 클라 type + FormState/EMPTY_FORM + 폼 JSX (신규+편집 모달 둘 다) — CLAUDE.md §13 체크리스트 그대로 따라감.
  - Instagram / X username + 자유 URL (Discord/TikTok 등). prefix 박스 UI.
  - My Submissions 정렬: pending → approved → rejected (rejected 항상 하단).
  - StatusBadge "Not Approved" → "Rejected", admin_note 없어도 "Your submission was not approved." 명시 안내. admin_note 있으면 "Reason: …" italic.
  - 어드민 신청자 셀에 IG / X / Other 작은 링크 (입력했을 때만, 새 탭).

### I. 푸터 법적 표기 + 쿠키 동의 배너
- **`a4fd898`** + **`c75d179`** 푸터 보강:
  - Cookie Policy 링크 `/cookies` → `/cookie` 정정 + 페이지 신규 (EN/KO 토글, /terms 패턴).
  - support@unfoldk.com mailto — bottom line © 행에.
  - "Payments processed by Lemon Squeezy." / TMDB attribution — 좌측 소셜 아이콘 아래 2줄.
  - 쿠키 동의 배너 (`components/cookie-consent-banner.tsx`) — IntersectionObserver 로 footer 진입 시 1회 노출 (threshold 0.1 + disconnect). localStorage `cookie_consent='accepted'` 면 IO 자체 미설치.
  - Accept → 저장 + 닫기 / Manage → /cookie navigate (수락은 안 박힘).

### 메모리 박제 (다음 세션 참고)
- **`feedback_root_cause_first.md`** 신규 — 데이터 SQL fix 로 끝내지 말고 write path 코드 추적 후 구조적 해결. 사용자가 "임시방편 경향 감지 시 짚어달라" 명시.

### ⚠️ 사용자 액션 필요
1. **Supabase SQL Editor 에서 0017 마이그레이션 실행** ✅ 완료 (Success. No rows returned 확인)
2. **0016_fan_events_owner_update.sql** ✅ 완료 (2026-05-12 확인 — `fan_events_update_own` RLS 정책 Supabase 적용 확인)
3. (선택) 캘린더 broken row 백필 ✅ 완료 (2026-05-12) — 영향 행은 관리자 계정 1건. SELECT 로 미리 확인 후 UPDATE 실행:
   ```sql
   update public.users set subscription_status = 'active'
   where plan_type in ('monthly','annual')
     and (subscription_status is null or subscription_status not in ('active','canceled','expired'));
   ```
   ※ 사용자 초안 SQL (`subscription_status != 'active'`) 은 NULL 미포함 + canceled/expired 까지 휩쓸어가는 위험이 있었음. PROGRESS 박제 SQL 로 정정 후 실행.

### 다음 세션 후보
- **DECISIONS.md 박제** — 이번 세션 굵직한 결정 다수: Header root layout 통합 / plan_type-status 동기화 정책 / Drama 3-tier 노출 / 인플레이스 OAuth 일관성 / 어드민 어뷰징 검토 Tier 1+2.
- **Cookie Policy 본문 법무 검토** — 현재 기본 템플릿. 실제 쿠키 사용 정책 확정 후 본문 교체 (especially Accept 동의 메커니즘이 GDPR 'opt-in' 기준에 못 미침 — implied consent).
- **이전 세션 carry-over**: KpopStats artist / KdramaMatch drama / HangeulGo phrase / KfoodKit recipe ReportButton, /admin/reports 콘텐츠 미리보기, hydration 룰 적용.
- **Vercel/Supabase 플랜 비용 점검** — 사용자 요청으로 산출했으나 정확한 플랜 미확인 상태. 대시보드 확인 후 Free 가능 영역 정리하면 월 ~$20 절감 가능성.

### 블로커
- 없음

---

## 현재 상태 (2026-05-10 세션 2 / 메타·캘린더 Featured·팬이벤트 수정·어드민 시그널)

> 한 세션에 굵직한 흐름 4개가 같이 들어갔습니다. 영역별로 정리.

### A. 메타 / OG / 파비콘
- **`4d8e2b8`** OG image (1200x630) + Twitter Card meta (`metadataBase`, `summary_large_image`)
  - SVG → sharp(node_modules pnpm 스토어 경로) 로 PNG 변환, `public/og-image.png` 67KB
  - `app/layout.tsx` openGraph/twitter 메타 풀 셋 + `metadataBase: https://www.unfoldk.com`
- **`62b1a90`** 파비콘 `unfoldk_favicon.jpg` → `favicon.png` 단순화
- **소셜 캐시 무효화 가이드 박제** (텔레그램 @WebpageBot / Facebook debugger / KakaoTalk / LinkedIn / X 컴포저)

### B. HallyuCalendar 랜딩·캘린더 페이지 UX
- **`5ec2330`** 랜딩 플로팅 위젯 — 하드코딩 3건 → `/api/calendar/events?month=YYYY-MM` 실 DB 호출
- **`93cffe1`** 그리드 하이라이트(전체 이벤트) / 하단 태그(오늘 이후 가까운 순 max 3) 분리 — footer "N events this month" 는 동월 전체 카운트
- **`99a3a5a`** 캘린더 페이지 — 오늘 이전 이벤트 카드/뱃지 `opacity-40` (그리드+Upcoming 둘 다, today 당일은 미적용)
- **`306422f`** 모달 "Add to Google Calendar" 활성화 — OAuth 없이 GCal TEMPLATE URL (`?action=TEMPLATE&dates=YYYYMMDD/YYYYMMDD+1`), event.time 라벨은 파싱 위험으로 종일 포맷 채택
- **`6d6799f`** + **`114fd59`** + **`a636044`** **Featured 가로 스크롤 카드 신설**:
  - API `/api/calendar/events`: select 절에 `thumbnail_url`, `created_at` 추가 → 응답 `thumbnailUrl`, `createdAt` 매핑
  - 카드: `w-48 aspect-[3/4]` 세로 프레임 + `object-contain` (16:9 가로/2:3 포스터 모두 잘림 없이 letterbox)
  - 정렬: `created_at desc` (최신 등록 좌측). future asc + past desc fallback 로직 폐기 — 스케일 시 의미 없음 (사용자 피드백)
  - 우측 가장자리 페이드 오버레이 (`hsl(var(--background)) → transparent`) — 스크롤 어포던스
  - `[&::-webkit-scrollbar]:hidden` + 인라인 `scrollbarWidth`/`msOverflowStyle` cross-browser
- **`93708b6`** + **`9cfe6c4`** + **`1400594`** Community contribution 안내 문구 — Upcoming 아래 → 달력 바로 아래로 이동, 3줄 sentence-based 줄바꿈 + 톤 수정 ("Submit ... K-culture" → "Share news about Hallyu events ...")

### C. 쿠폰 / 팬이벤트 흐름 재정비
- **`49ea597`** `/redeem` 전체 페이지 → 인플레이스 **`<RedeemCouponModal />`** 로 전환 (Dialog 패턴, ReportButton 톤 일치)
  - 토스트 노출 위해 fan-events 페이지에 `<Toaster />` 로컬 마운트 (root layout 미마운트라 ReportButton useToast 도 비-admin 영역에서 silently no-op 인 점 박제)
  - `/redeem` 페이지는 그대로 유지 (이메일 링크 등 외부 진입로 보존)
- **`68f74ee`** 어드민 승인 시 `proof_url` → `thumbnail_url` 자동 승계 — `/(jpe?g|png|webp)(\?|$)/i` 매칭 시만 (PDF는 null), 사용자 §7 약관 동의 + 폼 라벨 안내로 라이선스 커버
- **`914d7b0`** **본인 pending 신청 수정 기능** — 0016 RLS + PATCH 라우트 + Edit 버튼 + EditFanEventModal:
  - migration `0016_fan_events_owner_update.sql` — `fan_events_update_own` (auth.uid()=user_id and status='pending') 양쪽(using/with check) 검증으로 status 변조 차단
  - `app/api/mypage/fan-events/[id]/route.ts` PATCH — 본인+pending 1차 가드 + RLS 2차 가드 (defence-in-depth)
  - 화이트리스트: title/description/event_date/location/proof_url
  - UI: Edit 버튼은 pending 한정 + EditFanEventModal Dialog 패턴 + 새 파일 미선택 시 기존 proof_url 보존

### D. 어드민 시그널 / 운영 정책
- **`40b2d11`** **어드민 events 폼 `thumbnail_url` 풀 플러그인 (버그 수정)**:
  - **증상 진단**: API는 created_at 응답하는데 DB thumbnail 0건. 사용자 "이미지 첨부했다"는데 안 들어감.
  - **원인**: `app/api/admin/events/route.ts` POST 스키마는 `thumbnail_url` 받게 돼있으나 **UI 폼 자체에 입력 필드 없음** + `app/admin/events/page.tsx` SELECT 절에도 미포함 → 편집 시 기존 값 손실까지.
  - 수정: AdminEventRow / FormState / EMPTY_FORM / startEdit / handleSubmit / 폼 JSX 전 단계 풀 플러그인. URL 입력 시 3:4 미리보기 (카드와 동일 정책) 즉시 노출. 편집 PATCH 는 빈 문자열을 null 로 명시 (기존 값 제거 가능).
- **`d02bcf3`** **어드민 fan-events 신청자별 "이전 승인 N회" amber 배지** (Tier 2 채택):
  - 사용자별 `status='approved'` 카운트 별도 쿼리 (loaded 500건 안에서만 세면 누적 잘림 위험 → 전체 fan_event_requests 대상)
  - 본 row 가 approved 면 자기 자신 제외 → 진짜 "이전" 횟수
  - 1회 이상만 노출 (0회 신규는 깔끔). pending 배지와 동일 amber 톤으로 주의 환기.

### 운영 정책 결정 (코드 변경 없음 / DECISIONS 후속 박제 필요)
- **승인 후 수정 요청 처리**: 어드민이 `/admin/events`에서 캘린더 이벤트 삭제만. 이미 발급된 쿠폰은 회수하지 않고 혜택 그대로 제공. 자동 cooldown / 3일 만료 정책 모두 미도입 (Tier 1 + Tier 2 조합으로 충분 판단).
- **어뷰징 1차 방어**: 어드민 fan-events 의 "이전 승인 N회" 배지로 같은 사용자 반복 승인 패턴을 시각적으로 즉시 인지. 자동 차단(Tier 3 cooldown)은 MAU 커진 후 재검토.
- **거절 이력 노출은 미도입** — 거절은 막힌 시도라 farming 시그널이 아님 (의도).

### 약관
- **`624e1e8`** + **`9cfe6c4`** §7 "User-Submitted Content / 사용자 제출 콘텐츠" 신설 (EN/KO), 기존 §7~§12 → §8~§13 리넘버링
  - §4 결제 처리자 표기 Stripe → Lemon Squeezy(MoR) 변경 — billing/taxes/refunds/invoices 책임 소재 명시 (DECISIONS.md 2026-05-08 결정 약관 반영)
- Last updated 2026-05-10 으로 갱신

### ⚠️ 사용자 액션 필요
1. **Supabase SQL Editor 에서 `0016_fan_events_owner_update.sql` 실행** — 안 돌리면 fan-events Edit 클릭 → Save 시 RLS 차단으로 silently no-op
   ```sql
   drop policy if exists "fan_events_update_own" on public.fan_event_requests;
   create policy "fan_events_update_own"
     on public.fan_event_requests for update
     to authenticated
     using (auth.uid() = user_id and status = 'pending')
     with check (auth.uid() = user_id and status = 'pending');
   ```
2. (선택) 기존 "Our K-Drama Fanmeet" 이벤트 백필:
   ```sql
   update hallyu_calendar_events ce
   set thumbnail_url = fer.proof_url
   from fan_event_requests fer
   where ce.source_id = 'fer-' || fer.id::text
     and ce.thumbnail_url is null
     and fer.proof_url is not null
     and (fer.proof_url ilike '%.jpg' or fer.proof_url ilike '%.jpeg'
       or fer.proof_url ilike '%.png' or fer.proof_url ilike '%.webp');
   ```
3. (선택) 소셜 카드 캐시 무효화 — Telegram @WebpageBot / Facebook debugger / KakaoTalk / LinkedIn 등 각 플랫폼 디버거에서 `https://www.unfoldk.com` 갱신

### 다음 세션 후보
- **DECISIONS.md 박제** — 오늘 결정 2건 정리 (승인 후 수정 정책 / 어드민 어뷰징 검토 Tier 1+2 채택 이유)
- **Toaster 마운트 정책 재검토** — root layout 에 올릴지, 페이지별 로컬 유지할지. ReportButton의 비-admin 영역 silent fail 도 같이 해결 가능.
- **이전 세션 후보 그대로 carry-over**: KpopStats artist / KdramaMatch drama / HangeulGo phrase / KfoodKit recipe 에 ReportButton 추가 / `/admin/reports` 콘텐츠 미리보기 inline / `app/calendar/page.tsx` hydration 룰 적용
- **YouTube 인제스트 thumbnail backfill** — 기존 youtube source 이벤트들도 `thumbnail_url` 채울지 결정 (인제스터에는 추출 로직 이미 있음)
- **PDF proof 케이스 안내 강화** — fan-events Proof 라벨에 "PDF는 캘린더 카드에 표시되지 않습니다" 명시 검토

### 블로커
- 없음 (사용자 액션 1건만 외부 의존)

---

## 현재 상태 (2026-05-10 / ReportButton 비로그인 흐름 단순화 — StartModal 인플레이스 오픈)

> ⚠️ **다음 세션이 같은 함정에 빠지지 않도록**: 이번 세션의 진짜 문제는
> "비로그인 Report 클릭 시 페이지 이동 없이 모달 띄우기" 라는 **UX 차원의 흐름 변경**
> 이었음. 그런데 OAuth callback / 도메인 정합성 / 인코딩 / 미들웨어까지 깊이 파고든
> 끝에야 이 단순한 흐름이 정답인 걸 깨달음. 다음에 비슷한 증상 (`/`로 튕김 등) 보면
> **먼저 한 줄로 "원하는 흐름이 뭐냐" 확인 후 코드 진단 시작할 것**.

### 최종 정답 — `0a16a72` 한 커밋
- **`components/start-modal.tsx`** — 외부 제어 prop 추가
  - `open?`, `onOpenChange?`, `next?`, `trigger?` 모두 옵셔널화
  - next 우선순위: prop → URL `?next` 파라미터 (backward-compat 유지)
  - 기존 사용처 (header / hero / cta / hero-cta-buttons) 모두 무수정 호환
- **`components/common/report-button.tsx`** — 인플레이스 오픈
  - `useRouter` 제거 (페이지 이동 없음)
  - 비로그인 클릭 시: `setStartModalOpen(true)` + `pendingNext` 에 현재 pathname 저장
  - `<StartModal open={startModalOpen} onOpenChange={setStartModalOpen} next={pendingNext} />` 임베드
  - UI 스타일(className/style) 모두 보존

### 그 과정에서 같이 들어간 보강 (잠재 버그 미리 막음)
- `c0f4e19` — StartModal 의 `?next` 파라미터를 OAuth 콜백 URL 로 forward
- `c1f48be` — callback redirect 시 세션 쿠키 명시 복사 (middleware 의 `redirectWithCookies` 패턴) + 신규 가입자 분기에서도 next 보존 (`/start?new=true&next=...`) + `/start` 페이지가 가입 완료 시 next 사용
- `d40ae32` — production 에서 callback origin 을 `https://www.unfoldk.com` 으로 하드코딩 (apex→www redirect 끼는 케이스 차단). 로컬은 `window.location.origin` 그대로
- `7985bc3` / `9da347d` — callback 진단 로그 추가/제거 (한 사이클 마무리)

### 검증 완료
- production OAuth: 비로그인 `/calendar` → Report 클릭 → StartModal 인플레이스 → Continue with Google → 완주 후 `/calendar` 직행 ✅
- callback 진단 로그가 모든 의심(인코딩·도메인·next 누락) 정상임을 입증한 후 제거

### 다음 세션 후보
- 다른 서비스(KpopStats artist / KdramaMatch drama / HangeulGo phrase / KfoodKit recipe) 에도 ReportButton 추가 — 새로 단순해진 비로그인 흐름이 그대로 적용됨
- 어드민 reports 테이블 — content_id UUID 만 표시되는 부분에 콘텐츠 미리보기(이벤트 title 등) inline 추가
- `app/calendar/page.tsx` 의 hydration 룰 적용 (admin 영역엔 적용됨, 일반 영역 미적용)

### 블로커
- 없음

---

## 세션 회고 (2026-05-09 종료) — 16 커밋 누적

오늘 한 세션 안에서 큰 작업 다수 처리. 시간 흐름 그대로:

### 결제·구독 (Lemon Squeezy)
- `a9ef950` Switch Plan 이중청구 fix (`/api/lemonsqueezy/switch` 신규, `updateSubscription` SDK 호출) + Stripe→LMS 전환 박제 (CLAUDE.md §2/§7/§11/§12/§13 + 백필 7건)
- `6c337a6` webhook 8 이벤트 완성 — `subscription_expired` + `subscription_payment_success` 핸들러 추가
- 운영 환경: Vercel 17개 env 등록 (LMS 7 + ANTHROPIC + 기존 9), LMS variant ID 1628505/1628480 확정

### 인증·권한
- `e368e50` Pro 잠금 판별 유틸 통일 — `lib/auth/plan.ts::hasProAccess({ planType, isAdmin })` + is_admin 우대
- `b89093e` 4개 서비스 페이지 적용 (drama / korean / food / calendar) — UI 무변경
- `357ef50` kpop Artist Comparison 블러도 isPro 조건부로 해제
- `70ddf1d` `/login?redirect=X` 를 `/?next=X` 으로 forward (ReportButton 비로그인 흐름 복원)

### YouTube 인제스트 (3단계 정교화 사이클)
- `18fa177` `youtube_channel_id` NULL 자동 매핑 (`searchChannelByName`, search.list 1위)
- `3a227e6` 컴백 query 정교화 (`<artist> k-pop comeback`) + 미래 `scheduledStartTime` 검증
- `7fc55ab` query 완화 — `"k-pop"` 제거 (정상 컴백도 차단되던 부작용 해결, 미래 검증만 유지)
- `3cddd9d` 운영 정책 결정 — A안 (현 상태 유지 + 어드민·신고 보완) 박제
- `1b2aa49` 영상 description DB 저장 금지 + 오매핑 10건 일괄 삭제 (BTS·BLACKPINK·HUNTR/X·ENHYPEN 등)

### AI · 어드민 · 기타
- `cede892` 어드민 이벤트 description 자동 생성 — `generateSafeEventDescription` 안전 모드 (앨범명·장소·가격 추측 금지)
- `175064d` React #418 hydration fix — `toLocaleDateString({ timeZone: "Asia/Seoul" })` 명시 의무화 (events-manager / users-table)
- `d27fe96` Calendar 모달 Copy iCal Link — 클립보드 복사 + 2초 "Copied!" 피드백
- `848ffb1` **콘텐츠 신고 시스템 구현** — migration 0015 + `<ReportButton />` + `/api/reports` + `/admin/reports` (HallyuCalendar 이벤트 우선)

### 사용자 외부 작업 완료
- Vercel `TMDB_READ_ACCESS_TOKEN` 등록 → ingest-all calendar TMDB 호출 정상화
- Vercel `LEMONSQUEEZY_VARIANT_ID_MONTHLY/ANNUAL` + `ANTHROPIC_API_KEY` 추가
- LMS USD 통화 심사 메일 답장 발송 (대기 중)
- migration 0015_content_reports.sql Supabase 적용 완료 (Success. No rows returned)

### 다음 세션 후보 (우선순위 순)
1. **LMS USD 심사 결과 받으면 product 재설정** — variant ID 새로 생성될 수 있음 (env 만 갱신하면 코드 재배포 없이 대응 가능)
2. **LMS Products Publish** — 현재 status=pending 이라 결제 차단 상태
3. **콘텐츠 신고 시스템 확장** — KpopStats artist / KdramaMatch drama / HangeulGo phrase / KfoodKit recipe 에 ReportButton 추가
4. **`app/calendar/page.tsx` hydration 룰 적용** — `viewDate.toLocaleString` 및 `useState(() => new Date(...))` initializer (admin 영역 외 미적용)
5. **YouTube 인제스트 자체 가치 재평가** — A안 결정 후 며칠 관찰. 신고 누적 패턴 보고 시드 확장 / 검증 강화 결정
6. **RLS 정책에 `is_admin=true` 분기 추가 (SQL migration)** — calendar service role 우회를 SQL 레벨로 정리, 다른 보호 테이블 일괄 적용
7. **`subscription_status='active'` 검증** — cancel 후 expires race window 정책 결정 후 `hasProAccess` 시그니처 확장

### 블로커
- 없음 (외부 의존 — LMS USD 심사 답장 / Products Publish 만 대기)

---

## 현재 상태 (2026-05-09 / `/login` redirect 파라미터 forward — ReportButton 보강)

- **완료**:
  - **진단** — ReportButton 의 비로그인 흐름이 `/` 로 튕기던 원인 추적:
    - `report-button.tsx` 자체는 의도대로 `/login?redirect=/calendar` 로 push
    - 진짜 원인은 `app/login/page.tsx` (커밋 `7bf5cbc` Start 단일화 시 폐지) — `useEffect(() => router.replace("/"))` 로 무조건 / 이동, `?redirect=` 파라미터 무시
  - **`app/login/page.tsx` 수정** — redirect 파라미터 forward
    - `useSearchParams.get("redirect")` 읽어 `/?next=${encodeURIComponent(redirect)}` 으로 변환 후 replace
    - `auth/callback` 가 next 파라미터를 OAuth 완료 후 redirect 대상으로 사용 (기존 동작)
    - `useSearchParams` 는 Suspense 경계 필수 — `<Suspense fallback={null}>` 으로 분리
- **다음 (사용자 작업)**:
  1. `/calendar` → 이벤트 클릭 → "Report incorrect info" 클릭 (비로그인 상태)
  2. `/login?redirect=%2Fcalendar` → `/?next=%2Fcalendar` 으로 forward
  3. Start 클릭 → OAuth → `/calendar` 로 복귀 확인
- **블로커**: 없음

---

## 현재 상태 (2026-05-09 / 콘텐츠 신고 시스템 구현 — HallyuCalendar 이벤트 우선 적용)

- **완료**:
  - **migration 0015** — `content_reports` 테이블 + RLS
    - 컬럼: `id, content_type(event/artist/drama/phrase/recipe), content_id, user_id, reason(mismapping/date_error/duplicate/cancelled/other), note, status(pending/reviewed/dismissed), created_at, reviewed_at, reviewed_by`
    - RLS 4개 정책: 본인 select / 관리자 select / 본인 insert / 관리자 update
    - 0013 패턴대로 service_role GRANT 명시
  - **`components/common/report-button.tsx` 신규** — 전체 서비스 공통 신고 버튼
    - "Report incorrect info" 트리거 + Dialog 모달
    - 사유 5종 라디오 선택 + "기타" 시 textarea 표시
    - 비로그인 시 `/login?redirect=...` 으로 유도
    - Dialog 디자인은 events-manager 패턴 준수 (어드민 모달 톤 통일)
  - **`/api/reports` POST 라우트** — 로그인 검증 + content_reports insert (RLS 가 본인 user_id 강제)
  - **`app/calendar/page.tsx`** — EventDetailModal 하단(reminder 토글 아래) 에 `<ReportButton contentType="event" contentId={event.id} />` 통합
  - **`/admin/reports` 페이지** — server component + client `ReportsTable` 분리
    - pending 우선 정렬 (어드민이 처리할 항목 항상 위)
    - 신고자 이메일 부가 lookup (실패 fallback)
    - content_type 별 어드민 페이지 빠른 이동 링크 (event→/admin/events, artist→/admin/kpop)
    - 처리/기각 버튼 — `/api/admin/reports/[id]` PATCH
  - **`/api/admin/reports/[id]` PATCH 라우트** — `status` reviewed/dismissed + reviewed_at + reviewed_by 갱신 (`requireAdmin` 검증)
  - **`/admin` 사이드바에 "Reports" 메뉴 추가** (Flag 아이콘, fan-events 와 KpopStats 사이)
- **다음 (사용자 작업)**:
  1. **Supabase**: `0015_content_reports.sql` SQL Editor 에서 실행
  2. **로컬·production 검증**:
     - `/calendar` 진입 → 이벤트 클릭 → 모달 하단 "Report incorrect info" 클릭 → 사유 선택 → Submit → "Thanks" 토스트 확인
     - 비로그인 클릭 시 `/login?redirect=/calendar` 이동 확인
     - `/admin/reports` 진입 → pending 신고 노출 → 처리/기각 버튼 동작 확인
- **다음 세션 후보**:
  - 다른 서비스(KpopStats artist / KdramaMatch drama / HangeulGo phrase / KfoodKit recipe) 에 ReportButton 추가
  - 어드민 reports 테이블 — 콘텐츠 미리보기 (event title 등) inline 노출 — 현재는 content_id UUID 만 표시
- **블로커**: 없음 (migration 적용은 외부 작업)

---

## 현재 상태 (2026-05-09 / Calendar 모달 Copy iCal Link 클립보드 + 피드백)

- **완료**:
  - `app/calendar/page.tsx::EventDetailModal` 의 Copy iCal Link 버튼:
    - `icalCopyStatus` state + `icalResetTimerRef` ref 추가 (`"idle" | "copied" | "failed"`)
    - `handleCopyIcal` — `navigator.clipboard.writeText` 로 placeholder URL `${origin}/api/calendar/ical/${event.id}` 복사
    - 성공/실패 시 버튼 텍스트 → `"Copied!"` / `"Copy failed"` 2초간 → 원복 (setTimeout)
    - useEffect cleanup 에 `icalResetTimerRef` 정리 추가 (모달 unmount 시 누수 방지)
    - UI 무변경 — className/style 그대로, 버튼 텍스트만 조건부
  - **헤더의 동명 버튼은 미수정** — `<Link href="/mypage/calendar">` navigate 디자인이라 의도적 유지 (사용자가 헤더도 동일 처리 원하면 별도 요청)
- **다음 (사용자 작업)**:
  1. 캘린더 진입 → 이벤트 클릭 → 모달의 Copy iCal Link 클릭 → "Copied!" 2초간 노출 + 클립보드에 placeholder URL 들어가는지 확인
  2. (별도 작업) `/api/calendar/ical/[id]` 라우트 구현 — 현재 placeholder URL 만 복사
- **블로커**: 없음

---

## 현재 상태 (2026-05-09 / YouTube description fallback 제거 + 오매핑 데이터 정리)

- **완료**:
  - **`lib/ingest/youtube.ts` 수정** — DB 에 YouTube 영상 description 저장하지 않음
    - `allEvents` 타입에서 `description` 필드 제거
    - `rawRows` 의 `_yt_description` 필드 제거
    - upsert 시 `description: aiDescription ?? null` (Claude 실패 시 `null`)
    - 이유: YouTube 영상 description 은 마케팅·앨범명·가격·장소 등 추측 정보 포함 위험. Claude 자동 생성(`generateEventDescription`)으로만 채움.
  - **Supabase `hallyu_calendar_events` 정리**:
    - `source_api='youtube'` 10건 일괄 삭제 (DELETE service_role)
    - 삭제 대상: BTS·BLACKPINK·ATEEZ·ENHYPEN 옛날 vlive, HUNTR/X 'Hunter x Hunter' 오매핑, "k-pop meme" / "Show Music Core" 등 컴백 M/V 아닌 영상 모두
    - 삭제 후 검증: source_api='youtube' 0건, 전체 manual 5건만 남음
- **다음 (사용자 작업)**:
  1. 다음 cron 또는 수동 `ingest-all` 트리거 → 새 ingest 결과가 description 비어있는지 (Claude 실패 시) 또는 안전한 1줄 카피인지 확인
- **블로커**: 없음

---

## 현재 상태 (2026-05-09 / React #418 hydration 에러 fix — 어드민 toLocaleDateString TZ)

- **완료**:
  - **진단** — cede892 변경 파일은 hydration 과 무관 (전부 서버 전용 — API 라우트, lib/claude, docs)
  - **진짜 원인 발견** — client component 의 `new Date(...).toLocaleDateString("ko-KR")` 가 timeZone 명시 없이 호출:
    - SSR(Vercel UTC) vs hydrate(브라우저 KST) 의 결과 불일치 → 자정 근처 날짜에서 일자 자체가 달라짐 → React #418
  - **2개 파일 수정** — `timeZone: "Asia/Seoul"` 명시:
    - `components/admin/events-manager.tsx:159` — 이벤트 표 날짜
    - `components/admin/users-table.tsx:102` — 유저 표 가입일
  - **그 외 점검 결과 (안전)**:
    - `app/admin/events/page.tsx` — server component, hydration 무관
    - `events-manager.tsx:68` `slice(0, 16)` — 문자열 처리, locale 무관
    - `events-manager.tsx:82` `new Date(form.event_date).toISOString()` — `handleSubmit` 안 (사용자 클릭 시 호출, hydration 시점 미실행)
    - API 라우트들 — 서버 전용
    - `kpop-artists-manager.tsx:29` `n.toLocaleString()` — 천 단위 구분자, 도달 숫자 < 1000 이라 영향 없음
- **다음 (사용자 작업)**:
  1. `/admin/events`, `/admin/users` 진입 → 콘솔에 React #418 에러 사라졌는지 확인
- **별도 보고 (이번 범위 밖)**:
  - `app/calendar/page.tsx` — `viewDate` 가 `useState(() => new Date(...))` initializer 로 SSR/hydrate 시점 timezone 의존. L171, L405-406 의 `viewDate.toLocaleString("en-US", ...)` 도 동일 패턴 — 사용자 명시 범위가 admin/events 였으므로 이번엔 미포함. 다음 세션에서 함께 fix 권장.
- **블로커**: 없음

---

## 현재 상태 (2026-05-09 / 어드민 이벤트 description 자동 생성 — 안전 모드)

- **완료**:
  - **`lib/claude/generate-event-description.ts`** — `generateSafeEventDescription(artistOrDrama, type, eventDate)` 신규
    - 별도 `SAFE_SYSTEM_PROMPT` — 앨범명·장소·가격·에피소드 등 사실 미검증 정보 강력 금지
    - 1~2 문장, 영어, "Check official channels for details." 폴백 문구 강제
    - 기존 함수와 동일 패턴 (Anthropic client, claude-haiku-4-5, cache_control, 300자 안전망, null fallback)
  - **`app/api/admin/events/route.ts` (POST)** — description 비어있으면 자동 생성 후 insert
  - **`app/api/admin/events/[id]/route.ts` (PATCH)** — description 이 빈 문자열·null 로 들어오면 자동 생성. 자동 생성에 필요한 필드(artist_or_drama, type, event_date)가 body 에 없으면 DB 에서 채워서 호출
- **다음 (사용자 작업)**:
  1. 로컬 또는 production `/admin/events` 에서 description 비운 채로 이벤트 저장 → DB 의 description 컬럼에 안전 문구 채워지는지 확인
  2. 캘린더 모달에 자동 생성 description 노출 검증
- **블로커**: 없음

---

## 현재 상태 (2026-05-09 / YouTube 자동 인제스트 운영 정책 결정 — A안 채택)

- **완료**:
  - **production `ingest-all` 재호출 진단** (query 완화 후):
    - YouTube: artistsScanned 15 / raw 9 / future 1 / **upserted 1**
    - 통과한 1건도 ATEEZ 팬 reading livestream — 공식 컴백 M/V 아님
    - BTS·BLACKPINK 정상 컴백 sample 영상도 미래 검증으로 차단됨 (실제로는 끝난 라이브)
    - HUNTR/X 'Hunter x Hunter', ENHYPEN 2021 vlive 모두 차단 ✅
  - **운영 정책 결정 — A안 (현 상태 유지)**:
    - YouTube 자동 인제스트의 0~1건/일 결과를 자연스러운 운영 상태로 받아들임
    - 이유: 미래 검증이 정확히 작동 → upsert 되는 건수가 적은 게 정상. 직전 9건은 검증 약했던 시기에 통과한 옛날·오매핑 영상.
    - 보완: 어드민 수동 입력(`/admin/events`) + 유저 신고 시스템 (PROGRESS 다음 세션 후보 항목)
  - **기각된 대안**:
    - B안 시드 15명 → 50명 확장: raw hits 늘어도 미래 검증 못 통과하면 의미 없음
    - C안 다른 데이터 소스(Soompi RSS, AllKpop): 별도 인제스트 작업 + 출처 신뢰도 검증 부담. 어드민 수동 + 신고 시스템이 ROI 우위
- **다음 세션 후보** (이전 블록의 콘텐츠 신고 시스템과 연계):
  - **콘텐츠 신고 시스템 우선순위 ↑** — HallyuCalendar 이벤트 신고 구현이 자동 인제스트 한계의 직접 보완책
  - 기존 `hallyu_calendar_events` 의 youtube=10건 점검 — 어드민에서 옛날·오매핑 영상 수동 삭제
- **블로커**: 없음

---

## 현재 상태 (2026-05-09 / YouTube query 완화 — "k-pop" 제거)

- **완료**:
  - **production `ingest-all` 재호출 진단** (정교화 후 첫 트리거):
    - TMDB ✅ 환경변수 해결 — `TMDB_READ_ACCESS_TOKEN` Vercel 등록 완료. scanned 40 / upserted 0 (미래 first_air_date 매칭 0건 — 정상 결과)
    - YouTube ⚠️ 정교화 효과 확인됐으나 부작용 — HUNTR/X·ENHYPEN 옛날 영상 모두 차단 ✅, 단 BTS·BLACKPINK·ATEEZ 정상 컴백도 함께 0건. **"k-pop" 키워드가 너무 좁힘**. BTS "arirang comeback live" 같은 영상 매칭 못 함
  - **`lib/api/youtube.ts::searchUpcomingComebacks` query 완화**:
    - `"<artist> k-pop comeback"` → `"<artist> comeback"`
    - 미래 `scheduledStartTime` 검증은 유지 — 단독으로도 옛날 vlive 차단 충분 (직전 호출에서 검증)
    - 주석에 변경 이유 박제
- **다음 (사용자 작업)**:
  1. 배포 반영 후 ingest-all 재호출 → 정상 컴백 영상이 다시 잡히는지 확인
  2. 만약 HUNTR/X 같은 오매핑 재발하면 → 채널명 검증 추가 등 별도 보강
- **블로커**: 없음

---

## 현재 상태 (2026-05-09 / YouTube 컴백 검색 정교화 + 미래 검증)

- **완료**:
  - **production `ingest-all` 수동 트리거** — 6.6초, YouTube 9건 upsert 성공. 단 진단 결과:
    - HUNTR/X 가 'Hunter x Hunter' 애니메이션 livestream 으로 오매핑
    - ENHYPEN 의 2021년 옛날 vlive 가 `eventType=upcoming` 으로 잘못 분류돼 통과
    - **TMDB 인제스트 실패** — `TMDB_READ_ACCESS_TOKEN` Vercel 환경변수 미등록 (별도 조치 필요)
  - **`lib/api/youtube.ts::searchUpcomingComebacks` 정교화**:
    - 시그니처 `query` → `artistName` 변경, 내부에서 `"<artist> k-pop comeback"` 자동 부착 → 동음 매칭 감소
    - 후처리 검증 추가 — `new Date(scheduledStartTime).getTime() > Date.now()` 인 영상만 events 에 push (옛날 라이브 오분류 방지)
    - `YoutubeSearchResult.withScheduledTime` 의 의미 재정의: "미래의 scheduledStartTime 보유 건수"
    - console.log 진단도 `withScheduledTime(future)=N` 표기로 명확화
  - **`lib/ingest/youtube.ts` 호출 측 단순화** — `${artist.name} comeback` → `artist.name` (정교화 책임을 라이브러리로 이동)
- **다음 (사용자 작업)**:
  1. **Vercel 에 `TMDB_READ_ACCESS_TOKEN` 추가** — calendar TMDB drama 인제스트 정상화 (P0)
  2. 배포 반영 후 `ingest-all` 재호출 → 9건이 어떻게 변하는지 진단 (오매핑 케이스 줄었는지)
  3. 잘못 인제스트된 기존 9건 中 옛날·오매핑 영상은 어드민(`/admin/events`) 에서 수동 삭제
- **블로커**: 없음 (TMDB 환경변수는 외부 작업)
- **다음 세션 후보**:
  - **콘텐츠 신고 시스템 (전체 서비스 공통)**

    **개요**: 유저가 잘못된 정보를 신고 → 어드민이 확인 후 수정/삭제

    **신고 대상**:
    - HallyuCalendar: 이벤트 (오매핑 / 날짜 오류 / 중복 / 취소된 이벤트)
    - KpopStats: 아티스트 (잘못된 채널 / 통계 오류)
    - KdramaMatch: 드라마 (잘못된 플랫폼 / 평점 오류 / 중복)
    - HangeulGo: 학습 카드 (번역 오류 / 발음 오류 / 예문 부적절)
    - KfoodKit: 레시피 (재료 오류 / 잘못된 드라마 연결)

    **구현 범위**:
    - DB: `content_reports` 테이블 — `content_type` (event/artist/drama/phrase/recipe), `content_id`, `user_id`, `reason`, `note`, `status`
    - 공통 컴포넌트: `<ReportButton />` — 모든 서비스 페이지에 적용
    - 유저 UI: 각 콘텐츠 상세 모달/카드 하단 "Report incorrect info" 버튼
    - 어드민: `/admin/reports` 신규 페이지 — 서비스별 필터 + 승인/기각 처리

    **우선순위**: HallyuCalendar 이벤트 신고부터 구현 후 나머지 서비스로 확대 적용 (오늘 ingest-all 진단에서 HUNTR/X 오매핑·ENHYPEN 옛날 vlive 케이스 발견 — 자동 검증으로 부족한 부분을 유저 신고로 보완)

---

## 현재 상태 (2026-05-09 / KpopStats — youtube_channel_id 자동 매핑)

- **완료**:
  - **`/kpop` YouTube Views 모두 "—" 진단** — Supabase 직접 조회 결과:
    - `kpop_artists` 25명 시드 / 모두 active / **`youtube_channel_id` 0건** (시드 시 lastfm_name 만 채우는 정책 — commit `cde3955`)
    - `kpop_stats_daily` 1건 中 `youtube_*` 모두 NULL, `lastfm_*` 만 채워짐 (정확한 결과)
    - 어드민이 25명 채널 ID 수동 입력 안 해서 발생
  - **`lib/api/youtube.ts`** — `searchChannelByName(query)` 신규
    - `search.list type=channel, maxResults=1` → 1위 채널 매핑
    - 매칭 0건이면 `null` 반환 (오매핑 방지)
    - 비용: 100 units/call
  - **`lib/ingest/kpop-stats.ts`** — 단계 1.5 신규
    - 활성 아티스트 中 `youtube_channel_id` NULL 인 행만 search 시도
    - 5명씩 병렬 (rate 보호, Last.fm 청크 패턴 동일)
    - 매칭된 것만 `kpop_artists.update` + 메모리 객체 갱신 → 같은 cron 의 channels.list 호출에 즉시 활용
    - `KpopStatsIngestResult` 에 `channelsAutoMapped` 필드 추가
  - **멱등성 보장** — 이미 `youtube_channel_id` 있는 행은 search 호출 skip
  - **기존 cron (`ingest-kpop-stats`, 매일 07:00 UTC) 에 자동 포함** — 별도 트리거 불필요
- **다음 (사용자 작업)**:
  1. **수동 트리거로 첫 매핑 시도**:
     ```powershell
     Invoke-RestMethod -Uri "http://localhost:3000/api/cron/ingest-kpop-stats" `
       -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
     ```
     → 응답 `channelsAutoMapped` 값으로 매핑 성공 수 확인
  2. 또는 다음 자연 cron (07:00 UTC) 까지 대기
  3. `/kpop` 새로고침 → YouTube Views 채워지는지 확인. 매핑 잘못된 채널은 어드민에서 수동 교정 가능
- **비용**:
  - 첫 회: 25명 NULL × 100 units = **2,500 units** (10,000/일 한도의 25%)
  - 두 번째 cron 부터: 모두 매핑돼 search 호출 0 — `channels.list` 1 unit 만
  - 다른 cron(`ingest-all` 의 YouTube 부분 1,515 units) 합산해도 첫 회 ~4,000 units 로 안전
- **블로커**: 없음

---

## 현재 상태 (2026-05-09 / Pro 잠금 해제 — 4개 서비스 페이지에 hasProAccess 적용)

- **완료**:
  - 직전 커밋(e368e50) 의 `lib/auth/plan.ts` 적용 범위 확장 — 잠금/블러 영역이 있는 모든 서비스 페이지에 통일 패턴 적용
  - **공통 패턴** — 각 페이지에 `isPro` 상태 도입:
    - "use client" 마운트 시 `supabase.from('users').select('plan_type, is_admin')`
    - `setIsPro(hasProAccess({ planType, isAdmin }))`
    - 블러 className 조건부: `${isPro ? "" : "blur-[Npx] pointer-events-none"}`
    - Upgrade overlay div 조건부: `{!isPro && (...)}`
  - **페이지별 변경**:
    - `app/drama/page.tsx`: AI Drama Summary (Episode Analysis + Character Relationship Map) — 블러 + 오버레이
    - `app/korean/page.tsx`: AI Grammar Explanation — 블러 + 오버레이
    - `app/food/page.tsx`: AI Ingredient Finder + My Shopping List — 두 영역 동일 처리
    - `app/calendar/page.tsx` (4 분기):
      - `handleTabClick`: Pro 면 Concert/Fan Meet 탭 잠금 우회
      - 탭 표시 `isLocked` 계산 — Pro 면 자물쇠 아이콘 미노출
      - Artist Tracking Limit Banner ("3/3 artists on Free plan") — Pro 면 미노출
      - Upcoming events 4번째부터 블러 우회 (`!isPro && index >= 3`) + Blur Upsell Overlay 미노출
  - UI/스타일 무변경 원칙 준수 — className 조건부 토글 + 오버레이 mount 조건만 추가
- **다음 (사용자 작업)**:
  1. **로컬 검증** — 어드민(plan_type='free' 임시 변경) 또는 Pro 계정으로 4개 페이지 진입 → 잠금 해제 확인
  2. **Vercel 자동 배포 확인**
- **블로커**: 없음

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
