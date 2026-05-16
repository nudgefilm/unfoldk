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

// ⚠️ 지도 컴포넌트 수정 금지 (CLAUDE.md §6 / 2026-05-16). 도시·도서·polygon 스타일·
//    proj() 모두 동결 — 변경 필요 시 별도 PR + 사용자 사전 승인.
const KOREA_CITIES: Array<{
  name: string
  lng: number
  lat: number
  tier: "primary" | "secondary"
  labelOffset?: [number, number]
}> = [
  { name: "Seoul", lng: 126.978, lat: 37.5665, tier: "primary" },
  { name: "Chuncheon", lng: 127.7298, lat: 37.8813, tier: "secondary" },
  { name: "Gyeongju", lng: 129.2247, lat: 35.8562, tier: "secondary" },
  { name: "Busan", lng: 129.0756, lat: 35.1796, tier: "primary" },
  { name: "Gwangju", lng: 126.8526, lat: 35.1595, tier: "secondary", labelOffset: [-62, 4] },
  { name: "Jeju", lng: 126.5312, lat: 33.4996, tier: "primary", labelOffset: [-30, 18] },
]

// 50m TopoJSON 에 누락되는 부속 도서 — 영토 주권 표기 (독도·마라도) 포함 명시 마커.
// 독도·울릉은 실제 위경도면 화면상 본토에서 너무 멀어 한국 공식 지도 관용 (학교 교과서·우표·
// 뉴스 그래픽 등) 따라 displayLng/displayLat 로 본토 가까이 inset. 실제 좌표(lng/lat)는 그대로 보존.
// ⚠️ 수정 금지 (CLAUDE.md §6).
const KOREA_ISLANDS: Array<{
  name: string
  lng: number          // 실제 위경도
  lat: number
  displayLng?: number  // 시각 표기용 (생략 시 lng)
  displayLat?: number
  rx?: number
  ry?: number
  labelOnly?: boolean
  labelOffset: [number, number]
}> = [
  { name: "Baengnyeong", lng: 124.7, lat: 37.97, displayLng: 125.4, rx: 5, ry: 3, labelOffset: [9, -4] },
  { name: "Ulleung", lng: 130.85, lat: 37.5, labelOnly: true, labelOffset: [-55, 4] },
  { name: "Dokdo", lng: 131.87, lat: 37.24, displayLng: 131.0, displayLat: 37.33, rx: 2.6, ry: 1.4, labelOffset: [8, 4] },
  { name: "Marado", lng: 126.27, lat: 33.11, rx: 3.4, ry: 2, labelOffset: [-46, 12] },
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
  // /api/curation-k/kpop-spots 응답이 numeric → JSON 으로 string 가능성 있음 (Postgres numeric 직렬화)
  latitude: number | string | null
  longitude: number | string | null
  image_url: string | null
}

// /api/curation-k/map 의 filming 핀 (kpop 부분은 별도 endpoint 에서 가져옴)
interface MapFilmingPin {
  id: string
  category: "filming" | "kpop"
  name: string         // spot_name
  subtitle: string     // drama_title
  region: string | null
  address: string | null
  image_url: string | null
  lat: number
  lng: number
}

// 4개 카테고리 공통 오버레이 핀 — SVG sibling overlay 에서 렌더.
// food/stay 는 contentId 가 별도 prefix 로 충돌 방지.
interface OverlayPin {
  id: string
  category: Category
  name: string
  subtitle: string       // 드라마명 / 아티스트명 / 카테고리 라벨
  address: string | null
  image: string | null
  lat: number
  lng: number
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

// 모달 카테고리 영문 라벨 — 모달 카드 헤더 통일.
const CATEGORY_LABEL_EN: Record<Category, string> = {
  filming: "Filming Spot",
  kpop: "K-Pop Site",
  food: "Food Hotspot",
  stays: "Stay",
}

// 한글 → 영문 동기 매핑 — 광역시도 + 자주 등장하는 자치구·번화가.
// 매핑 안 된 한글은 translateAddress 가 strip. Haiku 호출 없이 즉시 변환.
const REGION_MAP: Record<string, string> = {
  "서울특별시": "Seoul", "서울": "Seoul",
  "부산광역시": "Busan", "부산": "Busan",
  "제주특별자치도": "Jeju", "제주": "Jeju",
  "인천광역시": "Incheon", "인천": "Incheon",
  "대구광역시": "Daegu", "대구": "Daegu",
  "대전광역시": "Daejeon", "대전": "Daejeon",
  "광주광역시": "Gwangju", "광주": "Gwangju",
  "울산광역시": "Ulsan", "울산": "Ulsan",
  "세종특별자치시": "Sejong", "세종": "Sejong",
  "경기도": "Gyeonggi", "강원도": "Gangwon",
  "충청북도": "Chungbuk", "충청남도": "Chungnam",
  "전라북도": "Jeonbuk", "전라남도": "Jeonnam",
  "경상북도": "Gyeongbuk", "경상남도": "Gyeongnam",
  "강남구": "Gangnam", "홍대": "Hongdae",
  "이태원": "Itaewon", "명동": "Myeongdong",
  "해운대구": "Haeundae", "종로구": "Jongno",
  "마포구": "Mapo", "송파구": "Songpa",
  "중구": "Jung-gu", "용산구": "Yongsan",
  "성동구": "Seongdong", "영등포구": "Yeongdeungpo",
}

// 한글 주소를 영문으로 best-effort 변환. REGION_MAP 매칭 후 나머지 한글 strip.
function translateAddress(addr: string | null | undefined): string {
  if (!addr) return ""
  let result = addr
  for (const [ko, en] of Object.entries(REGION_MAP)) {
    if (result.includes(ko)) {
      result = result.split(ko).join(en)
    }
  }
  // 나머지 한글 제거 + whitespace 정리. 영문·숫자·문장부호만 유지.
  return result
    .replace(/[ㄱ-ㆎ가-힣]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

// 장소명에 한글 포함 시 partial 영문 변환. 매칭 없으면 원본 그대로 (영문 spotName 대다수).
function translatePlaceName(name: string): string {
  if (!name) return ""
  // 한글 글자 없으면 그대로 (대부분 영문 spot_name)
  if (!/[가-힣]/.test(name)) return name
  const t = translateAddress(name)
  // 변환 후 빈 문자열이면 원본 유지 (정보 손실 방지)
  return t.length > 0 ? t : name
}

export default function CurationKPage() {
  const [koreaPath, setKoreaPath] = useState<string | null>(null)

  // 인증·플랜 (AI 1-Day Course Pro 가드용)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isPro, setIsPro] = useState(false)

  // 카테고리 필터 — 핀 오버레이 표시 카테고리 + (향후) 콘텐츠 섹션 스코프.
  // CLAUDE.md §6: 지도 SVG 자체는 동결. 본 토글은 SVG 외부의 absolute overlay 레이어를 제어.
  const [activeCats, setActiveCats] = useState<Set<Category>>(
    () => new Set(CATEGORIES.map((c) => c.key))
  )

  // 지도 핀 — filming 은 /api/curation-k/map (confirmed only) 에서 받음.
  // kpop/food/stay 는 아래 섹션 fetch 결과를 재사용.
  const [filmingMapPins, setFilmingMapPins] = useState<MapFilmingPin[]>([])

  // 클러스터/개별 핀 모달 view state — null = 닫힘.
  type ViewState =
    | { type: "cluster"; pins: OverlayPin[] }
    | { type: "pin"; pin: OverlayPin }
    | null
  const [viewState, setViewState] = useState<ViewState>(null)
  // 주소 변환은 REGION_MAP 동기 변환으로 전환 — Haiku lazy fetch 제거 (즉시 표시, 비용 0).

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

  // ─── 3. 지도 핀 — filming spots (confirmed only, GPS 보유) ───
  // SVG 내부에 그리지 않고, sibling absolute overlay 레이어에 HTML 핀으로 렌더 (CLAUDE.md §6).
  useEffect(() => {
    fetch("/api/curation-k/map")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { pins: MapFilmingPin[] }) => {
        // /map 응답은 filming + kpop 양쪽 포함 — 본 페이지는 filming 만 사용. kpop 은 /kpop-spots 에서.
        const filming = (body.pins ?? []).filter((p) => p.category === "filming")
        setFilmingMapPins(filming)
      })
      .catch((err) => {
        console.warn("[curation-k] map filming pins fetch 실패:", err)
        setFilmingMapPins([])
      })
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

  // 카테고리 토글 — 핀 오버레이 표시 분기 + (향후) 콘텐츠 섹션 스코프 필터.
  const toggleCategory = (key: Category) => {
    setActiveCats((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ─── 오버레이 핀 컴퓨티드 ──────────────────────────────────
  // 4개 카테고리를 통합 OverlayPin[] 으로. activeCats 에 따라 필터링.
  // 지도 bbox 밖 좌표는 자동 제외 (proj() 결과가 SVG 영역 밖이면 표시 안 함).
  const overlayPins = useMemo<OverlayPin[]>(() => {
    const out: OverlayPin[] = []

    if (activeCats.has("filming")) {
      for (const p of filmingMapPins) {
        out.push({
          id: `f-${p.id}`,
          category: "filming",
          name: p.name,
          subtitle: p.subtitle,
          address: p.address,
          image: p.image_url,
          lat: p.lat,
          lng: p.lng,
        })
      }
    }

    if (activeCats.has("kpop")) {
      for (const k of kpopSpots) {
        const lat = typeof k.latitude === "string" ? Number(k.latitude) : k.latitude
        const lng = typeof k.longitude === "string" ? Number(k.longitude) : k.longitude
        if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue
        if (lat === 0 || lng === 0) continue
        out.push({
          id: `k-${k.id}`,
          category: "kpop",
          name: k.spot_name,
          subtitle: k.artist_name,
          address: k.address,
          image: k.image_url,
          lat,
          lng,
        })
      }
    }

    if (activeCats.has("food")) {
      for (const f of foodItems) {
        if (f.latitude === null || f.longitude === null) continue
        out.push({
          id: `food-${f.contentId}`,
          category: "food",
          name: f.title,
          subtitle: "Restaurant",
          address: f.address,
          image: f.imageUrl,
          lat: f.latitude,
          lng: f.longitude,
        })
      }
    }

    if (activeCats.has("stays")) {
      for (const s of stayItems) {
        if (s.latitude === null || s.longitude === null) continue
        out.push({
          id: `stay-${s.contentId}`,
          category: "stays",
          name: s.title,
          subtitle: "Stay",
          address: s.address,
          image: s.imageUrl,
          lat: s.latitude,
          lng: s.longitude,
        })
      }
    }

    return out
  }, [activeCats, filmingMapPins, kpopSpots, foodItems, stayItems])

  // ─── 클러스터링 — 5% SVG 거리 그리디 ────────────────────────
  // SVG 좌표계에서 두 핀 간 유클리드 거리가 SVG_W * 0.05 이내면 한 클러스터.
  // 단순 그리디 (O(n²)) — 핀 수 60건 미만 가정으로 충분.
  // 단일 핀은 cluster.size===1, 다중 핀은 cluster.size>=2.
  const clusters = useMemo(() => {
    const CLUSTER_THRESHOLD_PX = SVG_W * 0.05 // SVG 단위 거리
    type Cluster = { x: number; y: number; pins: OverlayPin[] }

    const projected: Array<{ pin: OverlayPin; x: number; y: number }> = overlayPins.map((p) => {
      const [x, y] = proj(p.lng, p.lat)
      return { pin: p, x, y }
    })

    const used = new Set<number>()
    const out: Cluster[] = []
    for (let i = 0; i < projected.length; i++) {
      if (used.has(i)) continue
      const seed = projected[i]
      const bucket: OverlayPin[] = [seed.pin]
      used.add(i)

      for (let j = i + 1; j < projected.length; j++) {
        if (used.has(j)) continue
        const other = projected[j]
        const dx = other.x - seed.x
        const dy = other.y - seed.y
        if (dx * dx + dy * dy <= CLUSTER_THRESHOLD_PX * CLUSTER_THRESHOLD_PX) {
          bucket.push(other.pin)
          used.add(j)
        }
      }
      out.push({ x: seed.x, y: seed.y, pins: bucket })
    }
    return out
  }, [overlayPins])

  // SVG 좌표 → wrapper 내 % 좌표 (재사용).
  function pctPosition(x: number, y: number): { left: string; top: string } {
    return {
      left: `${(x / SVG_W) * 100}%`,
      top: `${(y / SVG_H) * 100}%`,
    }
  }

  // (pinPosition 은 pctPosition 으로 통합 — 위 clusters useMemo 직후 정의)

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      <main className="flex-1 w-full">
        {/* ───── 1. Hero + Map ─────────────────────────────── */}
        <section className="relative w-full overflow-hidden">
          <div className="max-w-[1320px] mx-auto px-6 pt-10 pb-12 md:pt-14 md:pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 items-start">
              {/* 지도 — ⚠️ 동결 컴포넌트 (CLAUDE.md §6 "curation-k 지도 컴포넌트 수정 금지").
                  Korea polygon + 6 도시 (펄스) + 부속 도서 4종 (Baengnyeong/Ulleung/Dokdo/Marado).
                  변경 필요 시 별도 PR + 사용자 사전 승인 후 진행. */}
              <div className="relative w-full max-w-[640px] mx-auto lg:mx-0 aspect-square">
                <svg
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  className="w-full h-full"
                  aria-label="Map of South Korea"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* 위도·경도 hint 그리드 — 매우 절제 */}
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

                  {/* 실사 South Korea polygon — 깔끔한 outline only */}
                  {koreaPath && (
                    <>
                      <path
                        d={koreaPath}
                        fillRule="evenodd"
                        fill="none"
                        stroke="#FF4B6E"
                        strokeOpacity="0.08"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <path
                        d={koreaPath}
                        fillRule="evenodd"
                        fill="none"
                        stroke="#ffffff"
                        strokeOpacity="0.55"
                        strokeWidth="0.8"
                        strokeLinejoin="round"
                      />
                    </>
                  )}

                  {/* 부속 도서 — 50m TopoJSON 누락 보완. 본토와 동일한 outline 스타일.
                      독도·울릉은 displayLng/displayLat inset 으로 본토 가까이 시각화. */}
                  {KOREA_ISLANDS.map((island) => {
                    const [cx, cy] = proj(island.displayLng ?? island.lng, island.displayLat ?? island.lat)
                    const [lx, ly] = island.labelOffset
                    return (
                      <g key={island.name}>
                        {!island.labelOnly && island.rx !== undefined && island.ry !== undefined && (
                          <>
                            <ellipse
                              cx={cx}
                              cy={cy}
                              rx={island.rx}
                              ry={island.ry}
                              fill="none"
                              stroke="#FF4B6E"
                              strokeOpacity="0.08"
                              strokeWidth="1.2"
                            />
                            <ellipse
                              cx={cx}
                              cy={cy}
                              rx={island.rx}
                              ry={island.ry}
                              fill="none"
                              stroke="#ffffff"
                              strokeOpacity="0.55"
                              strokeWidth="0.7"
                            />
                          </>
                        )}
                        <text
                          x={cx + lx}
                          y={cy + ly}
                          fill="#ffffff"
                          opacity="0.6"
                          fontSize="10"
                          fontStyle="italic"
                          fontFamily="system-ui, sans-serif"
                        >
                          {island.name}
                        </text>
                      </g>
                    )
                  })}

                  {/* 도시 마커 — primary 핑크 펄스, secondary 정지 점 */}
                  {KOREA_CITIES.map((city) => {
                    const [cx, cy] = proj(city.lng, city.lat)
                    const [lx, ly] = city.labelOffset ?? [10, 4]
                    return (
                      <g key={city.name}>
                        {city.tier === "primary" && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r="11"
                            fill="#FF4B6E"
                            opacity="0.28"
                            className="animate-ping"
                            style={{ transformOrigin: `${cx}px ${cy}px` }}
                          />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={city.tier === "primary" ? 5 : 3.5}
                          fill="#FF4B6E"
                        />
                        <text
                          x={cx + lx}
                          y={cy + ly}
                          fill="#ffffff"
                          opacity="0.78"
                          fontSize="12"
                          fontFamily="system-ui, sans-serif"
                        >
                          {city.name}
                        </text>
                      </g>
                    )
                  })}
                </svg>

                {/* ─── 핀 오버레이 (클러스터링) ────────────────────────────
                    ⚠️ 위 SVG 는 동결 (CLAUDE.md §6). 핀은 sibling absolute <div> 로
                    렌더링 — SVG 내부 element 추가 금지 원칙 유지하면서 동일 좌표계 사용.
                    pointer-events 분리: layer none / 핀 auto → SVG 자체는 클릭 X.
                    클러스터링: 5% SVG 거리 그리디. size 1 = 단일 핀, size 2+ = 배지. */}
                <div className="absolute inset-0 pointer-events-none">
                  {clusters.map((cluster, idx) => {
                    const pos = pctPosition(cluster.x, cluster.y)
                    const size = cluster.pins.length

                    // 단일 핀 — 카테고리 색상 원
                    if (size === 1) {
                      const pin = cluster.pins[0]
                      const color = CATEGORY_COLOR_MAP[pin.category]
                      const isSelected =
                        viewState?.type === "pin" && viewState.pin.id === pin.id
                      return (
                        <button
                          key={`p-${pin.id}`}
                          type="button"
                          onClick={() => setViewState({ type: "pin", pin })}
                          aria-label={`${pin.name} (${pin.category})`}
                          className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md hover:scale-[1.4] focus:outline-none focus:ring-2 focus:ring-white/40 transition-transform"
                          style={{
                            left: pos.left,
                            top: pos.top,
                            width: isSelected ? 28 : 20,
                            height: isSelected ? 28 : 20,
                            backgroundColor: color,
                            border: `${isSelected ? 3 : 2}px solid ${isSelected ? "#ffffff" : "rgba(255,255,255,0.8)"}`,
                            zIndex: isSelected ? 20 : 10,
                          }}
                        />
                      )
                    }

                    // 클러스터 배지 — 카테고리 단일이면 그 색, 혼합이면 흰색+검정 글자
                    const cats = new Set(cluster.pins.map((p) => p.category))
                    const isMixed = cats.size > 1
                    const onlyCat = isMixed ? null : (cluster.pins[0].category as Category)
                    const bg = isMixed ? "#ffffff" : CATEGORY_COLOR_MAP[onlyCat as Category]
                    const fg = isMixed ? "#0d0d0f" : "#ffffff"

                    return (
                      <button
                        key={`c-${idx}`}
                        type="button"
                        onClick={() => setViewState({ type: "cluster", pins: cluster.pins })}
                        aria-label={`Cluster of ${size} spots`}
                        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/40 transition-transform flex items-center justify-center font-bold"
                        style={{
                          left: pos.left,
                          top: pos.top,
                          width: 32,
                          height: 32,
                          backgroundColor: bg,
                          color: fg,
                          border: "2px solid rgba(255,255,255,0.9)",
                          fontSize: 13,
                          zIndex: 15,
                        }}
                      >
                        {size}
                      </button>
                    )
                  })}
                </div>
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
          id="filming-section"
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
          id="kpop-section"
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
          id="food-section"
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
          id="stays-section"
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
                    Coming with Hallyu Pass
                  </p>
                  <p className="text-muted-foreground text-xs mb-4">
                    Personalized Hallyu day-trip routes generated from your drama taste — arriving at launch.
                  </p>
                  <Link href={isAuthenticated === false ? "/login?redirect=/curation-k" : "/signup"}>
                    <Button
                      className="px-6 py-2 rounded-full font-medium text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      Notify me at launch
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

      {/* ─── 핀 모달 (cluster list / pin detail) ─────────────────
          중앙 모달. 클러스터 → 목록, 항목 클릭 → pin detail 전환.
          닫기: × 버튼 또는 backdrop 클릭. */}
      <PinModal
        view={viewState}
        onClose={() => setViewState(null)}
        onSelectPin={(pin) => setViewState({ type: "pin", pin })}
      />

      <FooterSection />
    </div>
  )
}

// ─── PinModal ──────────────────────────────────────────────────
// cluster 모드: 핀 목록 표시 → 클릭 시 pin detail 로 전환.
// pin 모드: 이미지 + 상세 + "View in section" 스크롤 버튼.
// CLAUDE.md §6 동결 원칙 — 지도 SVG 외부 component 라 자유 수정 가능.
function PinModal({
  view,
  onClose,
  onSelectPin,
}: {
  view:
    | { type: "cluster"; pins: OverlayPin[] }
    | { type: "pin"; pin: OverlayPin }
    | null
  onClose: () => void
  onSelectPin: (pin: OverlayPin) => void
}) {
  if (!view) return null

  // 카테고리 → 섹션 id 매핑
  const SECTION_ID: Record<Category, string> = {
    filming: "filming-section",
    kpop: "kpop-section",
    food: "food-section",
    stays: "stays-section",
  }

  const handleScrollTo = (cat: Category) => {
    if (typeof document === "undefined") return
    const el = document.getElementById(SECTION_ID[cat])
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
    onClose()
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#141416] border border-border/40 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={stop}
      >
        {/* ─── Cluster 목록 ──────────────────────────────────── */}
        {view.type === "cluster" && (
          <>
            <div className="flex items-start justify-between gap-2 p-5 border-b border-border/30">
              <div>
                <p className="text-foreground font-semibold text-base">
                  {view.pins.length} spots here
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Tap an item to view details
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground -mr-2 -mt-2 p-2"
              >
                ×
              </button>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border/20">
              {view.pins.map((pin) => {
                const enName = translatePlaceName(pin.name)
                const enAddr = translateAddress(pin.address)
                return (
                  <li key={pin.id}>
                    <button
                      type="button"
                      onClick={() => onSelectPin(pin)}
                      className="w-full text-left px-5 py-3 hover:bg-[#1a1a1a] transition-colors flex items-start gap-3"
                    >
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLOR_MAP[pin.category] }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground text-sm font-medium truncate">
                          {enName}
                        </p>
                        <p className="text-muted-foreground text-xs mt-0.5 truncate">
                          <span className="uppercase tracking-wider mr-1.5">
                            {CATEGORY_LABEL_EN[pin.category]}
                          </span>
                          · {pin.subtitle}
                        </p>
                        {enAddr && (
                          <p className="text-muted-foreground/60 text-[11px] mt-1 truncate">
                            {enAddr}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {/* ─── Pin detail ──────────────────────────────────── */}
        {view.type === "pin" && (() => {
          const enName = translatePlaceName(view.pin.name)
          const enAddr = translateAddress(view.pin.address)
          return (
            <>
              {view.pin.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={view.pin.image}
                  alt={enName}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-[16/9] object-cover bg-[#252525]"
                />
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLOR_MAP[view.pin.category] }}
                      />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {CATEGORY_LABEL_EN[view.pin.category]}
                      </span>
                    </div>
                    <h3 className="text-foreground font-semibold text-lg leading-tight">
                      {enName}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="text-muted-foreground hover:text-foreground -mr-2 -mt-2 p-2 flex-shrink-0"
                  >
                    ×
                  </button>
                </div>

                {view.pin.subtitle && (
                  <p className="text-muted-foreground text-sm mb-3">{view.pin.subtitle}</p>
                )}

                {enAddr && (
                  <div className="bg-[#1a1a1a] rounded-lg p-3 mb-4 text-sm">
                    <p className="text-muted-foreground/70 text-[10px] uppercase tracking-wider mb-1">
                      Address
                    </p>
                    <p className="text-foreground/90 leading-snug">{enAddr}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleScrollTo(view.pin.category)}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: CATEGORY_COLOR_MAP[view.pin.category] }}
                >
                  View in section
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )
        })()}
      </div>
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
  id,
}: {
  Icon: typeof Video
  title: string
  subtitle: string
  color: string
  badge?: string
  id?: string
}) {
  return (
    <div id={id} className="max-w-[1320px] mx-auto px-6 mb-5 mt-2 scroll-mt-20">
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
