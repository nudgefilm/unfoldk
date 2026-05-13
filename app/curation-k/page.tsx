"use client"

// /curation-k — Curation K (M+5 / HallyuMap) 마케팅 랜딩.
// 기획안 SERVICE_ARCHITECTURE.md §6 / HALLYUMAP.md 기준.
//
// 구성:
//   1. Hero — Ghost-style 투명 SVG 한국 지도 + 핑크 도시 마커 펄스
//   2. 5개 탭 구조 미리보기 카드 (촬영지·맛집·K팝 성지·숙박·AI 코스)
//   3. Coming Soon 배너 + 이메일 사전 등록 폼
//
// 미출시 서비스 → 데이터 fetching 없음. 폼 submit 은 토스트 + success state 만.
// TODO: [다음 세션] waitlist API 연동 — Curation K M+5 사전 등록자 DB 저장.

import { useState, type FormEvent } from "react"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { Clapperboard, UtensilsCrossed, Music, BedDouble, Sparkles, MapPin, CheckCircle2 } from "lucide-react"

// 한국 본토 simplified outline — viewBox 400x540. 실측 좌표 아닌 stylized shape.
// Ghost Globe 톤(흰색 stroke / 투명 fill) 유지를 위해 SDK 없이 직접 그림.
const KOREA_MAINLAND_PATH =
  "M 200,38 L 240,46 L 268,58 L 282,84 L 286,118 L 295,150 L 312,188 L 322,232 L 327,278 L 320,318 L 302,352 L 280,382 L 252,406 L 220,418 L 188,418 L 158,402 L 135,378 L 118,348 L 105,310 L 95,265 L 92,218 L 100,172 L 115,135 L 138,98 L 168,68 L 188,48 Z"

// 페이지 미리보기용 주요 한류 도시 — viewBox 좌표 + 표시명
const KOREA_CITIES: Array<{ name: string; cx: number; cy: number; tier: "primary" | "secondary" }> = [
  { name: "Seoul", cx: 195, cy: 130, tier: "primary" },
  { name: "Chuncheon", cx: 235, cy: 135, tier: "secondary" },
  { name: "Gyeongju", cx: 285, cy: 285, tier: "secondary" },
  { name: "Busan", cx: 290, cy: 345, tier: "primary" },
  { name: "Gwangju", cx: 185, cy: 340, tier: "secondary" },
  { name: "Jeju", cx: 175, cy: 488, tier: "primary" },
]

const FEATURES = [
  {
    icon: Clapperboard,
    title: "K-Drama Filming Spots",
    description:
      "Walk the cafés from Goblin, the stairs from Itaewon Class, the streets from Crash Landing on You — curated from a Hallyu fan's perspective.",
  },
  {
    icon: UtensilsCrossed,
    title: "Korean Food Hotspots",
    description:
      "Drama-famous restaurants and regional dishes mapped by neighborhood. Connects with KfoodKit recipes.",
  },
  {
    icon: Music,
    title: "K-Pop Pilgrimage Sites",
    description:
      "Agency buildings, pop-up stores, MV locations, idol-favorite spots — every K-pop fan's must-visit list.",
  },
  {
    icon: BedDouble,
    title: "Themed Stays",
    description:
      "Hotels and hanok stays curated as “near filming locations” or “next to your bias agency” — practical info for visiting fans.",
  },
  {
    icon: Sparkles,
    title: "AI 1-Day Courses",
    description:
      "Claude AI generates personalized day-trip routes based on your KdramaMatch taste and visit duration. Pro feature.",
  },
]

export default function CurationKPage() {
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    // TODO: [다음 세션] 실제 waitlist API 호출. 현 단계는 즉시 success 처리.
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
        {/* Hero — Ghost-style 투명 한국 지도 */}
        <section className="relative w-full overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 pt-12 pb-16 md:pt-20 md:pb-24">
            <div className="flex flex-col items-center text-center">
              {/* SVG 한국 지도 — 흰색 stroke + 핑크 도시 마커 펄스. Ghost Globe 톤 통일. */}
              <div className="relative w-[260px] h-[350px] md:w-[360px] md:h-[480px] mb-8">
                <svg
                  viewBox="0 0 400 540"
                  className="w-full h-full"
                  aria-hidden="true"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* 위도선 / 경도선 hint — 0.08 opacity 로 매우 절제 */}
                  {[120, 200, 280, 360, 440].map((y) => (
                    <line key={`lat-${y}`} x1="40" y1={y} x2="360" y2={y} stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1" />
                  ))}
                  {[100, 200, 300].map((x) => (
                    <line key={`lon-${x}`} x1={x} y1="20" x2={x} y2="520" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1" />
                  ))}

                  {/* 한국 본토 outline — 흰색 stroke, 투명 fill */}
                  <path
                    d={KOREA_MAINLAND_PATH}
                    stroke="#ffffff"
                    strokeOpacity="0.45"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />

                  {/* 제주도 — 작은 타원 */}
                  <ellipse
                    cx="175"
                    cy="488"
                    rx="28"
                    ry="14"
                    stroke="#ffffff"
                    strokeOpacity="0.45"
                    strokeWidth="1.5"
                  />

                  {/* 울릉도 + 독도 — 동쪽 작은 점 */}
                  <circle cx="358" cy="225" r="3" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.2" />
                  <circle cx="378" cy="230" r="1.8" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1" />

                  {/* 도시 마커 — primary 는 큰 펄스, secondary 는 작은 정지 점 */}
                  {KOREA_CITIES.map((city) => (
                    <g key={city.name}>
                      {city.tier === "primary" && (
                        <circle
                          cx={city.cx}
                          cy={city.cy}
                          r="10"
                          fill="#FF4B6E"
                          opacity="0.25"
                          className="animate-ping"
                          style={{ transformOrigin: `${city.cx}px ${city.cy}px` }}
                        />
                      )}
                      <circle
                        cx={city.cx}
                        cy={city.cy}
                        r={city.tier === "primary" ? 5 : 3.5}
                        fill="#FF4B6E"
                      />
                      <text
                        x={city.cx + 10}
                        y={city.cy + 4}
                        fill="#ffffff"
                        opacity="0.7"
                        fontSize="11"
                        fontFamily="system-ui, sans-serif"
                      >
                        {city.name}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 border border-border/40 bg-[#1a1a1a]">
                <MapPin className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
                <span className="text-xs text-muted-foreground font-medium">M+5 · Coming Soon</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight">
                Curation K
              </h1>
              <p className="text-muted-foreground text-lg md:text-xl max-w-2xl">
                Explore Korea like a Hallyu fan — drama locations, fan landmarks, themed stays, and AI day-trip routes on one map.
              </p>
            </div>
          </div>
        </section>

        {/* Coming Soon 배너 — 브랜드 핑크 left border, /food Weekly Challenge 카드와 동일 패턴 */}
        <section className="max-w-6xl mx-auto px-4 mb-12">
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
              <a
                href="#pre-register"
                className="rounded-full font-medium text-white text-sm px-5 py-2.5 whitespace-nowrap text-center"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                Notify me
              </a>
            </div>
          </div>
        </section>

        {/* 5개 탭 구조 미리보기 */}
        <section className="max-w-6xl mx-auto px-4 mb-16">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">What's inside</h2>
            <p className="text-muted-foreground text-sm">
              Five tabs per region — every Hallyu interest, mapped.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-[#1a1a1a] rounded-xl p-6 border border-border/30 hover:border-border/60 transition-colors"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.12)" }}
                >
                  <Icon className="w-5 h-5" style={{ color: "#FF4B6E" }} />
                </div>
                <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pre-register CTA */}
        <section id="pre-register" className="max-w-6xl mx-auto px-4 pb-20">
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
