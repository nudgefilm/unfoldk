"use client"

// /mypage/artists — 내가 트래킹한 K-Pop 아티스트 목록
// 데이터: /api/mypage/artists (user_calendar_subscriptions 기반 distinct 아티스트)
// 카드 클릭 → /kpop/[id] 아티스트 상세 페이지

import { useEffect, useState } from "react"
import Link from "next/link"
import { Music, ChevronRight } from "lucide-react"
import { MypageShell } from "@/components/mypage/mypage-shell"
import { Toaster } from "@/components/ui/sonner"

interface ArtistItem {
  id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  member_count: number | null
}

export default function MyArtistsPage() {
  return (
    <MypageShell activeLabel="My Artists">
      <MyArtistsBody />
      <Toaster />
    </MypageShell>
  )
}

function MyArtistsBody() {
  const [items, setItems] = useState<ArtistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/mypage/artists", { cache: "no-store" })
      .then(async (res) => {
        const json = res.ok ? (await res.json().catch(() => ({}))) as { artists?: ArtistItem[] } : {}
        if (!cancelled) setItems(json.artists ?? [])
      })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">My Artists</h1>
          <p className="text-muted-foreground text-sm">
            K-pop artists you&apos;re tracking via HallyuCalendar reminders.
          </p>
        </div>
        <Link
          href="/kpop"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-4 h-10 rounded-full text-white whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          Browse KpopStats
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
          {items.map((artist) => (
            <Link
              key={artist.id}
              href={`/kpop/${artist.id}`}
              className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors cursor-pointer block"
            >
              <div className="aspect-square bg-[#252525] flex items-center justify-center overflow-hidden">
                {artist.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={artist.thumbnail_url}
                    alt={artist.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-foreground leading-tight">{artist.name}</p>
                {artist.name_ko && (
                  <p className="text-xs text-muted-foreground mt-0.5">{artist.name_ko}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {artist.member_count === 1 ? "Solo" : artist.member_count ? "Group" : "K-pop"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="sm:hidden mt-8">
        <Link
          href="/kpop"
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 h-10 rounded-full text-white"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          Browse KpopStats
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-12 text-center">
      <Music className="w-10 h-10 mx-auto mb-3" style={{ color: "#FF4B6E" }} />
      <p className="text-foreground font-medium mb-1">No artists tracked yet</p>
      <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
        Track a K-pop artist from their profile page to see them here.
      </p>
      <Link
        href="/kpop"
        className="inline-flex items-center gap-1.5 text-sm font-medium px-5 h-10 rounded-full text-white"
        style={{ backgroundColor: "#FF4B6E" }}
      >
        Browse KpopStats
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
