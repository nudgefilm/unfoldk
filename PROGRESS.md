# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.

---

## 현재 상태 (2026-05-08)

- **완료 (이번 세션)**:
  - 히어로 섹션 ghost globe 마크 추가 + float 애니메이션 (motion-reduce 대응)
  - 파비콘 교체 + 브라우저 탭 타이틀 'UnfoldK' 단순화
  - `Work/` 폴더 `.gitignore` 추가 (로컬 작업용 자산)
  - 이용약관 언어 토글을 Privacy 와 동일 위치·스타일로 통일
  - **HallyuCalendar M+0 Phase 1 인프라 완료**:
    - 백엔드 SDK 설치 (`@supabase/supabase-js`, `@supabase/ssr`, `resend`, `googleapis`)
    - `lib/supabase/{server,browser,admin}.ts` 클라이언트 3분기
    - `supabase/migrations/0001_init.sql` — 4개 테이블 + RLS + auth 트리거
    - `supabase/seed.sql` — mock 5개 이벤트 DB 시드
    - `app/api/calendar/events/route.ts` — `GET ?month=YYYY-MM` (zod 검증)
    - `app/calendar/page.tsx` — mock 제거, API fetch 연동 (UI 무변경)
- **진행 중**: 없음 (Phase 1 완료, Phase 2 대기)
- **다음 세션 (Phase 2 — 외부 API 인제스트)**:
  - Supabase 대시보드에서 마이그레이션·시드 SQL 실행 (사용자 작업)
  - `/calendar` 페이지에서 시드 데이터 로드 확인
  - TMDB 인제스트: `lib/api/tmdb.ts` + cron 방식으로 K-드라마 일정 → `hallyu_calendar_events` 적재
  - YouTube 인제스트: 컴백 영상 감지 → 이벤트 생성
  - Last.fm 인제스트: 신보 발매 감지
  - 월 navigation (이전/다음) 동작 연결 — 현재 `CURRENT_MONTH` 하드코딩 상태
- **다다음 세션 (Phase 3 — Auth + 리마인더)**:
  - Supabase Auth: Google/Apple OAuth + 이메일 로그인
  - 리마인더 토글(d7/d1/dayOf) → `user_calendar_subscriptions` 영속화
  - Resend 이벤트 D-Day 알림 발송 (Vercel Cron)
- **블로커**:
  - 사용자 작업 필요: Supabase Dashboard 에서 `0001_init.sql` + `seed.sql` 실행 — 안 하면 API 가 빈 배열 반환
  - Google Calendar OAuth 앱 심사 신청 (출시 6주 전, 별도 트랙)
  - Stripe 키 미입력 (Phase 3 결제 단계에서 필요)
  - `next.config.mjs` 의 `typescript.ignoreBuildErrors: true` 아직 활성 — strict 전환은 Phase 2 끝에 검토

---

## 이전 세션 기록

### 2026-05-07 (세션 1)
- v0 UI 17개 페이지 로컬 세팅
- ESLint 설정 정리
- GitHub 레포 `nudgefilm/unfoldk` 생성 및 초기 push 완료
- 브랜치 네이밍을 `main`으로 통일

<!-- 세션이 끝날 때마다 위 "현재 상태" 블록을 아래로 이동시키며 누적 -->
