# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.

---

## 현재 상태 (2026-05-07)

- **완료**:
  - v0 UI 파일 로컬 세팅 완료
  - ESLint 설정 + 메타데이터 수정 + lint 룰 정리 (커밋 `fd79848`)
  - GitHub 레포 생성 및 연동 (`https://github.com/nudgefilm/unfoldk`)
  - 로컬 브랜치 `master` → `main` 변경, `origin/main` 추적 설정 완료
  - 초기 2개 커밋 GitHub push 완료
- **진행 중**: 도메인 연동 (`unfoldk.com`)
- **다음 세션**:
  - 도메인 연동 마무리 후 Vercel 배포 연결
  - HallyuCalendar(M+0) API 연동 시작 — YouTube Data API v3, TMDB, Last.fm, Resend
  - Supabase 프로젝트 세팅 + Auth + RLS 초기 적용
- **블로커**:
  - `.env.local` 미생성 (템플릿만 존재, 실제 키 미입력)
  - 백엔드 SDK 미설치 (`@supabase/*`, `stripe`, `googleapis`, `@anthropic-ai/sdk`, `resend` 등)
  - YouTube API용 별도 GCP 프로젝트 생성 필요 (tubewatch.kr와 분리 필수)
  - Google Calendar OAuth 앱 심사 신청 필요 (출시 6주 전)

---

## 이전 세션 기록

### 2026-05-07 (세션 1)
- v0 UI 17개 페이지 로컬 세팅
- ESLint 설정 정리
- GitHub 레포 `nudgefilm/unfoldk` 생성 및 초기 push 완료
- 브랜치 네이밍을 `main`으로 통일

<!-- 세션이 끝날 때마다 위 "현재 상태" 블록을 아래로 이동시키며 누적 -->
