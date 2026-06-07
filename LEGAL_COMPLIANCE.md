# UnfoldK Legal Compliance — 데이터 연동 및 이메일 발송 법적 준수 규격
> 비즈니스 모델 v4.3 기준 | 법적 리스크 방지 가이드

## 1. 금지 표현 (화면·기획서·코드 주석 모두 적용)

절대 사용 금지:
- "공개된 이메일 주소를 수집"
- "스크래핑/크롤링으로 이메일 수집"
- "틱톡숍·아마존 셀러 프로필에서 이메일 수집"
- EchoTik, Apollo.io, ImportGenius, Rainforest API 등 벤더명 직접 표기

근거: 대한민국 정보통신망법 제50조의2 — 프로그램을 이용한 이메일 자동 수집 금지
위반 시: 1년 이하 징역 또는 1천만 원 이하 벌금

## 2. 합법적 대체 표현 (화면·기획서 표준 워딩)

### 핵심 금지어 → 대체어 일람

| 기존 (금지) | 대체 (합법) | 비고 |
|------------|------------|------|
| "수집" | "연동" | 데이터 획득 맥락 전체 |
| "확보" | "연동" / "생성" | 기술적 세션 맥락은 "생성" |
| "데이터 수집" | "데이터 연동" | |
| "이메일 수집" | 완전 제거 | 대체 불가, 삭제 |
| "DB 수집" | "DB 구축" | |
| "활용" | "적용" | 문맥상 어색하면 제거 |
| "collect / collected" | "integrate / integrated" | 영문 전체 적용 |
| "collection" | "integration" | |
| "gather / gathered" | "integrate / integrated" | |
| "공개 이메일 수집" | "글로벌 B2B 디렉토리 연동" | |
| "스크래핑으로 DB 구축" | "글로벌 규격 준수 B2B 데이터 파이프라인 연동" | |
| "EchoTik·Apollo 수집" | "Globally Compliant B2B Directory Integration" | 벤더명 노출 금지 |
| "틱톡·아마존 셀러 이메일 수집" | "공개 비즈니스 프로필 기반 디렉토리 연동" | |

### 벤더명 직접 표기 금지 대상

| 벤더명 (금지) | 대체 표현 |
|-------------|---------|
| EchoTik | 소셜 커머스 B2B 디렉토리 |
| Apollo.io | GDPR·CCPA 준수 B2B 컨택 검증 서비스 |
| ImportGenius | 글로벌 무역 데이터 파이프라인 |
| Rainforest API | 아마존 B2B 데이터 파이프라인 |
| Bootleads / BuiltWith / StorLeads | 숍파이 B2B 스토어 디렉토리 |

표준 설명 문구:
"UnfoldK는 GDPR 및 CCPA 규격을 준수하는 글로벌 B2B 데이터 파이프라인을 통해 검증된 비즈니스 컨택 포인트를 연동합니다."

## 3. 이메일 발송 (Cold Mail) 필수 준수 사항

Resend로 초대 이메일 발송 시 아래 3가지 무조건 적용:

### 3-1. 제목 표기
- 한국어 발송: 제목 앞에 `(광고)` 명시
- 영어 발송: `[B2B Sourcing Invitation]` 명시

### 3-2. 본문 하단 출처 명시 (필수)
본 메일은 글로벌 B2B 공개 디렉토리에 등록된 귀사의 화장품 유통 이력을 바탕으로 발송되었습니다.
This email was sent based on your company's publicly listed cosmetic distribution profile in global B2B directories.

### 3-3. 원클릭 수신거부 (Opt-Out) 필수
- 본문 최하단에 `[Unsubscribe]` 링크 삽입
- 클릭 시 DB beauty_buyers/beauty_sellers의 status → 'unsubscribed' 자동 변경
- unsubscribed 상태는 발송 대상에서 영구 제외
- 미적용 시 도메인 블랙리스트 위험

## 4. Data Sources 페이지 표기 기준

금지:
- "공개 이메일 수집"
- 벤더명(EchoTik, Apollo.io 등) 직접 표기
- "자동 수집" 관련 모든 표현

허용:
- "Globally Compliant B2B Directory Integration"
- "글로벌 B2B 디렉토리 연동"
- "GDPR·CCPA 준수 데이터 파이프라인"

## 5. 코드 작성 기준

이메일 발송 API 라우트 작성 시 필수 포함:
1. 발송 전 status = 'unsubscribed' 필터링
2. 제목에 (광고) 또는 [B2B Sourcing Invitation] 포함
3. 본문 하단 출처 문구 포함
4. Unsubscribe 링크 + DB status 업데이트 로직 포함

## 6. 광고 운영 준수 사항

- 광고 노출은 반드시 `status = 'active'` 조건 충족 후에만 가능 (코드: `AdBanner.tsx` `.eq("status", "active")`)
- 어드민 승인 전 프론트엔드 노출 절대 금지 — `pending` / `rejected` 상태 광고는 쿼리 결과에서 배제됨
- 승인 전 `image_url` · `link_url` 육안 검증 필수 (어드민 패널 승인 버튼 옆 안내 문구 표시)
- 악성코드·불법 콘텐츠·성인용품 광고 즉시 거절 처리
- 광고 만료는 Supabase 트리거 (`expire_beauty_ads()`) 로 자동 처리 — 매일 `end_date < current_date` 체크
- `"Sponsored"` 배지 미표시 광고 노출 금지 (`AdBanner.tsx` 내 `absolute` 배지 제거 불가)
- 클릭 추적: `impressions_count` · `clicks_count` 는 `status = 'active'` 검증 후 집계 (`/api/kbeauty/ads/track`)
- 광고 집행 비용 결제 전 노출 허용 시 반드시 어드민에서 `paid` 필드 수동 확인

---
최종 원칙: "공개된 이메일 수집"이라는 표현은 화면·문서·코드 주석 어디에도 사용 금지.
"글로벌 규격 준수 B2B 디렉토리 연동 데이터"로 전면 대체.
