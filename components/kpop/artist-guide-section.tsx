"use client"

// 아티스트 입문 가이드 — 최초 방문 시 온디맨드 생성, 이후 캐싱
// /api/kpop/artists/[id]/guide 가 DB 캐시 or Claude 생성 담당

import { useEffect, useState } from "react"

interface Song { title: string; description: string }

interface GuideData {
  intro: string
  songs: Song[]
}

export function ArtistGuideSection({
  artistId,
  artistName,
}: {
  artistId: string
  artistName: string
}) {
  const [guide, setGuide] = useState<GuideData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/kpop/artists/${artistId}/guide`)
      .then((r) => (r.ok ? r.json() : { guide: null }))
      .then((data: { guide?: GuideData | null }) => {
        if (!cancelled) setGuide(data.guide ?? null)
      })
      .catch(() => { if (!cancelled) setGuide(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [artistId])

  if (loading) {
    return (
      <section className="mt-8">
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 animate-pulse">
          <div className="h-5 bg-[#252525] rounded w-1/2 mb-4" />
          <div className="h-4 bg-[#252525] rounded w-full mb-2" />
          <div className="h-4 bg-[#252525] rounded w-3/4" />
        </div>
      </section>
    )
  }

  if (!guide) return null

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-white mb-4">
        New to {artistName}? Start here.
      </h2>
      <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6">
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">{guide.intro}</p>

        <h3 className="text-sm font-semibold text-foreground mb-3">Essential Tracks</h3>
        <div className="flex flex-col gap-3">
          {guide.songs.map((song, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="text-muted-foreground flex-shrink-0 w-5 text-right">{i + 1}.</span>
              <div>
                <span className="font-medium text-foreground">{song.title}</span>
                <span className="text-muted-foreground"> — {song.description}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-5 pt-4 border-t border-border/20">
          Curated by UnfoldK
        </p>
      </div>
    </section>
  )
}
