// POST /api/admin/kpop-geo-refresh
// K-pop Around the World 국가별 차트 수동 재수집.
// cron(07:00 UTC)을 기다리지 않고 즉시 실행.
// admin 세션 체크 포함.

import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getGeoTopArtists } from "@/lib/api/lastfm"

const GEO_COUNTRIES = [
  { code: "KR", name: "South Korea" },
  { code: "JP", name: "Japan" },
  { code: "TW", name: "Taiwan" },
  { code: "PH", name: "Philippines" },
  { code: "TH", name: "Thailand" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "VN", name: "Vietnam" },
  { code: "IN", name: "India" },
  { code: "HK", name: "Hong Kong" },
  { code: "MN", name: "Mongolia" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Peru" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "FI", name: "Finland" },
  { code: "RU", name: "Russia" },
  { code: "CZ", name: "Czech Republic" },
  { code: "HU", name: "Hungary" },
  { code: "RO", name: "Romania" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "TR", name: "Turkey" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "ZA", name: "South Africa" },
  { code: "UA", name: "Ukraine" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "BE", name: "Belgium" },
  { code: "AT", name: "Austria" },
  { code: "DK", name: "Denmark" },
  { code: "IE", name: "Ireland" },
] as const

function normalizeArtistName(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
}

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  // admin 체크
  const supabase = createSupabaseAdminClient()
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  const isAdminToken = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isAdminToken) {
    const { data: { user } } = await (await import("@/lib/supabase/server")).createSupabaseServerClient().then(
      (c) => c.auth.getUser()
    ).catch(() => ({ data: { user: null } }))
    if (!user) {
      const { data: adminCheck } = await supabase.from("users").select("is_admin").eq("id", user?.id ?? "").maybeSingle()
      if (!adminCheck?.is_admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const errors: string[] = []
  const log: string[] = []

  // kpop_artists 조회
  const { data: artistsData } = await supabase
    .from("kpop_artists")
    .select("id, name, name_ko, lastfm_name")
    .eq("is_active", true)

  type ArtistRow = { id: string; name: string; name_ko: string | null; lastfm_name: string | null }
  const artists = (artistsData ?? []) as ArtistRow[]

  // 매칭 맵
  const nameToId = new Map<string, string>()
  for (const a of artists) {
    nameToId.set(a.name.toLowerCase(), a.id)
    nameToId.set(normalizeArtistName(a.name), a.id)
    if (a.lastfm_name) {
      nameToId.set(a.lastfm_name.toLowerCase(), a.id)
      nameToId.set(normalizeArtistName(a.lastfm_name), a.id)
    }
    if (a.name_ko) {
      nameToId.set(a.name_ko.toLowerCase(), a.id)
      nameToId.set(normalizeArtistName(a.name_ko), a.id)
    }
  }

  function matchArtist(name: string): string | undefined {
    return nameToId.get(name.toLowerCase()) ?? nameToId.get(normalizeArtistName(name))
  }

  type CountryResult = {
    code: string
    kpopArtists: Array<{ artistId: string; artistName: string; listeners: number }>
    totalListeners: number
  }
  const countryResults: CountryResult[] = []

  for (let ci = 0; ci < GEO_COUNTRIES.length; ci++) {
    const country = GEO_COUNTRIES[ci]
    if (ci > 0) await new Promise((r) => setTimeout(r, 200))

    try {
      const geoArtists = await getGeoTopArtists(country.name, 1000, { noCache: true })
      const kpopArtists: Array<{ artistId: string; artistName: string; listeners: number }> = []
      const seen = new Set<string>()

      for (const a of geoArtists) {
        const artistId = matchArtist(a.name)
        if (!artistId || seen.has(artistId)) continue
        seen.add(artistId)
        kpopArtists.push({ artistId, artistName: a.name, listeners: a.listeners ?? 0 })
      }

      kpopArtists.sort((x, y) => y.listeners - x.listeners)
      const totalListeners = kpopArtists.reduce((s, x) => s + x.listeners, 0)

      const msg = `${country.code}: ${geoArtists.length} total → ${kpopArtists.length} K-pop matched (total listeners: ${totalListeners.toLocaleString()})`
      log.push(msg)
      console.log("[kpop-geo-refresh]", msg)

      if (kpopArtists.length === 0) continue
      countryResults.push({ code: country.code, kpopArtists, totalListeners })
    } catch (err) {
      const msg = `${country.code}: ERROR — ${String(err)}`
      errors.push(msg)
      log.push(msg)
    }
  }

  // 상위 20개국 선정
  countryResults.sort((a, b) => b.totalListeners - a.totalListeners)
  const top20 = countryResults.slice(0, 20)

  log.push(`\n최종 선정: ${top20.map((c) => c.code).join(", ")} (${top20.length}개국)`)

  // 오늘 기존 데이터 삭제 후 재삽입
  await supabase.from("kpop_country_charts").delete().eq("week_start", todayStr)

  for (const country of top20) {
    const top10 = country.kpopArtists.slice(0, 10)
    for (let i = 0; i < top10.length; i++) {
      const { error: insErr } = await supabase.from("kpop_country_charts").insert({
        week_start: todayStr,
        country_code: country.code,
        artist_id: top10[i].artistId,
        artist_name: top10[i].artistName,
        rank: i + 1,
        listeners: top10[i].listeners,
      })
      if (insErr) errors.push(`insert ${country.code} rank${i + 1}: ${insErr.message}`)
    }
  }

  return NextResponse.json({
    ok: true,
    date: todayStr,
    candidateCount: GEO_COUNTRIES.length,
    matchedCountries: countryResults.length,
    savedCountries: top20.length,
    top20: top20.map((c) => ({ code: c.code, kpopCount: c.kpopArtists.length, totalListeners: c.totalListeners })),
    log,
    errors,
  })
}
