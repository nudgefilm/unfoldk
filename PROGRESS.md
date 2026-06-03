# PROGRESS.md — 현재 상태 스냅샷

> 세션별 전체 기록 → PROGRESS_2026_05.md / PROGRESS_2026_06.md

---

## 현재 상태 (2026-06-04 세션 49 기준)

### Curation K — My Hallyu Course 전면 개편 (세션 49)

**My Hallyu Course 입력 UI 개편**
- FROM: ip-api.com 3초 타임아웃 IP 위치 감지 → 자동 입력, 감지 실패 시 안내 문구
- TO: City(REGION_OPTIONS 드롭다운) / Keyword(tour_spots 실시간 검색) 탭 전환
  - 탭: 배경 없이 텍스트 컬러만 (`#FF4B6E` 선택 / `rgba(255,255,255,0.35)` 미선택)
  - Keyword 탭: 한글(title) + 영문(eng_title) + 주소(addr1) 동시 검색, placeholder 업데이트
- FROM↔TO 직선거리 Haversine 배지 표시
- Travel Style 버튼 완전 제거 → 고정 안내 문구 교체
- Generate 버튼 하단 재검색 안내 추가

**코스 생성 로직 개선**
- drama_title 필수 필드 제거 (PostSchema, save route, page.tsx 전체)
- LENGTH_CONTENT_TYPES: 1d=숙박제외 / 2d+=전체 카테고리
- `computeAllocations` + `selectByCategory`: 카테고리별 균등 배분 (비율 기반)
- Haversine 반경 필터: 1d=10km / 2d=20km / 3d+=30km (좌표 없는 spot은 통과)
- Fisher-Yates 셔플: 재검색마다 다른 spot 조합
- System prompt: Travel Style 스타일 분기 제거, 하루 최대 5 stops 명시
- max_tokens 증가: 1d=3072 / 2d=4096 / 3d=5120 / 5d=6144 / 7d=7168

**travel_info (출발→목적지 이동 정보)**
- Claude tool schema에 travel_info 필드 추가 (required)
- 교통수단별 포맷(✈️⛴️🚂🚌) + 가격(₩) + 팁(💡🌤️💳🗣️) 생성
- CourseMiniMap 범례 하단 표시: 줄별 스타일 분리 (제목/교통수단 mono/팁)
- 저장 시 enrichedItinerary에 travel_info 포함 (누락 버그 수정)

**코스 저장 개선**
- stop lat/lng 없는 경우 tour_spots eng_title ILIKE 매칭으로 보완 (Promise.all 병렬)
- StopSchema에 lat/lng optional 추가 (Zod strip 방지)

**CourseMiniMap 개선**
- 나침반: 사방 텍스트 → 좌상단 컴팩트 십자+북쪽 pulse 애니메이션
- meta prop 추가: departure≠arrival 시 Day 1 SVG 우상단 직선거리 텍스트
- travel_info prop 추가: Day 1 범례 하단 구분선+멀티라인 표시

**StopNearbyBox (신규)**
- stop 카드 하단: lat/lng 있는 stop마다 주변 2km 내 tour_spots 자동 조회
- 결과 2단 그리드: [type 배지] 장소명 · 거리(m/km)
- nearby-spots route에 POST 핸들러 추가 (bounding box + Haversine 필터, top 10)

**저장 코스 UX**
- 카드 전체 너비 (grid-cols-2 → grid-cols-1)
- 펼칠 때 compact 제거 → 헤더+지도 풀 표시
- ChevronRight → ChevronDown (펼침 방향 표시)

**spot-search 개선**
- lat/lng IS NOT NULL 필터 제거 (좌표 없는 spot도 검색 포함)
- title(한글) ILIKE 추가 → 한글 키워드 검색 지원
- 서버 로깅 추가 (디버깅용)

---

### UI 개선 — KpopStats 탭 / KfoodKit 레시피 랜덤

**KpopStats 탭 개선**
- 탭 스타일 Curation K 기준으로 통일: `inline-flex gap-1.5 px-4 py-2 rounded-full text-xs font-medium border` + inline style 색상 분기
- 활성: `#FF4B6E` 배경+테두리+흰 텍스트 / 비활성: `#1a1a1a` 배경+`rgba(255,255,255,0.1)` 테두리+`rgba(255,255,255,0.7)` 텍스트
- Sticky 고정 `top-[72px]`, 탭 클릭 시 `window.scrollTo({ top: 0, behavior: "smooth" })` — scroll-to-top 버그 수정
- 이모지 span → lucide 아이콘: Charts `BarChart2`, Chart Attack `Flame`
- Chart Attack 비활성 시 `animate-pulse` 빨간 점 진입 유도

**Chart Attack 탭 이모지 전체 교체**
- JSX 내 🔥 7곳 → `<Flame />` 교체 (JS 템플릿 문자열·주석은 이모지 유지)

**KfoodKit 레시피 랜덤 노출**
- `app/api/food/recipes/route.ts`: `.order(created_at)` 제거 → Fisher-Yates shuffle + JS 페이지네이션
- `revalidate = 0` + `force-dynamic`, `MAX_POOL = 1000` 상한

**코딩 원칙 추가**
- `CLAUDE.md §6` 10번: UI 아이콘 lucide-react 기본 채택

---

## 다음 할 일

- [ ] **drama_items migration 0058 실행** (`supabase/migrations/0058_drama_items.sql`)
- [ ] `npx tsx scripts/generate-drama-items.ts --dry-run` 확인 후 실행
- [ ] KpopStats Today's Trending Top 5 → Free / 나머지 상세 → Pro 잠금
- [ ] kpop_albums 초기 수집: `npx tsx scripts/sync-musicbrainz-releases.ts --dry-run` 확인 후 실행
- [ ] KpopStats → HallyuCalendar 컴백 연결
- [ ] filming_spots 어드민 Phase 2
- [ ] 결제 연동 (Lemon Squeezy 재심사 완료 후)

---

## 사용자 액션 필요

**migration 0058** (`supabase/migrations/0058_drama_items.sql`) Supabase SQL Editor 실행 → drama_items 테이블 생성

**migration 0059** (`supabase/migrations/0059_chart_attack.sql`) → chart_attack_votes 테이블

**migration 0060** (`supabase/migrations/0060_kpop_milestone_cache.sql`) → kpop_milestone_cache 테이블

**korean_grammar_cache** (신규):
```sql
CREATE TABLE IF NOT EXISTS korean_grammar_cache (
  phrase_id   text        PRIMARY KEY,
  grammar_text text       NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE korean_grammar_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pro_users_read_grammar_cache"
  ON korean_grammar_cache FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid()
        AND (u.plan_type IN ('monthly', 'annual') OR u.is_admin = true)
    )
  );
```

**migration 0056** (fan_event_requests / hallyu_calendar_events contact_email + registration_link 컬럼):
```sql
ALTER TABLE public.fan_event_requests
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS registration_link text;
ALTER TABLE public.hallyu_calendar_events
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS registration_link text;
```

**migration 0057** (kpop_albums 테이블):
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
ALTER TABLE public.kpop_albums ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.kpop_albums TO anon, authenticated;
GRANT ALL ON public.kpop_albums TO service_role;
CREATE POLICY "kpop_albums_select_all" ON public.kpop_albums FOR SELECT TO anon, authenticated USING (true);
```

---

## 블로커

- Lemon Squeezy 재심사 결과 대기
- top.gg 심사 대기
- r/Korean 포스팅 승인 대기
