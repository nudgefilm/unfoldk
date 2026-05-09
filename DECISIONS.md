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

## 2026-05-09 어드민 이벤트 description 자동 생성 — 안전 모드 (`generateSafeEventDescription`)

- 결정 내용:
  - **`lib/claude/generate-event-description.ts` 안에 별도 함수 `generateSafeEventDescription` 추가** — 같은 파일·같은 패턴 유지하되 SYSTEM_PROMPT 분리.
  - 시그니처 `(artistOrDrama, type, eventDate)` — title 안 받음. 어드민 입력 title 은 사실 검증 안 됐으니 프롬프트에서 사용 금지.
  - **사실 미검증 정보 강력 금지**: 앨범명·노래명·장소·가격·에피소드 수·투어명·줄거리. 프롬프트에 enumerate 해 모델이 적극적으로 회피하도록.
  - **폴백 문구 강제**: "Check official channels for details." 또는 "See official sources for the latest info." — 이게 1~2 문장의 두 번째 문장으로 항상 들어감. 사용자가 "X의 Y 이벤트입니다. 자세한 내용은 공식 채널을 확인하세요." 패턴으로 명시한 안전 톤.
  - **POST/PATCH 양쪽 통합**:
    - POST: description 빈 채로 들어오면 자동 생성 후 insert
    - PATCH: description 이 명시적 빈 문자열·null 일 때만 자동 생성. body 에 description 필드 자체가 없으면 변경 안 함 (기존 값 유지).
    - PATCH 자동 생성 시 artist_or_drama/type/event_date 가 body 에 없으면 DB SELECT 로 채움 — 부분 수정 케이스 견고화.
- 이유:
  - **인제스트 vs 어드민 입력 신뢰도 차이**: 인제스트 source title 은 외부 API 가 검증한 실제 영상·드라마 메타데이터 → 마케팅 카피 자유롭게 가능. 어드민 수동 입력 title 은 검증 안 됨 → 같은 톤으로 생성하면 환각 위험 (예: "BTS의 신곡 X 가 발매됩니다" 인데 X 가 가짜).
  - **별도 함수 vs 옵션 매개변수**: 옵션은 호출 측이 매번 정확히 지정해야 하는 부담 + 실수 위험. 별도 함수는 의도가 함수 이름에 박힘 → 어드민 코드에서 잘못된 함수 호출 시 lint 단계에서 즉시 보임.
  - **PATCH 의 "부분 수정 + DB 보강" 패턴**: 어드민이 "description 만 비웠어요" 케이스에도 자동 생성이 작동해야 함. body 에 description 만 보낸 경우 artist/type/date 는 DB 에 있는 기존 값으로 자동 생성. 사용자 마찰 0.
- 대안으로 고려했던 것:
  - **단일 함수에 mode 매개변수 추가** (`mode: "rich" | "safe"`): cache_control 키가 SYSTEM_PROMPT 통째로 잡혀 캐시 효과 분리되긴 하나 의미는 같음. 단 호출 측 호출 시 매번 mode 명시 필요 — 누락 위험. 별도 함수가 더 안전.
  - **PATCH 자동 생성 안 함** (POST 만 처리): 어드민 흐름 일관성 깨짐. 수정 화면에서도 description 비우면 자동 생성이 직관적.
  - **title 도 프롬프트에 포함**: 사용자 명시 "아티스트명, 이벤트 유형, 날짜만 기반". title 은 어드민이 임의로 적은 문자열이라 사실 검증 안 됨 → 모델이 title 의 단어를 진실로 받아들여 환각할 위험 → 프롬프트에서 의도적으로 제거.
  - **폴백 문구 강제 안 함**: 사용자 명시 패턴이 "공식 채널 확인하세요" 마무리 — 강제하면 톤이 약간 단조롭지만 신뢰도 일관 + 사용자가 자동 생성된 것임을 자연스럽게 인지.

## 2026-05-09 YouTube 자동 인제스트 운영 정책 — 현 상태 유지 + 어드민·신고로 보완

- 결정 내용:
  - YouTube 자동 인제스트의 일별 upsert 0~1건 결과를 **자연스러운 운영 상태**로 받아들이고 추가 보강 작업 보류
  - 보완 경로:
    - 어드민 수동 입력 (`/admin/events` events-manager — 이미 구현됨)
    - 유저 신고 시스템 (`PROGRESS.md` 다음 세션 후보 — HallyuCalendar 이벤트부터 우선 구현)
  - 기존 `hallyu_calendar_events` 의 youtube=10건은 어드민에서 옛날·오매핑 영상 수동 삭제
- 이유:
  - production 데이터로 검증 — 미래 `scheduledStartTime` 후처리 검증이 정확히 작동(BTS·BLACKPINK·HUNTR/X·ENHYPEN 의 옛날·오매핑·끝난 라이브 모두 차단). upsert 적은 건 검증 강한 결과지 누락 아님.
  - K-pop 공식 컴백이 YouTube Premiere 로 예약되는 비율이 낮음 — 자동 인제스트 자체의 구조적 한계. 시드 확장이나 검증 완화로 해결 안 됨.
  - **유저 신고가 더 가치 있음**: 자동 검증으로 못 막는 케이스(예: HUNTR/X 같은 동음이의)가 실제 운영에서 노출되면 유저가 즉시 발견 → 어드민 수정. 자동화 정확도를 ROI 안 맞게 끌어올리는 것보다 신고 루프가 효율.
- 대안으로 고려했던 것:
  - **B안: YouTube 시드 15 → 50명 확장**: raw hits 양은 늘지만 미래 검증을 못 통과하면 upsert 0건 결과 동일. 가치 없음.
  - **C안: Soompi RSS / AllKpop / MusicBrainz 등 추가 인제스트 소스**: 출처 신뢰도 검증·파싱·rate limit 모두 새 부담. 어드민 수동 + 신고 시스템 ROI 우위.
  - **검증 완화로 더 많이 통과시키기**: 이미 시도해봤음 — 9건 통과했지만 모두 옛날·오매핑·끝난 라이브. 데이터 신뢰도 훼손.

## 2026-05-09 YouTube query 완화 — `"k-pop" 제거`, 미래 검증만 유지

- 결정 내용:
  - `searchUpcomingComebacks` 의 query 정교화를 한 단계 완화:
    - `${artistName} k-pop comeback` → `${artistName} comeback`
  - 미래 `scheduledStartTime` 후처리 검증은 그대로 유지
- 이유:
  - 정교화 직후 ingest-all 재호출 결과: HUNTR/X 'Hunter x Hunter' 오매핑 / ENHYPEN 옛날 vlive 모두 차단 ✅, 단 **BTS·BLACKPINK·ATEEZ 정상 컴백도 0건**. 직전 호출에서 잡히던 BTS "arirang comeback live!" 같은 영상이 새 query 에 매칭 안 됨.
  - 영상 제목에 `"k-pop"` 단어가 직접 포함되는 컴백 영상이 드뭄 — `"comeback"` 만으로도 동음 매칭 상당 부분 거를 수 있고, 미래 검증이 옛날 라이브 차단 책임을 단독으로 감당.
  - 직전 호출에서 ENHYPEN 2021 vlive 가 "ENHYPEN comeback" 검색에 잡혔는데 미래 검증으로 events 배열에 안 들어감 — 미래 검증의 효과가 단독으로도 강력함을 production 데이터로 확인.
- 대안으로 고려했던 것:
  - **`"k-pop"` 유지하되 채널명 검증 추가** (HYBE LABELS, JYP Entertainment 등 공식 채널 화이트리스트): 정확도 더 높지만 화이트리스트 유지 부담 + 신생 아티스트·인디 그룹 누락. 단순 `"comeback"` + 미래 검증으로 충분.
  - **현재 상태 유지하고 며칠 관찰**: 데이터 수집 미발생 = 사용자 가치 0. 즉시 완화가 합리적.
  - **`"k-pop"` 대신 `"M/V"` 또는 `"official"` 키워드**: M/V 는 잘 매칭되지만 컴백 티저·라이브 빠짐. official 도 한정적. `"comeback"` 단일 키워드가 가장 폭 넓음.

## 2026-05-09 YouTube 컴백 검색 정교화 — query 보강 + 미래 scheduledStartTime 검증

- 결정 내용:
  - **검색 query 정교화** — `searchUpcomingComebacks(artistName)` 내부에서 `"<artist> k-pop comeback"` 자동 부착.
    - 시그니처도 `query: string` → `artistName: string` 으로 의미 명확화
    - 호출 측(`lib/ingest/youtube.ts`)은 단순 아티스트 이름만 넘김 — 정교화 책임을 API 래퍼로 이동
  - **미래 검증 후처리** — `new Date(scheduledStartTime).getTime() > Date.now()` 인 영상만 events 배열에 포함.
    - YouTube API 의 `eventType=upcoming` 분류가 가끔 옛날 vlive·라이브를 포함하는 케이스 차단
  - **`YoutubeSearchResult.withScheduledTime` 의미 재정의** — "scheduledStartTime 보유 건수" → "미래의 scheduledStartTime 보유 건수". console.log 도 `withScheduledTime(future)=N` 으로 명시.
- 이유:
  - **production `ingest-all` 트리거 결과 진단**: 9건 upsert 中 HUNTR/X → 'Hunter x Hunter' 애니메이션 오매핑 / ENHYPEN 2021 옛날 vlive 오분류 발견. 단순 query (`"<name> comeback"`) 와 미래 검증 부재가 주원인.
  - **"k-pop" 키워드 추가**: 동음이의 영상(애니메이션, 게임 livestream 등)을 1차로 거르고, K-pop 카테고리에 가까운 결과로 한정.
  - **호출 측이 아닌 라이브러리 내부에서 정교화**: 함수 이름이 `searchUpcomingComebacks` — 컴백 검색 전용. query 정교화 책임이 라이브러리 측에 있는 게 의미상 일관. 호출 측이 매번 같은 prefix 를 붙이는 패턴은 누락 위험.
  - **`withScheduledTime` 의미 변경 vs 새 카운터 추가**: 후자가 더 명확하지만 인터페이스 확장 시 호출 측·db·로그 모두 갱신 필요. 의미만 자연스럽게 좁혀도 0 = 미래 컴백 0건 으로 일관 — 단순 변경 채택.
- 대안으로 고려했던 것:
  - **호출 측에서 query 정교화**: `lib/ingest/youtube.ts` 만 수정. 다만 `searchUpcomingComebacks` 의 다른 사용처가 생기면 같은 정교화 누락 가능 → 라이브러리 내부 캡슐화가 안전.
  - **`q` 에 `kpop|comeback|teaser` OR 표현 사용**: YouTube search 가 OR 연산자를 공식 지원하지 않음. 일반 키워드 추가가 단순.
  - **검색 후 title 매칭 (regex)**: false positive 더 줄지만 한국어 / 영문 컴백 표기 다양성에 robust 하지 않음. 1차 query 정교화 + 미래 검증으로 충분 — 추가 케이스 발견되면 그때 보강.
  - **`withScheduledTime` 외에 신규 `inFuture` 카운터 추가**: 의미 분리는 깔끔. 단 인터페이스 변경 = 운영 가시성·로그 형식 영향. 의미 좁히기로 충분.

## 2026-05-09 KpopStats — youtube_channel_id 자동 매핑 (`searchChannelByName`)

- 결정 내용:
  - **시드의 `youtube_channel_id` 채우기를 어드민 수동 입력 → cron 자동 매핑으로 전환**
  - `lib/api/youtube.ts::searchChannelByName(query)` 추가:
    - `search.list { type: ["channel"], q: query, maxResults: 1 }` 호출
    - 1위 채널의 `id.channelId` (또는 `snippet.channelId`) 반환
    - 매칭 0건이면 `null` 반환 — **오매핑 방지** (NULL 유지)
    - 100 units/call 비용 (10,000/일 한도)
  - `lib/ingest/kpop-stats.ts` 단계 1.5 신규:
    - 활성 아티스트 中 `youtube_channel_id` NULL 만 검색 — **멱등성 (이미 있으면 skip)**
    - 5명씩 병렬 청크 (Last.fm 청크 패턴과 동일 — rate 보호)
    - 매칭 성공 시 `kpop_artists.update` + **메모리 객체도 즉시 갱신** → 같은 cron 의 후속 `channels.list` 호출에 활용
    - `KpopStatsIngestResult` 에 `channelsAutoMapped` 필드 추가 (운영 가시성)
  - **기존 cron (`/api/cron/ingest-kpop-stats` 매일 07:00 UTC) 에 자동 포함** — 별도 라우트·트리거 안 만듦
- 이유:
  - **사용자 부담 제거**: 25명 채널 ID 수동 매핑은 사용자 시간 소모 + 입력 오류 가능성. cron 자동화로 운영 마찰 0.
  - **첫 회 1회만 비용**: 매핑 후 channel ID 가 DB 에 박혀서 다음 cron 부터 search 호출 0. 25명 모두 NULL 일 때 첫 회 2,500 units (한도 25%) 만 소모.
  - **`null` 반환 정책 (오매핑 방지)**: 검색 결과가 없거나 모호한 케이스에서 임의의 채널을 강제 매핑하면 잘못된 통계가 누적 → 아티스트별 stats 신뢰도 훼손. NULL 유지하면 어드민이 수동 보정 가능.
  - **메모리 객체 즉시 갱신**: 같은 cron 안에서 매핑 → channels.list → stats upsert 가 한 번에 끝남. 다음 cron 까지 기다릴 필요 없음.
- 대안으로 고려했던 것:
  - **별도 cron 라우트(`/api/cron/map-kpop-channels`)**: vercel cron 슬롯 1개 추가 사용 + 동일 작업이 두 단계로 나뉨. 같은 `ingest-kpop-stats` 안에 통합이 단순.
  - **검색 결과 N개 후보 중 어드민이 선택하는 UI**: 정확도 우위지만 어드민 워크플로 추가. 1위 자동 매핑 + null fallback 으로 충분 — 잘못된 매핑은 어드민에서 수동 교정.
  - **Last.fm `artist.getInfo` 의 `mbid` (MusicBrainz ID) → YouTube 매핑**: 정확도 더 높지만 multi-hop 호출 + rate limit. MVP 에 부담.
  - **시드 단계에 채널 ID 미리 박기 (마이그레이션)**: 25명 채널 ID 사람이 한 번에 검수. 시드 25명 → 50명 → 100명 확장 시 매번 사람 손 — 자동화가 확장성 우위.

## 2026-05-09 4개 서비스 페이지에 Pro 잠금 해제 적용 — 공통 패턴 박제

- 결정 내용:
  - 직전 결정(`lib/auth/plan.ts`) 의 적용 범위를 잠금/블러 영역이 있는 모든 서비스 페이지로 확장.
  - **공통 적용 패턴**:
    - `useState(false)` 로 `isPro` 상태 도입 (페이지 단위)
    - 마운트 시 `supabase.auth.getUser()` → `users.select("plan_type, is_admin")` → `setIsPro(hasProAccess({ planType, isAdmin }))`
    - 블러는 className 조건부 토글: `${isPro ? "" : "blur-[Npx] pointer-events-none"}`
    - Upgrade overlay 는 mount 조건부: `{!isPro && (<overlay/>)}`
  - **페이지별 분기 처리**:
    - drama / korean / food: 단순 패턴 (블러 div + 오버레이 div 한 쌍)
    - **calendar 4 분기 통합**:
      - `handleTabClick`: Pro 면 `lockedTabs` 우회
      - 탭 자물쇠 표시: `isLocked = !isPro && lockedTabs.includes(tab)`
      - Artist Tracking Banner 자체 mount 조건부 (`!isPro` 일 때만)
      - Upcoming events 4번째 블러: `isBlurred = !isPro && index >= 3`
      - Blur Upsell Overlay: `!isPro && upcomingEvents.length > 3`
- 이유:
  - **단일 패턴 박제**: 페이지마다 잠금 영역의 형태가 다양한데(블러 div, 오버레이, 탭 자물쇠, 배너, 4번째부터 블러), 모두 `isPro` 단일 상태로 통합해야 향후 확장(예: 'lifetime' 플랜)이나 정책 변경 시 한 곳에서 관리.
  - **블러는 className 조건부, 오버레이는 mount 조건부**: 블러는 콘텐츠가 항상 DOM 에 있어야 layout shift 없이 자연 (Pro 면 그대로 노출). 오버레이는 mount 자체를 제거해야 클릭 가로채기가 사라짐 — 두 패턴 차이를 의도적으로 유지.
  - **calendar Banner 미노출 vs 텍스트 변경**: "3/3 artists" 라는 사실관계 자체가 Free 한도. Pro 면 무제한이라 배너 자체가 부적절 → 통째로 mount 안 함.
  - **drama 의 mock 콘텐츠 노출**: Pro 시 블러가 풀리면 "Crash Landing on You - Episode Analysis" 같은 mock 텍스트가 그대로 노출됨. 실제 AI Summary 기능은 미구현 상태이지만 사용자 요구는 "잠금/블러 판별 로직만 수정". 향후 실제 AI 결과로 교체할 때 동일한 위치·구조 유지하므로 노출 형태 유지가 일관.
- 대안으로 고려했던 것:
  - **잠금 컴포넌트(`<ProGate>`) 추출**: blur+overlay+isPro fetch 를 하나의 wrapper 로 묶기. 코드 줄임은 가능하지만 페이지마다 잠금 영역의 구조(탭, 배너, 그리드 등)가 달라 wrapper 가 복잡해짐. 페이지 단위 인라인 패턴이 가독성 우위.
  - **`useUserPlan()` 훅 추출**: 4개 페이지가 거의 동일한 useEffect (auth + plan/admin select) 를 가짐. hook 으로 묶을 가치 있음. 단 이번 커밋 범위 밖 — 다음 리팩터로 분리.
  - **calendar Banner 텍스트만 "Unlimited artists" 로 변경**: Pro 인지 표시는 되지만 UI 점유는 그대로. 미노출이 더 깔끔.

## 2026-05-09 Pro 잠금 판별 통일 + is_admin 우대 — `lib/auth/plan.ts`

- 결정 내용:
  - **`lib/auth/plan.ts` 신규 — 유틸 3개**:
    - `hasProAccess({ planType, isAdmin })`: 종합 판별. **일반 서비스 잠금 분기는 무조건 이 함수만 사용**.
    - `isProPlan(planType)`: plan_type 만 (admin 무시). 결제·관리 UI 처럼 admin 우대가 부적절한 곳 한정.
    - `normalizePlanType(value)`: DB 값 → `"free" | "monthly" | "annual"` 정규화.
  - **`is_admin = true` 유저는 plan_type 무관 Pro 접근권 보장** (사용자 명시 요구). free 플랜 어드민이라도 모든 서비스 개방.
  - **인라인 비교 9곳 → 유틸 호출로 통일**: `monthly || annual` 산재 패턴이 향후 변경 시 누락 위험. 한 함수에서 관리.
  - **적용 범위 (5개 파일)**:
    - 서비스 페이지/API: `app/api/dramas`, `app/api/dramas/recommend`, `app/kpop`, `app/api/calendar/events`
    - calendar 는 RLS 가 plan_type 게이팅 처리 → 어드민 우대를 위해 **service role 클라이언트로 우회** (Pro 유저는 RLS 자동 통과라 분기 불필요)
  - **수정하지 않은 파일** (의도적):
    - `/mypage/subscription`: 결제 상태 UI 분기. 어드민이라도 결제 안 했으면 Free UI 가 사실관계상 맞음.
    - `/mypage`, `/mypage/fan-events`: 사이드바 plan 라벨은 정확한 사실 표시.
    - 결제·관리·가입 라우트들 (lemonsqueezy/*, complete-signup, apply-coupon, admin/*): plan 분기 자체가 잠금이 아닌 결제·관리 흐름.
- 이유:
  - **annual 누락 우려 — 점검 결과 0건**. 모든 잠금 분기가 이미 `monthly || annual` 둘 다 체크 중이었음. 사용자 우려는 합리적이었으나 실제 갭은 없었음.
  - **진짜 갭은 어드민 우대**: 운영 중에 어드민 계정으로 사이트 점검할 때 free 플랜이면 일반 서비스 잠금이 발동. UnfoldK 운영자가 본인 계정으로 모든 서비스 동작 확인하려면 plan_type 변경하거나 코드 우회 필요했던 상태.
  - **`hasProAccess` 단일 진입점**: plan_type 비교 로직이 향후 변경(예: 'lifetime' 플랜 추가, 'trial' 분기) 시 한 곳만 수정하면 모든 사이트 자동 반영. 현재 9곳 인라인 패턴은 부분 수정 위험.
  - **calendar service role 우회 vs RLS 정책 수정**: 후자가 더 깔끔하지만 SQL migration 필요해 별도 작업으로 분리. 코드 우회는 즉시 동작.
- 대안으로 고려했던 것:
  - **RLS 정책에 `is_admin=true` 분기 추가**: SQL migration 으로 모든 보호 테이블(events, coupons, fan_event_requests 등) 일괄 처리 가능. 별도 SQL 작업이라 이번 세션에 미포함 — `별도 작업 권장`으로 PROGRESS 박제.
  - **`subscription_status === 'active'` 도 함께 검증**: cancel 후 expires 까지 race window 에서 잠금 해제되는 구멍. 단 유예 기간 정책(즉시 잠금 vs 만료일까지 노출) 미결정. 현 시점 결정 보류, 향후 `hasProAccess` 에 status 인자 추가 가능하게 시그니처 확장 여지 남김.
  - **`/mypage/subscription` 의 `isPaid` 도 `hasProAccess` 로 교체**: 어드민이 free 라도 Hallyu Pass UI 표시 = 사실관계 왜곡. 결제 페이지는 plan_type 직접 비교가 의도적으로 맞음 — `isProPlan` 또는 직접 비교 유지가 정답.

## 2026-05-09 webhook subscription_expired + subscription_payment_success 핸들러 추가

- 결정 내용:
  - **`subscription_expired`** 핸들러: `plan_type='free'` + `subscription_status='expired'`. `subscription_cancelled` 와 status 값만 다름 (`canceled` ↔ `expired`).
  - **`subscription_payment_success`** 핸들러: `plan_expires_at` 추정 갱신.
    - payload 가 **invoice 객체** (`data.type='subscription-invoices'`) — `subscription_id` 와 `created_at` 보유, `renews_at` 없음.
    - `users` 테이블에서 `plan_type` 조회 → `created_at + 1month`(monthly) 또는 `created_at + 1year`(annual) 로 추정.
    - `subscription_updated` 가 LMS 측에서 함께 발송될 때 정확한 `renews_at` 로 덮어씀 — 정확도 부족분이 자동 보정.
  - **`InvoiceAttributes` 인터페이스 분리**: `SubscriptionAttributes` 와 별도. `WebhookData.attributes` 타입은 `OrderAttributes & SubscriptionAttributes & InvoiceAttributes` 인터섹션.
  - **유저 식별 우선순위 유지**: `meta.custom_data.user_id` → `lms_subscription_id` lookup (기존 패턴 동일).
- 이유:
  - 두 이벤트 모두 LMS 대시보드에 어제 체크돼 있었으나 코드 핸들러 없어 default 분기로 흘러감 — 운영 동기화 갭. 사용자가 어제 권장한 6개 이벤트 중 우리 코드가 처리 안 하던 둘.
  - **`subscription_payment_success` 정확도 부족 허용 이유**: LMS 가 결제 성공 시 `subscription_updated` 도 거의 동시에 발송. updated 핸들러가 정확한 `renews_at` 로 덮어쓰므로 최종 DB 값은 정확. payment_success 단독 처리 시점의 며칠 오차는 실제 노출 영향 미미.
  - `InvoiceAttributes` 분리: invoice 와 subscription 객체는 LMS 측에서 다른 type. 인터페이스를 합치면 의미 흐려져 디버깅 어려워짐.
- 대안으로 고려했던 것:
  - **SDK `getSubscription(subscriptionId)` 호출**: 정확한 `renews_at` 즉시 확보. 추가 LMS API 호출 비용 + 구현 복잡도 + rate limit 위험. `subscription_updated` 안전망이 충분해 보류.
  - **`subscription_payment_success` 에서 `plan_expires_at` 갱신 안 함** (subscription_updated 에 위임): 단순하지만 사용자 명시 요청("plan_expires_at 갱신") 반영 못 함. 사용자 의도 우선.
  - **`subscription_expired` 와 `subscription_cancelled` 합치기**: status 값 차이만으로는 통합 가치 미미. 분리 유지가 LMS 측 원본 이벤트와 1:1 대응 — 디버깅·로그 추적에 유리.

## 2026-05-09 Lemon Squeezy Switch Plan — updateSubscription + webhook 동기화

- 결정 내용:
  - **Switch Plan 라우트 분리**: `/api/lemonsqueezy/switch` 신규. 기존 `/checkout` 은 신규 결제 전용으로 유지.
    - 기존 구독자(monthly ↔ annual 전환) → SDK `updateSubscription(subscriptionId, { variantId })` 로 기존 구독 prorate 변경.
    - 미구독자가 실수로 switch 라우트 진입한 경우 → `/checkout` 으로 자동 위임 (fallback).
  - **DB 동기화는 webhook 이 담당**: switch 라우트는 LMS API 호출만 하고 DB 직접 갱신 안 함. `subscription_updated` 이벤트가 plan_type/plan_expires_at 동기화. 이중 갱신·race 방지.
  - **variant_id → plan_type 매핑은 env 관리**: `LEMONSQUEEZY_VARIANT_ID_MONTHLY=1628505`, `LEMONSQUEEZY_VARIANT_ID_ANNUAL=1628480`. 코드 하드코딩 금지.
  - **webhook 신규 3 case**:
    - `subscription_created`: order_created 가 이미 처리하므로 보강 로그만
    - `subscription_updated`: Switch Plan / 관리자 변경 / variant 교체 동기화 — variant_id 로 plan_type 재매핑, `ends_at`(취소 예정) 우선·없으면 `renews_at`(다음 결제일) 으로 plan_expires_at 갱신
    - `subscription_resumed`: cancel 이후 재구독 시 plan_type 복구
  - **`SubscriptionAttributes` 인터페이스 확장**: `variant_id`, `renews_at`, `ends_at` 추가.
  - **유저 식별 우선순위 유지**: `meta.custom_data.user_id` → `lms_subscription_id` lookup (기존 패턴 동일).
- 이유:
  - 기존 Switch Plan UI 가 `/checkout` 으로 redirect 했던 패턴은 LMS 가 새 구독을 추가 생성 → 한 유저가 월간·연간 둘 다 청구되는 **이중청구 발생**. `updateSubscription` 은 단일 구독을 prorate 변경해 이 문제 원천 차단.
  - DB 갱신을 라우트가 아닌 webhook 에 위임하면 LMS 가 단일 진실의 원천(SoT). LMS API 호출은 성공했는데 우리 DB write 가 실패한 케이스가 발생해도 webhook 후속 이벤트(또는 자동 retry)로 재시도 가능.
  - **variant ID env 관리**: KRW → USD 전환 시 LMS 가 variant 를 새로 발급할 가능성 — 코드 재배포 없이 env 만 수정해 대응 가능. 현재 LMS 심사 대기 중이라 이 유연성이 즉시 가치 있음.
  - `ends_at` 우선: 취소 예정 상태가 항상 UI 에 먼저 노출돼야 사용자가 인지 가능.
- 대안으로 고려했던 것:
  - **switch 라우트에서 DB 도 즉시 갱신**: UI 가 즉시 새 plan 표시 가능하지만, race 발생 시 webhook 과 충돌. 신뢰성 우선으로 webhook 단일 갱신 채택.
  - **variant ID 코드 상수화**: 단순하지만 USD 전환 시 코드 변경 + 재배포 필요. env 관리가 운영 민첩.
  - **Switch Plan UI 에서 confirm modal**: MVP 단계 단순화 위해 즉시 LMS 호출. LMS 측 prorate 정책이 변경 시 자동 반영.
  - **`subscription_created` 도 plan_type 재활성화 로직 추가**: order_created 와의 race 위험 + 중복 갱신 의미 없음. 보강 로그로만 두는 게 깔끔.

## 2026-05-09 백필 결정 7건 (당시 박제 누락분)

> ⚠️ 2026-05-08~05-09 사이에 내려진 결정들이 그때 DECISIONS.md 에 기록되지 않아 회고 박제. 본 블록은 메타 안내이고, 실제 결정은 아래 7개 항목으로 분리 기록.

## 2026-05-09 migration 0012 unique 제약 idempotent 화 + 함수 index 폐기

- 결정 내용:
  - `kpop_artists.name` 에 함수 unique index `(lower(name))` 대신 일반 unique constraint 사용.
  - 기존 함수 unique index 는 `drop index if exists` 로 정리 (부분 실행 환경 클린업).
  - 시드 insert 의 `on conflict on constraint <이름>` → `on conflict (name)` 컬럼 inference 로 변경.
  - 전체를 DO block 으로 감싸 멱등 보장.
- 이유:
  - `create unique index ... on (lower(name))` 는 INDEX 일 뿐 CONSTRAINT 가 아니라 `on conflict on constraint` 가 첫 실행 시 매칭 실패(42704 에러). 부분 실행 후 재시도해도 같은 위치에서 깨짐.
  - 대소문자 dedup 가 명목상 목적이었지만, 시드 25명을 사람이 입력하므로 정규화는 코드(앱 레이어) 책임으로 옮김.
  - DO block 멱등성은 다른 마이그레이션과 패턴 통일.
- 대안으로 고려했던 것:
  - 함수 unique index 유지 + `on conflict` 절을 `where lower(name) = lower(EXCLUDED.name)` upsert 로 우회: 시드만 가능하고 일반 INSERT 는 여전히 어색.
  - 시드 자체를 어드민 입력으로 옮기기: MVP 단계에 부담 — 25명 핸들 채우기 자동화가 쉬움.

## 2026-05-09 KpopStats (M+1) — DB·인제스트·공개 API·어드민 구조

- 결정 내용:
  - **DB**: `kpop_artists` (id, name, lastfm_name, youtube_channel_id, image_url, is_active) + `kpop_stats_daily` (artist_id, date, total_views, weekly_views, lastfm_listeners, lastfm_playcount). RLS: artists read 는 anon+auth (is_active 한정), stats_daily 동일. write 는 service_role.
  - **인제스트 전략**: YouTube `channels.list` 50명/call (1 unit) — 25명 시드면 1 call. Last.fm `artist.getInfo` 는 N call(병렬 6 limit). weekly_views 는 `now()` total_views 와 7일전 row 의 total_views 차이로 계산.
  - **시드**: 25명 lastfm_name 만 채워 두고 youtube_channel_id 는 NULL → 어드민이 `/admin/kpop` 에서 입력. 채널 ID 검증은 단건 Refresh 버튼으로 즉시 확인.
  - **공개 API plan-based 노출**:
    - `/api/kpop/artists` — 활성 목록 + 검색(q) + 최신 stats join, 비회원 5 / 로그인 10 / 유료 20
    - `/api/kpop/artists/[id]` — 상세 + 30일 히스토리
    - `/api/kpop/charts` — weekly_views 정렬 + 7일전 비교로 rank_change
  - **UI 분기**: `/kpop` 비회원 Top 5 / Free Top 10 / 유료 Top 20. spotlight 는 클릭 시 30일 트렌드 SVG (별도 차트 라이브러리 없이 path 직접). Pro 잠금 overlay 는 유료 유저에게 숨김.
  - **YouTube GCP 프로젝트**: HallyuCalendar 와 동일한 UnfoldK 전용 GCP 프로젝트 재활용 (CLAUDE.md §8 명시 — tubewatch.kr 와 분리).
- 이유:
  - YouTube `channels.list` 가 50명/call 1 unit 으로 매우 효율적 — 일일 10,000 unit 한도에 비하면 무시 가능. 다른 cron 들과 합산해도 전체 사용률 < 20%.
  - weekly_views 를 매번 계산하지 않고 stats_daily 에 미리 저장: 차트 API 가 단순 select + sort 로 끝남, P95 latency 안정.
  - 비회원/Free/유료 단계가 KdramaMatch 추천 API(anon 6/free 12/paid 100) 와 의도적 일관: 사용자가 plan upgrade 동기를 모든 서비스에서 동일한 형태로 경험.
- 대안으로 고려했던 것:
  - 차트 API 가 stats_daily 매 query 마다 7일전 비교 SQL: 인제스트 시점 1회 계산 vs API 시점 N회 — 후자는 read 부하.
  - YouTube 시드를 lastfm 트렌딩으로 자동: 계정 매핑 정확도가 낮아 어드민 검수 단계 필수 → 수동 입력으로 결정.
  - Top 50 까지 노출: 데이터가 25명뿐이라 의미 없음. 시드 확장 후 재논의.

## 2026-05-09 /mypage/subscription — plan_type 분기 + Switch Plan 양방향

- 결정 내용:
  - 사이드바 mock("Mia T.") 제거 → Google `full_name` + avatar_url. avatar 없으면 이니셜 fallback.
  - Free 유저 화면: "You're on the Free plan" + 업그레이드 카드 2개(Monthly $15 / Annual $120) + 쿠폰 보유자용 `/redeem` 안내.
  - 유료 유저 화면: Active 카드 + Switch Plan **양방향**(자기 플랜은 Current 라벨, 반대편은 Switch 버튼) + Billing History (mock 유지).
  - planExpiresAt 있을 때만 "Active until / Cancel after" 표시.
  - Billing History 는 LMS API 동기화 미구현 — v0 mock 유지 (spec).
- 이유:
  - 기존엔 mock 으로 모든 유저에게 Hallyu Pass Active 가 보여 전환율·신뢰성 양쪽 손상. plan_type 분기는 Lemon Squeezy 도입 직후 우선순위 1.
  - Switch Plan 양방향은 v0 디자인이 한 방향(annual 전용)만 그려 둔 상태였는데, 사용자 직접 요청으로 monthly→annual / annual→monthly 모두 대칭화. UI 클래스/스타일 무변경 원칙 준수.
- 대안으로 고려했던 것:
  - Billing History 도 LMS `getOrders` 로 채우기: webhook 만으로 충분히 동기화 가능하지만 페이지네이션·실패 복구가 추가 작업 — Phase 5 후속으로 분리.
  - Switch 버튼 클릭 시 confirm modal: MVP 단계에선 즉시 LMS 결제 페이지 이동으로 단순화 (LMS 호스팅 페이지에서 한 번 더 확인 받음).

## 2026-05-08 결제 — Stripe → Lemon Squeezy 전환 (CLAUDE.md §2 정정)

- 결정 내용:
  - **CLAUDE.md §2 의 "결제는 반드시 Stripe 사용. TossPayments 사용 금지" 규정을 Lemon Squeezy 로 변경.**
  - `@lemonsqueezy/lemonsqueezy.js` 4.0.0 채택. SDK 초기화 + 체크아웃 URL 빌더 + 호스팅 결제 페이지 redirect.
  - Webhook: HMAC-SHA256 raw body 서명 검증(timingSafeEqual). 처리 이벤트 — `order_created`(plan_type 활성화 + LMS ID 저장) / `subscription_cancelled`(plan_type='free') / `subscription_payment_failed`(Resend 안내 메일).
  - DB: migration 0011 — `users.lms_customer_id / lms_subscription_id / lms_order_id` 컬럼 추가.
  - 회원가입 진입(`/start`)이 Free→/mypage, 유료→/api/lemonsqueezy/checkout 으로 분기. complete-signup 은 항상 plan_type='free' 락인(webhook 이 결제 시 업그레이드).
  - 운영 환경변수: `LEMONSQUEEZY_API_KEY` / `LEMONSQUEEZY_STORE_ID` / `LEMONSQUEEZY_WEBHOOK_SECRET` / `NEXT_PUBLIC_LMS_MONTHLY_URL` / `NEXT_PUBLIC_LMS_ANNUAL_URL`.
- 이유:
  - **Merchant of Record (MoR) 모델**: Lemon Squeezy 가 글로벌 세금(VAT/GST/sales tax)·인보이스·환불을 모두 대신 처리. UnfoldK 는 영어권+동남아 타깃이라 국가별 세무 컴플라이언스가 Stripe 직접 결제 대비 압도적으로 단순.
  - **계정 셋업 속도**: Stripe 한국 계정은 사업자등록·대표자 검증 등 며칠 단위. Lemon Squeezy 는 즉시 가능 → MVP 출시 일정에 부합.
  - **호스팅 체크아웃 페이지 기본 제공**: Stripe Checkout 도 비슷하지만 LMS 는 추가 설정 없이 도메인·로고·약관까지 한 번에. 개발 시간 절약.
  - **수수료**: LMS 5% + 50¢/거래 vs Stripe 2.9% + 30¢ + (글로벌 세무 별도 처리 비용). MoR 비용 포함 시 LMS 가 비슷하거나 우위.
- 대안으로 고려했던 것:
  - **Stripe + Stripe Tax**: 세무 자동화 가능하지만 별도 구독($120+ 부터)·국가별 등록 의무 잔존. MoR 가 아님.
  - **Paddle**: LMS 와 유사한 MoR. 신청 심사 더 길고 한국 셀러 승인 속도 약함.
  - **TossPayments**: CLAUDE.md §13 에 "해외 유저 경험 불량" 으로 이미 제외. 변동 없음.

## 2026-05-08 쿠폰 시스템 + 팬 행사 승인 자동 발급

- 결정 내용:
  - **DB**: migration 0009 — `coupons` 테이블 (code unique, plan_type, granted_to user_id, granted_for fan_event_request_id, used_at, expires_at) + `users.plan_expires_at`.
  - **RLS**: 본인 사용 쿠폰만 select, admin 전체 read/update, insert/delete 는 service_role 전용.
  - **코드 형식**: 8자리 `XXXX-XXXX` (0/O/I/1 제외 — 손글씨/OCR 혼동 방지). DB unique 충돌 시 자동 재시도.
  - **이메일 발송**: Resend HTML+text. 브랜드 컬러(#FF4B6E) + 사용 안내(`/redeem`).
  - **승인 라우트 흐름**: 캘린더 이벤트 등록 → 쿠폰 발급 → 이메일 발송. 각 단계 실패해도 승인 자체는 유지하고 warning 누적(승인을 롤백하면 어드민이 재처리해야 하는 부담).
  - **`/api/auth/apply-coupon`**: code 정규화(toUpperCase) + 조건부 update(used_at IS NULL AND granted_to = ?) 로 동시 적용 차단.
  - **`/redeem` 페이지 신설**: v0 subscription UI 보존을 위해 별도 페이지로 분리(subscription 페이지 안에 redeem 폼 끼워넣으면 v0 디자인 변형 발생).
  - **운영 환경변수**: `RESEND_API_KEY` + `RESEND_FROM_EMAIL`. 도메인 verify 전엔 `onboarding@resend.dev` 우회 가능.
- 이유:
  - 팬 행사 승인 = 쿠폰 발급 = 플랜 무료 부여 → 이 3단계가 자주 누락되면 운영 불편. 자동화 + 부분 실패 허용 패턴이 운영 리스크 최소.
  - 사용자/admin/service_role 3단 RLS 는 0001 init 부터의 패턴과 일관.
  - 코드에 0/O/I/1 제외는 사용자가 음성 안내·수기 입력 시 흔히 혼동 — 발급량 감소 미미.
- 대안으로 고려했던 것:
  - 쿠폰을 별도 promo_codes 와 redemption_log 두 테이블로 분리: 감사·여러 명 사용 케이스에 유리. 1인 1회 사용 모델이라 단일 테이블로 충분.
  - Resend 대신 Supabase Auth email templates: 트랜잭션 마케팅 메일 분리·템플릿 자유도 위해 Resend 유지.
  - Stripe 쿠폰 기능 사용: 결제수단을 LMS 로 전환했으므로 사용 불가 + 자체 발급 시스템이 더 유연.

## 2026-05-08 AI 이벤트 한 줄 설명 — Claude Haiku 4.5 인제스트 통합

- 결정 내용:
  - `lib/claude/generate-event-description.ts` — Haiku 4.5 호출. system prompt 에 cache_control: ephemeral 부착(현재 ~600 토큰 → Haiku 캐시 임계값 4096 미만이라 silent no-op, 추후 프롬프트 확장 시 자동 활성).
  - `lib/ingest/{tmdb,youtube}.ts` 가 upsert 직전 `Promise.all` 로 Claude 호출 병렬 실행. Claude 실패 시 source description (TMDB overview / YouTube 영상 설명) fallback.
  - `lib/ingest/lastfm.ts` 는 이벤트 직접 생성 안 하므로 변경 없음.
  - 어드민 events-manager + 캘린더 EventDetailModal 에 description 한 줄 노출.
  - migration 0008: description 컬럼 idempotent 보장 (0001 에 이미 존재했음 — 0008 은 안전망).
  - **비용 최적화** (후속 commit `cbdafb3`): 기존 description 있는 이벤트는 Claude 호출 skip — 재인제스트 시 같은 이벤트에 중복 호출 방지.
  - `@anthropic-ai/sdk` 0.95.1 설치.
- 이유:
  - TMDB overview / YouTube 영상 설명은 너무 길고 마케팅 톤이 일관되지 않음. Haiku 한 줄 요약으로 캘린더 카드에 적합한 hook 텍스트 생성.
  - cache_control 사전 부착은 향후 프롬프트가 4096 토큰을 넘기면 자동으로 캐시 hit 되는 free upgrade — 비용·지연 양쪽 보험.
  - 인제스트 시 1회 호출 + DB 저장 → 페이지 노출은 캐시된 결과로 제로 코스트.
- 대안으로 고려했던 것:
  - 페이지 렌더 시점 호출: 첫 방문에 latency 추가 + 비용 폭증 가능성. 인제스트 시 사전 생성이 안전.
  - GPT 등 타 모델: CLAUDE.md §2 가 Claude API 로 확정(Haiku 4.5). 일관성 유지.
  - 사람이 직접 작성: 인제스트가 매일 수십~수백 건 → 비현실적.

## 2026-05-08 인증 플로우 개편 — Start 단일화 + 약관 동의 분리

- 결정 내용:
  - **진입점 통합**: "Log in" / "Try for Free" → 단일 "Start" 버튼. Header(데스크톱·모바일), Hero, CTA 모든 자리에서 동일한 `StartModal` 트리거.
  - **StartModal**: Google OAuth 진입만 담당. 신규/기존 분기는 **callback 에서** `users.agreed_to_terms` 조회로 결정.
  - **신규**: `/start` 페이지로 이동 → 플랜 선택(Free/Monthly/Annual) + 약관 동의 → `/api/auth/complete-signup` 이 plan_type/agreed_to_terms/agreed_at 업데이트.
  - **기존**: callback 의 next 파라미터로 직진 (`/mypage` 또는 deep link).
  - **migration 0007**: `users.agreed_to_terms boolean` + `agreed_at timestamptz`. 기존 유저는 `agreed_to_terms=true` 로 백필(이미 가입한 사람을 재동의 강제하면 UX 폭격).
  - **`/login`, `/signup` 폐지**: 둘 다 `/` 로 자동 리디렉트만 수행. 외부에서 들어오는 옛 링크 호환.
- 이유:
  - 한국·영어권·동남아 모두에서 "Login vs Sign up" 분리 UI 가 컨버전 깎는 원인 — Stripe Atlas/Linear 등 최신 SaaS 가 Start 단일화로 통일된 패턴.
  - 약관 동의를 가입 폼에서 분리하면 Google OAuth 직후 한 번만 받게 돼 신규 유저 전환 단계가 줄어듦.
  - callback 에서 agreed_to_terms 조회로 분기: 신규/기존 판별을 DB 스냅샷으로 결정 → OAuth metadata 만으로 분기하는 fragile 한 방식 회피.
- 대안으로 고려했던 것:
  - 기존 /signup 폼 유지 + 약관 체크박스만 분리: 진입점 두 개 유지로 컨버전 분산. Start 단일화 효과 못 봄.
  - agreed_to_terms 필드 없이 raw_user_meta_data 사용: trigger 로 자동 백필이 어렵고, RLS 에서 직접 참조하기도 불편.
  - 신규 가입자에게도 `/mypage` 즉시 노출 + 약관은 모달: 약관 미동의 상태로 데이터 적재되는 시간 발생 → 법무 리스크.

## 2026-05-08 HallyuCalendar M+0 Phase 4 — 어드민 시스템

- 결정 내용:
  - **DB**: migration 0005 — `users.is_admin boolean`(기본 false), `fan_event_requests`(신청 폼 데이터 + status enum + admin_note + proof_url), `cron_logs`(route, started_at, finished_at, status, scanned, upserted, errors). RLS 8개 정책.
  - **권한 모델**: 환경변수 화이트리스트 대신 **`users.is_admin` 플래그** 채택. SQL 한 줄로 부여/박탈 가능, 다중 어드민 확장 자연.
  - **middleware**: `/admin/*` 가드 — 미로그인→`/login`, 비관리자→`/`(접근 거부 토스트 표시).
  - **`/admin` 5페이지**: 대시보드(MRR/MAU 카드), 유저 관리(검색·플랜·is_admin 토글), 이벤트 CRUD(수동 등록·편집·삭제), 팬 행사 승인·거절, Cron 모니터(수동 실행 프록시 + 최근 로그).
  - **`/api/admin/*` 5라우트** + `requireAdmin` 헬퍼(중복 체크 제거).
  - **footer ©를 진입점**으로 wrap: 어드민 진입을 일반 사용자에게 노출하지 않으려 footer 저작권 표기를 클릭 영역으로 사용.
  - **cron 라우트 instrumentation**: 기존 ingest-all/send-reminders 가 실행 결과를 `cron_logs` 에 기록. 어드민 Cron 페이지에서 실패·성공 패턴 가시화.
- 이유:
  - 환경변수 화이트리스트는 신규 어드민 추가/박탈 시 배포 필요 — DB 플래그가 운영 민첩.
  - footer ©를 진입점으로 사용: 일반 사용자에게 admin 링크 노출하지 않고도 직관적 진입 가능. URL 직접 입력도 함께 지원.
  - cron_logs 는 send-reminders 발송 실패 추적·인제스트 0건 알림 등 운영 관측에 즉시 활용.
- 대안으로 고려했던 것:
  - 환경변수 `ADMIN_EMAILS` 화이트리스트: 신뢰성 있지만 운영 민첩성 부족.
  - Supabase Dashboard 만 사용 + 어드민 페이지 미구현: 비기술 스태프가 사용 못 함. 팬 행사 승인 같은 워크플로는 UI 필수.
  - `/admin` 진입을 `?admin=1` 쿼리 토글로: 보안 effect zero, footer 진입이 더 단순.

## 2026-05-09 KdramaMatch (M+2) — 데이터·API·UI 연동

- 결정 내용:
  - **DB**: `0014_kdrama_match.sql` — `dramas`, `user_watchlist` 두 테이블. RLS: dramas read 는 anon+authenticated (is_active 한정), watchlist 는 본인 행만. 0013 service_role GRANT 패턴 동일 적용.
  - **인제스트 소스**: TMDB `discover/tv?with_origin_country=KR` 1~3페이지 + `tv/top_rated` 1~2페이지(KR 후처리 필터) → tmdb_id dedup 후 `tv/{id}` 상세 조회로 episode_count·status·genre 보강. 동시 호출 6개 제한.
  - **`platform` 필드**: TMDB `watch/providers` 가 region 별 + 호출 추가라 무거움. 일단 NULL 로 두고 추후 별도 인제스트 (M+2 release 시점에 결정).
  - **`genre` 필드**: TMDB `genres[0].name` 을 `normalizeGenre()` 로 UI 5개 옵션(Romance/Thriller/Comedy/Fantasy/Historical) 으로 매핑. 매칭 안 되면 원본 보존.
  - **`rating`**: TMDB `vote_average` (0~10) 를 5점 척도로 환산해 저장 (소수점 1자리).
  - **Cron 슬롯**: 별도 라우트 `/api/cron/ingest-tmdb-dramas` 매일 UTC 05:30 추가. 현재 vercel.json 에 cron 4개 — Hobby 플랜은 2개 한도라 Pro 가입 가정. (한도 도달 시 ingest-all 통합 검토)
  - **공개 API 노출 한도**:
    - `/api/dramas` GET — anon 6 / free 12 / paid 100 (offset 페이지네이션)
    - `/api/dramas/recommend` POST — anon 6 / free 12 / paid 30 (Claude 토큰 비용 보수적)
    - `/api/dramas/watchlist` 전체 메서드 — 로그인 필수, RLS 가 본인 행 보장
  - **추천 로직**: Claude Haiku 4.5 — 1차 DB 필터(60건 후보) → Claude 가 ranking + reason JSON 반환 → 검증·매핑. Claude 실패/파싱 실패 시 fallback (genre 일치 + rating 정렬). cache_control: ephemeral 부착(현재 프롬프트는 임계 미만이지만 향후 확장 대비).
  - **UI 연동**: `app/drama/page.tsx` Mock 제거. className/style/DOM 무변경 원칙 — DramaCard 의 Plus 버튼만 `<Link href="/login">` → `<button onClick>` 로 교체(로그인 검사 후 watchlist POST 또는 /login redirect). 포스터 이미지는 `<img>` 추가하되 placeholder `<span>` 은 그대로 유지.
  - **next.config.mjs**: `image.tmdb.org` remotePatterns 추가. `images.unoptimized: true` 라 `<Image>` 대신 `<img>` 사용.
- 이유:
  - watch/providers 미연동: region 별 응답이라 K-드라마 1편당 호출 N회 필요. 현재 Hobby 쿼터 부담 + UnfoldK 영어권/동남아 타깃이라 region 결정 자체가 정책 이슈. 출시 전 별도 결정.
  - rating 환산: UI 가 5점 척도 ⭐로 표현. TMDB 0~10 스케일 그대로 저장하면 표현 시 매번 환산 필요해 저장 시점에 통일.
  - Claude fallback: 추천은 핵심 기능이라 외부 의존성 실패 시에도 동작해야 함. genre 매칭 + rating 정렬은 단순하지만 0건 노출은 막음.
  - watchlist API 가 join 으로 drama 정보 동시 반환: UI 가 별도 호출 없이 카드 그릴 수 있도록 — 라운드트립 절감.
- 대안으로 고려했던 것:
  - **MyDramaList API 동시 연동**: CLAUDE.md §8 에 명시된 M+2 소스지만 키 신청에 수일 소요. TMDB 단독으로 MVP 기능 충분 → MDL 은 출시 직전 보강.
  - **Claude 없이 DB-only 추천**: 비용 0원이지만 mood(감정 키워드) 매칭이 약함. Claude 호출은 추천 1회당 ≈$0.001 — 일 1,000건 가정 시 월 $30 미만으로 허용 가능.
  - **Cron 통합 (ingest-all 에 합치기)**: Hobby 한도 회피책이지만 인제스트 스텝 수가 늘어 `maxDuration: 300` 한도 위협. 별도 라우트 + Pro 가정이 안전.
  - **`platform` 채우기**: TMDB watch/providers 1회 호출로 평균 region 1개 platform 만 사용 — 정확도 낮고 region 결정도 미정. 추후 작업으로 분리.

## 2026-05-09 신규 테이블 추가 시 service_role GRANT 의무화 (인시던트 회고)

- 결정 내용:
  - 모든 신규 마이그레이션은 `public` 스키마에 테이블/시퀀스/함수를 만든 직후 `service_role` 에 명시적 GRANT 를 추가한다.
  - `migration 0013_service_role_grants.sql` 로 누락된 GRANT 를 보강하고, `alter default privileges in schema public ... to service_role` 로 향후 신규 객체에도 자동 부여되도록 박제.
  - `app/admin/users/page.tsx` — service_role 조회 실패 시 빈 배열로 fallback 하지 않고 화면 상단에 배너로 가시화 (code/message/hint 합쳐 노출). 동일 패턴을 다른 어드민 페이지에도 점진 적용.
- 이유:
  - 인시던트: `/admin/users` 가 빈 화면 → 추적 결과 service_role 이 `public.users` SELECT 권한 없어 PostgREST 가 403 (code 42501) 반환. JS SDK 가 PostgrestError 를 `error.message=""` 로 마스킹해 `console.error` 만 찍히고 페이지는 0행 fallback 으로 정상처럼 보임.
  - 신규 발급된 Supabase publishable/secret 키 시스템에선 옛 service_role 자동 bypass 가 보장되지 않음 — 명시 GRANT 가 사실상 표준.
  - 같은 사고가 새 테이블(KpopStats, fan_event_requests, coupons 등) 추가할 때마다 반복 가능 → default privileges 로 일괄 처리.
- 대안으로 고려했던 것:
  - 페이지마다 `try/catch` + `error.code === "42501"` 분기: 어드민 페이지 N개에 보일러플레이트만 늘어남.
  - service_role 대신 RPC SECURITY DEFINER 함수로 우회: GRANT 를 함수 레벨로 옮기는 표면적 해결.
  - Dashboard 에서 GRANT 만 한 번 박고 끝: DB 리셋·신규 테이블 추가 시 재발 — 거부.

## 2026-05-08 HallyuCalendar M+0 Phase 3.5 — 리마인더 영속화 + Resend D-Day 알림

- 결정 내용:
  - **DB**: `0004_reminder_sent_flags.sql` — `user_calendar_subscriptions` 에 `sent_d7/sent_d1/sent_dayof` boolean 컬럼 추가 (default false). 별도 `user_reminders`/`reminder_sends` 테이블 생성 안 함 — 토글이 이미 한 행에 있으니 같은 행에 sent 플래그 두는 게 단순.
  - **API**: `app/api/calendar/reminders/route.ts`
    - `GET ?event_id=` — 로그인 사용자의 해당 이벤트 리마인더 설정 (없으면 모두 false 디폴트)
    - `POST { event_id, remind_d7, remind_d1, remind_dayof }` — upsert. `notification_enabled` = OR. sent 플래그는 안 건드림.
    - 인증은 `createSupabaseServerClient` 의 `auth.getUser()` 로, RLS 가 본인 데이터 보장.
  - **Cron**: `app/api/cron/send-reminders/route.ts`
    - UTC day window `[D, D+1)` 으로 D-7 / D-1 / D-0 이벤트 조회 → 알림 켠 비발송 구독자 → Resend 발송 → `sent_*=true` 업데이트
    - 발송 실패와 플래그 update 실패를 분리 로깅 (후자는 다음 cron 에서 중복 발송 가능성)
    - `Promise.all` 로 3 kind 병렬, 내부 이벤트 루프는 직렬 (Resend rate 보호)
  - **인제스트 리팩토링**: `lib/ingest/{tmdb,youtube,lastfm}.ts` 로 로직 추출. 기존 라우트 3개는 thin wrapper 로 유지하고, 신규 `app/api/cron/ingest-all/route.ts` 가 동일 함수를 차례로 호출.
  - **vercel.json**: cron 슬롯 2개로 압축 (Hobby plan 한도)
    - `/api/cron/ingest-all` 04:00 UTC
    - `/api/cron/send-reminders` 09:00 UTC (= KST 18:00)
  - **EventDetailModal**: 로그인 시 `GET /api/calendar/reminders` 로 초기화, 토글 변경 시 300ms debounce 후 POST. 비로그인 사용자가 토글 클릭하면 `/login?redirect=/calendar` 로 이동.
- 이유:
  - sent 플래그를 같은 행에 두면 cron 쿼리가 join 없이 `eq(remind_X, true).eq(sent_X, false)` 한 줄로 끝나 단순. 감사 로그가 필요하면 Phase 3.6 에 별도 `reminder_sends` 도입 가능.
  - UTC 윈도우 기준 — cron 이 09:00 UTC (= KST 18:00) 에 돌아 그 시점의 "오늘 UTC 날짜"로 D-N 계산. 사용자가 KST 라 약간의 경계 케이스가 있지만 MVP 로 허용.
  - Resend `from` 형식 `"HallyuCalendar <noreply@unfoldk.com>"` — display name 포함해 인박스에서 브랜드 인식.
  - 인제스트 로직 추출은 ingest-all 재활용 + 단위 테스트 가능성 + 라우트 파일은 인증 어댑터 역할만 분리.
- 대안으로 고려했던 것:
  - `reminder_sends` 별도 로그 테이블: 멱등 dedup 와 감사에 우월하지만 MVP 에는 과해 보류.
  - cron 을 KST 자정 기준으로 맞추기 위해 `Asia/Seoul` 변환: UTC 윈도우 한 줄로 처리하는 단순함을 우선.
  - ingest-all 단일 라우트로 통합하고 기존 3개 라우트 삭제: 사용자 지시(개별 라우트 유지)에 따라 미실행. 디버깅·수동 트리거 편의도 같이 유지됨.

## 2026-05-08 HallyuCalendar M+0 Phase 3 — Auth (Google + 이메일, Apple 제거)

- 결정 내용:
  - **Apple OAuth 제거** (관리자 결정): 웹 전용 MVP 단계라 Apple Sign In 의무 없음, Apple Developer 연 $99·private email relay 복잡도 절약
    - login/signup 페이지의 "Continue with Apple" 버튼·SVG·Link 블록 전체 삭제
    - privacy/page.tsx 영·한 4곳에서 "Google/Apple OAuth" → "Google OAuth"
  - **middleware.ts** (프로젝트 루트): Supabase 세션 자동 갱신 + `/mypage` 가드
    - matcher 에서 `_next/static`·이미지 제외
    - 미로그인 + `/mypage/*` → `/login?redirect=...` 리디렉트
  - **app/api/auth/callback/route.ts**: OAuth code → session 교환
    - 성공 시 `/mypage` (또는 `?next=`)
    - 실패 시 `/login?error=auth` 또는 `?error=missing_code`
  - **login 페이지**: Google `signInWithOAuth` + 이메일 `signInWithPassword`
    - `redirectTo: ${origin}/api/auth/callback`
    - 성공 시 `router.push('/mypage')` + `router.refresh()` (RSC 캐시 무효화)
  - **signup 페이지**: Google + `signUp({ email, password, options.data: { plan, billing } })`
    - validation: 약관 미동의 → "Please agree...", 비밀번호 불일치 → "Passwords do not match"
    - 기존 `<Link href="/verify-email"><Button></Link>` 구조 → `<div><Button onClick></div>` (form scope 변화 최소화)
    - plan/billing 정보는 raw_user_meta_data 로 전달 (Stripe webhook 이 후일 public.users 갱신)
  - 기존 `lib/supabase/{browser,server}.ts` 그대로 사용 (사용자 plan 의 `client.ts` 명칭과 무관 — Phase 1 에 이미 생성됨)
- 이유:
  - middleware 에서 `getUser()` 호출이 세션 갱신을 트리거 — Supabase SSR 공식 패턴
  - `router.refresh()` 없으면 새 세션 쿠키를 RSC 가 인지 못 해 `/mypage` 가 여전히 미인증으로 보일 수 있음
  - signUp 시 plan/billing 을 `data` 에 넣으면 `auth.users.raw_user_meta_data` 에 저장 — public.users 트리거가 name/avatar 만 읽지만, 후일 Stripe 결제 webhook 에서 plan_type 업데이트 시 활용 가능
  - Link → button 변경은 §15 에 따라 v0 영역 수정으로 분류 — 사용자 명시 요청이라 진행
- 대안으로 고려했던 것:
  - Apple OAuth 유지 (Phase 3 에서 함께 구현): MVP 비용·복잡도 증가, App Store 미배포 단계라 우선순위 낮음
  - middleware 가드 제거하고 클라이언트에서만 redirect: SSR 보호 누락, 보안 약함
  - signUp 직후 자동 로그인 후 `/mypage` 이동: 이메일 인증 강제 흐름이 깨짐 — `/verify-email` 안내 페이지로 보내는 기존 흐름 유지

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

