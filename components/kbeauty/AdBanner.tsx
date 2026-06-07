"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// 슬롯별 빈 상태 높이 (광고 없을 때)
const SLOT_EMPTY_HEIGHT: Record<string, string> = {
  featured_supplier: "h-32",
  data_sources_banner: "h-20",
  dashboard_sidebar: "h-24",
  sourcing_sniper: "h-28",
}

interface Ad {
  id: string
  title: string
  description: string | null
  image_url: string | null
  link_url: string
}

interface Props {
  slotId: string
  className?: string
}

export function AdBanner({ slotId, className = "" }: Props) {
  const supabase = createSupabaseBrowserClient()
  const [ad, setAd] = useState<Ad | null>(null)
  const [loading, setLoading] = useState(true)
  const tracked = useRef(false)

  useEffect(() => {
    async function fetchAd() {
      const today = new Date().toISOString().split("T")[0]

      const { data } = await supabase
        .from("beauty_ads")
        .select("id, title, description, image_url, link_url")
        .eq("slot_id", slotId)
        .eq("status", "active")                         // status = 'active' 조건 필수
        .or(`end_date.is.null,end_date.gte.${today}`)
        .limit(10)

      if (data && data.length > 0) {
        const picked = (data as Ad[])[Math.floor(Math.random() * data.length)]
        setAd(picked)

        if (!tracked.current) {
          tracked.current = true
          fetch("/api/kbeauty/ads/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ad_id: picked.id, event: "impression" }),
          }).catch(() => undefined)
        }
      }
      setLoading(false)
    }
    fetchAd()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId])

  async function handleClick() {
    if (!ad) return
    fetch("/api/kbeauty/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad_id: ad.id, event: "click" }),
    }).catch(() => undefined)
    window.open(ad.link_url, "_blank", "noopener,noreferrer")
  }

  if (loading) return null

  if (!ad) {
    const emptyH = SLOT_EMPTY_HEIGHT[slotId] ?? "h-24"
    return (
      <div className={`relative flex items-center justify-between gap-3 rounded-xl border border-dashed border-[#C8A882]/40 bg-[#FDFBF8] px-5 ${emptyH} ${className}`}>
        <span className="absolute top-2 left-3 text-[9px] font-semibold tracking-widest text-[#C8A882]/70 uppercase px-1.5 py-0.5 rounded border border-[#C8A882]/30 bg-white/60">
          AD SLOT
        </span>
        <p className="text-sm text-[#9B8A74] mt-4">
          Advertise Here · Reach verified K-beauty partners
        </p>
        <Link
          href="/kbeauty/auth"
          className="flex-shrink-0 text-xs font-semibold text-[#C8A882] hover:text-[#8B6F47] transition-colors flex items-center gap-1 mt-4"
        >
          Apply &#8594;
        </Link>
      </div>
    )
  }

  return (
    <div
      onClick={handleClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      className={`relative rounded-xl border border-[#E8E2DA] bg-[#F8F7F5] overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${className}`}
      aria-label={`Sponsored: ${ad.title}`}
    >
      {/* Sponsored 배지 — 필수 표시 */}
      <span className="absolute top-2 right-2 z-10 text-[10px] font-semibold text-[#6B6B6B] bg-white/90 px-2 py-0.5 rounded-full border border-[#E8E2DA]">
        Sponsored
      </span>

      {ad.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.image_url}
          alt={ad.title}
          className="w-full h-28 object-cover"
        />
      )}

      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-[#0F0F0F] pr-16">{ad.title}</p>
        {ad.description && (
          <p className="text-xs text-[#6B6B6B] mt-0.5 line-clamp-2">{ad.description}</p>
        )}
      </div>
    </div>
  )
}
