"use client"

// /gdpr — GDPR 안내 페이지
// /privacy 의 GDPR 섹션을 전용 페이지로 확장. EN/KO 토글 패턴은 /privacy, /terms, /cookie 와 동일.
// 본문은 법무 검토 후 교체 가능 (현재는 spec 수준).

import { useState } from "react"
import Link from "next/link"
import { FooterSection } from "@/components/footer-section"

const content = {
  en: {
    title: "GDPR",
    subtitle: "Your data rights under EU General Data Protection Regulation",
    sections: [
      {
        title: "1. Overview",
        content: `UNFOLD LAB ("we") operates UnfoldK (unfoldk.com). If you are a resident of the European Economic Area (EEA), the United Kingdom, or Switzerland, the GDPR gives you specific rights over how we process your personal data. This page summarizes those rights and how to exercise them. For full details on what we collect and why, see our Privacy Policy.`,
      },
      {
        title: "2. Data Controller",
        content: `UNFOLD LAB is the data controller responsible for your personal data on UnfoldK. Contact: support@unfoldk.com.`,
      },
      {
        title: "3. Lawful Bases for Processing",
        content: null,
        list: [
          "Performance of a contract — to provide UnfoldK services after you sign up",
          "Legitimate interests — to keep the service secure, prevent fraud, and improve features",
          "Consent — for non-essential cookies, marketing emails, and optional integrations",
          "Legal obligation — to retain billing records as required by law",
        ],
      },
      {
        title: "4. Your Rights",
        content: null,
        list: [
          "Right of access — request a copy of the personal data we hold about you",
          "Right to rectification — correct inaccurate or incomplete data",
          "Right to erasure ('right to be forgotten') — request deletion of your account and data",
          "Right to restrict processing — pause certain uses of your data",
          "Right to data portability — receive your data in a machine-readable format (CSV/JSON)",
          "Right to object — opt out of processing based on legitimate interests, including profiling",
          "Right to withdraw consent — for any consent-based processing, at any time",
          "Right to lodge a complaint — with your local data protection authority",
        ],
      },
      {
        title: "5. How to Exercise Your Rights",
        content: `Email support@unfoldk.com from the address associated with your account. We will respond within 30 days. We may ask for additional verification to confirm your identity before processing sensitive requests.`,
      },
      {
        title: "6. Data Retention",
        content: null,
        list: [
          "Account data: retained while your account is active",
          "Subscription records: 5 years (legal/tax requirement)",
          "Logs and analytics: 12 months",
          "Deleted accounts: residual backups purged within 90 days",
        ],
      },
      {
        title: "7. International Transfers",
        content: `Our infrastructure (Supabase, Vercel, Resend, Lemon Squeezy) processes data in the EU and US. Transfers outside the EEA rely on Standard Contractual Clauses (SCCs) or equivalent safeguards.`,
      },
      {
        title: "8. Contact",
        content: `Data protection inquiries: support@unfoldk.com · UNFOLD LAB · unfoldk.com. You may also lodge a complaint with your local supervisory authority.`,
      },
    ],
  },
  ko: {
    title: "GDPR",
    subtitle: "유럽 일반정보보호법(GDPR)에 따른 개인정보 권리 안내",
    sections: [
      {
        title: "1. 개요",
        content: `UNFOLD LAB(이하 "회사")이 운영하는 UnfoldK(unfoldk.com)는 EEA·영국·스위스 거주자의 개인정보를 GDPR에 따라 처리합니다. 본 페이지는 이용자가 GDPR로 보장받는 권리와 행사 방법을 요약합니다. 수집 항목과 목적 전반은 개인정보처리방침을 참고해 주세요.`,
      },
      {
        title: "2. 개인정보 처리자",
        content: `UNFOLD LAB이 UnfoldK의 개인정보 처리자(data controller)입니다. 문의: support@unfoldk.com.`,
      },
      {
        title: "3. 처리의 법적 근거",
        content: null,
        list: [
          "계약 이행 — 회원 가입 후 UnfoldK 서비스 제공",
          "정당한 이익 — 서비스 보안 유지·악용 방지·기능 개선",
          "동의 — 비필수 쿠키, 마케팅 이메일, 선택적 외부 연동",
          "법적 의무 — 결제 기록 등 법령상 보관 의무 이행",
        ],
      },
      {
        title: "4. 이용자 권리",
        content: null,
        list: [
          "열람권 — 회사가 보유한 본인 개인정보 사본 요청",
          "정정권 — 부정확하거나 불완전한 정보 정정 요청",
          "삭제권('잊혀질 권리') — 계정 및 개인정보 삭제 요청",
          "처리 제한권 — 특정 처리의 일시 중지 요청",
          "데이터 이동권 — CSV/JSON 등 기계 판독 가능 형식으로 데이터 이전",
          "거부권 — 정당한 이익에 따른 처리(프로파일링 포함) 거부",
          "동의 철회권 — 동의에 기반한 처리는 언제든 철회 가능",
          "감독기관 진정권 — 거주국 데이터보호 감독기관에 진정 가능",
        ],
      },
      {
        title: "5. 권리 행사 방법",
        content: `계정과 연결된 이메일로 support@unfoldk.com에 요청해 주세요. 30일 이내 회신합니다. 민감한 요청은 본인 확인을 위한 추가 절차를 안내할 수 있습니다.`,
      },
      {
        title: "6. 보유 기간",
        content: null,
        list: [
          "계정 데이터: 회원 탈퇴 시까지",
          "결제 기록: 5년 (법적·세무 의무)",
          "로그·분석 데이터: 12개월",
          "탈퇴 계정의 백업 잔존본: 90일 이내 완전 삭제",
        ],
      },
      {
        title: "7. 국외 이전",
        content: `이용 인프라(Supabase, Vercel, Resend, Lemon Squeezy)는 EU·미국에서 데이터를 처리합니다. EEA 밖 이전은 표준계약조항(SCC) 등 동등 보호조치를 통해 이루어집니다.`,
      },
      {
        title: "8. 문의",
        content: `데이터 보호 문의: support@unfoldk.com · UNFOLD LAB · unfoldk.com. 거주국 감독기관에 진정도 가능합니다.`,
      },
    ],
  },
}

export default function GdprPage() {
  const [lang, setLang] = useState<"en" | "ko">("en")
  const c = content[lang]

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[800px] mx-auto px-5 py-16 md:py-24">
        <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-3">{c.title}</h1>
        <p className="text-muted-foreground text-center mb-8">{c.subtitle}</p>

        {/* Language Toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-[#1a1a1a] rounded-full p-1 border border-border/30">
            <button
              onClick={() => setLang("en")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                lang === "en" ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              style={lang === "en" ? { backgroundColor: "#FF4B6E" } : {}}
            >
              English
            </button>
            <button
              onClick={() => setLang("ko")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                lang === "ko" ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              style={lang === "ko" ? { backgroundColor: "#FF4B6E" } : {}}
            >
              한국어
            </button>
          </div>
        </div>

        {/* 안내 — 전체 개인정보 처리방침 링크 */}
        <p className="text-muted-foreground text-sm text-center mb-10">
          {lang === "en" ? (
            <>
              For a full description of what we collect and why, see our{" "}
              <Link
                href="/privacy"
                className="hover:underline"
                style={{ color: "#FF4B6E" }}
              >
                Privacy Policy
              </Link>
              .
            </>
          ) : (
            <>
              수집 항목과 목적 전반은{" "}
              <Link
                href="/privacy"
                className="hover:underline"
                style={{ color: "#FF4B6E" }}
              >
                개인정보처리방침
              </Link>
              을 참고해 주세요.
            </>
          )}
        </p>

        <div className="space-y-8">
          {c.sections.map((section, i) => (
            <section
              key={i}
              className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6"
            >
              <h2 className="text-xl font-semibold text-white mb-4">{section.title}</h2>
              {section.content && (
                <p className="text-muted-foreground leading-relaxed">{section.content}</p>
              )}
              {section.list && (
                <ul className="space-y-2">
                  {section.list.map((item, j) => (
                    <li
                      key={j}
                      className="text-muted-foreground leading-relaxed flex items-start gap-2"
                    >
                      <span style={{ color: "#FF4B6E" }}>·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>

      <FooterSection />
    </div>
  )
}
