"use client"

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
  index?: number
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

const CLAMP_NO_IMAGE: Record<number, string> = {
  0: "line-clamp-3",
  1: "line-clamp-5",
  2: "line-clamp-4",
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function parseSummaryPreview(raw: string | null): string | null {
  if (!raw) return null
  try { return (JSON.parse(raw) as { p1?: string }).p1 ?? null } catch { return null }
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
}

export function NewsCard({ id, title, published_at, category, summary, image_url, thumbnail_url, index = 0 }: NewsCardProps) {
  const preview = parseSummaryPreview(summary)
  const coverUrl = image_url || thumbnail_url
  const clampClass = coverUrl ? "line-clamp-2" : (CLAMP_NO_IMAGE[index % 3] ?? "line-clamp-3")

  return (
    <Link
      href={`/hallyu-feed/${id}`}
      className="group block bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden hover:border-[#FF4B6E]/40 transition-all hover:shadow-[0_0_0_1px_rgba(255,75,110,0.15)]"
    >
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={title}
          className="w-full aspect-video object-cover"
        />
      )}
      <div className="p-5 flex flex-col gap-3">
        {/* 배지 영역 */}
        {category && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${CATEGORY_BADGE[category] ?? CATEGORY_BADGE.general}`}>
              {CATEGORY_LABEL[category] ?? category}
            </span>
          </div>
        )}

        {/* 제목 */}
        <p className="text-foreground text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#FF4B6E] transition-colors">
          {decodeHtml(title)}
        </p>

        {/* 요약 미리보기 */}
        {preview && (
          <p className={`text-muted-foreground text-xs leading-relaxed ${clampClass}`}>
            {decodeHtml(preview)}
          </p>
        )}

        {/* 하단: Curated by + 날짜 */}
        <div className="flex items-center justify-between pt-1 border-t border-border/20">
          <span className="text-xs text-gray-500">Curated by UnfoldK</span>
          <span className="text-xs text-muted-foreground">{formatDate(published_at)}</span>
        </div>
      </div>
    </Link>
  )
}
