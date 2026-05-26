# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.

---

## 현재 상태 (2026-05-26 세션 25 / Trial 14일 변경 + 이메일 중복 가입 방지)

### 완료

#### A. Trial 14일 변경 + 이메일 중복 가입 방지 (세션 25)

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
- 결제 연동 (LMS 심사 결과 대기)
- Trial 만료 유저 → Hallyu Pass 전환 퍼널 최적화 (/pricing 랜딩 개선)
- filming_spots backfill 잔여 처리 확인 (매일 KST 13:30 cron)
- Google 색인 추가 페이지 모니터링

### 블로커
- LMS 재심사 대기
- top.gg 심사 대기
- Google 색인 생성 대기
