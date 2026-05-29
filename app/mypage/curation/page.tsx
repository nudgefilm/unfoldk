"use client"

// /mypage/curation — Curation K 에서 저장한 촬영지·장소 목록
// 데이터: /api/curation-k/collections (user_curation_collections)
// 카드 클릭 → /curation-k (장소 재탐색)
// Saved Recipes 페이지 동일 패턴.

import { useEffect, useState } from "react"
import Link from "next/link"
import { MapPin, ChevronRight } from "lucide-react"
import { MypageShell } from "@/components/mypage/mypage-shell"

interface CurationItem {
  collection_id: string
  item_type: "filming" | "tour"
  item_id: string
  created_at: string
  title: string
  image_url: string | null
  badge: string | null
  address: string | null
  region: string | null
}

export default function MyCurationPage() {
  return (
    <MypageShell activeLabel="My Curation">
      <MyCurationBody />
    </MypageShell>
  )
}

function MyCurationBody() {
  const [items, setItems] = useState<CurationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/curation-k/collections", { cache: "no-store" })
      .then(async (res) => {
        const json = res.ok
          ? (await res.json().catch(() => ({}))) as { items?: CurationItem[] }
          : {}
        if (!cancelled) setItems(json.items ?? [])
      })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">My Curation</h1>
          <p className="text-muted-foreground text-sm">
            Filming spots and places you saved from Curation K.
          </p>
        </div>
        <Link
          href="/curation-k"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-4 h-10 rounded-full text-white whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          Browse Curation K
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
          Loading...
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <Link
              key={item.collection_id}
              href="/curation-k"
              className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors block"
            >
              <div className="aspect-[4/3] bg-[#252525] relative flex items-center justify-center">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <MapPin className="w-8 h-8 text-muted-foreground" />
                )}
                {item.badge && (
                  <span
                    className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.85)" }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
                  {item.title}
                </p>
                {(item.region || item.address) && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {item.region ?? item.address}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="sm:hidden mt-8">
        <Link
          href="/curation-k"
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 h-10 rounded-full text-white"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          Browse Curation K
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-12 text-center">
      <MapPin className="w-10 h-10 mx-auto mb-3" style={{ color: "#FF4B6E" }} />
      <p className="text-foreground font-medium mb-1">No saved places yet</p>
      <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
        Save filming spots and places from Curation K to find them here.
      </p>
      <Link
        href="/curation-k"
        className="inline-flex items-center gap-1.5 text-sm font-medium px-5 h-10 rounded-full text-white"
        style={{ backgroundColor: "#FF4B6E" }}
      >
        Browse Curation K
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
