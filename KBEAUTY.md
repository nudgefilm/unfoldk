# UnfoldK Beauty — 프로젝트 기준 파일 (KBEAUTY.md)
> Claude Code 참조용 | 최종 업데이트: 2026.06.05
> 기획안 v4.1 기반

---

## Claude Code에게 — 이 파일을 읽기 전에 먼저 숙지

이 파일은 **UnfoldK Beauty** 서브 프로젝트의 전체 기준을 담고 있다.
작업 지시를 받기 전에 아래 5가지를 반드시 이해하고 시작할 것.

**1. 이 프로젝트는 기존 UnfoldK와 같은 레포 안에 있다**
- 기존 UnfoldK 코드·테이블·레이아웃은 절대 수정하지 않는다
- 모든 작업은 `app/kbeauty/` 폴더 안에서만 이루어진다
- 컴포넌트는 `app/kbeauty/_components/` 안에만 생성한다

**2. B2B 전용이다 — B2C 요소를 만들지 않는다**
- 팬용 피드, 위시리스트, Hallyu 콘텐츠 등 B2C 기능 없음
- 사용자는 공급사(supplier) / 바이어(buyer) / 관리자(admin) 세 가지뿐
- 기존 UnfoldK의 팬(fan) 계정으로 B2B 접근 시 차단 처리

**3. 언어 정책을 반드시 지킨다**
- 공급사 관련 UI → 한국어만 (영문 번역 금지)
- 바이어 관련 UI → 영어만 (한국어 번역 금지)
- 랜딩 페이지만 섹션별 혼용 (Navbar·Hero·Trust·Footer는 영문, 공급사 카드는 한국어, 바이어 카드는 영어)

**4. 디자인 시스템은 아래 기준을 따른다**
- Pretendard: 본문 전체
- Cormorant Garamond: 대형 헤드라인 전용
- Navy(#1A3A5C): 공급사 CTA·배지·버튼 Primary
- Gold(#C8A882): 바이어 CTA·강조 숫자·포인트
- border-radius: 8px(버튼·인풋) / 12px(카드)

**5. 작업 순서는 지시에 따른다 — 자의적으로 파일을 생성하지 않는다**
- 지시된 파일·범위만 작업한다
- 지시 없이 기존 파일을 수정하거나 새 파일을 만들지 않는다
- 불명확한 부분은 작업 전에 반드시 질문한다

---

## 1. 서비스 개요

- **서비스명**: UnfoldK Beauty
- **URL**: unfoldk.com/kbeauty
- **성격**: K-뷰티 B2B 전용 매칭 플랫폼 (B2C 없음)
- **목적**: 국내 K-뷰티 공급사 ↔ 북미 바이어 연결
- **운영**: 언폴드랩 (1인 운영)
- **SEO**: 비운영 (경로 비공개, 직접 접근만)
- **슬로건**: "Connect with Verified Korean Beauty Suppliers."

### 플랫폼 포지션
```
하는 것:
  ✅ 검증된 바이어·공급사 매칭
  ✅ B2B 무역 인사이트 리포트 (Trade Analytics Engine)
  ✅ MoCRA/FDA 대응 계약서 템플릿 제공 (다운로드)
  ✅ 전문 물류·관세 파트너사 연결 (Affiliate)

하지 않는 것:
  ❌ 물류·통관 직접 운영
  ❌ 계약 과정 실시간 중개
  ❌ 에스크로 결제 직접 운영 (24개월 이후 검토)
  ❌ 법적 계약 책임
```

---

## 2. 기술 스택

```
Frontend : Next.js 15 (App Router)
Styling  : Tailwind CSS + Pretendard + Cormorant Garamond
Backend  : Supabase
Auth     : Supabase Auth (기존 UnfoldK와 공유)
결제     : Lemon Squeezy (2차 개발)
AI       : Claude API (Haiku — 인사이트 문장 생성 전용)
배포     : Vercel
```

---

## 3. 운영 구조

```
공유: Supabase Auth (로그인·세션만)
분리: DB 테이블 / 레이아웃 / 비즈니스 로직 / 디자인 시스템

계정 정책:
  role: 'supplier' | 'buyer' | 'admin'
  팬 계정(fan)으로 B2B 접근 시 → 차단 + 별도 가입 유도
  공급사·바이어 겸용 불허 (MVP)
```

---

## 4. 접근 제어

```
전체 공개:
  /kbeauty
  /kbeauty/supplier
  /kbeauty/buyer
  /kbeauty/buyer/register

인증 필요 (미들웨어로 처리):
  /kbeauty/dashboard/supplier/*  → role: supplier만
  /kbeauty/dashboard/buyer/*     → role: buyer만
  /kbeauty/admin                 → role: admin만

role 불일치 시 /kbeauty로 리다이렉트
```

---

## 5. 언어 정책

```
/kbeauty (랜딩)
  Navbar·Hero 헤드라인·Trust Stats·Footer → 영문
  공급사 카드·CTA → 한국어
  바이어 카드·CTA → 영어
  How It Works → 공급사 탭 한국어 / 바이어 탭 영어

/kbeauty/supplier              → 한국어 전용
/kbeauty/dashboard/supplier/*  → 한국어 전용
/kbeauty/buyer                 → 영어 전용
/kbeauty/buyer/register        → 영어 전용
/kbeauty/dashboard/buyer/*     → 영어 전용
/kbeauty/admin                 → 한국어 전용
```

---

## 6. 디자인 시스템

### 컬러
```
Navy Primary   : #1A3A5C  ← 공급사 CTA·버튼·배지
Navy Hover     : #153249
Gold Accent    : #C8A882  ← 바이어 CTA·강조 숫자·포인트
Gold Text      : #8B6F47
Text Primary   : #0F0F0F
Text Secondary : #6B6B6B
Background     : #F8F7F5
Border         : #E8E2DA
White          : #FFFFFF
Success        : #1A3A5C (체크 아이콘)
```

### 타이포그래피
```
Display  : Cormorant Garamond (serif) — 대형 헤드라인 전용
Body     : Pretendard — 나머지 전체
```

### 공통 규칙
```
border-radius : 8px (버튼·인풋) / 12px (카드)
box-shadow    : 0 2px 8px rgba(0,0,0,0.06) (카드)
transition    : 200ms
max-width     : 1280px
```

---

## 7. 폴더 구조

```
app/
  kbeauty/
    layout.tsx                          ← B2B 전용 레이아웃
    page.tsx                            ← P01 랜딩
    supplier/
      page.tsx                          ← P02 공급사 신청
    buyer/
      page.tsx                          ← P05 바이어 랜딩
      register/
        page.tsx                        ← P06 바이어 가입
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

## 8. 페이지 목록 (9개)

| # | 페이지 | 파일 | 언어 | 접근 | v0 상태 |
|---|--------|------|------|------|---------|
| P01 | B2B 랜딩 | app/kbeauty/page.tsx | 한·영 혼용 | 공개 | ✅ 완성 |
| P02 | 공급사 신청 | app/kbeauty/supplier/page.tsx | 한국어 | 공개 | 작업 중 |
| P03 | 공급사 대시보드 | app/kbeauty/dashboard/supplier/page.tsx | 한국어 | supplier | Claude Code |
| P04 | 제품 등록 | app/kbeauty/dashboard/supplier/products/new/page.tsx | 한국어 | supplier | Claude Code |
| P05 | 바이어 랜딩 | app/kbeauty/buyer/page.tsx | 영어 | 공개 | 작업 중 |
| P06 | 바이어 가입 | app/kbeauty/buyer/register/page.tsx | 영어 | 공개 | 작업 중 |
| P07 | 바이어 대시보드 | app/kbeauty/dashboard/buyer/page.tsx | 영어 | buyer | Claude Code |
| P08 | 공급사 탐색 | app/kbeauty/dashboard/buyer/suppliers/page.tsx | 영어 | buyer | Claude Code |
| P09 | 관리자 패널 | app/kbeauty/admin/page.tsx | 한국어 | admin | Claude Code |

---

## 9. 공급사 인증 (2단계)

```
1단계 — 국세청 API 자동 검증
  사업자번호 → 국세청 API → 사업자 생존 확인
  통과 시: 제품 등록 CMS 접근 허용
  바이어 DB 조회는 불가 상태 유지

2단계 — 화장품 등록필증 수동 승인 (신규)
  화장품 제조업 or 책임판매업 등록필증 업로드 (식약처 발급)
  관리자 검토 후 승인
  승인 시: 바이어 DB 조회·매칭 요청 권한 활성화

접근 권한:
  국세청만 완료: 제품 등록 가능 / 바이어 DB 조회 불가
  등록필증 승인: 전체 접근 가능
```

### suppliers 테이블 핵심 필드
```sql
business_registration_verified BOOLEAN DEFAULT false,
cosmetic_license_url TEXT,
cosmetic_license_verified BOOLEAN DEFAULT false,
cosmetic_license_type TEXT, -- 'manufacturer' | 'responsible_seller'
buyer_db_access BOOLEAN DEFAULT false
```

---

## 10. 바이어 인증 (2단계)

```
1단계 — 비즈니스 정보 제출 + 수동 승인
  이메일·EIN/VAT·웹사이트·사업 유형 제출
  관리자 1 business day 내 검토
  승인 시: 공급사 탐색·기본 매칭 접근

2단계 — 매칭 요청 시 사업자 서류 제출
  W-9(미국) or VAT등록증(유럽) or 사업자등록증 업로드
  관리자 최종 승인 후 컨택 정보 공개
```

### buyers 테이블 핵심 필드
```sql
contact_verified BOOLEAN DEFAULT false,
linkedin_verified BOOLEAN DEFAULT false,
bounce_count INTEGER DEFAULT 0,
stage1_approved BOOLEAN DEFAULT false,
stage2_approved BOOLEAN DEFAULT false,
status TEXT DEFAULT 'pre_registered'
-- pre_registered | invited | active
```

---

## 11. Supabase 핵심 테이블

```sql
-- 공급사
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  company_name_ko TEXT NOT NULL,
  company_name_en TEXT NOT NULL,
  business_registration_number TEXT UNIQUE NOT NULL,
  business_registration_verified BOOLEAN DEFAULT false,
  cosmetic_license_url TEXT,
  cosmetic_license_verified BOOLEAN DEFAULT false,
  cosmetic_license_type TEXT,
  buyer_db_access BOOLEAN DEFAULT false,
  fda_registration_number TEXT,
  categories TEXT[],
  moq INTEGER,
  price_range_min NUMERIC,
  price_range_max NUMERIC,
  lead_time_days INTEGER,
  export_countries TEXT[],
  status TEXT DEFAULT 'pre_registered',
  source TEXT DEFAULT 'direct_signup',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 바이어
CREATE TABLE buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  company_name TEXT NOT NULL,
  country TEXT NOT NULL,
  website TEXT NOT NULL,
  business_email TEXT NOT NULL,
  ein_number TEXT,
  business_doc_url TEXT,
  categories TEXT[],
  business_type TEXT,
  annual_import_volume TEXT,
  contact_verified BOOLEAN DEFAULT false,
  linkedin_verified BOOLEAN DEFAULT false,
  bounce_count INTEGER DEFAULT 0,
  stage1_approved BOOLEAN DEFAULT false,
  stage2_approved BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pre_registered',
  source TEXT DEFAULT 'direct_signup',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 제품
CREATE TABLE beauty_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id),
  product_name_ko TEXT NOT NULL,
  product_name_en TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  category TEXT NOT NULL,
  certifications TEXT[],
  fda_registration_number TEXT,
  moq INTEGER,
  price_range_min NUMERIC,
  price_range_max NUMERIC,
  lead_time_days INTEGER,
  export_countries TEXT[],
  images JSONB,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 매칭
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id),
  buyer_id UUID REFERENCES buyers(id),
  product_id UUID REFERENCES beauty_products(id),
  message TEXT,
  status TEXT DEFAULT 'requested',
  -- requested | stage2_pending | approved | rejected | completed
  requested_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ
);

-- Trade Analytics Engine 결과
CREATE TABLE trade_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,
  -- trend_velocity | spec_filter | hallyu_correlation | monthly_summary
  hs_code TEXT,
  period TEXT NOT NULL,
  raw_data JSONB,
  computed_score NUMERIC,
  insight_text TEXT, -- Claude Haiku 생성
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Post-Matching 서비스
CREATE TABLE post_matching_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id),
  service_type TEXT NOT NULL,
  -- contract_template_download | logistics_referral | insight_report
  status TEXT DEFAULT 'completed',
  affiliate_fee NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 12. Pro 플랜 구조

### 핵심 원칙
SaaS 핵심 전환 동인 = **매칭 기회 제한**.
Free에서 매칭 한도 소진 → Pro 전환 유도.

### 공급사 플랜
```
Free: 제품 3개 / 바이어 조회 월 10건 / 매칭 요청 월 3~5회
Pro ($99~$199/월):
  - 무제한 매칭 + 우선 제안(Top Exposure)
  - Trade Analytics Engine 전체 리포트
  - MoCRA/FDA 계약서 템플릿 무제한 다운로드
  - 전문 관세사·포워더 1:1 매칭 + 우대 혜택
```

### 바이어 플랜
```
Free: 공급사 탐색 월 20건 / 매칭 요청 월 3회
Pro ($149~$199/월):
  - 무제한 탐색 + 무제한 매칭
  - Trade Analytics Engine 전체 리포트
  - 수입 계약서 가이드
  - 물류 파트너 우대
```

---

## 13. Trade Analytics Engine

```
데이터 소스:
  관세청 수출입통계 API (무료) — HS코드 3304·3305·3307
  UN Comtrade API (무료) — 글로벌 수입 동향
  FDA OpenFDA API (무료) — MoCRA 등록 현황
  Last.fm 스크로블 데이터 — 한류 선행 지표 (기존 UnfoldK 수집)

3대 연산:
  Trend Velocity Index — 카테고리별 성장 가속도
  Specification Filter Engine — 성분·인증 수요 분석
  Hallyu-Beauty Correlation — 한류 소비 → 뷰티 수요 예측

출력 파이프라인:
  정형 데이터 연산 → JSON 정제 → Claude Haiku 문장 조립 → 대시보드 카드

핵심 원칙:
  수치 계산은 엔진이, 문장만 Haiku가 담당 (AI 환각 방지)
```

---

## 14. 바이어 DB 사전 구축 파이프라인

```
ImportGenius (HS3304·3305·3307, Korea origin, 최근 2년)
    ↓
FDA OpenFDA (미국 등록) 교차 검증
    ↓
Apollo.io (구매담당자 이메일·LinkedIn URL 추출)
    ↓
LinkedIn 재직 확인 필터 (contact_verified: true만 적재)
    ↓
buyers 테이블 (status: pre_registered)

이메일 발송 후:
  Bounce 3회 누적 → 자동 제거
  contact_verified: true인 바이어만 공급사에게 노출
```

---

## 15. MVP 범위

### In Scope (1차)
- [ ] v0 코드 4개 파일 붙여넣기 (P01·P02·P05·P06)
- [ ] npx shadcn@latest add sheet label radio-group
- [ ] Supabase 테이블 마이그레이션 (위 6개 테이블)
- [ ] 국세청 API 공급사 1단계 인증
- [ ] 화장품 등록필증 업로드 + 수동 승인 (2단계)
- [ ] 바이어 1단계 가입 + 수동 승인
- [ ] 바이어 2단계 서류 업로드 + 최종 승인
- [ ] 공급사·바이어 탐색 페이지 (P08)
- [ ] 기본 매칭 요청 (Free: 월 3~5회 제한)
- [ ] 관리자 패널 (P09)
- [ ] 미들웨어 (role 기반 접근 제어)

### Out of Scope (2차)
- [ ] Trade Analytics Engine
- [ ] Pro 플랜 결제 (Lemon Squeezy)
- [ ] MoCRA/FDA 계약서 템플릿
- [ ] 물류 파트너 Affiliate 연동
- [ ] 플랫폼 내 메시징

### Out of Scope (3차)
- [ ] 에스크로 결제
- [ ] 자동화 매칭 알고리즘

---

## 16. 마일스톤

| 단계 | 기간 | 내용 |
|------|------|------|
| 데이터 선구축 | 6월 | ImportGenius → Apollo → LinkedIn 필터 → Supabase |
| MVP 개발 | 6~7월 | v0 코드 이식 + 인증 로직 + 탐색 + 매칭 |
| 소프트 런치 | 7월 중순 | 강원·경기 공급사 5~10곳 파일럿 |
| 지자체 제안 | 7월 말~ | MVP + 바이어 DB + Pro 플랜 로드맵 제안서 |
| Trade Analytics Engine | 8~9월 | 관세청·FDA·Last.fm 파이프라인 |
| Pro 플랜 출시 | 10월~ | 구독 결제 + 계약서 + 물류 Affiliate |

---

## 17. Claude Code 세션 시작 방법

```
KBEAUTY.md 파일 읽고 UnfoldK Beauty B2B 프로젝트 기준 파악해줘.
작업 지시 전까지 대기.
```

---

## 18. 작업 시 주의사항

1. **기존 UnfoldK 파일 수정 금지** — kbeauty 전용 파일만 생성
2. **언어 정책 준수** — 공급사 한국어 / 바이어 영어 / 번역 금지
3. **디자인 시스템 준수** — Navy #1A3A5C Primary / Gold #C8A882 Accent
4. **DB 작업 전 확인** — 기존 테이블 이름 충돌 없는지 확인
5. **미들웨어** — /kbeauty/dashboard/* 접근 시 role 확인 필수
6. **자의적 파일 생성 금지** — 지시된 파일·범위만 작업

---

*UnfoldK Beauty KBEAUTY.md v2 | 기획안 v4.1 기반 | 언폴드랩*
