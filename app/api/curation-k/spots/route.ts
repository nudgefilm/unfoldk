import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { hasProAccess } from "@/lib/auth/plan"

// /api/curation-k/spots — 통합 탭 그리드 API
//
// 쿼리:
//   tab        filming | attractions | culture | festivals | stays | food
//   area_code  1~39 (선택; filming 탭은 무시)
//   page       1+ (기본 1)
//   pageSize   1~50 (기본 20)
//
// tab → 데이터 소스:
//   filming      → filming_spots 테이블 (status='confirmed', dummy 제외)
//   attractions  → tour_spots content_type_id=12
//   culture      → tour_spots content_type_id=14
//   festivals    → tour_spots content_type_id=15 (event_end_date >= today)
//   stays        → tour_spots content_type_id=32
//   food         → tour_spots content_type_id=39
//
// Pro 잠금: attractions / culture / stays / food → 비Pro 면 { locked: true } + 빈 items.
//
// 응답: { items: SpotItem[], total, page, pageSize, locked }
//
// SpotItem 은 filming / tour 양쪽을 동일 shape 로 정규화 — 카드 컴포넌트가 분기 없이
// 렌더할 수 있게 함.

export const dynamic = "force-dynamic"

const TabSchema = z.enum([
  "filming",
  "attractions",
  "culture",
  "festivals",
  "stays",
  "food",
])
type Tab = z.infer<typeof TabSchema>

const QuerySchema = z.object({
  tab: TabSchema.default("filming"),
  area_code: z.coerce.number().int().min(1).max(39).optional(),
  drama_title: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(21),
})

// 비Pro 가 접근 시 locked 응답으로 차단되는 탭. 촬영지·축제·행사는 Free.
const PRO_ONLY_TABS: ReadonlySet<Tab> = new Set([
  "attractions",
  "culture",
  "stays",
  "food",
])

const TAB_TO_CONTENT_TYPE_ID: Partial<Record<Tab, number>> = {
  attractions: 12,
  culture: 14,
  festivals: 15,
  stays: 32,
  food: 39,
}

// filming_spots.region 은 텍스트 (Claude 추출 — 영문 광역 라벨).
// area_code 필터 적용 시 가능한 region 라벨 후보를 .in() 으로 매칭.
// 도(道) 이름의 약식·전체 표기 alias 모두 포함 — Claude 가 어느 쪽으로 추출했든 hit.
const AREA_CODE_TO_FILMING_REGION_LABELS: Record<number, string[]> = {
  1: ["Seoul"],
  2: ["Incheon"],
  3: ["Daejeon"],
  4: ["Daegu"],
  5: ["Gwangju"],
  6: ["Busan"],
  7: ["Ulsan"],
  8: ["Sejong"],
  31: ["Gyeonggi"],
  32: ["Gangwon"],
  33: ["Chungbuk", "Chungcheongbuk"],
  34: ["Chungnam", "Chungcheongnam", "Chungcheong"],
  35: ["Gyeongbuk", "Gyeongsangbuk"],
  36: ["Gyeongnam", "Gyeongsangnam", "Gyeongsang"],
  37: ["Jeonbuk", "Jeollabuk"],
  38: ["Jeonnam", "Jeollanam", "Jeolla"],
  39: ["Jeju"],
}

export interface SpotItem {
  id: string
  content_id: string
  title: string                 // 카드 메인 (eng_title || title || filming.spot_name)
  korean_title: string | null   // 부제 보조 — tour_spots 의 한글 원본
  subtitle: string | null       // filming: drama_title / tour: null
  address: string | null        // addr1 또는 filming.address
  addr2: string | null          // tour 만 (filming 은 null)
  description: string | null    // overview_en (tour) — filming 은 null
  overview_ko: string | null    // tour 만 (모달 fallback)
  image_url: string | null
  image_url2: string | null     // tour 만 (보조 이미지)
  homepage: string | null       // tour 만
  drama_title: string | null    // filming 만
  region: string | null         // filming 만 (tour 는 area_code 별도)
  area_code: number | null      // tour 만
  content_type_id: number | null // tour 만 (filming=null)
  badge: string | null          // "Verified" (filming confidence>=0.8)
  latitude: number | null
  longitude: number | null
}

function ymdToday(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    tab: url.searchParams.get("tab") ?? undefined,
    area_code: url.searchParams.get("area_code") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { tab, area_code, drama_title, page, pageSize } = parsed.data

  const supabase = await createSupabaseServerClient()

  // ─── Pro 여부 (잠금 탭일 때만 필요) ──────────────────────────
  let isPro = false
  if (PRO_ONLY_TABS.has(tab)) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("plan_type, is_admin")
        .eq("id", user.id)
        .maybeSingle()
      const row = profile as { plan_type?: string; is_admin?: boolean } | null
      isPro = hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin })
    }

    if (!isPro) {
      return NextResponse.json(
        { items: [], total: 0, page, pageSize, locked: true },
        { headers: { "Cache-Control": "no-store" } }
      )
    }
  }

  const offset = (page - 1) * pageSize
  const rangeEnd = offset + pageSize - 1

  // ─── 1. filming 탭 — filming_spots 테이블 ────────────────────
  if (tab === "filming") {
    let filmingQuery = supabase
      .from("filming_spots")
      .select(
        "id, drama_id, drama_title, spot_name, region, address, latitude, longitude, image_url, confidence",
        { count: "exact" }
      )
      .neq("spot_name", "__no_spots_found__")
      // 2026-05-19 임시 — image_url null 행 제외 (빈 카드 UX 개선, Step 9 전)
      .not("image_url", "is", null)
      .order("confidence", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })

    if (drama_title) {
      // PostgREST ilike 인젝션 방어 — % 와 _ 만 strip (그 외 문자는 ilike 가 안전)
      const safeDrama = drama_title.replace(/[%_]/g, "")
      filmingQuery = filmingQuery.ilike("drama_title", safeDrama)
    }

    if (area_code !== undefined) {
      const labels = AREA_CODE_TO_FILMING_REGION_LABELS[area_code]
      if (labels && labels.length > 0) {
        filmingQuery = filmingQuery.in("region", labels)
      }
    }

    const { data, error, count } = await filmingQuery.range(offset, rangeEnd)

    if (error) {
      console.error("[curation-k/spots] filming 조회 실패:", error.message)
      return NextResponse.json({ error: "query_failed" }, { status: 500 })
    }

    type FilmingRow = {
      id: string
      drama_id: string | null
      drama_title: string
      spot_name: string
      region: string | null
      address: string | null
      latitude: number | null
      longitude: number | null
      image_url: string | null
      confidence: number | null
    }

    const items: SpotItem[] = ((data ?? []) as FilmingRow[]).map((r) => ({
      id: r.id,
      content_id: r.id,
      title: r.spot_name,
      korean_title: null,
      subtitle: r.drama_title,
      address: r.address,
      addr2: null,
      description: null,
      overview_ko: null,
      image_url: r.image_url,
      image_url2: null,
      homepage: null,
      drama_title: r.drama_title,
      region: r.region,
      area_code: null,
      content_type_id: null,
      badge: (r.confidence ?? 0) >= 0.8 ? "Verified" : null,
      latitude: r.latitude,
      longitude: r.longitude,
    }))

    return NextResponse.json(
      { items, total: count ?? null, page, pageSize, locked: false },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } }
    )
  }

  // ─── 2. tour 탭들 — tour_spots 테이블 ────────────────────────
  const contentTypeId = TAB_TO_CONTENT_TYPE_ID[tab]
  if (contentTypeId === undefined) {
    return NextResponse.json({ error: "unknown_tab" }, { status: 400 })
  }

  let query = supabase
    .from("tour_spots")
    .select(
      "id, content_id, content_type_id, title, eng_title, addr1, addr2, area_code, latitude, longitude, image_url, image_url2, overview_ko, overview_en, homepage, event_start_date, event_end_date",
      { count: "exact" }
    )
    .eq("content_type_id", contentTypeId)

  if (area_code !== undefined) {
    query = query.eq("area_code", area_code)
  }

  if (tab === "festivals") {
    // 축제·행사: 종료일이 오늘 이후 or null. 시작일 오름차순.
    const today = ymdToday()
    query = query
      .or(`event_end_date.is.null,event_end_date.gte.${today}`)
      .order("event_start_date", { ascending: true, nullsFirst: false })
  } else {
    // 일반 카테고리: 이미지 있는 항목 우선 → 최근 갱신순
    query = query
      .order("image_url", { ascending: false, nullsFirst: false })
      .order("modified_time", { ascending: false, nullsFirst: false })
  }

  query = query.range(offset, rangeEnd)

  const { data, error, count } = await query
  if (error) {
    console.error("[curation-k/spots] tour 조회 실패:", error.message)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }

  type TourRow = {
    id: string
    content_id: string
    content_type_id: number
    title: string
    eng_title: string | null
    addr1: string | null
    addr2: string | null
    area_code: number | null
    latitude: number | null
    longitude: number | null
    image_url: string | null
    image_url2: string | null
    overview_ko: string | null
    overview_en: string | null
    homepage: string | null
    event_start_date: string | null
    event_end_date: string | null
  }

  const items: SpotItem[] = ((data ?? []) as TourRow[]).map((r) => ({
    id: r.id,
    content_id: r.content_id,
    title: (r.eng_title ?? r.title).trim(),
    korean_title: r.eng_title ? r.title : null,
    subtitle:
      tab === "festivals" && r.event_start_date
        ? formatFestivalDateRange(r.event_start_date, r.event_end_date)
        : null,
    address: r.addr1 ?? null,
    addr2: r.addr2,
    description: r.overview_en,
    overview_ko: r.overview_ko,
    image_url: r.image_url,
    image_url2: r.image_url2,
    homepage: r.homepage,
    drama_title: null,
    region: null,
    area_code: r.area_code,
    content_type_id: r.content_type_id,
    badge: null,
    latitude: r.latitude,
    longitude: r.longitude,
  }))

  return NextResponse.json(
    { items, total: count ?? null, page, pageSize, locked: false },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } }
  )
}

// YYYYMMDD → "YYYY-MM-DD" 또는 "YYYY-MM-DD ~ YYYY-MM-DD"
function formatFestivalDateRange(
  start: string,
  end: string | null
): string | null {
  const fmt = (s: string): string | null => {
    if (!/^\d{8}$/.test(s)) return null
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  const s = fmt(start)
  if (!s) return null
  const e = end ? fmt(end) : null
  return e && e !== s ? `${s} ~ ${e}` : s
}
