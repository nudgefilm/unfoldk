"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, Check, TrendingUp, ShieldCheck, FileCheck2, Globe2 } from "lucide-react"
import { cn } from "@/lib/utils"

type SegmentKey = "suppliers" | "buyers" | "sellers"

const SEGMENTS: Record<
  SegmentKey,
  { label: string; accent: string; stats: { value: string; label: string; sub: string }[] }
> = {
  suppliers: {
    label: "Korean Suppliers",
    accent: "#1A3A5C",
    stats: [
      { value: "520+", label: "Active Manufacturers\n활성 제조사", sub: "Synced live with MFDS registry API\n식약처 API 실시간 연동" },
      { value: "12,400+", label: "SKUs Registered\n등록 품목 수", sub: "Total cosmetic products listed\n총 화장품 품목 수" },
      { value: "74%", label: "MoCRA Compliant\nFDA 서류 제출", sub: "Suppliers with FDA filings submitted\nMoCRA 서류 제출 공급사 비율" },
    ],
  },
  buyers: {
    label: "Global Buyers",
    accent: "#8B6F47",
    stats: [
      { value: "2,150+", label: "Verified Importers\n검증된 수입사", sub: "US importers tracked via customs data\n글로벌 무역 데이터 기반 북미 수입사" },
      { value: "$42M+", label: "Total Import Volume\n총 수입 규모", sub: "Tracked over last 12 months\n최근 12개월 통관 추적 규모" },
      { value: "3304.99", label: "Top HS Code\n최다 수입 코드", sub: "Skincare — #1 import frequency\n스킨케어 · 수입 빈도 1위" },
    ],
  },
  sellers: {
    label: "Global Sellers",
    accent: "#B07D62",
    stats: [
      { value: "1,280+", label: "E-commerce Stores\n온라인 스토어", sub: "Mapped across major platforms\nAmazon · Shopify · TikTok 매핑" },
      { value: "TikTok Shop", label: "Top Channel\n최상위 채널", sub: "Most active K-beauty sourcing channel\n가장 활발한 소싱 채널" },
      { value: "+54%", label: "Rising: Rice Extract\n급상승 성분", sub: "#1 trending ingredient this week\n이번 주 가속도 1위 성분" },
    ],
  },
}

function Lines({ text }: { text: string }) {
  const parts = text.split("\n")
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {part}
        </span>
      ))}
    </>
  )
}

export default function HeroSection() {
  const [segment, setSegment] = useState<SegmentKey>("suppliers")
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const active = SEGMENTS[segment]

  return (
    <section className="relative overflow-hidden bg-white px-6 pt-16 pb-20 md:pt-20 md:pb-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 78% 18%, rgba(200,168,130,0.18) 0%, rgba(200,168,130,0) 70%), radial-gradient(50% 40% at 12% 90%, rgba(26,58,92,0.06) 0%, rgba(26,58,92,0) 70%)",
        }}
      />

      <div className="max-w-[1080px] mx-auto w-full text-center">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E8E2DA] bg-[#F8F7F5] px-3 py-1.5 text-xs tracking-[0.12em] text-[#8B6F47] font-medium mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C8A882]" />
            B2B K-BEAUTY PLATFORM
          </span>

          <h1 className="font-serif font-bold text-4xl md:text-5xl lg:text-[60px] text-[#0F0F0F] leading-[1.08] mb-6 text-balance mx-auto max-w-3xl">
            Connect with Verified
            <br />
            Korean Beauty Suppliers.
          </h1>

          <div className="mb-10 mx-auto max-w-xl">
            <p className="text-base md:text-lg text-[#0F0F0F] leading-relaxed">
              글로벌 무역 데이터 및 선적 서류 분석 데이터 기반 바이어 2,000개사.
            </p>
            <p className="text-base md:text-lg text-[#6B6B6B] leading-relaxed mt-1">
              500+ FDA-registered Korean manufacturers, ready to trade.
            </p>
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-8">
            <span className="text-sm md:text-[15px] text-[#6B6B6B]">
              Explore UnfoldK&apos;s Live Beauty Trade Network:
            </span>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="inline-flex items-center gap-2 rounded-lg border border-[#1A3A5C]/25 bg-white px-4 py-2.5 text-sm font-semibold text-[#1A3A5C] shadow-sm hover:border-[#1A3A5C]/50 transition-colors"
              >
                <span className="h-2 w-2 rounded-full bg-[#3FBF7F] animate-pulse" />
                {active.label}
                <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <ul
                  role="listbox"
                  className="absolute left-1/2 -translate-x-1/2 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-[#E8E2DA] bg-white py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.14)] animate-in fade-in slide-in-from-top-1 duration-150"
                >
                  {(Object.keys(SEGMENTS) as SegmentKey[]).map((key) => (
                    <li key={key} role="option" aria-selected={segment === key}>
                      <button
                        type="button"
                        onClick={() => { setSegment(key); setOpen(false) }}
                        className={cn(
                          "flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors",
                          segment === key
                            ? "bg-[#F8F7F5] text-[#1A3A5C] font-semibold"
                            : "text-[#6B6B6B] hover:bg-[#F8F7F5]",
                        )}
                      >
                        {SEGMENTS[key].label}
                        {segment === key && <Check className="w-4 h-4 text-[#1A3A5C]" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div
            key={segment}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-3 duration-500"
          >
            {active.stats.map((stat, i) => (
              <div
                key={`${segment}-${i}`}
                className="rounded-2xl border border-[#E8E2DA] bg-white p-5 text-left shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
              >
                <div className="flex items-center gap-1.5 mb-3">
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: active.accent }} />
                  <span className="text-[10px] uppercase tracking-wider text-[#9A958C] font-medium">
                    Live Index
                  </span>
                </div>
                <div className="font-serif text-3xl md:text-[34px] leading-none mb-2" style={{ color: active.accent }}>
                  {stat.value}
                </div>
                <div className="text-sm font-semibold text-[#0F0F0F] leading-snug">
                  <Lines text={stat.label} />
                </div>
                <div className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
                  <Lines text={stat.sub} />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-10">
            <div className="flex items-center gap-2 text-sm text-[#6B6B6B]">
              <ShieldCheck className="w-4 h-4 text-[#C8A882]" />
              2,000+ verified buyers
            </div>
            <div className="flex items-center gap-2 text-sm text-[#6B6B6B]">
              <FileCheck2 className="w-4 h-4 text-[#C8A882]" />
              500+ FDA-registered suppliers
            </div>
            <div className="flex items-center gap-2 text-sm text-[#6B6B6B]">
              <Globe2 className="w-4 h-4 text-[#C8A882]" />
              North America focused
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
