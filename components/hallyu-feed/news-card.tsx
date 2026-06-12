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

export function NewsCard({ id, title, published_at, category, summary }: NewsCardProps) {
  const preview = parseSummaryPreview(summary)

  return (
    <Link
      href={`/hallyu-feed/${id}`}
      className="group block bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden hover:border-[#FF4B6E]/40 transition-all hover:shadow-[0_0_0_1px_rgba(255,75,110,0.15)]"
    >
      <div className="p-5 flex flex-col gap-3">
        {/* 배지 영역 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {category && (
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${CATEGORY_BADGE[category] ?? CATEGORY_BADGE.general}`}>
              {CATEGORY_LABEL[category] ?? category}
            </span>
          )}
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#FF4B6E" }}>
            Curated by UnfoldK
          </span>
        </div>

        {/* 제목 */}
        <p className="text-foreground text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#FF4B6E] transition-colors">
          {decodeHtml(title)}
        </p>

        {/* 요약 미리보기 */}
        {preview && (
          <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">
            {decodeHtml(preview)}
          </p>
        )}

        {/* 날짜 */}
        <div className="flex items-center justify-end text-xs text-muted-foreground pt-1 border-t border-border/20">
          <span>{formatDate(published_at)}</span>
        </div>
      </div>
    </Link>
  )
}
