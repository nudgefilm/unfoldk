# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.

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
- **진행 중**: 없음
- **다음 (사용자 검증)**:
  - `pnpm dev` → `/calendar` < > 클릭 → 월 변경 시 이벤트 새로 fetch 확인
  - TMDB 적재된 미래 드라마들이 해당 월에 표시되는지 확인
- **다음 세션 후보**:
  - **Phase 3**: Supabase Auth (Google/Apple OAuth + 이메일), 리마인더 영속화, Resend D-Day 알림
  - **Phase 2.6** (선택): URL 쿼리로 month 동기화(`?month=2026-06`), MusicBrainz 연계 신보 감지
- **블로커**:
  - Google Calendar OAuth 앱 심사 신청 (출시 6주 전, 별도 트랙)
  - Stripe 키 미입력 (Phase 3 결제 단계에서 필요)
  - Vercel Cron Hobby plan 은 2개 한도 — Pro 또는 라우트 통합 필요
  - `next.config.mjs` 의 `typescript.ignoreBuildErrors: true` 아직 활성 — strict 전환은 Phase 3 끝에 검토

---

## 이전 세션 기록

### 2026-05-07 (세션 1)
- v0 UI 17개 페이지 로컬 세팅
- ESLint 설정 정리
- GitHub 레포 `nudgefilm/unfoldk` 생성 및 초기 push 완료
- 브랜치 네이밍을 `main`으로 통일

<!-- 세션이 끝날 때마다 위 "현재 상태" 블록을 아래로 이동시키며 누적 -->
