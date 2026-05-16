// KfoodKit — AI Ingredient Finder
//
// 입력: 한국 식재료명 (영어 또는 한글) + 국가 코드 (ISO 3166-1 alpha-2)
// 출력: 대체 재료 후보 + 해당 국가의 현지 구매처 (마트·이커머스)
//
// 모델: claude-haiku-4-5-20251001 (CLAUDE.md §6 AI 처리 원칙 — 추출·매핑은 Haiku)
// tool_use 로 구조화 출력 강제 (JSON.parse 실패 위험 제거).
//
// 비용: 1 호출 ≈ output 400 tokens × $5/1M = $0.002. Pro 전용이라 호출량 제한적.
//
// 시스템 프롬프트에 국가별 store map 박제 (캐시 안정성 + Haiku 캐싱 활용 가능).
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
// 식료품 전문 (특히 한국·아시아 식재료 잘 갖춘) 우선. e-commerce 와 오프라인 혼합.
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

// 시스템 프롬프트 — 캐시 안정성 위해 동적 값 절대 삽입 금지.
// store map 전체를 한 번에 박제 (Haiku 4.5 cache prefix 임계값 4096 토큰 — 현 프롬프트는 미달이라
// 실제 캐시 안 되지만 안정성 차원에서 ephemeral 마커 유지. CLAUDE.md §6 패턴).
function buildStoresReference(): string {
  return SUPPORTED_COUNTRIES.map(
    (code) =>
      `- ${code} (${COUNTRY_LABELS[code]}): ${STORES_BY_COUNTRY[code].join(", ")}`
  ).join("\n")
}

const SYSTEM_PROMPT = `You are a Korean cooking assistant for UnfoldK's KfoodKit. Help K-food fans worldwide find or substitute Korean ingredients in their own country.

For each request you receive an ingredient (Korean dish/sauce/produce, in English or Romanized Korean) and an ISO country code. You must:
1. Suggest 1–3 practical substitute ingredients available in that country, with a one-line note on each (flavor profile match, where it differs).
2. Recommend 1–3 specific stores from the country's known retailers (see the reference below) where the original or a substitute is most likely to be found. Use ONLY stores from the country-specific list — do not invent stores.
3. Give one short closing tip (1 sentence) — e.g., recommended brand name, freezer aisle, ethnic foods section.

Country-specific store reference (use only these names):
${buildStoresReference()}

Strict rules:
- Plain English only. No Korean characters in output. No emojis. No markdown.
- If the country has no clear K-food retail availability, still recommend the closest substitutes + general grocery stores from the list.
- DO NOT recommend an online store from another country (e.g., don't suggest "Amazon US" for a Japan request).
- If you're not sure an ingredient is real, output a clearly-labeled approximate substitute rather than inventing details.`

const FINDER_TOOL: Anthropic.Tool = {
  name: "report_ingredient_finder",
  description:
    "Submit substitute ingredient suggestions and local store recommendations for the user's country.",
  input_schema: {
    type: "object",
    properties: {
      substitutes: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Substitute ingredient name in English." },
            note: {
              type: "string",
              description:
                "One-line note on the substitute (≤120 chars). Flavor match or use-case nuance.",
            },
          },
          required: ["name", "note"],
        },
      },
      stores: {
        type: "array",
        maxItems: 3,
        items: {
          type: "string",
          description:
            "Specific store name from the country's reference list. Do not invent new names.",
        },
      },
      tip: {
        type: "string",
        description: "One short closing tip (≤160 chars). Brand, aisle, or sourcing tip.",
      },
    },
    required: ["substitutes", "stores", "tip"],
  },
}

export interface IngredientFinderResult {
  substitutes: Array<{ name: string; note: string }>
  stores: string[]
  tip: string
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
export async function findIngredient(args: {
  ingredient: string
  country: CountryCode
}): Promise<IngredientFinderResult> {
  const ingredient = args.ingredient.trim().slice(0, 80)
  if (ingredient.length === 0) {
    throw new IngredientFinderError("ingredient 빈 값")
  }
  if (!isSupportedCountry(args.country)) {
    throw new IngredientFinderError(`country 미지원: ${args.country}`)
  }

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
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
          content: `Country: ${args.country} (${COUNTRY_LABELS[args.country]})\nIngredient: ${ingredient}\n\nProduce the finder output.`,
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

  const input = toolBlock.input as Partial<IngredientFinderResult>
  if (
    !Array.isArray(input.substitutes) ||
    !Array.isArray(input.stores) ||
    typeof input.tip !== "string"
  ) {
    throw new IngredientFinderError("응답 schema 위반")
  }

  // 코드 측 재검증 — store 화이트리스트 (LLM 이 country 외 store 섞을 위험 차단)
  const allowedStores = new Set(STORES_BY_COUNTRY[args.country].map((s) => s.toLowerCase()))
  const filteredStores = input.stores
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && allowedStores.has(s.toLowerCase()))
    .slice(0, 3)

  const filteredSubstitutes = input.substitutes
    .filter(
      (s): s is { name: string; note: string } =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as { name?: unknown }).name === "string" &&
        typeof (s as { note?: unknown }).note === "string"
    )
    .map((s) => ({
      name: s.name.trim().slice(0, 80),
      note: s.note.trim().slice(0, 160),
    }))
    .filter((s) => s.name.length > 0)
    .slice(0, 3)

  if (filteredSubstitutes.length === 0) {
    throw new IngredientFinderError("substitutes 결과 0건")
  }

  return {
    substitutes: filteredSubstitutes,
    stores: filteredStores,
    tip: input.tip.trim().slice(0, 200),
  }
}
