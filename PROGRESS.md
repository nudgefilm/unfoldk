# PROGRESS.md — 세션 진행 상태

> 매 세션 시작 시 이 파일을 먼저 읽고, 종료 시 업데이트합니다.

---

## 현재 상태 (2026-05-23 세션 22 / Pro 킬러 기능 5종 완료 + 메인페이지 개선 + 주간 리포트)

### 완료

#### A. 푸터 stat 수정
- callback/route.ts — 로그인 시 x-vercel-ip-country로 country=NULL 유저 자동 업데이트
- /api/stats 캐시 86400 → 3600
- 국기 이모지 Twemoji CDN 교체 (Windows/Android 크로스 플랫폼)
- 국기 마퀴 중복 제거 — 국가 1개일 때 정적 표시

#### B. Pro 킬러 기능 5종 완료 (PRO_ROADMAP.md 전체 ✅)
- ① 개인화 알림 — lib/email/send-reminders.ts 분리 + checkIsPro + 캘린더 토글 잠금 UI
- ② HangeulGo 무제한 — Free 하루 1개 게이팅 + 드라마 팩 잠금 오버레이
- ③ 여행 코스 저장·공유 — 저장/공유/PDF Pro 게이팅
- ④ K-Drama 맞춤 추천 — buildPersonalizedPrompt + usePersonalized 분기
- ⑤ 주간 한류 리포트 — weekly_reports 테이블 + Claude Haiku 7섹션 + /mypage/reports
  결제 연동 전 전체 주석 처리, 게이팅 코드만 완료.

#### C. 메인페이지 개선
- 후기 섹션 → Early Access 배너 교체 (FAQ 위 배치, 로그인 유저 /calendar 이동)
- 서비스 카드 6개 설명 카피 교체
- 가격 섹션 Free/Pro 혜택 리스트 실제 정책 기준으로 정비
- FAQ 한류 팬 맞춤 질문으로 교체

#### D. 블로그 토픽 중복 방지
- 최근 5개 포스트 topicId 수집 → Claude 제외 지시 → fallback 선택
- 신규 포스트부터 frontmatter에 topicId 기록

#### E. 주간 리포트 운영 이슈
- GRANT 누락 → weekly_reports TO anon/authenticated 직접 실행
- /mypage/page.tsx 자체 sidebarLinks에 Weekly Reports 추가
- 사이드바 메뉴 순서 조정

#### F. 캘린더 권역 탭 확장
- All / Americas / Europe / Asia / Oceania / Middle East / Online
- venue_country_code 기준 각 권역 국가코드 매핑

#### G. 기타
- /korean 메타 description 수정 (app/korean/layout.tsx 신규)
- Google 색인 5개 페이지 확인 ✅

### 다음 세션 후보
- 결제 연동 (LMS 심사 결과 대기)
- filming_spots backfill 잔여 39건 자동 처리 확인 (매일 KST 13:30 cron)
- Google 색인 추가 페이지 모니터링

### 블로커
- LMS 재심사 대기
- top.gg 심사 대기
- Google 색인 생성 대기
