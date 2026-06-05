# PROGRESS_2026_06.md — 2026년 6월 세션 기록

---

## 세션 50 (2026-06-05)

### UnfoldK Beauty (kbeauty) MVP 1차 개발

- KBEAUTY.md v4.1 확정, beauty_ 프리픽스 테이블명 반영
- `app/kbeauty/` P01·P02·P05·P06 4개 페이지 + layout.tsx 배포
- `components/header.tsx` HIDE_HEADER_PREFIXES `/kbeauty` 추가
- `middleware.ts` kbeauty role 가드 (supplier/buyer/admin 분리)
- migration 0061~0064: 6개 테이블 생성, 연락처 필드 추가, anon INSERT 정책
- `app/api/kbeauty/verify-business/route.ts`: 국세청 nts-businessman API 연동
- 공급사 폼 beauty_suppliers INSERT + 대시보드 리다이렉트
- 바이어 폼 beauty_buyers INSERT (즉시 active/stage1_approved) + 대시보드 리다이렉트
- 웹사이트 인풋 https:// prefix UI (공급사·바이어 공통)
- Business Type 라디오 → 체크박스 복수선택 변경

---

## 세션 47 (2026-06-03)

### KpopStats 탭 개선
- 탭 스타일 Curation K 기준으로 통일: `inline-flex gap-1.5 px-4 py-2 rounded-full text-xs font-medium border` + inline style 색상 분기
- Sticky 고정 `top-[72px]`, 탭 클릭 시 `window.scrollTo({ top: 0 })` — sticky 상태 scroll-to-top 버그 수정
- 이모지 span → lucide 아이콘: Charts `BarChart2`, Chart Attack `Flame`
- Chart Attack 비활성 시 `animate-pulse` 빨간 점 진입 유도

### Chart Attack 탭 이모지 전체 교체
- JSX 내 🔥 7곳 → `<Flame />` 교체 (JS 템플릿 문자열·주석은 유지)

### KfoodKit 레시피 랜덤 노출
- `app/api/food/recipes/route.ts`: `.order(created_at)` 제거 → Fisher-Yates shuffle + JS 페이지네이션
- `revalidate = 0` + `force-dynamic` → 매 요청 다른 순서 보장, `MAX_POOL = 1000` 상한

---

## 세션 46 (2026-06-03)

### 전체 사이트 코드 검수 — 즉시·개선·마이너 항목 처리 (총 27건)

**즉시 수정 (커밋 c763373)**
| 항목 | 파일 | 내용 |
|------|------|------|
| Pro 게이트 우회 | `app/food/page.tsx` | `isPro={true}` → `isPro={isPro}` |
| Mock 구독 데이터 | `app/mypage/page.tsx` | 하드코딩 제거, 실데이터 분기 |
| 한국어 UI 노출 | `app/kpop/page.tsx`, `calendar`, `korean-content` | 전부 영문 교체 |
| 지원 링크 오류 | `app/mypage/settings/page.tsx` | `mailto:support@unfoldk.com` |

**개선 권장 (커밋 c763373)** — 모바일 레이아웃, rAF 메모리 릭, 캘린더 로딩, 모달 반응형, watchlist toast, router.push, 모바일 탭바, Pro CTA 분기, pricing 페이지 신규 등

**마이너 (커밋 8090df1)** — 중복 클래스, pulse 분리, useCallback, Grammar 수동화, useMemo 안정화 등

---

## 세션 44~45 (2026-06-03)

### KpopStats — Chart Attack 탭 마무리

- Golden Hour 한국어 혼입: `useMemo` → `useEffect+useState` (SSR 타임존 고정 방지) + `toLocaleTimeString("en-US")`
- 비로그인 "Join the Battle": `<Link>` → `onSignUp()` 모달 호출
- Chart Insight 잠금: 비로그인 → "Sign up free →" / Free → "Upgrade →"
- Fan Power Ranking 투표 버튼: velocity 상위 8 → chart Top 20 전원
- Chart Insight 드롭다운: chart 20명 (순위 병기)
- Share to Attack: chart 상위 10명 (리스너 수 표시)
- Velocity Tracker: Global Chart Top 20으로 한정

---

## 세션 44 (2026-06-03)

### KpopStats — Chart Attack 탭 신설

**확정 섹션 배열 (① ~ ⑦)**
① Alert Zone — rank 11~12 ALMOST THERE / rank 18~20 DANGER ZONE
② Golden Hour — 07:00 UTC 현지 시간 변환, 3h 이내 red / 1h 이내 pulse
③ Velocity Tracker — YouTube 조회수 시간당 가속 TOP 10, 카운트업 애니메이션
④ Fan Power Ranking — PopCat 투표 + 낙관적 업데이트 + 파티클
⑤ Chart Insight (Pro 전용) — Claude Haiku 예측, `kpop_milestone_cache` 6h TTL
⑥ Share to Attack — Free: 프리셋 / Pro: AI 맞춤 문구
⑦ Next Chart Update — 07:00 UTC 카운트다운

**신규 파일**: `components/kpop/chart-attack-tab.tsx`, API 라우트 6개, migration 0059·0060

**데이터 원칙**: Billboard 크롤링 금지 / Last.fm 재활용 / "Based on Last.fm global streaming data" 표기

---

## 세션 43 (2026-06-02)

### HallyuCalendar
- Fan Meet 탭 유저 등록 행사 연동 (migration 0056)

### KpopStats
- Top 20 전면 무료 개방, 국가별 팬 분포 25개국 확대
- kpop_albums 테이블 신설 (migration 0057, MusicBrainz)
- scripts/sync-musicbrainz-releases.ts, cron 주간 증분

### KdramaMatch
- 2026년 드라마 상세 Pro 잠금 (카드 🔒 뱃지 + hover 오버레이)

### HangeulGo
- Today's Lesson intermediate/advanced 자동 스킵
- Explore Expressions 섹션 추가 (30개, 랜덤 셔플 + 클라이언트 페이지네이션)
- Drama Learning Packs: intermediate/advanced만 Pro 잠금

### KfoodKit
- Local Ingredient Matcher + Shopping List 통합 Pro 잠금
- This Week's K-Drama Food Guide Free 전체 개방

### Curation K
- My Hallyu Course Pro 잠금 blur + centered overlay
- My Hallyu Course 5·7일 코스 생성 오류 수정 (max_tokens 동적 예산)
- My Hallyu Course 저장 버그 수정 (travel_style zod enum 통일)

### KdramaMatch (세션 39~42)
- Shop this drama 기능 신설 (drama_items 테이블, Claude Haiku 자동 추출, 어드민 검수)
- Browse All 드라마명 검색 (`?q=` 파라미터, 디바운스)
- 어드민 전체 일괄 승인 버튼

### Curation K (세션 41~42)
- CourseMiniMap 대규모 개선 (강·해안선·구 경계선·지역명 70개+, force-directed 겹침 방지)
- Travel Style 5종 개편, IN THE DATABASE 7개 카테고리

### 비로그인 접근 정책 (세션 39)
- `components/auth-gate.tsx` 신규, 전 서비스 카드/버튼 AuthGate 적용
- /signup 폐기 → StartModal 패턴으로 전면 교체

---

## 세션 47 신규 파일
- (별도 신규 파일 없음 — 기존 파일 수정)

## 세션 44 신규 파일
- `components/kpop/chart-attack-tab.tsx`
- `app/api/kpop/chart-attack/lastfm-chart/route.ts`
- `app/api/kpop/chart-attack/velocity/route.ts`
- `app/api/kpop/chart-attack/votes/route.ts`
- `app/api/kpop/chart-attack/milestone/route.ts`
- `app/api/kpop/chart-attack/share/route.ts`
- `app/api/kpop/milestone-predict/route.ts`
- `supabase/migrations/0059_chart_attack.sql`
- `supabase/migrations/0060_kpop_milestone_cache.sql`
