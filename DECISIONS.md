# DECISIONS.md — 기술적 결정 누적 기록

> UnfoldK (UnfoldKorea) 프로젝트의 모든 기술적 결정을 시간순으로 누적합니다.
> 외부 API 연동, DB 스키마 변경, 폴더 구조 변경, 라이브러리 채택은 **반드시** 이 파일에 기록.

---

## 작성 형식

```markdown
## YYYY-MM-DD 결정 제목

- 결정 내용:
- 이유:
- 대안으로 고려했던 것:
```

---

## 결정 기록

<!-- 새로운 결정은 이 아래에 최신순(위 → 아래)으로 추가 -->

## 2026-05-08 HallyuCalendar M+0 Phase 1 — 인프라 + DB 스키마 + 캘린더 API 연결

- 결정 내용:
  - 백엔드 SDK 설치: `@supabase/supabase-js`, `@supabase/ssr`, `resend`, `googleapis`
  - Supabase 클라이언트 3분기: `lib/supabase/{server,browser,admin}.ts`
    - server: `createServerClient` + Next 15 async cookies (RLS용 세션 전달)
    - browser: `createBrowserClient`
    - admin: service_role 직결, 인제스트 잡·웹훅 전용 (클라이언트 import 금지)
  - DB 스키마 4개 테이블 (`supabase/migrations/0001_init.sql`):
    - `users` — auth.users 확장 프로필 (plan_type, subscription_status)
    - `subscriptions` — Stripe 구독 기록 (월/연 + expires_at)
    - `hallyu_calendar_events` — 이벤트 마스터, `(source_api, source_id)` unique 로 인제스트 중복 방지
    - `user_calendar_subscriptions` — 사용자별 리마인더(d7/d1/dayOf) 토글
  - RLS 정책:
    - `is_premium=false` 이벤트는 `anon`+`authenticated` 모두 read 허용 (랜딩에서도 미리보기 가능)
    - `is_premium=true` 는 `users.plan_type in ('monthly','annual') AND subscription_status='active'` 만 read
    - 이벤트 write 는 service_role 전용 (정책 미부여)
  - `auth.users` insert 트리거 → `public.users` 자동 프로필 생성 (Google/Apple OAuth 대비)
  - API 라우트: `GET /api/calendar/events?month=YYYY-MM` — zod 검증, RLS 가 게이팅 처리
  - 이벤트 타입 매핑은 API 레이어에서 처리 (DB: `comeback/drama/concert/fanmeet` ↔ UI: `K-pop/K-drama/Concert/Fan Meet`)
  - 시드 5개(현재 mock) → `supabase/seed.sql` 로 이전, `(source_api='manual', source_id)` 충돌 시 skip
- 이유:
  - 클라이언트 분기는 Next.js App Router + Supabase SSR 공식 패턴 — RSC 에서 cookies 미사용 시 RLS 우회 발생
  - `is_premium` 을 RLS 레벨에서 처리 → 클라이언트 코드에서 가드 누락해도 안전 (defence in depth)
  - 타입 매핑을 API 레이어에 두면 v0 UI 의 EventType union 을 건드리지 않아도 됨 (CLAUDE.md §10-9)
  - source_api/source_id unique 는 향후 Phase 2 인제스트(YouTube/TMDB/Last.fm)에서 멱등성 확보
- 대안으로 고려했던 것:
  - DB 와 UI 의 type 라벨을 통일 (UI 변경 필요 — v0 원칙 위배)
  - 클라이언트에서 직접 supabase-js 로 read (RLS 정책 작성 부담은 동일하나 SSR/SEO 미래 확장에 불리)
  - `is_premium` 게이팅을 API 레이어에서 처리 (RLS 가 더 안전)

