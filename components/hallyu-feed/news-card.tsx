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

// index % 5 기준 카드 높이 분기
const CARD_VARIANTS: Record<number, { title: string; body: string }> = {
  0: { title: "line-clamp-3", body: "line-clamp-6" },  // 큰 카드
  1: { title: "line-clamp-2", body: "line-clamp-3" },  // 작은 카드
  2: { title: "line-clamp-3", body: "line-clamp-8" },  // 가장 큰 카드
  3: { title: "line-clamp-2", body: "line-clamp-4" },  // 중간 카드
  4: { title: "line-clamp-1", body: "line-clamp-2" },  // 가장 작은 카드
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
  const variant = CARD_VARIANTS[index % 5] ?? CARD_VARIANTS[0]

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
      <div className="p-4 flex flex-col gap-3">
        {/* 카테고리 배지 */}
        {category && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${CATEGORY_BADGE[category] ?? CATEGORY_BADGE.general}`}>
              {CATEGORY_LABEL[category] ?? category}
            </span>
          </div>
        )}

        {/* 제목 */}
        <p className={`text-foreground text-sm font-semibold leading-snug ${variant.title} group-hover:text-[#FF4B6E] transition-colors`}>
          {decodeHtml(title)}
        </p>

        {/* 본문 미리보기 */}
        {preview && (
          <p className={`text-muted-foreground text-xs leading-relaxed ${variant.body}`}>
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
