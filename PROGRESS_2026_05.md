# PROGRESS_2026_05.md — 2026년 5월 세션 기록 (세션 23~30)

> PROGRESS.md 에서 분리 보관. 세션 31부터는 PROGRESS.md 참조.

---

## 세션 30 (2026-05-29)

- **My Activity 카드·하부 페이지 데이터 소스 통일**
  - `artistsTracking`: stats API kpop_artists 매칭 제거 → 구독 이벤트 distinct artist_or_drama 직접 집계
  - `eventsUpcoming`: notification_enabled=true + event_date >= now 필터 통일
  - My Events 페이지: "이번 달" → "미래 이벤트·알림 설정" 방식으로 변경
  - Upcoming Events 화살표 버튼: hover-only → 항상 표시

- **My Hallyu Course UI 개선**
  - Departing from 필드 제거, Arriving at → Destination 단일 입력
  - "Seoul → undefined" 버그 수정 (meta에 arrival_region 누락)
  - Saved Courses 6개 cap + 초과 시 가장 오래된 코스 자동 삭제

- **My Curation 사이드바 메뉴 + 페이지** (migration 0049 ✅)
  - `app/mypage/curation/page.tsx` 신규
  - `app/api/curation-k/collections/route.ts` GET/POST/DELETE

- **서비스별 저장 아이콘**
  - Curation K SpotCard / SpotDetailDialog 북마크
  - DramaCard 이미지 오버레이 북마크
  - HangeulGo Save phrase: status "learning" → "mastered"

---

## 세션 29 (2026-05-28)

- **빌링/취소 버튼 404 수정** → PaymentComingSoonModal 연결
- **"Start for free" 버튼 로그인 분기** (로그인→/mypage, 비로그인→StartModal)
- **계정 삭제 버튼** (AlertDialog + 자동 로그아웃)
- **푸터 Discord 단일 아이콘 교체** (X·Instagram·TikTok 제거)
- **agreed_to_terms 미완료 유저 /start 리디렉트** (middleware.ts)
- **KpopStats More Artists 섹션 개선** (카드 21개, "View all artists" 버튼)
- **KpopStats 30-Day Trend 차트 0값 gap 처리**
- **Discord Webhook 방식 전환** — Bot 토큰 403 우회 (4채널 posted ✅)
- **Discord 디버그 엔드포인트** (cron_logs 컬럼명 수정)

---

## 세션 28 (2026-05-27)

- **KfoodKit 어드민 레시피 목록 페이지네이션** (PAGE_SIZE=50)
- **KfoodKit 어드민 이미지 검수 페이지** + 사이드바 배지
- **KfoodKit Drama Food Guide 개선** (line-clamp-5, 이미지 정렬)
- **Curation K 쇼핑 탭 추가** (content_type_id=38)
- **KpopStats 순위 변동 인사이트 텍스트** (↑N 급상승/상승, ↓N 하락/급하락, NEW 배지)
- **KpopStats "이번 주 급상승 아티스트 TOP 3" 섹션**
- **HallyuCalendar "이번 주 놓치면 안 될 한류 일정 TOP 3" 섹션**

---

## 세션 27 (2026-05-26)

- **KfoodKit DramaFoodGuideSection** (Claude Haiku 배치 API 태깅)
- **Cron 개편 + 어드민 수집 현황 동적화** (migration 0047·0048 ✅)
- **결제 버튼 임시 안내 모달** (support@unfoldk.com 수동 멤버십)
- **KpopStats 30-Day Trend 차트 개선** (recharts 기반)
- **HallyuCalendar 아티스트 stats 연결** (kpop_artists 룩업 → /kpop/[id])

---

## 세션 26 (2026-05-25)

- **KpopStats 히어로 가림 수정** (py-12 → pt-28 pb-12)
- **KfoodKit 레시피 복사 버그 수정** (전체 포맷 복사)

---

## 세션 25 (2026-05-24) — Trial 14일 변경 + 이메일 중복 가입 방지

- migration 0043: `trial_used_emails` 테이블 (탈퇴 후 재가입 차단)
- Trial 기간 30일 → 14일, 3중 중복 검사 로직
- free 유저 trial_ends_at now()+14일 소급 ✅

---

## 세션 24 (2026-05-23) — Trial 시스템 전체 구현

- migration 0042: `users.trial_ends_at` + 이메일 플래그 4개
- Trial 이메일 4종 (시작/D-7/D-1/만료)
- Cron 2개 (trial-notifications, expire-trials)
- Trial 배너 컴포넌트
- 어드민 Trial 컬럼 추가

---

## 세션 23 (2026-05-22)

- Discord 봇 /quiz · /koreanname 슬래시 커맨드 추가
- 푸터 국기 중복 버그 수정
