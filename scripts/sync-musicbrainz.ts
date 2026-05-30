// scripts/sync-musicbrainz.ts
// MusicBrainz 아티스트 데이터 동기화
// 실행: npx tsx scripts/sync-musicbrainz.ts
//
// 동작:
//   1. kpop_artists 전체 조회 (musicbrainz_id NULL인 아티스트만)
//   2. 아티스트명으로 MusicBrainz 검색 → mbid 획득
//   3. mbid로 상세 조회 → 멤버·데뷔일·국가·공식URL 수집
//   4. kpop_artists 업데이트
//
// Rate limit: 1 req/sec 엄수 (위반 시 IP 차단 위험)
// User-Agent 필수: UnfoldK/1.0 (support@unfoldk.com)

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// .env.local 수동 파싱 (tag-filming-spots.ts 패턴)
const envPath = path.resolve(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (!process.env[k]) process.env[k] = v
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
)

const MB_BASE = "https://musicbrainz.org/ws/2"
const USER_AGENT = "UnfoldK/1.0 (support@unfoldk.com)"
const RATE_LIMIT_MS = 1100 // 1.1초 간격으로 안전하게

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mbFetch(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  })
  if (!res.ok) {
    throw new Error(`MusicBrainz ${res.status}: ${url}`)
  }
  return res.json()
}

// 아티스트명으로 MusicBrainz 검색 → mbid 반환
async function searchArtist(name: string): Promise<string | null> {
  const q = encodeURIComponent(`artist:"${name}" AND tag:k-pop`)
  const url = `${MB_BASE}/artist/?query=${q}&limit=5&fmt=json`

  const data = (await mbFetch(url)) as {
    artists?: Array<{ id: string; name: string; score?: number; type?: string }>
  }

  const artists = data.artists ?? []
  if (artists.length === 0) return null

  // score 순으로 정렬 (MusicBrainz이 이미 정렬해서 주지만 확인)
  const best = artists.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  if ((best.score ?? 0) < 70) return null // 유사도 낮으면 스킵

  return best.id
}

interface MbUrlRelation {
  type: string
  url: { resource: string }
}

interface MbArtistRelation {
  type: string
  direction: string
  artist: { name: string; id: string }
  begin?: string | null
  end?: string | null
  ended?: boolean
  attributes?: string[]
}

interface MbArtistDetail {
  id: string
  name: string
  country?: string
  "life-span"?: { begin?: string; ended?: boolean }
  relations?: Array<MbUrlRelation | MbArtistRelation>
}

// mbid로 상세 조회 (url-rels + artist-rels 포함)
async function fetchArtistDetail(mbid: string): Promise<MbArtistDetail | null> {
  const url = `${MB_BASE}/artist/${mbid}?inc=url-rels+artist-rels&fmt=json`
  const data = (await mbFetch(url)) as MbArtistDetail
  return data
}

function extractOfficialUrls(
  detail: MbArtistDetail
): Array<{ type: string; url: string }> {
  const urlRels = (detail.relations ?? []).filter(
    (r): r is MbUrlRelation => "url" in r
  )
  const priority = [
    "official homepage",
    "social network",
    "streaming",
    "free streaming",
    "image",
  ]
  return urlRels
    .filter((r) => r.url?.resource)
    .map((r) => ({ type: r.type, url: r.url.resource }))
    .filter((r) => priority.includes(r.type))
    .slice(0, 6)
}

function extractMembers(
  detail: MbArtistDetail
): Array<{ name: string; role?: string; active: boolean }> {
  const artistRels = (detail.relations ?? []).filter(
    (r): r is MbArtistRelation => "artist" in r
  )
  // "member of band" 관계에서 멤버 추출 (direction=backward = 이 아티스트의 멤버)
  return artistRels
    .filter((r) => r.type === "member of band" && r.direction === "backward")
    .map((r) => ({
      name: r.artist.name,
      role: r.attributes?.[0],
      active: !r.ended,
    }))
    .slice(0, 20)
}

async function run() {
  console.log("=== sync-musicbrainz 시작 ===\n")

  // musicbrainz_id NULL 아티스트만 처리
  const { data: artists, error } = await supabase
    .from("kpop_artists")
    .select("id, name, name_ko")
    .eq("is_active", true)
    .is("musicbrainz_id", null)
    .order("name")

  if (error) {
    console.error("kpop_artists 조회 실패:", error.message)
    process.exit(1)
  }

  const targets = artists ?? []
  console.log(`처리 대상: ${targets.length}개 아티스트\n`)

  let successCount = 0
  let notFoundCount = 0
  const failedArtists: string[] = []

  for (let i = 0; i < targets.length; i++) {
    const artist = targets[i] as { id: string; name: string; name_ko: string | null }
    console.log(`[${i + 1}/${targets.length}] ${artist.name}`)

    try {
      // Step 1: 검색
      await sleep(RATE_LIMIT_MS)
      const mbid = await searchArtist(artist.name)

      if (!mbid) {
        console.log(`  → 매핑 실패 (검색 결과 없음 또는 score 낮음)`)
        notFoundCount++
        failedArtists.push(artist.name)
        continue
      }

      console.log(`  → mbid: ${mbid}`)

      // Step 2: 상세 조회
      await sleep(RATE_LIMIT_MS)
      const detail = await fetchArtistDetail(mbid)

      if (!detail) {
        console.log(`  → 상세 조회 실패`)
        failedArtists.push(artist.name)
        continue
      }

      const officialUrls = extractOfficialUrls(detail)
      const members = extractMembers(detail)
      const debutDate = detail["life-span"]?.begin
        ? detail["life-span"].begin.length === 4
          ? `${detail["life-span"].begin}-01-01`  // 연도만 있으면 1월 1일로
          : detail["life-span"].begin
        : null
      const country = detail.country ?? null

      console.log(
        `  → country=${country}, debut=${debutDate}, members=${members.length}, urls=${officialUrls.length}`
      )

      // Step 3: DB 업데이트
      const { error: updateErr } = await supabase
        .from("kpop_artists")
        .update({
          musicbrainz_id: mbid,
          mb_debut_date: debutDate,
          mb_country: country,
          mb_members: members.length > 0 ? members : null,
          mb_official_urls: officialUrls.length > 0 ? officialUrls : null,
        })
        .eq("id", artist.id)

      if (updateErr) {
        console.log(`  → DB 저장 실패: ${updateErr.message}`)
        failedArtists.push(artist.name)
      } else {
        successCount++
        console.log(`  → 저장 완료`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  → 오류: ${msg}`)
      failedArtists.push(artist.name)
    }
  }

  console.log("\n=== 결과 ===")
  console.log(`성공: ${successCount}`)
  console.log(`매핑 실패 (Not Found): ${notFoundCount}`)
  console.log(`오류: ${failedArtists.length - notFoundCount}`)

  if (failedArtists.length > 0) {
    console.log("\n실패 아티스트:")
    failedArtists.forEach((name) => console.log(`  - ${name}`))
  }
}

run().catch((err) => {
  console.error("스크립트 실패:", err)
  process.exit(1)
})
