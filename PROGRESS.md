# PROGRESS.md — 현재 상태 스냅샷

> 세션별 전체 기록 → PROGRESS_2026_05.md

---

## 현재 상태 (2026-06-01 세션 37 기준)

### HallyuCalendar
- Fan Meet 탭 유저 등록 행사 연동 완료 (session 37, migration 0056)
  - fan_event_requests → hallyu_calendar_events 승인 시 자동 노출
  - 행사 카드 모달 Apply Info 버튼 (Register Now / Contact Organizer)
  - mypage/fan-events 폼·Edit 모달에 Apply Info 섹션 추가
- "이번 주 놓치면 안 될 한류 일정 TOP 3" 큐레이션 뷰
- 아티스트 KpopStats 상세 연결 링크

### KpopStats
- 메인 Top 20 전면 무료 개방 (비로그인 포함)
- 상세 페이지: Weekly Growth Report Pro 게이팅 / TrackArtist 버튼 Pro 잠금
- Last.fm 중심 재편 (YouTube UI 제거)
- Artist Comparison 개편 (충성도·모멘텀·Claude 인사이트·Profile 카드)
- MusicBrainz 동기화 191/280명

### HangeulGo
- Grammar Explanation 이미지 + scene_description 자동 생성 (migration 0055)
- 중급·고급 드라마 표현 배치 생성 스크립트
- 이미지 폴백: scene image → drama poster
- 동일 표현 중복 드라마 출처 표기
- 어드민 /admin/korean 이미지 업로드 UI

### Curation K
- Klook 제휴 배너 (K-Pop Sites / Filming Spots / Food Tours / Stays)
- 페이지 로드마다 랜덤 셔플·탭 시작

### 공통
- SEO: 8개 서비스 metadata + JSON-LD + sitemap 296페이지
- 서비스 간 4방향 크로스링크 전면 연결
- Hallyu Pass 가격 인하: $9/월 · $72/년

---

## 다음 할 일

- [ ] KpopStats Today's Trending Top 5 → Free 접근 / 나머지 상세 → Pro 잠금 (CLAUDE.md §6 KpopStats Free/Pro 스펙)
- [ ] KpopStats → HallyuCalendar 컴백 연결 (개선 플랜 §6)
- [ ] filming_spots 어드민 Phase 2
- [ ] Reddit 카르마 + 다음 포스팅
- [ ] Discord 마이크로 인플루언서 DM
- [ ] 결제 연동 (Lemon Squeezy 재심사 완료 후)

---

## 블로커

- Lemon Squeezy 재심사 이메일 발송 완료 → 결과 대기
- top.gg 심사 재제출 완료 → 대기
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
