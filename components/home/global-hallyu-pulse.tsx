import Link from "next/link"
import Image from "next/image"
import { TrendingUp } from "lucide-react"

export interface RisingArtist {
  id: string
  name_en: string
  image_url: string | null
  listeners_7d: number
  listeners_change: number
}

export interface CountryTopArtist {
  country_code: string
  artist_name: string
  listeners: number
}

export interface TopDrama {
  id: string
  title: string
  poster_url: string | null
  year: number
  popularity: number | null
}

interface GlobalHallyuPulseProps {
  risingArtists: RisingArtist[]
  countryTopArtists: CountryTopArtist[]
  topDramas: TopDrama[]
}

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", KR: "🇰🇷", JP: "🇯🇵", TH: "🇹🇭", PH: "🇵🇭", ID: "🇮🇩",
  VN: "🇻🇳", MY: "🇲🇾", SG: "🇸🇬", TW: "🇹🇼", CN: "🇨🇳", BR: "🇧🇷",
  MX: "🇲🇽", GB: "🇬🇧", AU: "🇦🇺", CA: "🇨🇦", FR: "🇫🇷", DE: "🇩🇪",
  IN: "🇮🇳", CL: "🇨🇱", AR: "🇦🇷", PE: "🇵🇪", CO: "🇨🇴",
}

function fmtListeners(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

export function GlobalHallyuPulse({
  risingArtists,
  countryTopArtists,
  topDramas,
}: GlobalHallyuPulseProps) {
  const hasData =
    risingArtists.length > 0 || countryTopArtists.length > 0 || topDramas.length > 0
  if (!hasData) return null

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-5">
        <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
          GLOBAL HALLYU PULSE
        </h2>
        <span className="text-xs text-muted-foreground/60">Powered by Last.fm</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 상승 아티스트 */}
        {risingArtists.length > 0 && (
          <div className="lg:col-span-1 bg-[#141418] border border-border/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Rising This Week
              </p>
            </div>
            <div className="space-y-3">
              {risingArtists.map((a, i) => (
                <Link
                  key={a.id}
                  href={`/kpop/${a.id}`}
                  className="flex items-center gap-3 group"
                >
                  <span className="text-xs text-muted-foreground/40 w-4 shrink-0 tabular-nums">
                    {i + 1}
                  </span>
                  {a.image_url ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-[#1e1e24]">
                      <Image
                        src={a.image_url}
                        alt={a.name_en}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#1e1e24] shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate group-hover:opacity-80 transition-opacity">
                      {a.name_en}
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      {fmtListeners(a.listeners_7d)} listeners
                    </p>
                  </div>
                  {a.listeners_change > 0 && (
                    <span className="text-xs font-semibold shrink-0" style={{ color: "#FF4B6E" }}>
                      +{fmtListeners(a.listeners_change)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
            <Link
              href="/kpop"
              className="mt-4 block text-xs font-medium transition-opacity hover:opacity-80 text-right"
              style={{ color: "#FF4B6E" }}
            >
              Full chart →
            </Link>
          </div>
        )}

        {/* 국가별 1위 */}
        {countryTopArtists.length > 0 && (
          <div className="lg:col-span-1 bg-[#141418] border border-border/30 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Country No. 1
            </p>
            <div className="space-y-2.5">
              {countryTopArtists.map(c => (
                <div key={c.country_code} className="flex items-center gap-2.5">
                  <span className="text-base leading-none w-5 text-center shrink-0">
                    {COUNTRY_FLAGS[c.country_code] ?? "🌐"}
                  </span>
                  <span className="text-xs text-muted-foreground/60 w-6 shrink-0">
                    {c.country_code}
                  </span>
                  <span className="text-sm font-medium text-foreground flex-1 truncate">
                    {c.artist_name}
                  </span>
                  <span className="text-xs text-muted-foreground/50 shrink-0 tabular-nums">
                    {fmtListeners(c.listeners)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 인기 드라마 */}
        {topDramas.length > 0 && (
          <div className="lg:col-span-1 bg-[#141418] border border-border/30 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Top K-Dramas
            </p>
            <div className="space-y-3">
              {topDramas.map((d, i) => (
                <Link
                  key={d.id}
                  href="/drama"
                  className="flex items-center gap-3 group"
                >
                  <span className="text-xs text-muted-foreground/40 w-4 shrink-0 tabular-nums">
                    {i + 1}
                  </span>
                  {d.poster_url ? (
                    <div className="w-8 h-12 rounded overflow-hidden shrink-0 bg-[#1e1e24]">
                      <Image
                        src={d.poster_url}
                        alt={d.title}
                        width={32}
                        height={48}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-12 rounded bg-[#1e1e24] shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate group-hover:opacity-80 transition-opacity leading-tight">
                      {d.title}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{d.year}</p>
                  </div>
                </Link>
              ))}
            </div>
            <Link
              href="/drama"
              className="mt-4 block text-xs font-medium transition-opacity hover:opacity-80 text-right"
              style={{ color: "#FF4B6E" }}
            >
              All dramas →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
