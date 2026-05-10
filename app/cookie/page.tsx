"use client"

import { useState } from "react"
import { FooterSection } from "@/components/footer-section"

// 기본 템플릿 — Cookie Policy.
// /privacy / /terms 와 동일하게 EN/KO 토글 패턴. 법무 검토 시 본문 교체 가정.

export default function CookiePage() {
  const [language, setLanguage] = useState<"en" | "ko">("en")

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[800px] mx-auto px-5 py-16 md:py-24">
        <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-3">
          {language === "en" ? "Cookie Policy" : "쿠키 정책"}
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          {language === "en" ? "Last updated: May 10, 2026" : "최종 수정일: 2026년 5월 10일"}
        </p>

        {/* Language Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-[#1a1a1a] rounded-full p-1 border border-border/30">
            <button
              onClick={() => setLanguage("en")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                language === "en" ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              style={language === "en" ? { backgroundColor: "#FF4B6E" } : {}}
            >
              English
            </button>
            <button
              onClick={() => setLanguage("ko")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                language === "ko" ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              style={language === "ko" ? { backgroundColor: "#FF4B6E" } : {}}
            >
              한국어
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {language === "en" ? (
            <>
              <Section title="1. What are cookies?">
                <p>
                  Cookies are small text files stored on your device when you visit a website.
                  They help the site remember your preferences, keep you signed in, and measure
                  how the service is used.
                </p>
              </Section>

              <Section title="2. How we use cookies">
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong className="text-foreground">Essential</strong> — authentication session, CSRF protection. Required to use UnfoldK.</li>
                  <li><strong className="text-foreground">Preferences</strong> — language toggle, dark mode, cookie consent state.</li>
                  <li><strong className="text-foreground">Analytics</strong> — Vercel Analytics for anonymous usage statistics.</li>
                </ul>
              </Section>

              <Section title="3. Third-party cookies">
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Supabase Auth — sign-in session.</li>
                  <li>Google OAuth — sign-in via Google.</li>
                  <li>Lemon Squeezy — checkout and subscription management.</li>
                </ul>
              </Section>

              <Section title="4. Managing cookies">
                <p>
                  You can clear or block cookies in your browser settings. Note that disabling
                  essential cookies will prevent sign-in and most service features from working.
                </p>
              </Section>

              <Section title="5. Contact">
                <p>
                  Questions about this Cookie Policy? Email{" "}
                  <a href="mailto:support@unfoldk.com" className="hover:underline" style={{ color: "#FF4B6E" }}>
                    support@unfoldk.com
                  </a>.
                </p>
              </Section>
            </>
          ) : (
            <>
              <Section title="1. 쿠키란?">
                <p>
                  쿠키는 웹사이트 방문 시 사용자 기기에 저장되는 작은 텍스트 파일입니다.
                  사이트가 사용자 환경설정을 기억하고 로그인 상태를 유지하며 이용 통계를
                  측정하는 데 사용됩니다.
                </p>
              </Section>

              <Section title="2. 쿠키 사용 목적">
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong className="text-foreground">필수</strong> — 로그인 세션, CSRF 보호. UnfoldK 이용에 필수.</li>
                  <li><strong className="text-foreground">환경설정</strong> — 언어 토글, 다크모드, 쿠키 동의 상태.</li>
                  <li><strong className="text-foreground">분석</strong> — Vercel Analytics 익명 사용 통계.</li>
                </ul>
              </Section>

              <Section title="3. 제3자 쿠키">
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Supabase Auth — 로그인 세션</li>
                  <li>Google OAuth — Google 로그인</li>
                  <li>Lemon Squeezy — 결제·구독 관리</li>
                </ul>
              </Section>

              <Section title="4. 쿠키 관리">
                <p>
                  브라우저 설정에서 쿠키를 삭제하거나 차단할 수 있습니다. 필수 쿠키를 차단하면
                  로그인 및 대부분의 서비스 기능을 이용할 수 없습니다.
                </p>
              </Section>

              <Section title="5. 문의">
                <p>
                  본 정책 관련 문의:{" "}
                  <a href="mailto:support@unfoldk.com" className="hover:underline" style={{ color: "#FF4B6E" }}>
                    support@unfoldk.com
                  </a>
                </p>
              </Section>
            </>
          )}
        </div>
      </main>

      <FooterSection />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="text-muted-foreground leading-relaxed">{children}</div>
    </div>
  )
}
