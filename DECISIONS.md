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

## 2026-05-08 HallyuCalendar M+0 Phase 2.5 — 캘린더 월 navigation 동적화

- 결정 내용:
  - `viewDate: Date` 단일 상태로 표시 월 관리 (월 1일 자정 로컬 기준)
    - `goPrev` / `goNext` 가 `setViewDate` 로 새 Date 생성 → React 가 re-render + useEffect 재호출
  - 파생값을 매 render 계산 (메모이제이션 미적용 — 비용 미미):
    - `monthQuery`(API 호출용 `YYYY-MM`)
    - `currentMonth` / `monthShort`(UI 라벨, en-US locale)
    - `firstDayOfWeek` / `daysInMonth`(달력 그리드 offset·반복 횟수)
    - `today`(실제 현재 월일 때만 양수, 아니면 `-1` 로 highlight 비활성)
  - useEffect dep `[monthQuery]` — 월 string 동등성으로 리페치 트리거
  - `AbortController` 도입 — 빠른 연속 클릭 시 stale 응답 덮어쓰기 방지
  - Modal·Upcoming 배지에 viewDate 전파 → 하드코딩 "May"/"2026"/"MAY" 제거
  - Upcoming 필터: 표시 월이 실제 현재 월일 때만 `e.date >= today` cutoff, 아니면 전체 노출
- 이유:
  - Date 한 개로 관리하면 month 산술(prev/next)이 `new Date(y, m-1, 1)` / `new Date(y, m+1, 1)` 로 자동 wrap (Dec→Jan, year 증감 포함)
  - useState(() => initial) 형태로 SSR mismatch 회피 — 첫 렌더에서만 new Date() 호출
  - useEffect dep 을 viewDate(객체) 가 아니라 monthQuery(문자열) 로 둔 이유: viewDate 는 매 렌더 새 객체일 수 있어 무한 루프 위험. 문자열은 값 동등성.
- 대안으로 고려했던 것:
  - `{year, month}` 객체 상태: 산술 시 wrap 직접 처리 필요해 더 번거로움
  - `useMemo` 로 파생값 캐싱: 월 1회 변경되는 값들이라 비용·코드 복잡도 대비 이득 미미
  - URL 쿼리(`?month=YYYY-MM`)로 상태 동기화 + 공유 가능 링크: Phase 3 후보 (현재는 SPA 내 로컬 상태로 충분)

## 2026-05-08 HallyuCalendar M+0 Phase 2 — TMDB / YouTube / Last.fm 자동 인제스트

- 결정 내용:
  - 외부 API 래퍼 3종 (`lib/api/{tmdb,youtube,lastfm}.ts`)
    - TMDB: v4 Bearer 토큰, `discover/tv?with_origin_country=KR` 인기순 fetch
    - YouTube: `googleapis` SDK, `search.list` (eventType=upcoming) + `videos.list` (liveStreamingDetails)
    - Last.fm: `tag.gettopartists?tag=k-pop`
  - Cron 스타일 라우트 3종 (`app/api/cron/ingest-{tmdb,youtube,lastfm}/route.ts`)
    - 인증: `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron 자동 헤더 호환)
    - 적재: `createSupabaseAdminClient` (service_role) 로 RLS 우회 upsert
    - 멱등성: `(source_api, source_id)` unique 제약으로 onConflict 갱신
  - 역할 분리:
    - **TMDB → 'drama'**: 미래 first_air_date 만 필터, KST 21시로 가정
    - **YouTube → 'comeback'**: Last.fm 시드 아티스트 15명 × 검색 3건 (≈1,500 quota units/run)
    - **Last.fm → 시드 전용**: release date 가 없어 직접 이벤트 생성 안 함
  - `vercel.json` cron 스케줄: TMDB 04:00 / YouTube 05:00 / Last.fm 06:00 UTC
  - `.env.local` 에 `CRON_SECRET` 항목 추가 (사용자가 직접 채움)
- 이유:
  - Last.fm 자체 API 에 album release date 가 없음 — 트렌딩 시그널은 있지만 미래 이벤트 생성에 부적합. MusicBrainz 2-hop 조회는 Phase 2.5 로 분리.
  - YouTube `eventType=upcoming` 은 Premiere(예약 영상)·Live 모두 포함 — 컴백 M/V 가 보통 Premiere 로 예약되므로 신뢰도 높음.
  - 쿼터 보호: 아티스트당 search.list(100u) + videos.list(1u) = 101u, 15명 = 1,515u 로 일일 10,000u 한도의 15% 만 사용. 다른 서비스 확장 여유 확보.
  - service_role 클라이언트 분리 (`lib/supabase/admin.ts`) 로 인제스트 잡이 RLS 정책 작성 부담 없이 동작.
- 대안으로 고려했던 것:
  - Vercel Cron 단일 `ingest-all` 라우트로 통합 (Hobby plan 2개 cron 한도 회피) → Pro 가정으로 분리 유지 (디버깅/재실행 편의)
  - Last.fm + MusicBrainz 2-hop 으로 정확한 신보 감지 → 복잡도 증가, Phase 2.5 로 미룸
  - YouTube 아티스트 리스트 하드코딩 → Last.fm 동적 시드가 트렌드 반영에 유리

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

