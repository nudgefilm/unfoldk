# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.

---

## 현재 상태 (2026-05-09)

- **완료 (오늘 인시던트 대응)**:
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
