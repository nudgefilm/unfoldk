# UnfoldK Beauty — DB 수집 파이프라인 v2
> 법적 준수: LEGAL_COMPLIANCE.md 참조 필수
> 최종 업데이트: 2026.06.08

---

## 실행 순서

1. 식약처 API → 공급사 전수 적재
2. Claude Haiku 영문 전처리 스크립트 실행
3. ImportGenius 6월 CSV 다운로드 (기한 엄수)
4. EchoTik Export + Store Leads 샘플 적재
5. Apollo.io 전체 이메일 매핑
6. Resend 템플릿 완성 + 발송 자동화

---

## ① 공급사 파이프라인

### Step 1 — 식약처 오픈 API
- 화장품 책임판매업체 전수 조회 (data.go.kr)
- 출력: 한글 업체명, 한국어 주소, 사업자번호
- Supabase 임시 테이블: beauty_suppliers_staging 적재

### Step 2 — Claude Haiku 영문 전처리 (필수)
- 한글 업체명 → 영문 법인명 변환
  예) 주식회사 주노뷰티 → JUNO BEAUTY Co., Ltd.
- 한국어 주소 → 영문 도로명 주소 변환
  예) 서울시 강남구 → Gangnam-gu, Seoul, Republic of Korea
- 벌크 처리 (Haiku 모델, 비용 최소화 ~$5/월)
- 변환 결과 beauty_suppliers_staging 업데이트
- 주의: 단독 한글 입력 시 Apollo 매핑 성공률 5% 미만 → 전처리 필수

### Step 3 — Apollo.io 이메일 매핑
- 입력: 영문 법인명 + 영문 주소
- 예상 성공률: 30~40%
- 출력: 담당자 이메일, 직함, LinkedIn URL

### Step 4 — beauty_suppliers INSERT
- source: 'mfds_api'
- status: 'pre_registered'

### Step 5 — Resend 초대 이메일
- 제목: (광고) UnfoldK Beauty — 해외 바이어와 연결하세요
- 본문 하단: 글로벌 B2B 디렉토리 연동 기반 발송 안내
- Unsubscribe 링크 필수 → status: 'unsubscribed' 자동 변환

---

## ② 바이어 파이프라인

### Step 1 — ImportGenius CSV (6월 내 필수)
- HS코드 3304·3305·3307 필터
- 추출 필드: Consignee명, 미국 Zip Code 5자리, 수입량
- Supabase 임시 테이블 적재

### Step 2 — Apollo.io 복합 쿼리 매핑
- 입력: company_name + zip_code (복합 쿼리 필수)
- 단독 company_name 쿼리 금지 (동명이인 오매핑 위험)
- 예상 성공률: 90%+ (zip_code 복합 쿼리 시)
- 출력: 담당자 이메일, 직함

### Step 3 — 중복·바운스 필터링
- 이미 가입된 이메일 제외
- bounce_count 3회 초과 제외
- status = 'unsubscribed' 제외

### Step 4 — beauty_buyers INSERT
- source: 'importgenius'
- stage1_approved: false

### Step 5 — Resend 초대 이메일
- 제목: [B2B Sourcing Invitation] Verified K-beauty suppliers await
- 본문 하단: 글로벌 B2B 디렉토리 연동 기반 발송 안내
- Unsubscribe 링크 필수 → status: 'unsubscribed' 자동 변환

---

## ③ 셀러 파이프라인

### TikTok Shop
- Step 1: EchoTik Basic ($10/월) — K-뷰티 카테고리 상위 셀러 Export
  추출 필드: 스토어명, URL, GMV, 카테고리
- Step 2: Apollo.io — 스토어명 → 법인명 → 이메일 매핑
- Step 3: beauty_sellers INSERT
  seller_type: 'tiktok_shop_seller' / source: 'echotik'
- Step 4: Resend 초대 이메일

### Shopify
- Step 1: Store Leads 무료 샘플 CSV — K-뷰티 키워드 Shopify 스토어 목록
- Step 2: Apollo.io 매핑
- Step 3: beauty_sellers INSERT
  seller_type: 'shopify_independent_store' / source: 'store_leads'
- Step 4: Resend 초대 이메일

### Amazon (8월~)
- Step 1: Rainforest API ($50/월) — K-뷰티 ASIN → 셀러 법인명·주소 추출
- Step 2: Apollo.io 매핑
- Step 3: beauty_sellers INSERT
  seller_type: 'amazon_seller' / source: 'amazon_b2b_directory'
- Step 4: Resend 초대 이메일

---

## ④ 공통 Resend 발송 규격 (LEGAL_COMPLIANCE.md §3 준수)

1. 제목: (광고) 또는 [B2B Sourcing Invitation] 명시
2. 본문 하단 출처 문구 필수:
   "본 메일은 글로벌 B2B 디렉토리 연동 기반으로 발송되었습니다."
3. Unsubscribe 링크 → 클릭 시 status: 'unsubscribed' 자동 변환
4. unsubscribed 영구 발송 제외
5. bounce_count 3회 초과 자동 제외

---

## ⑤ 비용 확정

| 시기 | 항목 | 월 비용 |
|------|------|---------|
| 즉시 | ImportGenius | $229 |
| 즉시 | Apollo.io | $49 |
| 즉시 | EchoTik Basic | $10 |
| 즉시 | Claude Haiku (영문 변환) | ~$5 |
| 6~7월 합계 | | $293 |
| 8월~ | Apollo + Rainforest + EchoTik | $109 |

---

## ⑥ 구현 파일 목록 (예정)

- app/api/kbeauty/pipeline/mfds/route.ts — 식약처 API 조회
- app/api/kbeauty/pipeline/translate/route.ts — Claude Haiku 영문 변환
- app/api/kbeauty/pipeline/apollo/route.ts — Apollo.io 매핑
- app/api/kbeauty/pipeline/email/route.ts — Resend 발송
- supabase/migrations/XXXX_beauty_suppliers_staging.sql — 스테이징 테이블
