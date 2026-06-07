# UnfoldK Beauty — 프로젝트 기준 파일 (KBEAUTY.md)
> Claude Code 참조용 | 최종 업데이트: 2026.06.06
> 기획안 v4.3 기반

---

## Claude Code에게 — 작업 전 반드시 숙지

**1. 기존 UnfoldK 파일 수정 금지**
- 모든 작업은 `app/kbeauty/` 폴더 안에서만
- 컴포넌트는 `app/kbeauty/_components/` 안에만 생성

**2. B2B 전용 — B2C 요소 만들지 않는다**
- 사용자: supplier / buyer / seller / admin 4가지
- 팬(fan) 계정 B2B 접근 시 차단

**3. 언어 정책 준수**
- 공급사 UI → 한국어만
- 바이어·셀러 UI → 영어만
- 랜딩만 섹션별 혼용

**4. 디자인 시스템 준수**
- Pretendard: 본문
- Cormorant Garamond: 대형 헤드라인 전용
- Navy #1A3A5C: 공급사 Primary
- Gold #C8A882: 바이어·셀러 Accent
- border-radius: 8px(버튼·인풋) / 12px(카드)

**5. 자의적 파일 생성 금지**
- 지시된 파일·범위만 작업
- 불명확한 부분은 반드시 질문

---

## 1. 서비스 구조

```
국내 공급사 ↔ 해외 바이어 (전통 무역)
국내 공급사 ↔ 해외 셀러 (디지털 유통)
```

---

## 2. 기술 스택

```
Frontend : Next.js 15 (App Router)
Styling  : Tailwind CSS + Pretendard + Cormorant Garamond
Backend  : Supabase
Auth     : Supabase Auth (기존 UnfoldK와 공유)
결제     : Lemon Squeezy (2차 개발)
AI       : Claude API Haiku (인사이트 문장 생성 전용)
배포     : Vercel
```

---

## 3. 플랜 구조

```
공급사
  Free: 탐색·등록·알림·매칭 요청 수신 무제한
  Pro:  매칭 승인 + 샘플 수락 + 컨택 정보 공개
        계약서 템플릿·물류 파트너·Trade Analytics·우선 노출

바이어
  플랜 구분 없음 (전면 무료)

셀러
  기본 접근 무료
  Sourcing Sniper: 월 $29 또는 건당 $49
```

---

## 4. 정보 공개 범위

```
공개 (누구나)
  회사명·카테고리·인증 배지
  MOQ·가격대·리드타임·샘플 조건
  거래 횟수·자동 평점

비공개 (매칭 승인 후)
  담당자 이름·이메일·전화번호
  웹사이트 URL
```

---

## 5. 접근 제어

```
전체 공개:
  kbeauty
  kbeauty/supplier
  kbeauty/buyer
  kbeauty/buyer/register
  kbeauty/seller
  kbeauty/seller/register
  kbeauty/auth
  kbeauty/login

인증 필요 (미들웨어):
  kbeauty/dashboard/supplier/* → beauty_suppliers 레코드 존재
  kbeauty/dashboard/buyer/*    → beauty_buyers 레코드 존재
  kbeauty/dashboard/seller/*   → beauty_sellers 레코드 존재
  kbeauty/admin                → is_admin RPC

role 불일치 시 kbeauty로 리다이렉트
```

---

## 6. 언어 정책

```
kbeauty (랜딩)               → 섹션별 한·영 혼용
kbeauty/supplier             → 한국어 전용
kbeauty/dashboard/supplier/* → 한국어 전용
kbeauty/buyer                → 영어 전용
kbeauty/buyer/register       → 영어 전용
kbeauty/dashboard/buyer/*    → 영어 전용
kbeauty/seller               → 영어 전용
kbeauty/seller/register      → 영어 전용
kbeauty/dashboard/seller/*   → 영어 전용
kbeauty/admin                → 한국어 전용
```

---

## 7. 디자인 시스템

```
Navy Primary   : #1A3A5C  ← 공급사 CTA·버튼·배지
Navy Hover     : #153249
Gold Accent    : #C8A882  ← 바이어·셀러 CTA·강조
Gold Text      : #8B6F47
Text Primary   : #0F0F0F
Text Secondary : #6B6B6B
Background     : #F8F7F5
Border         : #E8E2DA
White          : #FFFFFF

Display : Cormorant Garamond — 헤드라인 전용
Body    : Pretendard — 나머지 전체

border-radius : 8px (버튼·인풋) / 12px (카드)
box-shadow    : 0 2px 8px rgba(0,0,0,0.06)
transition    : 200ms
```

---

## 8. 폴더 구조

```
app/kbeauty/
  layout.tsx
  page.tsx                              ← P01 랜딩 ✅
  auth/
    page.tsx                            ← 공급사·바이어·셀러 선택 ✅
  login/
    page.tsx                            ← 통합 로그인 ✅
  supplier/
    page.tsx                            ← P02 공급사 신청 ✅
    login/
      page.tsx                          ← 공급사 로그인 ✅
  buyer/
    page.tsx                            ← P05 바이어 랜딩 ✅
    register/
      page.tsx                          ← P06 바이어 가입 ✅
    login/
      page.tsx                          ← 바이어 로그인 ✅
  seller/
    page.tsx                            ← 셀러 랜딩
    register/
      page.tsx                          ← 셀러 가입
    login/
      page.tsx                          ← 셀러 로그인
  dashboard/
    supplier/
      page.tsx                          ← P03 공급사 대시보드 ✅
      products/
        new/
          page.tsx                      ← P04 제품 등록
    buyer/
      page.tsx                          ← P07 바이어 대시보드
      suppliers/
        page.tsx                        ← P08 공급사 탐색
    seller/
      page.tsx                          ← 셀러 대시보드
  sourcing-sniper/
    page.tsx                            ← Sourcing Sniper
  admin/
    page.tsx                            ← P09 관리자 패널
  _components/
  
api/kbeauty/
  auth/
    signup/
      route.ts                          ← 이메일 인증 없는 가입 ✅
    callback/
      route.ts                          ← Google OAuth 콜백 ✅
  verify-business/
    route.ts                            ← 국세청 API 인증 ✅
  pipeline/
    amazon-seller/
      route.ts                          ← 아마존 셀러 연동 파이프라인
```

---

## 9. 페이지 목록

| # | 페이지 | 언어 | 접근 | 상태 |
|---|--------|------|------|------|
| P01 | B2B 랜딩 | 한·영 혼용 | 공개 | ✅ |
| P02 | 공급사 신청 | 한국어 | 공개 | ✅ |
| P03 | 공급사 대시보드 | 한국어 | supplier | ✅ |
| P04 | 제품 등록 | 한국어 | supplier | 대기 |
| P05 | 바이어 랜딩 | 영어 | 공개 | ✅ |
| P06 | 바이어 가입 | 영어 | 공개 | ✅ |
| P07 | 바이어 대시보드 | 영어 | buyer | 대기 |
| P08 | 공급사 탐색 | 영어 | buyer | 대기 |
| P09 | 관리자 패널 | 한국어 | admin | 대기 |
| - | 셀러 랜딩 | 영어 | 공개 | 대기 |
| - | 셀러 가입 | 영어 | 공개 | 대기 |
| - | 셀러 대시보드 | 영어 | seller | 대기 |
| - | Sourcing Sniper | 영어 | seller | 대기 |

---

## 10. Supabase 테이블명

| 기능 | 실제 테이블명 |
|------|--------------|
| 공급사 | beauty_suppliers |
| 바이어 | beauty_buyers |
| 셀러 | beauty_sellers |
| 제품 | beauty_products |
| 매칭 | beauty_matches |
| Trade Analytics | beauty_trade_analytics |
| Post-Matching | beauty_post_matching_services |

---

## 11. beauty_suppliers 핵심 필드

```sql
id UUID
user_id UUID REFERENCES auth.users(id)
company_name_ko TEXT
company_name_en TEXT
business_registration_number TEXT UNIQUE
business_registration_verified BOOLEAN DEFAULT false
cosmetic_license_type TEXT  -- manufacturer | responsible_seller
cosmetic_license_url TEXT
cosmetic_license_verified BOOLEAN DEFAULT false
buyer_db_access BOOLEAN DEFAULT false
contact_name TEXT
contact_email TEXT
contact_phone TEXT
categories TEXT[]
website TEXT
fda_status TEXT
fda_registration_number TEXT
iso_22716 BOOLEAN DEFAULT false
iso_22716_url TEXT
vegan_certified BOOLEAN DEFAULT false
vegan_cert_org TEXT
vegan_cert_url TEXT
cruelty_free_certified BOOLEAN DEFAULT false
cruelty_free_cert_org TEXT
cruelty_free_cert_url TEXT
export_experience TEXT
export_countries TEXT
status TEXT  -- pre_registered | active
source TEXT  -- direct_signup
created_at TIMESTAMPTZ
```

---

## 12. beauty_buyers 핵심 필드

```sql
id UUID
user_id UUID REFERENCES auth.users(id)
company_name TEXT
business_email TEXT
website TEXT
country TEXT
state TEXT
ein_number TEXT
business_type TEXT[]
categories TEXT[]
annual_import_volume TEXT
handling_korean_products TEXT
linkedin_url TEXT
known_suppliers TEXT
buyer_type TEXT DEFAULT 'traditional_importer'
  -- traditional_importer
marketplace_url TEXT
stage1_approved BOOLEAN DEFAULT true
status TEXT  -- pre_registered | invited | active | pending
source TEXT  -- direct_signup | importgenius
contact_verified BOOLEAN DEFAULT false
bounce_count INTEGER DEFAULT 0
created_at TIMESTAMPTZ
```

---

## 13. beauty_sellers 핵심 필드

```sql
id UUID
user_id UUID REFERENCES auth.users(id)
company_name TEXT NOT NULL
business_email TEXT
seller_type TEXT NOT NULL
  -- amazon_seller | shopify_independent_store | tiktok_shop_seller
marketplace_url TEXT
instagram_handle TEXT
linkedin_url TEXT
country TEXT
state TEXT
zip_code TEXT
categories TEXT[]
annual_sales_volume TEXT
contact_verified BOOLEAN DEFAULT false
bounce_count INTEGER DEFAULT 0
status TEXT DEFAULT 'active'
source TEXT DEFAULT 'direct_signup'
  -- direct_signup | amazon_b2b_directory | builtwith | fastmoss | storeleads
created_at TIMESTAMPTZ
```

---

## 14. beauty_products 핵심 필드

```sql
id UUID
supplier_id UUID REFERENCES beauty_suppliers(id)
product_name_ko TEXT
product_name_en TEXT
brand_name TEXT
category TEXT
certifications TEXT[]
fda_registration_number TEXT
moq INTEGER
price_range_min NUMERIC
price_range_max NUMERIC
lead_time_days INTEGER
export_countries TEXT[]
sample_price NUMERIC
sample_lead_time_days INTEGER
sample_max_quantity INTEGER
images JSONB
status TEXT DEFAULT 'active'
created_at TIMESTAMPTZ
```

---

## 15. beauty_matches 핵심 필드

```sql
id UUID
supplier_id UUID REFERENCES beauty_suppliers(id)
buyer_id UUID REFERENCES beauty_buyers(id)
seller_id UUID REFERENCES beauty_sellers(id)
product_id UUID REFERENCES beauty_products(id)
request_type TEXT  -- matching | sample
message TEXT
status TEXT  -- requested | approved | rejected | completed
requested_at TIMESTAMPTZ
approved_at TIMESTAMPTZ
```

---

## 16. 공급사 인증 (2단계)

```
1단계: 국세청 API 자동 검증 ✅
  app/api/kbeauty/verify-business/route.ts
  → 제품 등록·바이어 탐색 가능
  → 매칭 승인 불가

2단계: 화장품 등록필증 수동 승인
  → cosmetic_license_verified: true
  → buyer_db_access: true
  → Pro 전환 후 매칭 승인 가능
```

---

## 17. 가입 플로우

```
공급사:
  kbeauty/supplier → POST /api/kbeauty/auth/signup
  → admin.createUser (이메일 인증 없음)
  → signInWithPassword → 세션 생성
  → beauty_suppliers INSERT
  → kbeauty/dashboard/supplier

바이어:
  kbeauty/buyer/register → POST /api/kbeauty/auth/signup
  → admin.createUser (이메일 인증 없음)
  → signInWithPassword → 세션 생성
  → beauty_buyers INSERT
  → kbeauty/dashboard/buyer

셀러:
  kbeauty/seller/register → POST /api/kbeauty/auth/signup
  → admin.createUser (이메일 인증 없음)
  → signInWithPassword → 세션 생성
  → beauty_sellers INSERT
  → kbeauty/dashboard/seller
```

---

## 18. 로그인 플로우

```
kbeauty/login (통합 로그인)
  → 로그인 성공 후 자동 분기:
    beauty_suppliers 레코드 있음 → dashboard/supplier
    beauty_buyers 레코드 있음    → dashboard/buyer
    beauty_sellers 레코드 있음   → dashboard/seller
    둘 다 없음 → 안내 메시지 + 가입 버튼
```

---

## 19. 셀러 DB 파이프라인 (자동화)

**⚠️ 법적 준수 원칙**: LEGAL_COMPLIANCE.md 필수 숙지
- 화면·기획서 표기: "글로벌 B2B 디렉토리 연동"으로 통일
- 이메일 발송 시 LEGAL_COMPLIANCE.md §3 (제목 표기·출처 명시·수신거부) 필수 적용
- 코드 주석에서도 "공개 이메일 수집" 표현 사용 금지

```
아마존 셀러 (매핑 성공률 70%+)
  글로벌 B2B 데이터 파이프라인 → 법인명 + 우편번호 + 도시 추출
  GDPR·CCPA 준수 컨택 검증: company_name + zip_code + city
  → beauty_sellers (seller_type: amazon_seller)

숍파이 독립몰
  6~7월: 글로벌 B2B 디렉토리 무료 샘플 수동 Import
  8월~: 글로벌 규격 준수 B2B 데이터 파이프라인 자동화
  → beauty_sellers (seller_type: shopify_independent_store)

틱톡숍 셀러
  글로벌 B2B 디렉토리 연동 → K-뷰티 상위 셀러 비즈니스 컨택 포인트 연동
  컨택 정보 있는 경우만 초대 이메일 발송 (LEGAL_COMPLIANCE.md §3 준수)
  instagram_handle·linkedin_url DB 보관
  → beauty_sellers (seller_type: tiktok_shop_seller)

※ LinkedIn·Instagram DM 자동화: ToS 위반으로 보류
※ 수동 컨택: 전면 보류
```

---

## 20. 완료 현황

```
✅ P01·P02·P05·P06 페이지 배포
✅ 공급사·바이어 통합 로그인 (kbeauty/login)
✅ 공급사·바이어·셀러 선택 (kbeauty/auth)
✅ Supabase 테이블 마이그레이션
✅ 미들웨어 role 기반 접근 제어
✅ 국세청 API 공급사 1단계 인증
✅ 공급사·바이어 폼 저장 연동 (이메일 인증 없음)
✅ P03 공급사 대시보드 (북미 수출 준비 가이드 포함)
✅ RLS 정책 + GRANT 설정

□ P03 북미 수출 준비 가이드 저장 기능
□ P04 제품 등록
□ P07 바이어 대시보드
□ P08 공급사 탐색 + 매칭
□ P09 관리자 패널
□ 셀러 가입·로그인·대시보드
□ Sourcing Sniper
□ 알림 시스템
□ Pro 플랜 결제 (Lemon Squeezy)
□ beauty_sellers 테이블 마이그레이션
□ kbeauty/auth 3개 카드로 변경
□ 랜딩 3자 구조 개편
```

---

## 21. Claude Code 세션 시작

```
KBEAUTY.md 파일 읽고 UnfoldK Beauty B2B 프로젝트 기준 파악해줘.
작업 지시 전까지 대기.
```

---

---

## 22. 단계별 비용 명세

> 벤더명 직접 표기 금지 (LEGAL_COMPLIANCE.md §2 준수) — 내부 예산 논의 시도 준수 필요

### 1단계: 6~7월 MVP (최소 비용)

| 구분 | 솔루션 | 월 비용 |
|------|--------|---------|
| 바이어 DB 구축 | 글로벌 무역 데이터 파이프라인 | $229 |
| 컨택 검증 | GDPR·CCPA 준수 B2B 컨택 검증 서비스 | $49 |
| 숍파이 셀러 | 글로벌 스토어 B2B 디렉토리 샘플 | $0 |
| 틱톡숍 셀러 | 소셜 커머스 B2B 디렉토리 | $0 |
| 이메일 발송 | Resend 무료 (월 3,000건) | $0 |
| 호스팅/DB | Supabase + Vercel 무료 티어 | $0 |
| **합계** | | **$278** |

BEP 공식: Sourcing Sniper 구독자 10명 × $29 = $290 → 고정비 즉시 상쇄

### B2B 무역 데이터 전략 (6월 한정)
6월: $229 결제 → 최근 12개월 무역 데이터 전수 다운로드
7월: 구독 일시정지 → $229 절약
컨택 검증 서비스 $49만으로 매핑 작업 계속

### 2단계: 8월 이후 자동화 (지자체 수주 후)

| 구분 | 솔루션 | 월 비용 |
|------|--------|---------|
| 기존 유지 | 글로벌 무역 데이터 + 컨택 검증 | $278 |
| 아마존 B2B 연동 | 아마존 B2B 데이터 파이프라인 | $50 |
| 숍파이 자동화 | 숍파이 B2B 스토어 디렉토리 | $50 |
| 틱톡숍 확장 | 소셜 커머스 B2B 디렉토리 확장 | $30 |
| 이메일 확장 | Resend Pro | $20 |
| DB 업그레이드 | Supabase Pro | $25 |
| **합계** | | **$453** |

※ 연동 볼륨 최대 시 최대 $773까지 확장 가능

### 숨은 비용
Claude Haiku (Sourcing Sniper 인사이트)
월 $5~$10 수준 — 예산 영향 미미
결제 수수료 (Lemon Squeezy)
건당 5% + $0.50 — 매출 연동 비례비용

---

*KBEAUTY.md v4 | 기획안 v4.3 기반 | 언폴드랩*
