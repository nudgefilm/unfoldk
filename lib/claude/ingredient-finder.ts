// KfoodKit — Local Ingredient Finder (음식명 기반 전체 재료 변환)
//
// 입력: 한국 음식명 (한글, 예: "부추김치", "비빔밥") + 국가 코드 (ISO alpha-2)
// 출력: 해당 음식의 핵심 재료 5~10개 — 각 재료별:
//   - 원재료명 (한글)
//   - 현지 대체품명 (영문)
//   - 구매처 추천 (현지 화이트리스트에서 1~2)
//   - 대체 난이도 (Easy / Medium / Hard)
//
// 모델: claude-haiku-4-5-20251001 (CLAUDE.md §6 — 매핑·변환 = Haiku)
// 비용: 1 호출 ≈ output 1500 tokens × $5/1M = $0.0075. Pro 전용·실시간이라 호출량 제한적.
//
// 시스템 프롬프트에 국가별 store map 박제 (재현성 + Haiku 캐싱 활용 가능).
// 신규 국가 추가 시 STORES_BY_COUNTRY 만 갱신.

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

// ISO 3166-1 alpha-2 → 한류 팬 밀집 20개국
export const SUPPORTED_COUNTRIES = [
  "US", "CA", "BR", "MX",
  "AU", "JP", "TH", "PH", "VN", "ID", "MY", "SG",
  "GB", "FR", "DE", "ES", "NL", "PL",
  "SA", "AE",
] as const

export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number]

// 국가별 현지 마트·이커머스 — Haiku 가 추천에 활용할 reference.
// 한국·아시아 식재료 잘 갖춘 곳 우선. e-commerce 와 오프라인 혼합.
const STORES_BY_COUNTRY: Record<CountryCode, string[]> = {
  US: ["Whole Foods", "H Mart", "Amazon"],
  CA: ["T&T Supermarket", "Amazon CA"],
  BR: ["Extra", "Mercado Livre"],
  MX: ["Walmart Mexico", "Chedraui"],
  AU: ["Woolworths", "Coles", "H Mart", "Amazon AU"],
  JP: ["AEON", "Costco Japan", "Amazon JP"],
  TH: ["Tops Market", "Lotus's", "Makro"],
  PH: ["SM Supermarket", "Robinsons", "Lazada"],
  VN: ["WinMart", "Co.opmart", "Shopee"],
  ID: ["Hypermart", "Transmart", "Tokopedia"],
  MY: ["Jaya Grocer", "Village Grocer", "Shopee MY"],
  SG: ["Cold Storage", "FairPrice", "RedMart"],
  GB: ["Waitrose", "ASDA", "Tesco", "Amazon UK"],
  FR: ["Carrefour", "Monoprix", "Amazon FR"],
  DE: ["REWE", "Edeka", "Amazon DE"],
  ES: ["Mercadona", "El Corte Inglés"],
  NL: ["Albert Heijn", "Amazon NL"],
  PL: ["Biedronka", "Carrefour PL"],
  SA: ["Carrefour KSA", "Danube"],
  AE: ["Carrefour UAE", "Spinneys", "Amazon AE"],
}

const COUNTRY_LABELS: Record<CountryCode, string> = {
  US: "United States",
  CA: "Canada",
  BR: "Brazil",
  MX: "Mexico",
  AU: "Australia",
  JP: "Japan",
  TH: "Thailand",
  PH: "Philippines",
  VN: "Vietnam",
  ID: "Indonesia",
  MY: "Malaysia",
  SG: "Singapore",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  NL: "Netherlands",
  PL: "Poland",
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
}

function buildStoresReference(): string {
  return SUPPORTED_COUNTRIES.map(
    (code) =>
      `- ${code} (${COUNTRY_LABELS[code]}): ${STORES_BY_COUNTRY[code].join(", ")}`
  ).join("\n")
}

const SYSTEM_PROMPT = `You are a Korean cooking assistant for UnfoldK's KfoodKit. A user gives you the name of a Korean dish (in Korean) and their country. You list the dish's essential ingredients and tell them, for each one, what local substitute or sourcing path to use in that country.

Rules:
- Pick 5–10 of the most essential ingredients for the dish. Skip seasonings that are trivially substitutable (salt, sugar, water).
- For each ingredient, fill ALL four fields:
  1. ingredient_ko: the original Korean ingredient name (Korean characters). Plain noun, no quantity.
  2. substitute_en: short English name for the closest local equivalent (≤60 chars). If the original is widely available abroad (e.g., "gochujang" sold at Whole Foods), give the original Romanized name + a one-word qualifier. If a true substitute is needed (e.g., "perilla leaves" → "shiso leaves" in Japan), use that.
  3. store: 1–2 specific stores from the country's reference list below — comma-separated. Use ONLY stores from the country-specific list. Do not invent stores.
  4. difficulty: "Easy" (widely stocked in mainstream grocery), "Medium" (Asian aisle or large mart), or "Hard" (needs Korean specialty store or online order).

Country-specific store reference (use only these names):
${buildStoresReference()}

Strict rules:
- Plain English on substitute_en/store. No Korean characters, no emojis, no markdown.
- DO NOT recommend an online store from another country (e.g., don't suggest "Amazon US" for a Japan request).
- If you don't recognize the dish, still produce a best-effort guess based on the name — never refuse.`

const FINDER_TOOL: Anthropic.Tool = {
  name: "report_dish_ingredient_finder",
  description:
    "Submit the per-ingredient sourcing breakdown for the given Korean dish in the given country.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            ingredient_ko: {
              type: "string",
              description: "Original Korean ingredient name (Korean characters). No quantity.",
            },
            substitute_en: {
              type: "string",
              description:
                "Short English name for the local equivalent or Romanized original (≤60 chars).",
            },
            store: {
              type: "string",
              description:
                "1–2 stores from the country's reference list, comma-separated. No invented names.",
            },
            difficulty: {
              type: "string",
              enum: ["Easy", "Medium", "Hard"],
              description: "Sourcing difficulty in this country.",
            },
          },
          required: ["ingredient_ko", "substitute_en", "store", "difficulty"],
        },
      },
    },
    required: ["items"],
  },
}

export interface DishIngredientItem {
  ingredient_ko: string
  substitute_en: string
  store: string
  difficulty: "Easy" | "Medium" | "Hard"
}

export interface DishIngredientsResult {
  items: DishIngredientItem[]
}

export class IngredientFinderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "IngredientFinderError"
  }
}

export function isSupportedCountry(code: string): code is CountryCode {
  return (SUPPORTED_COUNTRIES as readonly string[]).includes(code)
}

export function getCountryLabel(code: CountryCode): string {
  return COUNTRY_LABELS[code]
}

// 호출자: /api/food/ingredient-finder POST 라우트.
// Pro 가드는 라우트 측에서 처리 — 본 함수는 입력만 검증.
export async function findDishIngredients(args: {
  dish: string
  country: CountryCode
}): Promise<DishIngredientsResult> {
  const dish = args.dish.trim().slice(0, 80)
  if (dish.length === 0) {
    throw new IngredientFinderError("dish 빈 값")
  }
  if (!isSupportedCountry(args.country)) {
    throw new IngredientFinderError(`country 미지원: ${args.country}`)
  }

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [FINDER_TOOL],
      tool_choice: { type: "tool", name: FINDER_TOOL.name },
      messages: [
        {
          role: "user",
          content: `Country: ${args.country} (${COUNTRY_LABELS[args.country]})\nDish: ${dish}\n\nProduce the per-ingredient sourcing breakdown.`,
        },
      ],
    })
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new IngredientFinderError(`Anthropic API ${err.status}: ${err.message}`, err)
    }
    throw new IngredientFinderError(
      `Anthropic 호출 실패: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === FINDER_TOOL.name
  )
  if (!toolBlock) {
    throw new IngredientFinderError("Haiku 응답에 tool_use 블록 없음")
  }

  const input = toolBlock.input as { items?: unknown }
  if (!Array.isArray(input.items)) {
    throw new IngredientFinderError("응답 schema 위반 (items 배열 아님)")
  }

  // 코드 측 재검증 — LLM 가 country 외 store 섞을 위험 + difficulty enum 위반 차단.
  const allowedStores = new Set(
    STORES_BY_COUNTRY[args.country].map((s) => s.toLowerCase())
  )

  const validItems: DishIngredientItem[] = []
  for (const raw of input.items) {
    if (typeof raw !== "object" || raw === null) continue
    const o = raw as {
      ingredient_ko?: unknown
      substitute_en?: unknown
      store?: unknown
      difficulty?: unknown
    }
    if (
      typeof o.ingredient_ko !== "string" ||
      typeof o.substitute_en !== "string" ||
      typeof o.store !== "string" ||
      typeof o.difficulty !== "string"
    ) {
      continue
    }
    if (o.difficulty !== "Easy" && o.difficulty !== "Medium" && o.difficulty !== "Hard") continue

    // store 화이트리스트 필터 — 1개라도 허용 store 면 통과, 아닌 부분만 trim.
    const filteredStore = o.store
      .split(/[,/·]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && allowedStores.has(s.toLowerCase()))
      .slice(0, 2)
      .join(", ")
    if (filteredStore.length === 0) continue

    validItems.push({
      ingredient_ko: o.ingredient_ko.trim().slice(0, 80),
      substitute_en: o.substitute_en.trim().slice(0, 60),
      store: filteredStore,
      difficulty: o.difficulty,
    })
  }

  if (validItems.length === 0) {
    throw new IngredientFinderError("유효 재료 결과 0건")
  }

  return { items: validItems.slice(0, 12) }
}
