"use client"

// /curation-k — Curation K (M+5 / HallyuMap) 마케팅 랜딩.
// 기획안 SERVICE_ARCHITECTURE.md v1.2 §6 / HALLYUMAP.md 기준.
//
// 구성:
//   1. Hero (max-w-[1320px] split, 지도 비중 60%) — 실사 SVG 한국 지도 + 부속 도서
//   2. Coming Soon 배너 — M+5 출시 안내
//   3. What's inside — 5탭 (촬영지·맛집·K팝 성지·숙박·AI 코스), 각 데이터 소스 라벨
//   4. Why you'll keep coming back — 4 재방문 유도 기능 (§6 재방문 핵심)
//   5. Connected to your Hallyu routine — 3 타 서비스 연계 카드
//   6. Pre-register CTA — 이메일 사전 등록
//
// 지도 데이터: world-atlas countries-50m TopoJSON → South Korea (id "410") 폴리곤.
// 50m 해상도는 작은 섬을 누락하므로 독도·마라도·울릉도·백령도는 별도 마커로 명시.
//
// 미출시 → 데이터 fetching 없음. 폼 submit 은 토스트 + success state 만.
// TODO: [다음 세션] waitlist API 연동 — Curation K M+5 사전 등록자 DB 저장.

import { useState, useEffect, type FormEvent } from "react"
import { feature } from "topojson-client"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import {
  Clapperboard,
  UtensilsCrossed,
  Music,
  BedDouble,
  Sparkles,
  MapPin,
  CheckCircle2,
  CalendarClock,
  Camera,
  Users,
  Film,
  Languages,
} from "lucide-react"

// 한국 + 부속 도서 bbox — 백령도(124.6) ~ 독도(131.9) / 마라도(33.1) ~ 휴전선(38.7).
const LNG_MIN = 124.3
const LNG_MAX = 132.1
const LAT_MIN = 32.9
const LAT_MAX = 38.8
const SVG_W = 400
const SVG_H = 540

// equirectangular projection — 한국 영역 lat 폭 좁아 큰 왜곡 없음. lat 큰 게 y 작음.
function proj(lng: number, lat: number): [number, number] {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * SVG_W
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * SVG_H
  return [x, y]
}

// GeoJSON ring → "M x,y L x,y ... Z" SVG path
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
  if (geom.type === "Polygon") {
    return geom.coordinates.map(ringToPath).join(" ")
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates.flatMap((poly) => poly.map(ringToPath)).join(" ")
  }
  return ""
}

// 주요 한류 도시 — 위경도. proj() 로 자동 좌표 변환.
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
const KOREA_ISLANDS: Array<{
  name: string
  lng: number
  lat: number
  labelOffset: [number, number]
}> = [
  { name: "Baengnyeong", lng: 124.7, lat: 37.97, labelOffset: [8, -6] },
  { name: "Ulleung", lng: 130.85, lat: 37.5, labelOffset: [-58, 4] },
  { name: "Dokdo", lng: 131.87, lat: 37.24, labelOffset: [-46, 16] },
  { name: "Marado", lng: 126.27, lat: 33.11, labelOffset: [-50, 14] },
]

// §6-3 지역 상세 5개 탭
const FEATURES = [
  {
    icon: Clapperboard,
    title: "K-Drama Filming Spots",
    description:
      "Walk the cafés from Goblin, the stairs from Itaewon Class, the streets from Crash Landing on You — every drama location, mapped from a Hallyu fan's perspective.",
    source: "TourAPI · TMDB",
  },
  {
    icon: UtensilsCrossed,
    title: "Korean Food Hotspots",
    description:
      "Drama-famous restaurants and regional dishes mapped by neighborhood. One tap connects to KfoodKit recipes you can recreate at home.",
    source: "TourAPI",
  },
  {
    icon: Music,
    title: "K-Pop Pilgrimage Sites",
    description:
      "Agency buildings, pop-up stores, MV shoot locations, idol-favorite cafés — the unofficial fan map of every K-pop landmark in Korea.",
    source: "TourAPI · 수동 큐레이션",
  },
  {
    icon: BedDouble,
    title: "Themed Stays",
    description:
      "Hotels, guesthouses, and hanok stays curated as “near filming locations” or “next to your bias's agency” — practical info for visiting fans.",
    source: "TourAPI 숙박",
  },
  {
    icon: Sparkles,
    title: "AI 1-Day Courses",
    description:
      "Claude AI generates a personalized day-trip route based on your KdramaMatch taste and visit duration. Walking time and transit included.",
    source: "Claude AI · Google Maps",
    badge: "Pro",
  },
]

// §6 재방문 유도 핵심
const REVISIT_HOOKS = [
  {
    icon: CalendarClock,
    title: "Monthly Pilgrimage Course",
    description: "Every month, a fresh curated route — “December Goblin Snow Trail”, “Cherry Blossom K-drama Walk.”",
  },
  {
    icon: Sparkles,
    title: "AI Routes from Your Taste",
    description: "Linked to your KdramaMatch profile. Watched My Demon? Get a Seoul day-trip built around it.",
  },
  {
    icon: Camera,
    title: "Visit & Share",
    description: "Check in at a spot, share to Instagram or TikTok — earn Hallyu Pass days for verified visits.",
  },
  {
    icon: Users,
    title: "Fan-Submitted Spots",
    description: "Found a hidden landmark? Submit it. Admin-reviewed entries unlock fan rewards.",
  },
]

// 타 서비스 연계
const CONNECTED_SERVICES = [
  {
    icon: Film,
    title: "From KdramaMatch",
    description: "Your watched-and-loved dramas become the foundation for personalized AI travel routes.",
    href: "/drama",
  },
  {
    icon: UtensilsCrossed,
    title: "Into KfoodKit",
    description: "Tap any restaurant on the map to jump into a recipe you can cook back home.",
    href: "/food",
  },
  {
    icon: Languages,
    title: "Powered by HangeulGo",
    description: "Bring location-specific Korean phrases on your trip — “Is this the Goblin café?”",
    href: "/korean",
  },
]

// world-atlas TopoJSON 응답 — countries 컬렉션만 사용. id 는 ISO 3166-1 numeric.
// topojson-specification 의존성 회피 위해 최소 shape 만 선언.
interface CountriesAtlas {
  type: string
  objects: {
    countries: {
      type: string
      geometries: unknown[]
    }
  }
  arcs: number[][][]
}

export default function CurationKPage() {
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [koreaPath, setKoreaPath] = useState<string | null>(null)

  // South Korea polygon fetch — ghost-globe.tsx 와 같은 jsdelivr CDN. 50m 해상도.
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
        if (korea?.geometry) {
          setKoreaPath(geometryToPath(korea.geometry))
        }
      })
      .catch((err) => {
        console.warn("[curation-k] Korea map load failed:", err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    // TODO: [다음 세션] 실제 waitlist API 호출. 현 단계는 즉시 success.
    await new Promise((r) => setTimeout(r, 400))
    setSubmitting(false)
    setRegistered(true)
    toast({
      title: "You're on the list",
      description: "We'll email you when Curation K launches.",
    })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      <main className="flex-1 w-full">
        {/* Hero — split 1.6:1 (지도 62% / 텍스트 38%) */}
        <section className="relative w-full overflow-hidden">
          <div className="max-w-[1320px] mx-auto px-6 pt-10 pb-12 md:pt-14 md:pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-8 lg:gap-12 items-center">
              {/* 좌측: 실사 SVG 한국 지도 (부속 도서 포함) */}
              <div className="relative w-full max-w-[560px] sm:max-w-[680px] lg:max-w-none mx-auto lg:mx-0 aspect-[5/7]">
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

                  {/* 실사 South Korea polygon — load 전에는 비어 있음 */}
                  {koreaPath && (
                    <>
                      <path
                        d={koreaPath}
                        fillRule="evenodd"
                        fill="#FF4B6E"
                        fillOpacity="0.04"
                        stroke="#FF4B6E"
                        strokeOpacity="0.15"
                        strokeWidth="4"
                        strokeLinejoin="round"
                      />
                      <path
                        d={koreaPath}
                        fillRule="evenodd"
                        fill="#ffffff"
                        fillOpacity="0.03"
                        stroke="#ffffff"
                        strokeOpacity="0.55"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                    </>
                  )}

                  {/* 부속 도서 명시 마커 — 50m TopoJSON 누락 보완.
                      독도·마라도 등 영토 주권 표기 + 라벨로 fan-friendly 강조. */}
                  {KOREA_ISLANDS.map((island) => {
                    const [cx, cy] = proj(island.lng, island.lat)
                    const [lx, ly] = island.labelOffset
                    return (
                      <g key={island.name}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r="2.6"
                          fill="#ffffff"
                          opacity="0.65"
                        />
                        <text
                          x={cx + lx}
                          y={cy + ly}
                          fill="#ffffff"
                          opacity="0.55"
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
              </div>

              {/* 우측: 압축된 제목·CTA */}
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 border border-border/40 bg-[#1a1a1a]">
                  <MapPin className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
                  <span className="text-xs text-muted-foreground font-medium">M+5 · Coming Soon</span>
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
                  Curation K
                </h1>
                <p className="text-muted-foreground text-base md:text-lg mb-2">
                  Korea, mapped for Hallyu fans.
                </p>
                <p className="text-muted-foreground/80 text-sm mb-7">
                  Drama spots · K-pop landmarks · themed stays · AI day courses.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <a
                    href="#pre-register"
                    className="rounded-full font-medium text-white text-sm px-5 py-3 whitespace-nowrap text-center shadow-sm"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    Notify me at launch
                  </a>
                  <a
                    href="#features"
                    className="rounded-full font-medium text-foreground text-sm px-5 py-3 whitespace-nowrap text-center border border-border/40 hover:bg-[#1a1a1a] transition-colors"
                  >
                    See what's inside
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Coming Soon 배너 — /food Weekly Challenge 카드 패턴 */}
        <section className="max-w-[1320px] mx-auto px-6 mb-12">
          <div className="bg-[#1a1a1a] rounded-xl p-6 border-l-4" style={{ borderLeftColor: "#FF4B6E" }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                >
                  <Sparkles className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Launching after KfoodKit (M+5)</h2>
                  <p className="text-muted-foreground text-sm">
                    The full Hallyu travel companion — from your screen to Seoul, Busan, Jeju, and beyond.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What's inside — 5탭 + 데이터 소스 라벨 */}
        <section id="features" className="max-w-[1320px] mx-auto px-6 mb-16 scroll-mt-24">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">What's inside</h2>
            <p className="text-muted-foreground text-sm">
              Five tabs per region — every Hallyu interest, mapped.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, description, source, badge }) => (
              <div
                key={title}
                className="bg-[#1a1a1a] rounded-xl p-6 border border-border/30 hover:border-border/60 transition-colors flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.12)" }}
                  >
                    <Icon className="w-5 h-5" style={{ color: "#FF4B6E" }} />
                  </div>
                  {badge && (
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      {badge}
                    </span>
                  )}
                </div>
                <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">{description}</p>
                <div className="mt-4 pt-3 border-t border-border/20">
                  <span className="text-[11px] text-muted-foreground/70 font-mono">{source}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Why you'll keep coming back — §6 재방문 유도 */}
        <section className="max-w-[1320px] mx-auto px-6 mb-16">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Why you'll keep coming back</h2>
            <p className="text-muted-foreground text-sm">
              Curation K isn't a static map — it's a Hallyu travel routine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {REVISIT_HOOKS.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-[#1a1a1a] rounded-xl p-5 border border-border/30"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.12)" }}
                >
                  <Icon className="w-5 h-5" style={{ color: "#FF4B6E" }} />
                </div>
                <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Connected to your Hallyu routine — 타 서비스 연계 */}
        <section className="max-w-[1320px] mx-auto px-6 mb-16">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Connected to your Hallyu routine
            </h2>
            <p className="text-muted-foreground text-sm">
              Curation K plugs into the rest of your UnfoldK Pass.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CONNECTED_SERVICES.map(({ icon: Icon, title, description, href }) => (
              <a
                key={title}
                href={href}
                className="bg-[#161618] rounded-xl p-6 border border-border/20 hover:border-border/50 hover:bg-[#1a1a1a] transition-colors group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.12)" }}
                  >
                    <Icon className="w-4 h-4" style={{ color: "#FF4B6E" }} />
                  </div>
                  <h3 className="text-white font-semibold text-sm group-hover:text-[#FF4B6E] transition-colors">
                    {title}
                  </h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </a>
            ))}
          </div>
        </section>

        {/* Pre-register CTA */}
        <section id="pre-register" className="max-w-[1320px] mx-auto px-6 pb-20 scroll-mt-24">
          <div
            className="rounded-2xl p-8 md:p-12 text-center"
            style={{
              backgroundColor: "#161618",
              backgroundImage:
                "radial-gradient(ellipse at top, rgba(255, 75, 110, 0.12), transparent 60%)",
            }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Be the first to map your Hallyu trip
            </h2>
            <p className="text-muted-foreground text-sm md:text-base mb-8 max-w-xl mx-auto">
              We'll email you the moment Curation K launches — no spam, just one notification.
            </p>

            {registered ? (
              <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#1a1a1a] border border-border/40">
                <CheckCircle2 className="w-5 h-5" style={{ color: "#FF4B6E" }} />
                <span className="text-white font-medium text-sm">You're on the list</span>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
              >
                <Input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="flex-1 bg-[#0d0d0f] border-border/40 rounded-full px-5 py-6 text-foreground placeholder:text-muted-foreground"
                />
                <Button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full font-medium px-6 py-6 text-white shadow-sm whitespace-nowrap"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  {submitting ? "Saving…" : "Notify me"}
                </Button>
              </form>
            )}
          </div>
        </section>
      </main>

      <FooterSection />

      {/* useToast 호출 영역 — 비-admin 페이지엔 로컬 Toaster 마운트 필수 */}
      <Toaster />
    </div>
  )
}
