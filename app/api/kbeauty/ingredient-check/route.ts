import { NextResponse } from "next/server"
import fdaData from "@/lib/fda-prohibited-ingredients.json"

interface IngredientItem {
  name: string
  cas_number: string
  reason: string
  restriction_detail: string
}

export interface FlaggedEntry {
  input: string
  matched: string
  reason: string
  restriction_detail: string
  severity: "prohibited" | "restricted"
}

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[-\s()]/g, "")
}

function matchIngredient(
  ingredient: string,
  list: IngredientItem[],
  severity: "prohibited" | "restricted"
): FlaggedEntry | null {
  const norm = normalizeStr(ingredient)
  if (norm.length < 3) return null

  for (const item of list) {
    const itemNorm = normalizeStr(item.name)
    // 양방향 포함 검사 (단, 너무 짧은 매칭어 제외)
    if (itemNorm.length >= 3 && (norm.includes(itemNorm) || itemNorm.includes(norm))) {
      return {
        input: ingredient,
        matched: item.name,
        reason: item.reason,
        restriction_detail: item.restriction_detail,
        severity,
      }
    }
  }
  return null
}

export async function POST(req: Request) {
  let body: { ingredients?: unknown }
  try {
    body = await req.json() as { ingredients?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const raw = body.ingredients
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "ingredients array required" }, { status: 400 })
  }

  const ingredients = (raw as unknown[])
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)

  if (ingredients.length === 0) {
    return NextResponse.json({ error: "No valid ingredients provided" }, { status: 400 })
  }

  const flagged: FlaggedEntry[] = []
  const safe: string[] = []

  for (const ingredient of ingredients) {
    // prohibited 먼저 체크
    const prohibHit = matchIngredient(ingredient, fdaData.prohibited, "prohibited")
    if (prohibHit) {
      flagged.push(prohibHit)
      continue
    }
    // restricted 체크
    const restrictHit = matchIngredient(ingredient, fdaData.restricted, "restricted")
    if (restrictHit) {
      flagged.push(restrictHit)
      continue
    }
    safe.push(ingredient)
  }

  const prohibitedCount = flagged.filter((f) => f.severity === "prohibited").length
  const restrictedCount = flagged.filter((f) => f.severity === "restricted").length
  const score = Math.max(0, Math.min(100, 100 - prohibitedCount * 30 - restrictedCount * 15))

  return NextResponse.json({
    flagged,
    safe,
    compliance_score: score,
    total_checked: ingredients.length,
  })
}
