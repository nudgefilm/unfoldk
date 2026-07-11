# CLAUDE.md — UnfoldK 개발 가이드

> 세션 시작 시 필수 숙지. 결정 사항은 DECISIONS.md, 진행 상태는 PROGRESS.md.

**참조 파일 (2026-05-12 분리)**
- 폴더 구조 / 페이지 목록 / 링크맵 / API·저작권·법무 → **STRUCTURE.md**
- Curation K (HallyuMap, M+5) 기획 → **HALLYUMAP.md**
- About / 마케팅 카피 → **COPY.md**

---

## 1. 프로젝트 개요

- **UnfoldK** / unfoldk.com / 운영사 **UNFOLD LAB** (unfoldlab.net · tubewatch.kr)
- **한류 팬 통합 구독 SaaS** (B2C, 글로벌 — 영어권 + 동남아)
- 5개 마이크로 서비스 (+ M+5 HallyuMap 기획 중)
- 브랜드 컬러 `#FF4B6E`

---

## 2. 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트 | Next.js (App Router) + TypeScript, Vercel 배포 |
| 백엔드 | Python FastAPI, Railway |
| DB/Auth | Supabase (Google/Apple OAuth + 이메일) |
| 결제 | **Paddle (MoR, KYB 심사 중 2026-06-17 제출)** — TossPayments 영구 제외 |
| AI | Claude API Haiku 4.5 ($1/$5 per 1M, 배치 API) |
| TTS | ElevenLabs Creator ($22/월, HangeulGo 전용) |
| 이메일 | Resend (무료 3,000건/월) |

**UI**: shadcn/ui (`new-york` / `neutral`, RSC) — `@/components/ui/*` import. lucide-react / react-hook-form+zod / next-themes / recharts / sonner. 임의 작성 전 shadcn 표준 우선 확인.

**패키지**: pnpm 전용 (`pnpm-lock.yaml`). npm/yarn 금지. **alias** `@/*` → 레포 루트.

**명령어**: `pnpm dev|build|start|lint` (ESLint config 미설정).

**빌드 주의**: `next.config.mjs` 에 `ignoreBuildErrors: true`, `images.unoptimized: true` — 출시 전 strict 전환 필요.

**아이콘**: UI 요소에는 `lucide-react` 컴포넌트만 사용. 유니코드 이모지(📊, 🎯, 🔥 등)는 JSX 렌더링 영역 어디에도 사용 금지. 단, JS 문자열 템플릿·코드 주석·SNS 공유 텍스트 등 React 렌더링 불가 영역은 예외.

---

## 3. 구독 플랜

```
Free          무료        제한적 기본 기능
Hallyu Pass   $9/월      5개 서비스 Pro 전체
Hallyu Pass   $72/년     Pro + 33% 할인 ($6/월)
```

가입 시 Hallyu Pass 기본 선택 (전환 최적화). 카드 내 Monthly/Annually 토글.

**신규 Free 24h OPEN 체험** (기획 단계, 미확정) — 가입 직후 24시간 Pro 전체 무제한. 카피 후보 → COPY.md.

---

## 4. 로드맵

| 시기 | 서비스 | 핵심 |
|------|--------|------|
| M+0 | HallyuCalendar | API 무료, 즉시 수익화 |
| M+1 | KpopStats | YouTube 인프라 재활용 |
| M+2 | KdramaMatch | Claude Haiku 종량 |
| M+3 | HangeulGo | ElevenLabs TTS |
| M+4 | KfoodKit | Spoonacular |
| M+5 | Curation K (HallyuMap) | 기획 단계 → HALLYUMAP.md |

> M+0 부터 M+1~5 확장 가능 구조로 설계.

---

## 5. DB 설계 (핵심)

- **단일 Supabase 프로젝트** 5개 서비스 공유
- `users`: `id, email, plan_type, subscription_status, is_admin`
- `subscriptions`: `plan_type, billing_cycle, expires_at, lms_subscription_id`
- 서비스별 데이터는 별도 테이블
- **RLS 초기부터 적용 필수**

**페어 컬럼 규칙**: `plan_type` 변경 시 `subscription_status` 동시 set. RLS `events_select_premium_paid` 가 두 컬럼 동시 검증.

---

## 6. 코딩 원칙

```
1. TypeScript strict — any 금지
2. 페이지당 로직과 UI 분리
3. API 라우트는 /app/api/ 서비스별 폴더
4. 외부 API 실패 시 fallback 필수
5. 외부 API 응답은 Supabase / Next.js cache 저장
6. .env.local (개발) / Vercel env (운영) 분리
7. 핵심 비즈니스 로직에 한국어 주석
8. 기능 단위 커밋, 메시지 한국어
9. UI 수정 금지 — v0 완성. 로직·API 연동만 추가
10. UI 아이콘은 lucide-react 기본 채택 — 이모지(🔥 📊 등) 대신 lucide 아이콘 사용.
    단, JS 문자열 템플릿·코드 주석·SNS 공유 텍스트 등 React 렌더링 불가 영역은 이모지 유지.
```

### UI 카피 — 서비스 주체는 UnfoldK
- **사용자 노출 텍스트 (UI · 카피 · 이메일 · 마케팅) 에서 서비스·정보 제공의 주체는 항상 "UnfoldK"** 로 표기. AI 벤더명 (`Claude`, `Anthropic`, `Haiku`, `Sonnet`, `OpenAI`, `GPT`) 노출 금지.
- "AI" 단독 표기도 사용자 노출 영역에서는 "UnfoldK" 로 재라벨:
  - `AI picks` → `UnfoldK picks` / `AI recommendations` → `UnfoldK recommendations` / `AI matches` → `UnfoldK matches`
  - `AI Grammar Explanation` → `UnfoldK Grammar Explanation` / `AI Drama Summary` → `UnfoldK Drama Summary` / `AI Episode Summary` → `UnfoldK Episode Summary` / `AI Ingredient Finder` → `UnfoldK Ingredient Finder`
  - 형용사형 `AI-powered X` → `UnfoldK X` / `AI-curated X` → `UnfoldK-curated X` / `AI-generated X` → `UnfoldK X` / `powered by AI` → `powered by UnfoldK`
- **예외 (그대로 둠)**:
  - 코드 주석 / `lib/**` · `app/api/**` 등 내부 로직 — 실제 모델명 (`Claude Haiku` 등) 기록은 디버깅·운영 정확성을 위해 유지.
  - 어드민 전용 UI (`/admin/*` · `components/admin/*`) — 운영자가 실제 시스템 동작을 알아야 하므로 모델명 노출 허용.
  - 외부 라이선스·법무 표기에서 명시 의무가 있는 경우 (현재 해당 없음).
- 신규 사용자 노출 카피 작성 시 자가 점검: "이 문장의 주체가 누구인가?" → UnfoldK 가 아니면 재작성.
- 검증: 사용자 노출 파일 (`app/**/*.tsx` 의 JSX 텍스트, `components/**/*.tsx` 의 JSX 텍스트, `emails/**`) 에서 `\b(AI|Claude|Anthropic|Haiku|Sonnet|GPT|OpenAI|ChatGPT)\b` grep 시 주석·내부 변수만 남아야 함.

### YouTube 채널 자동 매핑 원칙 (2026-07-11 폐기 — YouTube Data API 전체 제거)
- 과거 `lib/api/youtube.ts:searchChannelByName` 구현 원칙이었으나, KpopStats 서비스 자체 제거(세션 77) 이후 호출부가 없던 채로 남아있다가 2026-07-11 YouTube Data API 완전 제거로 코드도 삭제됨. 상세는 DECISIONS.md 2026-07-11 항목 참조.
- 유사 기능(아티스트 공식 채널 자동 매핑) 재도입 시 참고할 과거 원칙: `${artistName} official` 검색 → 결과 1위 채널 `subscriberCount` 10만 이상 검증 → 채널명·아티스트명 유사도 낮으면 NULL 유지(오매핑 > NULL) → 대형 아티스트는 채널ID 하드코딩 우선(과거 `0019_fix_bts_blackpink_channel.sql` 패턴).

### KpopStats 아티스트 노출 원칙
- Top 20 차트 외 아티스트도 검색·탐색 가능해야 함
- YouTube 채널 NULL 아티스트는 Last.fm 데이터만 표시 (YouTube 영역은 "Coming soon")
- 노출 구조: Top 20 → "More Artists" 섹션 → 전체 목록 페이지 (`/kpop/artists`)
- 아티스트 전체 브라우징: `/kpop/artists` (리스너순 정렬, 그룹/솔로 필터, 페이지네이션)
- `kpop_artists.member_count`: NULL=미분류 / 1=솔로 / 2+=그룹. 어드민에서 backfill.

### Chart Attack 확정 스펙 (2026-06-03)

**위치**: `/kpop` 페이지 상단 탭 "🔥 Chart Attack" (기존 "📊 Charts" 탭과 병렬)

**데이터 소스**: 신규 API 수집 없음 — `kpop_stats_daily` (기존 Last.fm 청취자 데이터) 100% 재활용
**표기 의무**: ① 차트 섹션 제목 아래 `"Based on Last.fm global streaming data"` 출처 표기 필수 (DECISIONS.md 2026-06-03 원칙)

**섹션 구성**
| 섹션 | 데이터 소스 | Free | Pro |
|------|------------|------|-----|
| ① Global K-pop Chart | kpop_stats_daily (lastfm_listeners 기준 순위) | ✅ | ✅ |
| ② Velocity Tracker | kpop_stats_daily (youtube_weekly_views delta) | ✅ | ✅ |
| ③ Rival Chase | Last.fm 청취자 격차 (1위 기준) | 1위 격차만 | 전체 레이싱 게이지 |
| ④ AI Predictive Milestone | Claude Haiku (순위+청취자 증감→예측) | ❌ | ✅ |
| ⑤ Share to Attack | twitter.com/intent/tweet | 프리셋 문구 | AI 팬덤 맞춤 문구 |
| ⑥ 화력 투표 | chart_attack_votes | ✅ (로그인) | ✅ |

**DB 테이블** (migration 0059_chart_attack.sql — Supabase 수동 실행 필요)
- `chart_attack_votes`: artist_id(PK FK → kpop_artists), vote_count, updated_at

**위기/기회 배너** (K-pop 내부 순위 기반)
- rank 11~13: 🟡 "TOP 10 턱밑"
- rank 18~20 + listener_change_pct < -3%: 🔴 "차트 아웃 위기"

**API 라우트**
- `GET  /api/kpop/chart-attack/lastfm-chart` — K-pop 글로벌 차트 (lastfm_listeners DESC)
- `GET  /api/kpop/chart-attack/velocity` — YouTube 조회수 시간당 가속 TOP 10
- `GET  /api/kpop/chart-attack/votes`   — 화력 랭킹 TOP 5
- `POST /api/kpop/chart-attack/votes`   — 투표 +1 (로그인)
- `POST /api/kpop/chart-attack/milestone` — AI 청취자 성장 예측 (Pro)
- `POST /api/kpop/chart-attack/share`   — AI 바이럴 문구 (Pro)

**구현 파일**
- `components/kpop/chart-attack-tab.tsx` — 탭 전체 UI
- `app/kpop/page.tsx` — 탭 네비게이션 + `isPro` 상태 추가

### KpopStats Free/Pro 확정 스펙 (2026-06-01)
- 메인 페이지 (`/kpop`): 전체 Free 오픈 (비로그인 포함 Top 20)
- 아티스트 상세 (`/kpop/[id]`): Today's Trending Top 5에 포함된 아티스트만 Free 접근 가능
- 나머지 아티스트 상세 → Pro 잠금 (잠금 UI: "Coming with Hallyu Pass")

### 결제 연동 전 임시 Free 확대 정책 (2026-05-16~ / 결제 연동 시 복원)
**배경**: Paddle 결제 연동 전까지 Free 유저도 핵심 기능을 충분히 체험할 수 있도록 게이팅 완화. 결제 연동 시 아래 표의 "복원 후" 상태로 되돌리는 commit 필요.

| 기능 | 현재 (임시) | 복원 후 (결제 가동 시) | 비고 |
|------|------------|---------------------|------|
| HallyuCalendar — Upcoming events blur | 비로그인 3개, **Free 무제한** | 비로그인 3개, Free 3개, Pro 무제한 | `app/calendar/page.tsx` `isBlurred = !isLoggedIn && index >= 3` → `!isPro && index >= 3` |
| HallyuCalendar — 아티스트 트래킹 | 비로그인 안내, **Free 무제한** | 비로그인+Free 3건 cap, Pro 무제한 | tracking banner `!isLoggedIn` → `!isPro` |
| HallyuCalendar — iCal / Google Calendar 구독 | Free 가능 (이미 현 상태) | 동일 (gate 추가 검토) | 변경 없음 |
| HallyuCalendar — Concert / Fan Meet 이벤트 | Pro 유지 (RLS `is_premium`) | 동일 | RLS 레벨, 코드만으론 불가 |
| KpopStats — Top 차트 | **전면 무료 개방 (비로그인 포함 Top 20)** | 비로그인 5건, Free Top 10, Pro Top 20 | `app/kpop/page.tsx` (visibleLimit 제거됨) |
| KpopStats — Spotlight (성장 추이) | Free 가능 (이미 현 상태) | 동일 | 변경 없음 |
| KpopStats — Artist Comparison | **비로그인 안내 → 로그인 유저 전체 개방** | 동일 | 변경 없음 (현행 유지) |
| KpopStats — 주간 성장 리포트 (상세 페이지) | **Free blur + 잠금 / Pro 전체 열람** | 동일 | `app/kpop/[id]/page.tsx` `weeklyInsight` + `isPro` |
| KpopStats — Track this artist 버튼 (상세 페이지) | **비로그인·Free → "Get notified with Hallyu Pass" / Pro → 현행** | 동일 | `app/kpop/[id]/track-artist-button.tsx` `isPro` prop |
| KdramaMatch — AI 추천 한도 | 비로그인 3 / Free 5 / Pro 30 | 동일 | `/api/dramas/recommend` 상수 (이미 spec 일치) |
| KdramaMatch — 시청 목록 / 별점·한줄평 | 로그인 필수 (Free 가능) | 동일 | 변경 없음 |
| KdramaMatch — AI Drama Summary | Pro 유지 (잠금 UI) | 동일 | copy 만 변경 |
| HangeulGo — 오늘의 표현 | Free 가능 | Free 가능 (rate-limit 인프라 향후) | 현재 백엔드 미구현 |
| HangeulGo — 드라마별 학습팩 미리보기 | Free 가능 (이미 현 상태) | 동일 | 변경 없음 |
| HangeulGo — AI Grammar Explanation | Pro 유지 | 동일 | copy 만 변경 |
| KfoodKit — 추천·쇼핑 리스트 | Pro 유지 (잠금 UI) | 동일 | copy 만 변경 |
| Curation K — 지도 핀 / 카드 / 국가별 위젯 | Free 가능 (이미 현 상태) | 동일 | 변경 없음 |
| Curation K — My Hallyu Course | Pro 유지 | 동일 | copy 만 변경 |

**Pro 잠금 UI copy 통일**: 모든 Pro 잠금 카드는 "Coming with Hallyu Pass" + "Notify me at launch" 패턴 사용. "Upgrade — $15/month" 직접 결제 유도 카피는 결제 연동 후 부활.

**복원 가이드** (결제 연동 시):
1. 본 표의 "복원 후" 컬럼 코드 한 줄씩 되돌림 (각 위치에 `// 2026-05-16 임시 정책` 주석 박제됨, grep 으로 일괄 찾기 가능).
2. Pro 잠금 카피 "Coming with Hallyu Pass" → "Upgrade — $15/month" 등 결제 유도 카피로 회귀.
3. DECISIONS.md "결제 연동 전 임시 Free 확대 정책" 항목 closed 표시.

### Curation K Free/Pro 확정 스펙 (2026-06-01)
- **My Hallyu Course → Pro 잠금** (blur + centered overlay 패턴)
- 나머지 전체 Free 개방 (지도 핀 / 카드 / 탭 / 모달 등)
- 구현 파일: `app/curation-k/page.tsx` — `!isPro` 분기를 blur-background + overlay 패턴으로 교체

### Curation K 확정 스펙 (2026-05-16 확정)

**서비스 개요**
- 라우트: `/curation-k`
- 핵심 컨셉: 한류 팬을 위한 한국 성지순례 & 여행 큐레이션
- 타겟: 한국 여행 예정 or 관심 있는 글로벌 K드라마·K팝 팬
- 데이터 소스: TourAPI(한국관광공사) + TMDB + Claude Haiku
- 번역 비용: 최초 1회 Claude 번역 후 DB 캐싱 (재번역 없음)

**데이터 수집 정책**
- 촬영지: 수동 큐레이션, 월 1회
- 관광지(12): 최초 1회 + 월 1회
- 문화시설(14): 최초 1회 + 월 1회
- 축제·행사(15): 매일
- 숙박(32): 최초 1회 + 주 1회
- 음식점(39): 최초 1회 + 주 1회
- 증분 업데이트: TourAPI `modifiedtime` 비교 → 변경 항목만 갱신
- Claude 번역: `overview_en` 없는 항목만 최초 1회 → DB 캐싱

**수집 필드**
- `title`(한글명), `eng_title`(영문명), `latitude`, `longitude`
- `addr1`, `addr2`, `image_url`, `image_url2`
- `overview_ko`(한글설명), `overview_en`(Claude번역)
- `homepage`, `area_code`, `sigungu_code`, `content_type_id`, `modified_time`

**페이지 구조**
1. 히어로: SVG 한국 지도 + 지역별 통계 오버레이 (촬영지/관광지/맛집 건수)
2. 필터 바: 지역 / 카테고리 / 드라마 연계 드롭다운
3. 콘텐츠 탭: [촬영지] [관광지] [맛집] [숙박] [문화시설] [축제·행사]
4. 카드 클릭 → 상세 모달 (이미지갤러리 / 영문설명 / 드라마배지 / 홈페이지 / Google Maps)
5. AI 맞춤 코스 (Pro 전용): 드라마+스타일+기간+출발지 입력 → Claude 1일 동선 생성

**Free vs Pro**
- Free: 지도 통계 / 촬영지 탭 / 축제·행사 탭 / 기본 카드 모달
- Pro: 전체 탭 / 드라마 연계 필터 / AI 맞춤 코스 / Google Maps 연동 / 상세 모달 전체

**DB 구조**
- `filming_spots`: 촬영지 전용
- `tour_spots`: 전체 카테고리 (`category` 컬럼으로 구분)

**기술**
- 지도: SVG 한국 지도 (외부 SDK 없이 구현)
- AI 코스: Claude Haiku, 유저 요청 시 실시간 생성
- 최초 수집: 어드민 수동 트리거
- 정기 업데이트: Vercel Cron (증분)

### HallyuCalendar 확정 스펙 (2026-05-16 확정)

**현재 수집 중 (기존 유지)**
- YouTube: 컴백 영상·썸네일·발행일·채널명
- TMDB: 드라마 제목·포스터·방영 시작일
- Last.fm: 아티스트 신보 감지
- Ticketmaster: 글로벌 공연·이벤트 (연동 완료 — `lib/api/ticketmaster.ts`)
- Resend: D-7·D-1·당일 이메일 알림 (현상 유지)

**추가 수집 확정 항목**

YouTube Data API:
- 영상 설명 (`snippet.description`) — Claude 이벤트 설명 생성 품질 향상
- 라이브 방송 일정 (`liveStreamingDetails`) — 쇼케이스·컴백 라이브 자동 수집
- 조회수 (`statistics.viewCount`)

TMDB API:
- 방영 중 여부 (`status`)
- OTT 플랫폼 정보 (`watch/providers`) — Netflix·Viki 등
- 에피소드 수 (`number_of_episodes`)
- 방영 요일 (`episode_run_time`)
- 평점 (`vote_average`)
- 시놉시스 (`overview`)
- 출연 배우 (`credits.cast`)
- 백드롭 이미지 (`backdrop_path`)

Last.fm API:
- 아티스트 월간 청취자 (`artist.getInfo → listeners`)
- 앨범 발매일 (`album.getInfo → releasedate`)
- 앨범 이미지 (`album.getInfo → image`)
- 앨범 트랙 목록 (`album.getInfo → tracks`)

Ticketmaster Discovery API:
- 공연 도시·국가
- 티켓 예매 링크

**제외 확정**
- KOPIS: 제외 (Ticketmaster로 대체)

**주의사항**
- TMDB 상업 라이선스 협의 필요 (sales@themoviedb.org)
- YouTube API 쿼터 관리 — tubewatch.kr와 별도 GCP 프로젝트 유지
- Ticketmaster 환경변수: `TICKETMASTER_API_KEY`

### KpopStats 확정 스펙 (2026-05-16 확정)

**현재 수집 중 (기존 유지)**
- YouTube: 채널 구독자수·총조회수·`channel_id` 자동매핑·주간 조회수 증감
- Last.fm: 아티스트 월간 청취자·총 재생수·7일 증감 트렌드
- Hallyu API: 그룹명·데뷔일·멤버 구성·소속사·활동 상태 (시드)

**추가 수집 확정 항목**

YouTube Data API:
- 채널 썸네일 (`snippet.thumbnails`) — 아티스트 카드·Discord 알림 이미지
- 최신 업로드 영상 (`activities.list`) — 최근 활동 표시·재방문 유도

Last.fm API:
- 아티스트 태그·장르 (`artist.getInfo → tags`) — 장르 필터 구현
- 국가별 청취자 (`geo.getTopArtists`) — 차별화 기능
- 주간 글로벌 차트 (`chart.getTopArtists`) — 차트 랭킹

Hallyu API:
- 음반 디스코그래피 — HallyuCalendar 컴백 연계

**제외 확정**
- YouTube 채널 개설일·설명: 활용처 없음
- Last.fm 아티스트 바이오: Claude 생성으로 대체
- Last.fm 유사 아티스트: 현재 단계 불필요
- Hallyu API 수상 이력: 데이터 최신성 낮음 (2020년까지)
- X(Twitter): MAU 500명+ 후 도입 유지

**주의사항**
- YouTube API 쿼터: `activities.list` 호출 추가 시 일일 쿼터 영향 검토 필요
- 국가별 청취자: `geo.getTopArtists` 는 아티스트별 호출 → 25명 × 1콜, 캐싱 필수
- X(Twitter) 환경변수: `TWITTER_API_KEY` (도입 시 등록)

### Shop this drama 확정 스펙 (2026-06-02)
- 위치: KdramaMatch 드라마 상세 페이지(DramaDetailModal) 하단 섹션
- Claude Haiku로 드라마별 패션/뷰티/라이프스타일 아이템 3~5개 자동 추출
- 어드민 검토/승인 후 구매 링크 수동 연결 (`is_approved = false` → 어드민 승인 시 `true`)
- **Free**: 아이템명 + 카테고리만 노출
- **Pro**: 구매 링크 + 브랜드 상세 노출
- DB: `drama_items` 테이블 (`drama_id`, `name`, `category`, `brand`, `description`, `purchase_url`, `is_approved`, `created_at`)
- 추출 스크립트: `scripts/generate-drama-items.ts` (dry-run 옵션 포함)
- 어드민: `app/admin/drama-items/page.tsx` (미승인 목록 + 승인/거절/링크 입력)
- API: `app/api/dramas/[id]/shop/route.ts` (승인된 아이템만 반환)
- 아이템 없으면(승인된 항목 0건) 섹션 미표시

### KdramaMatch Free/Pro 확정 스펙 (2026-06-01)
- 전체 기능 Free 개방 (AI 추천 횟수 제한 없음, Drama Summary 등 모두 개방)
- **2026년 드라마 상세 페이지만 Pro 잠금** (`drama.year === 2026 && !isPro`)
  - 카드 우상단 🔒 Pro 뱃지 표시
  - hover 시 "Unlock with Hallyu Pass" 오버레이
  - 클릭 시 상세 페이지 이동 차단 → 업그레이드 안내 모달
  - 2025년 이하 → 기존과 동일 / Pro 유저 → 2026년도 정상 접근
- `DramaCard`, `TrendingCard`, `NowAiringCard` 모두 동일 적용

### KdramaMatch 확정 스펙 (2026-05-16 확정)

**현재 수집 중 (기존 유지)**
- TMDB: 드라마 제목·포스터·방영시작일·장르·평점·시놉시스·방영상태·플랫폼
- Claude Haiku: AI 추천·추천 이유·fallback 추천 (동작 중)
- Supabase: 시청 목록 (`wantToWatch`·`watching`·`completed`)

**추가 수집 확정 항목**

TMDB API:
- 출연 배우 (`credits.cast`) — 배우 기반 필터·추천 핵심
- OTT 플랫폼 정보 (`watch/providers`) — Netflix·Viki 등 "어디서 보기" 버튼
- 원제 한글 (`original_name`) — SEO + 한국 팬 필수
- 백드롭 이미지 (`backdrop_path`) — 드라마 상세 모달 배경
- 에피소드 수 (`number_of_episodes`) — 시청 진행 트래킹 기반
- 방영 종료일 (`last_air_date`) — 완결 여부 표시
- 네트워크 (`networks`) — tvN·Netflix·MBC 구분
- 예고편 영상 (`videos.results`) — 상세 모달 트레일러
- 인기 지수 (`popularity`) — 정렬 기준 추가
- 시즌 수 (`number_of_seasons`) — 시즌제 드라마 구분

Claude Haiku:
- 에피소드 요약 — Pro 핵심 기능 (현재 blur만 있음)
- 캐릭터 관계도 — Pro 차별화 기능 (현재 blur만 있음)

Supabase (자체):
- 에피소드 진행 기록 — 시청 트래킹·락인 효과 핵심
- 유저 평점 — 추천 개인화 향상

**제외 확정**
- MyDramaList API: TMDB로 대체 가능, 연동 공수 대비 효과 낮음 — MAU 쌓인 후 재검토
- 유저 리뷰: MAU 쌓인 후 도입
- 제작 국가 (`origin_country`): 한국 드라마 필터링은 기존 로직으로 충분

### HangeulGo Free/Pro 확정 스펙 (2026-06-01)
- **Beginner 표현 → Free 전체 개방**
- **Intermediate / Advanced 표현 → Pro 잠금** (`phrase.difficulty === 'intermediate' || 'advanced'` + `!isPro`)
  - Today's Lesson 카드: 잠금 상태 표시 (드라마 태그만 노출, 표현 내용 숨김) + CTA 버튼
  - Drama Learning Packs 카드: 🔒 Pro 뱃지 + hover "Unlock with Hallyu Pass" 오버레이 + 클릭 → 업그레이드 모달
- Drama Learning Packs 전체 잠금 오버레이(`!isPro`) 제거 → 개별 카드 단위 잠금으로 전환
- Grammar Explanation → 기존대로 Pro 유지 (변경 없음)
- Pro 유저 → 전체 정상 접근

### HangeulGo 확정 스펙 (2026-05-16 확정)

**현재 상태**
- 전체 미구현 (M+3 예정)

**구현 순서**

Phase 1 — 콘텐츠 기반 구축:
- 드라마 메타데이터 (TMDB) — KdramaMatch DB 공유, 추가 비용 없음
- 오늘의 표현 생성 (Claude Haiku) — 매일 재방문 유도 핵심
- 드라마 대사 기반 학습 카드 (Claude Haiku) — 핵심 콘텐츠
- 단어 뜻·예문·품사·유의어·반의어 (Naver 사전) — 학습 카드 완성
  → 유의어·반의어는 학습 카드 하단 접이식 텍스트 표기 (초급 무시 / 중·고급 활용)

Phase 2 — 학습 경험 강화:
- 문법 설명 (Claude Haiku) — Pro 핵심 기능
- 퀴즈 문제 생성 (Claude Haiku) — 재방문·게임화 핵심
- 학습 스트릭·진행 기록 (Supabase) — 락인 효과 핵심
- 학습 레벨·퀴즈 정답 기록 (Supabase) — 성취감·개인화

Phase 3 — 차별화:
- 한국어 발음 TTS (ElevenLabs $22/월) — Phase 1·2 안정 후 도입
- 사전 생성 + CDN 캐싱 — TTS 비용 70% 절감 필수 구조

**제외 확정**
- 출연 배우: HangeulGo 활용처 없음
- 발음 팁 설명: ElevenLabs TTS로 대체

**비용 구조**
- Phase 1: ~$0
- Phase 2: ~$5/월
- Phase 3: ~$27/월 (ElevenLabs $22 + Claude)

**주의사항**
- Naver 사전 API: 백엔드 연동 필수 (해외 유저 직접 호출 불가)
- ElevenLabs: 요청마다 실시간 호출 금지 — 사전 생성 + CDN 캐싱 필수
- 드라마 대사 원문 다량 사용 금지 — 학습 목적 인용 범위 내 사용
- K팝 가사 직접 게시 금지 — 표현 설명 형태로만 활용

### KfoodKit Free/Pro 확정 스펙 (2026-06-01)
- **Local Ingredient Matcher** (구 "UnfoldK Ingredient Finder") → Pro 잠금
- **My Shopping List** → Pro 잠금
- 위 두 섹션은 하나의 `relative` 컨테이너로 통합, 전체 `blur-[4px]` + 중앙 단일 오버레이
- **This Week's K-Drama Food Guide** → **Free 전체 개방** (Pro 잠금 제거, 2026-06-01 변경)
- 나머지 전체 Free 개방
- 구현 파일: `app/food/page.tsx` · `components/food/drama-food-guide-section.tsx` (`isPro` prop 완전 제거)

### KfoodKit 확정 스펙 (2026-05-16 확정)

**서비스 컨셉**
드라마 속 음식 → 현지 재료로 만들기 → 한국 현지 맛집 연계
유저 여정: 드라마에서 음식 발견 → 내 나라 재료로 레시피 도전 → 한국 가서 진짜 먹어보기 (Curation K 연계)

**현재 상태**
- 전체 미구현 (M+4 예정)

**구현 순서**

Phase 1 — 드라마-음식 연계 콘텐츠:
- 드라마 메타데이터 연계 (TMDB — KdramaMatch DB 공유, 추가 비용 없음)
- 드라마-음식 연계 DB (Claude Haiku 자동 생성) — KdramaMatch dramas DB 기준으로 Claude가 드라마별 등장 음식 자동 추출 + DB 저장. 수동 큐레이션 없음. 어드민에서 검토·수정만 가능.
- 드라마 등장 음식 설명 (Claude Haiku) — 팬 감성 기반 설명 생성
- 해외 대체 재료 추천 (Claude Haiku) — 핵심 차별화 기능

Phase 2 — 레시피 콘텐츠:
- 한식 레시피 DB (Spoonacular $29/월) — 재료·조리법·영양·이미지
- 관련 요리 YouTube 영상 (YouTube Data API) — 기존 인프라 재활용
- 저장한 레시피 컬렉션 (Supabase) — 락인 효과
- 국가별 맞춤 재료 변환 (Claude Haiku) — 나라별 개인화

Phase 3 — 한국 현지 연계:
- 지역 대표 음식점 (TourAPI — Curation K DB 공유, 추가 비용 없음)
- 음식점 GPS·주소·이미지 (TourAPI)
- 주간 K푸드 챌린지 (Supabase) — 재방문·바이럴 유도

**데이터 공유 구조 (비용 절감)**
- KdramaMatch DB → 드라마·포스터 재활용
- Curation K DB → 음식점·GPS 재활용
- YouTube 인프라 → 기존 쿼터 재활용

**Free vs Pro**
- 드라마-음식 연계: Free 주 1건 / Pro 무제한
- 레시피 조회: Free 주 1건 / Pro 무제한
- 대체 재료 AI 추천: Free ✅ / Pro ✅
- 국가별 재료 변환: Free ✅ / Pro ✅
- 레시피 컬렉션 저장: Free 5개 제한 / Pro 무제한
- 한국 현지 맛집 연계: Free 기본 / Pro 전체
- 주간 챌린지: Free ✅ / Pro ✅

**제외 확정**
- Spoonacular 유사 레시피: 초기 단계 불필요
- 레시피 난이도 조정: Claude 설명으로 대체
- YouTube 채널 통계: KfoodKit에서 불필요

**비용 구조**
- Phase 1: ~$0
- Phase 2: ~$31/월 (Spoonacular $29 + Claude)
- Phase 3: ~$31/월 (TourAPI 무료 + 기존)

### Fan Meet 탭 확정 스펙 (2026-06-01)

- **Ticketmaster 행사**: Fan Meet 탭 캘린더 노출 + 외부 티켓 링크 (Get Tickets 버튼)
- **유저 등록 행사**: Submit a Fan Event → 어드민 승인 → Fan Meet 탭 캘린더 자동 노출
  - 행사 카드 모달: `registration_link`(Google Form 등) 우선 → 없으면 `contact_email` (mailto:)
  - UnfoldK는 캘린더 노출까지만 / 접수 현황은 주최자 직접 관리
  - 향후 MAU 증가 시 내부 신청폼 전환 검토
- **DB**: `fan_event_requests` + `hallyu_calendar_events` 모두 `contact_email`, `registration_link` 컬럼 (migration 0056) — 승인 시 admin route 가 복사
- **Pro 잠금**: Fan Meet 탭 전체 Pro 전용 유지

### curation-k 지도 컴포넌트 수정 금지 (동결)
- `app/curation-k/page.tsx` 상단의 SVG 한국 지도 영역 — `KOREA_CITIES`, `KOREA_ISLANDS`, `proj()`, polygon 스타일, 펄스 애니메이션 — **모두 동결**.
- 변경 사유:
  - 독도·마라도·울릉·백령도 4 부속 도서 + 6 도시 (Seoul/Chuncheon/Gyeongju/Busan/Gwangju/Jeju) 시각 구성이 사용자 검토 후 확정됨.
  - 50m TopoJSON 누락분 보완 + 한국 공식 지도 관용 (독도 inset) 반영된 결과물.
- **수정 금지 범위 (SVG 내부)**: `<svg>` 안의 path·ellipse·circle·text·grid 라인 + `KOREA_CITIES`/`KOREA_ISLANDS`/`proj()`/polygon 스타일·펄스 애니메이션. SVG 자체에 새 element 추가 금지.
- **허용 (SVG 외부 sibling overlay)**: `relative` wrapper 의 sibling 으로 absolute positioned HTML element 추가 가능. 예: 카테고리 핀 (2026-05-17 사용자 명시 승인), 영역 라벨, 인터랙티브 컨트롤. `proj()` 를 그대로 import 해 동일 좌표계 사용. `pointer-events` 분리 (layer:none / 핀:auto) 로 SVG 자체 무클릭 유지.
- 변경 필요 시 별도 PR + 사용자 사전 승인 후 진행. 코드에 `// ⚠️ 수정 금지 (CLAUDE.md §6)` 주석 박제됨 — grep 으로 위치 확인 가능.

### Curation K (HallyuMap) 데이터 원칙
- **TourAPI 4.0** (`lib/api/tourapi.ts`) — KorService2 영문 엔드포인트 + JSON. `TOUR_API_KEY` **Decoding 키** 사용 (URL-encoded 형식 그대로 쓰면 fetch 가 한 번 더 인코딩해 깨짐).
- TourAPI 응답 캐싱: 지점 데이터 6h / 행사 1h / 이미지 24h (CLAUDE.md §6 #5).
- `items.item` 응답 형태 3 케이스 (`undefined` / 단일 객체 / 배열 / 빈 문자열 `""`) — `normalizeItems` 가 모두 배열로 정규화. 직접 접근 금지.
- `mapx` (경도) / `mapy` (위도) 는 문자열 — Number 변환 + 0/NaN 가드 (`normalizeSpot`).

### filming_spots 신뢰도 정책
- Claude Haiku (`lib/curation-k/filming-spots.ts`) 가 드라마별 촬영지 1~5개 + `confidence` 0~1 추정.
- `confidence ≥ 0.5` 이고 TourAPI GPS 매핑 성공 → `status='confirmed'` (공개 노출).
- 그 외 → `status='pending'` (어드민 검토 필요, 일반 사용자 미노출).
- Claude 가 모르는 드라마는 `__no_spots_found__` 더미 row 1건 삽입해 cron 재시도 차단. `(drama_title, spot_name)` unique 로 멱등.
- cron 일 cap: 드라마 5편 × 촬영지 5개 = 신규 25/일 (비용·품질 둘 다 통제).
- 어드민 수동 확정·삭제는 `filming_spots` 직접 UPDATE (어드민 UI 별도 — Phase 2).

### AI 처리 원칙
- **모든 AI 처리는 Claude API (Haiku / Sonnet) 우선 적용**. 타사 AI (OpenAI · Gemini · Mistral 등) 도입 전 Claude 로 구현 가능한지 먼저 검토.
- **Haiku 4.5** (`claude-haiku-4-5-20251001`) — 콘텐츠 생성·분류·추출 등 경량 작업. 현재 사용처: `lib/claude/generate-event-description.ts` · `lib/claude/recommend-dramas.ts` · `lib/claude/ingredient-finder.ts` · `lib/blog-gen/anthropic.ts` · `lib/curation-k/filming-spots.ts`.
- **Sonnet 4.6** (`claude-sonnet-4-6`) — 고품질 추천·복잡한 추론 등 고도화 작업. Haiku 출력 품질이 정성적 임계값 미달 시 같은 프롬프트로 모델만 교체.
- **비용 최적화**:
  - **프롬프트 캐싱** 우선 — `system` 블록에 `cache_control: { type: "ephemeral" }` (기존 패턴 `lib/claude/generate-event-description.ts`). Haiku cache prefix 최소 4096 토큰 — 미달 시 silent no-op 이라 무해.
  - **배치 API** 50% 할인 — 시간 민감하지 않은 대량 작업 (예: 신규 아티스트 분류·기존 데이터 backfill) 은 messages.create 대신 messages.batches.create.
  - 응답 결과 Supabase / Next.js cache 저장 (§6 #5 와 동일 원칙).
- 사용자 facing 실시간 처리 (예: 채팅·추천 클릭 시 응답) 는 정확도·지연 trade-off 검토 후 결정. 기본은 Haiku, 품질 부족 시 Sonnet.

### KfoodKit 제휴 수익 로드맵
- **Phase 1 (현재)**: Claude AI 텍스트 기반 대체재료 + 현지 마트 안내 (`lib/claude/ingredient-finder.ts`). 추천만 노출, 외부 링크 없음.
- **Phase 2 (MAU 1,000명+)**: Amazon Associates 제휴 링크 연동
  - 미국·영국·캐나다·일본·호주 Amazon 각국 제휴 프로그램 신청 (지역별 별도 승인 필요)
  - 한국 식재료 검색 → 실제 상품 링크 + 수수료 수익
- **Phase 3 (MAU 5,000명+)**: 동남아 Shopee·Lazada 제휴 연동
  - 태국·필리핀·베트남·인도네시아·말레이시아

---

## 7. 비로그인 접근 정책 (2026-06-01 확정)

### 원칙
- **비로그인 → 각 서비스 메인 페이지 접근 가능** (카드/버튼 인터랙션 제외)
- **비로그인 → 카드/버튼 호버 시 툴팁** "Sign up to access — it's free" 표시
- **비로그인 → 카드/버튼 클릭 비활성화** (cursor-not-allowed, overlay 클릭 차단)
- **Pro 잠금 섹션은 비로그인에도 동일 잠금** 유지 (변경 없음)

### 구현 방법
공통 래퍼 `AuthGate` (`components/auth-gate.tsx`) 사용:
- `isLoggedIn === false` 일 때만 활성화 (null = 인증 확인 중 → 차단 없음)
- `tooltipInside` prop: `overflow:hidden` 부모 안에서 툴팁을 요소 내부 중앙에 표시

### 예외 (비로그인 전체 접근 가능)
- `/pricing`, `/about`, `/signup`, `/login` 페이지 전체
- 각 서비스 메인 페이지 자체 (카드 제외)
- HangeulGo — Play pronunciation 버튼 (TTS 재생만, 학습 기록 불필요)

### 적용 현황
| 서비스 | 적용 대상 |
|--------|----------|
| HallyuCalendar | 이벤트 카드 (Top3, Featured, 달력 그리드, Upcoming 아코디언) |
| KdramaMatch | DramaCard, TrendingCard, NowAiringCard |
| KpopStats | 차트 행, Trending 카드, Top Movers 카드, More Artists 카드, 검색 결과 카드 |
| HangeulGo | Got it / Review again / Next expression / Save phrase / Show synonyms & antonyms |
| KfoodKit | Browse All 레시피 카드, Start Challenge 버튼 |
| Curation K | SpotCard (SpotsTabPanel 내부) |

### 관련 파일
- `components/auth-gate.tsx` — 공통 래퍼 (신규)
- `app/calendar/page.tsx` — isBlurred 제거 + AuthGate 래핑
- `app/drama/page.tsx` — 카드 AuthGate 래핑
- `app/kpop/page.tsx` — 카드/링크 AuthGate 래핑
- `app/korean/korean-content.tsx` — 버튼 AuthGate 래핑
- `app/food/page.tsx` — 카드 AuthGate 래핑
- `app/curation-k/page.tsx` — SpotCard AuthGate 래핑

---

## 8-1. 자주 하는 실수 (하지 말 것)

```
❌ YouTube API 를 tubewatch.kr 와 같은 GCP 프로젝트 → 쿼터 초과 시 양쪽 중단
   (2026-07-11 YouTube Data API 전체 제거로 현재 코드베이스에 해당 없음 — 재도입 시에도 별도 프로젝트 원칙 유지)
❌ Spotify API → 2025.05 부터 법인 전용. Last.fm 대체
❌ TossPayments → 해외 유저 경험 불량. Paddle 확정 (KYB 심사 중, 2026-06-17 제출)
❌ KOPIS API 재가동 → 국내 공연만 제공, 글로벌 유저 대상 서비스 부적합 (2026-05-16 폐기)
   글로벌 공연은 Ticketmaster 가 담당. cron + lib/api/kopis + lib/ingest/kopis 모두 제거.
   DB 잔존 행도 SQL `DELETE FROM hallyu_calendar_events WHERE source_api='kopis'` 로 정리됨.
❌ 서비스별 별도 users 테이블 → Hallyu Pass 통합 불가
❌ ElevenLabs TTS 실시간 호출 → 비용 폭증. 사전 생성 + CDN 캐싱 필수
❌ RLS 나중에 추가 → 전체 보안 재작업
❌ v0 UI 임의 수정 → 로직·API 연동만
❌ 아티스트 이미지 서버 직접 저장 → 저작권. URL 링크만
❌ 한 세션 여러 서비스 동시 개발 → 하나씩 완성 후 다음

❌ Billboard 크롤링 / 스크래핑 → 공식 API 없음. 이용약관 위반 + 법적 리스크. 절대 금지.
❌ Spotify 브랜드명·데이터 직접 인용 → 법인 계정 필수 + 상표권. Last.fm 으로 대체.
❌ 외부 데이터 무출처 노출 → Last.fm 기반 차트엔 "Powered by Last.fm" 표기 필수.
❌ 기획안 즉시 구현 → 법적 리스크 / 데이터 출처 / 기술 실현성 먼저 검토 후 보고.

❌ 새 필드 추가 시 6단계 동기화 누락 → 폼 미추가 시 silent NULL
   ① 마이그레이션 / ② zod(POST+PATCH) / ③ snake→camel / ④ type /
   ⑤ FormState+EMPTY_FORM+startEdit / ⑥ 폼 JSX+handleSubmit

❌ Toaster 미마운트 영역에서 useToast → silently no-op
   root layout 미마운트, admin 만 마운트. 비-admin 페이지엔 로컬 <Toaster /> 필수.

❌ RLS 정책 변경 후 마이그레이션 SQL 누락 → silent fail (0행 update + 에러 X)
   PROGRESS.md "사용자 액션 필요" 섹션에 SQL 박제 + 사용자 직접 실행 의무.

❌ plan_type 만 변경 + subscription_status 미동기화 (페어 컬럼 클래스 버그)
   RLS 가 두 컬럼 동시 검증. write path 6곳 점검: webhook 6 이벤트 /
   apply-coupon / admin/users PATCH / complete-signup.

❌ 데이터 오염 증상을 SQL UPDATE 로 즉시 봉합 → 임시방편
   진짜 원인은 write path 코드 추적. SQL 백필은 코드 fix 와 함께만 가치.

❌ kpop_artists.youtube_channel_id 자동 매핑 = search.list 1위 박제
   공식 채널 미스 빈발 (팬 채널·라벨·동명이인). BTS·BLACKPINK 초기 매핑 미스
   → migration 0019_fix_bts_blackpink_channel.sql 로 정정한 전례.
   대량 시드 후 어드민에서 채널 확인·정정 필수.
   (2026-07-11 KpopStats·YouTube API 모두 제거되어 현재 코드 없음 — 유사 기능 재도입 시 참고)

❌ YouTube search.list 대량 호출 (신규 아티스트 N명 매핑) → 일일 quota 초과
   search.list = 100 units/명. 250명 = 25,000 units > 10,000 daily.
   (2026-07-11 YouTube API 전체 제거로 현재 코드 없음 — lib/ingest/kpop-stats.ts 도 이미 삭제됨)

❌ Header / 공통 chrome 페이지마다 import → unmount/remount 반복 + 인증 fetch
   반복 + 깜빡임. root layout 단일 마운트 + usePathname 가드 (HIDE_HEADER_PREFIXES).
```

---

## 9. 세션 운영

### 시작
1. PROGRESS.md 먼저 읽고 현재 상태 파악
2. 이번 세션 목표 한 줄 확인
3. 목표 범위 밖 작업 금지

### 작업 중
- 새 기술 결정은 DECISIONS.md 즉시 기록 (형식: `## 날짜 제목` / 결정 내용 / 이유 / 대안)
- 외부 API 연동 · DB 스키마 변경 · 폴더 구조 변경은 **반드시** DECISIONS.md
- **PROGRESS.md 는 작업 중 건드리지 말 것** — 매 커밋마다 갱신 금지

### 종료
- **PROGRESS.md 는 세션 종료 시점에 한 번만 일괄 업데이트** (2026-05-14 정책)
- 종료 신호: 사용자 명시 종료 ("이만", "여기까지", "다음에", "나중에 올게") OR PROGRESS.md 업데이트 직접 요청
- 한 세션 중 여러 작업이 있었다면 모아서 하나의 "현재 상태" 블록으로 정리 — 작업 단위로 블록 쪼개지 말 것
- 형식: 완료 / 진행 중 / 다음 세션 / 블로커 / (필요 시) 사용자 액션
- 미완성 코드는 `// TODO: [다음 세션] …` 주석
- 기술 결정 있었다면 DECISIONS.md 동시 갱신

### 우선순위
- 사용자(관리자)의 명시적 요청 > 모든 원칙
- "UI 수정 금지" 는 AI 임의 판단 방지용. 사용자 직접 지시 시 v0 영역 변화 수준 미리 알리고 상의

---

## 10. 문제 해결 원칙

1. 가장 단순한 방법 먼저 시도 (SQL 직접 수정, 이미지 URL 직접 입력 등)
2. API 검증·디버깅 라우트 추가 전에 사용자에게 직접 확인 요청
3. 외부 fetch/검증은 사용자 확인 없이 단독 시도 금지
4. 썸네일·이미지 문제 → 브라우저에서 이미지 주소 복사 후 SQL 직접 업데이트
5. 채널 ID·외부 리소스 검증 → 사용자에게 브라우저 직접 확인 요청
6. 우회로 찾기 전에 "가장 단순한 해결책이 뭔가?" 먼저 자문

---

## 10. 작업 범위 원칙

1. 사용자가 명시한 작업만 수행
2. 진단·검증 코드 추가 전 사용자 승인 필요
3. 불필요한 fetch·외부 API 호출 금지
4. PROGRESS.md 업데이트는 세션 종료 시 한 번에

---

서비스 전체 기획 방향은 SERVICE_ARCHITECTURE.md 참조

---

## 변경 금지 기능 목록 (DO NOT MODIFY)

> 아래 기능들은 이미 확정된 동작 방식입니다.
> 최적화·리팩토링·버그 수정 명목으로도 동작 방식을 임의로 변경하지 말 것.
> 변경이 필요하면 반드시 사용자에게 먼저 확인 후 진행.

### HangeulGo — Grammar Explanation
- 표현 로드 시 자동으로 grammar 분석 표시
- 버튼 클릭 방식으로 변경 금지
- DB 캐시(`korean_grammar_cache`) 우선 조회 후 캐시 미스 시에만 Claude Haiku 호출
- 자동 호출 → 수동 호출로 임의 변경 금지
- 구현: `app/korean/korean-content.tsx` (useEffect), `app/api/korean/grammar/route.ts`

### HangeulGo — 표현 자동 로드
- 페이지 진입 시 오늘의 표현 자동 표시
- 유저가 버튼을 눌러야 표현이 나오는 방식으로 변경 금지

### KpopStats — Chart Attack 섹션 구성
- 확정 섹션 순서: Alert Zone → Golden Hour → Velocity Tracker → Fan Power Ranking → Chart Insight → Share to Attack → Next Chart Update
- 섹션 제거·순서 변경·병합 금지

### KfoodKit — 레시피 랜덤 노출
- 페이지 진입마다 랜덤 순서로 레시피 노출
- 고정 순서(`created_at` 등)로 되돌리지 말 것
- `cache: 'no-store'`, `dynamic: 'force-dynamic'` 유지

### 전체 공통
- 기존 구현된 기능의 동작 방식을 사용자 확인 없이 임의로 변경하지 말 것
- "최적화", "리팩토링", "마이너 개선" 명목으로도 유저가 체감하는 동작이 바뀌는 변경은 금지
- 변경 필요 시 반드시 사용자에게 먼저 확인 후 진행

---

## 작업 예정

### KfoodKit 레시피 모달 맛집 연동
- 국내 위치 유저(IP 감지 기준)가 레시피 모달 열 때 해당 도시 맛집 tour_spots 데이터 모달 하단에 표시
- content_type_id 맛집 카테고리 확인 필요 (tour_spots 테이블 content_type_id 값 확인 후 적용)
- 맛집 데이터 없는 도시는 미표시
- 해외 유저는 미표시
- IP 감지 로직은 `app/curation-k/page.tsx` My Hallyu Course 개편 시 구현한 방식 재활용
  (`fetch('http://ip-api.com/json')` → `city`, `lat`, `lon`, `countryCode` 추출)

*UNFOLD LAB | unfoldk.com | 2026-05 | v3.3*
