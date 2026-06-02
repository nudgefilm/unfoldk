# PROGRESS.md — 현재 상태 스냅샷

> 세션별 전체 기록 → PROGRESS_2026_05.md

---

## 현재 상태 (2026-06-03 세션 44~45 기준)

### KpopStats — Chart Attack 탭 마무리 (세션 45)

**버그 수정**
- Golden Hour 한국어 혼입: `useMemo` → `useEffect+useState` 교체 (SSR 서버 타임존 고정 방지)
  + `toLocaleTimeString("en-US")` 강제 적용 (브라우저 로케일 무관 영문 출력)
- 비로그인 "🔥 Join the Battle": `<Link href="/signup">` → `onSignUp()` 모달 호출로 교체
- Chart Insight 잠금 오버레이 분기: 비로그인 → "Sign up free →" 모달 / Free → "Upgrade →" /pricing

**데이터 기준 정비**
- Fan Power Ranking 투표 버튼: velocity 상위 8 → **chart Top 20 전원** (풀너비 4~5열 그리드)
- Chart Insight 드롭다운: velocity 상위 10 → **chart 20명** (순위 병기)
- Share to Attack: velocity 상위 5 → **chart 상위 10명** (리스너 수 표시)
- Velocity Tracker 기준: **Global Chart Top 20으로 한정** (YouTube 채널 검증된 아티스트만)
  → Fan Power / Chart Insight / Share to Attack 모두 chart 상태 공유로 자동 반영

**Share to Attack 현행 스펙 (확정)**
- Free: `📢 Join the Attack` → 프리셋 고정 문구 → X 바로 열림
- Pro: `🔥 Attack Now` → Claude AI 문구 생성 → 인라인 확인 → Post on X

**미해결 — Velocity "+6/hr 동일" 데이터 이슈**
- 코드 로직 정상, DB 데이터 문제로 추정
- Supabase에서 직접 확인 필요:
  ```sql
  SELECT artist_id, date, youtube_weekly_views
  FROM kpop_stats_daily
  WHERE date >= now() - interval '3 days'
  ORDER BY artist_id, date DESC LIMIT 40;
  ```

---

## 현재 상태 (2026-06-03 세션 44 기준)

### KpopStats — Chart Attack 탭 신설 (세션 44)

**탭 구조**
- `/kpop` 페이지 상단 `📊 Charts` / `🔥 Chart Attack` 탭 네비게이션 추가
- `app/kpop/page.tsx`: `isPro` 상태 추가 (기존 `isLoggedIn`만 있었음)

**Chart Attack 확정 섹션 배열 (① ~ ⑦)**
① 🚨 Alert Zone — rank 11~12 ALMOST THERE / rank 18~20 DANGER ZONE 자동 추출  
  - 수치 표시: "Only [X] listeners away from TOP 10" / "[X] behind safety line"  
  - DANGER ZONE 카드 전체 border `animate-pulse`  
② ⏱ Golden Hour — 브라우저 타임존 자동 감지, 07:00 UTC 현지 시간 변환 표시  
  - 3시간 이내: 텍스트 red 강조 / 1시간 이내: 섹션 border pulse + "FINAL PUSH"  
③ ⚡ Velocity Tracker — YouTube 조회수 시간당 가속 TOP 10  
  - 마운트 시 0 → 실제값 1.5초 카운트업 + 게이지 확장  
④ 🔥 Fan Power Ranking — PopCat 투표 + 낙관적 업데이트 + 파티클 애니메이션  
⑤ 🎯 Chart Insight (Pro 전용) — velocity 상위 10명 드롭다운 → Claude Haiku 예측  
  - `/api/kpop/milestone-predict` 신규 라우트  
  - `kpop_milestone_cache` 테이블 캐시 (6h TTL)  
  - 비Pro: blur + "Unlock with Hallyu Pass" 오버레이  
⑥ 📢 Share to Attack — Free: 프리셋 트윗 / Pro: AI 맞춤 문구  
⑦ ⏱ Next Chart Update — 07:00 UTC 카운트다운 타이머  

**데이터 소스 원칙 확정 (DECISIONS.md 기록)**
- Billboard 크롤링 금지 (법적 리스크)
- 글로벌 차트: kpop_stats_daily lastfm_listeners 재활용
- "Based on Last.fm global streaming data" 출처 표기

**Velocity Tracker 기준 확정 (세션 44 후반)**
- 전체 아티스트 → **Global Chart Top 20 아티스트로 한정**
- Top 20 = youtube_weekly_views 기준 상위 20명 = Charts 탭과 동일한 모수
- 이미 YouTube 채널 매핑이 검증된 아티스트만 포함 → 데이터 신뢰도 확보
- Fan Power Ranking / Chart Insight / Share to Attack 모두 동일 velocity 상태 공유 → 자동 반영
- Chart Attack 탭 전체가 Top 20 중심으로 일관되게 설계됨

**추가 수정 (세션 44 후반)**
- Fan Power / Chart Insight / Share to Attack → velocity 기준 → chart Top 20 기준으로 전환
- Golden Hour 버그 수정: useMemo → useEffect+useState (SSR 서버 타임존 고정 방지), en-US 로케일 고정

**미해결 — Velocity "+6/hr 동일" 데이터 이슈**
- 코드 로직은 정상. youtube_weekly_views 연속 이틀 값이 DB에 동일하게 저장되는 것으로 추정
- Supabase에서 직접 확인 필요:
  ```sql
  SELECT artist_id, date, youtube_weekly_views
  FROM kpop_stats_daily
  WHERE date >= now() - interval '3 days'
  ORDER BY artist_id, date DESC LIMIT 40;
  ```

**사용자 액션 필요**
- Supabase SQL Editor: `supabase/migrations/0059_chart_attack.sql` (chart_attack_votes 테이블)
- Supabase SQL Editor: `supabase/migrations/0060_kpop_milestone_cache.sql` (kpop_milestone_cache 테이블)

**신규 파일**
- `components/kpop/chart-attack-tab.tsx`
- `app/api/kpop/chart-attack/lastfm-chart/route.ts`
- `app/api/kpop/chart-attack/velocity/route.ts`
- `app/api/kpop/chart-attack/votes/route.ts`
- `app/api/kpop/chart-attack/milestone/route.ts`
- `app/api/kpop/chart-attack/share/route.ts`
- `app/api/kpop/milestone-predict/route.ts`
- `supabase/migrations/0059_chart_attack.sql`
- `supabase/migrations/0060_kpop_milestone_cache.sql`

---

## 현재 상태 (2026-06-02 세션 43 기준)

### HallyuCalendar
- Fan Meet 탭 유저 등록 행사 연동 (migration 0056, contact_email/registration_link)
- Fan Meet 스펙 확정: Ticketmaster 외부링크 + 유저 등록 행사 Apply 버튼

### KpopStats
- 메인 Top 20 전면 무료 개방
- 국가별 팬 분포 25개국으로 확대 (기존 10개국)
- kpop_albums 테이블 신설 (migration 0057, MusicBrainz release-group)
- scripts/sync-musicbrainz-releases.ts 초기 수집 스크립트
- cron/ingest-musicbrainz-releases 주간 증분 cron (매주 화요일 05:00 UTC)

### KdramaMatch
- 2026년 드라마 상세 Pro 잠금 (카드 🔒 뱃지 + hover 오버레이 + 업그레이드 모달)

### HangeulGo
- Today's Lesson intermediate/advanced 자동 스킵 → beginner 표현으로 전환
- Explore Expressions 섹션 추가 (Grammar Explanation 아래)
  - /api/korean/phrases 신규 API (페이지당 60건)
  - flex-wrap 6줄 제한, intermediate/advanced hover 🔒, 클릭 → Today's Lesson 로드
- Drama Learning Packs: intermediate/advanced만 Pro 잠금 (beginner Free 보장)
- Intermediate/Advanced 표현 Pro 게이트 모달

### KfoodKit
- "Local Ingredient Matcher" 섹션명 변경 (구 "UnfoldK Ingredient Finder")
- Local Ingredient Matcher + My Shopping List 통합 Pro 잠금 (blur-sm + overlay)
- This Week's K-Food Picks Free 전체 개방 (API 인증 게이트 제거)
- This Week's K-Drama Food Guide Free 전체 개방 (isPro prop 제거)
- Notify me at launch 버튼 → /pricing 이동

### Curation K
- My Hallyu Course Pro 잠금 blur + centered overlay 패턴 통일

### KdramaMatch (세션 39–40 추가)
- Streaming 섹션 로고 이미지 제거 → Play 아이콘 + 텍스트 (깨짐 원천 차단)
- **Shop this drama** 기능 신설
  - `drama_items` 테이블 (migration SQL 별도 실행 필요)
  - `name_ko` / `description_ko` 컬럼 추가 (migration SQL 별도 실행 필요)
  - `scripts/generate-drama-items.ts`: Claude Haiku 아이템 자동 추출 (EN+KO 병행)
  - `app/api/dramas/[id]/shop/route.ts`: 승인된 아이템 공개 API
  - `lib/drama-items/generate.ts`: 공통 추출 로직 (스크립트·Cron 재사용)
  - `app/api/cron/ingest-drama-items/route.ts`: 신규 드라마 대상 주간 자동 생성 Cron
  - vercel.json `"30 6 * * 1"` (ingest-tmdb-dramas 05:30 + 1h)
  - DramaDetailModal 하단 Shop this drama 섹션 (Free: 이름+카테고리, Pro: 링크+브랜드)
  - `name_ko` / `description_ko` 영/한 병기 (Claude 생성 시 동시 생성)
  - max_tokens 800→2000 (한국어 추가로 응답 잘림 수정)
  - `--limit` 없으면 전체 드라마 대상 실행 (기본값 50 제거)

### 어드민 (세션 39 추가)
- `app/admin/users/page.tsx`: 페이지당 50명 페이지네이션 (서버 count 포함 range 쿼리)
- `app/admin/users/page.tsx`: Trial 컬럼 "이탈" 상태 추가 (agreed_to_terms=false + trial_ends_at=null)
- `app/admin/page.tsx`: 데이터 수집 현황 카드 3항목 통일 (총 수집 / 오늘 추가 / 최종 업데이트)
- `app/admin/drama-items/page.tsx`: Shop this drama 어드민 검수 페이지 신설
  - 미승인/승인/삭제/구매링크 입력, 페이지당 20개 페이지네이션
  - 카테고리 영문 뱃지, 드라마명 영/한 병기, 아이템명·설명 영/한 병기

### KdramaMatch (세션 41 추가)
- Browse All 드라마명 검색 입력창 추가 (`?q=` 파라미터, 400ms 디바운스, URL 동기화, X 버튼 초기화)

### Curation K (세션 39–41 추가)
- K-Pop Pilgrimage Sites / Who fans love in 카드 AuthGate 적용
- My Hallyu Course Notify me → /signup
- Festivals 탭 proLocked: true 전환 (Free → Pro)
- `/api/curation-k/stats` 캐시 제거 → 히어로 수치·지도 호버 실시간 반영
- `lib/ingest/tour-spots.ts` existing 조회 페이지네이션 버그 수정 (1,000행 cap 우회)
- IN THE DATABASE 7개 카테고리 전체 표시 (Filming/Attractions/Food/Stays/Shopping/Culture/Festivals)
- 지도 도시 호버 툴팁 Shopping 추가 → 7개 통일
- Travel Style 5종 개편: Filming Tour(43) / Sightseeing(1907) / Foodie(1823) / Cultural(1167) / Shopping(735) — DB 실제 건수 칩 표시
- `fetchContext` style별 content_type_id 분기 (filming→[12,14,39], shopping→[38,39,12] 등)
- My Hallyu Course 코스 생성 결과 하단 **CourseMiniMap** 동선 다이어그램 추가
  - `report_itinerary` tool stop에 lat/lng 필드 추가 (Claude 좌표 반환)
  - SVG 560×220 순수 구현 (외부 지도 API 없음), 기존 Curation K 다크 스타일 동일
  - 격자 배경 + 한국 주요 지역 38개 배경 레이블 (bounding box 안 자동 필터)
  - 핑크 번호 핀(①②③) + 점선 동선 연결 + 하단 범례
  - 다일 코스 Day 탭 전환, 좌표 없는 경우 자동 숨김

### KdramaMatch (세션 42 추가)
- Browse All 검색창 `?q=` URL 동기화, 400ms 디바운스, X 초기화 (세션 41에서 이어짐)
- **Shop this drama** 섹션 Explore more 아래로 이동 + 카테고리 그룹핑 (fashion/beauty/lifestyle)
- Shop this drama fetch 에러 로그 추가
- shop API `createSupabaseServerClient` → `createSupabaseAdminClient` 전환 (RLS 우회, 500 오류 수정)
- **`0058_drama_items.sql` migration 추가** (테이블 미생성이 500 오류 근본 원인)
- Shop this drama 구매 링크 없는 아이템: "링크 준비 중" → 비활성 "Link" 텍스트

### 어드민 (세션 42 추가)
- `app/admin/drama-items/page.tsx`: **전체 일괄 승인** 버튼 추가 (헤더 우측, 미승인 0건 자동 숨김)
  - 클릭 → 확인 모달 (미승인 건수 명시) → Promise.all 병렬 처리

### Curation K (세션 43 추가)
- **My Hallyu Course 5일/7일 코스 생성 오류 수정** (`app/api/curation-k/course/route.ts`)
  - `max_tokens` 2048 고정 → 일수별 동적 예산 (1d:2048 / 3d:4096 / 5d:6144 / 7d:8192)
  - `fetchContext` DB limit: `area_codes * 12` → `area_codes * max(12, days*8)` 확장
  - Claude context 스팟 수도 `tourContextLimit = max(24, days*8)` 로 확장
- **My Hallyu Course 저장 버그 수정** (`app/api/curation-k/course/save/route.ts`)
  - `travel_style` zod enum 구버전(`relaxed/packed`) → 현행(`filming/sightseeing/foodie/cultural/shopping`) 통일
  - filming·sightseeing·shopping 스타일 코스 저장 불가 상태였음 (foodie·cultural만 저장 가능)

### Curation K (세션 42 추가)
- **CourseMiniMap 대규모 개선** (세션 41→42 연속 작업)
  - Travel Style 5종 DB 건수 칩 표시 + 기본값 filming으로 변경
  - 핀 사이즈 절반(R=5), 겹침 방지 force-directed 알고리즘
  - 서울 구 경계선 8개 (opacity 0.15, 0.8px)
  - 전국 강 7개 (한강 3.5px 곡선, 낙동강·수영강·금호강·영산강·소양강·남대천)
  - 지역명 레이블 대폭 확장: 부산 4개·제주 4개·강원 3개·경주 5개·전주·광주·대전·대구·인천 등 총 70개+
  - 부산 5개 구 경계선 + 제주 섬 외곽선 (12점 폴리곤) 추가
  - 부산 동·남해안선, 강원 동해안선 (opacity 0.20~0.25 곡선)
  - 경주·전주·광주·대전·대구·인천 외곽 사각형 + 중심 도로선 (opacity 0.15)
  - 제주 섬 외곽 opacity 0.35, strokeWidth 2.0 (명확한 섬 윤곽)
  - 핀 옆 장소명 전체 표시 (말줄임표 제거), 우측/하단 오프셋 자동 전환
  - 동서남북 N/S/E/W 나침반 레이블 (opacity 0.40)
  - `smoothPath()` 함수로 강·해안선 곡선 처리
  - `DISTRICT_BOUNDARIES` 통합 (서울+부산+제주), `COASTLINE_PATHS`, `CITY_FEATURES` 신설

### 비로그인 접근 정책 (세션 39 추가)
- `components/auth-gate.tsx` 툴팁 문구 콤마 수정, 위치 카드 중앙으로 통일
- Calendar Subscribe/iCal → StartModal 오픈 (비로그인 정상 진입)
- KpopStats Track this artist → StartModal, Artist Comparison Sign in → StartModal
- KdramaMatch Drama Summary Notify me / Sign in to track → AuthGate
- HangeulGo 팩 카드 전체 / Grammar Notify me / Explore 표현 칩 → AuthGate
- KfoodKit Ingredient Matcher / Shopping List Notify me → AuthGate
- KfoodKit DramaFoodGuideSection → AuthGate 적용
- Curation K 잠긴 탭 버튼 (AuthGate), My Hallyu Course Notify me (AuthGate)
- HallyuCalendar Concert/Fan Meet 탭 AuthGate
- /signup 폐기 페이지 → StartModal 패턴으로 전면 교체

### HangeulGo (세션 39 추가)
- Explore Expressions 6줄→30개(~10줄), 랜덤 셔플 + 클라이언트 페이지네이션

### 공통
- Free/Pro 확정 스펙 전 서비스 CLAUDE.md 기록
- Trial Banner: 비로그인 상태 노출 버그 수정 (isLoggedIn 명시적 상태 추가)
- 전 서비스 페이지 상단 여백 통일: pt-28 pb-12 (KpopStats 기준)

---

## 다음 할 일

- [ ] **drama_items migration 0058 실행** (Supabase SQL Editor — `supabase/migrations/0058_drama_items.sql`)
- [ ] `npx tsx scripts/generate-drama-items.ts --dry-run` 확인 후 실행
- [ ] KpopStats Today's Trending Top 5 → Free / 나머지 상세 → Pro 잠금
- [ ] kpop_albums 초기 수집: `npx tsx scripts/sync-musicbrainz-releases.ts --dry-run` 확인 후 실행
- [ ] KpopStats → HallyuCalendar 컴백 연결
- [ ] filming_spots 어드민 Phase 2
- [ ] 결제 연동 (Lemon Squeezy 재심사 완료 후)

---

## 사용자 액션 필요

- **migration 0058** (`supabase/migrations/0058_drama_items.sql`) Supabase SQL Editor 실행 → drama_items 테이블 생성 → Shop this drama 정상 작동

---

## 블로커

- Lemon Squeezy 재심사 결과 대기
- top.gg 심사 대기
- r/Korean 포스팅 승인 대기

---

## 사용자 액션 필요

**migration 0056** — Supabase SQL Editor 실행:
```sql
ALTER TABLE public.fan_event_requests
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS registration_link text;
ALTER TABLE public.hallyu_calendar_events
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS registration_link text;
```

**migration 0057** — Supabase SQL Editor 실행:
```sql
CREATE TABLE IF NOT EXISTS public.kpop_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.kpop_artists(id) ON DELETE CASCADE,
  mbid text NOT NULL,
  title text NOT NULL,
  release_date date,
  type text NOT NULL CHECK (type IN ('album', 'single', 'ep')),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artist_id, mbid)
);
CREATE INDEX IF NOT EXISTS idx_kpop_albums_artist_release ON public.kpop_albums(artist_id, release_date DESC);
CREATE INDEX IF NOT EXISTS idx_kpop_albums_release_date ON public.kpop_albums(release_date DESC);
ALTER TABLE public.kpop_albums ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.kpop_albums TO anon, authenticated;
GRANT ALL ON public.kpop_albums TO service_role;
CREATE POLICY "kpop_albums_select_all" ON public.kpop_albums FOR SELECT TO anon, authenticated USING (true);
```
