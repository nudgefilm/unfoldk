"use client"

// KpopStats Artist Comparison — 팬덤 심층 분석
// - 로그인 유저 전체 접근, 비로그인 → 로그인 유도
// - 아티스트 직접 선택 드롭다운 (listeners 기준 정렬)
// - 팬덤 충성도 지수 / 30일 성장 모멘텀 / 아티스트 프로필 / Claude 인사이트

import { useEffect, useState } from "react"
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts"
import Link from "next/link"

interface ArtistOption {
  id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  latest_listeners: number | null
}

interface ArtistCompareStats {
  id: string
  name: string
  thumbnail_url: string | null
  listeners: number | null
  plays: number | null
  loyalty: number | null
  growth30d: number | null
  history: Array<{ date: string; listeners: number | null }>
  debut_year: number | null
  mb_member_count: number | null
  lastfm_tags: string[] | null
}

function fmtM(n: number | null): string {
  if (!n || n <= 0) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function loyaltyLabel(loyalty: number | null): string {
  if (!loyalty) return ""
  if (loyalty >= 200) return "highly dedicated fanbase"
  if (loyalty >= 100) return "strong core fanbase"
  return "broad but casual reach"
}

// ─── 아티스트 선택 드롭다운 ──────────────────────────────────

function ArtistDropdown({
  value, options, excludeId, onChange, label,
}: {
  value: ArtistOption | null
  options: ArtistOption[]
  excludeId: string | null
  onChange: (a: ArtistOption) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const filtered = options
    .filter((o) => o.id !== excludeId)
    .filter((o) =>
      query === "" ||
      o.name.toLowerCase().includes(query.toLowerCase()) ||
      (o.name_ko ?? "").includes(query)
    )
    .slice(0, 30)

  return (
    <div className="relative">
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 bg-[#252525] border border-border/30 rounded-xl px-3 py-2.5 text-sm text-foreground hover:border-border/60 transition-colors text-left"
      >
        {value?.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.thumbnail_url} alt={value.name} className="w-6 h-6 rounded-full object-cover bg-[#333] flex-shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-[#333] flex-shrink-0" />
        )}
        <span className="flex-1 truncate">{value?.name ?? "Select artist…"}</span>
        <span className="text-muted-foreground">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-[#1a1a1a] border border-border/40 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border/20">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-[#252525] rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No results</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { onChange(o); setOpen(false); setQuery("") }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-[#252525] transition-colors text-left"
                >
                  {o.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.thumbnail_url} alt={o.name} className="w-6 h-6 rounded-full object-cover bg-[#333] flex-shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#333] flex-shrink-0" />
                  )}
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.latest_listeners && (
                    <span className="text-xs text-muted-foreground">{fmtM(o.latest_listeners)}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 30일 모멘텀 차트 ─────────────────────────────────────────

function MomentumChart({ artistA, artistB }: { artistA: ArtistCompareStats; artistB: ArtistCompareStats }) {
  const dateSet = new Set([
    ...artistA.history.map((h) => h.date),
    ...artistB.history.map((h) => h.date),
  ])
  const mapA = new Map(artistA.history.map((h) => [h.date, h.listeners]))
  const mapB = new Map(artistB.history.map((h) => [h.date, h.listeners]))

  const chartData = Array.from(dateSet)
    .sort()
    .map((date, i) => ({
      idx: i,
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      a: mapA.get(date) ?? null,
      b: mapB.get(date) ?? null,
    }))
    .filter((_, i, arr) => i === 0 || i === arr.length - 1 || i % 5 === 0)

  if (chartData.length < 2) return null

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#9ca3af" }}
          formatter={(val: unknown, name: string) => [
            fmtM(typeof val === "number" ? val : null),
            name === "a" ? artistA.name : artistB.name,
          ]}
        />
        <Line type="monotone" dataKey="a" stroke="#FF4B6E" strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="b" stroke="#ffffff" strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── 아티스트 프로필 카드 (단일 아티스트) ─────────────────────

function ArtistProfileCard({ artist, label }: { artist: ArtistCompareStats; label: string }) {
  const currentYear = new Date().getFullYear()
  const activeYears = artist.debut_year ? currentYear - artist.debut_year : null
  const tags = (artist.lastfm_tags ?? []).filter((t) => t !== "k-pop" && t !== "k pop").slice(0, 3)

  return (
    <div className="flex flex-col gap-3">
      {/* 아티스트 헤더 */}
      <div className="flex items-center gap-2 mb-1">
        {artist.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.thumbnail_url} alt={artist.name} className="w-8 h-8 rounded-full object-cover bg-[#333] flex-shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#333] flex-shrink-0" />
        )}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold text-foreground">{artist.name}</p>
        </div>
      </div>

      {/* 데뷔년도 */}
      {artist.debut_year && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Debut</span>
          <span className="text-foreground">{artist.debut_year}</span>
        </div>
      )}

      {/* 활동 기간 */}
      {activeYears != null && activeYears >= 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Active</span>
          <span className="text-foreground">{activeYears} year{activeYears !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* 멤버 구성 */}
      {artist.mb_member_count != null && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Group</span>
          <span className="text-foreground">
            {artist.mb_member_count === 1 ? "Solo artist" : `${artist.mb_member_count}-member group`}
          </span>
        </div>
      )}

      {/* 장르 태그 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full bg-[#252525] text-muted-foreground text-xs capitalize">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────

export function ArtistComparisonSection({
  isLoggedIn,
  authChecked,
}: {
  isLoggedIn: boolean
  authChecked: boolean
}) {
  const [artists, setArtists] = useState<ArtistOption[]>([])
  const [artistA, setArtistA] = useState<ArtistOption | null>(null)
  const [artistB, setArtistB] = useState<ArtistOption | null>(null)
  const [data, setData] = useState<{
    artistA: ArtistCompareStats
    artistB: ArtistCompareStats
  } | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [insight, setInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)

  // 아티스트 목록 로드 (listeners 기준 정렬)
  useEffect(() => {
    if (!authChecked || !isLoggedIn) return
    fetch("/api/kpop/artists?sort=listeners&pageSize=50")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: ArtistOption[] }) => {
        const list = d.items ?? []
        setArtists(list)
        if (list.length >= 2) {
          setArtistA(list[0])
          setArtistB(list[1])
        }
      })
      .catch(() => {})
  }, [authChecked, isLoggedIn])

  // 비교 데이터 로드
  useEffect(() => {
    if (!artistA || !artistB) return
    setData(null)
    setInsight(null)
    setDataLoading(true)
    fetch(`/api/kpop/comparison-data?a=${artistA.id}&b=${artistB.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setDataLoading(false))
  }, [artistA?.id, artistB?.id])

  // 인사이트 생성 (비교 데이터 로드 완료 후)
  useEffect(() => {
    if (!data || !artistA || !artistB) return
    setInsightLoading(true)
    fetch("/api/kpop/comparison-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artist_a_id: artistA.id,
        artist_b_id: artistB.id,
        artistA: {
          name: data.artistA.name,
          listeners: data.artistA.listeners,
          plays: data.artistA.plays,
          growth30d: data.artistA.growth30d,
        },
        artistB: {
          name: data.artistB.name,
          listeners: data.artistB.listeners,
          plays: data.artistB.plays,
          growth30d: data.artistB.growth30d,
        },
        topCountriesA: [],
        topCountriesB: [],
      }),
    })
      .then((r) => (r.ok ? r.json() : { insight: null }))
      .then((d: { insight?: string | null }) => setInsight(d.insight ?? null))
      .catch(() => {})
      .finally(() => setInsightLoading(false))
  }, [data])

  // 비로그인 상태 (auth 확인 완료 후)
  if (authChecked && !isLoggedIn) {
    return (
      <section className="mb-16">
        <h2 className="text-2xl font-semibold text-white mb-6">Artist Comparison</h2>
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-8 text-center">
          <p className="text-foreground font-medium mb-2">Sign in to compare artists</p>
          <p className="text-muted-foreground text-sm mb-5">
            Compare fan loyalty, growth momentum, and global reach for any two K-pop artists.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            Sign in to UnfoldK
          </Link>
        </div>
      </section>
    )
  }

  if (!authChecked) return null

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-semibold text-white mb-6">Artist Comparison</h2>

      {/* 아티스트 선택 드롭다운 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <ArtistDropdown value={artistA} options={artists} excludeId={artistB?.id ?? null} onChange={setArtistA} label="Artist A" />
        <ArtistDropdown value={artistB} options={artists} excludeId={artistA?.id ?? null} onChange={setArtistB} label="Artist B" />
      </div>

      {dataLoading && (
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-8 text-center text-muted-foreground text-sm animate-pulse">
          Loading comparison…
        </div>
      )}

      {!dataLoading && data && (
        <div className="flex flex-col gap-5">

          {/* 아티스트 프로필 비교 */}
          {(data.artistA.debut_year != null ||
            data.artistA.mb_member_count != null ||
            (data.artistA.lastfm_tags ?? []).length > 0 ||
            data.artistB.debut_year != null ||
            data.artistB.mb_member_count != null ||
            (data.artistB.lastfm_tags ?? []).length > 0) && (
            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Artist Profile</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 divide-y sm:divide-y-0 sm:divide-x divide-border/20">
                <ArtistProfileCard artist={data.artistA} label="Artist A" />
                <div className="pt-4 sm:pt-0 sm:pl-5">
                  <ArtistProfileCard artist={data.artistB} label="Artist B" />
                </div>
              </div>
            </div>
          )}

          {/* 팬덤 충성도 지수 */}
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Fan Loyalty Index</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[data.artistA, data.artistB].map((a) => (
                <div key={a.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 mb-1">
                    {a.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.thumbnail_url} alt={a.name} className="w-7 h-7 rounded-full object-cover bg-[#333]" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#333]" />
                    )}
                    <span className="text-sm font-medium text-foreground">{a.name}</span>
                  </div>
                  {a.loyalty != null ? (
                    <>
                      <p className="text-2xl font-bold text-white">{a.loyalty.toLocaleString()}x</p>
                      <p className="text-xs text-muted-foreground">
                        plays per listener — <span className="text-foreground">{loyaltyLabel(a.loyalty)}</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">No data</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 30일 성장 모멘텀 */}
          {(data.artistA.history.length > 0 || data.artistB.history.length > 0) && (
            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-foreground">30-Day Listener Growth</h3>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: "#FF4B6E" }} />
                    {data.artistA.name}
                    {data.artistA.growth30d != null && (
                      <span className={data.artistA.growth30d >= 0 ? "text-green-400" : "text-red-400"}>
                        {" "}({data.artistA.growth30d > 0 ? "+" : ""}{data.artistA.growth30d}%)
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 rounded bg-white inline-block" />
                    {data.artistB.name}
                    {data.artistB.growth30d != null && (
                      <span className={data.artistB.growth30d >= 0 ? "text-green-400" : "text-red-400"}>
                        {" "}({data.artistB.growth30d > 0 ? "+" : ""}{data.artistB.growth30d}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <MomentumChart artistA={data.artistA} artistB={data.artistB} />
            </div>
          )}

          {/* UnfoldK 인사이트 */}
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">UnfoldK Insight</h3>
            {insightLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-3.5 bg-[#252525] rounded w-full" />
                <div className="h-3.5 bg-[#252525] rounded w-5/6" />
                <div className="h-3.5 bg-[#252525] rounded w-4/6" />
              </div>
            ) : insight ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Insight unavailable.</p>
            )}
          </div>

        </div>
      )}
    </section>
  )
}
