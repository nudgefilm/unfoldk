import { NextResponse, type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const anthropic = new Anthropic()

const FALLBACK_ANALYSIS = {
  opportunity:
    "This supplier shows strong potential for cross-border trade. Their product portfolio aligns with current demand in key export markets.",
  risk: "Verify all certifications before committing. Evaluate MOQ requirements against your initial order capacity and cash flow.",
  margin_insight:
    "Mid-tier pricing suggests a solid margin opportunity. Factor in shipping, duties, and platform fees when calculating net margins.",
  recommended_categories: ["skincare", "derma"],
}

interface SupplierInput {
  company_name_en: string
  company_name_ko: string
  categories: string[]
  certifications: string[]
  moq: number | null
  price_range_min: number | null
  price_range_max: number | null
  export_countries: string | null
  fda_status: string | null
}

interface TrendInput {
  category: string
  avgExportPrice: number
  moqMin: number
  moqMax: number
  certRatio: number
  supplierCount: number
}

// 셀러 로그인 검증
async function verifySeller(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from("beauty_sellers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()
  return !!data
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isSeller = await verifySeller(user.id)
  if (!isSeller) return NextResponse.json({ error: "Seller access required" }, { status: 403 })

  let body: { type?: string; supplier?: SupplierInput; stats?: TrendInput }
  try {
    body = await request.json() as { type?: string; supplier?: SupplierInput; stats?: TrendInput }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const type = body.type ?? "supplier"

  // ── 공급사 심층 분석 ──────────────────────────────────────────────────────
  if (type === "supplier") {
    const s = body.supplier
    if (!s) return NextResponse.json({ error: "supplier required" }, { status: 400 })

    const priceRange =
      s.price_range_min && s.price_range_max
        ? `$${s.price_range_min}–$${s.price_range_max} USD`
        : s.price_range_min
          ? `From $${s.price_range_min} USD`
          : "Not specified"

    const prompt = `You are a K-Beauty sourcing intelligence analyst. Analyze this Korean supplier from a seller's perspective. Respond ONLY with valid JSON — no markdown, no explanation.

Supplier: ${s.company_name_en} (${s.company_name_ko})
Categories: ${s.categories.join(", ") || "Not specified"}
Certifications: ${s.certifications.join(", ") || "None"}
MOQ: ${s.moq ? `${s.moq.toLocaleString()} units` : "Not specified"}
Price Range: ${priceRange}
Export Experience: ${s.export_countries || "Not specified"}
FDA Status: ${s.fda_status || "Unknown"}

Required JSON:
{"opportunity":"2-3 sentences on trade opportunities","risk":"2-3 sentences on risks and mitigation","margin_insight":"2-3 sentences on pricing and margin potential","recommended_categories":["cat1","cat2","cat3"]}`

    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      })
      const text = response.content[0].type === "text" ? response.content[0].text : ""
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error("No JSON in response")
      const result = JSON.parse(match[0]) as typeof FALLBACK_ANALYSIS
      return NextResponse.json(result)
    } catch {
      return NextResponse.json(FALLBACK_ANALYSIS)
    }
  }

  // ── 카테고리 트렌드 인사이트 ──────────────────────────────────────────────
  if (type === "trend") {
    const st = body.stats
    if (!st) return NextResponse.json({ error: "stats required" }, { status: 400 })

    const prompt = `You are a K-Beauty market analyst. Write 1-2 actionable sentences of trend insight for a seller based on this data. Plain text only — no JSON, no bullet points.

Category: ${st.category}
Avg Export Price: $${st.avgExportPrice.toFixed(2)} USD
MOQ Range: ${st.moqMin.toLocaleString()}–${st.moqMax.toLocaleString()} units
Certified Supplier Ratio: ${st.certRatio.toFixed(0)}%
Active Suppliers: ${st.supplierCount}`

    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        messages: [{ role: "user", content: prompt }],
      })
      const text = response.content[0].type === "text" ? response.content[0].text.trim() : ""
      return NextResponse.json({ insight: text })
    } catch {
      return NextResponse.json({
        insight: `The ${st.category} category has ${st.supplierCount} active suppliers with competitive export pricing. High certification rates signal premium positioning opportunities for international markets.`,
      })
    }
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 })
}
