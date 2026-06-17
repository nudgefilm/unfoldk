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

## 2026-06-17 결제 수단 Lemon Squeezy → Paddle 전환 (현황 기록)

- 결정 내용:
  - Hallyu Pass 결제를 Lemon Squeezy에서 Paddle Billing으로 전환.
  - 구현 완료:
    - `lib/paddle/constants.ts` — Price ID (Hallyu Pass 월/연, Sourcing Sniper 월/연/일회성, Supplier Pro 월/연)
    - `components/PaddleProvider.tsx` — `initializePaddle()` + `usePaddle()` hook
    - `app/api/paddle/webhook/route.ts` — HMAC 서명 검증 + 구독 활성화/취소/일시정지 처리
    - `components/pricing-section.tsx` — `paddle.Checkout.open()` overlay 방식
    - `app/layout.tsx` — `<PaddleProvider>` 마운트
    - `supabase/migrations/0074_paddle_columns.sql` — `paddle_customer_id`, `paddle_subscription_id` 컬럼
  - 미완료 / 확인 필요:
    - Vercel 환경변수 등록: `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_ENVIRONMENT`, `PADDLE_WEBHOOK_SECRET`
    - migration `0074` Supabase 실제 실행 여부
    - Paddle Sandbox → Production 전환 (`PADDLE_ENV` 기본값 현재 `sandbox`)
    - `/mypage/subscription` 페이지 — Lemon Squeezy checkout 링크 잔존 여부 점검 필요
    - CLAUDE.md §2 기술 스택 "Lemon Squeezy (MoR)" 표기 → "Paddle (MoR)" 업데이트 필요
- 이유:
  - Paddle이 Lemon Squeezy 대비 overlay checkout(인앱 결제 UX), 더 넓은 글로벌 MoR 커버리지, 안정적인 API 제공.
- 대안으로 고려했던 것:
  - Lemon Squeezy 유지 — 기존 `app/api/lemonsqueezy/` 라우트 3개 잔존 (checkout/webhook/switch), 추후 정리 가능.

## 2026-06-08 Supplier Pro 구독 플랜 결제 구조 확정

- 결정 내용:
  - `beauty_suppliers.pro_active` BOOLEAN 컬럼으로 Pro 상태 관리 (Paddle webhook이 SET)
  - Price ID: `supplier_pro_monthly` ($49/월) / `supplier_pro_annual` ($399/년)
  - `SUPPLIER_PRO_PRICE_IDS` Set으로 webhook에서 product 구분
  - Pro 게이팅 항목: 매칭·샘플 승인, 추천 바이어·셀러 전체 열람 (Free는 3개 미리보기), 컨택 요청
  - Sourcing Sniper Annual ($249/년, 28% OFF) 동시 추가 — `SOURCING_SNIPER_PRICE_IDS` Set에 포함
- 이유:
  - B2B 공급사 핵심 가치(매칭 승인, 컨택)는 Pro 뒤에 두어 수익화
  - beauty_suppliers 테이블 직접 관리로 Supabase RLS와 연계 용이
  - Sourcing Sniper 연간 플랜: 월 대비 28% 할인으로 장기 고객 확보
- 대안으로 고려했던 것:
  - users.plan_type 활용 → kbeauty 전용 플랜이므로 별도 컬럼이 적합

## 2026-06-03 Chart Attack 데이터 소스 원칙 확정

- 결정 내용:
  - **Billboard 크롤링 금지** — 공식 API 없음. 웹 스크래핑은 이용약관 위반 + 법적 리스크.
  - **Spotify 브랜드명 직접 인용 금지** — 법인 계정 필수, 상표권 민감 영역.
  - **글로벌 차트 데이터**: Last.fm 기반. 사용자 노출 UI에 **"Powered by Last.fm" 표기 필수**.
  - **YouTube 조회수**: YouTube Data API (공식) 활용. 기존 GCP 프로젝트 쿼터 관리 유지.
  - **외부 데이터 인용 시**: 반드시 출처 명시. 무단 재게시 금지.
  - **기획안 수신 시**: 법적 리스크 / 데이터 출처 / 기술 실현성 검토 후 보고 → 작업 착수.
- 이유:
  - 이번 세션에서 Billboard 크롤러를 초기 구현 후 법적 리스크로 폐기한 경험 반영.
  - 스타트업 단계에서 법적 분쟁 원천 차단.
- 대안으로 고려했던 것:
  - Billboard Global 200 `__NEXT_DATA__` 크롤링 → 이용약관·봇 차단 이슈로 폐기.
  - Spotify Charts API → 법인 계정 필수 + 브랜드 제약으로 폐기.
- 적용 범위: 이후 모든 Chart Attack 관련 기능 + 신규 외부 데이터 연동 전반.

## 2026-06-03 Chart Attack 탭 구현 (KpopStats)

- 결정 내용:
  - `/kpop` 페이지에 "🔥 Chart Attack" 탭 신설 (기존 "📊 Charts" 탭과 병렬).
  - 데이터 소스: 신규 API 수집 없음 — `kpop_stats_daily` 기존 Last.fm/YouTube 데이터 100% 재활용.
  - 6개 섹션: ① Global K-pop Chart (lastfm_listeners 순위) / ② Velocity Tracker (YouTube delta) /
    ③ Rival Chase (청취자 격차 레이싱) / ④ AI Milestone (Claude Haiku, Pro) /
    ⑤ Share to Attack (X 공유) / ⑥ 팬덤 화력 투표 (PopCat 방식).
  - 신규 테이블: `chart_attack_votes` (migration 0059 — Supabase 수동 실행 필요).
  - Free/Pro 분기: ③ 전체 레이싱·④ AI Milestone·⑤ AI 문구 = Pro. 나머지 Free.
  - `isPro` 상태를 `app/kpop/page.tsx` auth useEffect에 추가 (기존 `isLoggedIn`만 있었음).
- 이유:
  - 팬덤 인게이지먼트 강화 + Pro 전환 훅 마련.
  - 기존 수집 데이터 재활용으로 추가 API 비용 0.
- 대안으로 고려했던 것:
  - Billboard 크롤링 → 법적 리스크로 폐기 (위 항목 참조).

## 2026-05-20 KfoodKit Phase 3 — "Find it in Korea" 섹션 rollback

- 결정 내용:
  - `components/food/recipe-detail-dialog.tsx` 의 "Find it in Korea" 섹션 + 관련 helper (`RestaurantItem`, `buildGoogleMapsUrl`), `restaurants` state, 추가 useEffect, `isPro` prop 모두 제거.
  - `app/api/food/restaurants/route.ts` 삭제.
  - `app/food/page.tsx` 의 `isPro` prop 전달 제거.
  - 주간 K푸드 챌린지 (food_challenges) 와 admin 챌린지 탭은 **유지** — 같은 Phase 3 commit 의 다른 트랙.
- 이유: 사용자 판단으로 해당 기능 미배포 (UX·매칭 품질·전략 트레이드오프). tour_spots 데이터 자체는 Curation K 가 그대로 사용.
- 대안으로 고려했던 것: 라우트만 비활성화하고 컴포넌트 남기기 — dead code 누적 회피 위해 전체 제거.

## 2026-05-20 KfoodKit Phase 3 — 한국 맛집 연계 (tour_spots) + 주간 K푸드 챌린지

- 결정 내용:
  - **/api/food/restaurants** — `tour_spots(content_type_id=39)` 검색. `food_name` 파라미터로 `title` OR `overview_ko` ILIKE 매칭, `area_code` 옵션 필터, `image_url` 있는 곳 우선 정렬, 기본 limit 3. 신규 마이그레이션 0건 — 0027 (Curation K) 의 음식점 데이터 재활용.
  - **레시피 모달 "Find it in Korea" 섹션** — detail 로드 후 `title` 로 자동 fetch. 결과 없으면 섹션 미노출. 카드는 이미지(16:9 모바일 / 정사각 sm+) + 한글(영문) 이름 + 주소. Google Maps 링크는 Pro 전용 — Free 는 "Maps with Pass" 잠금 표시. `buildGoogleMapsUrl` 은 좌표 우선, 없으면 주소 fallback.
  - **/api/food/challenges (공개 GET)** — `week_start <= today <= week_end` 매칭 1건 + `food_name` 기반 매칭 레시피 id 동시 lookup. 응답 `{ challenge, recipeId }`. 클라가 Start 버튼 한 번에 모달 오픈 가능.
  - **/api/admin/food/challenges (admin POST)** — `requireAdmin` 게이트 + zod 검증 (title/dates required, food_name·image_url·description optional). `week_start ≤ week_end` 추가 검증 (DB check 없음).
  - **/admin/food 탭 wrapper** — `FoodAdminTabs` client 컴포넌트 (Recipes / Challenges 전환). server component `page.tsx` 가 두 데이터 모두 `Promise.all` 로 fetch 해 props 전달. `ChallengesAdmin` 은 진행 중 / 신규 폼 / 최근 10건 list (active 배지). 폼 제출 후 `router.refresh()`.
  - **/food This Week's Challenge** — 정적 카드 ("Make Japchae", "1,240 fans joined") 폐기. `/api/food/challenges` 실데이터. challenge null 이면 섹션 미노출. Start 버튼은 `challengeRecipeId` 있을 때만 노출 + 클릭 시 `setActiveRecipeId` → 모달 오픈 (라우트 navigate 없음).
- 이유:
  - **tour_spots 재활용** — 0027 의 음식점 1,000+ 건 (TourAPI 4.0) 활용. Spoonacular 같은 외부 API 추가 도입 없이 한국 현지 연계라는 KfoodKit 차별화 기능 즉시 구현.
  - **ILIKE 한국어 검색** — title (식당명) 에 음식명 매칭률 낮음. overview_ko (메뉴·소개) 까지 OR 검색하면 매칭률 보강. 향후 트라이그램·GIN 인덱스 도입 검토.
  - **server-side recipe lookup** — 클라가 챌린지 응답 후 별도 fetch 하면 round-trip 2 회 + flicker. 서버에서 한 번에 lookup 해 응답에 포함.
  - **admin 탭** — Recipes / Challenges 분리. 같은 페이지에 세로 배치보다 사용 동선 명확. server props + client tabs 패턴 (다른 admin 페이지 일관).
  - **Pro 게이팅 Google Maps** — CLAUDE.md §6 Curation K 정책 ("Pro: Google Maps 연동") 일관. 카드 정보는 Free 에도 노출 (사용자가 주소 직접 검색 가능).
- 대안으로 고려했던 것:
  - Curation K 의 `/api/curation-k/food` 재활용 — 응답 schema 가 카테고리 통합용이라 무거움. 단순 ILIKE 검색은 별도 라우트가 가벼움.
  - `food_recipes.tour_spot_ids` 컬럼 추가 — 미리 매칭 캐싱. 매칭 데이터 변경 빈도 낮아 lazy 검색으로 충분. 매번 ILIKE 비용은 작음 (limit 3).
  - 챌린지 GET 응답에 매칭 레시피 전체 join — 응답 무거움 + 모달이 어차피 별도 lazy fetch. id 만 충분.
  - Google Maps embed iframe — Maps Embed API 키 필요 + 모달 높이 증가. 새 탭 외부 링크가 단순.

## 2026-05-20 KfoodKit Phase 2 — 레시피 컬렉션 저장 + YouTube 요리 영상 lazy 연동

- 결정 내용:
  - **컬렉션 API** — `/api/food/collections` GET/POST/DELETE. 0030 의 `user_food_collections` + RLS 활용 (신규 마이그레이션 0건). Free 5 cap 은 POST 시 server-side `select count` 로 검증 (Pro/admin 우회), unique(user_id, recipe_id) 충돌은 멱등 `{ ok: true, already: true }` 반환.
  - **북마크 UI** — `/food` 카드 이미지 영역 우상단 + `RecipeDetailDialog` 헤더에 동일 토글 버튼. 비로그인 클릭 → in-place StartModal. Free cap 도달 → toast "Coming with Hallyu Pass — unlimited saves at launch." (결제 연동 전 정책 일관). optimistic 토글 + 서버 거부 시 롤백. 카드 button-in-button HTML 위반 회피 위해 카드 안의 북마크는 `div role="button"` + stopPropagation.
  - **/mypage/recipes 실데이터** — Coming Soon 폐기. `/mypage/dramas` 패턴 (MypageShell + EmptyState + Toaster + 모달 재사용). 카드 클릭 → `RecipeDetailDialog`, 우상단 북마크 클릭 → 즉시 해제 (이미 저장 상태).
  - **YouTube 요리 영상 lazy** — `lib/api/youtube.ts` `searchCookingVideo(titleEn)` 추가. q=`${titleEn} Korean recipe cooking`, type=video, maxResults=1, videoEmbeddable=true, relevanceLanguage=en, safeSearch=moderate. `/api/food/recipes/[id]` 가 번역 task `Promise.all` 완료 후 sequential 로 호출 (title_en 의존) → `food_recipes.youtube_url` (0030 컬럼) write-back. 모달은 `img.youtube.com/vi/{id}/mqdefault.jpg` 썸네일 + Play 오버레이 + 새 탭 watch URL.
- 이유:
  - **Free 5 cap** — CLAUDE.md §6 "결제 연동 전 임시 Free 확대 정책" 표의 "KfoodKit 컬렉션 Free 5 / Pro 무제한" spec 그대로 — 임시 확대 적용 안 되는 항목. 락인 효과 + 결제 가동 후 Pro 차별화 라인 보존.
  - **YouTube lazy + DB 캐싱** — `search.list` 100 units/call. 537 레시피 일괄 backfill 시 53,700 units = 일 쿼터 (10,000) 5배 초과. lazy 만 호출 (모달 첫 오픈) + DB 캐싱으로 실제 트래픽 비례 cap. embed 금지 + 외부 링크만 (저작권·UX 균형).
  - **videoEmbeddable=true** — 향후 embed 도입 옵션 보존. 현재는 새 탭만이지만 검색 단에서 미리 필터.
  - **북마크 button-in-button 회피** — `<button>` 안에 `<button>` 은 HTML5 invalid. 카드 자체가 `<button>` 인데 내부 북마크가 자식 button 이면 a11y/focus 깨짐. div role="button" 으로 시맨틱은 약하지만 표준 준수.
- 대안으로 고려했던 것:
  - 컬렉션: Free cap 을 RLS 트리거로 강제 — 클라이언트가 명확한 403 에러 받기 어려움 + 어드민 검토용 read 정책과 충돌 → 앱 레벨 cap 유지 (DB 무제한 그대로).
  - YouTube embed — 모달 안 iframe 으로 직접 재생. 저작권 측면 안전성 보장 안 됨 (광고·제약 채널) + 모달 높이 증가. 새 탭 외부 링크가 안전.
  - 썸네일 별도 컬럼 (`youtube_thumbnail`) 저장 — 단순 URL 패턴이라 클라이언트 추출로 충분. 컬럼 증가 비용 없음.
  - cron 배치 backfill — 일 쿼터 초과 위험 + 트래픽 없는 레시피까지 비용 발생. lazy 가 ROI 최적.

## 2026-05-20 KfoodKit M+4 출시 — 데이터 인프라 + 이미지 backfill 3-phase + 어드민 콘솔

- 결정 내용:
  - **MAFRA 엔드포인트 확정** — 사용자 spec 의 `tn_pubr_public_recipe_info_api` 가 data.go.kr 에 미등록(`resultCode 12 NO OPENAPI SERVICE`) 으로 호스트 전면 교체. 실제 농림부 별도 호스트 `http://211.237.50.150:7080/openapi/{KEY}/json/{GRID_ID}/{startRow}/{endRow}` 사용. serviceKey 는 path 에 박힘 (쿼리 X). Grid: BASIC(226, 537) / INGREDIENTS(227, 6,104) / PROCESS(228, 3,022). `RECIPE_NM_KO / RCP_NM 등 응답 스키마가 spec 의 rcpNm 과 완전히 달라 lib/api/mafra-recipe.ts 전면 재작성.
  - **이미지 backfill 3-phase 파이프라인** — MAFRA 가 이미지를 제공하지 않아 보강 필요:
    · Phase 1: 식약처 COOKRCP01 (1,146건) 정규화 매칭 (NFC + 공백·구두점 제거 후 exact → 양방향 contains).
    · Phase 2: Phase 1 unmatched row 의 RECIPE_NM_KO 를 Claude Haiku 배치 정규화 후 재매칭 ("김치찌게" → "김치찌개" 류 오타 보정).
    · Phase 3: 모두 실패한 row 는 Claude 가 "Korean {romanized} + 핵심 재료" 영문 쿼리 생성 → Unsplash fallback. Unsplash rate-limit (50/h) 대비 cap 40/run.
    · `image_source` 컬럼으로 출처 추적 (`mfds | unsplash | upload | manual`). 카드·모달에서 unsplash 일 때 출처 표기 (가이드라인 의무).
  - **/food 페이지 풀스택**:
    · 정적 6 카드 → 서버 페이징 (12/페이지) + 300ms search debounce + smooth scroll.
    · This Week's K-Food Picks (Pro 전용) — Claude Haiku 가 계절 기반 후보 50건에서 3-5 선정 + 1줄 영문 이유. `food_weekly_picks(week_start UNIQUE)` DB 캐싱 + Next.js `revalidate=604800`. recipe_id 화이트리스트로 hallucination 차단.
    · RecipeDetailDialog — 상단 `aspect-video` + `flex-col` scrollable 콘텐츠. 한글(영문) 병기. 제목 옆 단일 Copy 아이콘 + shadcn Tooltip "Copy to Ingredient Finder".
    · title_en/description_en lazy 생성 — 모달 첫 오픈 시 Claude Haiku tool_use 호출 + DB 캐싱. 카드 그리드 일괄 노출 위해 cron Phase 4 배치 backfill (cap 30/run, 누적).
  - **Ingredient Finder 전면 재설계** — 기존 "재료 1개 → 대체 재료" → "음식명 1개 → 전체 재료 sourcing breakdown" 변환. `lib/claude/ingredient-finder.ts` `findIngredient` → `findDishIngredients`. tool_use schema: `items[] = { ingredient_ko, substitute_en, store, difficulty: Easy|Medium|Hard }`. store 화이트리스트 + difficulty enum 코드 측 재검증.
  - **My Shopping List** — Pro 잠금 해제하고 전유저 사용 (localStorage 영속화). `html2canvas` 동적 import 로 PNG 다운로드 + 박스 하단 unfoldk.com 워터마크. CLAUDE.md §6 "Pro 유지" 표 항목과 상충 — 결제 가동 시 잠금 복원 여부 별도 결정 필요 (carry-over).
  - **/admin/food 콘솔** — `food-images` Storage 버킷 (public read · admin write only via `is_admin(auth.uid())`). FoodAdminTable: 전체/이미지 있음/없음 필터 + 검색 + 썸네일 + source 배지. FoodImageEditDialog: 파일 업로드 (JPG/PNG/WEBP 5MB, `{recipe_id}.{ext}` upsert + `?v={timestamp}` 캐시 우회) / URL 직접 입력 (image_source='manual') / 이미지 제거.
  - **마이그레이션 5종 신규** — 0030 ~ 0034.
  - **KfoodKit "soon" → "live"** — header SERVICES_META · ServiceComingSoonBanner 제거 · roadmap-modal · early-access-banner · early-access notify 이메일 · "5 services" → "6 services" 4곳 정합.
- 이유:
  - **비용** — Spoonacular $29/월 + 한식 데이터 빈약 vs MAFRA 무료 + 한국 공식 + 한식 정확도 우월.
  - **데이터 풀** — MAFRA 537 + MFDS 1,146 + Unsplash fallback = 실질적으로 모든 row 에 이미지 확보 가능. mfds 매칭 1차 후 보정 단계가 ROI 높음 ("김치찌게" 같은 단일 표기 차이로 매칭 실패 케이스 다수).
  - **출시 가속** — KfoodKit 을 "soon" 으로 두면 6 서비스 마케팅 메시지 약해짐. M+4 인프라가 갖춰져 "All 6 live" 로 전환이 가능했음.
  - **어드민 콘솔** — Claude backfill 이 채워주지 못한 long-tail row 를 운영자가 빠르게 수기 큐레이션할 수 있어야 카드 UX 가 깨지지 않음. mfds/unsplash 자동 결과를 수동 override 할 수 있도록 image_source='manual'/'upload' 분리.
- 대안으로 고려했던 것:
  - **수동 이미지 큐레이션만** — 537 건 수기 작업 부담. Phase 1 자동 + Phase 2-3 자동 + 어드민 잔여 큐레이션이 효율적.
  - **NAVER 검색 API 이미지** — 저작권 리스크 + 글로벌 라이선스 불명확. Unsplash 가 라이선스 안전.
  - **TheMealDB · MyDramaList API 추가 연동** — 한식 카테고리 데이터 부족. MAFRA 가 더 깊이 있음.
  - **Pro Shopping List 유지** — 락인 효과는 있으나 결제 연동 전 단계라 가치 작음. localStorage 가 가입 전 체험을 늘림.

## 2026-05-20 Curation K cron 회귀 — 매일 전체 → 매일(축제만) + 월 1회(전체)

- 결정 내용:
  - vercel.json 2 슬롯으로 분리:
    · 매일 03:00 UTC `?only_festivals=true`
    · 매월 1일 03:00 UTC 전체 (tour 5 카테고리 + filming + kpop)
  - `runTourSpotsIngest({ onlyFestivals })` — true 시 CATEGORIES 를 FESTIVAL(15) 만으로 제한 + enrichment/translation 도 같은 카테고리만.
  - `?stage=primary/secondary` 파라미터 제거, `?only_festivals=true` 단일 분기로 단순화.
  - 어드민 카드 metric: `stage='festivals'` 시 tour 만 / 그 외 tour + filming + kpop 합산.
- 이유:
  - 관광지·문화시설·숙박·음식점 (12·14·32·39) 은 거의 영구 고정 데이터 → 매일 fetch 가 quota 낭비.
  - 축제·행사 (15) 만 시간 민감 (D-1 등록 가능) → 매일 따라잡기 필수.
  - filming_spots / kpop_spots 도 Claude 무거운 단계라 월 1회 충분.
  - Claude 비용 약 90% 절감 추정 (번역 cap 100 × 30회 → 100 × 1회 + 축제 ~30/일 × 30회).
- 대안으로 고려했던 것:
  - **격주 또는 주간** — 축제 시간 민감성 손해. 월 1회 + 매일 축제 슬롯이 최적.
  - **stage 파라미터 유지** — 슬롯 4개로 복잡도 증가. 단일 분기가 단순.

## 2026-05-20 Early Access 배너 — 비로그인 전용 + 카피 교체

- 결정 내용:
  - `createSupabaseBrowserClient` + `onAuthStateChange` 구독 — 로그인 사용자에게 배너 미노출.
  - `isAuthenticated` null 상태 (확인 전) 에도 미노출 — flash-of-banner 방지.
  - 카피: "Track K-pop comebacks · Discover dramas · Learn Korean · Explore Korea | all in one place. Updated daily. Free to join."
  - CTA: "See what's coming" + RoadmapModal 제거. "Start now" → StartModal 인플레이스 (현재 경로 next 보존).
- 이유:
  - 로그인 사용자에게 가입 push 는 노이즈 + 이미 사이트 사용 중이라 무의미.
  - 6 services live 상태에서 "comings" 강조 카피가 부적절. 가치 제안 (track/discover/learn/explore) 가 명확.
  - Start now → StartModal 은 페이지 이동 없이 OAuth 진입 가능 — 다른 컴포넌트 (report-button, blog-comments) 와 일관된 패턴.
- 대안으로 고려했던 것:
  - **배너 전면 제거** — 비회원 가입 hook 손해. 로그인 가드만 추가가 적정.

## 2026-05-20 블로그 cover Unsplash 다양화 + 중복 회피

- 결정 내용:
  - `searchUnsplashImage` per_page 5 → 15. `results[0]` 고정 → 필터링 후 랜덤 pick.
  - `excludeImageSlugs?: Set<string>` 옵션 — Unsplash URL slug (`photo-{timestamp}-{hash}`) 기반 중복 회피.
  - `lib/blog-gen/used-images.ts` (신규) — GitHub Contents API 로 `content/blog/` 최신 30 MDX frontmatter `image:` URL 슬러그 수집. listing 실패는 swallow (dedup 불가, 생성은 진행).
- 이유:
  - 같은 query (예: "Korean K-pop concert") 면 항상 같은 사진 [0] 가 반환되어 이전 포스트와 cover 중복 발생.
  - URL slug 가 photo identifier — API id 와 형식 다르지만 URL 만 저장한 기존 포스트에서도 추출 가능.
  - GitHub Contents API 5000/h authenticated → 30 파일 listing + read 비용 무시.
- 대안으로 고려했던 것:
  - **Supabase 별도 테이블에 used image id 추적** — DB 마이그레이션 부담. GitHub repo 자체가 source of truth 라 추가 인프라 불필요.
  - **Claude 가 더 specific 쿼리 생성** — 효과 일부 있으나 long-tail 중복 여전. 랜덤 pick + dedup 이 강력.

## 2026-05-19 KfoodKit 외부 API — Spoonacular → 농림수산식품교육문화정보원 (MAFRA) 레시피 API 전환

- 결정 내용:
  - 데이터 소스를 Spoonacular ($29/월 유료) → 농림수산식품교육문화정보원 레시피 API (data.go.kr, 무료) 로 교체.
  - 승인 엔드포인트 3종 (기본정보 / 재료정보 / 과정정보) 모두 사용.
  - **migration `0031_kfoodkit_mafra.sql`** — `food_recipes.spoonacular_id integer` 컬럼 drop + `mafra_rcp_seq text` unique 컬럼 신규. 0030 적용 직후 (데이터 0건) 라 안전.
  - **`lib/api/spoonacular.ts` 삭제**, `lib/api/mafra-recipe.ts` 신규 — `getRecipeList` / `getRecipeIngredients` / `getRecipeProcess` / `getRecipeDetail` 4종 함수, 24h revalidate 캐싱.
  - **`lib/ingest/food-recipes.ts`** — 기본정보 50건 페치 후 신규 항목만 재료·과정 추가 호출 → upsert (mafra_rcp_seq 충돌키). cron 인터페이스는 변경 없음.
  - **`.env.local`** — `SPOONACULAR_API_KEY` 제거, `MAFRA_API_KEY` 항목 + 발급 안내 주석 박제.
  - 영문 설명 (`title_en`, `instructions_en` 등) 은 후속 단계 (Claude Haiku enrichment) 에서 사후 생성 — MAFRA 응답이 한국어라 글로벌 유저 노출엔 번역 필수. 현 단계 ingest 는 한글 원본만 저장.
- 이유:
  - **비용** — Spoonacular $29/월 vs MAFRA 무료. KfoodKit 가 Phase 2 도달 (MAU 1k+) 전까지 매출 0 인 상태에서 유료 API 부담 회피.
  - **데이터 정확성** — 한국 공식 기관 데이터 → 한식 레시피의 정확도·다양성이 Spoonacular (외산 사이트 크롤링 기반) 보다 우월. KfoodKit 의 "드라마 속 음식 → 진짜 한식" 컨셉에 부합.
  - **쿼터 충분** — 1,000~10,000 호출/일. 본 cron weekly + cap 50 (재료·과정 포함 시 150 쿼터) → 일일 쿼터의 15% 만 사용.
  - **공공데이터 일관** — TourAPI (Curation K) 가 이미 같은 data.go.kr 플랫폼 → 인증·캐싱·에러 핸들링 패턴 재사용.
- 대안으로 고려했던 것:
  - **Spoonacular 유지 + MAU 도달 후 평가** — 무료 quota (150/일) 부족 + 한식 카테고리 데이터 빈약 가능성. 사전 검증 비용 회피.
  - **만개의레시피·해먹남녀 등 민간 사이트 크롤링** — robots.txt + 저작권 리스크.
  - **TheMealDB (무료, 글로벌)** — 한식 레시피 수 절대 부족.

## 2026-05-19 Curation K 카드 상세 모달 보강 — spot_description / visit_reason / homepage 컬럼 추가

- 결정 내용:
  - **migration `0029_curation_k_descriptions.sql`** — 모두 nullable, 기존 row 영향 없음.
    · `filming_spots.spot_description text` — Claude Haiku 가 추출한 촬영 장면·맥락 1~2문장 (영문)
    · `kpop_spots.visit_reason text` — Claude Haiku 가 추출한 K팝 팬 방문 이유 (이미 추출 중이었으나 영구화)
    · `kpop_spots.homepage text` — 공식 홈페이지 URL (있을 때만)
  - **ingest 코드 영구화** (`lib/curation-k/filming-spots.ts` / `lib/curation-k/kpop-spots.ts`):
    · filming-spots: Claude tool input_schema 에 `description` 필드 추가 + insert payload 에 `spot_description` 포함
    · kpop-spots: 이미 추출되던 `visitReason` 을 upsert payload 에 추가 — 0029 적용 후 다음 cron 부터 자동 채워짐
  - **API 응답 확장** (`/api/curation-k/spots`, `/api/curation-k/kpop-spots`) — SpotItem / KpopSpotRow 인터페이스에 `drama_id`, `spot_description`, `event_start_date`, `event_end_date`, `visit_reason`, `homepage` 추가.
  - **카드 상세 모달 탭별 분기** (`app/curation-k/page.tsx` `SpotDetailDialog`):
    · `filming` — 좌상 "Featured in: <drama>" 배지를 `<Link href="/drama">` 로 클릭 가능하게 + 본문 description 은 `spot_description`
    · `festivals` — 본문 상단에 기간 칩 (subtitle = "YYYY-MM-DD ~ YYYY-MM-DD")
    · 그 외 — 기존 overview_en ?? overview_ko 패턴 유지
  - **K-Pop Pilgrimage 상세 모달 신규** (`KpopSpotDetailDialog`) — kpop_spots 카드 클릭 진입. visit_reason 본문 + homepage CTA + Google Maps Pro 게이팅 ("Coming with Hallyu Pass" 패턴).
- 이유:
  - 사용자 spec 으로 탭별 모달 구성 항목이 명확화 — "촬영 장면 설명", "방문 이유" 등 모달에서만 의미 있는 컨텍스트를 영구화. Claude 가 이미 추출하던 정보 (visit_reason) 가 휘발되던 비효율 해소.
  - "Featured in" 배지를 클릭 가능하게 하여 Curation K → KdramaMatch 교차 트래픽 유도 (서비스 간 락인).
  - 기존 row 호환: 모달은 NULL 시 섹션 자체를 숨김 — UX 회귀 없음.
- 대안으로 고려했던 것:
  - **JSONB 단일 컬럼 `metadata`** 에 description/visit_reason 등 모아 저장 — 인덱스·쿼리 가독성 손해. 명시적 컬럼 우선.
  - **모달에서만 fetch 하는 별도 detail endpoint** — 추가 round-trip + Claude 호출 가능성. 카드 그리드 응답에 미리 포함이 단순.

## 2026-05-19 SpotDetailDialog 이미지 갤러리 화살표 — functional update + stopPropagation 강화

- 결정 내용:
  - `setImageIndex((prev) => …)` 함수형 업데이트로 stale closure 우려 제거.
  - `onMouseDown` + `onClick` 양쪽에 `e.stopPropagation()` + `e.preventDefault()` — Dialog 외곽 click outside detection 이나 image overlay 클릭 캡처에 끌려가지 않게 방어.
  - 가드 조건을 `images.length > 1` → `realImages.length > 1` 로 명시 — placeholder fallback 단독 (1장) 일 때 화살표 미노출이 코드 의도로 드러남.
- 이유: 갤러리 prev/next 클릭이 일부 케이스에서 무반응이라는 사용자 보고 → 코드상 stale closure 가능성 + Dialog 이벤트 상호작용 가능성 두 축 모두 방어. 데이터 측면 (image_url2 NULL) 은 이미 `Set` dedup + filter 로 정상 처리되고 있어 추가 변경 없음.
- 대안으로 고려했던 것:
  - `useMemo` 로 images 배열 메모이즈 — primitive 비교만 들어가는 곳이라 효과 미미.

## 2026-05-18 Curation K 통합 cron + tour_spots 테이블 신규

- 결정 내용:
  - **`ingest-filming-spots` cron 슬롯을 `ingest-curation-k` 로 교체** (`0 3 * * *` 유지). 단일 cron 으로 Curation K 의 두 데이터 소스를 통합 실행.
  - **tour_spots 테이블 신규** (migration `0027_tour_spots.sql`) — TourAPI 5개 카테고리 (`12 관광지` / `14 문화시설` / `15 축제·행사` / `32 숙박` / `39 음식점`) 를 `content_type_id` 컬럼으로 구분해 단일 테이블에 저장. `content_id` unique 키로 upsert. RLS: anon+auth select / admin write.
  - **카테고리별 주기 차등 적용** (`lib/ingest/tour-spots.ts`) — 축제·행사 매일 / 나머지 30일 마다. 마지막 성공 시각은 `cron_logs` 의 `result_json.categories[]` 에서 카테고리별 `skipped=false` 마지막 실행으로 판단. 단, 본 카테고리 row 가 DB 에 0건이면 강제 실행 (최초 수집).
  - **modifiedtime 증분 비교** — TourAPI 응답 item 의 `modifiedtime` 이 DB 의 기존 row 와 동일하면 upsert 자체를 skip (불필요 UPDATE 회피).
  - **Claude 번역 — `overview_ko → overview_en` 1회**, cron 당 최대 20건 cap. tool_use 강제 JSON 출력 + 24h ephemeral cache.
  - **`?include_filming=true` 옵션** — vercel 자동 실행은 tour_spots 만, 어드민 수동 트리거에서만 filming_spots 동시 실행 (촬영지 수집은 수동 큐레이션 정책 유지).
  - **기존 `/api/cron/ingest-filming-spots` 라우트 파일 유지** — DB 잔존 cron_logs 와의 호환 + 추후 별도 수동 트리거 가능성.
- 이유:
  - cron 슬롯 한정 (Vercel Hobby 10개 cap) 안에서 Curation K 확장을 흡수.
  - 카테고리별 변경 빈도 차이 (축제는 매일 신규, 관광지·음식점은 월 단위) 가 커 단일 주기로 묶으면 손해. category-level interval 로 비용 균형.
  - `tour_spots` 와 `filming_spots` 를 분리 — filming_spots 는 드라마-촬영지 1:N 마스터 (`drama_id` 필수), tour_spots 는 일반 카탈로그 (드라마 무관). 데이터 모델·생애주기 다름.
  - `cron_logs.result_json` 을 카테고리별 상태 스토어로 재사용 → 별도 메타 테이블 도입 회피. 단점은 로그 retention 정책에 묶이는 것 (현재 무제한).
- 대안으로 고려했던 것:
  - **카테고리별 별도 cron 라우트** (`ingest-tour-tourist-spots`, `ingest-tour-festival` 등 5개) — Vercel cron 슬롯 5개 추가 소비. 카테고리 결과 통합 어드민 카드 만들기 어려움.
  - **`tour_spots` 를 `filming_spots` 에 합치고 `spot_type` 컬럼 분기** — drama 연계 의무 컬럼 (`drama_id` / `drama_title`) 이 tour_spots 에선 부적합. nullable 로 풀면 데이터 무결성 약화.
  - **카테고리별 interval 상태를 별도 메타 테이블 (`tour_ingest_state`) 로 박제** — 정확하지만 마이그레이션 1개 추가. cron_logs 재사용으로도 정합성 충분 (skipped=false 마지막 시각 = 마지막 성공).
- 사용자 액션 필요:
  - **Supabase SQL Editor 에서 `0027_tour_spots.sql` 적용** — Vercel 배포 전 또는 후 단발 실행.

## 2026-05-18 인증 임베디드 URL 의 redirect 응답에 Cache-Control: no-store 필수

- 결정 내용:
  - **사용자 식별자 (email / user_id) 가 임베디드된 URL 로의 redirect** 응답에는 반드시 `Cache-Control: no-store` 명시. `NextResponse.redirect()` 기본 응답은 캐시 헤더 없음 → 브라우저가 같은 요청 URL 로 재요청 시 캐시된 Location 을 그대로 따라가 다른 계정의 임베디드 값으로 직행하는 cross-contamination 버그 발생.
  - **`/api/lemonsqueezy/checkout` 의 모든 redirect 경로에 일괄 적용** — 정상 LMS URL (유저 email 임베드) 뿐 아니라 error / no_user 분기 응답도 일관 적용. `NO_STORE_HEADERS = { "Cache-Control": "no-store" }` 상수로 박제.
  - 향후 유저-바운드 redirect 응답을 작성할 때 (OAuth callback / 결제 진입 / 시뮬레이션 / 서명된 URL redirect 등) 동일 패턴 따르기.
- 이유:
  - 서버는 매 요청 supabase 세션 쿠키로 user 새로 읽지만, **브라우저가 서버까지 안 닿으면 의미 없음**. 307 redirect 는 브라우저가 캐시 가능한 응답 (특정 조건에서 발생 — 같은 URL·같은 method·캐시 정책 부재).
  - `dynamic = "force-dynamic"` 은 Next.js 의 서버-side 정적 캐시 차단일 뿐, **브라우저 / CDN 캐시는 별개**. 응답 헤더로 명시 차단해야 안전.
  - email 같은 PII 가 URL query 에 들어가는 통합 (LMS pre-built checkout URL 패턴) 에서는 cache leak 의 비용이 큼 — 회원이 다른 회원 이메일로 결제하는 사고 가능.
- 대안으로 고려했던 것:
  - **서버 측에서 email 임베드 제거** — LMS pre-built checkout URL 의 핵심 가치 (자동 email 채움 + custom_data 박제) 를 잃음. webhook 매핑 (`user_id` custom_data) 도 깨짐.
  - **클라이언트가 매번 fresh 요청하도록 query 에 timestamp 추가** — server-side 에서 강제할 수 없고 클라이언트 트리거마다 동기화 부담. 응답 헤더가 정답.
  - **redirect URL 만 응답하는 JSON API + 클라이언트 navigation** — 동작은 OK 지만 라우트 한 곳 더 만들고 클라이언트 코드 늘어남. 응답 헤더 1줄로 끝나는 fix 가 비용 최소.

## 2026-05-18 UI 카피 — 서비스 주체는 항상 "UnfoldK", 벤더명·"AI" 단독 노출 금지

- 결정 내용:
  - **사용자 노출 텍스트** (`app/**/*.tsx` JSX / `components/**/*.tsx` JSX / `emails/**`) 에서 서비스·정보 제공의 주체는 항상 "UnfoldK" 로 표기. AI 벤더명 (`Claude`, `Anthropic`, `Haiku`, `Sonnet`, `GPT`, `OpenAI`, `ChatGPT`) 노출 금지.
  - **"AI" 단독 표기도 재라벨** — `AI picks` → `UnfoldK picks` / `AI recommendations` → `UnfoldK recommendations` / `AI Grammar Explanation` → `UnfoldK Grammar Explanation` / `AI-powered X` → `UnfoldK X` / `AI-curated X` → `UnfoldK-curated X` / `powered by AI` → `powered by UnfoldK` 등.
  - **예외 (그대로 둠)** — 코드 주석 / `lib/**` · `app/api/**` 내부 로직 (디버깅·운영 정확성) / 어드민 전용 UI (`/admin/*` · `components/admin/*`) / 외부 라이선스·법무 표기 의무.
  - **자가 점검 grep** — 사용자 노출 영역에서 `\b(AI|Claude|Anthropic|Haiku|Sonnet|GPT|OpenAI|ChatGPT)\b` 검색 시 주석·내부 변수만 남아야 함. CLAUDE.md §6 박제.
- 이유:
  - "vendor lock-in" 인상 차단 — UnfoldK 가 자체 한류 큐레이션 브랜드인데 카피마다 "AI" 가 전면에 있으면 AI 도구처럼 보임. 한류 팬 타겟에 어울리지 않음.
  - 모델 교체 (Haiku → Sonnet, 향후 다른 벤더) 시 카피 회귀 작업 0건. 내부 구현 디테일과 사용자 노출 카피 분리.
- 대안으로 고려했던 것:
  - "AI" 단어는 유지, 벤더명만 제거 — "AI" 자체가 사용자 인상에서 차별화에 마이너스. 한류 서비스의 정체성은 UnfoldK 의 큐레이션이지 AI 도구가 아님.
  - 점진적 (페이지별) 치환 — 일관성 깨짐 + 회귀 위험. 한 번에 박제 + grep 규칙으로 회귀 방지가 정답.

## 2026-05-18 HangeulGo Got it 영구화 — user_learning_progress.status='mastered' 활용 + phrase-of-day 자동 우회

- 결정 내용:
  - **`POST /api/korean/learning-progress` 신규** — body `{ phraseId, status? }`. 본인 user 의 `user_learning_progress` 행 upsert (`onConflict: 'user_id,phrase_id'`). status 기본값 `'mastered'`. 비-UUID phrase_id (fallback sentinel) 은 `{ skipped: true }` 응답 (idempotent).
  - **`GET /api/korean/phrase-of-day` 확장** — 로그인 유저의 mastered phrase id 목록을 모드 A·B 진입 전 한 번 조회 (`getMasteredPhraseIds`). 모드 A (오늘의 featured) 캐시 hit row 가 mastered 면 자동으로 `pickRandomPhrase("", masteredIds)` 호출로 우회. 모드 B 는 클라이언트 `exclude_ids` 와 mastered 자동 머지 (`extraExcludeIds` 파라미터).
  - **클라이언트 `handleMarkLearned`** — 기존 streak POST 옆에 learning-progress POST 추가. phrase.id 가 UUID 아니어도 서버가 skip 하므로 무조건 호출.
  - **비로그인 동작 무변경** — in-memory `seenPhraseIds` 그대로 유지.
- 이유:
  - **근본 원인** — `phrase-of-day` 가 항상 `featured_date` 캐시 hit 반환, `seenPhraseIds` 가 in-memory `useState` 뿐이라 새로고침 시 휘발. 페이지 진입 시 같은 표현 재노출 = "학습 진도가 무의미" 인상.
  - user_learning_progress 테이블이 0026 마이그레이션에 이미 존재 — `(user_id, phrase_id)` unique + `status` enum (`new`/`learning`/`mastered`). 새 테이블 없이 서버 권한 (RLS auth.uid=user_id) 으로 격리.
  - 영구화 layer 를 서버 사이드에 두면 디바이스 간 동기화도 자동. 클라이언트는 단순 POST.
- 대안으로 고려했던 것:
  - localStorage 만 사용 — 디바이스/브라우저 격리, 데이터 클리어 시 사라짐. 가입 유저에게 부적합.
  - streak POST 에 phraseId 같이 받기 — 책임 혼동 (streak 은 날짜 연속성, learning-progress 는 phrase 별 상태). 별도 endpoint 가 깔끔.
  - mode A 에서 mastered 면 클라이언트가 advanceToNext 호출하는 클라이언트 사이드 방식 — 추가 round-trip + 깜빡임. 서버에서 바로 미학습 반환이 단순.

## 2026-05-18 Lemon Squeezy 결제 — 새 탭 오픈으로 UnfoldK 컨텍스트 유지

- 결정 내용:
  - **클라이언트 trigger 3곳 모두 새 탭으로 전환** —
    - `app/start/page.tsx`: `window.location.href = ...` → `window.open(url, "_blank", "noopener,noreferrer")` + 원래 탭은 `router.push(nextPath)` (가입은 free 락인 완료 상태).
    - `app/mypage/subscription/page.tsx`: Monthly/Annual `<a>` 2개에 `target="_blank" rel="noopener noreferrer"`.
  - **서버 라우트 무변경** — `/api/lemonsqueezy/checkout` 은 그대로 302 redirect 유지. 새 탭이 라우트로 들어가서 LMS 호스팅 결제 페이지로 이동.
  - **검토했다가 폐기** — `lemon.js` 오버레이 통합 (`LemonSqueezy.Url.Open(url)` + URL 에 `?embed=1` + root layout 에 스크립트 로드 + 라우트 응답 모드 분기). 새 탭 한 줄로 충분한데 과한 작업.
- 이유:
  - 결제 페이지가 전체 탭을 차지하면 사용자가 결제 도중 이탈 시 UnfoldK 컨텍스트 (가입 직후 화면 / mypage 등) 가 사라짐. 새 탭이면 결제 탭만 닫고 원래 화면 복귀.
  - 결제 완료 / 실패와 무관하게 webhook 이 plan_type 업그레이드를 처리하므로 원래 탭의 추가 동기화 불필요.
  - 오버레이는 lemon.js 의존성 + URL 빌드 / 라우트 응답 형식 / 클라이언트 트리거 모두 손봐야 함. 새 탭 = 변경 라인 5줄 미만.
- 대안으로 고려했던 것:
  - 현재 탭 유지 + iframe 임베드 — Lemon Squeezy 가 iframe 임베드 차단 (CSP / X-Frame-Options).
  - lemon.js 오버레이 — 정식 SDK 패턴이지만 위 비용 분석으로 폐기. 사용자 활성도 쌓인 후 UX 더 다듬을 때 재검토.

## 2026-05-18 HangeulGo Phase 2 — Claude tool_use / fallback DB upsert / partial index 회피

- 결정 내용:
  - **Claude tool_use 구조화 출력 강제** — `generateKoreanPhrase` / `generateKoreanPack` 가 자유 텍스트 응답 거부. `tool_choice: { type: "tool", name: ... }` + input_schema 로 JSON 모양 강제. JSON parse 실패 / 마크다운 wrapping 등 silent 실패 차단.
  - **Claude 함수 반환 타입 result tuple** — `{ ok: true; payload } | { ok: false; reason, detail }`. 호출부가 응답 메타 (`fallback`/`reason`/`detail`) 에 실패 사유 박제 → 브라우저 콘솔에서 즉시 진단.
  - **phrase-of-day fallback 도 DB upsert** — Claude 실패 / API 키 누락 시에도 fallback content ("안녕하세요" 등) 를 실제 DB row 로 저장 → `phrase_id` 가 실제 UUID. grammar / quiz / streak / progress 등 phrase_id 가 UUID 라고 가정하는 API 가 자연 동작. DB upsert 마저 실패할 때만 sentinel id (`fallback-YYYY-MM-DD`) 응답.
  - **partial unique index 와 PostgREST upsert 비호환** — `uniq_korean_phrases_featured_date` 가 `WHERE featured_date IS NOT NULL` partial index. PostgreSQL `INSERT ... ON CONFLICT (col) DO UPDATE` 는 partial index 매칭을 위해 WHERE 절을 spell out 해야 하지만, PostgREST `on_conflict` 파라미터는 컬럼명만 전달 → PG 가 매칭 index 못 찾아 42P10 에러. 첫 INSERT 만 통과, 두 번째 이후 silent 실패. **명시적 SELECT → INSERT or UPDATE** 패턴 + race 시 23505 UPDATE 재시도로 회피.
  - **PostgrestError 상세 박제 헬퍼** — `formatPgError(err)` 가 `code` / `message` / `details` / `hint` 를 단일 문자열로 압축. console + response.detail 양쪽 동일 포맷.
- 이유:
  - tool_use 는 모델이 "JSON 출력해줘" 자유 텍스트 응답하다 마크다운 wrap·여백·코멘트 섞이는 silent 실패를 구조적으로 차단. filming-spots / drama-characters / korean-pack-generator 패턴 통일.
  - fallback 을 sentinel id 로만 응답하면 후속 API 가 UUID FK 위반 → 학습 흐름 단절. DB upsert 로 실제 UUID 보장이 가장 단순한 해결.
  - partial index ON CONFLICT 매칭은 PostgreSQL 자체 제약 (WHERE 절 필수). PostgREST 가 그걸 지원하지 않으므로 client-side 명시 분기가 유일.
- 대안으로 고려했던 것:
  - 자유 텍스트 + JSON parse 강화 — 모델 응답 형식 변화에 취약. 클리닝 로직 누적.
  - UUID 가드를 호출 API 마다 — phrase-of-day 가 single source 로 항상 UUID 보장이 더 간결.
  - partial index 제거 + 일반 unique 사용 — featured_date NULL 허용해야 학습용 phrase (non-featured) 저장 가능. partial index 가 의도된 제약.

## 2026-05-18 HangeulGo — famous-dramas 가 학습 컨텐츠 canonical 시드, ingest 가 TMDB 자동 보충

- 결정 내용:
  - **`lib/korean/famous-dramas.ts` 20편이 학습 컨텐츠 시드의 단일 진실원**. ingest-korean-phrases cron 이 본 리스트만 iterate. dramas 테이블 popularity 순회는 아예 제거.
  - **누락 드라마 자동 보충** — famous 항목이 dramas DB 에 없으면 `searchTv(famous.en)` → KR origin 필터 → 정확 매치 우선 (`name`/`original_name`) → popularity fallback → `fetchTvDetail(expanded=true)` → `buildDramaUpsertRow` → upsert. EN 0건이면 KO 재시도.
  - **`lib/api/tmdb.ts` `searchTv`** 신규 — `/search/tv?query=...` 24h 캐시. 호출부에서 KR origin 필터.
  - **`lib/ingest/dramas.ts` `buildDramaUpsertRow`** export — 내부 `buildRow` 를 외부에서도 단일 드라마 강제 upsert 시 재사용. **장르 필터 우회** — famous-dramas 는 신뢰 시드라 Reality/Talk 같은 변종 (예능) 도 그대로 통과.
  - **결과 필드 `auto_added_dramas` / `auto_add_failures`** 추가 + 어드민 cron summary 분기 갱신.
- 이유:
  - dramas 테이블은 TMDB popularity 1~8p / top_rated 1~3p 기반이라 구작 (Signal 2016, SKY Castle, Mr. Sunshine) 누락 빈번. famous-dramas 와 분리 운영하면 학습 시드 매칭 실패 → phrase 생성 데드락.
  - **famous-dramas.ts 만 유지보수하면 dramas DB 가 자동 따라오는 단방향 데이터 흐름** — 사용자 운영 부담 최소화. 예능 확장 시에도 한 줄 추가만으로 자동 dramas 등록 + 표현 생성.
- 대안으로 고려했던 것:
  - dramas ingest 에 PRIORITY_TMDB_IDS 추가 (filming-spots 패턴) — TMDB ID 박제 부담 + famous-dramas 와 dramas ingest 둘 다 관리 필요. 단일 진실원 원칙 위배.
  - Claude 가 모르는 드라마는 자동 skip — Claude 가 드라마는 알아도 dramas DB 에 row 없으면 drama_id NULL → packs / 모달 연결 실패. DB row 확보가 우선.

## 2026-05-18 Drama Learning Packs — phrase-having drama only (popularity filler 제거)

- 결정 내용:
  - `/api/korean/packs` 가 **`korean_phrases.drama_id` 가 존재하는 dramas 만** 응답. popularity 기반 placeholder filler 제거.
  - 장르 필터 없음 — famous-dramas 가 학습 시드 단일 진실원이므로 예능 / 버라이어티도 시드에 들어가면 자연 노출.
  - 포스터 없는 row 는 carousel UX 보호 위해 `.not("poster_url", "is", null)` 유지.
  - 정렬: popularity desc → rating desc. limit 없음 (famous 시드 크기 ~20 으로 자연 bounded).
- 이유:
  - Learning Pack 의 정의는 "학습 표현이 있는 드라마". phrase 0건 placeholder 는 cosmetic 일 뿐 학습 의미 없음 + 클릭 시 빈 모달로 동선 끊김.
  - 이전 정책 (PACK_LIMIT=20 + popularity desc 로 자른 뒤 phrase 카운트) 은 Signal 같은 popularity 낮은 famous drama 가 phrase 6개 있어도 응답 누락하는 버그의 원흉.
- 대안으로 고려했던 것:
  - Hybrid (phrase-having 우선 + placeholder filler) — placeholder 카드는 클릭 시 "Expressions coming soon" 빈 모달이라 학습 의미 0.
  - Limit 늘리되 정렬은 그대로 — popularity cutoff 가 본질 문제라 limit 만 늘려도 한계.

## 2026-05-18 HangeulGo — 오늘의 표현 Next expression 랜덤 회전 + 퀴즈 phrase 기반 sync

- 결정 내용:
  - `/api/korean/phrase-of-day?exclude_ids=uuid1,uuid2,...` opt-in 랜덤 모드. 파라미터 없으면 기존 featured 동작 그대로.
  - 랜덤 모드: korean_phrases 에서 exclude_ids 제외 + limit 50 풀 → JS Math.random pick.
  - 풀 소진 시 `{ phrase: null, exhausted: true }` 응답 — 프론트가 이력 리셋 + 빈 exclude_ids 재요청.
  - UUID v4 정규식 sanitize — fallback sentinel ("fallback-...") 같은 비-UUID 자동 제거해 PostgREST 400 회피.
  - 프론트: `seenPhraseIds` 세션 단위 이력 (in-memory). Got it → streak POST + 토스트 + 자동 `advanceToNext()`. Next expression 텍스트 버튼은 streak 영향 없이 다음으로만.
  - **퀴즈 sync** — `/api/korean/quiz?phrase_id=<uuid>` 쿼리 파라미터 추가. 정답을 현재 phrase 로 일치 보장. Next 로 표현 바뀌면 useEffect 재호출 + selectedAnswer/quizResult 리셋. 우선순위: `phrase_id` 매칭 > 오늘 featured > HARDCODED_CORRECT.
- 이유:
  - 하루 1개 고정은 학습 의지 있어도 진도 제한. 단순한 Next 클릭 동선만 있어도 세션 깊이 ↑.
  - 세션 이력은 클라이언트 in-memory 가 단순 — localStorage 도 불필요 (새 세션은 다시 시작이 직관적). 서버 stateless 유지.
  - 퀴즈가 표현과 따로 노는 건 학습 일관성 깨짐 — phrase_id 기준 sync 가 자연.
- 대안으로 고려했던 것:
  - 서버 세션 이력 (Supabase user_learning_progress) — 비로그인 동작 불가, RLS 복잡도. 클라이언트 in-memory 가 단순.
  - phrase-of-day 와 별도 라우트 (`/api/korean/phrase/random`) — 단일 라우트가 모드 분기로 더 응집. 호출처 1곳에서 두 endpoint 호출하는 복잡도 회피.

## 2026-05-18 Curation K Phase 1 → Live (사이트 전체 Soon → Live 정리)

- 결정 내용:
  - Curation K (M+5) Phase 1 출시 완료 → 사이트 전체 노출 정리. **SERVICES_META 단일 source 라 status flag 만 바꾸면 헤더 드롭다운·로드맵 모달·footer SOON 배지가 일괄 정리**.
  - `components/header.tsx` SERVICES_META — Curation K / HangeulGo / KdramaMatch 모두 `"live"`. KfoodKit 만 `"soon"`.
  - **bento / about / pricing / faq** — Curation K 6번째 카드/항목 추가 + "5 → 6 services" 카피.
  - **roadmap-modal** "Three live, three soon" → "Five live, one soon".
  - **early-access-banner** "New services launching soon" → "KfoodKit launching soon" (대상 단수화).
  - **mypage/learning** "HangeulGo launching soon" placeholder 제거 → "Start learning Korean today." + Open HangeulGo CTA.
  - **오늘의 표현 드라마 태그 강화** — Film 아이콘 + "Today's drama ·" 라벨. **phrase.dramaId 일치 Pack 카드 "Today" 배지**.
- 이유:
  - KdramaMatch / HangeulGo / Curation K 모두 실제 서비스 중. Soon 표기 유지 시 사용자 혼란 + 신뢰도 손상.
  - status flag 단일 source 라 maintenance 부담 0.
- 대안으로 고려했던 것:
  - "5 services" phrasing 그대로 두고 status flag 만 변경 — copy 불일치 (Curation K live 표기인데 "5 services" 라 비논리). 한 번에 정리가 청결.

## 2026-05-17 HallyuBot Discord 봇 — REST + multi-server enrollment

- 결정 내용:
  - **Discord 봇 신규 구현** — 일일 자동 포스팅 4채널 + 슬래시 명령 6종 (`/comeback /chart /drama /korean /about /setup`).
  - **`discord.js` 미사용** — Vercel serverless 환경에 WebSocket gateway 부적합. REST API (fetch) + Node 내장 `crypto.verify` (Ed25519 native, SPKI prefix wrapping) 으로 충분. 외부 패키지 0 추가.
  - **Multi-server enrollment** — `discord_server_settings` 테이블 (`migration 0024`, guild_id PK + 4 채널 ID, RLS service_role only). `/setup` 슬래시로 enrollment.
  - **`/setup` 권한** — `default_member_permissions: "32"` (MANAGE_GUILD) Discord 클라이언트 단 숨김 + interaction body `member.permissions` bitmask BigInt 검증 이중 가드.
  - **부분 upsert** — `/setup` 이 옵션 일부만 지정해도 기존 settings 유지 (read-then-merge). Supabase `.upsert()` 가 전체 행 덮어쓰기라 수동 merge.
  - **Cron fallback 2층** —
    - settings 있는 서버: NULL 키 → `announcements` → `general` 순서 채널명 fetch
    - env `DISCORD_GUILD_ID` 만 있고 enrolled 안 된 서버: legacy 채널명(`daily-schedule` 등) 매핑
  - **HangeulGo 백엔드 미구현 우회** — `lib/discord/korean-phrases.ts` 35개 정적 표현 + `dayOfYear % length` 결정적 회전. HangeulGo 구축 시 `getDailyKoreanPhrase` 한 함수만 DB 조회로 교체.
  - **vercel.json cron** — `0 9 * * *` (UTC 09:00 = KST 18:00). 사용자가 한국 저녁 시간대 노출 의도.
- 이유:
  - Discord 커뮤니티는 출시 전 Early Access 단계의 핵심 채널. 일일 자동 포스팅으로 활성 유지 + 슬래시 명령으로 supplemental 기능 제공.
  - serverless 환경 + 단순 요구사항 (REST 4-5 호출) → discord.js 의 gateway·캐시 인프라 불필요. CLAUDE.md §9 "가장 단순한 방법".
  - Multi-server enrollment 은 봇이 외부 서버에 초대될 가능성 대비 (현재는 본인 서버 1개지만 구조만 미리). DB 미존재 서버는 env fallback 으로 backward compat.
- 대안으로 고려했던 것:
  - `discord.js` — gateway·event 추상화 좋지만 serverless 와 안 맞고 번들 400KB+. 매 cron 호출마다 client 초기화 비용.
  - `discord-interactions` npm — Ed25519 검증 헬퍼지만 Node 19+ 의 내장 `crypto.verify` + SPKI prefix 12바이트로 동일 효과. 외부 의존 불필요.
  - Single-tenant cron (env DISCORD_GUILD_ID 하드코딩만) — multi-server 확장 시 재설계 부담. enrollment 패턴 미리 적용해 future-proof.
  - HangeulGo 표현을 Claude Haiku 매일 생성 — 정해진 표현 회전이 cron + `/korean` 일관성 + 비용 0 + 결정적. Phase 1 단순함 승.
- 사용자 액션 (배포 후):
  1. Supabase SQL Editor 에서 `supabase/migrations/0024_discord_server_settings.sql` 실행
  2. Discord Developer Portal → INTERACTIONS ENDPOINT URL = `https://unfoldk.com/api/discord/interactions` 등록 (PING 자동 검증)
  3. Bot OAuth invite — `bot` + `applications.commands` 스코프, `Send Messages` + `Embed Links` + (선택) `View Channels` 권한
  4. 슬래시 명령 등록: `curl.exe -H "Authorization: Bearer $env:CRON_SECRET" https://unfoldk.com/api/discord/register-commands`
  5. 서버에서 관리자로 `/setup schedule:#... charts:#... drama:#... korean:#...`

---

## 2026-05-16 결제 연동 전 임시 Free 확대 정책

- 결정 내용:
  - Lemon Squeezy 결제 연동 전까지 Free 유저 게이팅 완화. 결제 가동 시 복원 예정.
  - **HallyuCalendar**: Upcoming events 3개 blur 게이트 `!isPro` → `!isLoggedIn` (Free 무제한). Artist tracking banner 도 비로그인만 노출. (`app/calendar/page.tsx`)
  - **KpopStats**: `visibleLimit` 분기에서 Free Top 10 → Top 20 (Pro 와 동일). (`app/kpop/page.tsx`)
  - **KdramaMatch**: ANON=3, FREE=5, PAID=30 — 이미 spec 일치. 변경 없음. (`app/api/dramas/recommend/route.ts`)
  - **Pro 잠금 UI copy 통일**: 모든 Pro 잠금 카드 "Coming with Hallyu Pass" + "Notify me at launch" 패턴. 영향 파일 5개 — calendar (UpgradeModal), kpop (Artist Comparison), drama (AI Summary), korean (AI Grammar), curation-k (AI 1-Day Course), food (gochugaru / shopping list × 2). 기존 "Upgrade — $15/month" 직접 결제 카피는 결제 연동 후 복원.
  - **Concert / Fan Meet 이벤트 (RLS `is_premium`)**: 코드만으론 못 풀고 DB 정책 변경 필요 → Pro 유지 (변경 시 RLS 추가 결정 필요).
  - **CLAUDE.md §6** 에 임시 정책 테이블 + 복원 가이드 박제. 결제 연동 시 grep 으로 `// 2026-05-16 임시 정책` 일괄 검색 가능.
- 이유:
  - 결제 인프라 미준비 상태에서 Pro 잠금만 강하게 노출하면 "사용 못하는 서비스" 인상. Free 체험 폭을 넓혀 데모 단계 가입·유지율 확보.
  - Pro 잠금 UI 자체는 유지 — Pro 가치 시그널은 보여주되 결제 압박은 제거 ("Notify me at launch" 톤).
- 대안으로 고려했던 것:
  - 모든 Pro 잠금 제거 → Pro 가치 시그널 사라져 출시 후 전환 어려움.
  - 잠금 유지하고 Pro 무료 부여 → 결제 인프라 부재 시 임시 코드 분기 필요. 더 복잡.
  - DB 레벨 RLS 까지 풀기 → Concert/Fan Meet 노출되지만 결제 연동 시 데이터 노출 정책 재검토 부담.
- **복원 방법** (결제 연동 시 별도 commit):
  - 각 변경 위치에 `// 2026-05-16 임시 정책` 주석 박제됨 — grep 으로 일괄 찾기.
  - CLAUDE.md §6 의 "복원 후" 컬럼이 정확한 회귀 상태.

## 2026-05-16 Curation K Phase 1 — TourAPI + Claude 촬영지 추출 + 7 섹션 페이지

- 결정 내용:
  - migration `0023_curation_k.sql` — `filming_spots`, `kpop_spots`, `hallyu_courses` 3 테이블 + RLS + `updated_at` 트리거. drama_id / artist_id / user_id 는 모두 **uuid** (스펙은 integer / auth.users 였으나 프로젝트 컨벤션 따라 정정 — `dramas.id` / `kpop_artists.id` 가 uuid, CLAUDE.md §5 단일 users).
  - `lib/api/tourapi.ts` — KorService2 6 메서드 (locationBasedList2 / searchKeyword2 / areaBasedList2 / detailImage2 / searchFestival2 + 음식점·숙박 wrapper). **Decoding 키** 사용 명시. `items.item` 4 케이스 정규화. `mapx`/`mapy` 문자열 → number 가드.
  - `lib/curation-k/filming-spots.ts` — Claude Haiku `tool_use` (`report_filming_spots`) 로 드라마별 1~5개 촬영지 + 신뢰도 추출. TourAPI `searchKeyword` 매핑. `confidence ≥ 0.5` + GPS 매핑 성공 → `confirmed`, 그 외 `pending`. `__no_spots_found__` 더미 row 로 미지 드라마 재시도 차단. 일 cap 5 dramas × 5 spots = 25 신규/일.
  - `lib/api/lastfm.ts` 확장 — `getGeoTopArtists(country, limit)` 추가. geo widget 용.
  - cron `/api/cron/ingest-filming-spots` 매일 03:00 UTC. `vercel.json` 등록.
  - 새 API 6개: `/api/curation-k/{map,filming-spots,kpop-spots,food,stays,geo-artists}`. Food/Stays 는 TourAPI 라이브 호출, Map/Filming/Kpop 은 DB read, Geo 는 Last.fm + kpop_artists 매칭 join.
  - `/curation-k` 페이지 — Coming Soon 마케팅 페이지에서 본격 7 섹션 페이지로 전면 교체. 기존 SVG 한국 polygon + projection 인프라 보존. 카테고리 4종 토글 (`Video`/`MicVocal`/`UtensilsCrossed`/`Hotel`) + 색상 분리 (filming `#FF4B6E` / kpop `#a855f7` / food `#f59e0b` / stays `#22c55e`). AI 1-Day Course = Pro 잠금 UI (Phase 2 에서 Claude 생성 결합).
  - CLAUDE.md §6 새 subsection 2건 (Curation K TourAPI 원칙 / filming_spots 신뢰도 정책) — `feedback_deprecated_warnings` 패턴.
- 이유:
  - TourAPI 는 한국관광공사 공식 데이터 — 음식점·숙박·관광지·이미지 GPS 메타 무료 라이선스로 글로벌 한류 팬에게 정확한 정보 제공 가능.
  - 촬영지는 공개 데이터셋 부재 → Claude Haiku 가 학습 지식으로 추출 + TourAPI 로 GPS 검증 하이브리드. confidence 분기로 할루시네이션 격리.
  - 페이지 전면 교체 결정 — Curation K 가 더 이상 Coming Soon 이 아니라 실데이터를 가진 서비스. 사전등록 폼 제거 (실데이터로 직접 가치 전달).
- 대안으로 고려했던 것:
  - 스펙대로 `drama_id integer` → `dramas.id` 가 uuid 라 type mismatch → 정정 불가피.
  - 촬영지를 수동 큐레이션만 → 초기 시드 N개 부족. Claude 자동 추출 + 사람 검토(pending → confirmed) 가 운영 부담 적음.
  - TourAPI 클라이언트에 SDK 도입 → 의존성 무게 대비 6 메서드 fetch wrapper 가 충분.
  - 페이지 라이브 데이터 없이 Coming Soon 유지 → 사용자 명시 "본격 구현" 요청 정면 위배.
- **Phase 2 carry-over**:
  - AI 1-Day Course Claude 생성 파이프라인 (Pro 라우트 + `hallyu_courses` 저장 UI + 코스 조회 페이지)
  - KdramaMatch 시청 이력 기반 개인화 코스
  - "촬영지 근처 숙박" 자동 큐레이션 (haversine + filming_spots GPS join)
  - 고캠핑 API 통합 (별도 API 키 + 약관 검토 필요)
  - 어드민 K팝 성지 시드 UI (현재 kpop_spots 는 어드민 직접 INSERT 만)
  - 어드민 filming_spots pending 검토 큐 UI
  - 한국 SVG 지도 고도화 (광역시도 폴리곤 hover, 핀 클러스터링)

## 2026-05-16 KOPIS API 비활성화 — 글로벌 유저 부적합

- 결정 내용:
  - **vercel.json** 에서 `/api/cron/ingest-kopis` 스케줄 제거.
  - **삭제** — `app/api/cron/ingest-kopis/route.ts`, `lib/ingest/kopis.ts`, `lib/api/kopis.ts`.
  - **참조 정리** — `app/admin/cron/page.tsx` (ROUTES 배열·result_json 분기), `app/api/admin/cron/run/route.ts` (zod enum), `lib/ingest/ticketmaster.ts` / `lib/api/ticketmaster.ts` / `app/api/cron/ingest-ticketmaster/route.ts` (KOPIS 언급 주석), `app/api/calendar/events/route.ts` · `app/api/mypage/calendar/route.ts` · `app/calendar/page.tsx` (필터 주석).
  - **유지** — `.neq("source_api", "kopis")` 필터는 캘린더 라우트들에 잔존 데이터 보호용으로 유지. DB 행 자체는 보존 (필요 시 SQL 로 삭제).
  - **유지** — `lib/ingest/ticketmaster.ts` 의 한국(KR) 제외 정책. KOPIS 와의 중복 회피 목적이었으나, 글로벌 유저 대상 서비스라는 정책 자체로도 합당.
  - CLAUDE.md §7 hazard 추가 — 재가동 방지 영구 박제.
- 이유:
  - KOPIS 는 국내 공연 데이터(prfnm, fcltynm, 한국 venue·티켓처 등) 만 제공. UnfoldK 는 영어권 + 동남아 글로벌 유저 대상 (CLAUDE.md §1) → 콘텐츠-사용자 mismatch.
  - Melon Ticket 외부 링크 보강 검토 carry-over 도 동일 mismatch 해결 못 함 (Melon 도 국내 결제·약관).
  - 글로벌 K팝 공연은 Ticketmaster 가 영어권 venue·티켓 페이지·다국가 통화 모두 커버.
- 대안으로 고려했던 것:
  - Soft disable (cron 만 제거 + lib 보존) → dead code. 1년 후 재가동 안 할 거면 의미 없음.
  - KOPIS 한국어 메타를 영어 자동 번역 → 운영 비용 + 정확도 리스크. 근본적으로 venue/티켓이 한국 전용이라 번역해도 글로벌 유저 활용 불가.

## 2026-05-16 KdramaMatch Phase 1 — 시청 목록 평점·리뷰 + 지금 인기 + /drama 개편

- 결정 내용:
  - migration `0022_watchlist_rating_review.sql` — **`user_watchlist` 에 `rating numeric(2,1)` + `review text` 컬럼 추가** (스펙은 새 `drama_watchlist (tmdb_id)` 테이블이었으나 기존 0014 호환 우선).
    - 0~5 별점 0.5 단위 (DB check + zod multipleOf 이중 가드), review ≤500자.
    - 인덱스 `idx_watchlist_created_drama` 신설 — trending 핫패스.
  - `/api/dramas/watchlist` PATCH 확장: `rating` / `review` 필드. 빈 review → null 정규화. POST 는 status·current_episode 만 upsert (rating·review 보존).
  - `/api/dramas` 필터 확장: `status[]` / `min_rating` / `min_episodes` / `max_episodes` / `sort=rating|year|episode_count`. 기존 `genre`/`platform`/`year`/`q` 유지.
  - `/api/dramas/trending` 신규 — service_role 로 user_watchlist 집계. 최근 7일 신규 등록 Top 5 + 완주율 (status='completed' / 전체 행, sample_size≥5 일 때만). 5분 SWR 캐시.
  - `/mypage/dramas` 전면 구현 — Coming Soon → 탭 (Want/Watching/Completed) + 에피소드 진행 바 + 별점 0.5 단위 (반쪽 클릭) + 한줄평 ≤500자 + 상태 빠른 전환 + 마지막 화 도달 시 completed 자동 전환.
  - `/drama` Phase 1 개편:
    - Hero 카피 "AI-powered K-drama recommendations, just for you" + 게이팅 안내 (anon 3 / Free 5 / Pro 무제한).
    - **Trending now** 섹션 신규 (가로 스크롤 Top 5, 완주율 표시).
    - Browse 필터 확장 (Genre / Status / Year 칩), 카드에 status pill 좌상단, episode 수 표시.
    - AI Drama Summary — Pro 잠금 유지 + "Similar dramas" 카드 추가 (3-up 그리드).
    - 인라인 watchlist 섹션 제거 → "Manage my dramas →" CTA 로 `/mypage/dramas` 유도.
- 이유:
  - 기존 0014 의 `user_watchlist (drama_id uuid → dramas.id)` 가 `/api/dramas/watchlist` 와 동작 중 → 스펙 신규 테이블 채택 시 마이그레이션·재작성 부담 대비 효용 적음. ALTER 가 정직한 단순 해결 (CLAUDE.md §9).
  - Trending 은 service_role 집계 — `user_watchlist` RLS 가 본인 행만 노출하므로 글로벌 집계 불가. 응답은 drama 메타 + 카운트만 (개인 식별 정보 없음).
  - 0.5 단위 별점은 UI 가 한 별을 좌/우 반쪽으로 분할해 클릭 위치별 다른 값 전송 (요구 사양 충족, 단순).
- 대안으로 고려했던 것:
  - 스펙대로 `drama_watchlist (tmdb_id)` 신설 → 기존 데이터 마이그레이션 + API/UI 동시 교체 부담. 같은 도메인 두 테이블 장기 혼란.
  - Trending 을 RPC 함수로 → PostgREST 호출 단순화 가능. 현재 5건 규모라 in-memory 집계 충분.
  - 별점 0.1 단위 → UX 과잉.
- **Phase 2 carry-over (별도 인제스트 인프라 필요)**:
  - TMDB `networks` (방송사 — tvN/Netflix/KBS) 컬럼 + ingest 보강
  - TMDB `on_the_air` 리스트 + `tv/{id}` detail.next_episode_to_air → "방영 중 D-Day" 섹션 + 캘린더 추가 버튼
  - 드라마-캘린더 매핑 정책 결정 (어떤 단위로 hallyu_calendar_events 로 push)
  - OST 아티스트 데이터셋 (KpopStats 연결)
  - UnfoldK 유저 평점 집계 노출 (rating 누적 후 의미 있음)

## 2026-05-16 블로그 댓글 시스템 — blog_comments 테이블 + RLS

- 결정 내용:
  - migration `0021_blog_comments.sql` — `public.blog_comments` 테이블 신설.
  - 컬럼: id uuid PK / slug text NOT NULL / user_id uuid (public.users FK ON DELETE CASCADE) / content text CHECK (1~1000자) / created_at / updated_at + updated_at 자동 갱신 트리거.
  - 인덱스 2개: (slug, created_at desc) 핫패스, (user_id, created_at desc) 향후 "내 댓글" 대비.
  - RLS 5개 정책: select 전체 공개 / insert 본인 / update 본인 / delete 본인 + 관리자 `public.is_admin(auth.uid())`.
  - GRANT: 0013/0015 패턴 — anon/authenticated select, authenticated CRUD, service_role full.
  - **slug 는 외래키 없는 text** — 블로그 포스트는 `content/blog/*.mdx` 파일 시스템에 있어 DB 참조 불가. 잘못된 slug 로 작성돼도 단순 고아 row, 무결성 영향 없음. API zod regex `^[a-z0-9-]+$` 로 1차 차단.
  - **user_id 는 `public.users(id)` 참조** (스펙은 auth.users 였으나 프로젝트 단일 users 정책 + UI 가 name/avatar_url join 필요).
  - API `/api/blog/[slug]/comments`: GET (목록 + service_role 프로필 batch join, 민감 필드 제외) / POST (RLS 본인 강제, 응답에 프로필 동봉) / DELETE `?id=uuid` (본인+관리자 RLS, 0 row 삭제 시 403).
  - UI `components/blog/blog-comments.tsx`: 로그인 분기 — 로그인 시 textarea+post, 비로그인 시 StartModal 트리거 (next = 현재 URL `#comments` fragment). 본인 댓글 카드만 휴지통 버튼. 상대 시각은 date-fns `formatDistanceToNow`.
  - `app/blog/[slug]/page.tsx` 하단에 `<BlogComments slug={post.slug} />` 마운트.
- 이유:
  - 자체 댓글로 외부 의존 (Disqus 등) 제거 + 다크테마·브랜드 일관성 + GDPR/저작권 단순화 (자체 DB 만 관리).
  - slug 외래키 미설정 으로 마이그레이션 의존성 0 — 블로그가 파일 기반이라 자연스러운 결정.
  - RLS 본인 가드 + service_role 프로필 join 분리는 0015 (content_reports) 패턴과 동일 — 일관성.
- 대안으로 고려했던 것:
  - Disqus/Giscus 임베드 → 외부 도메인 의존·다크테마 커스터마이즈 부담. 자체 구현이 단순.
  - blog_posts 테이블로 포스트도 DB 화 후 FK → blog 운영을 파일/DB 이중 관리. 콘텐츠 cron 도 두 곳에 push 필요.
  - user_id auth.users 직접 참조 (스펙대로) → users join 위해 추가 fetch 필요 + CLAUDE.md §5 단일 users 위배.

## 2026-05-16 블로그 자동 포스팅 cron — Anthropic + Unsplash + GitHub Contents API

- 결정 내용:
  - 신규 cron `/api/cron/generate-blog-post` 매일 08:00 UTC (vercel.json 추가).
  - 시퀀스: ① GitHub `/contents/content/blog` listing 으로 오늘 날짜 prefix 파일 존재 시 멱등 skip → ② Claude Haiku 4.5 `claude-haiku-4-5-20251001` tool_use (`publish_blog_post`) 로 토픽 선택 + 본문 (600~1200 단어) + 메타 구조화 출력 → ③ Unsplash `/search/photos?orientation=landscape&content_filter=high` 1위 결과 사용 + download beacon fire-and-forget → ④ GitHub Contents API PUT 으로 `content/blog/YYYY-MM-DD-{slug}.mdx` 신규 생성.
  - 토픽 풀 5종 (`lib/blog-gen/topics.ts`): 이번 주 K팝 컴백 / 신작 K드라마 / 차트 분석 / 한국어 표현 / K푸드 레시피. Haiku 가 매일 1개 선택. 확장은 reviewer 검토 후.
  - Haiku 출력 schema 코드 측 재검증: topicId enum / title 10–100자 / slug kebab-case 80자 / description ≥30자 / tags 1–6개 / bodyMdx 800–8000자 + frontmatter·H1 혼입 차단.
  - frontmatter 확장 (`lib/blog.ts`): `image` (cover alias 우선) / `imageCredit` / `readingTime` (override) — 기존 `cover` 는 하위 호환.
  - Unsplash credit 노출: ① 본문 footer 자동 추가 (`---` 구분 후 author·photoPageUrl·Unsplash 링크), ② frontmatter `imageCredit` 도 상세 페이지 cover 하단 figcaption 으로 표시.
  - 멱등성: GitHub 디렉토리 listing 으로 오늘 prefix 검사. 같은 path 추가 충돌 시 `putFile` 도 409 dup 처리. 200 응답 + `duplicate:true`.
  - 인증: 기존 `verifyCronAuth` (CRON_SECRET Bearer) 재사용.
  - 신규 환경변수: `UNSPLASH_ACCESS_KEY` / `GITHUB_TOKEN` (contents:write) / `GITHUB_REPO` (`owner/repo`) / `GITHUB_BRANCH` (옵션, 기본 `main`).
  - 신규 의존성: `next-mdx-remote@^6.0.0`, `gray-matter@^4.0.3` (블로그 인프라). Anthropic SDK 는 기존.
- 이유:
  - 일일 콘텐츠 발행 자동화로 SEO·신선도 확보. 운영 비용은 Haiku 1포스트 ≈ $0.0075/day (연 $2.7).
  - GitHub push → Vercel auto-deploy 흐름으로 별도 CMS·DB 불필요. 콘텐츠도 코드와 함께 버전 관리 (PR·revert 자유).
  - Haiku tool_use 로 JSON.parse 실패 위험 0. enum + 코드 측 재검증 2중 방어로 정책 위반 출력 방지.
  - Unsplash 무료 (free tier 50 req/h, 일 1회 = 여유). 가이드라인 (이름·UTM·download beacon) 준수.
- 대안으로 고려했던 것:
  - draft:true 발행 후 어드민 승인 큐 → 운영 부담. 스펙은 자동 발행 (draft:false) 요구.
  - Notion/Sanity 등 외부 CMS → 인프라 추가. GitHub 만으로 충분.
  - 토픽 자동 확장 (검색 트렌드 기반) → 품질 검증 부담. 5개 풀로 시작.
  - `@octokit/rest` SDK → 단일 엔드포인트라 fetch 직접 사용으로 의존성 절감.

