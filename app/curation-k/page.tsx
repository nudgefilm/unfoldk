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
  ShoppingBag,
  ChevronRight,
  Globe,
  Landmark,
  Palette,
  PartyPopper,
  ExternalLink,
  Trash2,
  Link2,
  Download,
  Check,
  Bookmark,
  BookmarkCheck,
  MessageCircle,
  Film,
  Calendar,
  TrendingUp,
} from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { AuthGate } from "@/components/auth-gate"

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
  visit_reason: string | null   // 0029 마이그레이션 — Claude 추출 방문 이유
  homepage: string | null       // 0029 마이그레이션 — 공식 홈페이지 (있을 때만)
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
  overview_en: string | null
  overview_ko: string | null
  image_url: string | null
  image_url2: string | null
  homepage: string | null
  drama_id: string | null            // filming 만 — 모달 "Featured in" 배지 클릭 시 /drama 이동
  drama_title: string | null         // filming 만
  spot_description: string | null    // filming 만 — Claude 추출 촬영 장면 설명 (0029)
  scene_description: string | null   // filming 만 — 한 줄 장면 callout (0046)
  photo_tip: string | null           // filming 만 — 포토존 팁 (0046)
  event_start_date: string | null    // festivals 만 (YYYYMMDD)
  event_end_date: string | null      // festivals 만
  region: string | null
  area_code: number | null
  content_type_id: number | null
  badge: string | null
  latitude: number | null
  longitude: number | null
}

// 통합 탭 — 사용자 spec 순서: [촬영지] [관광지] [맛집] [숙박] [문화시설] [쇼핑] [축제·행사]
type TabKey = "filming" | "attractions" | "food" | "stays" | "culture" | "shopping" | "festivals"

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
    key: "shopping",
    label: "Shopping",
    Icon: ShoppingBag,
    color: "#a3e635",
    proLocked: true,
    emptyMessage: "No shopping spots in this view.",
  },
  {
    key: "festivals",
    label: "Festivals",
    Icon: PartyPopper,
    color: "#fb923c",
    proLocked: true,
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

// ─── Step 9 — 카테고리별 placeholder 이미지 (Unsplash 직링크) ─────
// image_url 누락 row 의 카드·모달에 fallback 으로 사용. 모두 라이선스 무료.
// 깨지는 URL 발견 시 본 매핑만 교체하면 됨.
const PLACEHOLDER_IMAGES: Record<string, string> = {
  filming:
    "https://images.unsplash.com/photo-1538485399081-7c8970d4d29c?w=800&q=80&auto=format&fit=crop",
  attractions:
    "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&q=80&auto=format&fit=crop",
  food:
    "https://images.unsplash.com/photo-1583224994076-ae3a02a1deea?w=800&q=80&auto=format&fit=crop",
  stays:
    "https://images.unsplash.com/photo-1601001435957-74f0958a93c5?w=800&q=80&auto=format&fit=crop",
  culture:
    "https://images.unsplash.com/photo-1542144612-1b3641ec3459?w=800&q=80&auto=format&fit=crop",
  festivals:
    "https://images.unsplash.com/photo-1561565398-cc94f7c52ba2?w=800&q=80&auto=format&fit=crop",
  kpop:
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80&auto=format&fit=crop",
}

// ─── My Hallyu Course — 폼 / 결과 / 저장 목록 타입 ─────────────
type TravelStyle = "filming" | "sightseeing" | "foodie" | "cultural" | "shopping"
type DurationDays = 1 | 2 | 3 | 5 | 7

interface CourseStop {
  name: string
  address: string
  reason?: string
  transport?: string
  duration_minutes?: number
  lat?: number
  lng?: number
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
    arrival_region: string
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
    arrival_region?: string                // 신규 — 과거 저장본은 미존재 가능
    itinerary: GeneratedItinerary
    generated_at: string
  }
  created_at: string
}

// ─── Plan Your Trip — 드라마별 1일 여행 코스 타입 ───────────────
interface TravelCourseNearby {
  title: string
  address: string | null
  distance_km: number
  maps_url: string
  image_url: string | null
}

interface TravelCourseStop {
  order: number
  spot_id: string
  spot_name: string
  spot_description: string | null
  latitude: number
  longitude: number
  address: string | null
  image_url: string | null
  duration_min: number
  visit_tip: string
  nearby_food: TravelCourseNearby | null
  nearby_stay: TravelCourseNearby | null
}

interface TravelCourse {
  course_title: string
  description: string
  drama_title: string
  stops: TravelCourseStop[]
  gmaps_url: string
}

const TRAVEL_STYLE_OPTIONS: ReadonlyArray<{ value: TravelStyle; label: string; count: number }> = [
  { value: "filming",    label: "Filming Tour",  count: 43 },
  { value: "sightseeing",label: "Sightseeing",   count: 1907 },
  { value: "foodie",     label: "Foodie",         count: 1823 },
  { value: "cultural",   label: "Cultural",       count: 1167 },
  { value: "shopping",   label: "Shopping",       count: 735 },
]

const DURATION_OPTIONS: ReadonlyArray<{ value: DurationDays; label: string }> = [
  { value: 1, label: "1 day" },
  { value: 2, label: "2 days" },
  { value: 3, label: "3 days" },
  { value: 5, label: "5 days" },
  { value: 7, label: "7 days" },
]

// /api/curation-k/stats 응답
interface RegionStatsBreakdown {
  filming: number
  attractions: number
  culture: number
  festivals: number
  stays: number
  food: number
  shopping: number
}

interface CurationStats {
  total: number
  filming: number
  attractions: number
  culture: number
  festivals: number
  stays: number
  food: number
  shopping: number
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

// 페이지 로드마다 카드를 다른 순서로 노출 — Fisher-Yates 셔플, 원본 불변.
function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// 접속마다 시작 탭 랜덤 선택 후보 (filming / food / stays / festivals).
// K-Pop Sites 는 탭이 아닌 별도 섹션이므로 festivals 로 대체.
// Filming Spots 만 Free 탭 — 나머지 모두 Pro 잠금.
const RANDOM_START_TABS: readonly TabKey[] = ["filming"]

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
  const [activeTab, setActiveTab] = useState<TabKey>(
    () => RANDOM_START_TABS[Math.floor(Math.random() * RANDOM_START_TABS.length)]
  )
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
  const [selectedKpopSpot, setSelectedKpopSpot] = useState<KpopSpotItem | null>(null)

  // 지도 통계 오버레이 — /api/curation-k/stats
  const [stats, setStats] = useState<CurationStats | null>(null)
  const [hoveredRegion, setHoveredRegion] = useState<number | null>(null)

  // ── My Hallyu Course (Pro) ────────────────────────────────
  const [courseDrama, setCourseDrama] = useState<string>("")
  const [courseStyle, setCourseStyle] = useState<TravelStyle>("filming")
  const [courseDays, setCourseDays] = useState<DurationDays>(1)
  const [courseArrival, setCourseArrival] = useState<string>("Seoul")
  const [courseGenerating, setCourseGenerating] = useState(false)
  const [courseSaving, setCourseSaving] = useState(false)
  const [courseError, setCourseError] = useState<string | null>(null)
  const [generatedCourse, setGeneratedCourse] = useState<GeneratedCourse | null>(null)
  const [generatedSaved, setGeneratedSaved] = useState(false)
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([])
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null)

  // ── Spot 저장 (북마크) — user_curation_collections ───────────
  const [savedCurationSet, setSavedCurationSet] = useState<Set<string>>(new Set())

  // ── Plan Your Trip (드라마별 1일 여행 코스) ───────────────────
  const [travelCourseOpen, setTravelCourseOpen] = useState(false)
  const [travelCourse, setTravelCourse] = useState<TravelCourse | null>(null)
  const [travelCourseLoading, setTravelCourseLoading] = useState(false)
  const [travelCourseError, setTravelCourseError] = useState<string | null>(null)
  const [travelCourseSaving, setTravelCourseSaving] = useState(false)
  const [travelCourseSaved, setTravelCourseSaved] = useState(false)
  const [savedTravelCourseId, setSavedTravelCourseId] = useState<string | null>(null)

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

  // ─── 0. bfcache / 라우터 캐시 복귀 시 전체 카드 재셔플 ─────────
  // pageshow(persisted) 로 브라우저 뒤로가기 복귀 감지 → 기존 items 재셔플.
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setSpotsItems((prev) => (prev.length > 0 ? shuffleArray(prev) : prev))
        setKpopSpots((prev) => (prev.length > 0 ? shuffleArray(prev) : prev))
      }
    }
    window.addEventListener("pageshow", handlePageShow)
    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [])

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
        .select("plan_type, is_admin, trial_ends_at")
        .eq("id", user.id)
        .single()
      const row = profile as { plan_type?: PlanType; is_admin?: boolean; trial_ends_at?: string | null } | null
      setIsPro(hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at }))
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

  // 저장된 스팟 목록 로드 — 로그인 사용자 진입 시 1회
  useEffect(() => {
    if (!isAuthenticated) return
    fetch("/api/curation-k/collections")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { items: Array<{ item_id: string }> }) => {
        setSavedCurationSet(new Set((body.items ?? []).map((i) => i.item_id)))
      })
      .catch(() => {})
  }, [isAuthenticated])

  // 드라마 옵션이 늦게 도착하면 첫 번째 드라마로 자동 set
  useEffect(() => {
    if (!courseDrama && dramaOptions.length > 0) {
      setCourseDrama(dramaOptions[0].drama_title)
    }
  }, [dramaOptions, courseDrama])

  // 스팟 저장 토글 — SpotsTabPanel 카드의 북마크 클릭
  async function handleSpotSaveToggle(item: SpotItem) {
    if (!isAuthenticated) {
      window.location.href = "/login?redirect=/curation-k"
      return
    }
    const itemType = activeTab === "filming" ? "filming" : "tour"
    const isSaved = savedCurationSet.has(item.id)
    // optimistic update
    setSavedCurationSet((prev) => {
      const next = new Set(prev)
      if (isSaved) next.delete(item.id)
      else next.add(item.id)
      return next
    })
    try {
      if (isSaved) {
        await fetch(
          `/api/curation-k/collections?item_type=${itemType}&item_id=${item.id}`,
          { method: "DELETE" }
        )
      } else {
        await fetch("/api/curation-k/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_type: itemType, item_id: item.id }),
        })
      }
    } catch (err) {
      // rollback
      setSavedCurationSet((prev) => {
        const next = new Set(prev)
        if (isSaved) next.add(item.id)
        else next.delete(item.id)
        return next
      })
      console.warn("[curation-k] spot save toggle 실패:", err)
    }
  }

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
          departure_region: courseArrival,
          arrival_region: courseArrival,
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
          arrival_region: generatedCourse.meta.arrival_region,
          itinerary: generatedCourse.itinerary,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCourseError(json?.detail ?? json?.error ?? `Save failed (HTTP ${res.status})`)
        return
      }
      // 저장 성공 — 목록 갱신 (최신 6개 유지) + saved 표시
      setGeneratedSaved(true)
      if (json.item) {
        setSavedCourses((prev) => [json.item as SavedCourse, ...prev].slice(0, 6))
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

  async function handlePlanTrip() {
    if (!filterDrama || filterDrama === "all") return
    setTravelCourseOpen(true)
    setTravelCourseLoading(true)
    setTravelCourse(null)
    setTravelCourseError(null)
    setTravelCourseSaved(false)
    setSavedTravelCourseId(null)
    try {
      const res = await fetch(
        `/api/curation-k/travel-course?drama_title=${encodeURIComponent(filterDrama)}`
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTravelCourseError(
          (json as { detail?: string; error?: string })?.detail ??
          (json as { detail?: string; error?: string })?.error ??
          `Failed (HTTP ${res.status})`
        )
        return
      }
      setTravelCourse(json as TravelCourse)
    } catch (err) {
      setTravelCourseError(err instanceof Error ? err.message : "Failed to plan trip")
    } finally {
      setTravelCourseLoading(false)
    }
  }

  async function handleSaveTravelCourse() {
    if (!travelCourse) return
    setTravelCourseSaving(true)
    try {
      const res = await fetch("/api/curation-k/travel-course/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course: travelCourse }),
      })
      if (res.ok) {
        const body = (await res.json()) as { course_id: string }
        setTravelCourseSaved(true)
        setSavedTravelCourseId(body.course_id)
      }
    } catch (err) {
      console.error("[curation-k] travel course save 실패:", err)
    } finally {
      setTravelCourseSaving(false)
    }
  }

  function handleShareTravelCourse() {
    if (!savedTravelCourseId) return
    const url = `${window.location.origin}/curation-k/course/${savedTravelCourseId}`
    navigator.clipboard.writeText(url).catch(() => {})
  }

  function handlePdfDownloadTravelCourse() {
    window.print()
  }

  // 지도 도시 클릭 → 지역 필터 set + 탭 그리드 스크롤.
  // page reset effect 도 따라오지만 명시로 한 번에 batching — set 두 개로 fetch effect
  // 가 동일 사이클 내 단일 재실행되도록 보장.
  const handleRegionClick = (areaCode: number) => {
    setFilterArea(String(areaCode))
    setSpotsPage(1)
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
        setSpotsItems(shuffleArray(body.items ?? []))
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
      .then((body: { items: KpopSpotItem[] }) => setKpopSpots(shuffleArray(body.items ?? [])))
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
          <div className="max-w-[1320px] mx-auto px-6 pt-28 pb-12">
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

                {/* 클러스터 핀 오버레이는 2026-05-19 사용자 요청으로 제거.
                    기존 cluster/viewState/PinModal 로직은 코드에 남아있으나
                    렌더만 차단 — 추후 필요 시 본 블록만 부활시키면 됨. */}

                {/* ─── 17 광역시도 hover overlay (SVG sibling) ─────────────
                    REGION_CENTROIDS 위에 transparent hit target. 호버 시 툴팁,
                    클릭 시 Region 필터 set + 탭 그리드 smooth scroll.
                    SVG 내부는 동결 — 본 레이어는 sibling. */}
                <div className="absolute inset-0 pointer-events-none">
                  {REGION_CENTROIDS.map((region) => {
                    const [cx, cy] = proj(region.lng, region.lat)
                    const pos = pctPosition(cx, cy)
                    const stat = stats?.byRegion?.[String(region.code)]
                    const isHovered = hoveredRegion === region.code
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
                        <span
                          className="absolute inset-0 rounded-full transition-opacity"
                          style={{
                            backgroundColor: "rgba(255, 75, 110, 0.18)",
                            border: "1px solid rgba(255, 75, 110, 0.5)",
                            opacity: isHovered ? 1 : 0,
                          }}
                        />

                        {/* 시각 마커 — 17 광역시도 hover 위치 모두에 작은 점.
                            SVG 도시 마커 (Seoul/Busan/Jeju 펄스 등) 와 일부 겹치지만
                            동일 핑크 색상이라 자연 결합. */}
                        <span
                          aria-hidden="true"
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity"
                          style={{
                            width: 5,
                            height: 5,
                            backgroundColor: "#FF4B6E",
                            opacity: isHovered ? 1 : 0.55,
                          }}
                        />

                        {/* 툴팁 — 기본 아래 펼침. Jeju(39) 는 지도 하단이라 아래로
                            나가면 잘려서 오른쪽으로 띄움. */}
                        {isHovered && (
                          <div
                            role="tooltip"
                            className={
                              region.code === 39
                                ? "absolute left-[42px] top-1/2 -translate-y-1/2 w-[180px] text-left bg-[#0d0d0f] border border-border/50 rounded-lg p-3 shadow-xl text-foreground"
                                : "absolute left-1/2 top-[42px] -translate-x-1/2 w-[180px] text-left bg-[#0d0d0f] border border-border/50 rounded-lg p-3 shadow-xl text-foreground"
                            }
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
                                label="Shopping"
                                color="#a3e635"
                                value={stat?.shopping}
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

                {/* 통계 배지 — 7개 카테고리 전체, 0건인 항목은 미표시 */}
                {stats && (
                  <div className="mt-6 pt-5 border-t border-border/30">
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
                      In the database
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                      {([
                        { key: "filming",     label: "Filming",     color: "#FF4B6E" },
                        { key: "attractions", label: "Attractions", color: "#22d3ee" },
                        { key: "food",        label: "Food",        color: "#facc15" },
                        { key: "stays",       label: "Stays",       color: "#a78bfa" },
                        { key: "shopping",    label: "Shopping",    color: "#a3e635" },
                        { key: "culture",     label: "Culture",     color: "#f472b6" },
                        { key: "festivals",   label: "Festivals",   color: "#fb923c" },
                      ] as const).flatMap(({ key, label, color }, i, arr) => {
                        const val = stats[key as keyof typeof stats] as number
                        if (!val) return []
                        const isLast = arr.slice(i + 1).every(({ key: k }) => !(stats[k as keyof typeof stats] as number))
                        return [
                          <span key={key} className="inline-flex items-baseline gap-1.5">
                            <span className="font-semibold" style={{ color }}>{val.toLocaleString()}</span>
                            <span className="text-muted-foreground text-xs">{label}</span>
                          </span>,
                          ...(!isLast ? [<span key={`${key}-dot`} className="text-muted-foreground/40">·</span>] : []),
                        ]
                      })}
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
                <label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Drama
                </label>
                <Select
                  value={filterDrama}
                  onValueChange={setFilterDrama}
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

            {/* Plan Your Trip — filming 탭 + 드라마 선택 시 노출. 비로그인도 조회 가능. */}
            {activeTab === "filming" && filterDrama !== "all" && (
              <Button
                onClick={handlePlanTrip}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white flex-shrink-0"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Plan Your Trip
              </Button>
            )}
          </div>

          {/* 탭 바 — Pro 잠금 탭은 자물쇠 아이콘 표기 / Shopping은 데이터 있을 때만 노출 */}
          <div
            role="tablist"
            aria-label="Curation K categories"
            className="flex flex-wrap gap-2 mb-6"
          >
            {TABS.filter((tab) =>
              tab.key !== "shopping" || (stats !== null && stats.shopping > 0)
            ).map((tab) => {
              const isActive = activeTab === tab.key
              const showLock = tab.proLocked && !isPro
              return (
                // Pro 잠금 탭: 비로그인 AuthGate 차단. 로그인 비Pro: 탭 전환 허용 + Pro lock overlay 표시.
                <AuthGate
                  key={tab.key}
                  isLoggedIn={tab.proLocked ? isAuthenticated : null}
                >
                <button
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
                </AuthGate>
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
            savedIds={savedCurationSet}
            onSaveToggle={handleSpotSaveToggle}
          />
        </div>

        {/* 카드 상세 모달 — selectedSpot != null 일 때만 마운트 */}
        <SpotDetailDialog
          spot={selectedSpot}
          tab={TABS.find((t) => t.key === activeTab) ?? TABS[0]}
          isPro={isPro}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelectedSpot(null)}
          isSaved={selectedSpot ? savedCurationSet.has(selectedSpot.id) : false}
          onSaveToggle={selectedSpot ? () => handleSpotSaveToggle(selectedSpot) : undefined}
        />

        {/* Plan Your Trip 모달 */}
        <TravelCourseModal
          open={travelCourseOpen}
          course={travelCourse}
          loading={travelCourseLoading}
          error={travelCourseError}
          isPro={isPro}
          isSaving={travelCourseSaving}
          isSaved={travelCourseSaved}
          savedCourseId={savedTravelCourseId}
          onClose={() => setTravelCourseOpen(false)}
          onSave={handleSaveTravelCourse}
          onShare={handleShareTravelCourse}
          onPdfDownload={handlePdfDownloadTravelCourse}
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
                <AuthGate key={spot.id} isLoggedIn={isAuthenticated}>
                <SpotCard
                  image={spot.image_url}
                  title={spot.spot_name}
                  subtitle={spot.artist_name}
                  region={spot.region}
                  address={spot.address}
                  badge={prettySpotType(spot.spot_type)}
                  badgeColor={CATEGORY_COLOR_MAP.kpop}
                  fallbackIcon={<MicVocal className="w-6 h-6 text-muted-foreground" />}
                  fallbackImage={PLACEHOLDER_IMAGES.kpop}
                  onClick={() => setSelectedKpopSpot(spot)}
                  isLoggedIn={isAuthenticated === true}
                />
                </AuthGate>
              ))}
            </div>
          )}
        </div>

        {/* K-Pop 성지 카드 상세 모달 — selectedKpopSpot 기준 */}
        <KpopSpotDetailDialog
          spot={selectedKpopSpot}
          isPro={isPro}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelectedKpopSpot(null)}
        />

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
            // blur-background + centered overlay 패턴 (KfoodKit/HangeulGo 동일 패턴)
            <div className="relative">
              {/* 폼 미리보기 — blur 처리 */}
              <div className="blur-[4px] pointer-events-none select-none">
                <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Drama</p>
                      <div className="h-10 bg-[#0d0d0f] border border-border/40 rounded-full" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Destination</p>
                      <div className="h-10 bg-[#0d0d0f] border border-border/40 rounded-full" />
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Travel style</p>
                    <div className="flex flex-wrap gap-2">
                      {["Filming Tour", "Sightseeing", "Foodie", "Cultural", "Shopping"].map((s) => (
                        <div
                          key={s}
                          className="px-4 py-2 rounded-full text-xs border text-muted-foreground"
                          style={{ backgroundColor: "#0d0d0f", borderColor: "rgba(255,255,255,0.1)" }}
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Duration</p>
                    <div className="flex gap-2">
                      {["1 day", "2 days", "3 days"].map((d) => (
                        <div
                          key={d}
                          className="px-4 py-2 rounded-full text-xs border text-muted-foreground"
                          style={{ backgroundColor: "#0d0d0f", borderColor: "rgba(255,255,255,0.1)" }}
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="h-10 w-48 rounded-full" style={{ backgroundColor: "rgba(255,75,110,0.3)" }} />
                </div>
              </div>
              {/* Pro 잠금 오버레이 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#141418] border border-border/50 rounded-xl p-8 text-center shadow-xl max-w-sm w-full mx-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                  >
                    <Lock className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                  </div>
                  <p className="text-foreground font-medium mb-2">Coming with Hallyu Pass</p>
                  <p className="text-muted-foreground text-xs mb-4 max-w-sm mx-auto">
                    Personalized Hallyu day-trip routes built from your drama taste —
                    arriving at launch.
                  </p>
                  <AuthGate isLoggedIn={isAuthenticated}>
                  <Link href="/signup">
                    <Button
                      className="px-6 py-2 rounded-full font-medium text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      Notify me at launch
                    </Button>
                  </Link>
                  </AuthGate>
                </div>
              </div>
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
                      Destination
                    </label>
                    <Select value={courseArrival} onValueChange={setCourseArrival}>
                      <SelectTrigger
                        className="w-full bg-[#0d0d0f] border-border/40 rounded-full text-sm"
                        aria-label="Destination region"
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
                          <span className="ml-1 opacity-60 font-normal">
                            {opt.count >= 1000
                              ? `${(opt.count / 1000).toFixed(1).replace(/\.0$/, "")}k`
                              : opt.count}
                          </span>
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
                    {savedCourses.slice(0, 6).map((c) => {
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
                                {c.course_data.duration_days}d ·{" "}
                                {c.course_data.arrival_region &&
                                c.course_data.arrival_region !== c.course_data.departure_region
                                  ? `${c.course_data.departure_region} → ${c.course_data.arrival_region}`
                                  : `from ${c.course_data.departure_region}`}
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
                                  arrival_region:
                                    c.course_data.arrival_region ??
                                    c.course_data.departure_region,
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
                <AuthGate key={g.artistId} isLoggedIn={isAuthenticated}>
                <Link
                  href={`/kpop/${g.artistId}`}
                  className="block bg-[#1a1a1a] border border-border/30 rounded-xl p-4 hover:border-primary/40 hover:bg-[#222226] transition-colors flex items-center gap-3"
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
                </AuthGate>
              ))}
            </div>
          )}
        </div>

        {/* ───── Klook 제휴 배너 ────────────────────────────────── */}
        <div className="mx-auto max-w-5xl px-4 pb-16 mt-4">
          <div
            className="rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6"
            style={{
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#FF4B6E" }}>
                Plan Your Trip
              </p>
              <h3 className="text-xl font-bold text-white mb-1">Ready to visit in person?</h3>
              <p className="text-sm text-white/60">
                Book tours, activities &amp; stays in Korea — powered by Klook.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
              {[
                { label: "K-Pop Sites", href: "https://affiliate.klook.com/redirect?aid=122963&aff_adid=1289683&k_site=https%3A%2F%2Fwww.klook.com%2Fsearch%2F%3Fquery%3Dkpop%2Bseoul" },
                { label: "Filming Spots", href: "https://affiliate.klook.com/redirect?aid=122963&aff_adid=1289684&k_site=https%3A%2F%2Fwww.klook.com%2Fsearch%2F%3Fquery%3Dkdrama%2Bfilming%2Bseoul" },
                { label: "Food Tours", href: "https://affiliate.klook.com/redirect?aid=122963&aff_adid=1289685&k_site=https%3A%2F%2Fwww.klook.com%2Fsearch%2F%3Fquery%3Dfood%2Btour%2Bseoul" },
                { label: "Stays", href: "https://affiliate.klook.com/redirect?aid=122963&aff_adid=1289686&k_site=https%3A%2F%2Fwww.klook.com%2Fcity%2F9-seoul-things-to-do%2F%3Ftabs%3Dhotels" },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  {label}
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>
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

// YYYYMMDD 두 필드 기준 축제 상태 계산.
// 반환값의 color 는 SpotCard badge overlay 에 직접 사용.
function getFestivalStatus(
  startDate: string | null,
  endDate: string | null
): { text: string; color: string } | null {
  if (!startDate) return null
  const now = new Date()
  const ymd = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
  const todayStr = ymd(now)
  const isOngoing = startDate <= todayStr && (!endDate || endDate >= todayStr)
  if (isOngoing) return { text: "진행 중", color: "#22c55e" }
  const isEnded = !!endDate && endDate < todayStr
  if (isEnded) return { text: "종료", color: "#6b7280" }
  // 예정 — D-N (60일 이내) 또는 "예정"
  const sy = parseInt(startDate.slice(0, 4))
  const sm = parseInt(startDate.slice(4, 6)) - 1
  const sd = parseInt(startDate.slice(6, 8))
  const diffDays = Math.ceil((new Date(sy, sm, sd).getTime() - now.getTime()) / 86400000)
  return { text: diffDays <= 60 ? `D-${diffDays}` : "예정", color: "#fb923c" }
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
  fallbackImage,
  cta,
  onClick,
  isSaved,
  onSaveToggle,
  isLoggedIn,
}: {
  image: string | null
  title: string
  subtitle: string
  region: string | null
  address: string | null
  badge: string | null
  badgeColor: string
  fallbackIcon: React.ReactNode
  fallbackImage?: string | null   // 카테고리별 Unsplash placeholder
  cta?: React.ReactNode
  onClick?: () => void
  isSaved?: boolean
  onSaveToggle?: (e: React.MouseEvent) => void
  isLoggedIn?: boolean
}) {
  const effectiveImage = image ?? fallbackImage ?? null
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
        {effectiveImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={effectiveImage}
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
        {onSaveToggle && (
          <div
            role="button"
            tabIndex={0}
            title={isSaved ? "Saved" : "Save"}
            aria-label={isSaved ? "Remove from My Curation" : "Save to My Curation"}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSaveToggle(e) }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                e.stopPropagation()
                onSaveToggle(e as unknown as React.MouseEvent)
              }
            }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
          >
            {isSaved
              ? <BookmarkCheck className="w-4 h-4" style={{ color: "#FF4B6E" }} />
              : <Bookmark className="w-4 h-4 text-white" />
            }
          </div>
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
  savedIds,
  onSaveToggle,
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
  savedIds?: Set<string>
  onSaveToggle?: (item: SpotItem) => void
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
            <AuthGate isLoggedIn={isAuthenticated}>
            <Link href="/signup">
              <Button
                className="px-6 py-2 rounded-full font-medium text-white"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                Notify me at launch
              </Button>
            </Link>
            </AuthGate>
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
        {items.map((item) => {
          const festStatus =
            tab.key === "festivals"
              ? getFestivalStatus(item.event_start_date, item.event_end_date)
              : null
          return (
            <AuthGate key={item.id} isLoggedIn={isAuthenticated}>
            <SpotCard
              image={item.image_url}
              title={item.title}
              subtitle={
                tab.key === "filming" && item.scene_description
                  ? item.scene_description
                  : item.subtitle ?? item.overview_en ?? ""
              }
              region={item.region}
              address={item.address}
              badge={festStatus?.text ?? item.drama_title ?? item.badge}
              badgeColor={festStatus?.color ?? tab.color}
              fallbackIcon={<tab.Icon className="w-6 h-6 text-muted-foreground" />}
              fallbackImage={PLACEHOLDER_IMAGES[tab.key]}
              onClick={tab.key !== "festivals" ? () => onSelectSpot(item) : undefined}
              isLoggedIn={isAuthenticated === true}
              isSaved={savedIds?.has(item.id)}
              onSaveToggle={tab.key !== "festivals" && onSaveToggle ? () => onSaveToggle(item) : undefined}
            />
            </AuthGate>
          )
        })}
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
// 모달 하단 "Nearby Places" 섹션용 타입.
// /api/curation-k/nearby-spots 응답과 동일 shape — 카테고리별 5개씩 cap.
interface NearbyPlaceItem {
  id: string
  content_id: string
  content_type_id: number
  title: string
  korean_title: string | null
  address: string | null
  image_url: string | null
  latitude: number
  longitude: number
  distance_km: number
  maps_url: string
}
interface NearbyPlacesResponse {
  nearby: {
    attractions: NearbyPlaceItem[]
    culture: NearbyPlaceItem[]
    stays: NearbyPlaceItem[]
    food: NearbyPlaceItem[]
  }
  radius_used: 1 | 3 | 10 | null
}

// 탭별 Nearby 에서 제외할 content_type_id (자기 탭과 동일 카테고리 중복 방지).
// festivals·filming·kpop 은 제외 없음 (filming = 촬영지라 카테고리 겹침 없음).
const TAB_EXCLUDE_TYPE: Partial<Record<string, number>> = {
  attractions: 12,
  culture: 14,
  stays: 32,
  food: 39,
}

function SpotDetailDialog({
  spot,
  tab,
  isPro,
  isAuthenticated,
  onClose,
  isSaved,
  onSaveToggle,
}: {
  spot: SpotItem | null
  tab: TabDef
  isPro: boolean
  isAuthenticated: boolean | null
  onClose: () => void
  isSaved?: boolean
  onSaveToggle?: () => void
}) {
  // 이미지 갤러리: image_url + image_url2 (중복·빈 값 제거).
  // 둘 다 null 이면 카테고리별 placeholder Unsplash URL 사용.
  const realImages = spot
    ? Array.from(
        new Set([spot.image_url, spot.image_url2].filter((s): s is string => !!s))
      )
    : []
  const images =
    realImages.length > 0
      ? realImages
      : spot && PLACEHOLDER_IMAGES[tab.key]
        ? [PLACEHOLDER_IMAGES[tab.key]]
        : []
  const [imageIndex, setImageIndex] = useState(0)

  // spot 바뀔 때 이미지 인덱스 리셋
  useEffect(() => {
    setImageIndex(0)
  }, [spot?.id])

  // ─── Nearby Places — festivals 탭 제외 + GPS 있을 때 모든 탭에 노출 ──
  // GPS 없거나 결과 0건이면 섹션 자체 렌더 안 함 (graceful).
  const [nearbyData, setNearbyData] = useState<NearbyPlacesResponse | null>(null)
  const [nearbyLoading, setNearbyLoading] = useState(false)

  const spotHasGps = !!spot && spot.latitude !== null && spot.longitude !== null
  const nearbyEnabled = tab.key !== "festivals" && spotHasGps

  useEffect(() => {
    setNearbyData(null)
    if (!nearbyEnabled || !spot) return

    const qs = new URLSearchParams({
      lat: String(spot.latitude!),
      lng: String(spot.longitude!),
    })
    const excludeType = TAB_EXCLUDE_TYPE[tab.key]
    if (excludeType !== undefined) qs.set("exclude_type", String(excludeType))

    let cancelled = false
    setNearbyLoading(true)
    fetch(`/api/curation-k/nearby-spots?${qs}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return (await res.json()) as NearbyPlacesResponse
      })
      .then((data) => {
        if (cancelled) return
        setNearbyData(data)
      })
      .catch((err) => {
        if (cancelled) return
        // 조용히 실패 — Nearby Places 는 보조 섹션이라 모달 자체는 정상 동작 유지.
        console.warn("[SpotDetailDialog] nearby-spots fetch 실패:", err)
        setNearbyData(null)
      })
      .finally(() => {
        if (!cancelled) setNearbyLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [spot?.id, nearbyEnabled])

  if (!spot) return null

  const fullAddress = [spot.address, spot.addr2].filter(Boolean).join(" ").trim()
  const hasGps = spot.latitude !== null && spot.longitude !== null
  // Google Maps 링크 — GPS 우선, 없으면 주소로 fallback, 둘 다 없으면 버튼 미노출
  const mapsUrl = hasGps
    ? `https://www.google.com/maps?q=${spot.latitude},${spot.longitude}`
    : fullAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
      : null

  // 탭별 모달 본문 description 선택
  //   filming  → spot_description (Claude 추출 촬영 장면)
  //   그 외    → overview_en ?? overview_ko (Claude 영문 번역 우선, 한글 원본 fallback)
  const description =
    tab.key === "filming"
      ? spot.spot_description ?? null
      : (spot.overview_en ?? spot.overview_ko) || null

  // filming 탭 — "Featured in: <드라마>" 배지 (이미지 위 오버레이). 클릭 시 /drama 페이지로 이동.
  // 다른 탭에서는 미노출.
  const dramaBadge = tab.key === "filming" ? spot.drama_title : null

  // festivals 탭 — 기간 표시 (subtitle 에 미리 가공된 "YYYY-MM-DD ~ YYYY-MM-DD" 사용).
  const festivalPeriod = tab.key === "festivals" ? spot.subtitle : null

  return (
    <Dialog
      open={!!spot}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="bg-[#141416] border-[#2a2a2a] text-foreground max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* 이미지 갤러리 — 모달 상단 고정 (스크롤 대상 아님).
            flex-shrink-0 로 본문이 길어져도 이미지 영역 압축 안 됨.
            key 없이 src 직접 교체 (unmount 재로딩 회피). */}
        <div className="relative bg-[#252525] aspect-[16/9] flex-shrink-0 flex items-center justify-center overflow-hidden">
          {images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={images[imageIndex] ?? images[0]}
              alt={spot.title}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <tab.Icon className="w-12 h-12 text-muted-foreground" />
          )}

          {/* filming — "Featured in: <drama>" 클릭 가능한 배지 (→ /drama) */}
          {dramaBadge && (
            <Link
              href="/drama"
              className="absolute top-3 left-3 z-30 text-[11px] font-medium px-2.5 py-1 rounded-full shadow inline-flex items-center gap-1 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: `${tab.color}e0`, color: "#fff" }}
              onClick={(e) => e.stopPropagation()}
              title="Browse this drama on KdramaMatch"
            >
              <span className="opacity-80">Featured in:</span>
              <span className="font-semibold">{dramaBadge}</span>
            </Link>
          )}

          {/* 북마크 — 항상 노출. 미로그인 클릭 시 로그인 이동 (onSaveToggle 내부 처리) */}
          {onSaveToggle && (
            <div
              role="button"
              tabIndex={0}
              title={isSaved ? "Saved" : "Save"}
              aria-label={isSaved ? "Remove from My Curation" : "Save to My Curation"}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSaveToggle() }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSaveToggle() }
              }}
              className="absolute top-3 right-12 z-30 w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
            >
              {isSaved
                ? <BookmarkCheck className="w-5 h-5" style={{ color: "#FF4B6E" }} />
                : <Bookmark className="w-5 h-5 text-white" />
              }
            </div>
          )}

          {/* 좌우 화살표 + 도트 — realImages 2장 이상일 때만 (image_url == image_url2 면 Set 중복 제거).
              placeholder fallback (1장) 단독일 땐 화살표 미노출. */}
          {realImages.length > 1 && (
            <>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setImageIndex((prev) => (prev - 1 + realImages.length) % realImages.length)
                }}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white inline-flex items-center justify-center text-lg cursor-pointer"
              >
                ‹
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setImageIndex((prev) => (prev + 1) % realImages.length)
                }}
                aria-label="Next image"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white inline-flex items-center justify-center text-lg cursor-pointer"
              >
                ›
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex gap-1.5 pointer-events-none">
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

        {/* 본문 — 이 영역만 스크롤. flex-1 + min-h-0 조합이 flex 자식 overflow-y-auto 를 살림.
            (min-h-0 없으면 flex item 이 콘텐츠 높이 기준으로 펴져 부모 max-h 를 초과해 잘림) */}
        <div className="p-6 flex-1 min-h-0 overflow-y-auto">
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

          {/* festivals — 기간 */}
          {festivalPeriod && (
            <div className="flex items-center gap-2 text-sm mb-4">
              <span
                className="inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: `${tab.color}22`,
                  color: tab.color,
                }}
              >
                {festivalPeriod}
              </span>
            </div>
          )}

          {/* 주소 */}
          {fullAddress && (
            <div className="flex items-start gap-2 text-sm mb-4">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p className="text-foreground/90 leading-snug">{fullAddress}</p>
            </div>
          )}

          {/* 설명 — filming 은 spot_description, 나머지는 overview_en ?? overview_ko */}
          {description && (
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line mb-4">
              {description}
            </p>
          )}

          {/* scene_description — 한 줄 장면 callout (filming 전용) */}
          {tab.key === "filming" && spot.scene_description && (
            <p
              className="text-[13px] italic text-foreground/75 leading-snug mb-4 border-l-2 pl-3"
              style={{ borderColor: tab.color }}
            >
              &ldquo;{spot.scene_description}&rdquo;
            </p>
          )}

          {/* photo_tip — 포토존 팁 (filming 전용) */}
          {tab.key === "filming" && spot.photo_tip && (
            <div className="flex items-start gap-2 mb-5 p-3 rounded-lg bg-[#1e1e22]">
              <span className="text-base leading-none flex-shrink-0">📸</span>
              <p className="text-foreground/80 text-xs leading-snug">{spot.photo_tip}</p>
            </div>
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

            {mapsUrl && (
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

          {/* 크로스링크 — filming 탭 + drama_title 있을 때만 */}
          {tab.key === "filming" && spot.drama_title && (
            <div className="border-t border-border/20 pt-4 mt-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-3">Explore more</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    href: `/korean?drama=${encodeURIComponent(spot.drama_title)}`,
                    icon: <MessageCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                    title: "Learn Korean",
                    sub: "from this drama →",
                  },
                  {
                    href: `/food?drama=${encodeURIComponent(spot.drama_title)}`,
                    icon: <UtensilsCrossed className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                    title: "Cook the food",
                    sub: "from this drama →",
                  },
                  {
                    href: `/drama`,
                    icon: <Film className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                    title: "Find K-dramas",
                    sub: "UnfoldK picks →",
                  },
                  {
                    href: `/calendar`,
                    icon: <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                    title: "Related events",
                    sub: "check calendar →",
                  },
                ].map(({ href, icon, title, sub }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2.5 bg-[#252528] hover:bg-[#2e2e32] rounded-xl px-3 py-3 transition-colors group"
                  >
                    {icon}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{title}</p>
                      <p className="text-[10px] text-muted-foreground truncate group-hover:text-foreground/70 transition-colors">{sub}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Nearby Places — GPS 있고 festivals 제외한 모든 탭. 데이터 0건이면 미노출. */}
          {nearbyEnabled && (
            <NearbyPlacesSection
              data={nearbyData}
              loading={nearbyLoading}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// filming 탭 상세 모달 하단 — 촬영지 주변 tour_spots 거리 기반 매칭.
// content_type_id 별 4 카테고리 (attractions/culture/stays/food) 로 분리해 노출.
// 모든 버킷이 비어 있으면 null 반환 (섹션 자체 미노출).
const NEARBY_BUCKET_META: ReadonlyArray<{
  key: "attractions" | "culture" | "stays" | "food"
  label: string
  Icon: typeof Landmark
  color: string
}> = [
  { key: "attractions", label: "Attractions", Icon: Landmark, color: "#22d3ee" },
  { key: "food", label: "Food", Icon: UtensilsCrossed, color: "#facc15" },
  { key: "stays", label: "Stays", Icon: Hotel, color: "#a78bfa" },
  { key: "culture", label: "Culture", Icon: Palette, color: "#f472b6" },
]

function NearbyPlacesSection({
  data,
  loading,
}: {
  data: NearbyPlacesResponse | null
  loading: boolean
}) {
  if (loading && !data) {
    return (
      <div className="mt-6 pt-5 border-t border-border/30">
        <p className="text-xs text-muted-foreground">Loading nearby places…</p>
      </div>
    )
  }
  if (!data) return null

  const totalCount =
    data.nearby.attractions.length +
    data.nearby.culture.length +
    data.nearby.stays.length +
    data.nearby.food.length
  if (totalCount === 0) return null

  return (
    <div className="mt-6 pt-5 border-t border-border/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white inline-flex items-center gap-1.5">
          <MapPin className="w-4 h-4" style={{ color: "#FF4B6E" }} />
          Nearby Places
        </h3>
        {data.radius_used !== null && (
          <span className="text-[10px] text-muted-foreground">
            within {data.radius_used} km
          </span>
        )}
      </div>

      <div className="space-y-4">
        {NEARBY_BUCKET_META.map(({ key, label, Icon, color }) => {
          const items = data.nearby[key]
          if (items.length === 0) return null
          return (
            <div key={key}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-3.5 h-3.5" style={{ color }} />
                <span
                  className="text-[11px] font-medium uppercase tracking-wide"
                  style={{ color }}
                >
                  {label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  · {items.length}
                </span>
              </div>
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground/90 truncate">{item.title}</p>
                      {item.korean_title && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {item.korean_title}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {item.distance_km.toFixed(1)} km
                    </span>
                    <a
                      href={item.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border/40 bg-[#1a1a1a] hover:border-border/70 transition-colors text-[10px] text-foreground/80"
                      title="Open in Google Maps"
                    >
                      <MapPin className="w-3 h-3" />
                      Map
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// K-Pop 성지 상세 모달 — kpop_spots 컬럼 매핑.
//   image_url / spot_name / artist_name / spot_type / region / address / lat·lng /
//   visit_reason (0029 마이그레이션) / homepage (0029, 있을 때만).
//   Google Maps 는 Pro 게이팅 (filming/tour 모달과 동일 정책).
function KpopSpotDetailDialog({
  spot,
  isPro,
  isAuthenticated,
  onClose,
}: {
  spot: KpopSpotItem | null
  isPro: boolean
  isAuthenticated: boolean | null
  onClose: () => void
}) {
  const [nearbyData, setNearbyData] = useState<NearbyPlacesResponse | null>(null)
  const [nearbyLoading, setNearbyLoading] = useState(false)

  const kpopLat =
    spot == null
      ? null
      : typeof spot.latitude === "string"
        ? Number(spot.latitude)
        : spot.latitude
  const kpopLng =
    spot == null
      ? null
      : typeof spot.longitude === "string"
        ? Number(spot.longitude)
        : spot.longitude
  const kpopHasGps =
    kpopLat !== null &&
    kpopLng !== null &&
    Number.isFinite(kpopLat) &&
    Number.isFinite(kpopLng)

  useEffect(() => {
    setNearbyData(null)
    if (!spot || !kpopHasGps) return

    let cancelled = false
    setNearbyLoading(true)
    fetch(`/api/curation-k/nearby-spots?lat=${kpopLat}&lng=${kpopLng}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return (await res.json()) as NearbyPlacesResponse
      })
      .then((data) => {
        if (cancelled) return
        setNearbyData(data)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn("[KpopSpotDetailDialog] nearby-spots fetch 실패:", err)
        setNearbyData(null)
      })
      .finally(() => {
        if (!cancelled) setNearbyLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [spot?.id, kpopHasGps])

  if (!spot) return null

  const imageSrc = spot.image_url ?? PLACEHOLDER_IMAGES.kpop
  const hasGps = kpopHasGps
  const mapsUrl = hasGps ? `https://maps.google.com/?q=${kpopLat},${kpopLng}` : null
  const accentColor = CATEGORY_COLOR_MAP.kpop

  return (
    <Dialog
      open={!!spot}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="bg-[#141416] border-[#2a2a2a] text-foreground max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* 이미지 — 모달 상단 고정 (flex-shrink-0). SpotDetailDialog 와 동일 패턴. */}
        <div className="relative bg-[#252525] aspect-[16/9] flex-shrink-0 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={spot.spot_name}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* 아티스트 배지 */}
          <span
            className="absolute top-3 left-3 z-30 text-[11px] font-medium px-2.5 py-1 rounded-full shadow pointer-events-none"
            style={{ backgroundColor: `${accentColor}e0`, color: "#fff" }}
          >
            {spot.artist_name}
          </span>
          {/* 카테고리 배지 (오른쪽 위) */}
          <span
            className="absolute top-3 right-3 z-30 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/70 text-white pointer-events-none uppercase tracking-wider"
          >
            {prettySpotType(spot.spot_type)}
          </span>
        </div>

        {/* 본문 — flex-1 min-h-0 overflow-y-auto 로 본문만 스크롤. */}
        <div className="p-6 flex-1 min-h-0 overflow-y-auto">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-white leading-tight">
              {spot.spot_name}
            </DialogTitle>
            <p className="text-muted-foreground text-sm mt-1">
              {spot.artist_name}
            </p>
          </DialogHeader>

          {/* 방문 이유 — Claude 추출 (0029 마이그레이션 적용 후부터 채워짐) */}
          {spot.visit_reason && (
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line mb-5">
              {spot.visit_reason}
            </p>
          )}

          {/* 주소 */}
          {(spot.region || spot.address) && (
            <div className="flex items-start gap-2 text-sm mb-5">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p className="text-foreground/90 leading-snug">
                {spot.region}
                {spot.region && spot.address ? " · " : ""}
                {spot.address}
              </p>
            </div>
          )}

          {/* CTA — homepage / Google Maps (Pro 게이팅) */}
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
                  style={{ backgroundColor: accentColor }}
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

          {/* Explore More — K-pop 성지 크로스링크 */}
          <div className="border-t border-border/20 pt-4 mt-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-3">Explore more</p>
            <div className="grid grid-cols-2 gap-2">
              {spot.artist_id && (
                <Link
                  href={`/kpop/${spot.artist_id}`}
                  className="flex items-center gap-2.5 bg-[#252528] hover:bg-[#2e2e32] rounded-xl px-3 py-3 transition-colors group"
                >
                  <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">Artist stats</p>
                    <p className="text-[10px] text-muted-foreground truncate group-hover:text-foreground/70 transition-colors">KpopStats →</p>
                  </div>
                </Link>
              )}
              {[
                {
                  href: "/calendar",
                  icon: <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                  title: "Upcoming events",
                  sub: "check calendar →",
                },
                {
                  href: "/drama",
                  icon: <Film className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                  title: "Find K-dramas",
                  sub: "UnfoldK picks →",
                },
                {
                  href: "/korean",
                  icon: <MessageCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                  title: "Learn Korean",
                  sub: "HangeulGo →",
                },
              ].map(({ href, icon, title, sub }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 bg-[#252528] hover:bg-[#2e2e32] rounded-xl px-3 py-3 transition-colors group"
                >
                  {icon}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{title}</p>
                    <p className="text-[10px] text-muted-foreground truncate group-hover:text-foreground/70 transition-colors">{sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Nearby Places — GPS 있을 때. 데이터 0건이면 미노출. */}
          {kpopHasGps && (
            <NearbyPlacesSection
              data={nearbyData}
              loading={nearbyLoading}
            />
          )}
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

// 한국 주요 지역·동네 좌표 — CourseMiniMap 배경 레이블용
const DISTRICT_LABELS: ReadonlyArray<{ name: string; lat: number; lng: number }> = [
  // ─── 서울 ──────────────────────────────────────────────────────
  { name: "Hongdae",      lat: 37.5571, lng: 126.9234 },
  { name: "Itaewon",      lat: 37.5345, lng: 126.9940 },
  { name: "Myeongdong",   lat: 37.5635, lng: 126.9822 },
  { name: "Insadong",     lat: 37.5742, lng: 126.9856 },
  { name: "Gangnam",      lat: 37.4979, lng: 127.0276 },
  { name: "Sinchon",      lat: 37.5558, lng: 126.9367 },
  { name: "Bukchon",      lat: 37.5823, lng: 126.9852 },
  { name: "Seongsu",      lat: 37.5447, lng: 127.0558 },
  { name: "Mapo",         lat: 37.5614, lng: 126.9088 },
  { name: "Yeouido",      lat: 37.5219, lng: 126.9241 },
  { name: "Jamsil",       lat: 37.5133, lng: 127.1028 },
  { name: "Dongdaemun",   lat: 37.5714, lng: 127.0092 },
  { name: "Jongno",       lat: 37.5735, lng: 126.9789 },
  { name: "Apgujeong",    lat: 37.5270, lng: 127.0291 },
  { name: "Hapjeong",     lat: 37.5499, lng: 126.9142 },
  { name: "Yongsan",      lat: 37.5326, lng: 126.9903 },
  { name: "Cheongdam",    lat: 37.5224, lng: 127.0500 },
  { name: "Noryangjin",   lat: 37.5138, lng: 126.9425 },
  // ─── 부산 ──────────────────────────────────────────────────────
  { name: "Haeundae",     lat: 35.1631, lng: 129.1635 },
  { name: "Gwangalli",    lat: 35.1530, lng: 129.1185 },
  { name: "Nampo-dong",   lat: 35.0979, lng: 129.0306 },
  { name: "Gamcheon",     lat: 35.0975, lng: 129.0130 },
  { name: "Centum",       lat: 35.1686, lng: 129.1320 },
  { name: "Seomyeon",     lat: 35.1578, lng: 129.0597 },
  { name: "Gijang",       lat: 35.2445, lng: 129.0938 },
  { name: "Songjeong",    lat: 35.1793, lng: 129.1945 },
  { name: "Dongnae",      lat: 35.2025, lng: 129.0834 },
  // ─── 제주 ──────────────────────────────────────────────────────
  { name: "Jeju City",    lat: 33.4996, lng: 126.5312 },
  { name: "Seogwipo",     lat: 33.2541, lng: 126.5600 },
  { name: "Jungmun",      lat: 33.2484, lng: 126.4122 },
  { name: "Hallim",       lat: 33.3872, lng: 126.2378 },
  { name: "Seongsan",     lat: 33.4270, lng: 126.9200 },
  { name: "Hyeopjae",     lat: 33.3949, lng: 126.2394 },
  { name: "Aewol",        lat: 33.4638, lng: 126.3021 },
  { name: "Pyoseon",      lat: 33.3173, lng: 126.8178 },
  // ─── 강원 ──────────────────────────────────────────────────────
  { name: "Gangneung",    lat: 37.7519, lng: 128.8761 },
  { name: "Sokcho",       lat: 38.2048, lng: 128.5912 },
  { name: "Chuncheon",    lat: 37.8747, lng: 127.7342 },
  { name: "Pyeongchang",  lat: 37.3706, lng: 128.3906 },
  { name: "Yangyang",     lat: 38.0733, lng: 128.6178 },
  { name: "Samcheok",     lat: 37.4502, lng: 129.1658 },
  // ─── 경주 ──────────────────────────────────────────────────────
  { name: "Gyeongju",     lat: 35.8562, lng: 129.2247 },
  { name: "Hwangnidan",   lat: 35.8315, lng: 129.2214 },
  { name: "Bulguksa",     lat: 35.7900, lng: 129.3316 },
  { name: "Cheomseongdae",lat: 35.8347, lng: 129.2191 },
  { name: "Bomun",        lat: 35.8495, lng: 129.2876 },
  // ─── 전주 ──────────────────────────────────────────────────────
  { name: "Jeonju",       lat: 35.8468, lng: 127.1296 },
  { name: "Hanok Village",lat: 35.8168, lng: 127.1532 },
  { name: "Nambu Market", lat: 35.8104, lng: 127.1490 },
  // ─── 광주 ──────────────────────────────────────────────────────
  { name: "Gwangju",      lat: 35.1595, lng: 126.8526 },
  { name: "Yanglim",      lat: 35.1444, lng: 126.9052 },
  { name: "Chungjangno",  lat: 35.1471, lng: 126.9184 },
  // ─── 대전 ──────────────────────────────────────────────────────
  { name: "Daejeon",      lat: 36.3504, lng: 127.3845 },
  { name: "Sungsimdang",  lat: 36.3264, lng: 127.4269 },
  { name: "Yuseong",      lat: 36.3626, lng: 127.3558 },
  // ─── 대구 ──────────────────────────────────────────────────────
  { name: "Daegu",        lat: 35.8714, lng: 128.6014 },
  { name: "Dongseongno",  lat: 35.8686, lng: 128.5954 },
  { name: "Seomun Mkt",   lat: 35.8741, lng: 128.5797 },
  { name: "Bongnidan",    lat: 35.8561, lng: 128.6003 },
  // ─── 인천·경기 ─────────────────────────────────────────────────
  { name: "Incheon",      lat: 37.4563, lng: 126.7052 },
  { name: "Chinatown",    lat: 37.4748, lng: 126.6162 },
  { name: "Wolmido",      lat: 37.4740, lng: 126.5997 },
  { name: "Songdo",       lat: 37.3890, lng: 126.6425 },
  { name: "Suwon",        lat: 37.2636, lng: 127.0286 },
  { name: "Hwaseong",     lat: 37.2880, lng: 127.0149 },
]

// 전국 구·지역 경계 + 섬 외곽선 — 단순화된 폴리곤 [lat, lng]. opacity 0.15 얇은 선.
// 뷰포트 교차 시 자동 표시.
const DISTRICT_BOUNDARIES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  // ─── 서울 구 경계 ──────────────────────────────────────────────
  // 종로구
  [[37.620, 126.942], [37.617, 127.023], [37.577, 127.001], [37.573, 126.960], [37.589, 126.942]],
  // 중구
  [[37.577, 126.980], [37.577, 127.020], [37.553, 127.020], [37.553, 126.980]],
  // 용산구
  [[37.558, 126.960], [37.558, 127.007], [37.516, 127.007], [37.516, 126.960]],
  // 마포구
  [[37.572, 126.897], [37.572, 126.960], [37.534, 126.960], [37.519, 126.920], [37.519, 126.897]],
  // 성동구
  [[37.580, 127.007], [37.580, 127.075], [37.537, 127.075], [37.537, 127.007]],
  // 강남구
  [[37.538, 127.007], [37.538, 127.110], [37.477, 127.110], [37.477, 127.007]],
  // 서초구
  [[37.510, 126.985], [37.510, 127.062], [37.448, 127.062], [37.448, 126.985]],
  // 송파구
  [[37.538, 127.082], [37.538, 127.157], [37.472, 127.157], [37.472, 127.082]],
  // ─── 부산 구 경계 ──────────────────────────────────────────────
  // 해운대구
  [[35.183, 129.100], [35.183, 129.205], [35.125, 129.205], [35.125, 129.100]],
  // 수영구 (광안리)
  [[35.173, 129.072], [35.173, 129.120], [35.128, 129.120], [35.128, 129.072]],
  // 부산진구 (서면)
  [[35.178, 129.043], [35.178, 129.082], [35.138, 129.082], [35.138, 129.043]],
  // 중구 (남포동)
  [[35.112, 129.015], [35.112, 129.048], [35.090, 129.048], [35.090, 129.015]],
  // 기장군
  [[35.270, 129.075], [35.270, 129.230], [35.160, 129.230], [35.160, 129.075]],
  // ─── 제주 섬 외곽선 (시계방향, 12점 단순화) ──────────────────────
  [
    [33.545, 126.220], [33.558, 126.430], [33.543, 126.650],
    [33.515, 126.830], [33.477, 126.955], [33.388, 127.010],
    [33.268, 126.970], [33.200, 126.810], [33.175, 126.500],
    [33.215, 126.170], [33.335, 126.082], [33.465, 126.108],
  ],
]

// 전국 주요 강 — 단순화된 중심선 [lat, lng]. width 로 강 크기 구분.
// 뷰포트 교차 여부로 자동 필터링.
interface RiverPath {
  readonly name: string
  readonly width: number
  readonly points: ReadonlyArray<readonly [number, number]>
}
const RIVER_PATHS: ReadonlyArray<RiverPath> = [
  // 한강 — 서울 관통, 서→동
  { name: "Han River", width: 3.5, points: [
    [37.536, 126.834], [37.535, 126.875], [37.528, 126.913],
    [37.522, 126.948], [37.516, 126.990], [37.511, 127.030],
    [37.513, 127.075], [37.517, 127.115], [37.523, 127.145],
  ]},
  // 수영강 — 부산 동부 (해운대·센텀 인근)
  { name: "Suyeong River", width: 2, points: [
    [35.213, 129.107], [35.192, 129.112], [35.172, 129.125], [35.158, 129.143],
  ]},
  // 낙동강 — 부산 서부
  { name: "Nakdong River", width: 2.5, points: [
    [35.172, 128.902], [35.120, 128.940], [35.072, 128.962], [35.045, 128.985],
  ]},
  // 금호강 — 대구 북부, 동→서
  { name: "Geumho River", width: 2, points: [
    [35.912, 128.512], [35.900, 128.562], [35.882, 128.624], [35.864, 128.678],
  ]},
  // 영산강 — 광주 관통
  { name: "Yeongsan River", width: 2, points: [
    [35.207, 126.834], [35.180, 126.860], [35.158, 126.892], [35.143, 126.918],
  ]},
  // 소양강 — 춘천 (강원)
  { name: "Soyang River", width: 2, points: [
    [37.912, 127.706], [37.884, 127.733], [37.860, 127.746], [37.840, 127.752],
  ]},
  // 남대천 — 강릉, 동해로 흘러내림
  { name: "Namdae Stream", width: 1.5, points: [
    [37.762, 128.882], [37.757, 128.893], [37.749, 128.900], [37.744, 128.907],
  ]},
]

// 핀 반지름 — 컴포넌트 밖 상수로 관리
const MINI_MAP_PIN_R = 5

// 겹치는 핀 좌표 분산 (force-directed, 최대 20회 반복)
function resolveOverlaps(
  pts: Array<{ x: number; y: number }>,
  minDist: number
): Array<{ x: number; y: number }> {
  const res = pts.map((p) => ({ ...p }))
  for (let iter = 0; iter < 20; iter++) {
    let moved = false
    for (let i = 0; i < res.length; i++) {
      for (let j = i + 1; j < res.length; j++) {
        const dx = res[j].x - res[i].x
        const dy = res[j].y - res[i].y
        const d = Math.hypot(dx, dy)
        if (d < minDist) {
          const push = d > 0 ? (minDist - d) / 2 : minDist / 2
          const nx = d > 0 ? dx / d : 1
          const ny = d > 0 ? dy / d : 0
          res[i].x -= nx * push
          res[i].y -= ny * push
          res[j].x += nx * push
          res[j].y += ny * push
          moved = true
        }
      }
    }
    if (!moved) break
  }
  return res
}

// 여러 점을 통과하는 부드러운 SVG path 생성 (midpoint quadratic bezier)
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return ""
  if (pts.length === 2)
    return `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = ((pts[i].x + pts[i + 1].x) / 2).toFixed(1)
    const my = ((pts[i].y + pts[i + 1].y) / 2).toFixed(1)
    if (i === 0) {
      d += ` L ${mx},${my}`
    } else {
      d += ` Q ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} ${mx},${my}`
    }
  }
  d += ` L ${pts[pts.length - 1].x.toFixed(1)},${pts[pts.length - 1].y.toFixed(1)}`
  return d
}

// ─── CourseMiniMap — 동선 다이어그램 ────────────────────────────
// stop 의 lat/lng 를 SVG 좌표로 변환 후 번호 핀 + 점선 동선 표시.
// 배경: #0d0d0f + 격자 + 구 경계선 + DISTRICT_LABELS 지역 레이블.
// 기존 Curation K SVG 지도 동결 영역 미접촉.
function CourseMiniMap({ days }: { days: CourseDay[] }) {
  const [selectedDay, setSelectedDay] = useState(0)

  const W = 560
  const H = 220
  const PAD = 0.30

  type StopWithCoords = CourseStop & { lat: number; lng: number }

  const dayStops = useMemo<StopWithCoords[]>(() => {
    const d = days[Math.min(selectedDay, days.length - 1)]
    if (!d) return []
    return [...d.morning, ...d.afternoon, ...d.evening].filter(
      (s): s is StopWithCoords =>
        typeof s.lat === "number" &&
        typeof s.lng === "number" &&
        !isNaN(s.lat) &&
        !isNaN(s.lng) &&
        s.lat !== 0 &&
        s.lng !== 0
    )
  }, [days, selectedDay])

  const tr = useMemo(() => {
    if (dayStops.length === 0) return null

    const lats = dayStops.map((s) => s.lat)
    const lngs = dayStops.map((s) => s.lng)
    let minLat = Math.min(...lats)
    let maxLat = Math.max(...lats)
    let minLng = Math.min(...lngs)
    let maxLng = Math.max(...lngs)

    const MIN_SPAN = 0.012
    if (maxLat - minLat < MIN_SPAN) { const m = (maxLat + minLat) / 2; minLat = m - MIN_SPAN / 2; maxLat = m + MIN_SPAN / 2 }
    if (maxLng - minLng < MIN_SPAN) { const m = (maxLng + minLng) / 2; minLng = m - MIN_SPAN / 2; maxLng = m + MIN_SPAN / 2 }

    const pLat = (maxLat - minLat) * PAD
    const pLng = (maxLng - minLng) * PAD
    const minLat2 = minLat - pLat
    const maxLat2 = maxLat + pLat
    const minLng2 = minLng - pLng
    const maxLng2 = maxLng + pLng

    const toX = (lng: number) => ((lng - minLng2) / (maxLng2 - minLng2)) * W
    const toY = (lat: number) => (1 - (lat - minLat2) / (maxLat2 - minLat2)) * H
    const inView = (lat: number, lng: number) =>
      lat >= minLat2 && lat <= maxLat2 && lng >= minLng2 && lng <= maxLng2

    const labels = DISTRICT_LABELS.filter((l) => inView(l.lat, l.lng))
    const districtBounds = DISTRICT_BOUNDARIES.filter((poly) =>
      poly.some(([lat, lng]) => inView(lat, lng))
    )
    const rivers = RIVER_PATHS.filter((r) =>
      r.points.some(([lat, lng]) => inView(lat, lng))
    )

    return { toX, toY, labels, districtBounds, rivers }
  }, [dayStops])

  // 겹침 해소된 핀 위치
  const resolvedPins = useMemo(() => {
    if (!tr || dayStops.length === 0) return []
    const raw = dayStops.map((s) => ({ x: tr.toX(s.lng), y: tr.toY(s.lat) }))
    return resolveOverlaps(raw, MINI_MAP_PIN_R * 2 + 4)
  }, [tr, dayStops])

  const hasAnyCoords = days.some((d) =>
    [...d.morning, ...d.afternoon, ...d.evening].some(
      (s) => typeof s.lat === "number" && s.lat !== 0
    )
  )
  if (!hasAnyCoords) return null

  return (
    <div className="mt-4 pt-4 border-t border-border/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-muted-foreground text-[11px] uppercase tracking-wider">Route Map</p>
        {days.length > 1 && (
          <div className="flex gap-1">
            {days.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedDay(i)}
                className="px-3 py-1 rounded-full text-[11px] font-medium border transition-colors"
                style={
                  selectedDay === i
                    ? { backgroundColor: "#FF4B6E", borderColor: "#FF4B6E", color: "#fff" }
                    : { backgroundColor: "#0d0d0f", borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }
                }
              >
                Day {d.day}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="rounded-xl overflow-hidden border border-border/30"
        style={{ backgroundColor: "#0d0d0f" }}
      >
        {dayStops.length === 0 ? (
          <div className="flex items-center justify-center h-28 text-muted-foreground/50 text-xs">
            Map not available for this day
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block" }}>
            <defs>
              <pattern id="cmg" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.033)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="#0d0d0f" />
            <rect width={W} height={H} fill="url(#cmg)" />

            {/* 구 경계선·섬 외곽선 — 제주는 강화 스타일 */}
            {tr && tr.districtBounds.map((poly, idx) => {
              const isJeju = poly.some(([lat]) => lat < 34.0)
              return (
                <polygon
                  key={`db-${idx}`}
                  points={poly.map(([lat, lng]) => `${tr.toX(lng)},${tr.toY(lat)}`).join(" ")}
                  fill="none"
                  stroke={isJeju ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)"}
                  strokeWidth={isJeju ? "1.5" : "0.8"}
                />
              )
            })}

            {/* 강 — 뷰포트 안 강만 렌더링, smoothPath 로 곡선 처리 */}
            {tr && tr.rivers.map((river) => (
              <path
                key={river.name}
                d={smoothPath(river.points.map(([lat, lng]) => ({ x: tr.toX(lng), y: tr.toY(lat) })))}
                fill="none"
                stroke="rgba(100,160,255,0.30)"
                strokeWidth={river.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* 지역 배경 레이블 — 폰트 축소 */}
            {tr?.labels.map((l) => (
              <text
                key={`${l.name}-${l.lat}`}
                x={tr.toX(l.lng)}
                y={tr.toY(l.lat)}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.20)"
                fontSize="9"
                fontWeight="500"
              >
                {l.name}
              </text>
            ))}

            {/* 점선 동선 (겹침 해소 위치 기준) */}
            {resolvedPins.length > 1 && (
              <polyline
                points={resolvedPins.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#FF4B6E"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                strokeOpacity="0.45"
              />
            )}

            {/* 번호 핀 + 장소명 — 절반 크기, 우측 여백 부족 시 좌측 표시 */}
            {resolvedPins.map((pos, i) => {
              const rawName = dayStops[i]?.name ?? ""
              const label = rawName.length > 10 ? rawName.slice(0, 10) + "…" : rawName
              const toRight = pos.x <= W * 0.72
              const labelX = toRight ? pos.x + MINI_MAP_PIN_R + 3 : pos.x - MINI_MAP_PIN_R - 3
              return (
                <g key={`pin-${i}`}>
                  <circle cx={pos.x} cy={pos.y} r={MINI_MAP_PIN_R + 2} fill="rgba(255,75,110,0.10)" />
                  <circle cx={pos.x} cy={pos.y} r={MINI_MAP_PIN_R} fill="#FF4B6E" />
                  <text
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize="6"
                    fontWeight="700"
                  >
                    {i + 1}
                  </text>
                  {label && (
                    <text
                      x={labelX}
                      y={pos.y}
                      textAnchor={toRight ? "start" : "end"}
                      dominantBaseline="central"
                      fill="rgba(255,255,255,0.75)"
                      fontSize="7"
                      fontWeight="500"
                    >
                      {label}
                    </text>
                  )}
                </g>
              )
            })}
            {/* 나침반 방향 — 네 모서리 */}
            {[
              { d: "N", x: W / 2, y: 10,    a: "middle" },
              { d: "S", x: W / 2, y: H - 6, a: "middle" },
              { d: "W", x: 8,     y: H / 2, a: "start"  },
              { d: "E", x: W - 8, y: H / 2, a: "end"    },
            ].map(({ d, x, y, a }) => (
              <text
                key={d}
                x={x}
                y={y}
                textAnchor={a as "start" | "middle" | "end"}
                dominantBaseline="central"
                fill="rgba(255,255,255,0.40)"
                fontSize="8"
                fontWeight="600"
              >
                {d}
              </text>
            ))}
          </svg>
        )}
      </div>

      {/* 범례 */}
      {dayStops.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {dayStops.map((stop, i) => (
            <div key={`leg-${i}`} className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-flex items-center justify-center rounded-full text-white flex-shrink-0"
                style={{
                  width: 14,
                  height: 14,
                  backgroundColor: "#FF4B6E",
                  fontSize: 7,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </span>
              <span className="text-muted-foreground text-[11px] truncate max-w-[100px]">
                {stop.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
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
    arrival_region: string
  }
  saved?: boolean
  saving?: boolean
  onSave?: () => void
  onRegenerate?: () => void
  regenerating?: boolean
  compact?: boolean
}) {
  const routeLabel =
    meta.departure_region === meta.arrival_region
      ? `from ${meta.departure_region}`
      : `${meta.departure_region} → ${meta.arrival_region}`
  return (
    <div
      className={
        compact
          ? "space-y-4"
          : "bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 space-y-4"
      }
    >
      {!compact && (
        <>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-foreground font-semibold text-base">
                {meta.drama_title}
              </h3>
              <p className="text-muted-foreground text-xs mt-1">
                {prettyTravelStyle(meta.travel_style)} · {meta.duration_days}d · {routeLabel}
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
          {onSave && !saved && (
            <p className="text-muted-foreground/60 text-[11px]">
              Up to 6 courses saved. New saves replace the oldest.
            </p>
          )}
        </>
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

      <CourseMiniMap days={itinerary.days} />
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
    case "filming":
      return "Filming Tour"
    case "sightseeing":
      return "Sightseeing"
    case "foodie":
      return "Foodie"
    case "cultural":
      return "Cultural"
    case "shopping":
      return "Shopping"
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

// ─── TravelCourseModal ─────────────────────────────────────────
// Plan Your Trip — 드라마별 1일 여행 코스 모달.
// 비로그인 조회 가능 / Pro 는 저장 버튼 노출.
function TravelCourseModal({
  open,
  course,
  loading,
  error,
  isPro,
  isSaving,
  isSaved,
  savedCourseId,
  onClose,
  onSave,
  onShare,
  onPdfDownload,
}: {
  open: boolean
  course: TravelCourse | null
  loading: boolean
  error: string | null
  isPro: boolean
  isSaving: boolean
  isSaved: boolean
  savedCourseId: string | null
  onClose: () => void
  onSave: () => void
  onShare: () => void
  onPdfDownload: () => void
}) {
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  function handleAction(action: "save" | "share" | "pdf") {
    if (!isPro) { setShowUpgrade(true); return }
    setShowUpgrade(false)
    if (action === "save") {
      onSave()
    } else if (action === "share") {
      onShare()
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } else {
      onPdfDownload()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl border-border/40 flex flex-col overflow-hidden"
        style={{ backgroundColor: "#1a1a1a", maxHeight: "90vh" }}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-white pr-8">
            {loading
              ? "Planning your trip…"
              : course?.course_title ?? "Travel Course"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Sparkles
                className="w-6 h-6 animate-pulse"
                style={{ color: "#FF4B6E" }}
              />
              <p className="text-muted-foreground text-sm">
                Generating your K-drama tour…
              </p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <p className="text-red-400 text-sm py-4">{error}</p>
          )}

          {/* Course content */}
          {!loading && course && (
            <>
              {course.description && (
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                  {course.description}
                </p>
              )}

              <div className="space-y-5 pb-2">
                {course.stops.map((stop, idx) => (
                  <div key={stop.spot_id}>
                    {/* 이동 시간 커넥터 */}
                    {idx > 0 && (
                      <div className="flex items-center gap-2 mb-3 ml-3.5">
                        <div
                          className="w-0.5 h-5 rounded-full"
                          style={{ backgroundColor: "rgba(255,75,110,0.3)" }}
                        />
                        {stop.duration_min > 0 && (
                          <span className="text-muted-foreground text-xs">
                            ~{stop.duration_min} min
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3">
                      {/* 순서 번호 */}
                      <div
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                        style={{ backgroundColor: "#FF4B6E" }}
                      >
                        {stop.order}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* 촬영지 카드 */}
                        <div
                          className="border border-border/20 rounded-xl overflow-hidden"
                          style={{ backgroundColor: "#141416" }}
                        >
                          {stop.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={stop.image_url}
                              alt={stop.spot_name}
                              className="w-full h-28 object-cover"
                            />
                          )}
                          <div className="p-3">
                            <h3 className="text-white font-semibold text-sm">
                              {stop.spot_name}
                            </h3>
                            {stop.address && (
                              <p className="text-muted-foreground text-xs mt-0.5">
                                {stop.address}
                              </p>
                            )}
                            {stop.visit_tip && (
                              <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
                                {stop.visit_tip}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 주변 추천 칩 */}
                        {(stop.nearby_food || stop.nearby_stay) && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {stop.nearby_food && (
                              <a
                                href={stop.nearby_food.maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border/30 hover:border-yellow-500/50 transition-colors"
                                style={{
                                  backgroundColor: "#1a1a1a",
                                  color: "#facc15",
                                }}
                              >
                                <UtensilsCrossed className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate max-w-[110px]">
                                  {stop.nearby_food.title}
                                </span>
                                <span className="text-muted-foreground flex-shrink-0">
                                  {stop.nearby_food.distance_km}km
                                </span>
                              </a>
                            )}
                            {stop.nearby_stay && (
                              <a
                                href={stop.nearby_stay.maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border/30 hover:border-purple-400/50 transition-colors"
                                style={{
                                  backgroundColor: "#1a1a1a",
                                  color: "#a78bfa",
                                }}
                              >
                                <Hotel className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate max-w-[110px]">
                                  {stop.nearby_stay.title}
                                </span>
                                <span className="text-muted-foreground flex-shrink-0">
                                  {stop.nearby_stay.distance_km}km
                                </span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 하단 액션 버튼 */}
              <div className="mt-6 pt-4 border-t border-border/30 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {course.gmaps_url && (
                    <a
                      href={course.gmaps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[160px]"
                    >
                      <Button
                        className="w-full rounded-xl text-white flex items-center gap-2"
                        style={{ backgroundColor: "#FF4B6E" }}
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open in Google Maps
                      </Button>
                    </a>
                  )}
                  <Button
                    onClick={() => handleAction("save")}
                    disabled={isSaving || isSaved}
                    variant="outline"
                    className="flex-shrink-0 rounded-xl border-border/50 disabled:opacity-60"
                  >
                    {isSaved ? "Saved ✓" : isSaving ? "Saving…" : "Save Course"}
                  </Button>
                  <Button
                    onClick={() => handleAction("share")}
                    disabled={!savedCourseId}
                    variant="outline"
                    className="flex-shrink-0 rounded-xl border-border/50 disabled:opacity-60"
                  >
                    {linkCopied ? (
                      <><Check className="w-4 h-4 mr-1.5" />Copied!</>
                    ) : (
                      <><Link2 className="w-4 h-4 mr-1.5" />Share</>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleAction("pdf")}
                    variant="outline"
                    className="flex-shrink-0 rounded-xl border-border/50"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    PDF
                  </Button>
                </div>
                {showUpgrade && (
                  <div
                    className="flex items-center justify-center gap-2 p-3 rounded-xl"
                    style={{
                      backgroundColor: "rgba(255, 75, 110, 0.1)",
                      border: "1px solid rgba(255, 75, 110, 0.25)",
                    }}
                  >
                    <Lock className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />
                    <p className="text-sm font-medium" style={{ color: "#FF4B6E" }}>
                      Coming with Hallyu Pass
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
