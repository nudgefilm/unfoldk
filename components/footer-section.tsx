"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import twemoji from "twemoji"
import { CookieConsentBanner, COOKIE_CONSENT_KEY } from "./cookie-consent-banner"

// ISO 3166-1 alpha-2 (예 "US") → 국기 이모지 문자. Regional Indicator Symbol 변환.
const toFlag = (code: string) =>
  code.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0))
  )

// Twemoji CDN <img> 렌더링 — Windows 국기 이모지 미지원 대응
function TwemojiFlag({ code, title }: { code: string; title?: string }) {
  const emoji = toFlag(code)
  const html = (twemoji as unknown as { parse: (text: string, opts: Record<string, string>) => string }).parse(emoji, { folder: "svg", ext: ".svg" })
  const src = html.match(/src="([^"]+)"/)?.[1] ?? ""
  if (!src) return <span className="text-xl leading-none">{emoji}</span>
  return (
    <img
      src={src}
      alt={code}
      title={title}
      width={20}
      height={20}
      className="inline-block align-middle"
      draggable={false}
    />
  )
}

interface StatsResponse {
  total_members: number
  total_countries: number
  top_countries: Array<{ country: string; count: number }>
}

// 마퀴 트랙 — distinct country 1개씩 + translateX(-50%) seamless 루프.
// source 는 API 에서 이미 distinct 이지만 안전하게 country 코드 기준 중복 제거 후 2배 복제.
function buildMarqueeItems(
  source: Array<{ country: string; count: number }>
): Array<{ country: string; count: number }> {
  if (source.length === 0) return []
  const seen = new Set<string>()
  const unique = source.filter((c) => {
    if (seen.has(c.country)) return false
    seen.add(c.country)
    return true
  })
  return [...unique, ...unique]
}

export function FooterSection() {
  const footerRef = useRef<HTMLElement>(null)
  const [bannerOpen, setBannerOpen] = useState(false)
  const [stats, setStats] = useState<StatsResponse | null>(null)

  // /api/stats — mount 시 1회 fetch. 실패해도 푸터 본체 노출엔 영향 없음.
  useEffect(() => {
    let cancelled = false
    fetch("/api/stats")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: StatsResponse) => {
        if (!cancelled) setStats(body)
      })
      .catch((err) => console.warn("[footer] stats fetch 실패:", err))
    return () => {
      cancelled = true
    }
  }, [])

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
            <a
              href="https://discord.gg/EcQr36AqtC"
              aria-label="Discord"
              target="_blank"
              rel="noopener noreferrer"
              className="w-4 h-4 flex items-center justify-center"
            >
              <svg className="w-full h-full text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
            <a
              href="https://x.com/unfoldkorea"
              aria-label="X (Twitter)"
              target="_blank"
              rel="noopener noreferrer"
              className="w-4 h-4 flex items-center justify-center"
            >
              <svg className="w-full h-full text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
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
              <Link href="/curation-k" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Curation K
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
              <Link href="/refund" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Refund Policy
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
            href="/contact"
            className="hover:underline"
          >
            support@unfoldk.com
          </a>
        </p>

        {/* 라인 1 — 국가·멤버 카운트. 로딩 중 skeleton. */}
        {stats ? (
          <p className="text-muted-foreground/80 text-xs mt-3 text-center md:text-left">
            Fans from {stats.total_countries.toLocaleString()} countries ·{" "}
            {stats.total_members.toLocaleString()} members
          </p>
        ) : (
          <div
            aria-hidden="true"
            className="mt-3 h-3.5 w-56 bg-muted/20 rounded animate-pulse mx-auto md:mx-0"
          />
        )}

        {/* 라인 2 — 국기. unique 1개면 정적 표시, 2개 이상이면 마퀴 애니메이션.
            top_countries 에 중복 country 코드가 올 수 있으므로 raw length 가 아닌
            dedup 후 개수로 분기. */}
        {stats && stats.top_countries.length > 0 && (() => {
          const seen = new Set<string>()
          const unique = stats.top_countries.filter((c) => {
            if (seen.has(c.country)) return false
            seen.add(c.country)
            return true
          })
          if (unique.length <= 10) {
            return (
              <div aria-hidden="true" className="mt-3 flex flex-wrap gap-1.5">
                {unique.map((c) => (
                  <TwemojiFlag
                    key={c.country}
                    code={c.country}
                    title={`${c.country} · ${c.count.toLocaleString()}`}
                  />
                ))}
              </div>
            )
          }
          return (
            <div aria-hidden="true" className="mt-3 overflow-hidden uf-marquee-wrap">
              <div className="uf-marquee-track">
                {[...unique, ...unique].map((c, i) => (
                  <span key={`${c.country}-${i}`} className="inline-block mx-1.5">
                    <TwemojiFlag
                      code={c.country}
                      title={`${c.country} · ${c.count.toLocaleString()}`}
                    />
                  </span>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {/* 마퀴 keyframes — 별도 CSS 파일 회피 위해 컴포넌트 인라인 */}
      <style>{`
        .uf-marquee-wrap { width: 100%; }
        .uf-marquee-track {
          display: inline-flex;
          width: max-content;
          animation: uf-marquee 40s linear infinite;
        }
        .uf-marquee-wrap:hover .uf-marquee-track {
          animation-play-state: paused;
        }
        @keyframes uf-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .uf-marquee-track { animation: none; }
        }
      `}</style>

      <CookieConsentBanner open={bannerOpen} onOpenChange={setBannerOpen} />
    </footer>
  )
}
