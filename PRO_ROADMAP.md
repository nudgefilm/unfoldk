# PRO_ROADMAP.md — Pro 킬러 기능 로드맵

> 세션 21 (2026-05-23) 확정. 순차 적용 예정.
> 결제 연동 완료 전 기능 먼저 구현 → 결제 가동 시 Pro 게이팅 한 번에 활성화.

---

## ① 개인화 알림 Pro 게이팅 (예상 1~2시간)

- [ ] 내가 구독한 아티스트 컴백 D-7 / D-1 / 당일 이메일 알림
- [ ] HallyuCalendar 구독 기능은 유지, **알림 발송은 Pro 전용**으로 강화
- [ ] 비Pro 유저 알림 클릭 시 "Coming with Hallyu Pass" 안내
- **가치 제안**: "내 아티스트 소식을 절대 놓치지 않는다"
- **관련 파일**: `lib/email/send-reminders.ts`, `app/api/cron/send-reminders/route.ts`

## ② HangeulGo 무제한 (예상 2~3시간)

- [ ] Free: 하루 표현 1개 (rate-limit 서버 구현)
- [ ] Pro: 드라마 팩 무제한 + 복습 기능 + 진도 리포트
- [ ] 진도 리포트: 누적 학습 표현 수 / 스트릭 / 레벨
- **가치 제안**: 학습 서비스 검증된 Pro 전환 모델 (streak 락인)
- **관련 파일**: `app/korean/page.tsx`, `app/api/korean/phrase-of-day/route.ts`

## ③ 여행 코스 저장·공유 (예상 2~3시간)

- [ ] Free: AI 코스 조회만 가능
- [ ] Pro: 코스 저장 (DB 영속화) + 공유 링크 생성 + PDF 다운로드
- [ ] 공유 URL: `/curation-k/course/{id}` (비로그인 조회 가능)
- **가치 제안**: K-Travel Planner 인프라 (travel_courses 테이블) 그대로 활용
- **관련 파일**: `app/api/curation-k/travel-course/`, `app/curation-k/page.tsx`

## ④ K-Drama 맞춤 추천 (예상 4~6시간)

- [ ] 시청 기록 기반 Claude 개인화 추천 프롬프트 구축
- [ ] Free: 장르/키워드 기반 일반 추천 (현재 동작)
- [ ] Pro: 시청 목록 + 평점 분석 → 취향 프로파일 → 맞춤 추천
- [ ] 추천 결과에 "왜 이 드라마를 추천하는지" 개인화 이유 노출
- **가치 제안**: 데이터가 쌓일수록 추천이 정확해지는 락인 효과
- **관련 파일**: `lib/claude/recommend-dramas.ts`, `app/api/dramas/recommend/route.ts`

## ⑤ 월간 한류 리포트 (예상 4~6시간)

- [ ] 매월 1일 자동 생성: "이달의 K-culture 트렌드" 리포트
- [ ] 포함 항목: KpopStats 차트 변화 / 컴백 정리 / K-Drama 순위 / 인기 레시피
- [ ] Claude Haiku 자동 생성 → `monthly_reports` 테이블 캐싱
- [ ] Pro 전용 이메일 발송 + `/mypage` 내 리포트 아카이브 열람
- **가치 제안**: "Pro 회원만 받는 큐레이션 뉴스레터" 지속 가치
- **관련 파일**: 신규 (`app/api/cron/monthly-report/route.ts`)

---

## 완료 현황

| 기능 | 상태 | 완료일 |
|------|------|--------|
| ① 개인화 알림 Pro 게이팅 | ⬜ 미시작 | — |
| ② HangeulGo 무제한 | ⬜ 미시작 | — |
| ③ 여행 코스 저장·공유 | ⬜ 미시작 | — |
| ④ K-Drama 맞춤 추천 | ⬜ 미시작 | — |
| ⑤ 월간 한류 리포트 | ⬜ 미시작 | — |

> 완료 시 위 표와 각 항목 체크박스를 함께 업데이트.
