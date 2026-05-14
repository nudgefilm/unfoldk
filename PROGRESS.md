# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.

---

## 현재 상태 (2026-05-14 세션 12 / KpopStats 전면 개선 + 캐싱 인프라 + 메인 hang 블로커)

> 새 PROGRESS 정책 (세션 종료 시점 일괄, CLAUDE.md §8) 첫 적용. 오늘 세션 11 이후 누적 작업 한 묶음.

### A. KpopStats 페이지 전면 개선 (`f5fb2a0`, `c6841c4`, `5f193b9`)
- Artist Spotlight 상세 하단에 `ReportButton` (contentType="artist") — HallyuCalendar 모달 패턴 동일. 페이지 레벨 `<Toaster />` 로컬 마운트 (silent no-op 방지).
- 아티스트 프로필 이미지 — `kpop_artists.thumbnail_url` 활용. 차트 행 좌측 w-10 원형, Spotlight 헤더 w-16 원형. fallback 회색 placeholder.
- 차트 행 호버 강화 `bg-[#252525]` → `bg-[#2a2a2c]` + `cursor-pointer`.
- **Today's Trending Top 5** 섹션 신규. `/api/kpop/charts/trending` — today vs yesterday delta desc Top N.
- 차트/Trending 카드 클릭 시 Artist Spotlight 섹션으로 부드러운 스크롤 — 상세 페이지 구현 전까지 임시 동작 (`spotlightSectionRef` + `pendingScrollRef`).

### B. 캐싱 인프라 (`8389992`, `24e176c`, `e3923af`)
- `calendar/events` `Cache-Control: private, max-age=60` — Pro 콘텐츠 누출 방지 (RLS isPremium 게이팅).
- `kpop/charts` `force-dynamic` 제거 + `public, s-maxage=300, stale-while-revalidate=600` + **`export const revalidate=300`** (Cache-Control 헤더만으론 request.url 사용 시 Vercel CDN 캐시 안 됨).
- `kpop/charts/trending`, `kpop/artists/[id]` 동일 정책. `kpop/artists` `s-maxage=60`.
- `lastfm.getArtistInfo` `revalidate: 86400`.
- **`ingest-all` 4번째 단계로 `runKpopStatsIngest` 추가** (별도 카드 X, ingest-all total_upserted 자동 합산). maxDuration 300→400.

### C. BTS·BLACKPINK 채널 ID 정정 (`5f8bcc2`)
- **migration 0019_fix_bts_blackpink_channel.sql**: BTS=`UCLkAepWjdylmXSltofFvsYQ`, BLACKPINK=`UCOmHUn--16B90oW2L6FRR3A` 강제 박제 + `thumbnail_url=NULL` reset.
- Artist Comparison 카드 BTS·BLACKPINK 에 chart 응답 thumbnail 직접 노출.

### D. CLAUDE.md 정책 강화 (`1c68425`, `b5bffb8`) → v3.3
- **§8 종료**: PROGRESS.md 매 작업 갱신 금지 → 세션 종료 신호 시 일괄.
- **§9 문제 해결 원칙** 6항목 — 가장 단순 먼저, 외부 fetch 단독 시도 금지, 썸네일 SQL 직접 업데이트, 채널 ID 브라우저 확인 요청 등.
- **§10 작업 범위 원칙** 4항목 — 명시 작업만, 진단 코드 추가 전 승인, 불필요한 fetch 금지.

### E. ingest 진단 도구 강화 (`427d5ec`)
- `api/youtube.getChannelStats`: channels.list 응답 누락 ID `console.warn`. thumbnails 추출 `default → default_ → medium → high` fallback.
- `KpopStatsIngestResult`: `channelsRequested` / `channelsReturned` / `missingChannelIds` / `thumbnailDebug[]` (action: skipped_channel_missing, updated, update_zero_rows, ...).
- `kpop_artists.update().select("id")` — RLS·id mismatch silent 0행 fail 감지.

### F. UI 폴리시 (`f60cf43`, `e7d2a73`)
- Global Chart 부제 추가 — "Ranked by weekly YouTube view growth".
- Trending API 3단계 fallback: 2일치 → delta desc / 1일치만 → total_views desc + delta:null / 0일치 → trending:[] (UI "Coming soon").
- YouTube Views 컬럼 `weekly ?? total` fallback (cron 직후 weekly 없는 행 "—" 회피).

### G. ⚠️ 미해결 블로커 — 메인 페이지 hang + Ghost Globe 미작동
- `f4f0f80` (next.config images.unoptimized 제거) 이후 `unfoldk.com` 메인 페이지 매우 느림 + Ghost Globe 안 보임 발생. 다른 페이지(`/calendar`, `/kpop`)는 정상.
- `8562ce7` 로 `unoptimized: true` 복원했으나 **증상 동일**.
- 코드 직접 변경 0건: `app/page.tsx`, `hero-section.tsx`, `ghost-globe.tsx`, `ghost-globe-dynamic.tsx`, 메인 페이지 import 11개 컴포넌트 모두 오늘 변경 흔적 없음.
- **현재 가설**: next.config 오늘 두 번 변경으로 build cache 두 번 invalidate → 클라이언트 chunk hash 변경 → 사용자 브라우저 stale chunk cache 가 404. 메인 페이지만 영향인 이유: 사용자가 가장 자주 방문해 stale cache 보유한 페이지.
- **다음 시도** (사용자 진행 예정): 노트북 재부팅 + 브라우저 hard refresh (CMD+Shift+R) / incognito 창. 여전히 증상이면 코드 측 추가 추적 필요 (hero-section 내 console 에러, topojson fetch URL 등).

### 사용자 액션 필요
1. **Supabase SQL Editor 마이그레이션 실행** (미실행 시):
   - `0018_event_external_url.sql` (calendar events url 컬럼)
   - `0019_fix_bts_blackpink_channel.sql` (BTS·BLACKPINK 채널 ID)
2. **`/admin/cron` manual run** (미실행 시):
   - `ingest-tmdb` — 수집 윈도우 확장 + Watch Now url backfill
   - `ingest-ticketmaster` — Get Tickets url backfill
   - `ingest-kpop-stats` — thumbnail backfill (BTS·BLACKPINK 포함)
3. **메인 페이지 hang 진단** (재부팅 후):
   - 브라우저 hard refresh / incognito
   - Vercel 대시보드의 `8562ce7` deployment Ready 상태 확인
   - 여전히 안 되면 다음 세션 추적

### 다음 세션 후보
- carry-over:
  - 메인 페이지 hang 추적 (재부팅 후 결과 의존)
  - TMDB 드라마 모달 장르·평점 표시 / OTT 이름 노출
  - Curation K waitlist API + 지도 hover 모달
  - Claude Haiku 분류 로직 fan_event_requests 이식
  - fan_event_requests 제보 폼 / admin 검토 큐 UI 정비
  - Cookie Policy 본문 법무 검토 / Vercel·Supabase 비용 점검
- 이번 세션 신규:
  - `searchChannelByName` 자동 매핑 정확도 — 화이트리스트 또는 자동 매핑 제거 후 어드민 수동만
  - 점진적 `<img>` → `<Image>` 마이그레이션 후 `unoptimized` 재시도
  - admin/cron 의 `kpopStats` 부분 실패 (`errors.length > 0`) 가 anyFailed 에 안 잡히는 이슈 — failure detection 보강

### 블로커
- **메인 페이지 hang + Ghost Globe 미작동** (위 G 참조). 사용자 재부팅 후 결과 의존.

---

## 현재 상태 (2026-05-14 세션 11 / TMDB 수집 조건 완화 — 방영 중 드라마 포함)

> 세션 10 진단 결과: tmdb 행 0건 + ingest 로그 "future first_air_date 매칭 없음" 반복. 원인은 필터가 `first_air_date >= today` 라 미래 premiere 만 잡음. TMDB discover/tv?sort_by=popularity 인기 한국 드라마는 대부분 이미 방영 시작 상태라 거의 매칭 안 됨.

### 수정
- **`lib/ingest/tmdb.ts`** 필터 윈도우: `first_air_date >= today` → `today-90d ≤ first_air_date ≤ today+30d`.
  - 과거 90d: 한국 드라마 표준 시즌 16~24화 ≒ 2~3개월. 인기순이라 이 구간 대부분 "방영 중" 인기작.
  - 미래 30d: 곧 방영 예정 (premiere).
- title 분기: `firstAir >= today` → `${name} — Premiere`, 과거 → `${name} — Now Airing`.
- event_date 는 그대로 first_air_date (KST 21시) — 캘린더에 방영 시작일 흔적으로 노출. "현재 보이는 월" 에 들어오면 표시됨.
- baseRows 빈 분기 note 메시지도 업데이트.

### 향후 정확도 개선 (TODO 주석 박제)
- 정확한 "방영 중" 판정은 `tv/{id}` detail 의 next_episode_to_air 필드 필요. 60건 detail call 추가 부담이라 휴리스틱 채택. 추후 append_to_response 로 watch/providers + detail 동시 호출 최적화 가능.

### 사용자 액션 필요
1. **`/admin/cron` 에서 ingest-tmdb manual run 1회** — 윈도우 확장된 새 조건으로 즉시 backfill.
2. 결과 JSON 의 `upserted` / `with_watch_url` / `without_watch_url` 카운트 확인 — 정상 흐름 검증.
3. `/calendar` 에서 K-drama 탭으로 이동, 최근 월 둘러보며 드라마 이벤트 노출 확인.

### 다음 세션 후보
- carry-over 그대로 (세션 5~10):
  - Ticketmaster 실데이터 인제스트 재검증
  - KOPIS 캘린더 재노출 정책 + Melon Ticket url
  - Curation K waitlist API
  - Curation K 지도 hover 모달
  - Claude Haiku 분류 로직 fan_event_requests 이식
  - fan_event_requests 제보 폼 / admin 검토 큐 UI 정비
  - Cookie Policy 본문 법무 검토 / Vercel·Supabase 비용 점검
  - TMDB 드라마 모달에 장르·평점 표시
  - TMDB watch providers 구체 OTT 이름 노출
- 이번 세션 신규 후보:
  - tv/{id} detail next_episode_to_air 기반 정확한 "방영 중" 판정 + 다음 화 날짜 event_date 사용
  - append_to_response 로 detail + watch/providers 통합 호출 최적화

### 블로커
- 없음

---

## 현재 상태 (2026-05-14 세션 10 / TMDB Watch Now 디버깅 도구 + cron 라벨 fix)

> 세션 8 의 TMDB Watch Now 가 실제 캘린더에서 미노출 — 코드는 정상이라 데이터 측 원인 추적용 도구 추가. 동시에 세션 9 박제한 metricLabel 버그 fix.

### A. 코드 점검 결과 (정상)
- `lib/api/tmdb.ts:fetchWatchProvidersUs` — US flatrate/buy/rent 어느 하나라도 있으면 `results.US.link` 반환, 비면 null. try/catch 로 에러 swallow.
- `lib/ingest/tmdb.ts` — Promise.all 로 description 과 동시 fetch, `url: watchUrl` 로 upsert.
- `app/calendar/page.tsx:shouldShowWatchNow` — `sourceApi==='tmdb' && !!url`.

코드는 이상 없음 → 데이터 측 원인 가능성: (1) manual run 미실행 → 기존 행 url=null 그대로, (2) 한국 드라마 신작이 US OTT 미정 (정상), (3) TMDB_READ_ACCESS_TOKEN 누락·만료 시 fetch 가 throw → catch 로 일괄 null.

### B. 진단 메트릭 박제
- `TmdbIngestResult` 에 `with_watch_url` / `without_watch_url` 필드 추가. 다음 ingest-tmdb manual run 후 결과 JSON 에서 확인 가능.
  - `with_watch_url: 0` + `without_watch_url: N` → fetchWatchProvidersUs 가 전체 null (토큰 또는 API 문제)
  - `with_watch_url: M > 0` → 정상, 일부 드라마만 US provider 있음 → 캘린더에서 그 드라마들 모달엔 버튼 노출

### C. 사용자 직접 진단 SQL (Supabase Dashboard SQL Editor)
```sql
-- TMDB 행 url 분포
select count(*) filter (where url is not null) as with_url,
       count(*) filter (where url is null) as without_url
from public.hallyu_calendar_events
where source_api = 'tmdb';

-- 샘플 5건
select id, title, event_date, url
from public.hallyu_calendar_events
where source_api = 'tmdb'
order by event_date asc
limit 5;
```

### D. admin/cron metricLabel 버그 fix (세션 9 박제 후속)
- 기존: `route === "ingest-all" ? "수집 이벤트" : "발송 수"` → ingest-kopis·ingest-ticketmaster 도 "발송 수" 로 표시되던 오류.
- 수정: `route === "send-reminders" ? "발송 수" : "수집 이벤트"` — send-reminders 만 발송, 나머지 ingest-* 는 전부 수집. 두 분기 위치 (no-data 분기 + 일반 분기) 모두 동일 헬퍼 변수로 통일.

### 사용자 액션 필요
1. `/admin/cron` 에서 ingest-tmdb manual run 1회 → 결과 JSON 의 `with_watch_url` 카운트 확인.
2. 위 SQL 실행으로 DB 현재 상태 직접 확인.
3. with_watch_url=0 이면 환경변수 TMDB_READ_ACCESS_TOKEN 점검 (Vercel env / .env.local).

### 다음 세션 후보
- carry-over 그대로 (세션 5~9):
  - Ticketmaster 실데이터 인제스트 재검증
  - KOPIS 캘린더 재노출 정책 + Melon Ticket url
  - Curation K waitlist API
  - Curation K 지도 hover 모달
  - Claude Haiku 분류 로직 fan_event_requests 이식
  - fan_event_requests 제보 폼 / admin 검토 큐 UI 정비
  - Cookie Policy 본문 법무 검토 / Vercel·Supabase 비용 점검
  - TMDB 드라마 모달에 장르·평점 표시
  - TMDB watch providers 구체 OTT 이름 노출

### 블로커
- 없음

---

## 현재 상태 (2026-05-14 세션 9 / ingest-all 수집 이벤트 카운트 fix)

> 어드민 Cron 모니터의 ingest-all 카드 "수집 이벤트" 메트릭이 항상 0 으로 표시되던 버그 fix.

### 원인
- `app/admin/cron/page.tsx` 합산 로직이 각 단계 결과 객체의 `inserted` + `updated` 키를 합산하고 있었으나, 실제 ingest 결과 (tmdb/youtube/lastfm) 는 `upserted` 키만 반환. 매칭 안 돼서 항상 0.

### 수정
- **`app/api/cron/ingest-all/route.ts`**: payload 에 `total_upserted` 필드 직접 박제. 각 단계 결과의 `upserted` 를 Object.values 자동 순회로 합산 (새 단계 추가 시 별도 코드 변경 불필요). error 단계는 upserted 없으니 자연 스킵.
- **`app/admin/cron/page.tsx`**: ingest-all summary 추출을 `result_json.total_upserted` 로 변경. 과거 로그 (필드 없음) 호환 위해 각 단계 `upserted` 합산 fallback 유지 — 기존 잘못된 `inserted`/`updated` 합산 로직은 제거.

### 사용자 액션 필요
- 없음. 다음 ingest-all cron 실행 시 자동으로 total_upserted 박제 + 어드민 카드에 정확한 값 표시.
- 즉시 검증하려면 `/admin/cron` 에서 ingest-all manual run 1회.

### 다음 세션 후보
- carry-over 그대로 (세션 5~8):
  - Ticketmaster 실데이터 인제스트 재검증
  - KOPIS 캘린더 재노출 정책 + Melon Ticket url
  - Curation K waitlist API
  - Curation K 지도 hover 모달
  - Claude Haiku 분류 로직 fan_event_requests 이식
  - fan_event_requests 제보 폼 / admin 검토 큐 UI 정비
  - Cookie Policy 본문 법무 검토 / Vercel·Supabase 비용 점검
  - TMDB 드라마 모달에 장르·평점 표시
  - TMDB watch providers 구체 OTT 이름 노출
- 이번 세션 신규 후보:
  - admin/cron 의 ingest-kopis·ingest-ticketmaster metricLabel 이 "발송 수" 로 잘못 라벨됨 (실제는 "수집 이벤트"). 메트릭 값은 맞지만 라벨 오류.

### 블로커
- 없음

---

## 현재 상태 (2026-05-14 세션 8 / 캘린더 TMDB Watch Now + 출처 표기)

> TMDB 드라마 이벤트에 Watch Now 외부 링크 + ToS 출처 표기. url 컬럼 (세션 7 0018 도입) 을 Ticketmaster·TMDB 양쪽이 source_api 가드로 격리 공유. 마이그레이션 신규 없음.

### A. TMDB watch/providers API 래퍼
- `lib/api/tmdb.ts` `fetchWatchProvidersUs(tmdbId)` 추가. US region flatrate/buy/rent 중 하나라도 있어야 link 반환, 비면 null. 404·기타 에러는 swallow (cron 전체 실패 방지). 24h revalidate.
- TMDB 응답의 `results.US.link` = TMDB 가 제공하는 region dispatcher URL. 클릭 시 TMDB 측에서 사용자 region 기반 리다이렉트. 우리는 단일 URL 만 저장하면 됨.

### B. TMDB ingest 확장
- `lib/ingest/tmdb.ts` 행 생성 시 watch providers 동시 fetch. description (Claude or overview fallback) 과 Promise.all 로 묶음.
- url 비어 있으면 null → UI 에서 Watch Now 버튼 미노출. 다음 cron 부터 자동 backfill (upsert ignoreDuplicates:false).

### C. 캘린더 페이지 — Watch Now 버튼 + 1차 CTA 통합
- `shouldShowWatchNow(event) = sourceApi==='tmdb' && !!url` 헬퍼.
- `hasExternalPrimaryCta(event) = Tickets OR Watch` 통합 — Add to GCal 강등 조건 일원화. 두 source 가 동시에 참이 될 수 없어 안전.
- EventDetailModal·UpcomingAccordionItem 양쪽에 Play 아이콘 Watch Now 버튼 (Ticketmaster Get Tickets 와 동일 패턴, target=_blank).

### D. TMDB attribution
- `/calendar` main 하단 (FooterSection 위) 에 ToS 의무 문구 박제: "This product uses the TMDB API but is not endorsed or certified by TMDB." TMDB 단어가 https://www.themoviedb.org 링크.

### 사용자 액션 필요
- `/admin/cron` 에서 TMDB ingest manual run 1회 — 기존 행 url backfill (upsert 라 자동).
- 이번 세션은 신규 마이그레이션 **없음**. 세션 7 의 0018 컬럼 재활용.

### 다음 세션 후보
- carry-over 그대로:
  - Ticketmaster 실데이터 인제스트 재검증
  - KOPIS 캘린더 재노출 정책 + Melon Ticket url
  - Curation K waitlist API
  - Curation K 지도 hover 모달
  - Claude Haiku 분류 로직 fan_event_requests 이식
  - fan_event_requests 제보 폼 / admin 검토 큐 UI 정비
  - Cookie Policy 본문 법무 검토 / Vercel·Supabase 비용 점검
- 이번 세션 신규 후보:
  - TMDB 드라마 모달에 장르·평점 표시 (현재 description 만)
  - TMDB watch providers 의 구체 OTT 이름 (Netflix/Disney+/Viki) UI 노출 — 현재는 단일 dispatcher 링크만

### 블로커
- 없음

---

## 현재 상태 (2026-05-14 세션 7 / 캘린더 이벤트 Get Tickets 링크)

> 기획안 v1.2 캘린더 메뉴 개선 — Ticketmaster 이벤트 상세·아코디언에 외부 티켓 예매 페이지 링크 추가. 사용자가 "이미 수집된 url" 이라고 했으나 실제 ingest·DB 양쪽 모두 누락 상태였음. 구조적 fix 로 진행.

### A. DB 컬럼 추가
- **migration 0018** `hallyu_calendar_events.url text` 추가. comment 박제. **⚠️ 사용자 액션 필요 — Supabase Dashboard SQL Editor 에서 0018_event_external_url.sql 실행.**

### B. Ticketmaster ingest backfill
- `lib/ingest/ticketmaster.ts` 행 생성에 `url: ev.url ?? null` 추가. upsert `onConflict:source_api,source_id` + `ignoreDuplicates:false` 라 다음 cron 또는 manual run 시 기존 행도 자동 backfill.

### C. API 응답 + 캘린더 페이지 UI
- `app/api/calendar/events/route.ts` select·매핑에 url 포함.
- `app/calendar/page.tsx`:
  - `CalendarEvent.url?: string` 타입 추가.
  - 헬퍼 `shouldShowGetTickets(event) = sourceApi==='ticketmaster' && !!url` — Ticketmaster 외 소스는 url 의미 다를 수 있어 격리.
  - `EventDetailModal`: Get Tickets 버튼 (Ticket 아이콘, target=_blank, noopener noreferrer) 을 Add to Google Calendar 위 1차 CTA 위치에. Ticketmaster 가 아닐 땐 미노출 + Add to GCal 이 원래 자리에서 1차 CTA 유지.
  - `UpcomingAccordionItem`: 동일 패턴.
  - Featured 카드는 디자인 유지 — 카드 클릭 → 모달 → Get Tickets 로 자연 연결.

### D. KOPIS TODO
- `lib/ingest/kopis.ts` 행 생성부에 "재노출 시 Melon Ticket url 채울 것" TODO 주석. 현재 캘린더 API `.neq("source_api","kopis")` 로 노출 차단 중이라 우선순위 낮음.

### 사용자 액션 필요
1. **Supabase Dashboard > SQL Editor 에서 `supabase/migrations/0018_event_external_url.sql` 실행** (컬럼 추가).
2. 실행 후 `/admin/cron` 에서 ticketmaster manual run 1회 — 기존 행 backfill 트리거.
3. 캘린더 페이지에서 Ticketmaster 출처 이벤트 클릭 → 모달에 Get Tickets 버튼 노출 확인.

### 다음 세션 후보
- carry-over (세션 5·6 잔여):
  - Ticketmaster 실데이터 인제스트 재검증 (locale fix 후 cron_logs 메트릭)
  - KOPIS 캘린더 재노출 정책 + Melon Ticket url 수집 메커니즘
  - Curation K waitlist API
  - Curation K 지도 hover 모달
  - Claude Haiku Yes/No/Uncertain 분류 로직 fan_event_requests 어드민 큐 이식
  - fan_event_requests 제보 폼 / admin 검토 큐 UI 정비
  - Cookie Policy 본문 법무 검토 / Vercel·Supabase 비용 점검

### 블로커
- 없음

---

## 현재 상태 (2026-05-14 세션 6 / Curation K (M+5) 메뉴 + 사전 등록 랜딩)

> Services 6번째 서비스 Curation K 의 메뉴·footer 통합 + 실사 한국 지도 기반 마케팅 랜딩 페이지 신규. 기획안 v1.2 §6 완성형 구조 + 부속 도서 (백령·울릉·독도·마라도) 영토 표기.

### A. Services 메뉴 통합
- **`609b14b`** Header `services` 배열에 Curation K (Map 아이콘, `/curation-k`, "Explore Korea like a Hallyu fan") 추가. KfoodKit 하드코딩을 `services.slice(4).map()` 일반화 → 5번째 이후 full-width 카드 자연 확장. Footer Services 컬럼에도 링크.

### B. /curation-k 페이지 — 기획안 §6 완성형
- **`609b14b`** 초기 구조 (Hero / Coming Soon / 5탭 / Pre-register CTA + 로컬 Toaster). 폼 submit 은 toast + success state, 백엔드 저장 없음 (`// TODO: waitlist API`).
- **`712528c`** Hero 컨테이너 `max-w-[1320px]` + `lg:grid-cols-2` split — 좌측 지도, 우측 제목·CTA.
- **`079a556`** 5탭 카드에 데이터 소스 라벨 (TourAPI · TMDB · Claude AI 등), AI 코스 Pro 배지. 신규 섹션 2개:
  - **Why you'll keep coming back** — 재방문 4카드 (Monthly Pilgrimage / AI Routes / Visit & Share / Fan-Submitted Spots)
  - **Connected to your Hallyu routine** — KdramaMatch / KfoodKit / HangeulGo 연계 3카드

### C. 실사 한국 지도 (Ghost-style SVG)
- **`712528c`** world-atlas `countries-50m` TopoJSON → South Korea (id "410") 폴리곤 fetch → equirectangular projection. 도시 마커도 위경도 → 같은 projection 자동 정렬.
- **`079a556`·`7392878`** 부속 도서 (50m 누락) 명시 — 본토와 동일 outline `<ellipse>` 로 "섬"으로 시각 통합.
- **`8ee3655`** 지도 시각 정리:
  - `SVG_W` 400 → 540 (한국 자연 가로 비율), `aspect-[5/7]` → `aspect-square`.
  - 본토·섬 `fill="none"` (바탕색 제거), stroke 얇게.
  - 부속 도서 `displayLng` inset — 한국 공식 지도 관용. 실제 lng/lat 은 보존.
  - Hero grid `[2fr_1fr]` + 우측 부제 "Korea, mapped for Hallyu fans." 한 줄 (향후 hover 모달 overlay 공간).

### D. 우측 섬 정리 — 사용자 시각 검증 반복
- **`760c6c0`·`3e43094`·`0254584`** 첨부 이미지 비례 매핑으로 울릉·독도 좌표 미세 조정.
- **`29bdb8f`** 우측 섬 3개 보이던 원인 진단 — 50m TopoJSON 의 한국 polygon 에 울릉도가 작은 ring 으로 이미 포함되어 내 명시 Ulleung ellipse 와 중복. 해결: `KOREA_ISLANDS.Ulleung` 에 `labelOnly: true` → 마커 안 그리고 라벨만, 50m polygon 위치 (130.85, 37.5) 옆. Dokdo 만 명시 ellipse 로 그 우하.
- **`e56bfb7`·`125e013`** Dokdo 위치 — 울릉도와 거리 1/3 (SVG 가로 11px / 세로 15px / 직선 ~19px). 705a64a 추가 단축은 revert.

### 다음 세션 후보
- carry-over (세션 5 잔여):
  - Ticketmaster 실데이터 인제스트 재검증 (locale fix 후 cron_logs 메트릭)
  - KOPIS 캘린더 재노출 정책
  - Claude Haiku Yes/No/Uncertain 분류 로직 fan_event_requests 어드민 큐 이식 여부
  - fan_event_requests 제보 폼 / admin 검토 큐 UI 정비
  - Cookie Policy 본문 법무 검토 / Vercel·Supabase 비용 점검
- 이번 세션 신규:
  - **Curation K waitlist API** — `/curation-k` 사전 등록 폼이 현재 토스트만 → 실제 DB 저장 + 출시 시 발송 채널
  - Curation K 지도 hover 모달 — 지역별 정보 카드 띄우는 인터랙션 (페이지 설계 의도)

### 블로커
- 없음

---

## 현재 상태 (2026-05-13~14 세션 5 / 외부 이벤트 API 통합 — KOPIS·Ticketmaster 연동 + Eventbrite 폐기)

> 두 날 걸쳐 HallyuCalendar 외부 이벤트 데이터 인프라 구축. KOPIS·Ticketmaster 연동 완료, Eventbrite·Bandsintown 은 API 정책 변경/ToS 회색지대로 폐기 후 fan_event_requests 사용자 제보 채널로 전환. Featured events 섹션도 Ticketmaster 데이터 기준으로 전면 개편.

### A. SERVICE_ARCHITECTURE.md v1.2 박제
- **`1640234`** 서비스 전체 기획안 v1.2 추가 (5개 서비스 + Curation K M+5 기획, 무상 이용/구독 플랜, 저작권·비용 요약, 출시 로드맵). CLAUDE.md 하단에 참조 한 줄 추가.

### B. KOPIS (한국 내 K팝 공연) ingest
- **`9d3892a`** lib/api/kopis.ts (pblprfr XML→JSON, fast-xml-parser 5.8.0 신규 의존) + lib/ingest/kopis.ts (shcate=AAAA 대중음악, prfstate 01+02 병렬, 6개월 윈도우, mt20id dedupe). app/api/cron/ingest-kopis + vercel cron UTC 06:00 + /admin/cron 카드/manual run 자동 노출.
- **`9bfb125`** 캘린더 API `.neq("source_api", "kopis")` 한 줄 추가 — KOPIS 데이터는 DB·cron 보존하되 캘린더 노출 차단. 향후 재노출 시 한 줄 삭제로 복구.

### C. Ticketmaster (글로벌 K팝 투어) ingest + 디버깅
- **`542e927`** Discovery API v2 events.json 래퍼 — classificationName=K-Pop + keyword=K-pop 2전략 × 3페이지 = 최대 600건. countryCode=KR 수동 제외 (KOPIS 와 중복 방지). pickBestImage (16:9 우선), toIso8601Z. /admin/cron 통합.
- **`8df551d`** 디버그 메트릭 추가 — `.catch()` silent fail 제거, 페이지별 직렬 호출로 에러 명확 캡처. classification_total_elements / keyword_total_elements / with_kpop_classification / dropped_no_date / 단계별 *_error. 두 전략 모두 실패면 명시적 error 반환.
- **`f6d8823`** ⚠️ 진단 결과: `locale: "*,en-us"` 가 Ticketmaster DIS1008 400 BAD_REQUEST. `*` 와일드카드는 마지막 위치에만 허용 — `locale: "en-us,*"` 로 수정. 디버그 메트릭이 없었으면 이 에러가 "유효 이벤트 매칭 없음" success 로 위장돼 계속 묻혔을 것 (silent fail 위험 박제 가치).

### D. Featured events 섹션 — Ticketmaster 데이터 기준 전면 개편
- **`7cc4f89`** API 응답에 sourceApi 포함. Featured 정렬: Ticketmaster 우선 → createdAt desc fallback (Ticketmaster < 6건이면 다른 source 자연 보충). 카드: w-48 3:4 세로 → w-72 16:9 가로. object-contain 으로 TMDB 2:3 포스터 좌우 레터박스 (위/아래 잘림 방지). snap-x snap-proximity + 카드 snap-start (데스크탑 부드러움 + 모바일 카드 단위 스냅).
- **`bf42c46`** `.slice(0, 6)` 제거 → 썸네일 있는 모든 이벤트 노출. useRef + scrollBy(clientWidth) 로 보이는 폭만큼 한 번에 이동 (반응형 자동 적응). 화살표 hidden md:flex + group-hover opacity 로 PC 호버 시에만 노출, 모바일은 기존 터치 스와이프 유지.

### E. Eventbrite + Bandsintown 폐기 결정 + fan_event_requests CTA 강화
- **`fa4e1fd`** DECISIONS.md `2026-05-14 Eventbrite + Bandsintown 인제스트 자동화 폐기` 엔트리. SERVICE_ARCHITECTURE.md 5곳 동시 갱신 (주요국 API 표·결론 블록·1-4 섹션 전면 개편·저작권 표·비용 표). 캘린더 페이지 3줄 텍스트 → 카드형 CTA 배너 (`Spot a Hallyu event in your area?` + Primary `Submit a Fan Event` 버튼). Plus 아이콘 import 추가.

#### 폐기 사유 (DECISIONS.md 참조)
- **Eventbrite**: `/v3/events/search/` deprecated. 외부 organization 이벤트 검색 불가, Partner Program (B2B 계약) 만 가능 — 수개월 소요, SaaS 초기 비현실적.
- **Bandsintown**: "API key per single artist", "broad sweeps over catalog 금지" — 우리 use case (top K-pop 일괄 쿼리) 와 직접 충돌, 키 차단 위험. 한국 시장 커버 약함.
- 글로벌 K-pop 콘서트는 Ticketmaster 단일 소스로 충분 + fan_event_requests 사용자 제보가 본질적으로 더 큐레이션 품질 우위.

### 다음 세션 후보
- carry-over:
  - Cookie Policy 본문 법무 검토
  - ReportButton hydration 룰 적용, /admin/reports 콘텐츠 미리보기
  - Vercel/Supabase 플랜 비용 점검
- 이번 세션 신규:
  - Ticketmaster 실데이터 인제스트 재검증 (locale fix 후 cron_logs 메트릭 확인)
  - KOPIS 캘린더 재노출 정책 결정 (현재 `.neq` 로 차단 중)
  - Claude Haiku Yes/No/Uncertain 자동 분류 로직을 fan_event_requests 어드민 검토 큐에 이식할지 결정 (구 Eventbrite 5단계 필터링의 AI 부분)
  - fan_event_requests 제보 폼 + admin 검토 큐 UI 정비 (CTA 강화 후 유입 대비)

### 블로커
- 없음

---

## 현재 상태 (2026-05-12 세션 4 / 랜딩 히어로 globe 한류 확산 효과)

> 짧은 비주얼 세션. 랜딩 히어로 ghost globe 에 "Seoul → 해외 도시" 호 애니메이션 추가 + Seoul 마커 색 통일.

### A. 한류 확산 호 (great circle 아크)
- **`589d49f`** Seoul 에서 70개 세계 수도로 5초마다 1발씩 핑크 #FF4B6E 호 발사.
  - slerp 로 정확한 great circle 경로 + 포물선 lift, 호 70개 mount 시 사전 계산.
  - 슬롯 풀(동시 최대 3개) imperative 관리 — useState 회피, drawRange 확장 + opacity fade.
  - travel 1.5s + fade 0.8s, 첫 호는 mount 후 ~2초.
  - `prefers-reduced-motion` 시 spawn 차단 / 언마운트 시 geometry dispose.

### B. 시각 다듬기
- **`589d49f`** Seoul 마커 색 `#1E40AF` → `#FF6B85` (호와 동일 핑크 + 약간 밝은 변형). 크기 0.018→0.024, opacity 1.0, 펄스 0.75~1.0.
- 호 곡률: `altitudeFactor` 초기 `0.15+0.35×` 가 너무 높아 화면 이탈 → `0.02+0.06×` 로 표면에 거의 붙음.

### C. 모바일 globe — 시도 후 원복
- **`bba8632`** 모바일에서 globe 가 `-left-[100px]` 로 좌측 클립되어 사실상 안 보이는 문제 인지. 중앙 정렬 + opacity 0.6 으로 변경.
- **`981bd55`** 모바일에선 globe 가 어떻게 배치해도 텍스트와 경쟁하거나 잘려서 효과 노출이 어렵다고 판단, 원래 좌측 클립 배치로 복원. 데스크탑 디자인 우선.

### 다음 세션 후보
- 이전 세션 carry-over 그대로:
  - **DECISIONS.md 박제** (세션 3 굵직한 결정 다수)
  - **Cookie Policy 본문 법무 검토**
  - ReportButton hydration 룰 적용, /admin/reports 콘텐츠 미리보기
  - **Vercel/Supabase 플랜 비용 점검**

### 블로커
- 없음

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
