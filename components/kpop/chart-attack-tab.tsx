"use client"

// Chart Attack 탭 — "행동하는" 팬덤 화력 대시보드
// 섹션: ① Alert Zone | ② Velocity Tracker | ③ Fan Power Ranking
//        ④ Share to Attack | ⑤ Next Chart Update

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Flame, Zap, Share2, Trophy, Timer, Lock } from "lucide-react"
import Link from "next/link"

// ─── 숫자 포맷 ─────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—"
  const a = Math.abs(n)
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B"
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  if (a >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K"
  return n.toLocaleString()
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

// ─── 타입 ─────────────────────────────────────────────────
interface LastfmChartItem {
  rank: number
  artist_id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  lastfm_listeners: number | null
  listener_change: number | null
  listener_change_pct: number | null
  rank_change: number | null
  data_date: string
}

interface VelocityItem {
  artist_id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  hourly_velocity: number
  daily_delta: number
  gauge_pct: number
}

interface VoteRanking {
  rank: number
  artist_id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  vote_count: number
}

// ─── 게이지 컬러 — 속도 높을수록 레드 ─────────────────────
function velocityGradient(gaugePct: number): string {
  if (gaugePct >= 70) return "linear-gradient(90deg, #FF4B6E, #ff2200)"
  if (gaugePct >= 40) return "linear-gradient(90deg, #f59e0b, #ff8c00)"
  return "linear-gradient(90deg, #22c55e, #16a34a)"
}

// ─── 카운트다운 훅 — 매일 07:00 UTC (Last.fm 인제스트 cron) ─
function useCountdown() {
  const [time, setTime] = useState({ h: 0, m: 0, s: 0 })

  useEffect(() => {
    function calc() {
      const now = new Date()
      const target = new Date()
      target.setUTCHours(7, 0, 0, 0)
      if (now >= target) target.setUTCDate(target.getUTCDate() + 1)
      const diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000))
      setTime({ h: Math.floor(diff / 3600), m: Math.floor((diff % 3600) / 60), s: diff % 60 })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [])

  return time
}

// ─── 애니메이션 카운터 ─────────────────────────────────────
function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / 1000, 1)
      setDisplay(Math.round(value * p))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value])
  return <span>{fmt(display)}</span>
}

// ─── 썸네일 헬퍼 ───────────────────────────────────────────
function Avatar({ src, alt, size = 10 }: { src: string | null; alt: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full object-cover flex-shrink-0 bg-[#252525]`
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt={alt} className={cls} loading="lazy" referrerPolicy="no-referrer" />
    : <div className={`w-${size} h-${size} rounded-full bg-[#252525] flex-shrink-0`} />
}

// ─── 프리셋 트윗 문구 ──────────────────────────────────────
function presetTweet(name: string, rank: number): string {
  return `🚨 STREAMING EMERGENCY! ${name} is #${rank} globally — let's push them higher RIGHT NOW! Stream stream stream! #${name.replace(/\s/g, "")} #KpopAttack #UnfoldK`
}

// ─── Props ─────────────────────────────────────────────────
interface Props {
  isLoggedIn: boolean
  isPro: boolean
}

export function ChartAttackTab({ isLoggedIn, isPro }: Props) {
  const [chart, setChart] = useState<LastfmChartItem[]>([])
  const [chartLoading, setChartLoading] = useState(true)
  const [velocity, setVelocity] = useState<VelocityItem[]>([])
  const [velocityLoading, setVelocityLoading] = useState(true)
  const [rankings, setRankings] = useState<VoteRanking[]>([])
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [voteAnimate, setVoteAnimate] = useState<string | null>(null)
  const [shareTarget, setShareTarget] = useState<VelocityItem | null>(null)
  const [aiTweetText, setAiTweetText] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)

  const countdown = useCountdown()

  // 데이터 로드
  useEffect(() => {
    fetch("/api/kpop/chart-attack/lastfm-chart")
      .then(r => r.ok ? r.json() : { items: [] })
      .then((d: { items?: LastfmChartItem[] }) => setChart(d.items ?? []))
      .catch(() => setChart([]))
      .finally(() => setChartLoading(false))
  }, [])

  useEffect(() => {
    fetch("/api/kpop/chart-attack/velocity")
      .then(r => r.ok ? r.json() : { items: [] })
      .then((d: { items?: VelocityItem[] }) => setVelocity(d.items ?? []))
      .catch(() => setVelocity([]))
      .finally(() => setVelocityLoading(false))
  }, [])

  const loadRankings = useCallback(() => {
    fetch("/api/kpop/chart-attack/votes")
      .then(r => r.ok ? r.json() : { rankings: [] })
      .then((d: { rankings?: VoteRanking[] }) => setRankings(d.rankings ?? []))
      .catch(() => setRankings([]))
  }, [])

  useEffect(() => { loadRankings() }, [loadRankings])

  // ─── Alert Zone 계산 ─────────────────────────────────────
  const top10Listeners = chart[9]?.lastfm_listeners ?? 0
  type AlertArtist = LastfmChartItem & { alertType: "almost" | "danger"; gapToTop10: number }
  const alertArtists: AlertArtist[] = chart
    .filter(item => {
      const isAlmost = item.rank >= 11 && item.rank <= 12
      const isDanger = item.rank >= 18 && item.rank <= 20 && (item.listener_change_pct ?? 0) < -2
      return isAlmost || isDanger
    })
    .map(item => ({
      ...item,
      alertType: (item.rank <= 12 ? "almost" : "danger") as "almost" | "danger",
      gapToTop10: Math.max(0, top10Listeners - (item.lastfm_listeners ?? 0)),
    }))

  // ─── AI Share ────────────────────────────────────────────
  async function generateAiShare(item: VelocityItem) {
    setShareTarget(item)
    setAiTweetText(null)
    setShareLoading(true)
    const chartEntry = chart.find(c => c.artist_id === item.artist_id)
    try {
      const res = await fetch("/api/kpop/chart-attack/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist_name: item.name,
          current_rank: chartEntry?.rank ?? 1,
          rank_change: chartEntry?.rank_change ?? null,
          listener_change_pct: chartEntry?.listener_change_pct ?? null,
        }),
      })
      const d = await res.json() as { tweet_text?: string }
      setAiTweetText(d.tweet_text ?? presetTweet(item.name, chartEntry?.rank ?? 1))
    } catch {
      setAiTweetText(presetTweet(item.name, chartEntry?.rank ?? 1))
    } finally {
      setShareLoading(false)
    }
  }

  // ─── 투표 ────────────────────────────────────────────────
  async function handleVote(artistId: string) {
    if (!isLoggedIn) return
    setVoteAnimate(artistId)
    setTimeout(() => setVoteAnimate(null), 600)
    setVotedIds(prev => new Set(prev).add(artistId))
    try {
      await fetch("/api/kpop/chart-attack/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist_id: artistId }),
      })
      loadRankings()
    } catch { /* PopCat style — no rollback */ }
  }

  return (
    <div className="space-y-10">

      {/* ─── ① 🚨 Alert Zone ────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <div>
            <h2 className="text-2xl font-semibold text-white">Alert Zone</h2>
            <p className="text-muted-foreground text-sm">Critical chart movements this week</p>
          </div>
        </div>

        {chartLoading ? (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-8 text-center text-muted-foreground text-sm">
            Scanning chart...
          </div>
        ) : alertArtists.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-green-500/20 rounded-2xl px-6 py-6 flex items-center gap-3">
            <span className="text-2xl">🟢</span>
            <div>
              <p className="text-foreground font-medium">All clear this week</p>
              <p className="text-muted-foreground text-sm">No artists in critical positions right now.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {alertArtists.map(item => (
              <div
                key={item.artist_id}
                className={`rounded-2xl p-4 flex items-center gap-4 ${
                  item.alertType === "almost"
                    ? "bg-yellow-500/10 border border-yellow-500/30"
                    : "bg-red-500/10 border border-red-500/40"
                }`}
              >
                <Avatar src={item.thumbnail_url} alt={item.name} size={12} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/kpop/${item.artist_id}`} className="text-foreground font-semibold hover:text-primary transition-colors">
                      {item.name}
                    </Link>
                    <span className="text-muted-foreground text-xs">#{item.rank}</span>
                  </div>
                  {item.alertType === "almost" ? (
                    <p className="text-yellow-400 text-sm font-medium mt-0.5">
                      🟡 ALMOST THERE! {fmt(item.gapToTop10)} listeners away from TOP 10
                    </p>
                  ) : (
                    <p className="text-red-400 text-sm font-bold mt-0.5 animate-pulse">
                      🔴 DANGER ZONE! Stream now before they drop out!
                    </p>
                  )}
                </div>
                {/* 빠른 트윗 버튼 */}
                <button
                  onClick={() => {
                    const text = item.alertType === "almost"
                      ? `🚨 ${item.name} is SO CLOSE to TOP 10 (currently #${item.rank})! Stream NOW to push them over! #${item.name.replace(/\s/g, "")} #KpopAttack #UnfoldK`
                      : `🔴 EMERGENCY: ${item.name} is in the DANGER ZONE at #${item.rank}! We need streams ASAP! #${item.name.replace(/\s/g, "")} #KpopAttack #UnfoldK`
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank")
                  }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold text-white transition-colors"
                  style={{ backgroundColor: item.alertType === "almost" ? "#d97706" : "#ef4444" }}
                >
                  Tweet 🐦
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── ② ⚡ Velocity Tracker ────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-6 h-6 text-yellow-400" />
          <div>
            <h2 className="text-2xl font-semibold text-white">Velocity Tracker</h2>
            <p className="text-muted-foreground text-sm">Hourly streaming acceleration — who's surging right now</p>
          </div>
        </div>

        {velocityLoading ? (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-8 text-center text-muted-foreground text-sm">
            Calculating velocity...
          </div>
        ) : velocity.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-8 text-center text-muted-foreground text-sm">
            Need 2+ days of data. Check back tomorrow.
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden divide-y divide-border/20">
            {velocity.map((item, i) => {
              const isTop3 = i < 3
              return (
                <div key={item.artist_id} className="px-5 py-3.5 hover:bg-[#232325] transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-5 flex-shrink-0 text-center">
                      {isTop3
                        ? <span className="text-base leading-none">🔥</span>
                        : <span className="text-muted-foreground text-xs">#{i + 1}</span>
                      }
                    </span>
                    <Avatar src={item.thumbnail_url} alt={item.name} size={8} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <Link href={`/kpop/${item.artist_id}`} className="text-foreground font-medium hover:text-primary transition-colors truncate">
                          {item.name}
                        </Link>
                        <span className={`font-bold text-sm flex-shrink-0 ml-2 ${isTop3 ? "text-primary" : "text-yellow-400"}`}>
                          +<AnimatedCount value={item.hourly_velocity} />/hr
                        </span>
                      </div>
                      {item.name_ko && <p className="text-muted-foreground text-xs">{item.name_ko}</p>}
                    </div>
                  </div>
                  {/* 속도 게이지 — 색상: green → yellow → red */}
                  <div className="ml-8 h-1.5 bg-[#2a2a2c] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${item.gauge_pct}%`, background: velocityGradient(item.gauge_pct) }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ─── ③ 🔥 Fan Power Ranking ──────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Flame className="w-6 h-6" style={{ color: "#FF4B6E" }} />
          <div>
            <h2 className="text-2xl font-semibold text-white">Fan Power Ranking</h2>
            <p className="text-muted-foreground text-sm">Vote for your artist — every 🔥 counts</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 투표 버튼 패널 */}
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border/20">
              <p className="text-sm font-medium text-foreground">Vote now</p>
            </div>
            {!isLoggedIn ? (
              <div className="p-6 text-center">
                <p className="text-muted-foreground text-sm mb-4">Sign up to join the fan power battle</p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-colors"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  🔥 Join the Battle
                </Link>
              </div>
            ) : velocity.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Loading artists...</div>
            ) : (
              <div className="p-4 grid grid-cols-2 gap-2">
                {velocity.slice(0, 8).map(item => {
                  const isVoted = votedIds.has(item.artist_id)
                  const isAnimating = voteAnimate === item.artist_id
                  return (
                    <button
                      key={item.artist_id}
                      onClick={() => handleVote(item.artist_id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                        isVoted
                          ? "border-primary/60 bg-primary/10"
                          : "border-border/30 bg-[#141416] hover:border-primary/30 hover:bg-[#1e1e20]"
                      } ${isAnimating ? "scale-95" : "scale-100"}`}
                    >
                      <Avatar src={item.thumbnail_url} alt={item.name} size={10} />
                      <span className="text-foreground text-xs font-medium truncate w-full text-center">{item.name}</span>
                      <span className={`text-xl leading-none ${isAnimating ? "animate-bounce" : ""}`}>🔥</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 랭킹 TOP 5 */}
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border/20 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-foreground">Power Ranking TOP 5</span>
            </div>
            {rankings.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No votes yet — be the first to power up!
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {rankings.map((r, i) => (
                  <div key={r.artist_id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="w-5 flex-shrink-0 text-center">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-muted-foreground text-xs">#{r.rank}</span>}
                    </span>
                    <Avatar src={r.thumbnail_url} alt={r.name} size={9} />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground text-sm font-medium truncate">{r.name}</p>
                      {r.name_ko && <p className="text-muted-foreground text-xs">{r.name_ko}</p>}
                    </div>
                    <span className="text-primary font-bold">{fmt(r.vote_count)} 🔥</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── ④ 📢 Share to Attack ────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Share2 className="w-6 h-6 text-[#1d9bf0]" />
          <div>
            <h2 className="text-2xl font-semibold text-white">Share to Attack</h2>
            <p className="text-muted-foreground text-sm">
              {isPro ? "UnfoldK generates a custom viral tweet for your artist" : "Tweet now to boost your artist — upgrade for AI-crafted messages"}
            </p>
          </div>
        </div>

        {velocity.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-8 text-center text-muted-foreground text-sm">
            Loading artists...
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-[#1d9bf0]/20 rounded-2xl overflow-hidden">
            {/* 헤더 배너 */}
            <div className="px-5 py-3 border-b border-border/20 flex items-center gap-2 bg-[#1d9bf0]/5">
              <span className="text-sm font-bold text-[#1d9bf0]">🚨 STREAMING EMERGENCY — Pick an artist and attack!</span>
              {!isPro && (
                <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="w-3 h-3" /> AI tweets with Hallyu Pass
                </span>
              )}
            </div>

            {/* 아티스트 목록 */}
            <div className="divide-y divide-border/20">
              {velocity.slice(0, 5).map(item => {
                const chartEntry = chart.find(c => c.artist_id === item.artist_id)
                const rank = chartEntry?.rank ?? null
                const isSelected = shareTarget?.artist_id === item.artist_id

                return (
                  <div key={item.artist_id} className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={item.thumbnail_url} alt={item.name} size={10} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium">{item.name}</span>
                          {rank && <span className="text-muted-foreground text-xs">#{rank} globally</span>}
                        </div>
                        <p className="text-yellow-400 text-xs">⚡ +{fmt(item.hourly_velocity)}/hr</p>
                      </div>
                      <button
                        onClick={() => {
                          if (isPro) {
                            generateAiShare(item)
                          } else {
                            const text = presetTweet(item.name, rank ?? 1)
                            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank")
                          }
                        }}
                        className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors"
                        style={{ backgroundColor: "#1d9bf0", color: "white" }}
                      >
                        {isPro ? "✨ AI Tweet" : "🐦 Tweet"}
                      </button>
                    </div>

                    {/* Pro AI 생성 결과 */}
                    {isPro && isSelected && (
                      <div className="mt-3 ml-13">
                        {shareLoading ? (
                          <p className="text-muted-foreground text-sm animate-pulse">Crafting the perfect attack message...</p>
                        ) : aiTweetText ? (
                          <div className="bg-[#141416] border border-[#1d9bf0]/30 rounded-xl p-4">
                            <p className="text-foreground text-sm leading-relaxed mb-3">{aiTweetText}</p>
                            <a
                              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(aiTweetText)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1d9bf0] text-white text-sm font-medium hover:bg-[#1a8cd8] transition-colors"
                            >
                              <Share2 className="w-3.5 h-3.5" /> Post on X
                            </a>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* ─── ⑤ ⏱ Next Chart Update ──────────────────────── */}
      <section>
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-5 flex items-center gap-5">
          <Timer className="w-8 h-8 text-muted-foreground flex-shrink-0" />
          <div className="flex-1">
            <p className="text-muted-foreground text-sm mb-1">Next chart update in</p>
            <p className="text-foreground text-3xl font-mono font-bold tracking-widest">
              {pad(countdown.h)}
              <span className="text-muted-foreground text-xl mx-1">:</span>
              {pad(countdown.m)}
              <span className="text-muted-foreground text-xl mx-1">:</span>
              <span style={{ color: countdown.h === 0 && countdown.m < 30 ? "#FF4B6E" : undefined }}>
                {pad(countdown.s)}
              </span>
            </p>
          </div>
          <div className="text-right flex-shrink-0 hidden sm:block">
            <p className="text-muted-foreground text-xs">Daily at 07:00 UTC</p>
            <p className="text-muted-foreground text-xs">Based on Last.fm global streaming data</p>
          </div>
        </div>
      </section>

    </div>
  )
}
