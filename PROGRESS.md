# PROGRESS.md — 현재 상태 스냅샷

> 세션별 전체 기록 → PROGRESS_2026_05.md

---

## 현재 상태 (2026-06-01 세션 38 기준)

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

### 공통
- Free/Pro 확정 스펙 전 서비스 CLAUDE.md 기록
- Trial Banner: 비로그인 상태 노출 버그 수정 (isLoggedIn 명시적 상태 추가)
- 전 서비스 페이지 상단 여백 통일: pt-28 pb-12 (KpopStats 기준)

---

## 다음 할 일

- [ ] KpopStats Today's Trending Top 5 → Free / 나머지 상세 → Pro 잠금
- [ ] kpop_albums 초기 수집: `npx tsx scripts/sync-musicbrainz-releases.ts --dry-run` 확인 후 실행
- [ ] KpopStats → HallyuCalendar 컴백 연결
- [ ] filming_spots 어드민 Phase 2
- [ ] 결제 연동 (Lemon Squeezy 재심사 완료 후)

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
