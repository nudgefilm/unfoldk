"use client"

import { useEffect, useRef, useState } from "react"
import { Twitter, Instagram } from "lucide-react"
import Link from "next/link"
import { CookieConsentBanner, COOKIE_CONSENT_KEY } from "./cookie-consent-banner"

export function FooterSection() {
  const footerRef = useRef<HTMLElement>(null)
  const [bannerOpen, setBannerOpen] = useState(false)

  // 쿠키 동의 배너 — 푸터가 viewport 에 들어올 때 1회만 트리거.
  // 이미 동의했으면 IO 자체를 걸지 않음 (불필요한 리스너 제거).
  useEffect(() => {
    let consented = false
    try {
      consented = localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted"
    } catch {
      // localStorage 비활성 — 안전하게 매번 노출
    }
    if (consented) return

    const target = footerRef.current
    if (!target) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setBannerOpen(true)
            io.disconnect() // 1회 트리거 후 즉시 해제
            break
          }
        }
      },
      { threshold: 0.1 }
    )
    io.observe(target)
    return () => io.disconnect()
  }, [])

  return (
    <footer
      ref={footerRef}
      className="w-full max-w-[1320px] mx-auto px-5 flex flex-col py-10 md:py-[70px]"
    >
      <div className="flex flex-col md:flex-row justify-between items-start gap-8 md:gap-0">
        {/* Left Section: Logo, Description, Social Links */}
        <div className="flex flex-col justify-start items-start gap-8 p-4 md:p-8">
          <Link href="/" className="flex gap-3 items-stretch justify-center">
            <div className="text-center text-foreground text-xl font-semibold leading-4">UnfoldK</div>
          </Link>
          <p className="text-foreground/90 text-sm font-medium leading-[18px] text-left">Your Pass to Korean Culture</p>
          <div className="flex justify-start items-start gap-3">
            <a href="#" aria-label="Twitter/X" className="w-4 h-4 flex items-center justify-center">
              <Twitter className="w-full h-full text-muted-foreground" />
            </a>
            <a href="#" aria-label="Instagram" className="w-4 h-4 flex items-center justify-center">
              <Instagram className="w-full h-full text-muted-foreground" />
            </a>
            <a href="#" aria-label="TikTok" className="w-4 h-4 flex items-center justify-center">
              <svg className="w-full h-full text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
              </svg>
            </a>
          </div>
          {/* 결제 처리자 / TMDB 라이선스 표기 — 소셜 아이콘 아래 2줄 배치 */}
          <div className="flex flex-col gap-1 text-muted-foreground/70 text-xs leading-relaxed">
            <p>Payments processed by Lemon Squeezy.</p>
            <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          </div>
        </div>
        {/* Right Section: Services, Company, Legal */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 p-4 md:p-8 w-full md:w-auto">
          <div className="flex flex-col justify-start items-start gap-3">
            <h3 className="text-muted-foreground text-sm font-medium leading-5">Services</h3>
            <div className="flex flex-col justify-end items-start gap-2">
              <Link href="/calendar" className="text-foreground text-sm font-normal leading-5 hover:underline">
                HallyuCalendar
              </Link>
              <Link href="/kpop" className="text-foreground text-sm font-normal leading-5 hover:underline">
                KpopStats
              </Link>
              <Link href="/drama" className="text-foreground text-sm font-normal leading-5 hover:underline">
                KdramaMatch
              </Link>
              <Link href="/korean" className="text-foreground text-sm font-normal leading-5 hover:underline">
                HangeulGo
              </Link>
              <Link href="/food" className="text-foreground text-sm font-normal leading-5 hover:underline">
                KfoodKit
              </Link>
            </div>
          </div>
          <div className="flex flex-col justify-start items-start gap-3">
            <h3 className="text-muted-foreground text-sm font-medium leading-5">Company</h3>
            <div className="flex flex-col justify-center items-start gap-2">
              <Link href="/about" className="text-foreground text-sm font-normal leading-5 hover:underline">
                About
              </Link>
              <Link href="/blog" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Blog
              </Link>
              <Link href="/careers" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Careers
              </Link>
              <Link href="/contact" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Contact
              </Link>
            </div>
          </div>
          <div className="flex flex-col justify-start items-start gap-3">
            <h3 className="text-muted-foreground text-sm font-medium leading-5">Legal</h3>
            <div className="flex flex-col justify-center items-start gap-2">
              <Link href="/privacy" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Terms of Use
              </Link>
              <Link href="/cookie" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Cookie Policy
              </Link>
              <Link href="/gdpr" className="text-foreground text-sm font-normal leading-5 hover:underline">
                GDPR
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* Bottom Line */}
      <div className="w-full border-t border-border mt-8 pt-6 px-4 md:px-8">
        <p className="text-muted-foreground text-sm text-center md:text-left">
          {/* © 문자만 어드민 진입점 — 일반 유저에게는 호버 외 표시 없음 */}
          <Link href="/admin" prefetch={false} className="hover:opacity-60 transition-opacity">©</Link>
          {" "}2026 UNFOLD LAB · unfoldk.com ·{" "}
          <a
            href="mailto:support@unfoldk.com"
            className="hover:underline"
          >
            support@unfoldk.com
          </a>
        </p>
      </div>

      <CookieConsentBanner open={bannerOpen} onOpenChange={setBannerOpen} />
    </footer>
  )
}
