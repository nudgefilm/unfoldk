"use client"

import { useState } from "react"
import { FooterSection } from "@/components/footer-section"

const content = {
  en: {
    title: "Privacy Policy",
    subtitle: "Last updated: May 7, 2026",
    sections: [
      {
        title: "1. Introduction",
        content: `UNFOLD LAB ("we," "us," or "our") operates UnfoldK (unfoldk.com). This Privacy Policy explains how we collect, use, and protect your personal information. By using UnfoldK, you agree to the practices described here.`
      },
      {
        title: "2. Information We Collect",
        content: null,
        list: [
          "Account info: email, name, profile photo (via Google OAuth)",
          "Usage data: services used, artists tracked, dramas watched, learning progress, recipes saved",
          "Payment info: processed securely by Stripe — we do not store card details",
          "Device & log data: IP address, browser type, access times (for security)"
        ]
      },
      {
        title: "3. How We Use Your Information",
        content: null,
        list: [
          "To provide and personalize UnfoldK services",
          "To process subscription payments",
          "To send service notifications and event alerts (with your consent)",
          "To improve our platform through anonymized analytics",
          "We never sell your personal data to third parties"
        ]
      },
      {
        title: "4. Third-Party Services",
        content: null,
        list: [
          "Google OAuth (authentication)",
          "Stripe (payment processing — stripe.com/privacy)",
          "YouTube Data API v3, TMDB API, Last.fm API (content data)",
          "Resend (transactional email) · Supabase (database hosting)"
        ]
      },
      {
        title: "5. Data Retention",
        content: null,
        list: [
          "Account data: retained while your account is active",
          "Subscription records: retained for 5 years (legal requirement)",
          "Request deletion: support@unfoldk.com"
        ]
      },
      {
        title: "6. Your Rights — GDPR (EU Users)",
        content: null,
        list: [
          "Access, correct, or delete your data",
          "Data portability (export as CSV from My Page)",
          "Withdraw consent at any time",
          "Contact: support@unfoldk.com"
        ]
      },
      {
        title: "7. Your Rights — CCPA (California Users)",
        content: null,
        list: [
          "Right to know what data is collected",
          "Right to delete personal data",
          "Right to opt-out of data sale (we do not sell data)"
        ]
      },
      {
        title: "8. Cookies",
        content: null,
        list: [
          "Essential cookies: authentication and session management",
          "Analytics cookies: anonymized usage data",
          "Disable non-essential cookies in browser settings"
        ]
      },
      {
        title: "9. Children's Privacy",
        content: "UnfoldK is not directed at children under 13. Contact support@unfoldk.com if concerned."
      },
      {
        title: "10. Changes",
        content: "We will notify users of material changes via email. Continued use constitutes acceptance."
      },
      {
        title: "11. Contact",
        content: "support@unfoldk.com · UNFOLD LAB · unfoldk.com"
      }
    ]
  },
  ko: {
    title: "개인정보처리방침",
    subtitle: "최종 수정일: 2026년 5월 7일",
    sections: [
      {
        title: "1. 개요",
        content: `UNFOLD LAB(이하 "회사")은 unfoldk.com(이하 "UnfoldK")을 운영하며, 이용자의 개인정보를 중요하게 생각합니다. 본 방침은 수집하는 개인정보의 종류, 이용 목적, 보호 방법을 설명합니다.`
      },
      {
        title: "2. 수집하는 개인정보",
        content: null,
        list: [
          "계정 정보: 이메일 주소, 이름, 프로필 사진 (Google OAuth 연동)",
          "서비스 이용 정보: 이용한 서비스, 추적 중인 아티스트, 시청 드라마, 학습 진도, 저장한 레시피",
          "결제 정보: Stripe를 통해 안전하게 처리, 카드 정보는 저장하지 않습니다",
          "기기 및 로그 정보: IP 주소, 브라우저 종류, 접속 시간 (보안 목적)"
        ]
      },
      {
        title: "3. 개인정보 이용 목적",
        content: null,
        list: [
          "UnfoldK 서비스 제공 및 개인화",
          "구독 결제 처리",
          "서비스 알림 및 이벤트 D-Day 알림 발송 (동의한 경우)",
          "익명화된 통계를 통한 서비스 개선",
          "개인정보는 제3자에게 판매하지 않습니다"
        ]
      },
      {
        title: "4. 개인정보 제3자 제공",
        content: null,
        list: [
          "Google OAuth (인증)",
          "Stripe (결제 처리 — stripe.com/privacy)",
          "YouTube Data API v3, TMDB API, Last.fm API (콘텐츠 데이터)",
          "Resend (이메일 발송) · Supabase (데이터베이스 호스팅)"
        ]
      },
      {
        title: "5. 개인정보 보유 기간",
        content: null,
        list: [
          "계정 정보: 회원 탈퇴 시까지",
          "결제 기록: 5년 (법적 의무)",
          "삭제 요청: support@unfoldk.com"
        ]
      },
      {
        title: "6. 이용자 권리 (GDPR — EU 이용자)",
        content: null,
        list: [
          "개인정보 열람, 정정, 삭제 권리",
          "데이터 이동권 (마이페이지에서 CSV 내보내기)",
          "동의 철회 권리",
          "문의: support@unfoldk.com"
        ]
      },
      {
        title: "7. 이용자 권리 (CCPA — 캘리포니아 이용자)",
        content: null,
        list: [
          "수집 정보 확인 권리",
          "개인정보 삭제 요청 권리",
          "개인정보 판매 거부 권리 (회사는 판매하지 않음)"
        ]
      },
      {
        title: "8. 쿠키 정책",
        content: null,
        list: [
          "필수 쿠키: 로그인 세션 유지",
          "분석 쿠키: 익명화된 서비스 개선 목적",
          "비필수 쿠키는 브라우저 설정에서 비활성화 가능"
        ]
      },
      {
        title: "9. 아동 개인정보",
        content: "만 14세 미만 아동 대상 서비스 아님. 문의: support@unfoldk.com"
      },
      {
        title: "10. 방침 변경",
        content: "중요한 변경 사항은 이메일로 사전 안내합니다."
      },
      {
        title: "11. 문의",
        content: "support@unfoldk.com · UNFOLD LAB · unfoldk.com"
      }
    ]
  }
}

export default function PrivacyPage() {
  const [lang, setLang] = useState<"en" | "ko">("en")
  const currentContent = content[lang]

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[800px] mx-auto px-5 py-16 md:py-24">
        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-3">
          {currentContent.title}
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          {currentContent.subtitle}
        </p>

        {/* Language Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-[#1a1a1a] rounded-full p-1 border border-border/30">
            <button
              onClick={() => setLang("en")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                lang === "en"
                  ? "text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={lang === "en" ? { backgroundColor: "#FF4B6E" } : {}}
            >
              English
            </button>
            <button
              onClick={() => setLang("ko")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                lang === "ko"
                  ? "text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={lang === "ko" ? { backgroundColor: "#FF4B6E" } : {}}
            >
              한국어
            </button>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {currentContent.sections.map((section, index) => (
            <section key={index} className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                {section.title}
              </h2>
              {section.content && (
                <p className="text-muted-foreground leading-relaxed">
                  {section.content}
                </p>
              )}
              {section.list && (
                <ul className="space-y-2">
                  {section.list.map((item, i) => (
                    <li key={i} className="text-muted-foreground leading-relaxed flex items-start gap-2">
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
