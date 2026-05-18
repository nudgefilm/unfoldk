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

## 2026-05-15 kpop_artists.member_count 컬럼 추가 (DB 스키마)

- 결정 내용:
  - migration `0020_kpop_artists_member_count.sql` — `kpop_artists` 에 `member_count integer` 추가.
  - 의미: NULL=미분류 / 1=솔로 / 2+=그룹 (인원 수).
  - check 제약 `member_count IS NULL OR member_count >= 1`.
  - `/kpop/artists` 의 Group/Solo 필터에서 사용.
- 이유:
  - Top 500 Last.fm 시드로 255명 신규 추가하면서 솔로/그룹 혼재. 노출 페이지에 필터가 필요해짐.
  - boolean `is_group` 보다 정수 `member_count` 가 정보량 우위 (그룹 인원 수 동시 표현 가능).
  - NULL 허용 — 어드민 수동 backfill + AI 분류 (Claude Haiku) 보조.
- 대안:
  - `artist_type` enum (group/solo/unknown): 표현력 부족 — 그룹 인원수 별도 필요.
  - 분류 미구현 채로 노출: 사용자 요청 "그룹/솔로 필터" 만족 X.
- 후속:
  - Haiku 4.5 일회성 분류로 280명 중 96명 솔로 / 178명 그룹 / 6명 미분류로 backfill 완료.
  - 어드민 `/admin/kpop` 에 입력 UI 반영 — 6단계 동기화 (zod ×2 / type / FormState / 폼 / 테이블 컬럼).

## 2026-05-15 YouTube 채널 자동 매핑 정확도 게이트

- 결정 내용:
  - `lib/api/youtube.ts:searchChannelByName` 에 3중 게이트 추가:
    1. 검색 쿼리 `${artistName} official`
    2. 채널명 정규화 매칭 (한쪽이 다른 쪽 포함, 실패 → NULL)
    3. `channels.list` 로 `subscriberCount ≥ 100,000` 검증 (hidden 도 차단)
  - 비용: search.list 100 + channels.list 1 = **101 units/명**.
  - CLAUDE.md §6 에 "YouTube 채널 자동 매핑 원칙" 으로 명문화.
- 이유:
  - search.list 1위 박제만으론 공식 채널 미스 빈발. BTS·BLACKPINK 초기 매핑 미스 → migration 0019 로 정정한 전례.
  - 대량 시드 (255명 신규) 후 어드민 수동 정정 부담 최소화.
  - "오매핑 > NULL" 원칙 (NULL 은 다음 cron 에서 재시도 가능, 잘못 박힌 ID 는 자동 매핑 단계에서 skip).
- 대안:
  - 자동 매핑 완전 폐기 + 어드민 수동만: 운영 부담 ↑.
  - 화이트리스트 (verified channel ID 목록) 도입: 신규 아티스트 매번 수동 관리 필요.

## 2026-05-15 YouTube channel 자동 매핑 일일 50명 cap

- 결정 내용:
  - `lib/ingest/kpop-stats.ts:MAX_CHANNEL_MAPPING_PER_RUN = 50`.
  - cron 1회당 미매핑 아티스트 최대 50명만 search.list 호출. 나머지는 다음 cron 으로 이연.
  - 로그에 `이연 N명` 카운트 노출.
- 이유:
  - YouTube daily quota 10,000 units. search.list 100 units/명 + channels.list 1 = 101.
  - 250명 신규 매핑 시도 시 ~25,250 units 필요 → 매번 quota 초과 → 매핑 영구 실패.
  - 50 × 101 = 5,050 units (다른 호출 여유 ~50% 확보). 5일에 250명 자동 완결.
- 대안:
  - quota 분리 GCP 프로젝트 추가: 운영 복잡도 ↑, tubewatch.kr 와 분리되어야 함 (CLAUDE.md §7).
  - 매핑 시점만 별도 manual run: 운영 부담 ↑.

## 2026-05-15 KpopStats 아티스트 노출 구조 (Top 20 → More Artists → 전체 목록)

- 결정 내용:
  - `/kpop` 페이지: Top 20 차트 + 검색 (DB 기반) + "More Artists" 섹션 (listeners 순 20명, chart 중복 제외).
  - **신규 페이지** `/kpop/artists`: 전체 카드 그리드 (30/page), Type 필터 (All/Group/Solo), Sort (Listeners/Name), 페이지네이션.
  - YouTube 채널 NULL 아티스트는 Last.fm 데이터만 표시, YouTube 영역은 "Coming soon".
  - `/api/kpop/artists` 재작성 — `q`/`type`/`sort`/`page`/`pageSize`. 응답 `{ items, total, page, pageSize }`.
  - CLAUDE.md §6 에 "KpopStats 아티스트 노출 원칙" 명문화.
- 이유:
  - 시드 25 → 280명 확장 후 Top 20 차트만으론 95% 아티스트가 검색·탐색 불가.
  - Top 20 는 weekly_views 정렬 (실시간 인기), "More Artists" 는 listeners 정렬 (누적 영향력) — 다른 가치 표시.
  - YouTube 매핑 5일 자동 분할 중이라 NULL 아티스트가 다수 — "Coming soon" 로 graceful degradation.
- 대안:
  - 차트 limit 만 20 → 100 으로 확장: 차트의 의미 (Top N "랭킹") 희석.
  - 검색만 추가, 전체 목록 페이지 생략: 탐색 UX 부족 (어떤 아티스트가 있는지 알 길 없음).

## 2026-05-14 Eventbrite + Bandsintown 인제스트 자동화 폐기

- 결정 내용:
  - SERVICE_ARCHITECTURE.md v1.2 의 "Eventbrite 1차 필터링 + Claude AI 2차 검증 + Uncertain → 어드민" 자동 파이프라인 **폐기**.
  - Bandsintown 대체 검토 결과도 **폐기**.
  - 글로벌 K-pop 콘서트는 **Ticketmaster Discovery API** (구현 완료) 단일 소스로 충분.
  - 팬 커뮤니티 이벤트는 **fan_event_requests 사용자 제보 채널 강화** 로 대체 (0005 마이그레이션 + 어드민 승인 워크플로우는 기존 구축).
  - Eventbrite 5단계 필터링에서 계획됐던 **Claude Haiku Yes/No/Uncertain 로직은 fan_event_requests 어드민 검토 큐에 이식 검토** (별도 의사결정).
  - SERVICE_ARCHITECTURE.md 의 Eventbrite 관련 4개 섹션 (주요국 API 표 / 결론 블록 / 1-4 섹션 / 저작권·비용 표) 동시 갱신.
- 이유:
  - **Eventbrite**: `/v3/events/search/` 엔드포인트 deprecated. 외부 organization 이벤트 검색 불가. Partner Program (B2B 계약) 만 가능 — 수개월 소요, SaaS 초기에 비현실적. WebSearch / Eventbrite Developers Community 확인 (2026-05-14).
  - **Bandsintown**: 공식 help 문서에 "API key per single artist", "broad sweeps over catalog 금지" 명시 — 우리 use case (top K-pop 일괄 쿼리) 와 직접 충돌. 키 차단 위험. K-pop·한국 시장 커버리지 자체도 미검증.
  - **자체 제보가 더 큐레이션 품질 우위**: 팬이 직접 검증한 제보는 자동 크롤보다 신뢰성·관련도 모두 우위. SERVICE_ARCHITECTURE 의 "Selected submissions receive a complimentary Hallyu Pass" 보상 구조와 자연 결합.
- 대안으로 고려했던 것:
  - Songkick API: 2023년 이후 사실상 제한, 신규 키 발급 불가.
  - SeatGeek API: 미국 중심, K-pop 글로벌 투어 커버리지 약함.
  - Eventbrite Partner Program 강행: 시간·비용 비현실적.
  - Bandsintown 정식 partnership: 동일 사유 + 한국 시장 커버 약함.

---

## 2026-05-10 푸터 결제·라이선스 표기 + 쿠키 동의 배너

- 결정 내용:
  - 푸터 좌측 소셜 아이콘 아래 2줄로 **"Payments processed by Lemon Squeezy."** + **"This product uses the TMDB API but is not endorsed or certified by TMDB."** 명시.
  - bottom line 에 **support@unfoldk.com** mailto 링크 추가 (© 행 동석).
  - Cookie Policy 링크 `/cookies` → `/cookie` 정정 + `app/cookie/page.tsx` 신규 (EN/KO 토글, 5섹션).
  - 쿠키 동의 배너 — IntersectionObserver 로 footer 진입 시 1회 노출. `localStorage.cookie_consent='accepted'` 박제 시 재방문 미노출.
- 이유:
  - **Lemon Squeezy MoR 표기**: 2026-05-08 결제 처리자 전환 결정의 약관·푸터 노출 의무 잔여분 마무리.
  - **TMDB attribution**: 무료 티어 약관상 모든 페이지 footer 에 명시 필수 (CLAUDE.md §9).
  - **support 이메일**: 사용자 문의 단일 진입점. 분산된 contact 폼 대신 단순 mailto.
  - **쿠키 배너**: GDPR / CCPA 대응 첫 단계. footer 진입 = 페이지 충분히 본 상태라 banner 가 콘텐츠 가리지 않음.
- 대안으로 고려했던 것:
  - 페이지 진입 즉시 banner 노출 — 콘텐츠 가림. 사용자 경험 저하.
  - "Manage" 클릭 시 implied consent — opt-out 정책. 현재는 implied (by continuing) 으로 해두고 법무 검토 후 opt-in 필요 시 본문 교체.

---

## 2026-05-10 plan_type ↔ subscription_status 자동 동기화 (RLS 통과 보장)

- 결정 내용:
  - **모든 plan_type write path 가 subscription_status 도 함께 set** 하도록 정합성 강제.
  - `app/api/admin/users/[id]/route.ts` PATCH:
    - plan_type='monthly'|'annual' → subscription_status='active'
    - plan_type='free' → subscription_status='canceled'
  - `app/api/auth/complete-signup/route.ts` ALLOWED_PLANS 를 `['free']` 로 좁힘. paid 플랜 활성화는 LMS webhook (order_created) 또는 쿠폰 (apply-coupon) 만 정당 경로.
- 이유:
  - 캘린더 RLS 정책 `events_select_premium_paid` 가 `(plan_type IN ('monthly','annual') AND subscription_status='active')` 를 둘 다 검증.
  - 어드민이 plan_type 만 변경하면 status 가 null/'pending'/'canceled' 인 broken row 생성 → 어드민 수동 부여 Pro 가 premium 이벤트를 못 봄 (실제 인시던트).
  - 동기화 로직을 한 곳(API write path)에 집중시켜 향후 같은 클래스 버그 재발 차단.
- 대안으로 고려했던 것:
  - SQL 데이터 백필만 — 임시방편. 다음에 또 발생.
  - RLS 정책 완화 — 보안 약화. cancelled 유저도 premium 보임.
  - DB 트리거로 강제 — 가능하지만 코드 레벨이 더 명시적·테스트 가능.

---

## 2026-05-10 Header 를 root layout 으로 단일 마운트 (아키텍처)

- 결정 내용:
  - **`<Header />` 를 12개 페이지 + hero-section.tsx 에서 모두 제거** 하고 `app/layout.tsx` 에 단일 마운트.
  - Header 내부에서 `usePathname` 로 가드 — `HIDE_HEADER_PREFIXES` (admin, login, signup, start, redeem, forgot-password, verify-email, payment) 매칭 시 `null` 반환.
  - pathname 변경 useEffect 로 모든 드롭다운 / 시트 / 모달 자동 close.
- 이유:
  - 페이지마다 Header 가 재마운트되며 useEffect 가 다시 돌아 인증 fetch 반복 + 프로필/로고 깜빡임 발생.
  - Next.js layout 은 navigation 시 unmount 안 되므로 instance 영속 → 인증 state 유지 → 깜빡임 0.
  - 페이지마다 `<Header />` 렌더 코드가 13곳 산재 → 1곳으로 통합되어 유지보수 비용 감소.
- 대안으로 고려했던 것:
  - placeholder 자리만 reserve (인증 슬롯 min-w-[100px]) — wobble 잡지만 instance 재마운트는 그대로. 깜빡임 잔존.
  - localStorage 인증 캐시 — 첫 로드 후 재마운트 시 옛 값 즉시 사용. instance 자체 영속화보단 약함.

---

## 2026-05-10 KdramaMatch 3-tier 노출 정책

- 결정 내용:
  - **Browse all (`/api/dramas`)**: plan 분기 완전 제거, 모든 유저(비로그인 포함) BROWSE_LIMIT=100 단일.
  - **Top picks (`/api/dramas/recommend`)**: anon 3 / free 5 / paid 30. Claude system prompt 캡 10→30 으로 확장 (max_tokens 1500→3000).
  - **Watchlist**: 로그인 필수, plan 무관 (Free 도 + 버튼 사용 가능).
  - 페이지에 Browse all 섹션 신설, "Recommended for You" → "Top picks for you" 라벨.
- 이유:
  - 이전 추천 라우트가 PAID_LIMIT=30 이었지만 Claude prompt 의 "up to 10" 캡과 코드 break 로 paid 도 10건만 보던 데드코드 버그.
  - "추천(curated)" 과 "카탈로그(browse)" 는 의미가 달라서 한 섹션에 섞으면 paid 가 만족 못함.
  - Browse 는 SQL 만, Top picks 는 Claude 호출 — 비용·UX 분리.
- 대안으로 고려했던 것:
  - Top picks 캡을 paid="무제한" 으로 — Claude 비용 통제 어려움. 후보 60개 한계도 있어 30으로 합리적 상한.
  - 라벨 그대로 유지 — 실제 동작이 "추천"과 "전체" 둘 다 섞이면 사용자 혼란.

---

## 2026-05-10 인플레이스 OAuth 진입점 일관성

- 결정 내용:
  - 모든 보호 진입점 클릭 시 페이지 이동 없이 **StartModal 인플레이스** 노출 통일:
    - Header Start / My Page (비로그인)
    - Hero CTA 버튼
    - Pricing Get started / Join now (비로그인) — 로그인은 `/mypage/subscription` 직행
    - Calendar My Fan Events 안내 링크 (비로그인)
    - Calendar Upcoming 카드 Add to GCal / Reminder 토글 (비로그인)
    - ReportButton (이전 결정)
  - 각 진입점은 `next=` 파라미터로 OAuth 완료 후 의도된 페이지로 직접 복귀.
- 이유:
  - 페이지 이동 → middleware redirect → / 튕김 → 다시 클릭의 다단계 흐름 제거.
  - 사용자 컨텍스트(스크롤 위치 / 선택 상태) 유지.
  - 단일 OAuth 패턴이라 유지보수 부담 감소.
- 대안으로 고려했던 것:
  - 진입점마다 다른 흐름 — 사용자 인지 부담↑. 일관성 없는 UX.
  - 헤더 Start 만 모달 / 나머지 페이지 이동 — 혼합. 권장 안함.

---

## 2026-05-10 ReportButton 비로그인 흐름 — StartModal 인플레이스 오픈 (페이지 이동 X)

- 결정 내용:
  - **비로그인 사용자가 ReportButton 클릭 시 페이지 이동 없이 같은 자리에서 StartModal 오픈**
  - 클릭 한 번에 OAuth 시작 — 이전엔 `router.push('/login?redirect=...')` → `/login` useEffect → `/?next=...` → Start 다시 클릭 → OAuth 의 4단계
  - **StartModal 외부 제어 모드 추가** — `open` / `onOpenChange` / `next` / `trigger` 모두 옵셔널 prop. ReportButton 같은 외부 컨텍스트에서 모달 제어 가능. next 우선순위: prop → URL `?next` 파라미터 (backward-compat 유지)
  - **ReportButton 내부 구조** — 자체 `startModalOpen` state + `pendingNext` state 로 클릭 시점 pathname 캡처. `<StartModal open={...} onOpenChange={...} next={pendingNext} />` 임베드
  - **향후 다른 서비스(KpopStats artist / KdramaMatch drama / HangeulGo phrase / KfoodKit recipe)에 ReportButton 적용 시 동일 패턴 적용**
- 이유:
  - **UX 차원의 해결책**: "비로그인 → 로그인 모달 → OAuth → 원래 페이지" 가 사용자 의도. 페이지 이동을 거치는 건 불필요한 우회.
  - **OAuth 후 복귀 보장**: pathname 을 모달 prop 으로 직접 전달 → URL 변경 없이도 callback 의 `?next` 정확히 도착
  - **StartModal 사용처 호환**: 기존 trigger 방식(header / hero / cta / hero-cta-buttons) 그대로 동작
  - **레슨**: 처음 보고된 증상("OAuth 후 / 로 튕긴다")을 OAuth 자체 문제로 깊이 파고든 끝에 정답에 도달. 향후 비슷한 증상 시 **"원하는 흐름이 뭐냐" 한 줄 확인 후 진단 시작** — UX 흐름 변경이 정답인 케이스가 코드 깊이 파고드는 것보다 흔함
- 대안으로 고려했던 것:
  - **`/login` 경유 유지 + redirect/next 파라미터 forward 강화** (커밋 `c0f4e19` `c1f48be` `d40ae32` 가 이 방향): 페이지 이동 두 번 + 클릭 두 번. 사용성 떨어지고 도메인·인코딩·쿠키 sync 등 변수 多
  - **ReportButton 자체 OAuth 트리거** (StartModal 안 거침): UI 일관성 깨짐 (로그인 모달 디자인은 한 곳)
  - **로그인 후 신고 이어가기** (modal 닫힌 후 자동 reopen): state 관리 복잡 + UX 직관성 떨어짐. OAuth 완료 후 `/calendar` 복귀하면 사용자가 다시 신고 버튼 클릭하면 됨 (한 번 더 클릭이지만 흐름 단순)

## 2026-05-10 OAuth callback redirect 패턴 — middleware 의 `redirectWithCookies` 동일 구조

- 결정 내용:
  - **`app/api/auth/callback/route.ts` 가 middleware 와 동일한 supabaseResponse 패턴 사용**
  - `let supabaseResponse = NextResponse.next({ request })` 객체 생성 → `setAll` 콜백이 이 응답에 직접 cookie(options 포함) 적재 → redirect 시 `redirectWithCookies(url, supabaseResponse)` 헬퍼로 쿠키 명시 복사
  - 모든 redirect 분기(success / error 4종 / new_user / existing_user) 에서 동일 헬퍼 사용
  - **신규 가입자 분기에서도 next 보존** — `/start?new=true&next=<원래경로>` 형태. `/start` 페이지가 가입 완료 시 `searchParams.get("next") || "/mypage"` 로 사용
  - **production callback origin 은 `https://www.unfoldk.com` 하드코딩** — `start-modal.tsx` 의 `handleGoogleStart` 에서 `hostname === "localhost" ? window.location.origin : "https://www.unfoldk.com"`
- 이유:
  - **`NextResponse.redirect` 단독 반환 시 쿠키 누락 가능성**: Next.js 15 Route Handler 에서 `cookies()` 의 `set` 호출이 redirect 응답에 자동 반영되지 않는 케이스 다수 보고. 결과: 다음 페이지에서 `getUser()` null → `/start` 가드(`useEffect → router.replace("/")`) 발동 → "/" 튕김
  - **middleware 패턴이 검증된 정답**: 이미 동작 중인 `redirectWithCookies` 와 같은 구조 적용 — 일관성 + 중복 제거
  - **www 하드코딩 이유**: apex(`unfoldk.com`) 진입 사용자가 OAuth 시작하면 callback URL 이 apex 로 생성됨. Vercel apex→www redirect 가 OAuth 완료 후 끼어들면 code 파라미터 손실 가능. 시작부터 www 로 통일해 도메인 경계 redirect 자체를 차단
  - **localhost 예외**: 로컬 개발 환경에선 `localhost:3000` 그대로 사용 (production www 로 보내면 로컬 callback 깨짐). preview 배포(`*.vercel.app`)는 현재 OAuth 동작 안 하므로 제외 — 필요 시 `vercel.app` 분기 추가
- 대안으로 고려했던 것:
  - **`cookies()` API 만 사용** (NextResponse 없이): Next.js 15 의 자동 반영에 의존. 불안정 — 실제로 / 튕김 증상의 원인이었음
  - **callback 에서 cookie 수동 set** (Set-Cookie 헤더 직접 작성): Supabase auth 쿠키는 여러 개(access/refresh) + 옵션(httpOnly/secure/sameSite) 다양 → 직접 작성은 위험
  - **Vercel apex→www redirect 비활성화**: SEO 카노니컬 손실. 301 유지가 표준
  - **모든 진입점에서 origin 하드코딩** (header / hero / cta 등): 사용처 多 → 누락 위험. callback URL 생성 한 곳(`start-modal.tsx`) 만 하드코딩으로 충분

## 2026-05-09 콘텐츠 신고 시스템 (M+0 보완책) — `content_reports` 테이블 + 공통 컴포넌트

- 결정 내용:
  - **migration 0015** — 단일 `content_reports` 테이블로 5개 서비스 신고 통합
    - `content_type` enum 으로 event/artist/drama/phrase/recipe 구분
    - `content_id` UUID — 각 서비스 테이블 PK 참조 (FK 제약 없음 — 다형 관계)
    - `reason` enum 5종 + `note` 텍스트 (기타 사유 자유 기입)
    - `status` enum: pending → reviewed/dismissed
    - `reviewed_at`, `reviewed_by` 로 어드민 처리 기록
  - **공통 컴포넌트 `ReportButton`** — `components/common/report-button.tsx`
    - 모든 서비스 페이지에서 `<ReportButton contentType="..." contentId="..." />` 한 줄로 부착
    - 비로그인 → `/login?redirect=...` 유도, 로그인 → Dialog 모달
    - Dialog 디자인은 events-manager 패턴 동일 (UI 일관성)
  - **API 분리**:
    - `/api/reports` POST — 일반 유저용, RLS 가 본인 user_id 강제
    - `/api/admin/reports/[id]` PATCH — 관리자 전용, `requireAdmin` + status/reviewed_at/reviewed_by 갱신
  - **HallyuCalendar 이벤트부터 우선 적용** — EventDetailModal 하단에만 버튼. 다른 서비스는 점진 확대.
  - **어드민 처리 워크플로**: 신고 받음 → 어드민이 콘텐츠 페이지(/admin/events 등) 이동 (테이블의 ExternalLink 링크) → 콘텐츠 수정/삭제 → reports 테이블에서 "처리 완료" 클릭. 이 흐름은 수동 — 자동 연결은 향후 작업.
- 이유:
  - **단일 테이블 + content_type discriminator vs 서비스별 분리**: 5개 서비스 모두 같은 워크플로(신고 → 어드민 처리). 분리 시 어드민 페이지 5개 + API 5개로 코드 폭발. 단일 테이블 + 다형 관계가 운영 단순.
  - **FK 제약 없음**: content_id 가 events / artists / dramas / phrases / recipes 5개 테이블 中 어디든 가리킴. PostgreSQL 단일 FK 로 다형 관계 표현 불가 → 무결성 검증은 application 레이어. 콘텐츠 삭제 시 신고도 자동 삭제되지 않음 (어드민이 처리 완료 후 데이터 보존 — 감사 로그 가치).
  - **자동 인제스트 한계의 보완**: 직전 ingest-all 진단에서 HUNTR/X 오매핑·ENHYPEN 옛날 vlive 케이스 발견. 자동 검증으로 못 막는 케이스를 유저 신고 + 어드민 수동 처리로 보완 (DECISIONS A안 결정의 직접 후속).
  - **HallyuCalendar 우선**: M+0 에 가장 많은 데이터 + 자동 인제스트 신뢰도 가장 약함. 다른 서비스(M+1~4) 는 데이터 적거나 미구현이라 우선순위 낮음.
- 대안으로 고려했던 것:
  - **서비스별 신고 테이블 분리** (`event_reports`, `artist_reports`, ...): 타입 안전 ↑ 이지만 어드민 UI 5개 + API 5개. 운영 부담 > 타입 가치.
  - **`content_id` 를 text 로** (다양한 PK 타입 지원): 우리는 모든 서비스가 UUID PK 라 uuid 로 강제 — 타입 안전 우위.
  - **신고 후 자동 콘텐츠 비활성화** (예: 3건 이상 신고 → is_active=false): 악의적 신고 봇 위험. 어드민 검토 후 수동 처리가 안전.
  - **익명 신고 허용**: 스팸 폭증 위험. 로그인 강제 + RLS 로 본인 신고만 select 함.

## 2026-05-09 YouTube ingest — 영상 description 저장 금지, Claude 자동 생성으로만

- 결정 내용:
  - `lib/ingest/youtube.ts` 가 YouTube `snippet.description` 을 DB 에 저장하지 않음
  - `description` 컬럼은 **`generateEventDescription` (Claude Haiku) 결과로만** 채움
  - Claude 실패 시 `null` 저장 (이전: YouTube 영상 description 으로 fallback) → 어드민 수정 또는 다음 cron 재시도 시 보강
  - 기존 source_api='youtube' 10건 일괄 삭제 (오매핑·옛날·M/V 아닌 영상 mix)
- 이유:
  - **YouTube 영상 description 의 신뢰도 낮음**: 채널 운영자가 마케팅 카피로 자유롭게 작성. 앨범명·발매일·장소·가격·티켓 링크 등 검증 안 된 구체 정보 흔히 포함. 우리 캘린더에 그대로 노출하면 사실 미검증 정보가 사용자에게 전달.
  - **`generateEventDescription` 의 인제스트(rich) 모드는 source title 이 검증된 외부 API 영상 메타데이터** 를 입력으로 한다는 가정. 영상 description 자체가 검증 안 됐는데 이걸 fallback 으로 쓰면 신뢰도 일관성 깨짐.
  - **fallback null 의 운영 영향**: 캘린더 모달에서 description 이 없으면 표시 자체 안 함 (`{event.description && (...)}`) — 사용자가 잘못된 정보 보는 것보다 정보 없는 게 안전.
  - **기존 데이터 일괄 삭제**: 이전 ingest 결과 10건은 query 정교화 전 또는 미래 검증 도입 전에 통과한 옛날·오매핑 영상이라 운영 가치 부정. cron 다음 실행에서 정상 데이터로 자연 재축적.
- 대안으로 고려했던 것:
  - **YouTube description 의 첫 문장만 잘라 저장**: 첫 문장도 마케팅 카피일 가능성 높음. 일관 신뢰도 확보 못 함.
  - **YouTube description 을 별도 컬럼(`raw_yt_description`)에 보관**: 데이터 보존은 되지만 사용처 없음 + 노출 위험 잔존. 그냥 fetch 안 하는 게 깔끔.
  - **삭제 대신 description 만 NULL 처리**: 이벤트 자체가 옛날·오매핑이라 description 만 비워도 사용자에게 잘못된 이벤트 노출. 일괄 삭제가 정직.

## 2026-05-09 React #418 hydration fix — `toLocaleDateString` 에 `timeZone` 명시 의무화

- 결정 내용:
  - client component 안에서 `new Date(...).toLocaleDateString(...)` 또는 `toLocaleString(...)` 호출 시 **반드시 `timeZone` 옵션 명시**.
  - 적용 기준값: **`Asia/Seoul`** (UnfoldK 운영팀이 한국 기반, 어드민 표 일관성 우선).
  - 적용 완료: `components/admin/events-manager.tsx`, `components/admin/users-table.tsx`.
  - 미적용 (영향 없음으로 판정): `kpop-artists-manager.tsx::fmt` 의 `n.toLocaleString()` — 도달 숫자 < 1000 이라 천 단위 구분자 무관.
  - 미적용 (이번 범위 밖, 별도 처리 권장): `app/calendar/page.tsx` 의 `viewDate.toLocaleString` 및 `useState(() => new Date(...))` initializer.
- 이유:
  - **React #418 의 본질**: client component 는 SSR + hydrate 두 단계 모두 렌더링됨. `new Date(...).toLocaleDateString()` 처럼 timezone·locale 의존 함수가 두 환경 (Vercel UTC vs 브라우저 KST) 에서 결과 다르면 hydration mismatch.
  - **자정 근처 케이스가 결정타**: `event_date = "2026-05-09T15:30:00Z"` 같은 UTC 시각은 서버(UTC)에서 5월 9일, 클라이언트(KST)에서 5월 10일 → 일자 자체가 다름.
  - **해결 옵션 비교**:
    - `timeZone: "Asia/Seoul"` 명시 (채택) — 서버·클라이언트 모두 같은 TZ 강제, 형식 유지
    - `event_date.slice(0, 10)` — locale-free, 100% 안전하지만 한국어 "YYYY. M. D." 형식 사라짐 (어드민 가독성 약간 손실)
    - `suppressHydrationWarning` — silent, 진짜 mismatch 가려질 위험
    - client-only 렌더 (`useEffect` mounted gate) — UX 깜빡임
  - **운영 timezone 으로 KST 채택**: 영어권+동남아 글로벌 서비스지만 어드민 운영자가 한국팀. 어드민 표 형식은 한국 기준이 자연. 추후 타국 admin 합류 시 사용자별 timezone preference 고민 가능.
- 대안으로 고려했던 것:
  - **모든 곳 `slice(0, 10)` 으로 단순 ISO 문자열 표시**: 100% 안전이지만 어드민 표 시각적 형식 변경 + 디자인 결정 자체 별도 작업.
  - **모든 client component 에 timeZone 강제 lint rule**: 더 견고하지만 ESLint 룰 작성·관리 비용. 팀 규모가 1명 → 메모리·DECISIONS 박제로 충분.
  - **server component 로 컴포넌트 분리**: events-manager 의 표 부분만 server 컴포넌트로 분리하면 hydration 자체가 발생 안 함. 단 폼·다이얼로그 분리해야 해 리팩터 부담 큼.

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

