// scripts/sync-musicbrainz-releases.ts
// MusicBrainz release-group 기반 앨범 히스토리 초기 수집 (1회성)
//
// 실행:
//   npx tsx scripts/sync-musicbrainz-releases.ts           # 전체 수집
//   npx tsx scripts/sync-musicbrainz-releases.ts --dry-run  # DB 미기록, 출력만
//   npx tsx scripts/sync-musicbrainz-releases.ts --limit=10 # N명만 처리
//
// 대상: kpop_artists.musicbrainz_id IS NOT NULL (195명)
//
// MusicBrainz API:
//   GET /ws/2/release-group?artist={mbid}&type=album|single|ep&fmt=json&limit=100
//   페이지네이션: offset 증가 (release-group-count > 100 시)
//
// Rate limit: 1.1초 간격 (1 req/sec 제한 위반 시 IP 차단 위험)
// User-Agent 필수: UnfoldK/1.0 (support@unfoldk.com)
//
// 수집 대상 type: Album / Single / EP (정규 스튜디오 결과물만)
// 수집 제외 secondary-type: Compilation / Live / Remix / DJ-mix / Mixtape/Street

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// .env.local 수동 파싱 (sync-musicbrainz.ts 동일 패턴)
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
const RATE_LIMIT_MS = 1100 // 1.1초 — MusicBrainz 1 req/sec 제한 준수

// CLI 플래그 파싱
const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const limitArg = args.find((a) => a.startsWith("--limit="))
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : null

// secondary-type 중 수집 제외 목록
const EXCLUDED_SECONDARY_TYPES = new Set([
  "Compilation",
  "Live",
  "Remix",
  "DJ-mix",
  "Mixtape/Street",
  "Demo",
  "Interview",
  "Spokenword",
  "Audiobook",
  "Audio drama",
  "Field recording",
])

// MusicBrainz primary-type → kpop_albums.type 매핑
const PRIMARY_TYPE_MAP: Record<string, "album" | "single" | "ep"> = {
  Album: "album",
  Single: "single",
  EP: "ep",
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mbFetch(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  })
  if (res.status === 503) {
    // MB rate limit 초과 — 5초 대기 후 1회 재시도
    console.warn("  ⚠ 503 rate limit — 5초 대기 후 재시도")
    await sleep(5000)
    const retry = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    })
    if (!retry.ok) throw new Error(`MusicBrainz ${retry.status}: ${url}`)
    return retry.json()
  }
  if (!res.ok) throw new Error(`MusicBrainz ${res.status}: ${url}`)
  return res.json()
}

interface MbReleaseGroup {
  id: string
  title: string
  "primary-type"?: string
  "secondary-types"?: string[]
  "first-release-date"?: string
}

interface MbReleaseGroupsResponse {
  "release-group-count": number
  "release-group-offset": number
  "release-groups": MbReleaseGroup[]
}

// 부분 날짜 → PostgreSQL date 형식 (YYYY-MM-DD)
// "2016"     → "2016-01-01"
// "2016-10"  → "2016-10-01"
// "2016-10-10" → "2016-10-10"
// ""  / null  → null
function parseMbDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null
  const parts = dateStr.split("-")
  if (parts.length === 1 && parts[0].length === 4) return `${parts[0]}-01-01`
  if (parts.length === 2) return `${parts[0]}-${parts[1]}-01`
  if (parts.length === 3) return dateStr
  return null
}

// 아티스트의 release-group 목록 수집 (pagination 처리)
async function fetchReleaseGroups(mbid: string): Promise<MbReleaseGroup[]> {
  const PAGE_SIZE = 100
  const all: MbReleaseGroup[] = []
  let offset = 0

  while (true) {
    const params = new URLSearchParams({
      artist: mbid,
      type: "album|single|ep",
      fmt: "json",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    const url = `${MB_BASE}/release-group?${params}`
    const data = (await mbFetch(url)) as MbReleaseGroupsResponse
    const groups = data["release-groups"] ?? []
    all.push(...groups)

    const total = data["release-group-count"] ?? 0
    offset += groups.length
    if (offset >= total || groups.length === 0) break

    // 다음 페이지 요청 전 rate limit 대기
    await sleep(RATE_LIMIT_MS)
  }

  // secondary-type 필터: Compilation / Live / Remix 등 제외
  return all.filter((rg) => {
    const secondaryTypes = rg["secondary-types"] ?? []
    return !secondaryTypes.some((st) => EXCLUDED_SECONDARY_TYPES.has(st))
  })
}

async function run() {
  console.log("=== sync-musicbrainz-releases 시작 ===")
  if (DRY_RUN) console.log("⚠ DRY RUN 모드 — DB 기록 없음\n")
  if (LIMIT) console.log(`제한: ${LIMIT}명만 처리\n`)

  // musicbrainz_id 보유 아티스트 조회
  const { data: artists, error } = await supabase
    .from("kpop_artists")
    .select("id, name, musicbrainz_id")
    .eq("is_active", true)
    .not("musicbrainz_id", "is", null)
    .order("name")

  if (error) {
    console.error("kpop_artists 조회 실패:", error.message)
    process.exit(1)
  }

  type ArtistRow = { id: string; name: string; musicbrainz_id: string }
  const targets = ((artists ?? []) as ArtistRow[]).slice(0, LIMIT ?? undefined)
  console.log(`처리 대상: ${targets.length}명 (musicbrainz_id 보유)\n`)

  let totalInserted = 0
  let totalSkipped = 0
  let processedArtists = 0
  const errors: string[] = []

  for (let i = 0; i < targets.length; i++) {
    const artist = targets[i]
    console.log(`[${i + 1}/${targets.length}] ${artist.name} (${artist.musicbrainz_id})`)

    try {
      await sleep(RATE_LIMIT_MS)
      const groups = await fetchReleaseGroups(artist.musicbrainz_id)
      console.log(`  → release-group ${groups.length}개 (type 필터 후)`)

      if (groups.length === 0) {
        console.log("  → 건너뜀 (해당 없음)")
        processedArtists++
        continue
      }

      let inserted = 0
      let skipped = 0

      for (const rg of groups) {
        const primaryType = rg["primary-type"]
        const albumType = primaryType ? PRIMARY_TYPE_MAP[primaryType] : undefined
        if (!albumType) {
          // Album/Single/EP 이외 타입 (Broadcast 등) 스킵
          skipped++
          continue
        }

        const releaseDate = parseMbDate(rg["first-release-date"])

        if (DRY_RUN) {
          console.log(
            `    [DRY] ${albumType.padEnd(7)} ${releaseDate ?? "날짜미상"} — ${rg.title}`
          )
          inserted++
          continue
        }

        const { error: upsertErr } = await supabase.from("kpop_albums").upsert(
          {
            artist_id: artist.id,
            mbid: rg.id,
            title: rg.title,
            release_date: releaseDate,
            type: albumType,
            image_url: null, // CAA backfill은 별도 스크립트로 처리
          },
          { onConflict: "artist_id,mbid" }
        )

        if (upsertErr) {
          console.log(`    ✗ upsert 실패 (${rg.title}): ${upsertErr.message}`)
          errors.push(`${artist.name}/${rg.title}: ${upsertErr.message}`)
        } else {
          inserted++
        }
      }

      totalInserted += inserted
      totalSkipped += skipped
      processedArtists++
      console.log(`  → 저장: ${inserted}건 / 스킵: ${skipped}건`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ✗ 오류: ${msg}`)
      errors.push(`${artist.name}: ${msg}`)
    }
  }

  console.log("\n=== 결과 ===")
  console.log(`처리 아티스트: ${processedArtists}`)
  console.log(`저장 앨범:     ${totalInserted}`)
  console.log(`타입 스킵:     ${totalSkipped}`)
  console.log(`오류:          ${errors.length}`)
  if (errors.length > 0) {
    console.log("\n오류 목록:")
    errors.forEach((e) => console.log("  -", e))
  }
  if (DRY_RUN) console.log("\n⚠ DRY RUN — DB에 아무것도 기록되지 않았습니다.")
}

run().catch((err) => {
  console.error("스크립트 실패:", err)
  process.exit(1)
})
