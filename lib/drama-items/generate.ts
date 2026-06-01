import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// drama_items 자동 생성 공통 로직
// 스크립트(scripts/generate-drama-items.ts)와 Cron 양쪽에서 재사용.

export type DramaItemCategory = "fashion" | "beauty" | "lifestyle"

export interface DramaItemInsert {
  drama_id: string
  name: string
  name_ko: string | null
  category: DramaItemCategory
  brand: string | null
  description: string | null
  description_ko: string | null
  purchase_url: null
  is_approved: false
}

interface ExtractedItem {
  name: string
  name_ko: string | null
  category: DramaItemCategory
  brand: string | null
  description: string | null
  description_ko: string | null
}

export interface GenerateItemsResult {
  drama_id: string
  title: string
  generated: number
  skipped: boolean  // 이미 아이템이 있는 드라마
  error?: string
}

const client = new Anthropic()

// Claude Haiku로 드라마 아이템 3~5개 추출
export async function extractDramaItems(drama: {
  id: string
  title: string
  overview: string | null
  genre: string | null
}): Promise<DramaItemInsert[]> {
  const genreText = drama.genre || "Korean drama"
  const overviewText = drama.overview?.slice(0, 500) || "No overview available."

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: "You extract K-drama related fashion/beauty/lifestyle items. Return valid JSON array only, no markdown.",
    messages: [
      {
        role: "user",
        content: `You are a K-drama fashion and lifestyle curator.

Drama: "${drama.title}"
Genre: ${genreText}
Overview: ${overviewText}

Extract 3 to 5 iconic fashion, beauty, or lifestyle items strongly associated with this drama's aesthetic, characters, or memorable scenes. Focus on items fans would actually want to buy.

Return a JSON array with this exact structure (include both English and Korean for name and description):
[
  {
    "name": "item name in English (specific, not generic)",
    "name_ko": "아이템명 한국어",
    "category": "fashion" | "beauty" | "lifestyle",
    "brand": "brand name if identifiable, otherwise null",
    "description": "1-2 sentences in English why fans love this item from the drama",
    "description_ko": "팬들이 이 아이템을 좋아하는 이유 1-2문장 한국어"
  }
]`,
      },
    ],
  })

  const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : ""
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`JSON 파싱 실패: ${text.slice(0, 100)}`)

  const parsed = JSON.parse(match[0]) as unknown[]
  const items: DramaItemInsert[] = []

  for (const raw of parsed) {
    if (typeof raw !== "object" || raw === null) continue
    const item = raw as Record<string, unknown>
    const cat = item.category as string
    if (!["fashion", "beauty", "lifestyle"].includes(cat)) continue
    items.push({
      drama_id: drama.id,
      name: String(item.name ?? "").slice(0, 200),
      name_ko: item.name_ko ? String(item.name_ko).slice(0, 200) : null,
      category: cat as DramaItemCategory,
      brand: item.brand ? String(item.brand).slice(0, 100) : null,
      description: item.description ? String(item.description).slice(0, 500) : null,
      description_ko: item.description_ko ? String(item.description_ko).slice(0, 500) : null,
      purchase_url: null,
      is_approved: false,
    })
  }

  return items.slice(0, 5)
}

// 주어진 drama_id 목록을 처리 — 이미 아이템 있는 드라마 스킵, 나머지 생성 후 저장
export async function generateItemsForDramas(
  dramas: Array<{ id: string; title: string; overview: string | null; genre: string | null }>,
  opts: { dryRun?: boolean; delayMs?: number } = {}
): Promise<GenerateItemsResult[]> {
  const { dryRun = false, delayMs = 300 } = opts
  const supabase = createSupabaseAdminClient()

  // 이미 아이템이 있는 drama_id 조회
  const ids = dramas.map((d) => d.id)
  const { data: existing } = await supabase
    .from("drama_items")
    .select("drama_id")
    .in("drama_id", ids)

  const existingSet = new Set<string>(
    (existing ?? []).map((r: { drama_id: string }) => r.drama_id)
  )

  const results: GenerateItemsResult[] = []

  for (const drama of dramas) {
    if (existingSet.has(drama.id)) {
      results.push({ drama_id: drama.id, title: drama.title, generated: 0, skipped: true })
      continue
    }

    try {
      const items = await extractDramaItems(drama)
      if (!dryRun && items.length > 0) {
        const { error } = await supabase.from("drama_items").insert(items)
        if (error) throw new Error(error.message)
      }
      results.push({ drama_id: drama.id, title: drama.title, generated: items.length, skipped: false })
    } catch (err) {
      results.push({
        drama_id: drama.id,
        title: drama.title,
        generated: 0,
        skipped: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
  }

  return results
}
