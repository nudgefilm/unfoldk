"use client"

// Chart Attack 탭 — KpopStats 팬덤 화력 대시보드
// 데이터: kpop_stats_daily (Last.fm 청취자 기반) — 신규 API 수집 없음
// 섹션: ① Last.fm 글로벌 K-pop 차트 | ② Velocity Tracker | ③ Rival Chase
//        ④ AI Milestone (Pro) | ⑤ Share to Attack | ⑥ 화력 투표

import { useCallback, useEffect, useState } from "react"
import { TrendingUp, TrendingDown, Flame, Zap, Lock, Share2, Trophy, Music } from "lucide-react"
import { Button } from "@/components/ui/button"
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

// ─── 타입 ─────────────────────────────────────────────────
interface LastfmChartItem {
  rank: number
  artist_id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  lastfm_listeners: number | null
  lastfm_playcount: number | null
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

// ─── 순위 변동 배지 ────────────────────────────────────────
function RankBadge({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs font-semibold bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">NEW</span>
  if (change > 0) return <span className="text-green-400 text-xs font-medium">▲{change}</span>
  if (change < 0) return <span className="text-red-400 text-xs font-medium">▼{Math.abs(change)}</span>
  return <span className="text-muted-foreground text-xs">—</span>
}

// ─── 청취자 트렌드 배지 ────────────────────────────────────
function ListenerTrend({ pct }: { pct: number | null }) {
  if (pct === null) return null
  if (pct >= 5) return <span className="text-xs text-green-400">+{pct}% ↑</span>
  if (pct > 0) return <span className="text-xs text-green-400/70">+{pct}%</span>
  if (pct <= -5) return <span className="text-xs text-red-400">{pct}% ↓</span>
  if (pct < 0) return <span className="text-xs text-red-400/70">{pct}%</span>
  return null
}

// ─── 위기/기회 배너 ────────────────────────────────────────
function UrgencyBanner({ rank, listenerChangePct }: { rank: number; listenerChangePct: number | null }) {
  if (rank >= 11 && rank <= 13) {
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">
        🟡 TOP 10 턱밑
      </span>
    )
  }
  if (rank >= 18 && rank <= 20 && listenerChangePct !== null && listenerChangePct < -3) {
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
        🔴 차트 아웃 위기
      </span>
    )
  }
  return null
}

// ─── 애니메이션 카운터 ─────────────────────────────────────
function AnimatedCount({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start: number | null = null
    const to = value
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setDisplay(Math.round(to * progress))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, duration])
  return <span>{fmt(display)}</span>
}

// ─── 프리셋 트윗 문구 ──────────────────────────────────────
function presetTweet(name: string, rank: number, changePct: number | null): string {
  const trend = changePct !== null && changePct > 0 ? ` (+${changePct}% listeners this week!)` : ""
  return `🔥 ${name} is #${rank} on the K-pop global listener chart${trend} Let's STREAM and hit TOP 10! #${name.replace(/\s/g, "")} #KpopAttack #UnfoldK`
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────
interface Props {
  isLoggedIn: boolean
  isPro: boolean
}

export function ChartAttackTab({ isLoggedIn, isPro }: Props) {
  // ① Last.fm 차트
  const [chart, setChart] = useState<LastfmChartItem[]>([])
  const [chartLoading, setChartLoading] = useState(true)

  // ② Velocity
  const [velocity, setVelocity] = useState<VelocityItem[]>([])
  const [velocityLoading, setVelocityLoading] = useState(true)

  // ④ AI Milestone
  const [selectedArtist, setSelectedArtist] = useState<LastfmChartItem | null>(null)
  const [milestoneText, setMilestoneText] = useState<string | null>(null)
  const [milestoneLoading, setMilestoneLoading] = useState(false)

  // ⑤ Share
  const [shareArtist, setShareArtist] = useState<LastfmChartItem | null>(null)
  const [aiTweetText, setAiTweetText] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)

  // ⑥ Votes
  const [rankings, setRankings] = useState<VoteRanking[]>([])
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [voteAnimate, setVoteAnimate] = useState<string | null>(null)

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

  const loadVoteRankings = useCallback(() => {
    fetch("/api/kpop/chart-attack/votes")
      .then(r => r.ok ? r.json() : { rankings: [] })
      .then((d: { rankings?: VoteRanking[] }) => setRankings(d.rankings ?? []))
      .catch(() => setRankings([]))
  }, [])

  useEffect(() => { loadVoteRankings() }, [loadVoteRankings])

  // ④ AI Milestone 호출
  async function generateMilestone(item: LastfmChartItem) {
    if (!isPro) return
    setSelectedArtist(item)
    setMilestoneText(null)
    setMilestoneLoading(true)
    const first = chart[0]
    const gapFromFirst = first && item.lastfm_listeners !== null && first.lastfm_listeners !== null
      ? first.lastfm_listeners - item.lastfm_listeners
      : 0
    try {
      const res = await fetch("/api/kpop/chart-attack/milestone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist_name: item.name,
          current_rank: item.rank,
          rank_change: item.rank_change,
          listeners: item.lastfm_listeners ?? 0,
          listener_change_pct: item.listener_change_pct,
          gap_from_first: gapFromFirst,
        }),
      })
      const d = await res.json() as { insight?: string }
      setMilestoneText(d.insight ?? "Unable to generate prediction.")
    } catch {
      setMilestoneText("Error generating prediction.")
    } finally {
      setMilestoneLoading(false)
    }
  }

  // ⑤ AI Share 생성
  async function generateAiShare(item: LastfmChartItem) {
    setShareArtist(item)
    setAiTweetText(null)
    setShareLoading(true)
    try {
      const res = await fetch("/api/kpop/chart-attack/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist_name: item.name,
          current_rank: item.rank,
          rank_change: item.rank_change,
          listener_change_pct: item.listener_change_pct,
        }),
      })
      const d = await res.json() as { tweet_text?: string }
      setAiTweetText(d.tweet_text ?? presetTweet(item.name, item.rank, item.listener_change_pct))
    } catch {
      setAiTweetText(presetTweet(item.name, item.rank, item.listener_change_pct))
    } finally {
      setShareLoading(false)
    }
  }

  // ⑥ 투표
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
      loadVoteRankings()
    } catch { /* PopCat 컨셉 — 실패 시 UI 롤백 없음 */ }
  }

  // Rival Chase 데이터 — lastfm_listeners 기준 1위와의 격차
  const top1Listeners = chart[0]?.lastfm_listeners ?? 0
  const rivalData = chart.map(item => ({
    ...item,
    gap: top1Listeners > 0 && item.lastfm_listeners !== null
      ? top1Listeners - item.lastfm_listeners
      : 0,
  }))
  const maxGap = rivalData[rivalData.length - 1]?.gap ?? 1

  return (
    <div className="space-y-12">

      {/* ─── ① Last.fm 글로벌 K-pop 차트 ──────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Music className="w-6 h-6" style={{ color: "#FF4B6E" }} />
          <div>
            <h2 className="text-2xl font-semibold text-white">Global K-pop Chart</h2>
            <p className="text-muted-foreground text-sm">Ranked by monthly listeners · updated daily</p>
            <p className="text-muted-foreground/60 text-xs mt-0.5">Based on Last.fm global streaming data</p>
          </div>
        </div>

        {chartLoading ? (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
            Loading chart...
          </div>
        ) : chart.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center">
            <p className="text-foreground font-medium mb-1">No chart data yet</p>
            <p className="text-muted-foreground text-sm">Stats are collected daily — check back tomorrow.</p>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden">
            {chart.map((item) => (
              <div
                key={item.rank}
                className="flex items-center gap-3 px-5 py-3.5 border-b border-border/20 last:border-b-0 hover:bg-[#232325] transition-colors"
              >
                {/* 순위 */}
                <div className="w-8 flex-shrink-0 text-center">
                  <span className={`text-sm font-bold ${item.rank <= 3 ? "text-primary" : "text-muted-foreground"}`}>
                    #{item.rank}
                  </span>
                </div>

                {/* 썸네일 */}
                {item.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnail_url} alt={item.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-[#252525]" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#252525] flex-shrink-0" />
                )}

                {/* 아티스트 정보 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/kpop/${item.artist_id}`} className="text-foreground font-medium hover:text-primary transition-colors truncate">
                      {item.name}
                    </Link>
                    {item.name_ko && <span className="text-muted-foreground text-xs hidden sm:inline">{item.name_ko}</span>}
                    <UrgencyBanner rank={item.rank} listenerChangePct={item.listener_change_pct} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-foreground text-xs">{fmt(item.lastfm_listeners)} listeners</span>
                    <ListenerTrend pct={item.listener_change_pct} />
                  </div>
                </div>

                {/* 순위 변동 */}
                <div className="flex-shrink-0 w-10 text-center">
                  <RankBadge change={item.rank_change} />
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isPro && (
                    <button
                      onClick={() => generateMilestone(item)}
                      className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      title="AI Chart Prediction"
                    >
                      Predict
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (isPro) {
                        generateAiShare(item)
                      } else {
                        const text = presetTweet(item.name, item.rank, item.listener_change_pct)
                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank")
                      }
                    }}
                    className="p-1.5 rounded-lg bg-[#1d9bf0]/10 text-[#1d9bf0] hover:bg-[#1d9bf0]/20 transition-colors"
                    title="Share on X"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── ④ AI Predictive Milestone (Pro 전용) ──────────── */}
      {isPro && selectedArtist && (
        <section>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            UnfoldK Chart Prediction
          </h2>
          {milestoneLoading ? (
            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 text-center text-muted-foreground text-sm">
              Analyzing {selectedArtist.name}&apos;s listener trajectory...
            </div>
          ) : milestoneText ? (
            <div className="bg-[#1a1a1a] border border-yellow-500/30 rounded-2xl p-6">
              <p className="text-xs text-yellow-400 font-medium mb-2">
                {selectedArtist.name} · #{selectedArtist.rank} globally · {fmt(selectedArtist.lastfm_listeners)} monthly listeners
              </p>
              <p className="text-foreground leading-relaxed">{milestoneText}</p>
            </div>
          ) : null}
        </section>
      )}

      {/* ─── ④ Pro 잠금 (비Pro 유저용) ────────────────────── */}
      {!isPro && (
        <section>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            UnfoldK Chart Prediction
            <span className="ml-2 text-xs font-normal text-muted-foreground flex items-center gap-1">
              <Lock className="w-3 h-3" /> Pro
            </span>
          </h2>
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 text-center">
            <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">Coming with Hallyu Pass</p>
            <p className="text-muted-foreground text-sm">AI listener growth trajectory prediction — click Predict on any artist above</p>
          </div>
        </section>
      )}

      {/* ─── ⑤ Share to Attack (Pro: AI 생성 결과 표시) ───── */}
      {isPro && shareArtist && (
        <section>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[#1d9bf0]" />
            UnfoldK Share to Attack
          </h2>
          {shareLoading ? (
            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 text-center text-muted-foreground text-sm">
              Crafting the perfect hype message for {shareArtist.name}...
            </div>
          ) : aiTweetText ? (
            <div className="bg-[#1a1a1a] border border-[#1d9bf0]/30 rounded-2xl p-6">
              <p className="text-foreground leading-relaxed mb-4">{aiTweetText}</p>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(aiTweetText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1d9bf0] text-white text-sm font-medium hover:bg-[#1a8cd8] transition-colors"
              >
                <Share2 className="w-4 h-4" /> Post on X
              </a>
            </div>
          ) : null}
        </section>
      )}

      {/* ─── ② Velocity Tracker ────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Zap className="w-6 h-6 text-yellow-400" />
          <div>
            <h2 className="text-2xl font-semibold text-white">Velocity Tracker</h2>
            <p className="text-muted-foreground text-sm">Estimated hourly YouTube view acceleration (daily delta ÷ 24)</p>
          </div>
        </div>

        {velocityLoading ? (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
            Calculating velocity...
          </div>
        ) : velocity.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
            Need 2+ days of data. Check back tomorrow.
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden divide-y divide-border/20">
            {velocity.map((item, i) => (
              <div key={item.artist_id} className="px-5 py-4 hover:bg-[#232325] transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-muted-foreground text-xs w-4 flex-shrink-0">#{i + 1}</span>
                  {item.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnail_url} alt={item.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-[#252525]" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#252525] flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <Link href={`/kpop/${item.artist_id}`} className="text-foreground font-medium hover:text-primary transition-colors">
                        {item.name}
                      </Link>
                      <span className="text-yellow-400 font-bold text-sm">
                        +<AnimatedCount value={item.hourly_velocity} />/hr
                      </span>
                    </div>
                    {item.name_ko && <p className="text-muted-foreground text-xs">{item.name_ko}</p>}
                  </div>
                </div>
                {/* 게이지 바 */}
                <div className="ml-11 h-1.5 bg-[#2a2a2c] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${item.gauge_pct}%`,
                      background: "linear-gradient(90deg, #FF4B6E, #ff8c00)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── ③ Rival Chase ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-green-400" />
            <h2 className="text-2xl font-semibold text-white">Rival Chase</h2>
          </div>
          {!isPro && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="w-3 h-3" /> Full view with Hallyu Pass
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm mb-6">Monthly listener gap from #1 K-pop artist</p>

        {chart.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
            Chart data loading...
          </div>
        ) : !isPro ? (
          // Free: 1위 vs 2위 격차만
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              {chart[0]?.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={chart[0].thumbnail_url} alt={chart[0].name} className="w-12 h-12 rounded-full object-cover bg-[#252525]" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#252525]" />
              )}
              <div>
                <p className="text-foreground font-semibold">{chart[0]?.name}</p>
                <p className="text-primary text-sm">👑 #1 Global K-pop</p>
                <p className="text-muted-foreground text-xs">{fmt(chart[0]?.lastfm_listeners)} monthly listeners</p>
              </div>
            </div>
            {chart[1] && (
              <div className="flex items-center gap-3 bg-[#141416] rounded-xl p-4">
                {chart[1].thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={chart[1].thumbnail_url} alt={chart[1].name} className="w-10 h-10 rounded-full object-cover bg-[#252525]" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#252525]" />
                )}
                <div className="flex-1">
                  <p className="text-foreground font-medium">{chart[1].name}</p>
                  <p className="text-muted-foreground text-xs">
                    Gap: <span className="text-yellow-400 font-medium">
                      {fmt(top1Listeners - (chart[1].lastfm_listeners ?? 0))} listeners
                    </span> behind #1
                  </p>
                </div>
                <TrendingDown className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <p className="text-center text-muted-foreground text-xs mt-4">
              <Lock className="w-3 h-3 inline mr-1" />
              See full rivalry leaderboard with Hallyu Pass
            </p>
          </div>
        ) : (
          // Pro: 전체 레이싱 게이지
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden divide-y divide-border/20">
            {rivalData.map((item) => {
              const gaugePct = maxGap === 0 ? 100 : Math.round(((maxGap - item.gap) / maxGap) * 100)
              return (
                <div key={item.rank} className="px-5 py-3.5 hover:bg-[#232325] transition-colors">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-muted-foreground text-xs w-5 flex-shrink-0">#{item.rank}</span>
                    {item.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnail_url} alt={item.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0 bg-[#252525]" loading="lazy" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#252525] flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <Link href={`/kpop/${item.artist_id}`} className="text-foreground text-sm font-medium hover:text-primary transition-colors truncate">
                          {item.name}
                        </Link>
                        <span className="text-muted-foreground text-xs flex-shrink-0 ml-2">
                          {item.gap === 0 ? (
                            <span className="text-primary font-semibold">👑 #1</span>
                          ) : (
                            `−${fmt(item.gap)}`
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* 레이싱 게이지 */}
                  <div className="ml-14 h-1.5 bg-[#2a2a2c] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${gaugePct}%`,
                        background: item.rank === 1
                          ? "linear-gradient(90deg, #FF4B6E, #ff8c00)"
                          : "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ─── ⑥ 화력 투표 ───────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Flame className="w-6 h-6" style={{ color: "#FF4B6E" }} />
          <div>
            <h2 className="text-2xl font-semibold text-white">팬덤 화력 랭킹</h2>
            <p className="text-muted-foreground text-sm">🔥 버튼으로 응원 (로그인 필요)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 화력 랭킹 TOP 5 */}
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border/20 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-foreground">화력 랭킹 TOP 5</span>
            </div>
            {rankings.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                첫 번째로 아티스트를 응원해보세요!
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {rankings.map((r) => (
                  <div key={r.artist_id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-muted-foreground text-xs w-4">#{r.rank}</span>
                    {r.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumbnail_url} alt={r.name} className="w-8 h-8 rounded-full object-cover bg-[#252525]" loading="lazy" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#252525]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground text-sm font-medium truncate">{r.name}</p>
                      {r.name_ko && <p className="text-muted-foreground text-xs">{r.name_ko}</p>}
                    </div>
                    <span className="text-primary font-bold text-sm">{fmt(r.vote_count)} 🔥</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 투표 버튼 패널 — 차트 상위 아티스트 */}
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border/20 flex items-center gap-2">
              <Flame className="w-4 h-4" style={{ color: "#FF4B6E" }} />
              <span className="text-sm font-medium text-foreground">지금 응원하기</span>
            </div>
            {!isLoggedIn ? (
              <div className="px-5 py-8 text-center">
                <p className="text-muted-foreground text-sm mb-3">로그인 후 팬덤 화력에 참여하세요</p>
                <Link href="/login">
                  <Button variant="outline" size="sm" className="rounded-full">Sign in</Button>
                </Link>
              </div>
            ) : chart.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                차트 데이터 로딩 중...
              </div>
            ) : (
              <div className="p-4 grid grid-cols-2 gap-2">
                {chart.slice(0, 8).map((item) => {
                  const isVoted = votedIds.has(item.artist_id)
                  const isAnimating = voteAnimate === item.artist_id
                  return (
                    <button
                      key={item.artist_id}
                      onClick={() => handleVote(item.artist_id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left ${
                        isVoted
                          ? "border-primary/50 bg-primary/10"
                          : "border-border/30 bg-[#141416] hover:border-primary/30 hover:bg-[#1e1e20]"
                      } ${isAnimating ? "scale-95" : "scale-100"}`}
                    >
                      {item.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnail_url} alt={item.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0 bg-[#252525]" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#252525] flex-shrink-0" />
                      )}
                      <span className="text-foreground text-xs font-medium truncate flex-1">{item.name}</span>
                      <span className={`text-base flex-shrink-0 ${isAnimating ? "animate-bounce" : ""}`}>🔥</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  )
}
