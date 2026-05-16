"use client"

// /curation-k — Curation K (M+5 / HallyuMap) 본격 구현
//
// Phase 1 섹션 (이 파일):
//   1. Hero — South Korea SVG 지도 + 카테고리 필터 토글 + 라이브 핀 (filming + kpop)
//   2. K-Drama Filming Spots — filming_spots DB 카드 그리드 + 드라마 필터
//   3. K-Pop Pilgrimage Sites — kpop_spots DB, Last.fm 인기 순서
//   4. Korean Food Hotspots — TourAPI 음식점 (region picker)
//   5. Themed Stays — TourAPI 숙박 (region picker)
//   6. AI 1-Day Course — Pro 잠금 UI (Phase 2 에서 Claude 생성 결합)
//   7. Fan Map by Country — Last.fm geo.getTopArtists × kpop_artists
//
// 카테고리 아이콘 (사용자 지정):
//   촬영지 = Video / K팝 성지 = MicVocal / 음식점 = UtensilsCrossed / 숙박 = Hotel
//
// 다크테마 유지 (#0d0d0f bg, #FF4B6E brand, glass cards).
// 지도 인프라 (TopoJSON + projection + 도시·도서 마커) 는 기존 패턴 보존.

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { feature } from "topojson-client"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import {
  MapPin,
  Sparkles,
  Lock,
  Video,
  MicVocal,
  UtensilsCrossed,
  Hotel,
  ChevronRight,
  Globe,
} from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"

// ─── 지도 인프라 ─────────────────────────────────────────────
const LNG_MIN = 124.3
const LNG_MAX = 132.1
const LAT_MIN = 32.9
const LAT_MAX = 38.8
const SVG_W = 540
const SVG_H = 540

function proj(lng: number, lat: number): [number, number] {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * SVG_W
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * SVG_H
  return [x, y]
}

function ringToPath(ring: number[][]): string {
  return (
    ring
      .map(([lng, lat], i) => {
        const [x, y] = proj(lng, lat)
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(" ") + " Z"
  )
}
function geometryToPath(geom: GeoJSON.Geometry): string {
  if (geom.type === "Polygon") return geom.coordinates.map(ringToPath).join(" ")
  if (geom.type === "MultiPolygon")
    return geom.coordinates.flatMap((poly) => poly.map(ringToPath)).join(" ")
  return ""
}

const KOREA_CITIES: Array<{
  name: string
  lng: number
  lat: number
  tier: "primary" | "secondary"
  labelOffset?: [number, number]
}> = [
  { name: "Seoul", lng: 126.978, lat: 37.5665, tier: "primary" },
  { name: "Busan", lng: 129.0756, lat: 35.1796, tier: "primary" },
  { name: "Jeju", lng: 126.5312, lat: 33.4996, tier: "primary", labelOffset: [-30, 18] },
]

interface CountriesAtlas {
  type: string
  objects: { countries: { type: string; geometries: unknown[] } }
  arcs: number[][][]
}

// ─── 카테고리 정의 ───────────────────────────────────────────
type Category = "filming" | "kpop" | "food" | "stays"

interface CategoryDef {
  key: Category
  label: string
  Icon: typeof Video
  color: string
}

const CATEGORIES: CategoryDef[] = [
  { key: "filming", label: "Filming Spots", Icon: Video, color: "#FF4B6E" },
  { key: "kpop", label: "K-Pop Sites", Icon: MicVocal, color: "#a855f7" },
  { key: "food", label: "Food", Icon: UtensilsCrossed, color: "#f59e0b" },
  { key: "stays", label: "Stays", Icon: Hotel, color: "#22c55e" },
]

const CATEGORY_COLOR_MAP: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.color])
) as Record<Category, string>

// ─── API 응답 타입 ───────────────────────────────────────────
interface MapPin {
  id: string
  category: "filming" | "kpop"
  name: string
  subtitle: string
  region: string | null
  lat: number
  lng: number
  spot_type?: string
}

interface FilmingSpotItem {
  id: string
  drama_id: string | null
  drama_title: string
  spot_name: string
  region: string | null
  address: string | null
  image_url: string | null
  confidence: number
}

interface KpopSpotItem {
  id: string
  artist_id: string | null
  artist_name: string
  spot_name: string
  spot_type: "agency" | "mv_location" | "cafe" | "concert_venue"
  region: string | null
  address: string | null
  image_url: string | null
}

interface TourSpotItem {
  contentId: string
  title: string
  address: string | null
  latitude: number | null
  longitude: number | null
  imageUrl: string | null
}

interface GeoArtistItem {
  artistId: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  listeners: number | null
  rank: number
  spot_count: number
}

// 지역 선택지 — food / stays 공용
const AREA_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "seoul", label: "Seoul" },
  { value: "busan", label: "Busan" },
  { value: "jeju", label: "Jeju" },
  { value: "gyeonggi", label: "Gyeonggi" },
  { value: "gangwon", label: "Gangwon" },
  { value: "incheon", label: "Incheon" },
  { value: "daegu", label: "Daegu" },
  { value: "gyeongsangbuk", label: "Gyeongsangbuk" },
  { value: "jeollanam", label: "Jeollanam" },
]

const COUNTRY_OPTIONS = [
  "United States",
  "Japan",
  "United Kingdom",
  "Germany",
  "France",
  "Indonesia",
  "Philippines",
  "Vietnam",
  "Thailand",
  "Brazil",
  "Mexico",
  "Canada",
  "Australia",
]

type PlanType = "free" | "monthly" | "annual"

export default function CurationKPage() {
  const [koreaPath, setKoreaPath] = useState<string | null>(null)

  // 인증·플랜 (AI 1-Day Course Pro 가드용)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isPro, setIsPro] = useState(false)

  // 지도 핀 + 카테고리 필터
  const [pins, setPins] = useState<MapPin[]>([])
  const [activeCats, setActiveCats] = useState<Set<Category>>(
    () => new Set(CATEGORIES.map((c) => c.key))
  )
  const [hoveredPin, setHoveredPin] = useState<MapPin | null>(null)

  // 섹션 데이터
  const [filmingSpots, setFilmingSpots] = useState<FilmingSpotItem[]>([])
  const [filmingLoading, setFilmingLoading] = useState(true)
  const [kpopSpots, setKpopSpots] = useState<KpopSpotItem[]>([])
  const [kpopLoading, setKpopLoading] = useState(true)

  const [foodArea, setFoodArea] = useState("seoul")
  const [foodItems, setFoodItems] = useState<TourSpotItem[]>([])
  const [foodLoading, setFoodLoading] = useState(true)

  const [stayArea, setStayArea] = useState("seoul")
  const [stayItems, setStayItems] = useState<TourSpotItem[]>([])
  const [stayLoading, setStayLoading] = useState(true)

  const [geoCountry, setGeoCountry] = useState("United States")
  const [geoItems, setGeoItems] = useState<GeoArtistItem[]>([])
  const [geoLoading, setGeoLoading] = useState(true)

  // ─── 1. 한국 polygon ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json")
      .then((res) => res.json())
      .then((world: CountriesAtlas) => {
        if (cancelled) return
        const fc = feature(
          world as unknown as Parameters<typeof feature>[0],
          world.objects.countries as unknown as Parameters<typeof feature>[1]
        ) as unknown as GeoJSON.FeatureCollection
        const korea = fc.features.find(
          (f) =>
            String(f.id) === "410" ||
            (f.properties as { name?: string } | null)?.name === "South Korea"
        )
        if (korea?.geometry) setKoreaPath(geometryToPath(korea.geometry))
      })
      .catch((err) => console.warn("[curation-k] Korea map load failed:", err))
    return () => {
      cancelled = true
    }
  }, [])

  // ─── 2. 인증·플랜 ──────────────────────────────────────────
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setIsAuthenticated(!!user)
      if (!user) return
      const { data: profile } = await supabase
        .from("users")
        .select("plan_type, is_admin")
        .eq("id", user.id)
        .single()
      const row = profile as { plan_type?: PlanType; is_admin?: boolean } | null
      setIsPro(hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin }))
    })
  }, [])

  // ─── 3. 지도 핀 (filming + kpop) ───────────────────────────
  useEffect(() => {
    fetch("/api/curation-k/map")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { pins: MapPin[] }) => setPins(body.pins ?? []))
      .catch((err) => console.warn("[curation-k] pins fetch 실패:", err))
  }, [])

  // ─── 4. 촬영지 카드 ────────────────────────────────────────
  useEffect(() => {
    setFilmingLoading(true)
    fetch("/api/curation-k/filming-spots?limit=12")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { items: FilmingSpotItem[] }) => setFilmingSpots(body.items ?? []))
      .catch((err) => console.warn("[curation-k] filming fetch 실패:", err))
      .finally(() => setFilmingLoading(false))
  }, [])

  // ─── 5. K팝 성지 카드 ──────────────────────────────────────
  useEffect(() => {
    setKpopLoading(true)
    fetch("/api/curation-k/kpop-spots?limit=12")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { items: KpopSpotItem[] }) => setKpopSpots(body.items ?? []))
      .catch((err) => console.warn("[curation-k] kpop fetch 실패:", err))
      .finally(() => setKpopLoading(false))
  }, [])

  // ─── 6. Food / Stays — region 변경 시 재조회 ──────────────
  useEffect(() => {
    setFoodLoading(true)
    fetch(`/api/curation-k/food?area=${foodArea}&limit=8`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { items: TourSpotItem[] }) => setFoodItems(body.items ?? []))
      .catch((err) => console.warn("[curation-k] food fetch 실패:", err))
      .finally(() => setFoodLoading(false))
  }, [foodArea])

  useEffect(() => {
    setStayLoading(true)
    fetch(`/api/curation-k/stays?area=${stayArea}&limit=8`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { items: TourSpotItem[] }) => setStayItems(body.items ?? []))
      .catch((err) => console.warn("[curation-k] stays fetch 실패:", err))
      .finally(() => setStayLoading(false))
  }, [stayArea])

  // ─── 7. Geo widget ────────────────────────────────────────
  useEffect(() => {
    setGeoLoading(true)
    fetch(`/api/curation-k/geo-artists?country=${encodeURIComponent(geoCountry)}&limit=8`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { items: GeoArtistItem[] }) => setGeoItems(body.items ?? []))
      .catch((err) => console.warn("[curation-k] geo fetch 실패:", err))
      .finally(() => setGeoLoading(false))
  }, [geoCountry])

  // 카테고리 토글
  const toggleCategory = (key: Category) => {
    setActiveCats((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // 지도에 노출할 핀 — filming/kpop 만 (food/stays 는 region 단위라 GPS 핀 제외)
  const visiblePins = useMemo(() => {
    return pins.filter((p) => activeCats.has(p.category))
  }, [pins, activeCats])

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      <main className="flex-1 w-full">
        {/* ───── 1. Hero + Map ─────────────────────────────── */}
        <section className="relative w-full overflow-hidden">
          <div className="max-w-[1320px] mx-auto px-6 pt-10 pb-12 md:pt-14 md:pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 items-start">
              {/* 지도 */}
              <div className="relative w-full max-w-[640px] mx-auto lg:mx-0 aspect-square">
                <svg
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  className="w-full h-full"
                  aria-label="Map of South Korea with category pins"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {[0.2, 0.4, 0.6, 0.8].map((p) => (
                    <line
                      key={`lat-${p}`}
                      x1="0"
                      y1={SVG_H * p}
                      x2={SVG_W}
                      y2={SVG_H * p}
                      stroke="#ffffff"
                      strokeOpacity="0.05"
                      strokeWidth="1"
                    />
                  ))}
                  {[0.25, 0.5, 0.75].map((p) => (
                    <line
                      key={`lon-${p}`}
                      x1={SVG_W * p}
                      y1="0"
                      x2={SVG_W * p}
                      y2={SVG_H}
                      stroke="#ffffff"
                      strokeOpacity="0.05"
                      strokeWidth="1"
                    />
                  ))}

                  {koreaPath && (
                    <>
                      <path
                        d={koreaPath}
                        fillRule="evenodd"
                        fill="rgba(255, 75, 110, 0.04)"
                        stroke="#FF4B6E"
                        strokeOpacity="0.1"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <path
                        d={koreaPath}
                        fillRule="evenodd"
                        fill="none"
                        stroke="#ffffff"
                        strokeOpacity="0.5"
                        strokeWidth="0.8"
                        strokeLinejoin="round"
                      />
                    </>
                  )}

                  {/* 주요 도시 라벨 (희미) */}
                  {KOREA_CITIES.map((city) => {
                    const [cx, cy] = proj(city.lng, city.lat)
                    const [lx, ly] = city.labelOffset ?? [10, 4]
                    return (
                      <text
                        key={city.name}
                        x={cx + lx}
                        y={cy + ly}
                        fill="#ffffff"
                        opacity="0.45"
                        fontSize="11"
                        fontFamily="system-ui, sans-serif"
                      >
                        {city.name}
                      </text>
                    )
                  })}

                  {/* 라이브 핀 — filming + kpop */}
                  {visiblePins.map((pin) => {
                    const [cx, cy] = proj(pin.lng, pin.lat)
                    const color = CATEGORY_COLOR_MAP[pin.category]
                    const isHovered = hoveredPin?.id === pin.id
                    return (
                      <g
                        key={pin.id}
                        onMouseEnter={() => setHoveredPin(pin)}
                        onMouseLeave={() => setHoveredPin(null)}
                        style={{ cursor: "pointer" }}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 7 : 4.5}
                          fill={color}
                          opacity={isHovered ? 1 : 0.9}
                          style={{ transition: "r 120ms ease" }}
                        />
                        <circle cx={cx} cy={cy} r="2" fill="#ffffff" opacity="0.85" />
                      </g>
                    )
                  })}
                </svg>

                {/* 핀 hover 팝업 */}
                {hoveredPin && (
                  <div className="absolute top-2 right-2 bg-[#1a1a1a] border border-border/40 rounded-xl p-3 max-w-[220px] pointer-events-none shadow-xl">
                    <p className="text-foreground font-medium text-sm truncate">
                      {hoveredPin.name}
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5 truncate">
                      {hoveredPin.subtitle}
                    </p>
                    {hoveredPin.region && (
                      <p className="text-muted-foreground/70 text-[10px] mt-1">
                        {hoveredPin.region}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 우측 — 카피 + 카테고리 토글 */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 border border-border/40 bg-[#1a1a1a]">
                  <MapPin className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
                  <span className="text-xs text-muted-foreground font-medium">Curation K · HallyuMap</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
                  Korea, mapped for fans
                </h1>
                <p className="text-muted-foreground text-base mb-6">
                  Filming spots, K-pop pilgrimage sites, food, and stays —
                  layered onto one map.
                </p>

                {/* 카테고리 토글 */}
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    Categories
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => {
                      const active = activeCats.has(c.key)
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => toggleCategory(c.key)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-medium transition-colors"
                          style={
                            active
                              ? {
                                  backgroundColor: c.color,
                                  borderColor: c.color,
                                  color: "#fff",
                                }
                              : {
                                  backgroundColor: "#1a1a1a",
                                  borderColor: "rgba(255,255,255,0.1)",
                                  color: "rgba(255,255,255,0.6)",
                                }
                          }
                        >
                          <c.Icon className="w-3.5 h-3.5" />
                          {c.label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-muted-foreground/60 text-[11px] mt-2">
                    Food & Stays are region-based — pick a city below to load
                    cards.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───── 2. K-Drama Filming Spots ──────────────────── */}
        <SectionHeader
          Icon={Video}
          title="K-Drama Filming Spots"
          subtitle="Walk the cafés, stairs, and streets from the dramas you love."
          color={CATEGORY_COLOR_MAP.filming}
        />
        <div className="max-w-[1320px] mx-auto px-6 mb-16">
          {filmingLoading ? (
            <EmptyCard message="Loading filming spots..." />
          ) : filmingSpots.length === 0 ? (
            <EmptyCard
              message="No filming spots yet — daily extraction starts at 03:00 UTC."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filmingSpots.map((spot) => (
                <SpotCard
                  key={spot.id}
                  image={spot.image_url}
                  title={spot.spot_name}
                  subtitle={spot.drama_title}
                  region={spot.region}
                  address={spot.address}
                  badge={
                    spot.confidence >= 0.8 ? "Verified" : null
                  }
                  badgeColor={CATEGORY_COLOR_MAP.filming}
                  fallbackIcon={<Video className="w-6 h-6 text-muted-foreground" />}
                />
              ))}
            </div>
          )}
        </div>

        {/* ───── 3. K-Pop Pilgrimage Sites ─────────────────── */}
        <SectionHeader
          Icon={MicVocal}
          title="K-Pop Pilgrimage Sites"
          subtitle="Agencies, MV locations, idol-favorite cafés, concert venues."
          color={CATEGORY_COLOR_MAP.kpop}
        />
        <div className="max-w-[1320px] mx-auto px-6 mb-16">
          {kpopLoading ? (
            <EmptyCard message="Loading K-pop spots..." />
          ) : kpopSpots.length === 0 ? (
            <EmptyCard
              message="No K-pop spots curated yet. Admin curation begins post-launch."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {kpopSpots.map((spot) => (
                <SpotCard
                  key={spot.id}
                  image={spot.image_url}
                  title={spot.spot_name}
                  subtitle={spot.artist_name}
                  region={spot.region}
                  address={spot.address}
                  badge={prettySpotType(spot.spot_type)}
                  badgeColor={CATEGORY_COLOR_MAP.kpop}
                  fallbackIcon={<MicVocal className="w-6 h-6 text-muted-foreground" />}
                />
              ))}
            </div>
          )}
        </div>

        {/* ───── 4. Korean Food Hotspots ────────────────────── */}
        <SectionHeader
          Icon={UtensilsCrossed}
          title="Korean Food Hotspots"
          subtitle="Drama-famous restaurants + regional dishes, by neighborhood."
          color={CATEGORY_COLOR_MAP.food}
        />
        <div className="max-w-[1320px] mx-auto px-6 mb-16">
          <RegionPicker
            value={foodArea}
            onChange={setFoodArea}
            color={CATEGORY_COLOR_MAP.food}
          />
          {foodLoading ? (
            <EmptyCard message="Loading restaurants..." />
          ) : foodItems.length === 0 ? (
            <EmptyCard message="No restaurants returned for this region." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {foodItems.map((item) => (
                <SpotCard
                  key={item.contentId}
                  image={item.imageUrl}
                  title={item.title}
                  subtitle={item.address ?? ""}
                  region={null}
                  address={null}
                  badge={null}
                  badgeColor={CATEGORY_COLOR_MAP.food}
                  fallbackIcon={<UtensilsCrossed className="w-6 h-6 text-muted-foreground" />}
                  cta={
                    <Link
                      href="/food"
                      className="text-xs font-medium inline-flex items-center gap-0.5 hover:underline"
                      style={{ color: CATEGORY_COLOR_MAP.food }}
                    >
                      Cook it at home <ChevronRight className="w-3 h-3" />
                    </Link>
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* ───── 5. Themed Stays ───────────────────────────── */}
        <SectionHeader
          Icon={Hotel}
          title="Themed Stays"
          subtitle="Hotels, guesthouses, and hanok stays curated for fan trips."
          color={CATEGORY_COLOR_MAP.stays}
        />
        <div className="max-w-[1320px] mx-auto px-6 mb-16">
          <RegionPicker
            value={stayArea}
            onChange={setStayArea}
            color={CATEGORY_COLOR_MAP.stays}
          />
          {stayLoading ? (
            <EmptyCard message="Loading stays..." />
          ) : stayItems.length === 0 ? (
            <EmptyCard message="No stays returned for this region." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stayItems.map((item) => (
                <SpotCard
                  key={item.contentId}
                  image={item.imageUrl}
                  title={item.title}
                  subtitle={item.address ?? ""}
                  region={null}
                  address={null}
                  badge={null}
                  badgeColor={CATEGORY_COLOR_MAP.stays}
                  fallbackIcon={<Hotel className="w-6 h-6 text-muted-foreground" />}
                />
              ))}
            </div>
          )}
        </div>

        {/* ───── 6. AI 1-Day Course (Pro 잠금) ─────────────── */}
        <SectionHeader
          Icon={Sparkles}
          title="AI 1-Day Course"
          subtitle="Claude generates a Hallyu day-trip from your taste."
          color="#FF4B6E"
          badge="Pro"
        />
        <div className="max-w-[1320px] mx-auto px-6 mb-16">
          <div className="relative">
            <div
              className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${
                isPro ? "" : "blur-[4px] pointer-events-none"
              }`}
            >
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
                <h3 className="text-foreground font-semibold mb-2">Personalized routes</h3>
                <p className="text-muted-foreground text-sm">
                  Linked to your KdramaMatch picks. Watched My Demon? Get a
                  Seoul day-trip built around its filming locations.
                </p>
              </div>
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
                <h3 className="text-foreground font-semibold mb-2">Walking + transit</h3>
                <p className="text-muted-foreground text-sm">
                  Each stop comes with realistic timing between locations, so
                  the course is actually walkable.
                </p>
              </div>
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
                <h3 className="text-foreground font-semibold mb-2">Save & reuse</h3>
                <p className="text-muted-foreground text-sm">
                  Your generated courses live in your profile — open them
                  again before your trip.
                </p>
              </div>
            </div>

            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl max-w-sm">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                  >
                    <Lock className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                  </div>
                  <p className="text-foreground font-medium mb-2">
                    AI 1-Day Course is a Pro feature
                  </p>
                  <p className="text-muted-foreground text-xs mb-4">
                    Personalized Hallyu day-trip routes generated from your
                    drama taste.
                  </p>
                  <Link href={isAuthenticated === false ? "/login?redirect=/curation-k" : "/signup"}>
                    <Button
                      className="px-6 py-2 rounded-full font-medium text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      Upgrade — $15/month
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {isPro && (
            <div className="mt-6 bg-[#141418] border border-border/30 rounded-2xl p-6 text-center">
              <p className="text-muted-foreground text-sm">
                Course generation launches with Phase 2 — your saved courses
                will appear here.
              </p>
            </div>
          )}
        </div>

        {/* ───── 7. Fan Map by Country (Geo widget) ────────── */}
        <SectionHeader
          Icon={Globe}
          title="Who fans love in"
          subtitle="K-pop artists ranked by Last.fm listeners in your country."
          color="#22d3ee"
        />
        <div className="max-w-[1320px] mx-auto px-6 mb-20">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <label className="text-muted-foreground text-xs uppercase tracking-wider">
              Country:
            </label>
            <select
              value={geoCountry}
              onChange={(e) => setGeoCountry(e.target.value)}
              className="bg-[#1a1a1a] border border-border/40 rounded-full px-3 py-1.5 text-sm text-foreground hover:border-border/70 focus:outline-none focus:ring-1 focus:ring-[#FF4B6E]"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {geoLoading ? (
            <EmptyCard message="Loading geo data..." />
          ) : geoItems.length === 0 ? (
            <EmptyCard
              message={`No K-pop matches yet in ${geoCountry}.`}
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {geoItems.map((g) => (
                <Link
                  key={g.artistId}
                  href={`/kpop/${g.artistId}`}
                  className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 hover:border-primary/40 hover:bg-[#222226] transition-colors flex items-center gap-3"
                >
                  {g.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.thumbnail_url}
                      alt={g.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-[#252525]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#252525] flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-medium truncate">
                      #{g.rank} {g.name}
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5 truncate">
                      {g.spot_count > 0
                        ? `${g.spot_count} spot${g.spot_count > 1 ? "s" : ""} mapped`
                        : "Profile only"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <FooterSection />
    </div>
  )
}

// ─── 보조 컴포넌트 ───────────────────────────────────────────

function SectionHeader({
  Icon,
  title,
  subtitle,
  color,
  badge,
}: {
  Icon: typeof Video
  title: string
  subtitle: string
  color: string
  badge?: string
}) {
  return (
    <div className="max-w-[1320px] mx-auto px-6 mb-5 mt-2">
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}1f` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">{title}</h2>
        {badge && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full text-white"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-sm pl-12">{subtitle}</p>
    </div>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
      {message}
    </div>
  )
}

function RegionPicker({
  value,
  onChange,
  color,
}: {
  value: string
  onChange: (v: string) => void
  color: string
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {AREA_OPTIONS.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
            style={
              active
                ? { backgroundColor: color, borderColor: color, color: "#fff" }
                : {
                    backgroundColor: "#1a1a1a",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.7)",
                  }
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function SpotCard({
  image,
  title,
  subtitle,
  region,
  address,
  badge,
  badgeColor,
  fallbackIcon,
  cta,
}: {
  image: string | null
  title: string
  subtitle: string
  region: string | null
  address: string | null
  badge: string | null
  badgeColor: string
  fallbackIcon: React.ReactNode
  cta?: React.ReactNode
}) {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/40 transition-colors">
      <div className="w-full aspect-[4/3] bg-[#252525] relative flex items-center justify-center">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={title}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          fallbackIcon
        )}
        {badge && (
          <span
            className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${badgeColor}cc`, color: "#fff" }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-foreground font-semibold text-sm line-clamp-1">{title}</h3>
        {subtitle && (
          <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{subtitle}</p>
        )}
        {(region || address) && (
          <p className="text-muted-foreground/60 text-[11px] mt-2 line-clamp-2">
            {region}
            {region && address ? " · " : ""}
            {address}
          </p>
        )}
        {cta && <div className="mt-3">{cta}</div>}
      </div>
    </div>
  )
}

function prettySpotType(t: KpopSpotItem["spot_type"]): string {
  switch (t) {
    case "agency":
      return "Agency"
    case "mv_location":
      return "MV"
    case "cafe":
      return "Café"
    case "concert_venue":
      return "Venue"
    default:
      return t
  }
}
