# COPY.md — 마케팅 카피 & 페이지 본문

> CLAUDE.md 본문에서 분리. 사이트 카피 모음 — 작성·번역·UI 반영 작업 참조용.

---

## About 페이지

> 페이지 라우트: `/about` (`app/about/page.tsx`). 섹션 순서:
> Hero → Mission → Stats → How it started → **Educational Access** → Services → CTA.

### Hero — 인디 개발자 소개 문구

Hero 의 lead 문단 바로 아래에 노출되는 보조 문장.

```
Built by a solo indie developer from Korea,
for Hallyu fans around the world.
We keep improving to bring you a better experience.
```

- **용도**: 1인 운영 indie 스튜디오임을 솔직히 안내, 유저 신뢰·기대치 정렬
- **위치**: Hero `<p>` lead 다음 보조 문단 (`mt-6`, muted/80 톤)
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
