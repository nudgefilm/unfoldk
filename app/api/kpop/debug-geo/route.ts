// GET /api/kpop/debug-geo?country=South+Korea&limit=100
// K팝 아티스트 매칭 진단 — Last.fm 응답 vs kpop_artists 비교
// ⚠️ admin 전용 (미들웨어 or 수동 제거 필요). 서비스 안정화 후 삭제.
import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/"

function getLastfmKey(): string {
  const key = process.env.LASTFM_API_KEY
  if (!key) throw new Error("LASTFM_API_KEY 미설정")
  return key
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "") // 유니코드 문자·숫자만 유지 (한글 포함)
}

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const country = searchParams.get("country") ?? "South Korea"
  const limit = Math.min(500, Number(searchParams.get("limit") ?? "100"))

  // 1. Last.fm 실시간 호출 (cache 우회)
  const params = new URLSearchParams({
    method: "geo.gettopartists",
    country,
    api_key: getLastfmKey(),
    format: "json",
    limit: String(limit),
  })
  const lfmRes = await fetch(`${LASTFM_BASE}?${params}`, { cache: "no-store" })
  if (!lfmRes.ok) {
    return NextResponse.json({ error: `Last.fm ${lfmRes.status}` }, { status: 502 })
  }
  const raw = await lfmRes.json() as {
    topartists?: { artist?: Array<{ name: string; listeners?: string }> }
  }
  const geoArtists = (raw.topartists?.artist ?? [])
    .filter((a) => !!a.name)
    .map((a) => ({ name: a.name, listeners: a.listeners ? Number(a.listeners) : null }))

  // 2. kpop_artists 전체 조회 (name, name_ko, lastfm_name)
  const admin = createSupabaseAdminClient()
  const { data: dbArtists } = await admin
    .from("kpop_artists")
    .select("id, name, name_ko, lastfm_name")
    .eq("is_active", true)

  type DbArtist = { id: string; name: string; name_ko: string | null; lastfm_name: string | null }
  const artists = (dbArtists ?? []) as DbArtist[]

  // 3. 매칭 맵 구성 (현재 로직 + 개선 로직 비교)
  // 현재: lowercase 비교
  const currentMap = new Map<string, string>()
  for (const a of artists) {
    currentMap.set(a.name.toLowerCase(), a.name)
    if (a.lastfm_name) currentMap.set(a.lastfm_name.toLowerCase(), a.name)
  }

  // 개선: normalize (특수문자·공백 제거, 한글 포함)
  const normalizedMap = new Map<string, string>()
  for (const a of artists) {
    normalizedMap.set(normalize(a.name), a.name)
    if (a.lastfm_name) normalizedMap.set(normalize(a.lastfm_name), a.name)
    if (a.name_ko) normalizedMap.set(normalize(a.name_ko), a.name)  // 한글명 추가
  }

  // 4. 매칭 결과 분류
  const matched: Array<{ geo_name: string; db_name: string; listeners: number | null; method: string }> = []
  const unmatched: Array<{ geo_name: string; listeners: number | null }> = []

  for (const g of geoArtists) {
    const currentHit = currentMap.get(g.name.toLowerCase())
    const normalizedHit = normalizedMap.get(normalize(g.name))
    if (currentHit) {
      matched.push({ geo_name: g.name, db_name: currentHit, listeners: g.listeners, method: "current" })
    } else if (normalizedHit) {
      matched.push({ geo_name: g.name, db_name: normalizedHit, listeners: g.listeners, method: "normalized_new" })
    } else {
      unmatched.push({ geo_name: g.name, listeners: g.listeners })
    }
  }

  // 5. kpop_artists 중 geo 결과에 하나도 없는 아티스트
  const matchedDbNames = new Set(matched.map((m) => m.db_name))
  const missingFromGeo = artists
    .filter((a) => !matchedDbNames.has(a.name))
    .map((a) => ({ name: a.name, name_ko: a.name_ko, lastfm_name: a.lastfm_name }))

  return NextResponse.json({
    country,
    limit,
    geo_total: geoArtists.length,
    matched_count: matched.length,
    unmatched_count: unmatched.length,
    new_matches_by_normalized: matched.filter((m) => m.method === "normalized_new").length,
    matched,
    unmatched_top30: unmatched.slice(0, 30),
    kpop_artists_missing_from_geo: missingFromGeo,
  })
}
