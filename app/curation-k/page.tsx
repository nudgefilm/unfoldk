"use client"

// /curation-k — Curation K (M+5 / HallyuMap) 본격 구현
//
// Phase 1 섹션 (이 파일):
//   1. Hero — South Korea SVG 지도 + 카테고리 필터 토글 + 라이브 핀 (filming + kpop)
//   2. K-Drama Filming Spots — filming_spots DB 카드 그리드 + 드라마 필터
//   3. K-Pop Pilgrimage Sites — kpop_spots DB, Last.fm 인기 순서
//   4. Korean Food Hotspots — TourAPI 음식점 (region picker)
//   5. Themed Stays — TourAPI 숙박 (region picker)
//   6. My Hallyu Course — Pro 잠금 UI (Phase 2 에서 Claude 생성 결합). 이전 명칭 "AI 1-Day Course".
//   7. Fan Map by Country — Last.fm geo.getTopArtists × kpop_artists
//
// 카테고리 아이콘 (사용자 지정):
//   촬영지 = Video / K팝 성지 = MicVocal / 음식점 = UtensilsCrossed / 숙박 = Hotel
//
// 다크테마 유지 (#0d0d0f bg, #FF4B6E brand, glass cards).
// 지도 인프라 (TopoJSON + projection + 도시·도서 마커) 는 기존 패턴 보존.

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { feature } from "topojson-client"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Landmark,
  Palette,
  PartyPopper,
  ExternalLink,
  Trash2,
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

// 2026-05-19 사용자 명시 요청 — 시각 단순화.
// Seoul / Busan / Jeju 만 펄스 표시 (primary 강조). 나머지 광역시도 점은
// SVG 외부 sibling overlay 에서 그림 (REGION_CENTROIDS 기준).
// 부속 도서 (Baengnyeong / Ulleung / Dokdo / Marado) 마커·라벨은 모두 제거.
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

// /api/curation-k/spots 응답 — filming/tour 양쪽을 동일 shape 로 정규화
interface SpotItem {
  id: string
  content_id: string
  title: string
  korean_title: string | null
  subtitle: string | null
  address: string | null
  addr2: string | null
  description: string | null
  overview_ko: string | null
  image_url: string | null
  image_url2: string | null
  homepage: string | null
  drama_title: string | null
  region: string | null
  area_code: number | null
  content_type_id: number | null
  badge: string | null
  latitude: number | null
  longitude: number | null
}

// 통합 탭 — 사용자 spec 순서: [촬영지] [관광지] [맛집] [숙박] [문화시설] [축제·행사]
type TabKey = "filming" | "attractions" | "food" | "stays" | "culture" | "festivals"

interface TabDef {
  key: TabKey
  label: string
  Icon: typeof Video
  color: string
  proLocked: boolean
  emptyMessage: string
}

const TABS: readonly TabDef[] = [
  {
    key: "filming",
    label: "Filming Spots",
    Icon: Video,
    color: "#FF4B6E",
    proLocked: false,
    emptyMessage: "No filming spots yet — daily extraction starts at 03:00 UTC.",
  },
  {
    key: "attractions",
    label: "Attractions",
    Icon: Landmark,
    color: "#22d3ee",
    proLocked: true,
    emptyMessage: "No attractions in this view.",
  },
  {
    key: "food",
    label: "Food",
    Icon: UtensilsCrossed,
    color: "#facc15",
    proLocked: true,
    emptyMessage: "No restaurants in this view.",
  },
  {
    key: "stays",
    label: "Stays",
    Icon: Hotel,
    color: "#a78bfa",
    proLocked: true,
    emptyMessage: "No stays in this view.",
  },
  {
    key: "culture",
    label: "Culture",
    Icon: Palette,
    color: "#f472b6",
    proLocked: true,
    emptyMessage: "No cultural venues in this view.",
  },
  {
    key: "festivals",
    label: "Festivals",
    Icon: PartyPopper,
    color: "#fb923c",
    proLocked: false,
    emptyMessage: "No upcoming festivals. Check back soon.",
  },
] as const

const SPOTS_PAGE_SIZE = 21

// 17개 광역시도 — lib/api/tourapi.ts AREA_CODE 와 정합. 클라이언트 직접 import 회피 위해 인라인.
const REGION_OPTIONS: ReadonlyArray<{ code: number; label: string }> = [
  { code: 1, label: "Seoul" },
  { code: 2, label: "Incheon" },
  { code: 3, label: "Daejeon" },
  { code: 4, label: "Daegu" },
  { code: 5, label: "Gwangju" },
  { code: 6, label: "Busan" },
  { code: 7, label: "Ulsan" },
  { code: 8, label: "Sejong" },
  { code: 31, label: "Gyeonggi" },
  { code: 32, label: "Gangwon" },
  { code: 33, label: "Chungcheongbuk" },
  { code: 34, label: "Chungcheongnam" },
  { code: 35, label: "Gyeongsangbuk" },
  { code: 36, label: "Gyeongsangnam" },
  { code: 37, label: "Jeollabuk" },
  { code: 38, label: "Jeollanam" },
  { code: 39, label: "Jeju" },
] as const

// /api/curation-k/dramas 응답
interface DramaTitleOption {
  drama_title: string
  spot_count: number
}

// ─── My Hallyu Course — 폼 / 결과 / 저장 목록 타입 ─────────────
type TravelStyle = "relaxed" | "packed" | "foodie" | "cultural"
type DurationDays = 1 | 2 | 3

interface CourseStop {
  name: string
  address: string
  reason?: string
  transport?: string
  duration_minutes?: number
}

interface CourseDay {
  day: number
  title: string
  morning: CourseStop[]
  afternoon: CourseStop[]
  evening: CourseStop[]
}

interface GeneratedItinerary {
  days: CourseDay[]
}

interface GeneratedCourse {
  itinerary: GeneratedItinerary
  meta: {
    drama_title: string
    travel_style: TravelStyle
    duration_days: DurationDays
    departure_region: string
  }
}

interface SavedCourse {
  id: string
  title: string
  region: string | null
  course_data: {
    drama_title: string
    travel_style: TravelStyle
    duration_days: DurationDays
    departure_region: string
    itinerary: GeneratedItinerary
    generated_at: string
  }
  created_at: string
}

const TRAVEL_STYLE_OPTIONS: ReadonlyArray<{ value: TravelStyle; label: string }> = [
  { value: "relaxed", label: "Relaxed" },
  { value: "packed", label: "Packed" },
  { value: "foodie", label: "Foodie" },
  { value: "cultural", label: "Cultural" },
]

const DURATION_OPTIONS: ReadonlyArray<{ value: DurationDays; label: string }> = [
  { value: 1, label: "1 day" },
  { value: 2, label: "2 days" },
  { value: 3, label: "3 days" },
]

// /api/curation-k/stats 응답
interface RegionStatsBreakdown {
  filming: number
  attractions: number
  culture: number
  festivals: number
  stays: number
  food: number
}

interface CurationStats {
  total: number
  filming: number
  attractions: number
  culture: number
  festivals: number
  stays: number
  food: number
  byRegion: Record<string, RegionStatsBreakdown>
}

// 17 광역시도 중심점 — SVG sibling overlay hover hit target 위치용.
// proj() 좌표계 재사용. label 은 REGION_OPTIONS 와 동일하게 영문.
const REGION_CENTROIDS: ReadonlyArray<{
  code: number
  label: string
  lng: number
  lat: number
}> = [
  { code: 1, label: "Seoul", lng: 126.978, lat: 37.5665 },
  { code: 2, label: "Incheon", lng: 126.7052, lat: 37.4563 },
  { code: 3, label: "Daejeon", lng: 127.3845, lat: 36.3504 },
  { code: 4, label: "Daegu", lng: 128.6014, lat: 35.8714 },
  { code: 5, label: "Gwangju", lng: 126.8526, lat: 35.1595 },
  { code: 6, label: "Busan", lng: 129.0756, lat: 35.1796 },
  { code: 7, label: "Ulsan", lng: 129.3114, lat: 35.5384 },
  { code: 8, label: "Sejong", lng: 127.2891, lat: 36.4801 },
  { code: 31, label: "Gyeonggi", lng: 127.0, lat: 37.27 },
  { code: 32, label: "Gangwon", lng: 128.1555, lat: 37.8228 },
  { code: 33, label: "Chungcheongbuk", lng: 127.7298, lat: 36.8 },
  { code: 34, label: "Chungcheongnam", lng: 126.65, lat: 36.6 },
  { code: 35, label: "Gyeongsangbuk", lng: 128.7427, lat: 36.4919 },
  { code: 36, label: "Gyeongsangnam", lng: 128.2132, lat: 35.25 },
  { code: 37, label: "Jeollabuk", lng: 127.15, lat: 35.7175 },
  { code: 38, label: "Jeollanam", lng: 126.99, lat: 34.8161 },
  { code: 39, label: "Jeju", lng: 126.5312, lat: 33.4996 },
] as const

interface GeoArtistItem {
  artistId: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  listeners: number | null
  rank: number
  spot_count: number
}

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

  // 인증·플랜 (My Hallyu Course Pro 가드용)
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

  // 통합 탭 그리드 (filming / attractions / food / stays / culture / festivals)
  const [activeTab, setActiveTab] = useState<TabKey>("filming")
  const [spotsItems, setSpotsItems] = useState<SpotItem[]>([])
  const [spotsTotal, setSpotsTotal] = useState<number | null>(null)
  const [spotsLoading, setSpotsLoading] = useState(true)
  const [spotsLocked, setSpotsLocked] = useState(false)
  const [spotsPage, setSpotsPage] = useState(1)

  // 필터 — 지역 (모든 탭 공통), 드라마 (Filming 탭 + Pro 전용)
  // "all" = 미적용 (API 에 미전달)
  const [filterArea, setFilterArea] = useState<string>("all")
  const [filterDrama, setFilterDrama] = useState<string>("all")
  const [dramaOptions, setDramaOptions] = useState<DramaTitleOption[]>([])

  // 카드 클릭 → 상세 모달
  const [selectedSpot, setSelectedSpot] = useState<SpotItem | null>(null)

  // 지도 통계 오버레이 — /api/curation-k/stats
  const [stats, setStats] = useState<CurationStats | null>(null)
  const [hoveredRegion, setHoveredRegion] = useState<number | null>(null)

  // ── My Hallyu Course (Pro) ────────────────────────────────
  const [courseDrama, setCourseDrama] = useState<string>("")
  const [courseStyle, setCourseStyle] = useState<TravelStyle>("relaxed")
  const [courseDays, setCourseDays] = useState<DurationDays>(1)
  const [courseDeparture, setCourseDeparture] = useState<string>("Seoul")
  const [courseGenerating, setCourseGenerating] = useState(false)
  const [courseSaving, setCourseSaving] = useState(false)
  const [courseError, setCourseError] = useState<string | null>(null)
  const [generatedCourse, setGeneratedCourse] = useState<GeneratedCourse | null>(null)
  const [generatedSaved, setGeneratedSaved] = useState(false)
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([])
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null)

  // 페이지네이션 클릭 시 그리드 상단 스크롤. 초기 마운트는 건너뜀.
  const tabAnchorRef = useRef<HTMLDivElement>(null)
  const skipScrollRef = useRef(true)
  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false
      return
    }
    tabAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [spotsPage])

  // K팝 성지 섹션 데이터 (탭과 별개, 자체 섹션 유지)
  const [kpopSpots, setKpopSpots] = useState<KpopSpotItem[]>([])
  const [kpopLoading, setKpopLoading] = useState(true)

  // Food / Stay 상태는 hero 지도 오버레이용으로만 유지 (Seoul 고정).
  // Step 5 (지도 통계 오버레이) 에서 별도 데이터 소스로 교체 예정.
  const foodArea = "seoul"
  const [foodItems, setFoodItems] = useState<TourSpotItem[]>([])
  const stayArea = "seoul"
  const [stayItems, setStayItems] = useState<TourSpotItem[]>([])

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

  // ─── 4. 통합 탭 그리드 fetch ───────────────────────────────
  // 탭·필터 변경 시 page 1 로 리셋 (별도 effect)
  useEffect(() => {
    setSpotsPage(1)
  }, [activeTab, filterArea, filterDrama])

  // 탭이 Filming 이 아니면 드라마 필터 의미 없음 — 자동 해제
  useEffect(() => {
    if (activeTab !== "filming" && filterDrama !== "all") {
      setFilterDrama("all")
    }
  }, [activeTab, filterDrama])

  // 드라마 옵션 — mount 시 1회 fetch
  useEffect(() => {
    fetch("/api/curation-k/dramas")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { items: DramaTitleOption[] }) =>
        setDramaOptions(body.items ?? [])
      )
      .catch((err) => console.warn("[curation-k] dramas fetch 실패:", err))
  }, [])

  // 지도 통계 — mount 시 1회 fetch
  useEffect(() => {
    fetch("/api/curation-k/stats")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: CurationStats) => setStats(body))
      .catch((err) => console.warn("[curation-k] stats fetch 실패:", err))
  }, [])

  // My Hallyu Course — Pro 진입 시 저장 코스 목록 fetch
  useEffect(() => {
    if (!isPro) return
    fetch("/api/curation-k/course")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { items: SavedCourse[] }) => setSavedCourses(body.items ?? []))
      .catch((err) => console.warn("[curation-k] saved courses fetch 실패:", err))
  }, [isPro])

  // 드라마 옵션이 늦게 도착하면 첫 번째 드라마로 자동 set
  useEffect(() => {
    if (!courseDrama && dramaOptions.length > 0) {
      setCourseDrama(dramaOptions[0].drama_title)
    }
  }, [dramaOptions, courseDrama])

  async function handleGenerateCourse() {
    setCourseError(null)
    setGeneratedSaved(false)
    if (!courseDrama) {
      setCourseError("Pick a drama first.")
      return
    }
    setCourseGenerating(true)
    setGeneratedCourse(null)
    try {
      const res = await fetch("/api/curation-k/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drama_title: courseDrama,
          travel_style: courseStyle,
          duration_days: courseDays,
          departure_region: courseDeparture,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCourseError(
          json?.detail ?? json?.error ?? `Generation failed (HTTP ${res.status})`
        )
        return
      }
      setGeneratedCourse({ itinerary: json.itinerary, meta: json.meta })
    } catch (err) {
      setCourseError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setCourseGenerating(false)
    }
  }

  async function handleSaveCourse() {
    if (!generatedCourse) return
    setCourseSaving(true)
    setCourseError(null)
    try {
      const res = await fetch("/api/curation-k/course/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drama_title: generatedCourse.meta.drama_title,
          travel_style: generatedCourse.meta.travel_style,
          duration_days: generatedCourse.meta.duration_days,
          departure_region: generatedCourse.meta.departure_region,
          itinerary: generatedCourse.itinerary,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCourseError(json?.detail ?? json?.error ?? `Save failed (HTTP ${res.status})`)
        return
      }
      // 저장 성공 — 목록 갱신 + saved 표시
      setGeneratedSaved(true)
      if (json.item) {
        setSavedCourses((prev) => [json.item as SavedCourse, ...prev])
      }
    } catch (err) {
      setCourseError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setCourseSaving(false)
    }
  }

  // 저장된 코스 삭제 — 확인 없이 즉시 호출. 실패해도 UI 는 낙관 갱신 안 함 (롤백 X).
  async function handleDeleteCourse(courseId: string) {
    try {
      const res = await fetch(`/api/curation-k/course/${courseId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        console.warn(
          `[curation-k] course delete 실패 (HTTP ${res.status})`
        )
        return
      }
      setSavedCourses((prev) => prev.filter((c) => c.id !== courseId))
      if (expandedCourseId === courseId) setExpandedCourseId(null)
    } catch (err) {
      console.warn("[curation-k] course delete 예외:", err)
    }
  }

  // 지도 도시 클릭 → 지역 필터 set + 탭 그리드 스크롤
  const handleRegionClick = (areaCode: number) => {
    setFilterArea(String(areaCode))
    // tabAnchorRef 가 마운트되면 즉시 스크롤. 페이지 effect 도 따라가지만
    // 페이지가 이미 1 이면 scroll effect 가 트리거 안 돼 — 명시 호출.
    requestAnimationFrame(() => {
      tabAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  useEffect(() => {
    let cancelled = false
    setSpotsLoading(true)
    const qs = new URLSearchParams({
      tab: activeTab,
      page: String(spotsPage),
      pageSize: String(SPOTS_PAGE_SIZE),
    })
    if (filterArea !== "all") qs.set("area_code", filterArea)
    if (activeTab === "filming" && filterDrama !== "all") {
      qs.set("drama_title", filterDrama)
    }
    fetch(`/api/curation-k/spots?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: {
        items: SpotItem[]
        total: number | null
        locked: boolean
      }) => {
        if (cancelled) return
        setSpotsItems(body.items ?? [])
        setSpotsTotal(body.total ?? null)
        setSpotsLocked(body.locked === true)
      })
      .catch((err) => {
        console.warn(`[curation-k] spots(${activeTab}) fetch 실패:`, err)
        if (cancelled) return
        setSpotsItems([])
        setSpotsTotal(0)
        setSpotsLocked(false)
      })
      .finally(() => {
        if (cancelled) return
        setSpotsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, spotsPage, filterArea, filterDrama])

  // ─── 5. K팝 성지 카드 ──────────────────────────────────────
  useEffect(() => {
    setKpopLoading(true)
    fetch("/api/curation-k/kpop-spots?limit=12")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { items: KpopSpotItem[] }) => setKpopSpots(body.items ?? []))
      .catch((err) => console.warn("[curation-k] kpop fetch 실패:", err))
      .finally(() => setKpopLoading(false))
  }, [])

  // ─── 6. Food / Stays — hero 오버레이 핀 전용 (Seoul 고정, mount 시 1회) ──
  useEffect(() => {
    fetch(`/api/curation-k/food?area=${foodArea}&limit=8`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { items: TourSpotItem[] }) => setFoodItems(body.items ?? []))
      .catch((err) => console.warn("[curation-k] food fetch 실패:", err))
  }, [])

  useEffect(() => {
    fetch(`/api/curation-k/stays?area=${stayArea}&limit=8`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { items: TourSpotItem[] }) => setStayItems(body.items ?? []))
      .catch((err) => console.warn("[curation-k] stays fetch 실패:", err))
  }, [])

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

                  {/* 도시 마커 — Seoul/Busan/Jeju primary 펄스만 유지 (2026-05-19) */}
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

                {/* ─── 17 광역시도 hover overlay (SVG sibling) ─────────────
                    REGION_CENTROIDS 위에 transparent hit target. 호버 시 툴팁,
                    클릭 시 Region 필터 set + 탭 그리드 smooth scroll.
                    Seoul/Busan/Jeju 는 SVG 내부 펄스 별도 유지 — 시각 점 중복 회피. */}
                <div className="absolute inset-0 pointer-events-none">
                  {REGION_CENTROIDS.map((region) => {
                    const [cx, cy] = proj(region.lng, region.lat)
                    const pos = pctPosition(cx, cy)
                    const stat = stats?.byRegion?.[String(region.code)]
                    const isHovered = hoveredRegion === region.code
                    // Seoul(1) / Busan(6) / Jeju(39) 는 SVG 펄스가 시각 마커 역할
                    const hasPulse =
                      region.code === 1 || region.code === 6 || region.code === 39
                    return (
                      <button
                        key={`region-${region.code}`}
                        type="button"
                        onClick={() => handleRegionClick(region.code)}
                        onMouseEnter={() => setHoveredRegion(region.code)}
                        onMouseLeave={() =>
                          setHoveredRegion((prev) =>
                            prev === region.code ? null : prev
                          )
                        }
                        onFocus={() => setHoveredRegion(region.code)}
                        onBlur={() =>
                          setHoveredRegion((prev) =>
                            prev === region.code ? null : prev
                          )
                        }
                        aria-label={`${region.label} — view spots`}
                        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FF4B6E]/50"
                        style={{
                          left: pos.left,
                          top: pos.top,
                          width: 36,
                          height: 36,
                          backgroundColor: "transparent",
                          zIndex: isHovered ? 30 : 8,
                        }}
                      >
                        {/* 작은 점 마커 — 펄스 없는 14 광역시도만. 호버 ring 안쪽 중앙. */}
                        {!hasPulse && (
                          <span
                            aria-hidden="true"
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                            style={{
                              width: 5,
                              height: 5,
                              backgroundColor: "#FF4B6E",
                              opacity: isHovered ? 1 : 0.55,
                            }}
                          />
                        )}
                        <span
                          className="absolute inset-0 rounded-full transition-opacity"
                          style={{
                            backgroundColor: "rgba(255, 75, 110, 0.18)",
                            border: "1px solid rgba(255, 75, 110, 0.5)",
                            opacity: isHovered ? 1 : 0,
                          }}
                        />

                        {/* 툴팁 — 호버 시 노출. 카드 아래쪽으로 펼침 (위쪽 잘림 방지). */}
                        {isHovered && (
                          <div
                            role="tooltip"
                            className="absolute left-1/2 top-[42px] -translate-x-1/2 w-[180px] text-left bg-[#0d0d0f] border border-border/50 rounded-lg p-3 shadow-xl text-foreground"
                            style={{ zIndex: 40 }}
                          >
                            <p className="text-sm font-semibold mb-2">
                              {region.label}
                            </p>
                            <ul className="space-y-1 text-[11px]">
                              <RegionTooltipRow
                                label="Filming"
                                color="#FF4B6E"
                                value={stat?.filming}
                              />
                              <RegionTooltipRow
                                label="Attractions"
                                color="#22d3ee"
                                value={stat?.attractions}
                              />
                              <RegionTooltipRow
                                label="Food"
                                color="#facc15"
                                value={stat?.food}
                              />
                              <RegionTooltipRow
                                label="Stays"
                                color="#a78bfa"
                                value={stat?.stays}
                              />
                              <RegionTooltipRow
                                label="Culture"
                                color="#f472b6"
                                value={stat?.culture}
                              />
                              <RegionTooltipRow
                                label="Festivals"
                                color="#fb923c"
                                value={stat?.festivals}
                              />
                            </ul>
                            <p className="text-muted-foreground text-[10px] mt-2">
                              Click to filter
                            </p>
                          </div>
                        )}
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

                {/* 통계 배지 — Filming · Attractions · Food */}
                {stats && (
                  <div className="mt-6 pt-5 border-t border-border/30">
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
                      In the database
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="font-semibold" style={{ color: "#FF4B6E" }}>
                          {stats.filming.toLocaleString()}
                        </span>
                        <span className="text-muted-foreground text-xs">Filming</span>
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="font-semibold" style={{ color: "#22d3ee" }}>
                          {stats.attractions.toLocaleString()}
                        </span>
                        <span className="text-muted-foreground text-xs">Attractions</span>
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="font-semibold" style={{ color: "#facc15" }}>
                          {stats.food.toLocaleString()}
                        </span>
                        <span className="text-muted-foreground text-xs">Food</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ───── 2. 통합 탭 그리드 (filming/관광지/맛집/숙박/문화시설/축제) ── */}
        <SectionHeader
          Icon={MapPin}
          title="Explore Hallyu Korea"
          subtitle="Filming spots, attractions, food, stays, culture, and festivals — all in one view."
          color="#FF4B6E"
          id="explore-section"
        />
        <div className="max-w-[1320px] mx-auto px-6 mb-16">
          {/* 페이지네이션 스크롤 앵커 — 페이지 변경 시 이 지점으로 smooth scroll */}
          <div ref={tabAnchorRef} className="scroll-mt-24" aria-hidden="true" />

          {/* 필터 바 — 지역 (전 탭 공통) + 드라마 (Filming + Pro 전용) */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground text-xs uppercase tracking-wider">
                Region
              </label>
              <Select value={filterArea} onValueChange={setFilterArea}>
                <SelectTrigger
                  className="w-[180px] bg-[#1a1a1a] border-border/40 rounded-full text-sm"
                  aria-label="Filter by region"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {REGION_OPTIONS.map((r) => (
                    <SelectItem key={r.code} value={String(r.code)}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeTab === "filming" && (
              <div className="flex items-center gap-2">
                <label className="text-muted-foreground text-xs uppercase tracking-wider inline-flex items-center gap-1">
                  Drama
                  {!isPro && (
                    <Lock className="w-3 h-3" style={{ color: "#FF4B6E" }} />
                  )}
                </label>
                <Select
                  value={filterDrama}
                  onValueChange={setFilterDrama}
                  disabled={!isPro}
                >
                  <SelectTrigger
                    className="w-[240px] bg-[#1a1a1a] border-border/40 rounded-full text-sm disabled:opacity-50"
                    aria-label="Filter by drama"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dramas</SelectItem>
                    {dramaOptions.map((d) => (
                      <SelectItem key={d.drama_title} value={d.drama_title}>
                        {d.drama_title} ({d.spot_count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* 탭 바 — Pro 잠금 탭은 자물쇠 아이콘 표기 */}
          <div
            role="tablist"
            aria-label="Curation K categories"
            className="flex flex-wrap gap-2 mb-6"
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key
              const showLock = tab.proLocked && !isPro
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-colors"
                  style={
                    isActive
                      ? {
                          backgroundColor: tab.color,
                          borderColor: tab.color,
                          color: "#fff",
                        }
                      : {
                          backgroundColor: "#1a1a1a",
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.7)",
                        }
                  }
                >
                  <tab.Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {showLock && <Lock className="w-3 h-3 opacity-70" />}
                </button>
              )
            })}
          </div>

          {/* 그리드 본체 */}
          <SpotsTabPanel
            tab={TABS.find((t) => t.key === activeTab) ?? TABS[0]}
            items={spotsItems}
            total={spotsTotal}
            loading={spotsLoading}
            locked={spotsLocked}
            page={spotsPage}
            pageSize={SPOTS_PAGE_SIZE}
            onPageChange={setSpotsPage}
            isAuthenticated={isAuthenticated}
            onSelectSpot={setSelectedSpot}
          />
        </div>

        {/* 카드 상세 모달 — selectedSpot != null 일 때만 마운트 */}
        <SpotDetailDialog
          spot={selectedSpot}
          tab={TABS.find((t) => t.key === activeTab) ?? TABS[0]}
          isPro={isPro}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelectedSpot(null)}
        />

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

        {/* ───── 6. My Hallyu Course (Pro 잠금) ─────────────── */}
        <SectionHeader
          Icon={Sparkles}
          title="My Hallyu Course"
          subtitle="UnfoldK generates a Hallyu day-trip from your taste."
          color="#FF4B6E"
          badge="Pro"
        />
        <div className="max-w-[1320px] mx-auto px-6 mb-16">
          {!isPro ? (
            <div className="relative bg-[#141418] border border-border/30 rounded-2xl p-10 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
              >
                <Lock className="w-6 h-6" style={{ color: "#FF4B6E" }} />
              </div>
              <p className="text-foreground font-medium mb-2">Coming with Hallyu Pass</p>
              <p className="text-muted-foreground text-xs mb-4 max-w-md mx-auto">
                Personalized Hallyu day-trip routes built from your drama taste —
                arriving at launch.
              </p>
              <Link
                href={
                  isAuthenticated === false ? "/login?redirect=/curation-k" : "/signup"
                }
              >
                <Button
                  className="px-6 py-2 rounded-full font-medium text-white"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  Notify me at launch
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 입력 폼 */}
              <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-muted-foreground text-xs uppercase tracking-wider block mb-2">
                      Drama
                    </label>
                    <Select value={courseDrama} onValueChange={setCourseDrama}>
                      <SelectTrigger
                        className="w-full bg-[#0d0d0f] border-border/40 rounded-full text-sm"
                        aria-label="Pick a drama"
                      >
                        <SelectValue placeholder="Pick a drama" />
                      </SelectTrigger>
                      <SelectContent>
                        {dramaOptions.length === 0 && (
                          <SelectItem value="__loading__" disabled>
                            Loading…
                          </SelectItem>
                        )}
                        {dramaOptions.map((d) => (
                          <SelectItem key={d.drama_title} value={d.drama_title}>
                            {d.drama_title} ({d.spot_count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-muted-foreground text-xs uppercase tracking-wider block mb-2">
                      Departing from
                    </label>
                    <Select value={courseDeparture} onValueChange={setCourseDeparture}>
                      <SelectTrigger
                        className="w-full bg-[#0d0d0f] border-border/40 rounded-full text-sm"
                        aria-label="Departure region"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REGION_OPTIONS.map((r) => (
                          <SelectItem key={r.code} value={r.label}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-muted-foreground text-xs uppercase tracking-wider block mb-2">
                    Travel style
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TRAVEL_STYLE_OPTIONS.map((opt) => {
                      const active = courseStyle === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCourseStyle(opt.value)}
                          className="px-4 py-2 rounded-full text-xs font-medium border transition-colors"
                          style={
                            active
                              ? {
                                  backgroundColor: "#FF4B6E",
                                  borderColor: "#FF4B6E",
                                  color: "#fff",
                                }
                              : {
                                  backgroundColor: "#0d0d0f",
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
                </div>

                <div className="mb-5">
                  <label className="text-muted-foreground text-xs uppercase tracking-wider block mb-2">
                    Length
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map((opt) => {
                      const active = courseDays === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCourseDays(opt.value)}
                          className="px-4 py-2 rounded-full text-xs font-medium border transition-colors"
                          style={
                            active
                              ? {
                                  backgroundColor: "#FF4B6E",
                                  borderColor: "#FF4B6E",
                                  color: "#fff",
                                }
                              : {
                                  backgroundColor: "#0d0d0f",
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
                </div>

                <Button
                  type="button"
                  onClick={handleGenerateCourse}
                  disabled={courseGenerating || !courseDrama || dramaOptions.length === 0}
                  className="rounded-full text-white"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  {courseGenerating ? (
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      Creating your itinerary…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Generate My Course
                    </span>
                  )}
                </Button>

                {courseError && (
                  <p className="text-[#ef4444] text-xs mt-3">{courseError}</p>
                )}
              </div>

              {/* 생성 결과 */}
              {generatedCourse && (
                <CourseItineraryView
                  itinerary={generatedCourse.itinerary}
                  meta={generatedCourse.meta}
                  saved={generatedSaved}
                  saving={courseSaving}
                  onSave={handleSaveCourse}
                  onRegenerate={handleGenerateCourse}
                  regenerating={courseGenerating}
                />
              )}

              {/* 저장 목록 */}
              {savedCourses.length > 0 && (
                <div>
                  <h3 className="text-foreground font-semibold text-sm uppercase tracking-wider mb-3">
                    My Saved Courses
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {savedCourses.map((c) => {
                      const expanded = expandedCourseId === c.id
                      return (
                        <div
                          key={c.id}
                          className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden"
                        >
                          <div className="w-full p-4 flex items-start justify-between gap-2 hover:bg-[#22222a] transition-colors">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCourseId(expanded ? null : c.id)
                              }
                              className="min-w-0 flex-1 text-left focus:outline-none"
                              aria-expanded={expanded}
                              aria-controls={`course-${c.id}-body`}
                            >
                              <p className="text-foreground font-medium text-sm truncate">
                                {c.course_data.drama_title}
                              </p>
                              <p className="text-muted-foreground text-xs mt-1">
                                {prettyTravelStyle(c.course_data.travel_style)} ·{" "}
                                {c.course_data.duration_days}d · from{" "}
                                {c.course_data.departure_region}
                              </p>
                              <p className="text-muted-foreground/60 text-[11px] mt-1">
                                {new Date(c.created_at).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </button>
                            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                              <button
                                type="button"
                                onClick={() => handleDeleteCourse(c.id)}
                                aria-label="Delete course"
                                className="w-7 h-7 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-[#ef4444] hover:bg-[#0d0d0f] focus:outline-none focus:ring-2 focus:ring-[#ef4444]/40 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedCourseId(expanded ? null : c.id)
                                }
                                aria-label={expanded ? "Collapse" : "Expand"}
                                className="w-7 h-7 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[#0d0d0f] focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
                              >
                                <ChevronRight
                                  className={`w-4 h-4 transition-transform ${
                                    expanded ? "rotate-90" : ""
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                          {expanded && (
                            <div id={`course-${c.id}-body`} className="px-4 pb-4">
                              <CourseItineraryView
                                itinerary={c.course_data.itinerary}
                                meta={{
                                  drama_title: c.course_data.drama_title,
                                  travel_style: c.course_data.travel_style,
                                  duration_days: c.course_data.duration_days,
                                  departure_region: c.course_data.departure_region,
                                }}
                                compact
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
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
  onClick,
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
  onClick?: () => void
}) {
  const interactive = !!onClick
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={`bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/40 transition-colors ${
        interactive ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF4B6E]" : ""
      }`}
    >
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

// 통합 탭 그리드 본체 — 로딩 / 잠금 / 빈 / 카드 그리드 + 페이지네이션
function SpotsTabPanel({
  tab,
  items,
  total,
  loading,
  locked,
  page,
  pageSize,
  onPageChange,
  isAuthenticated,
  onSelectSpot,
}: {
  tab: TabDef
  items: SpotItem[]
  total: number | null
  loading: boolean
  locked: boolean
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  isAuthenticated: boolean | null
  onSelectSpot: (spot: SpotItem) => void
}) {
  // 1) 잠금 — Pro 전용 탭에 비Pro 접근 시
  if (locked) {
    return (
      <div className="relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 blur-[4px] pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <SpotCardSkeleton key={i} />
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl max-w-sm">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
            >
              <Lock className="w-6 h-6" style={{ color: "#FF4B6E" }} />
            </div>
            <p className="text-foreground font-medium mb-2">Coming with Hallyu Pass</p>
            <p className="text-muted-foreground text-xs mb-4">
              {tab.label} are part of Hallyu Pass — get notified when it goes live.
            </p>
            <Link
              href={
                isAuthenticated === false ? "/login?redirect=/curation-k" : "/signup"
              }
            >
              <Button
                className="px-6 py-2 rounded-full font-medium text-white"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                Notify me at launch
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 2) 로딩 — 스켈레톤 그리드
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SpotCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  // 3) 빈 상태
  if (items.length === 0) {
    return <EmptyCard message={tab.emptyMessage} />
  }

  // 4) 카드 그리드 + 페이지네이션
  const totalPages =
    total !== null && total > 0 ? Math.max(1, Math.ceil(total / pageSize)) : null
  const canPrev = page > 1
  const canNext =
    totalPages !== null ? page < totalPages : items.length === pageSize

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <SpotCard
            key={item.id}
            image={item.image_url}
            title={item.title}
            subtitle={item.subtitle ?? item.description ?? ""}
            region={item.region}
            address={item.address}
            badge={item.drama_title ?? item.badge}
            badgeColor={tab.color}
            fallbackIcon={<tab.Icon className="w-6 h-6 text-muted-foreground" />}
            onClick={() => onSelectSpot(item)}
          />
        ))}
      </div>

      {(canPrev || canNext) && (
        <div className="flex items-center justify-between mt-6 text-xs">
          <button
            type="button"
            onClick={() => canPrev && onPageChange(page - 1)}
            disabled={!canPrev}
            className="px-4 py-2 rounded-full bg-[#1a1a1a] border border-border/40 text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:border-border/70 transition-colors"
          >
            ← Prev
          </button>
          <div className="text-muted-foreground">
            Page {page}
            {totalPages !== null ? ` / ${totalPages}` : ""}
            {total !== null ? ` · ${total.toLocaleString()} total` : ""}
          </div>
          <button
            type="button"
            onClick={() => canNext && onPageChange(page + 1)}
            disabled={!canNext}
            className="px-4 py-2 rounded-full bg-[#1a1a1a] border border-border/40 text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:border-border/70 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

function SpotCardSkeleton() {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden">
      <div className="w-full aspect-[4/3] bg-[#252525] animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-[#252525] rounded w-3/4 animate-pulse" />
        <div className="h-3 bg-[#252525] rounded w-1/2 animate-pulse" />
        <div className="h-3 bg-[#252525] rounded w-2/3 animate-pulse mt-3" />
      </div>
    </div>
  )
}

// 카드 클릭 → 상세 모달
function SpotDetailDialog({
  spot,
  tab,
  isPro,
  isAuthenticated,
  onClose,
}: {
  spot: SpotItem | null
  tab: TabDef
  isPro: boolean
  isAuthenticated: boolean | null
  onClose: () => void
}) {
  // 이미지 갤러리: image_url + image_url2 (중복·빈 값 제거)
  const images = spot
    ? Array.from(
        new Set([spot.image_url, spot.image_url2].filter((s): s is string => !!s))
      )
    : []
  const [imageIndex, setImageIndex] = useState(0)

  // spot 바뀔 때 이미지 인덱스 리셋
  useEffect(() => {
    setImageIndex(0)
  }, [spot?.id])

  if (!spot) return null

  const fullAddress = [spot.address, spot.addr2].filter(Boolean).join(" ").trim()
  const description = spot.description || spot.overview_ko || null
  const hasGps = spot.latitude !== null && spot.longitude !== null
  const mapsUrl = hasGps
    ? `https://maps.google.com/?q=${spot.latitude},${spot.longitude}`
    : null
  // tab.key 가 "filming" 일 때만 드라마 배지
  const dramaBadge = tab.key === "filming" ? spot.drama_title : null

  return (
    <Dialog
      open={!!spot}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="bg-[#141416] border-[#2a2a2a] text-foreground max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* 이미지 갤러리 */}
        <div className="relative bg-[#252525] aspect-[16/9] flex items-center justify-center overflow-hidden">
          {images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={images[imageIndex]}
              src={images[imageIndex]}
              alt={spot.title}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <tab.Icon className="w-12 h-12 text-muted-foreground" />
          )}

          {dramaBadge && (
            <span
              className="absolute top-3 left-3 z-20 text-[11px] font-medium px-2.5 py-1 rounded-full shadow"
              style={{ backgroundColor: `${tab.color}e0`, color: "#fff" }}
            >
              {dramaBadge}
            </span>
          )}

          {/* 좌우 화살표 + 도트 — image_url2 가 image_url 과 다를 때만 노출 */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setImageIndex((i) => (i - 1 + images.length) % images.length)
                }}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white inline-flex items-center justify-center text-lg cursor-pointer"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setImageIndex((i) => (i + 1) % images.length)
                }}
                aria-label="Next image"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white inline-flex items-center justify-center text-lg cursor-pointer"
              >
                ›
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                {images.map((_, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        i === imageIndex ? "#fff" : "rgba(255,255,255,0.4)",
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-white leading-tight">
              {spot.title}
            </DialogTitle>
            {spot.korean_title && (
              <p className="text-muted-foreground text-sm mt-1">
                {spot.korean_title}
              </p>
            )}
          </DialogHeader>

          {/* 주소 */}
          {fullAddress && (
            <div className="flex items-start gap-2 text-sm mb-4">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p className="text-foreground/90 leading-snug">{fullAddress}</p>
            </div>
          )}

          {/* 설명 */}
          {description && (
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line mb-5">
              {description}
            </p>
          )}

          {/* CTA — homepage / Google Maps */}
          <div className="flex flex-wrap items-center gap-2">
            {spot.homepage && (
              <a
                href={extractFirstUrl(spot.homepage) ?? spot.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border border-border/40 bg-[#1a1a1a] hover:border-border/70 transition-colors text-foreground"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Official Website
              </a>
            )}

            {hasGps && mapsUrl && (
              isPro ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: tab.color }}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Open in Google Maps
                </a>
              ) : (
                <Link
                  href={
                    isAuthenticated === false
                      ? "/login?redirect=/curation-k"
                      : "/signup"
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border border-border/40 bg-[#1a1a1a] text-muted-foreground hover:border-border/70 transition-colors"
                  title="Coming with Hallyu Pass"
                >
                  <Lock className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
                  Google Maps · Pro
                </Link>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// TourAPI homepage 필드가 종종 <a href="..."> ... </a> 형태 HTML — href 만 추출.
// 추출 실패 시 호출자에서 raw 문자열 그대로 fallback.
function extractFirstUrl(raw: string): string | null {
  const hrefMatch = raw.match(/href=["']([^"']+)["']/i)
  if (hrefMatch?.[1]) return hrefMatch[1]
  const urlMatch = raw.match(/https?:\/\/[^\s"'<>]+/)
  return urlMatch?.[0] ?? null
}

// My Hallyu Course — 일정 카드 (생성 결과 + 저장 코스 확장 양쪽 사용)
function CourseItineraryView({
  itinerary,
  meta,
  saved,
  saving,
  onSave,
  onRegenerate,
  regenerating,
  compact,
}: {
  itinerary: GeneratedItinerary
  meta: {
    drama_title: string
    travel_style: TravelStyle
    duration_days: DurationDays
    departure_region: string
  }
  saved?: boolean
  saving?: boolean
  onSave?: () => void
  onRegenerate?: () => void
  regenerating?: boolean
  compact?: boolean
}) {
  return (
    <div
      className={
        compact
          ? "space-y-4"
          : "bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 space-y-4"
      }
    >
      {!compact && (
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-foreground font-semibold text-base">
              {meta.drama_title}
            </h3>
            <p className="text-muted-foreground text-xs mt-1">
              {prettyTravelStyle(meta.travel_style)} · {meta.duration_days}d ·
              from {meta.departure_region}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onRegenerate && (
              <Button
                type="button"
                onClick={onRegenerate}
                disabled={regenerating || saving}
                variant="outline"
                className="rounded-full text-xs h-9"
              >
                Try Another Route
              </Button>
            )}
            {onSave &&
              (saved ? (
                <span
                  className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full"
                  style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#22c55e" }}
                >
                  ✓ Saved
                </span>
              ) : (
                <Button
                  type="button"
                  onClick={onSave}
                  disabled={saving || regenerating}
                  className="rounded-full text-white text-xs h-9"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  {saving ? "Saving…" : "Save Course"}
                </Button>
              ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {itinerary.days.map((day) => (
          <div
            key={day.day}
            className="bg-[#0d0d0f] border border-border/30 rounded-xl p-4"
          >
            <div className="flex items-baseline gap-2 mb-3">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "rgba(255,75,110,0.15)", color: "#FF4B6E" }}
              >
                Day {day.day}
              </span>
              <p className="text-foreground text-sm font-medium">{day.title}</p>
            </div>

            <CourseDaySlot label="Morning" stops={day.morning} />
            <CourseDaySlot label="Afternoon" stops={day.afternoon} />
            <CourseDaySlot label="Evening" stops={day.evening} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CourseDaySlot({
  label,
  stops,
}: {
  label: string
  stops: CourseStop[]
}) {
  if (stops.length === 0) return null
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-2">
        {label}
      </p>
      <ul className="space-y-2">
        {stops.map((stop, i) => (
          <li
            key={`${label}-${i}`}
            className="bg-[#1a1a1a] border border-border/20 rounded-lg p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium">{stop.name}</p>
                {stop.address && (
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {stop.address}
                  </p>
                )}
              </div>
              {stop.transport && (
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider flex-shrink-0 px-2 py-0.5 rounded-full bg-[#0d0d0f] border border-border/30">
                  {stop.transport}
                  {stop.duration_minutes ? ` · ${stop.duration_minutes}m` : ""}
                </span>
              )}
            </div>
            {stop.reason && (
              <p className="text-muted-foreground/80 text-xs mt-2 leading-relaxed">
                {stop.reason}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function RegionTooltipRow({
  label,
  color,
  value,
}: {
  label: string
  color: string
  value: number | undefined
}) {
  const v = value ?? 0
  return (
    <li className="flex items-center justify-between">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-muted-foreground">{label}</span>
      </span>
      <span className={v > 0 ? "text-foreground font-medium" : "text-muted-foreground/40"}>
        {v.toLocaleString()}
      </span>
    </li>
  )
}

function prettyTravelStyle(s: TravelStyle): string {
  switch (s) {
    case "relaxed":
      return "Relaxed"
    case "packed":
      return "Packed"
    case "foodie":
      return "Foodie"
    case "cultural":
      return "Cultural"
    default:
      return s
  }
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
