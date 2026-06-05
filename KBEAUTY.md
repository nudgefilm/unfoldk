# UnfoldK Beauty — 프로젝트 기준 파일 (KBEAUTY.md)
> Claude Code 참조용 | 최종 업데이트: 2026.06.06
> 기획안 v4.2 기반

---

## Claude Code에게 — 이 파일을 읽기 전에 먼저 숙지

**1. 기존 UnfoldK 파일 수정 금지**
- 모든 작업은 `app/kbeauty/` 폴더 안에서만
- 컴포넌트는 `app/kbeauty/_components/` 안에만 생성

**2. B2B 전용 — B2C 요소 만들지 않는다**
- 사용자: supplier / buyer / admin 세 가지뿐
- 팬(fan) 계정 B2B 접근 시 차단

**3. 언어 정책 준수**
- 공급사 UI → 한국어만
- 바이어 UI → 영어만
- 랜딩만 섹션별 혼용

**4. 디자인 시스템 준수**
- Pretendard: 본문
- Cormorant Garamond: 대형 헤드라인 전용
- Navy #1A3A5C: 공급사 Primary
- Gold #C8A882: 바이어 Accent
- border-radius: 8px(버튼·인풋) / 12px(카드)

**5. 자의적 파일 생성 금지**
- 지시된 파일·범위만 작업
- 불명확한 부분은 반드시 질문

---

## 1. 서비스 개요

```
서비스명: UnfoldK Beauty
URL: unfoldk.com/kbeauty
성격: K-뷰티 B2B 전용 매칭 플랫폼 (B2C 없음)
목적: 국내 K-뷰티 공급사 ↔ 북미 바이어 연결
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
  Free: 탐색·등록·알림 수신·매칭 요청 수신 (무제한)
  Pro:  매칭 승인 + 컨택 정보 공개
        샘플 요청 수락
        계약서 템플릿·물류 파트너 연결
        Trade Analytics 인사이트
        우선 노출

바이어
  플랜 구분 없음 (전면 무료)
  탐색·매칭 요청·샘플 요청 무제한
  공급사 컨택 정보: 매칭 승인 후 공개
```

---

## 4. 정보 공개 범위

```
공개 (누구나)
  회사명·카테고리·인증 배지
  MOQ·가격대·리드타임
  샘플 조건
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

인증 필요 (미들웨어):
  kbeauty/dashboard/supplier/* → beauty_suppliers 레코드 존재
  kbeauty/dashboard/buyer/*    → beauty_buyers 레코드 존재
  kbeauty/admin                → is_admin RPC

role 불일치 시 kbeauty로 리다이렉트
```

---

## 6. 언어 정책

```
kbeauty (랜딩)              → 섹션별 한·영 혼용
kbeauty/supplier            → 한국어 전용
kbeauty/dashboard/supplier/* → 한국어 전용
kbeauty/buyer               → 영어 전용
kbeauty/buyer/register      → 영어 전용
kbeauty/dashboard/buyer/*   → 영어 전용
kbeauty/admin               → 한국어 전용
```

---

## 7. 디자인 시스템

```css
/* 컬러 */
Navy Primary   : #1A3A5C  /* 공급사 CTA·버튼·배지 */
Navy Hover     : #153249
Gold Accent    : #C8A882  /* 바이어 CTA·강조·포인트 */
Gold Text      : #8B6F47
Text Primary   : #0F0F0F
Text Secondary : #6B6B6B
Background     : #F8F7F5
Border         : #E8E2DA
White          : #FFFFFF

/* 타이포 */
Display : Cormorant Garamond — 헤드라인 전용
Body    : Pretendard — 나머지 전체

/* 공통 */
border-radius : 8px (버튼·인풋) / 12px (카드)
box-shadow    : 0 2px 8px rgba(0,0,0,0.06)
transition    : 200ms
```

---

## 8. 폴더 구조

```
app/kbeauty/
  layout.tsx                          ← B2B 전용 레이아웃
  page.tsx                            ← P01 랜딩 ✅
  supplier/
    page.tsx                          ← P02 공급사 신청 ✅
  buyer/
    page.tsx                          ← P05 바이어 랜딩 ✅
    register/
      page.tsx                        ← P06 바이어 가입 ✅
  dashboard/
    supplier/
      page.tsx                        ← P03 공급사 대시보드
      products/
        new/
          page.tsx                    ← P04 제품 등록
    buyer/
      page.tsx                        ← P07 바이어 대시보드
      suppliers/
        page.tsx                      ← P08 공급사 탐색 + 매칭
  admin/
    page.tsx                          ← P09 관리자 패널
  _components/                        ← kbeauty 전용 컴포넌트
```

---

## 9. 페이지 목록

| # | 페이지 | 언어 | 접근 | 상태 |
|---|--------|------|------|------|
| P01 | B2B 랜딩 | 한·영 혼용 | 공개 | ✅ |
| P02 | 공급사 신청 | 한국어 | 공개 | ✅ |
| P03 | 공급사 대시보드 | 한국어 | supplier | 개발 중 |
| P04 | 제품 등록 | 한국어 | supplier | 대기 |
| P05 | 바이어 랜딩 | 영어 | 공개 | ✅ |
| P06 | 바이어 가입 | 영어 | 공개 | ✅ |
| P07 | 바이어 대시보드 | 영어 | buyer | 대기 |
| P08 | 공급사 탐색 | 영어 | buyer | 대기 |
| P09 | 관리자 패널 | 한국어 | admin | 대기 |

---

## 10. Supabase 테이블명

| 기능 | 실제 테이블명 |
|------|--------------|
| 공급사 | beauty_suppliers |
| 바이어 | beauty_buyers |
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
business_registration_number TEXT
business_registration_verified BOOLEAN DEFAULT false
cosmetic_license_url TEXT
cosmetic_license_verified BOOLEAN DEFAULT false
buyer_db_access BOOLEAN DEFAULT false
contact_name TEXT
contact_email TEXT
contact_phone TEXT
categories TEXT[]
website TEXT
fda_status TEXT
status TEXT  -- pre_registered | active
source TEXT  -- direct_signup | fda_api | kcia
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
stage1_approved BOOLEAN DEFAULT true
status TEXT  -- pre_registered | invited | active | pending
source TEXT  -- direct_signup | importgenius
contact_verified BOOLEAN DEFAULT false
bounce_count INTEGER DEFAULT 0
created_at TIMESTAMPTZ
```

---

## 13. beauty_products 핵심 필드

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

## 14. beauty_matches 핵심 필드

```sql
id UUID
supplier_id UUID REFERENCES beauty_suppliers(id)
buyer_id UUID REFERENCES beauty_buyers(id)
product_id UUID REFERENCES beauty_products(id)
request_type TEXT  -- matching | sample
message TEXT
status TEXT  -- requested | approved | rejected | completed
requested_at TIMESTAMPTZ
approved_at TIMESTAMPTZ
```

---

## 15. 공급사 인증 (2단계)

```
1단계: 국세청 API 자동 검증 ✅
  → 제품 등록·바이어 탐색 가능
  → 매칭 승인 불가

2단계: 화장품 등록필증 수동 승인
  → cosmetic_license_verified: true
  → buyer_db_access: true
  → Pro 전환 후 매칭 승인 가능
```

---

## 16. 매칭 승인 흐름

```
매칭 요청 수신 (Free)
    ↓
승인 버튼 클릭
    ↓
Pro 플랜 미가입 시 업그레이드 유도
    ↓
Pro 전환 완료
    ↓
컨택 정보 공개
```

---

## 17. 작업 완료 현황

```
✅ P01·P02·P05·P06 페이지 배포
✅ Supabase 6개 테이블 마이그레이션
✅ 미들웨어 role 기반 접근 제어
✅ 국세청 API 공급사 1단계 인증 연동
✅ 공급사·바이어 폼 Supabase 저장 연동
✅ RLS 정책 설정

□ P03 공급사 대시보드 (진행 중)
□ P04 제품 등록
□ P07 바이어 대시보드
□ P08 공급사 탐색 + 매칭
□ P09 관리자 패널
□ 알림 시스템
□ Pro 플랜 결제 (Lemon Squeezy)
```

---

## 18. Claude Code 세션 시작

```
KBEAUTY.md 파일 읽고 UnfoldK Beauty B2B 프로젝트 기준 파악해줘.
작업 지시 전까지 대기.
```

---

*KBEAUTY.md v3 | 기획안 v4.2 기반 | 언폴드랩*
