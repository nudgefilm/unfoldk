"use client"

import { useState } from "react"
import Link from "next/link"

export interface NewsCardProps {
  id: string
  source: string
  title: string
  image_url: string | null
  thumbnail_url: string | null
  published_at: string | null
  category: string | null
  summary: string | null
  sources: string[] | null
  content_type: string | null
}

const CATEGORY_BADGE: Record<string, string> = {
  kpop:    "bg-purple-500/20 text-purple-300",
  kdrama:  "bg-blue-500/20 text-blue-300",
  kbeauty: "bg-pink-500/20 text-pink-300",
  general: "bg-zinc-500/20 text-zinc-300",
}
const CATEGORY_LABEL: Record<string, string> = {
  kpop: "K-Pop", kdrama: "K-Drama", kbeauty: "K-Beauty", general: "General",
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function parseSummaryPreview(raw: string | null): string | null {
  if (!raw) return null
  try { return (JSON.parse(raw) as { p1?: string }).p1 ?? null } catch { return null }
}

export function NewsCard({
  id, source, title, image_url, thumbnail_url,
  published_at, category, summary, sources, content_type,
}: NewsCardProps) {
  const [imgError, setImgError] = useState(false)
  const heroImage = (!imgError && (image_url ?? thumbnail_url)) || null
  const preview = parseSummaryPreview(summary)
  const isGenerated = content_type === "generated"
  const sourceDisplay =
    sources?.[0]?.split(" · ")[0] ??
    (source.charAt(0).toUpperCase() + source.slice(1))

  return (
    <Link
      href={`/hallyu-feed/${id}`}
      className="group block bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden hover:border-[#FF4B6E]/40 transition-all hover:shadow-[0_0_0_1px_rgba(255,75,110,0.15)]"
    >
      {/* 이미지 (있을 때만) */}
      {heroImage && (
        <div className="overflow-hidden bg-[#141418]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt={title}
            className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
            style={{ maxHeight: "208px" }}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div className="p-4 flex flex-col gap-2">
        {/* 배지 영역 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {category && (
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${CATEGORY_BADGE[category] ?? CATEGORY_BADGE.general}`}>
              {CATEGORY_LABEL[category] ?? category}
            </span>
          )}
          {isGenerated && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#FF4B6E" }}>
              Curated by UnfoldK
            </span>
          )}
        </div>

        {/* 제목 */}
        <p className="text-foreground text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#FF4B6E] transition-colors">
          {title}
        </p>

        {/* 요약 미리보기 */}
        {preview && (
          <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">
            {preview}
          </p>
        )}

        {/* 출처 + 날짜 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1 pt-2 border-t border-border/20">
          <span className="font-medium">{sourceDisplay}</span>
          <span>{formatDate(published_at)}</span>
        </div>
      </div>
    </Link>
  )
}
