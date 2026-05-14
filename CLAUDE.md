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
| 결제 | **Lemon Squeezy (MoR)** — TossPayments 영구 제외 |
| AI | Claude API Haiku 4.5 ($1/$5 per 1M, 배치 API) |
| TTS | ElevenLabs Creator ($22/월, HangeulGo 전용) |
| 이메일 | Resend (무료 3,000건/월) |

**UI**: shadcn/ui (`new-york` / `neutral`, RSC) — `@/components/ui/*` import. lucide-react / react-hook-form+zod / next-themes / recharts / sonner. 임의 작성 전 shadcn 표준 우선 확인.

**패키지**: pnpm 전용 (`pnpm-lock.yaml`). npm/yarn 금지. **alias** `@/*` → 레포 루트.

**명령어**: `pnpm dev|build|start|lint` (ESLint config 미설정).

**빌드 주의**: `next.config.mjs` 에 `ignoreBuildErrors: true`, `images.unoptimized: true` — 출시 전 strict 전환 필요.

---

## 3. 구독 플랜

```
Free          무료        제한적 기본 기능
Hallyu Pass   $15/월     5개 서비스 Pro 전체
Hallyu Pass   $120/년    Pro + 20% 할인 ($10/월)
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
```

---

## 7. 자주 하는 실수 (하지 말 것)

```
❌ YouTube API 를 tubewatch.kr 와 같은 GCP 프로젝트 → 쿼터 초과 시 양쪽 중단
❌ Spotify API → 2025.05 부터 법인 전용. Last.fm 대체
❌ TossPayments → 해외 유저 경험 불량. Lemon Squeezy 확정
❌ 서비스별 별도 users 테이블 → Hallyu Pass 통합 불가
❌ ElevenLabs TTS 실시간 호출 → 비용 폭증. 사전 생성 + CDN 캐싱 필수
❌ RLS 나중에 추가 → 전체 보안 재작업
❌ v0 UI 임의 수정 → 로직·API 연동만
❌ 아티스트 이미지 서버 직접 저장 → 저작권. URL 링크만
❌ 한 세션 여러 서비스 동시 개발 → 하나씩 완성 후 다음

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

❌ YouTube search.list 대량 호출 (신규 아티스트 N명 매핑) → 일일 quota 초과
   search.list = 100 units/명. 250명 = 25,000 units > 10,000 daily.
   lib/ingest/kpop-stats.ts MAX_CHANNEL_MAPPING_PER_RUN=50 cap 으로 분할 처리
   (5일 자동 완결). cap 변경 시 quota 영향 재계산 필수.

❌ Header / 공통 chrome 페이지마다 import → unmount/remount 반복 + 인증 fetch
   반복 + 깜빡임. root layout 단일 마운트 + usePathname 가드 (HIDE_HEADER_PREFIXES).
```

---

## 8. 세션 운영

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

## 9. 문제 해결 원칙

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

*UNFOLD LAB | unfoldk.com | 2026-05 | v3.3*
