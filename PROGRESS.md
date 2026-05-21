# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.

---

## 현재 상태 (2026-05-21 세션 20 / KfoodKit·Curation K 운영 안정화 + HallyuBot·LMS 외부 트랙 + SEO/AI 검색 기초 인프라)

> 운영 관점 마감 세션. 신규 기능 개발은 최소화하고 ① KfoodKit·Curation K 데이터 backfill 상태 확정, ② HallyuBot top.gg 제출, ③ Lemon Squeezy 재심사 답변, ④ Discord 커뮤니티 홍보 자산, ⑤ Google·Bing 검색 등록 + AI 검색 (llms.txt) 인프라 + 블로그 페이지네이션을 한 묶음으로 정리. 블로커 트랙 (top.gg / LMS / Google 색인) 은 모두 외부 응답 대기로 전환.
>
> commits: `86f16b3` → `c5eda19` → `dbe50aa` → `f01bf0b` → `1fc94f8` → `c5cba28` → `6e7d25d` → `bb49344` → `24d26a4`.

### 완료

#### A. KfoodKit 상태 확인

- 마이그레이션 5개 (`0030_kfoodkit.sql` ~ `0034_food_admin.sql`) 전체 적용 확인.
- `0035_food_recipes_content_translations.sql` 까지 적용 완료. 세션 19 인프라 동결 상태 검증.
- `title_en` 537/537 완료 — 모든 레시피 영문 제목 노출.
- `ingredients_en` 530/537 — 잔여 7개는 `/api/food/recipes/[id]` lazy 번역으로 자연 채워질 예정. 별도 cron 트리거 불필요.

#### B. filming_spots description backfill — 별도 cron 분리

- **증상** — Curation K 통합 cron (`/api/cron/curation-k-festivals` / `/api/cron/curation-k-spots`) 가 300초 timeout 으로 중간에 잘리며 `spot_description` backfill 이 매번 미완 (48/61 까지만 처리).
- **확진** — Vercel Functions 로그에서 `Vercel Runtime Timeout Error: Task timed out after 300 seconds` 직접 확인. Vercel 함수 maxDuration 300s 한계 + Claude Haiku 호출 + TourAPI enrichment + filming description 생성이 한 cron 안에서 직렬 실행. festival·tour·filming 트랙 중 가장 마지막인 description backfill 이 timeout 에 잘림.
- **해결** — `app/api/cron/backfill-filming-descriptions/route.ts` 신설. filming description 만 단일 책임으로 분리하고 vercel.json schedule `30 4 * * *` (UTC 04:30 = KST 13:30) 추가.
- 잔여 13개는 내일 (2026-05-22 KST 13:30) 첫 실행에서 자동 처리 예정 (cap/run 충분).

#### C. Curation K — SpotDetailDialog Google Maps 버튼 주소 fallback

- 좌표 (`latitude`/`longitude`) 가 있는 spot 만 Google Maps 버튼 노출되던 상태에서, 좌표 없는 spot 도 주소 (`addr1` + `addr2`) 기반 검색 URL fallback 으로 GMaps 연결.
  · 좌표 있음 → `https://maps.google.com/?q={lat},{lng}`
  · 좌표 없음 → `https://maps.google.com/?q={encodeURIComponent(addr1 + addr2)}`
- 한국어 주소 텍스트는 GMaps 검색이 자동 정규화 — 별도 영문 변환 없이 유지.
- Pro 게이팅 (`isPro` blur 오버레이) 은 그대로 — fallback 도 동일하게 Pro 가시화 조건 적용.

#### D. HallyuBot — top.gg 제출

- **에셋** — 배너 (1280×720) + 아바타 (512×512). 핑크 그라데이션 (#FF4B6E 베이스) + UnfoldK 원형 로고. brand 색 일관성 (DECISIONS.md §브랜드 컬러).
- **Discord Developer Portal** — 아바타 교체 완료. 채널·서버 알림에서 신규 아바타 노출.
- **top.gg 심사 제출** — 봇 설명·태그·초대 링크·소유자 본인 인증 완료. 심사 응답 1~2주 대기 (외부 의존).

#### E. Lemon Squeezy 재심사 요청

- **이전 거절 사유** — "서비스 불가" (LMS 측 판정).
- **재답변** — SaaS 디지털 플랫폼임을 명시 + Stripe 한국 법인 결제 미지원 사유 (운영사 UNFOLD LAB 가 한국 법인) 첨부. K-culture 글로벌 구독 모델 + 한류 팬 타겟 영문 설명 포함.
- 응답 대기 중. 거절 시 fallback 으로 Paddle 전환 검토 (carry-over).

#### F. Discord 커뮤니티 홍보 자산 준비

- **서버 유형별 포스팅 템플릿 4종** — K-pop / K-drama / 한국어 학습 / 종합 한류. 각 템플릿이 해당 커뮤니티 관심사에 맞는 UnfoldK 서비스 (KpopStats / KdramaMatch / HangeulGo / 통합) 를 첫 줄에 노출하도록 작성.
- **관리자 DM 영문 최종본** — Jaewoo (운영자) 서명. 봇 초대 권유 + 무료 채용 ROI 강조.
- **HallyuBot OAuth2 초대 링크** — 권한 scope 확정 + 생성 완료. 4 템플릿에 같은 링크 임베드.

#### G. SEO 등록 — Google Search Console + Bing Webmaster Tools

- **Google Search Console** — 소유권 확인 (Verification meta tag) 완료. sitemap 제출까지 완료, 색인 생성 1~2주 대기.
- **`app/sitemap.ts` 신설** — Next.js Metadata Sitemap API. 15페이지 등록:
  · priority 1.0 weekly: `/`
  · 0.9 daily: `/calendar` `/kpop`
  · 0.9 weekly: `/drama` `/korean` `/food` `/curation-k`
  · 0.8 weekly: `/blog`
  · 0.7 monthly: `/about`
  · 0.5 monthly: `/careers` `/contact`
  · 0.3 yearly: `/privacy` `/terms` `/cookie` `/gdpr`
- **`app/robots.ts` 신설** — User-Agent `*` allow `/`, disallow `/admin` `/api` `/mypage`, sitemap 위치 명시.
- **Bing Webmaster Tools** — `<meta name="msvalidate.01" …>` 를 `app/layout.tsx` Metadata API `verification.other` 필드로 주입. 소유권 확인 + sitemap 제출 완료.

#### H. AI 검색 최적화 — llms.txt

- **`public/llms.txt` 신설** — single source of truth. 영문 Markdown. 6개 서비스 (HallyuCalendar · KdramaMatch · HangeulGo · KfoodKit · Curation K · KpopStats) + 주요 페이지 URL + 운영사·가격·타겟 정보 포함.
- **`app/llms-txt/route.ts` 동적 라우트** — `public/llms.txt` 를 fs 로 읽어 `text/plain` 반환 + `Cache-Control: public, max-age=3600, s-maxage=86400`. 정적·동적 두 엔드포인트 모두 동일 콘텐츠 보장.
- 노출 URL: `/llms.txt` (정적) + `/llms-txt` (동적).
- **사후 정정** — 초안에 `HallyuCalendar Events` 가 1번과 중복으로 들어가 있어 6번 항목을 `KpopStats` 로 교체 (`24d26a4`).

#### I. 블로그 페이지네이션

- `app/blog/page.tsx` 페이지네이션 추가 — `POSTS_PER_PAGE=12`. `?page=N` 쿼리 방식 (뒤로가기·공유·SEO 호환).
- food 페이지 `getPaginationItems(current, total)` 헬퍼 패턴 그대로 이식 — 첫·마지막 페이지 + 현재 ±2 + ellipsis, edge 보정 (current ≤ 4 / current ≥ total-3).
- 현재 페이지: `<span aria-current="page">` + brand `#FF4B6E` + 흰 글씨 (클릭 불가, 의미 명확). Prev/Next 끝 도달 시 `<span aria-disabled>` 비활성.
- 1페이지는 `?page=1` 대신 canonical `/blog` URL — 중복 인덱싱 방지.
- App Router `<Link>` 기본 `scroll=true` 가 query-only 변경에도 동작 → 페이지 변경 시 상단 자동 이동 (별도 코드 불필요).
- `export const dynamic = "force-static"` 제거 — `searchParams` 사용으로 자동 dynamic 전환. async server component + `searchParams: Promise<{ page?: string }>` (Next.js 15.2 시그니처).
- 현재 블로그 포스트 7개 — 12개 초과 시 페이지네이션 자동 노출.

### 신규 의존성

- 없음.

### 환경변수

- 신규 없음.

### 사용자 액션 필요

1. **Vercel 운영 env 확인** — Bing meta tag·sitemap·robots·llms.txt 는 모두 코드 레벨, env 의존성 없음. 배포 후 다음 도메인 응답 확인:
   · `https://www.unfoldk.com/sitemap.xml` (15페이지)
   · `https://www.unfoldk.com/robots.txt` (sitemap 라인 포함)
   · `https://www.unfoldk.com/llms.txt` + `/llms-txt`
   · `<head>` 에 `<meta name="msvalidate.01" content="1443F8775AAEF86D67C4DFE27F6ACD60">` 포함
2. **filming_spots backfill cron 모니터링** — 내일 (2026-05-22) KST 13:30 첫 실행 후 `/admin/cron` Curation K 카드 또는 Supabase `select count(*) from filming_spots where spot_description is null` 으로 잔여 0 확인.
3. **top.gg 심사 결과 회신 수신 시** — 통과면 봇 공개 페이지 운영 + 슬래시 명령 (/calendar /today /notify) 추가 (carry-over).
4. **LMS 재심사 결과 회신 시** — 통과면 결제 가동 + CLAUDE.md §6 "결제 연동 전 임시 Free 확대 정책" 표 일괄 복원. 거절이면 Paddle 전환 (별도 세션).

### 다음 세션 후보

- **filming_spots backfill 잔여 13개 처리 검증** — 2026-05-22 cron 실행 후 누적 0 확인.
- **Google 색인 생성 모니터링** — 1~2주 내 `site:unfoldk.com` 결과 노출 시작. 부진하면 sitemap priority/changeFrequency 조정.
- **블로그 이미지 중복 개선** (세션 19 carry-over) — Unsplash per_page 15 + 최근 30 포스트 슬러그 제외 적용 후에도 중복 case 모니터링. 매칭 룰 보강 또는 별도 캐시 고려.
- **푸터 국가 통계** (세션 19 carry-over) — 사용자 분포 stat 노출 검토.
- **KdramaMatch Phase 2** (세션 19 carry-over) — TMDB 추가 enrichment, Claude 에피소드 요약·캐릭터 관계도 Pro 잠금 해제.
- **결제 가동 시 복원** (세션 19 carry-over) — LMS 통과 시 CLAUDE.md §6 임시 정책 표 전체 원복 + KfoodKit My Shopping List Pro 잠금 + 컬렉션 Free cap 카피 회귀.

이전 세션 carry-over 유지: famous-dramas ↔ dramas 매칭 실측 검증 · 모달 attribution 가이드라인 (mfds/manual/upload 표기 검토) · 블로그 cron 운영 안정화 · 세션 13 carry-over (메인 페이지 hang + Ghost Globe 미작동).

### 블로커

- **top.gg 심사 1~2주 대기** — 외부 의존 (세션 15 carry-over 연장).
- **LMS 재심사 결과 대기** — 외부 의존. 거절 시 Paddle 전환 트랙 발동.
- **Google 색인 생성 1~2주 대기** — 외부 의존 (신규).
- 세션 13 carry-over — 메인 페이지 hang + Ghost Globe 미작동.

---

## 현재 상태 (2026-05-20 세션 19 / KfoodKit Phase 1~3 + 페이지네이션 · 마이페이지 stat · 캘린더 모달 자동 오픈)

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
> commits (M+4 출시): `f385d9c` → `14e99e1` → `34de258` → `3238a58` → `f380148` → `947db7e` → `00bca32` → `1513907` → `ec4d2f0` → `de03329` → `cabad5b` → `62a5c87` → `2068b5d` → `5e459ec` → `662c6bc` → `c502c05` → `2c8c25b` → `d3bcff6` → `bde76b8` → `d073ac8` → `942c501` → `8bc07ce`.
>
> **세션 후반** — KfoodKit Phase 2 (컬렉션 + YouTube), Phase 3 (주간 챌린지 — 맛집 연계 트랙은 같은 세션 안에서 다시 롤백), 페이지네이션 숫자버튼, 마이페이지 4 stat 실데이터, 내 캘린더 → calendar 모달 자동 오픈, 재료/조리법 영문 lazy 번역 (캐싱 회귀·DB string 저장 케이스까지 fix).
>
> commits (후반): `018dd52` → `db63556` → `e564edf` → `23789f1` → `999522b` → `fce68c5` → `c7f0cce` → `f338d35` → `d5eadec` → `7ce4028` → `7e0be58` → `ac0cd71` → `ce1154d` → `fe76095`.

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

#### M. 재료/조리법 영문 번역 lazy 생성 + 캐싱 회귀 fix

- **0035_food_recipes_content_translations.sql** — `ingredients_en` / `instructions_en` jsonb + `idx_food_recipes_content_translate_pending` (둘 중 하나라도 NULL 인 row 빠른 조회).
- `lib/claude/recipe-content-translate.ts` — 한 호출에 재료 배열 + 조리 과정 배열 번역, tool_use schema 로 인덱스·길이 보존. 모르는 한식 표현은 Romanized (gochujang, doenjang).
- `/api/food/recipes/[id]` — title/description 번역 task 와 parallel 호출. 응답 직전 인덱스 매칭으로 `name_en` / `instruction_en` 노출.
- **회귀 fix 3종**:
  · 응답 4개 모두 (200/400/404/500) `Cache-Control: no-store, max-age=0` 명시 — `force-dynamic` 만으론 브라우저 fetch 캐시 차단 못함.
  · `normalizeStringArray` 가 jsonb 컬럼이 JSON-직렬화된 string (`'["A","B"]'::jsonb`) 로 들어온 케이스도 JSON.parse 로 복원. (외부 경로 — Supabase Dashboard Table Editor 등 — 으로 들어간 row 추정. write path 에는 stringify 코드 없음.)
  · 진단 (`debug` 응답 필드 + console.log) 으로 원인 좁힌 후 임시 코드 모두 제거.

#### N. KfoodKit Phase 2 — 컬렉션 저장 + YouTube 요리 영상

- **`/api/food/collections`** GET/POST/DELETE — 0030 `user_food_collections` + RLS 그대로. Free 5 cap (server-side count, Pro·admin 우회), unique 충돌 멱등 `{ ok: true, already: true }`. 신규 마이그레이션 0건.
- **/food 카드·모달 북마크** — 카드 우상단 (button-in-button 회피 위해 div role="button" + stopPropagation), 모달 헤더 Tooltip. **비로그인 시 버튼 자체 미노출** (가입 유도 노이즈 제거 — 클릭 시 StartModal 띄우는 기존 방식 폐기). Free cap 도달 → toast "Coming with Hallyu Pass — unlimited saves at launch.". optimistic + 롤백.
- **`/mypage/recipes` 실데이터** — Coming Soon 폐기. `/mypage/dramas` 패턴 (MypageShell + EmptyState + Toaster + 모달 재사용). 본인 plan_type/is_admin → `hasProAccess` 로 isPro 추적 인프라 보강 (옵션 1 — dialog prop 전달은 보류).
- **YouTube 요리 영상 lazy** — `lib/api/youtube.ts` `searchCookingVideo(titleEn)` 추가 (search.list 100 units, videoEmbeddable=true, safeSearch=moderate). `/api/food/recipes/[id]` 가 번역 완료 후 sequential 호출 → `food_recipes.youtube_url` (0030 컬럼) write-back. 모달은 `img.youtube.com/vi/{id}/mqdefault.jpg` 썸네일 + Play 오버레이 + 새 탭 (embed 안 함, 저작권 안전).

#### O. KfoodKit Phase 3 — 주간 K푸드 챌린지

- **`/api/food/challenges` (공개 GET)** — `week_start ≤ today ≤ week_end` 매칭 1건 + `food_name` 기반 매칭 레시피 id 서버측 lookup. 응답 `{ challenge, recipeId }` — Start 버튼이 한 번에 모달 오픈.
- **`/api/admin/food/challenges` (admin POST)** — `requireAdmin` + zod (title/dates required), `week_start ≤ week_end` app-level 검증.
- **`/admin/food` 탭 wrapper** — `FoodAdminTabs` (client) 로 Recipes / Challenges 전환. server props + `ChallengesAdmin` (진행 중 + 신규 폼 + 최근 10건 + active 배지). 폼 제출 후 `router.refresh()`.
- **/food This Week's Challenge** — 정적 placeholder ("Make Japchae", "1,240 fans joined") 폐기. 챌린지 null 이면 섹션 미노출. Start 버튼은 `challengeRecipeId` 있을 때만 + 클릭 시 `setActiveRecipeId` → 모달 오픈 (라우트 navigate 없음).
- **롤백** — "Find it in Korea" 트랙 (`/api/food/restaurants` + recipe-detail-dialog 맛집 섹션 + isPro prop) 은 같은 세션 안에서 사용자 판단으로 전체 제거. tour_spots 데이터 자체는 Curation K 가 그대로 사용.

#### P. /food 페이지네이션 숫자버튼

- "Page N / Total" 텍스트 + Prev/Next → 숫자 버튼 그리드. 항상 첫·마지막 페이지 노출 + 현재 ±2 + ellipsis. edge 보정: `current ≤ 4` 면 앞 5개 / `current ≥ total-3` 면 뒤 5개 (5개 숫자 일관). 현재 페이지 brand `#FF4B6E` + 흰 글씨. `getPaginationItems(current, total)` 헬퍼는 `PaginationItem = number | "ellipsis-left" | "ellipsis-right"` 유니언 반환.

#### Q. 마이페이지 — 대시보드 4 stat 실데이터 + Saved Recipes 카운트 + 캘린더 모달 자동 오픈

- **`/api/mypage/stats`** (신규) — 4 stat 한 round-trip:
  · Artists Tracking — `user_calendar_subscriptions` event_id → `hallyu_calendar_events.artist_or_drama` **distinct count** (이벤트 단위 구독을 아티스트 단위로 의미 보정).
  · Events This Month — 본인 구독 중 이번 달 (UTC) event_date 매칭.
  · Korean Lessons — `user_streaks.streak_days` (없으면 0).
  · Saved Recipes — `user_food_collections` row count.
  · 개별 stat 실패는 `console.warn` + 0 폴백 (한 stat 오류로 대시보드 전체 무너지지 않게).
- `/mypage/page.tsx` — 정적 placeholder 4 stat ("12", "5", "23", "8") 폐기. 로딩 중 "—" / 채워지면 숫자.
- **`/mypage/calendar` → calendar 모달 자동 오픈** — EventCard `href={/calendar?event=<id>&month=<YYYY-MM>}`. calendar 페이지 마운트 시 month 로 viewDate 보정 + event id 를 pendingEventId 로 보관 + URL search params 즉시 제거 (새로고침 시 재오픈 방지). events 로드 후 별도 effect 가 매칭 → `EventDetailModal` 자동 오픈. 다른 달 이벤트도 자연스럽게 month 전환.

#### R. Free 정책 — Phase 2/3 카피 일관

- KfoodKit 컬렉션 — Free 5 / Pro 무제한 (CLAUDE.md §6 "결제 연동 전 임시 Free 확대 정책" 표 그대로). cap 메시지 "Coming with Hallyu Pass" 패턴.
- 다음 결제 가동 시 KfoodKit My Shopping List Pro 잠금 복원 함께 검토 (carry-over).

#### S. PROGRESS / DECISIONS 아카이브 분리

- 세션 1~17 누적 내용을 `PROGRESS_ARCHIVE.md` / `DECISIONS_ARCHIVE.md` 로 분리 (commit `8bc07ce`). 현재 PROGRESS.md / DECISIONS.md 는 세션 18~ 만 유지 — 세션 시작 시 읽는 부담 감소.

#### T. HangeulGo 표현 수 0 이슈 해결 확인

- 페이지 진입 시 표현 미노출 보고는 세션 17 의 `learning-progress` 영구화 + mastered 우회 로직으로 해결된 상태. 운영 모니터링 결과 120건/일 정상 노출 확인 — 별도 조치 불필요.

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

### 다음 세션 후보

- **블로그 이미지 중복 개선** — Unsplash per_page 15 + 최근 30 포스트 슬러그 제외 (H 항목) 적용 후에도 중복 case 모니터링. 매칭 룰 보강 또는 별도 캐시 고려.
- **푸터 국가 통계** — 사용자 분포 stat (가입 국가) Footer 노출 검토.
- **KdramaMatch Phase 2 (백로그)** — TMDB 추가 enrichment (배우·OTT·예고편), Claude 에피소드 요약·캐릭터 관계도 Pro 잠금 해제, 시청 기록·평점 개인화.
- **결제 가동 시 복원** — LMS 연동 후 CLAUDE.md §6 "결제 연동 전 임시 Free 확대 정책" 표 전체 원복. KfoodKit My Shopping List Pro 잠금 + Phase 2 컬렉션 Free cap 카피 ("Upgrade — $15/month" 복원) 도 같이 검토.
- **top.gg 심사 결과 대기** — 통과 시 봇 페이지 운영 + /calendar / /today / /notify 슬래시 명령 추가.

이전 세션 carry-over 유지: famous-dramas ↔ dramas 매칭 실측 검증 · 모달 attribution 가이드라인 (mfds/manual/upload 표기 검토) · 블로그 cron 운영 안정화 · 세션 13 carry-over (메인 페이지 hang + Ghost Globe 미작동).

### 블로커

- **top.gg 심사 대기** — 외부 의존 (세션 15 carry-over).
- **어드민 food 이미지 업로드 진행 중** — 관리자가 537 카탈로그 수동 큐레이션 누적 중. cron 자동 backfill (mfds/unsplash) 와 병행.

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

