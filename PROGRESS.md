# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.

---

## 현재 상태 (2026-05-20 세션 19 / KfoodKit M+4 출시 — 537 레시피 + 이미지 backfill 3-phase + 어드민 콘솔 + 6 services live)

> KfoodKit 을 "soon" 상태에서 **live 출시 단계로 전환**. 단일 세션 안에서 5 단계 인프라 + UX 구축:
> ① **데이터 소스 확정** — Spoonacular($29/월) → 농림수산식품교육문화정보원 무료 API 로 전환, 실제 엔드포인트 검증해 `http://211.237.50.150:7080/openapi/{KEY}/json/{GRID_ID}/{startRow}/{endRow}` 패턴으로 wrapper 작성. 3 grid (기본 537 / 재료 6,104 / 과정 3,022) 전체 fetch + RECIPE_ID 메모리 join. 데이터 0건 → 537 영구 고정 캐탈로그.
> ② **이미지 backfill 3-phase** — MAFRA 응답에 이미지 필드가 없어 식약처 COOKRCP01 (1,146건) 연동. Phase 1 정규화 매칭, Phase 2 Claude Haiku 정규화 후 재매칭 (오타·띄어쓰기 보정), Phase 3 Claude 영문 쿼리 → Unsplash fallback (rate-limit cap 40/run). `image_source` 컬럼으로 출처 추적 (mfds/unsplash/upload/manual). 카드·모달에서 unsplash 일 때 "Photo from Unsplash" 출처 표기.
> ③ **/food 페이지 풀스택** — Popular K-Drama Recipes 페이지네이션 (서버 페이징 + 300ms search debounce). This Week's K-Food Picks (Pro 전용, Claude 계절 기반 3-5 선정, `food_weekly_picks` week_start unique 캐싱 + 1주 revalidate). RecipeDetailDialog 상단 이미지 + 스크롤 가능 콘텐츠. 한글(영문) 병기 (모달 lazy 생성 + cron Phase 4 배치 backfill cap 30/run).
> ④ **Ingredient Finder 전면 재설계** — 기존 "재료 1개 → 대체 재료" → "음식명 1개 → 전체 재료 sourcing breakdown" 변환. tool_use schema: `items[] = { ingredient_ko, substitute_en, store, difficulty: Easy|Medium|Hard }`. Shopping List 는 Pro 잠금 해제하고 localStorage 영속화 + Add to List 버튼 + 체크 토글 + 호버 삭제 + **html2canvas PNG 다운로드** (`unfoldk-shopping-list.png` + unfoldk.com 워터마크).
> ⑤ **/admin/food 콘솔** — 어드민이 537 카탈로그를 직접 큐레이션. 필터(전체/이미지 있음/없음) + 검색 + 썸네일 + source 배지. 편집 다이얼로그: Supabase Storage `food-images` 버킷 (admin write only) 파일 업로드 OR URL 직접 입력 OR 이미지 제거.
>
> **부가 작업**:
> - Curation K cron 회귀: 매일 → 매월 1일 (`?only_festivals=true` 슬롯 매일 + 전체 슬롯 월 1회). Claude 비용 90% 절감.
> - Early Access 배너: 비로그인 전용 + `Start now` CTA (in-place StartModal) + "See what's coming" 제거 + 카피 교체.
> - 블로그 cover Unsplash: per_page 5→15 + URL slug 기반 중복 회피 (GitHub Contents API 로 최신 30 포스트 frontmatter image: 슬러그 수집) + 랜덤 pick.
> - 이미지 비율 통일: 카드·모달·어드민 모두 `aspect-video` (16:9) + `object-cover` (모달 콘텐츠 가독성 우선).
> - 6 services live 카피 정합 (terms / subscription / payment success / start / roadmap-modal / early-access notify 이메일 / header SERVICES_META).
>
> commits: `f385d9c` → `14e99e1` → `34de258` → `3238a58` → `f380148` → `947db7e` → `00bca32` → `1513907` → `ec4d2f0` → `de03329` → `cabad5b` → `62a5c87` → `2068b5d` → `5e459ec` → `662c6bc` → `c502c05` → `2c8c25b` → `d3bcff6` → `bde76b8`.

### 완료

#### A. KfoodKit DB 인프라 (0030 → 0034)

- **0030_kfoodkit.sql** — 4 테이블: `drama_foods` / `food_recipes` / `user_food_collections` / `food_challenges` + RLS (공개 read · 본인 전권) + service_role GRANT (0013 패턴).
- **0031_kfoodkit_mafra.sql** — Spoonacular 전환 직후 `spoonacular_id integer` drop → `mafra_rcp_seq text unique`.
- **0032_food_recipes_translations.sql** — `title_en` · `description_en` 컬럼 + `food_weekly_picks(week_start UNIQUE, theme, picks jsonb)` 캐시 테이블 + idx_food_recipes_translate_pending.
- **0033_food_image_source.sql** — `image_source text check (mfds | unsplash | NULL)` + 기존 image_url != null row 'mfds' 일괄 backfill + idx_food_recipes_image_pending.
- **0034_food_admin.sql** — `food-images` Storage 버킷 (public read · admin write only via `is_admin(auth.uid())`) + RLS policies + `image_source` check 동적 drop·재생성 ('upload' · 'manual' 추가).

#### B. MAFRA 인제스트 (`lib/api/mafra-recipe.ts` + `lib/ingest/food-recipes.ts`)

- 농림부 별도 호스트 `http://211.237.50.150:7080/openapi/{KEY}/json/{GRID_ID}/{start}/{end}` — serviceKey path 박힘.
- 3 grid: BASIC(226) / INGREDIENTS(227) / PROCESS(228) + `fetchAll<T>` 페이지 순회.
- 전체 537 fetch + 재료·과정 전체 fetch → RECIPE_ID 메모리 join → food_recipes upsert.
- cron 월 1회 (`0 6 1 * *`).

#### C. MFDS COOKRCP01 + Claude 정규화 + Unsplash fallback (3-phase backfill)

- `lib/api/mfds-recipe.ts` — `https://openapi.foodsafetykorea.go.kr/api/{KEY}/COOKRCP01/json/{startIdx}/{endIdx}`. 1000건/page 전체 순회. `http://` → `https://` URL 정규화. 메뉴명 NFC + 공백·구두점 제거 정규화.
- `lib/claude/recipe-name-normalize.ts` — Claude Haiku 배치(40개/호출) 정규화 ("김치찌게" → "김치찌개"). 입력 순서 보존, 실패 시 원본 fallback.
- `lib/claude/food-image-query.ts` — 한글 음식명 → "Korean {romanized} + 핵심 재료" 영문 쿼리. Unsplash 친화적 5-10 단어. fallback `Korean {원문} dish`.
- `lib/ingest/food-image-backfill.ts` — Phase 1 정규화 매칭 → Phase 2 Claude 정규화 후 재매칭 → Phase 3 Unsplash fallback (cap 40/run). 이미 채워진 row 보존.
- `lib/ingest/food-title-backfill.ts` — `title_en`=null row 배치 번역 (cap 30/run). 누적 3~4 cron 으로 완료.
- cron route (`app/api/cron/ingest-food-recipes/route.ts`) maxDuration 240, 3 phase 모두 독립 try/catch + CombinedPayload 응답.

#### D. /food 페이지 풀스택

- **API**:
  - `/api/food/recipes` — page · pageSize · category · search 페이징
  - `/api/food/recipes/[id]` — 상세 + title_en/description_en lazy Claude Haiku 생성·캐싱 + image_source 응답
  - `/api/food/weekly-picks` — Pro 게이팅 + week_start unique DB 캐싱 + revalidate=604800
- **Claude**:
  - `lib/claude/recipe-translate.ts` — title_en + description_en 한 tool_use 호출
  - `lib/claude/weekly-picks.ts` — `detectSeason` + `getWeekStart(UTC 월요일)` + 후보 50건에서 3-5 picks + theme. recipe_id 화이트리스트로 hallucination 차단
- **UI**:
  - `app/food/page.tsx` — 정적 6 카드 → 실데이터 페이지네이션(12/페이지) + 300ms search debounce + smooth scroll. 카드: 한글(영문) + 카테고리 핀 + 난이도 + 칼로리·조리시간. 클릭 → 모달
  - `components/food/recipe-detail-dialog.tsx` — 상단 aspect-video 이미지 + flex-col scrollable 콘텐츠. 제목 옆 단일 Copy 아이콘 + shadcn Tooltip "Copy to Ingredient Finder". 재료(한글) · 조리법(한글 단계 핀). `image_source='unsplash'` 시 출처 표기
  - `components/food/weekly-picks-section.tsx` — Pro blur + "Coming with Hallyu Pass" + 비Pro placeholder picks
  - **Ingredient Finder 재설계**: 단일 재료 → 음식명 전체 sourcing breakdown 변환. `lib/claude/ingredient-finder.ts` `findIngredient` → `findDishIngredients`. items[] = { ingredient_ko, substitute_en, store, difficulty } + store 화이트리스트 검증 + difficulty enum 가드
  - **My Shopping List**: Pro 잠금 해제. localStorage hydrate→sync. Add to List / 체크 토글(취소선·핑크 체크) / 호버 X 삭제 / Clear all / 빈 상태 안내 / **html2canvas PNG 다운로드** (`unfoldk-shopping-list.png` 2x retina + 박스 하단 unfoldk.com 워터마크)

#### E. /admin/food 콘솔 + 사이드바

- `app/admin/food/page.tsx` — 서버 load (mafra_rcp_seq 정렬) + 통계 (전체 / 이미지 있음 / 없음)
- `components/admin/food-admin-table.tsx` — 필터(전체/with/without) + 검색 + 썸네일 + source 배지(mfds/unsplash/upload/manual 색상 구분) + 편집 다이얼로그
- `FoodImageEditDialog` — 파일 업로드 (JPG/PNG/WEBP 5MB, `food-images/{recipe_id}.{ext}` upsert + `?v={timestamp}` 캐시 우회) / URL 직접 입력 / 이미지 제거. 낙관적 업데이트 + useToast
- `/api/admin/food/[id]` PATCH — requireAdmin + zod (image_url URL, image_source enum) + null 정합 강제
- `components/admin/admin-sidebar.tsx` — KfoodKit 항목 추가 (`UtensilsCrossed`)
- 어드민 cron 카드 갱신 — metric 합산 (`upserted + phase1+2+3_updated + title_backfill.updated`) + 요약 분기

#### F. Curation K cron 회귀 (비용 절감)

- vercel.json: 매일 03:00 primary + 04:00 secondary → 매일 03:00 `?only_festivals=true` + 매월 1일 03:00 전체.
- `runTourSpotsIngest({ onlyFestivals })` — true 시 CATEGORIES=FESTIVAL(15) 만 + enrichment/translation 도 같은 카테고리만.
- 어드민 카드 metric: `stage='festivals'` 시 tour 만 / 그 외 tour + filming + kpop 합산.

#### G. 6 services live 카피 정합 (KfoodKit "soon" → "live")

- `components/header.tsx` SERVICES_META status 변경.
- `/food` 페이지 ServiceComingSoonBanner 제거.
- `components/early-access/roadmap-modal.tsx` "Five are live, one more arriving soon" → "All live now".
- `components/early-access/early-access-banner.tsx` 전면 재작성: 비로그인 전용 + `onAuthStateChange` 구독 + `Start now` CTA → StartModal 인플레이스 + "See what's coming" 제거 + 카피 교체 ("Track K-pop comebacks · Discover dramas · Learn Korean · Explore Korea | all in one place. Updated daily. Free to join.").
- `/api/early-access/notify` 이메일 — KfoodKit 을 live 리스트로 이동 + "All 6 services live" 섹션.
- `5 services` → `6 services` 4곳 정리: terms / mypage/subscription / payment/success / start.

#### H. 블로그 cover Unsplash 다양화

- `lib/blog-gen/unsplash.ts` — per_page 5→15, results[0] 고정 → 필터링 후 랜덤 pick. `excludeImageSlugs?: Set<string>` 옵션.
- `lib/blog-gen/used-images.ts` (신규) — GitHub Contents API 로 `content/blog/` 최신 30 MDX frontmatter `image:` 슬러그 (`photo-{timestamp}-{hash}`) 수집. listing 실패 swallow (dedup 불가해도 생성은 진행).

#### I. 어드민 cron 카드 ingest-food-recipes 등록

- `app/api/admin/cron/run` zod enum 에 `ingest-food-recipes` 추가 (누락 시 400).
- `cron-monitor.tsx summarizeRunResult` 분기 — 레시피 + 이미지 mfds/unsplash + 영문 backfill 카운트 상세 표시.

#### J. README.md 신규

- 레포 루트 README 영문 간결판 — 6 서비스 + 기술 스택 + 운영사 (UNFOLD LAB).

#### K. work/ 폴더 + 덤프 스크립트

- `scripts/dump-food-lists.ts` — Supabase food_recipes + MFDS COOKRCP01 전체 덤프.
- `work/mafra_list.txt` (537) + `work/mfds_list.txt` (1,146) 생성 — 어드민 수동 매칭 검토용.

#### L. 이미지 비율 통일

- 카드·어드민 테이블 썸네일·편집 다이얼로그 미리보기·모달 상단 모두 `aspect-video` (16:9) + `object-cover`.
- 모달 상단은 시도 차원에서 `aspect-[4/3]` → `aspect-video` 회귀 (콘텐츠 영역 가독성).
- 어드민 테이블 컬럼 순서·너비 재정렬: `seq(w-16) · image(w-28) · name · en · source(w-24) · action(w-20)`.

### 신규 의존성

- `html2canvas` — Shopping List PNG 다운로드용.

### 환경변수

- `MAFRA_API_KEY` — 농림부 레시피 API (Decoding 키 path 박힘 패턴).
- `MFDS_API_KEY` — 식약처 COOKRCP01.
- (Vercel 운영 env 등록 필요)

### 사용자 액션 필요

1. **Supabase SQL Editor 에서 마이그레이션 5개 순서대로 적용**:
   - `0030_kfoodkit.sql`
   - `0031_kfoodkit_mafra.sql`
   - `0032_food_recipes_translations.sql`
   - `0033_food_image_source.sql`
   - `0034_food_admin.sql`
2. **Vercel env 등록** — `MAFRA_API_KEY` / `MFDS_API_KEY` (이미 .env.local 채워짐).
3. **`/admin/cron` KfoodKit 카드 수동 트리거 3~4회** — 영문 backfill cap 30/run 누적으로 537건 모두 채울 때까지. Unsplash fallback 도 cap 40/run.

### 다음 세션 후보 (carry-over)

- **세션 18 carry-over 전체 유지** —
  - famous-dramas ↔ dramas 매칭 실측 검증 (어드민 cron 수동 실행 → `auto_added_dramas` 카운트 확인)
  - top.gg 심사 통과 후 봇 페이지 운영
  - /calendar / /today / /notify 슬래시 명령 추가
  - **세션 14 carry-over**: KdramaMatch Phase 2 잔여 / Curation K Phase 2 잔여 / 결제 가동 시 복원 / 세션 13 잔여
  - 블로그 cron 운영 안정화
- **KfoodKit Phase 2** — 드라마-음식 연계 (`drama_foods` Claude 자동 추출, 0030 테이블 비어있음). KdramaMatch dramas DB 기준 Claude 가 드라마별 등장 음식 자동 생성.
- **KfoodKit My Shopping List 정책 재검토** — 현재 전유저 사용 (CLAUDE.md §6 표 "Pro 유지" 와 상충). 결제 가동 시 Pro 잠금 복원할지 결정.
- **모달 attribution 가이드라인** — Unsplash 외 mfds/manual/upload 출처도 표기 의무화할지 검토.

### 블로커

- **top.gg 심사 1~2주 대기** — 외부 의존 (세션 15 carry-over)
- 세션 13 carry-over — 메인 페이지 hang + Ghost Globe 미작동

---

## 현재 상태 (2026-05-19 세션 18 / Curation K 카드 모달 탭별 분기 + K-Pop 모달 신규 + About 페이지 카피 리뉴얼)

> Curation K Phase 2 잔여 작업 마감. 카드 상세 모달이 탭별로 적절한 필드를 노출하도록 분기 (filming = Featured in 클릭 배지 + spot_description, festivals = 기간 칩, 그 외 = overview). K-Pop Pilgrimage 카드는 모달이 없었으나 신규 KpopSpotDetailDialog 로 visit_reason · homepage · GMaps(Pro) 노출. 이미지 갤러리 화살표가 일부 케이스 무반응이라는 보고에 functional update + stopPropagation/preventDefault 다중 방어. DB 측 영구화 — `0029_curation_k_descriptions.sql` 로 filming_spots.spot_description / kpop_spots.visit_reason · homepage 컬럼 추가, ingest 코드 동시 반영 (Claude 가 이미 추출하던 visit_reason 이 휘발되던 비효율 해소). About 페이지는 인디 개발자 소개 문구 + Educational Access 섹션 신설 + How it started 본문 교체, COPY.md 동기화.

### 완료

#### A. Curation K — SpotDetailDialog 탭별 분기 + 화살표 안정화

- **탭별 분기** (`app/curation-k/page.tsx` `SpotDetailDialog`):
  · `filming` — 좌상 배지를 "Featured in: <drama>" 형태로 변경하고 `<Link href="/drama">` 로 클릭 가능하게 (Curation K → KdramaMatch 교차 트래픽). 본문 description 은 `spot_description` 사용.
  · `festivals` — 본문 상단에 기간 칩 (subtitle = "YYYY-MM-DD ~ YYYY-MM-DD", API 가공).
  · 그 외 (attractions/food/stays/culture) — 기존 overview_en ?? overview_ko 패턴 유지.
- **화살표 prev/next 안정화** — `setImageIndex((prev) => …)` 함수형 update + `onMouseDown` · `onClick` 양쪽 `stopPropagation()` + `preventDefault()`. 가드를 `images.length > 1` → `realImages.length > 1` 로 명시해 placeholder 단독 시 화살표 미노출 의도 코드에 박제.
- **호환**: API 응답에 spot_description 등 새 필드가 NULL 로 와도 모달이 섹션 자체를 숨겨 회귀 없음.

#### B. K-Pop Pilgrimage 카드 상세 모달 신규 — `KpopSpotDetailDialog`

- kpop_spots 카드 클릭 시 모달이 없던 결함 해소.
- 구성: 단일 이미지 + 아티스트 배지 (좌상) + 카테고리 라벨 (우상) + 본문 visit_reason + 주소 + Official Website (homepage 있을 때만) + Google Maps (Pro 게이팅).
- Pro 잠금 UI: `"Coming with Hallyu Pass"` 패턴 통일 (CLAUDE.md §6 — 결제 가동 전 임시 정책 유지).

#### C. 0029 마이그레이션 + ingest 영구화

- `supabase/migrations/0029_curation_k_descriptions.sql` — 3 컬럼 idempotent 추가 (모두 nullable).
- `lib/curation-k/filming-spots.ts` — Claude tool `input_schema.spots.items.properties.description` 신규 + `ExtractedSpot.description` + insert payload 에 `spot_description` 포함.
- `lib/curation-k/kpop-spots.ts` — upsert payload 에 `visit_reason: meta.visitReason` 추가. (Claude 추출 로직 자체는 기존 그대로)
- `app/api/curation-k/spots/route.ts` — filming select 에 `spot_description` 추가, SpotItem 인터페이스에 `drama_id` / `spot_description` / `event_start_date` / `event_end_date` 노출. tour 매핑에 event 날짜 포함.
- `app/api/curation-k/kpop-spots/route.ts` — select 에 `visit_reason, homepage` 추가 + 인터페이스 확장.

#### D. tour-spots.ts 헤더 주석 정합 (e7c7016 로직과 일치)

- 헤더 주석 두 줄을 실제 동작 "당해년도 1/1 ~ 오늘+18개월" 로 정정. `FESTIVAL_FUTURE_MONTHS=18` + `new Date(today.getFullYear(), 0, 1)` 로직은 이미 적용된 상태였음.

#### E. About 페이지 4종 개선 + COPY.md 동기화

- `app/about/page.tsx` —
  · Hero lead 하단에 인디 개발자 소개 문단 추가 ("Built by a solo indie developer from Korea, …")
  · "How it started" 본문 교체 (UNFOLD LAB 정의 + UnfoldK 탄생 배경 압축)
  · "Educational Access" 신규 섹션 — GraduationCap 아이콘 + 제목 "Expanding the Possibilities of Hallyu Education Worldwide" + 본문 + "Request Educational Access" 버튼 → shadcn `<Dialog>` 모달 (subject 자동 채움 "Educational Access Request"). 폼은 신규 `components/contact-form.tsx` 단일 진실원 — `/contact` 페이지와 본 모달이 공유 (RedeemCouponForm 동일 패턴).
  · Mission Card / Stats / Services Grid / CTA 는 유지
- `COPY.md` — About 페이지 우산 아래 Hero / How it started / Educational Access 3 블록으로 재구성. 이전 "Empowering K-Culture Education Globally" 카피 폐기 메모 박제.

### 신규 의존성

- 없음.

### 사용자 액션 필요

1. **Supabase SQL Editor 에서 `0029_curation_k_descriptions.sql` 적용** — 적용 전엔 ingest 코드의 새 컬럼 upsert 가 unknown column 에러로 실패할 수 있음. 적용 후 다음 cron 부터 자동 채워짐.
2. **`/admin/cron` 에서 Curation K 통합 cron 수동 트리거** — 신규 row 부터 `spot_description` / `visit_reason` / `homepage` 자동 채워짐. 기존 row 는 NULL 유지 (모달에서 자연 미노출). festival 날짜 범위 (당해년도 1/1 ~ 오늘+18개월) 재수집도 동일 트리거로 처리.

### 다음 세션 후보 (carry-over)

- **세션 17 carry-over 전체 유지** —
  - famous-dramas ↔ dramas 매칭 실측 검증 (어드민 cron 수동 실행 → `auto_added_dramas` 카운트 확인)
  - top.gg 심사 통과 후 봇 페이지 운영
  - /calendar / /today / /notify 슬래시 명령 추가
  - **세션 14 carry-over**: KdramaMatch Phase 2 잔여 / Curation K Phase 2 잔여 / 결제 가동 시 복원 / 세션 13 잔여
  - 블로그 cron 운영 안정화

### 블로커

- **top.gg 심사 1~2주 대기** — 외부 의존 (세션 15 carry-over)
- 세션 13 carry-over — 메인 페이지 hang + Ghost Globe 미작동

---

## 현재 상태 (2026-05-18 세션 17 / AI → UnfoldK 카피 리브랜딩 + HangeulGo Got it 영구화 + LMS 새 탭·no-store·Redeem 모달)

> 사용자 노출 카피의 서비스 주체를 일관되게 "UnfoldK" 로 정렬 (벤더명·"AI" 단독 노출 제거 + CLAUDE.md 규칙 박제). HangeulGo "Got it" 후 페이지 재진입 시 같은 표현이 다시 나오던 UX 결함을 user_learning_progress 영구화로 해결. Lemon Squeezy 결제는 새 탭 오픈 + redirect 응답 Cache-Control: no-store 로 다른 계정 이메일 cross-contamination 차단. Subscription 페이지 쿠폰 입력은 /redeem 페이지 전체 이동 → 모달로 전환 (폼 컴포넌트 재사용).
>
> commit: `1b587b8` → `032b59d` → `300bee0` → `8c4e746` → `41fc932`.

### 완료

#### A. AI → UnfoldK 카피 일괄 리브랜딩 (`1b587b8`)
- **CLAUDE.md §6 신규 규칙 박제** — 사용자 노출 텍스트의 서비스 주체는 항상 "UnfoldK". 벤더명 (`Claude`/`Anthropic`/`Haiku`/`Sonnet`/`GPT`/`OpenAI`) 노출 금지. "AI" 단독 표기도 `AI picks` → `UnfoldK picks` / `AI-curated X` → `UnfoldK-curated X` 등 재라벨. 예외 명시 (코드 주석 / lib·app/api 내부 / admin UI / 법무 표기).
- **JSX 카피 치환 (10개 파일)** — about / drama / food / korean / curation-k / mypage/dramas / terms / header / bento-section / pricing-section. "AI Drama Summary" → "UnfoldK Drama Summary" / "AI Grammar Explanation" → "UnfoldK Grammar Explanation" / "AI-powered drama recommendations" → "UnfoldK drama recommendations" 등.
- **dead 컴포넌트 삭제** — `components/bento/ai-code-reviews.tsx` (어디서도 import 안 되는 v0 템플릿 잔존).
- **검증** — 사용자 노출 영역의 `(AI|Claude|Anthropic|Haiku|Sonnet|GPT|OpenAI|ChatGPT)` grep 결과 모두 코드 주석 또는 admin UI (예외 범위). CLAUDE.md §6 의 자가 점검 grep 으로 회귀 방지.

#### B. HangeulGo Got it 영구화 (`032b59d`)
- **증상** — 페이지 진입 시 항상 같은 오늘의 표현 노출. Got it 후 새로고침해도 동일.
- **원인** — `phrase-of-day` GET 이 항상 `featured_date` 캐시 hit 반환. `seenPhraseIds` 가 in-memory `useState` 라 새로고침 시 휘발.
- **`/api/korean/learning-progress` (신규 POST)** — phrase_id + status='mastered' 영구 기록. user_learning_progress 테이블 활용 (0026 마이그레이션). 비-UUID (fallback sentinel) skip 응답 — idempotent.
- **`/api/korean/phrase-of-day` GET 확장** —
  - 로그인 유저의 mastered phrase id 목록을 모드 A·B 양쪽에서 자동 참조 (`getMasteredPhraseIds` 헬퍼).
  - 모드 A (오늘의 featured): 캐시 hit row 가 mastered 면 자동으로 모드 B (mastered 제외 랜덤) 로 우회.
  - 모드 B (랜덤): 클라이언트 `seenPhraseIds` + 본인 mastered 자동 머지 (`extraExcludeIds` 파라미터).
- **`app/korean/page.tsx` `handleMarkLearned`** — streak POST 옆에 learning-progress POST 추가. Got it 클릭 → 영구 mastered → 다음 진입 시 다른 표현.
- **비로그인 동작 무변경** — in-memory `seenPhraseIds` 그대로.

#### C. Lemon Squeezy 결제 새 탭 오픈 (`300bee0`)
- **증상** — 결제 버튼 클릭 시 현재 탭이 LMS 호스팅 페이지로 전환 (전체 페이지) → UnfoldK 컨텍스트 이탈.
- **수정** — `app/start/page.tsx`: `window.location.href` → `window.open(url, "_blank", "noopener,noreferrer")` + 원래 탭은 `/mypage` 로 이동 (가입은 free 락인 완료 상태). `app/mypage/subscription/page.tsx`: Monthly/Annual `<a>` 2개에 `target="_blank" rel="noopener noreferrer"` 추가.
- **서버 라우트 무변경** — `/api/lemonsqueezy/checkout` 은 그대로 302 redirect 유지. 새 탭이 라우트로 들어가서 LMS 로 이동. 결제 완료/실패와 무관하게 원래 탭은 UnfoldK 에 유지. webhook 이 결제 시 plan_type 업그레이드.
- **검토했다가 폐기** — `lemon.js` 오버레이 통합 (`LemonSqueezy.Url.Open` + `?embed=1`). 새 탭 한 줄로 충분한데 과한 작업.

#### D. LMS 체크아웃 redirect 응답 Cache-Control: no-store (`8c4e746`)
- **증상** — 관리자 계정으로 결제 버튼 클릭했던 브라우저에서 일반 회원으로 갈아탄 뒤 같은 버튼 클릭 시 LMS 결제창에 관리자 이메일이 임베드되어 표시.
- **원인** — `NextResponse.redirect()` 기본 307 응답이 Cache-Control 헤더 없음 → 브라우저가 같은 쿼리 (`?plan=monthly`) 로 재요청 시 캐시된 Location (이전 사용자 email 임베드) 을 그대로 따라감. 서버는 매번 `supabase.auth.getUser()` 로 새 이메일 가져오지만 브라우저가 서버까지 안 닿는 게 문제.
- **수정** — `/api/lemonsqueezy/checkout` 의 4개 redirect 경로 (invalid_plan / no_user / checkout_unavailable / 정상 LMS URL) 에 일괄 `Cache-Control: no-store` 명시. `NO_STORE_HEADERS` 상수로 일관 적용.
- **기존 캐시 잔재**는 코드 수정과 무관 — 시크릿 창 / 캐시 클리어로만 풀림. 앞으로 발생하는 요청부터 차단.

#### E. Subscription 페이지 Redeem code 모달 + 폼 컴포넌트 재사용 (`41fc932`)
- **`components/redeem-coupon-form.tsx` 신규** — 폼 + 결과 화면 재사용 컴포넌트. props: `onSuccess` / `hideOuterCard` / `hideGoToSubscription` 으로 페이지·모달 양쪽 컨텍스트에 맞춰 동작.
- **`app/redeem/page.tsx`** — 기존 inline 폼 (180+ 줄) 제거, auth guard + 카드 wrapper 만 남기고 `<RedeemCouponForm />` 사용.
- **`app/mypage/subscription/page.tsx` FreeUserView** — `<Link href="/redeem">` 제거. shadcn `<Dialog>` + `<DialogTrigger>` 로 모달 트리거. 쿠폰 성공 시 success view 1.8초 노출 후 모달 자동 닫기 + `router.refresh()` 로 plan_type 즉시 갱신.
- 폼 로직·에러 메시지 매핑 (`ERROR_MESSAGES`) 은 컴포넌트 내부 단일 진실원 — 향후 카피 변경 시 한 곳만 수정.

### 다음 세션 후보 (carry-over)
- **세션 16 carry-over 전체 유지** —
  - famous-dramas ↔ dramas 매칭 실측 검증 (어드민 cron 수동 실행 → `auto_added_dramas` 카운트 확인)
  - top.gg 심사 통과 후 봇 페이지 운영
  - /calendar / /today / /notify 슬래시 명령 추가
  - **세션 14 carry-over**: KdramaMatch Phase 2 잔여 / Curation K Phase 2 / 결제 가동 시 복원 / 세션 13 잔여
  - 블로그 cron 운영 안정화

### 블로커
- **top.gg 심사 1~2주 대기** — 외부 의존 (세션 15 carry-over)
- 세션 13 carry-over — 메인 페이지 hang + Ghost Globe 미작동

---

