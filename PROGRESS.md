# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.
> 이전 세션 기록 → PROGRESS_2026_05.md

---

## 현재 상태 (2026-05-31 세션 35)

### 완료

#### 개발

- **Hallyu Pass 가격 인하** (878010c)
  - 월간 $15 → $9, 연간 $120 → $72 ($6/월, 33% 할인)
  - 수정 파일: pricing-section, start, terms, mypage/subscription, mypage, admin, send-trial-emails, testimonial-grid-section, CLAUDE.md

- **Curation K — Klook 제휴 배너 추가** (b97f399 → 5eb926e)
  - 지도 섹션 하단(`</main>` 직전) 배너 신설
  - 초기 단일 버튼 → K-Pop Sites / Filming Spots / Food Tours / Stays 4개 카테고리 버튼으로 업그레이드
  - 각 버튼 Klook 제휴 링크(aid=122963) 연결, `target="_blank"`

- **KpopStats YouTube UI 제거 + Last.fm 강화** (f365d00)
  - 구독자/조회수 YouTube 수치 제거, Last.fm Listeners/Plays 중심으로 재편

- **MusicBrainz 동기화** 191/280명 완료

- **migration 0050** kpop_weekly_features
- **migration 0051** kpop_enrichment
- **migration 0052** comparison_cache
- **migration 0053** kpop_country_charts_expand
- **migration 0054** kpop_artist_follows ✅ 실행 완료

- **Discord 봇 채널별 이미지 6개 적용 + 링크 중복 제거**

- **Artist Comparison 전면 개편**
  - 충성도·모멘텀·Claude 인사이트·Artist Profile 카드로 재구성

- **KpopStats 전면 무료 개방 + 아티스트 상세 Pro 게이팅**
  - /kpop 메인: 비로그인 포함 Top 20 전체 무료 열람
  - /kpop/[id]: Weekly Growth Report (Free blur+잠금 / Pro 전체)
  - TrackArtistButton: 비로그인·Free → "Get notified with Hallyu Pass"

- **My Artists 페이지 근본 수정**
  - `youtube_thumbnail_url` → `thumbnail_url` 컬럼명 버그 수정 (이미지 미표시 해결)
  - kpop_artists 조회 admin client 전환 (RLS 우회)
  - unmatched 카드 제거 (이벤트명 오노출 방지)
  - 두 소스 합산: kpop_artist_follows(직접 팔로우) + user_calendar_subscriptions(이벤트 구독)
  - Track this artist POST/DELETE → kpop_artist_follows 동기화

- **SEO 최적화 전체**
  - 8개 서비스 페이지 metadata (title/description/og/twitter/canonical)
  - JSON-LD: WebSite + Organization (전역), WebApplication + FAQPage (/name), WebApplication (/kpop)
  - sitemap.ts: /name 추가(0.9), kpop_artists 동적 URL(/kpop/[id]) 생성
  - robots.ts: trailing slash 추가
  - /name 페이지 SEO 콘텐츠 섹션 (How it works / Why / FAQ 5개)

- **KdramaMatch 크로스링크 4개 서비스 연결**
  - 드라마 상세 모달 하단 2×2 카드 그리드
  - HangeulGo / KfoodKit / Curation K / HallyuCalendar (drama 파라미터 전달)

- **서비스 간 크로스링크 3곳 추가**
  - KpopStats `/kpop/[id]` 하단: Calendar · Curation K · KdramaMatch (3칸)
  - HangeulGo PackDetailModal 하단: KfoodKit · Curation K · Calendar (drama 파라미터)
  - Curation K SpotDetailDialog: pill → 2×2 카드 그리드 (HangeulGo·KfoodKit·KdramaMatch·Calendar)
  - Curation K KpopSpotDetailDialog: KpopStats(artist_id) · Calendar · KdramaMatch · HangeulGo

- **HangeulGo Grammar Explanation 카드 이미지 추가** (a320624)
  - `korean_phrases.image_url` 컬럼 추가 (migration 0055) ✅ 실행 완료
  - 어드민 `/admin/korean` 신설: 표현 검색 + 이미지 업로드(Supabase Storage) + 미리보기 + 100건 페이지네이션
  - Supabase Storage `korean-phrase-images` 버킷 + 공개 정책 ✅ 적용 완료
  - Grammar Explanation 카드: 이미지(max-h-520px) + 문법 텍스트 + 구분선 + scene_description 순서

- **HangeulGo scene_description 자동 생성** (a1cc015)
  - `scripts/generate-scene-descriptions.ts` 신설 — Claude Haiku 배치 API (50% 할인)
  - scene_description IS NULL 표현 전체 조회 → 1~2문장 영문 장면 설명 자동 생성 → DB 업데이트
  - Grammar Explanation 카드 문법 텍스트 하단에 이탤릭 회색으로 표시 (없으면 미노출)

- **HangeulGo 중급·고급 드라마 문장 표현 배치 생성** (74a8dab)
  - `generateDramaPhrases()` — Claude 1콜로 3개 배열 반환 (`lib/claude/korean-phrase.ts`)
  - `scripts/generate-drama-phrases.ts` — 전체 드라마 순회, 드라마당 intermediate 3 + advanced 3 생성
  - 멱등 (3개 이상 보유 시 스킵), `--dry-run` 플래그 지원
  - 실행: `npx tsx scripts/generate-drama-phrases.ts`

- **HangeulGo 동일 표현 중복 드라마 출처 표기** (c5e24b7)
  - `GET /api/korean/phrase-also-in?korean=&exclude_drama=` 신규 API
  - 오늘의 표현 카드 드라마 태그 아래 "📺 이 표현은 [드라마명]에서도 등장해요" 표기
  - 동일 `korean_text` 기준 중복 출처 없으면 미노출 / 최대 5개 드라마명

- **버그 수정**
  - MyPage Learning Progress 카드 클릭 → `/korean?phrase_id=` 파라미터 누락 수정 (5877f3a)
  - 어드민 Korean 조회 쿼리 `created_at` SELECT 누락 수정 (ee187cd)

#### 마케팅

- Reddit 프로필 세팅 완료 (Jaewoo / Indie dev from Korea)
- r/BeginnerKorean 첫 포스팅 — 170뷰, 업보트 100%
- r/Korean 포스팅 — 승인 대기 중
- Google Search Console sitemap 296페이지 제출 완료

### 다음 세션 후보

- KpopStats → HallyuCalendar 컴백 연결 (개선 플랜 §6 잔여)
- Reddit 카르마 쌓기 + 다음 포스팅
- Discord 마이크로 인플루언서 DM 캠페인
- filming_spots 어드민 Phase 2
- 결제 연동 (Lemon Squeezy 재심사 완료 후)

### 블로커

- Lemon Squeezy 재심사 이메일 발송 완료 → 결과 대기 중
- top.gg 심사 재제출 완료 → 대기 중
- r/Korean 포스팅 승인 대기

---

## 개발 원칙 (전체 사이트 공통)

> **자동화 우선**: 수동 데이터 투입이나 별도 운영 작업이 선행되어야 서비스 품질이 확보되는 로직은 전체 사이트 모든 작업에서 반영하지 않는다. 모든 기능은 자동화로 동작해야 한다.

> **DB 컬럼 확인 필수**: 코드 작성 전 반드시 실제 DB 테이블 구조를 먼저 확인하고 존재하는 컬럼명만 사용할 것. 가정하거나 추측으로 컬럼명을 사용하지 않는다.

> **PROGRESS.md 파일 관리**: PROGRESS.md 파일이 너무 길어지면 컨텍스트 창을 과도하게 소모함. 정기적으로 (또는 파일이 커질 때) 날짜별로 분리 보관할 것 (예: `PROGRESS_2026_05.md` 로 월별 분리). 현재 진행 중인 내용만 PROGRESS.md에 유지.

> **UI/기능 구현 완료 전 체크리스트**: 모든 UI/기능 구현 시 아래 항목을 반드시 체크하고 조치할 것.
> 1. 유저가 보기에 어색한 부분이 없는가
> 2. 빠진 UI 요소가 없는가 (축 표시, 툴팁, 레이블, 날짜 등)
> 3. 모바일 반응형이 적용됐는가
> 4. 데이터 없을 때 빈 화면/오류 없이 처리되는가
> 5. 프로토타입 수준이 아닌 실제 서비스 수준인가

---

## 개선 플랜 (콘텐츠 깊이 + 서비스 간 연결 강화)

### 1. KfoodKit — 드라마 스토리텔링 연결
- [ ] 각 레시피에 드라마명 + 에피소드 태그 추가
- [ ] 드라마 검색 시 해당 드라마에 등장한 음식 모아보기 기능

### 2. HangeulGo — 드라마 대사 맥락 강화
- [ ] 같은 드라마의 다른 표현 연결
- [ ] 비슷한 감정의 다른 표현 추천

### 3. KdramaMatch — 서비스 간 연결 고리
- [x] 드라마 모달 하단 크로스링크 4개 서비스 연결 (세션 31 완료)
- [ ] 감정선 기반 추천 태그 세분화

### 4. Curation K — 한류 감성 레이어
- [x] filming 촬영지 모달 크로스링크 카드 그리드 (세션 31 완료)
- [x] K-pop 성지 모달 크로스링크 신설 (세션 31 완료)
- [ ] 베스트 포토존 팁 추가

### 5. HallyuCalendar — 큐레이션 강화
- [x] "이번 주 놓치면 안 될 한류 일정 TOP 3" 편집 큐레이션 뷰 (세션 28 완료)
- [x] 해당 아티스트 KpopStats 차트 연결 링크 (세션 27 완료)

### 6. KpopStats — 스토리 있는 데이터
- [x] 순위 변동 인사이트 텍스트 (세션 28 완료)
- [x] "이번 주 급상승 아티스트 TOP 3" 섹션 (세션 28 완료)
- [x] 아티스트 상세 하단 크로스링크 (세션 31 완료)
- [ ] 관련 HallyuCalendar 컴백 일정 연결 링크

### 임시 Free 확대 정책 (결제 연동 시 복원 필요)
| 기능 | 현재 | 복원 후 |
|------|------|---------|
| KpopStats — Artist Comparison | 로그인 유저 전체 | Pro 전용 |
| KpopStats — 아티스트 상세 Track 버튼 | 비로그인·Free → "Get notified" | Pro 전용 tracking |
