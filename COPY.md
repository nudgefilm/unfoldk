# COPY.md — 마케팅 카피 & 페이지 본문

> CLAUDE.md 본문에서 분리. 사이트 카피 모음 — 작성·번역·UI 반영 작업 참조용.

---

## About 페이지

> 페이지 라우트: `/about` (`app/about/page.tsx`). 섹션 순서:
> Hero → Mission → Stats → How it started → **Educational Access** → Services → CTA.

### Hero — 메인 헤드라인 + 서브카피

About 페이지 Hero 의 h1 + lead `<p>` 1줄 구성. 광고 카피풍의 짧은 메시지로 단순화.

```
[h1]
Built by a solo indie developer from Korea,
for Hallyu fans around the world.

[lead]
We keep improving to bring you a better experience.
```

- **용도**: 1인 운영 indie 스튜디오임을 정직하게 노출 + 지속 개선 약속
- **위치**: Hero 섹션 h1 + 그 아래 lead `<p>` (muted/lg)
- **이전 카피 (폐기)** (2026-05-19):
  - h1: "Built for Hallyu fans, by a Hallyu fan."
  - lead: "UnfoldK started because keeping up with K-pop comebacks, K-dramas, and Korean culture is a full-time job. So we built the tools to make it effortless."
  - 보조 문단: "Built by a solo indie developer from Korea, for Hallyu fans around the world. We keep improving to bring you a better experience." (h1 흡수로 제거됨)
- **상태**: 반영 완료 (2026-05-19)


### How it started — 섹션 본문

```
UNFOLD LAB is a small indie studio building tools for users
around the world. We heard from K-pop fans that tracking
comeback schedules, finding dramas, learning Korean, and
planning trips to Korea was harder than it should be.

UnfoldK is our answer to that.
```

- **용도**: UNFOLD LAB 소개 + UnfoldK 탄생 배경
- **이전 카피**: "After launching tubewatch.kr…" / "Six focused services. One affordable subscription. Zero fluff." (2026-05-19 폐기)
- **상태**: 반영 완료 (2026-05-19)


### Educational Access — Expanding the Possibilities of Hallyu Education Worldwide

```
Expanding the Possibilities of Hallyu Education Worldwide

UnfoldK believes in the power of cultural exchange.
We offer free institutional access to accredited educational
institutions, Korean language programs, and culture-related
nonprofits.

[Request Educational Access]
```

- **용도**: 교육기관·한국어 프로그램·문화 비영리 대상 무료 institutional 액세스 안내
- **CTA**: "Request Educational Access" → `/contact` 페이지 (기존 Resend 폼 재사용)
- **이전 카피 (폐기)**: "Empowering K-Culture Education Globally" (2026-05-19)
- **상태**: 반영 완료 (2026-05-19)

---

## 신규 Free 회원 24시간 OPEN 체험 — 안내 문구 (TODO)

가입 직후 24시간 동안 Pro 전체 메뉴 무제한 체험 제공. 마케팅 카피 후보:

- "Get 24 hours of full Pro access — free, no card required."
- "Try every Hallyu Pass feature for 24 hours, on us."

- **상태**: 정책 + 카피 모두 미확정. 확정 시 가입 플로우 / 마이페이지 배너 / 랜딩 hero CTA 에 동시 반영.

---

## (자리만 마련) 기타 카피

- 랜딩 hero / pricing / FAQ 카피는 v0 컴포넌트 내부에 직접 작성됨 (`components/hero-section.tsx` 등)
- 추후 변경 시 이 파일에도 박제할 것 (한 곳에서 검색 가능)
