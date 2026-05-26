"use client"

// /careers — Coming Soon
// 채용 공고 페이지. 현재 정식 채용은 진행 중이지 않으나 관심자 연락은 받음.

import Link from "next/link"
import { FooterSection } from "@/components/footer-section"
import { Briefcase } from "lucide-react"

export default function CareersPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 max-w-[680px] mx-auto px-5 py-24 md:py-32 w-full text-center">
        <div className="flex justify-center mb-6">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(255, 75, 110, 0.12)" }}
          >
            <Briefcase className="w-10 h-10" style={{ color: "#FF4B6E" }} />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Careers</h1>
        <p className="text-foreground/80 text-lg mb-3">Coming soon.</p>
        <p className="text-muted-foreground text-sm max-w-md mx-auto mb-10 leading-relaxed">
          We&apos;re a small team building the global home for Korean culture. We don&apos;t have
          open roles right now, but we love hearing from people who want to help shape what comes
          next.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/contact"
            className="inline-block px-6 py-3 rounded-full font-medium text-white text-sm"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            Introduce yourself
          </a>
          <Link
            href="/about"
            className="inline-block px-6 py-3 rounded-full font-medium text-sm border border-border/30 text-foreground hover:bg-[#1a1a1a]"
          >
            About UnfoldK
          </Link>
        </div>
      </main>

      <FooterSection />
    </div>
  )
}
