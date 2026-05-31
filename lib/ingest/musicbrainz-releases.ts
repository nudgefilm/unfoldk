// lib/ingest/musicbrainz-releases.ts
// MusicBrainz release-group 증분 수집 — cron ingest-musicbrainz-releases 전용
//
// 전략:
//   1. musicbrainz_id 보유 아티스트 중 앨범 미수집 또는 SYNC_STALE_DAYS 이상 경과한 대상 선정
//   2. MusicBrainz /ws/2/release-group?artist={mbid}&type=album|single|ep 호출
//   3. kpop_albums upsert (album,single,ep 타입만, Compilation/Live/Remix 제외)
//   4. rate limit 1.1초 준수

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const MB_BASE = "https://musicbrainz.org/ws/2"
const USER_AGENT = "UnfoldK/1.0 (support@unfoldk.com)"
const RATE_LIMIT_MS = 1100

// 마지막 동기화 후 이 일수가 지나면 재수집 (앨범 추가 감지)
const SYNC_STALE_DAYS = 30

// 1회 cron 실행당 처리할 최대 아티스트 수
// 20명 × 1.1초 = 22초 — maxDuration 60초 내 여유 있음
const MAX_ARTISTS_PER_RUN = 20

const EXCLUDED_SECONDARY_TYPES = new Set([
  "Compilation", "Live", "Remix", "DJ-mix",
  "Mixtape/Street", "Demo", "Interview", "Spokenword",
  "Audiobook", "Audio drama", "Field recording",
])

const PRIMARY_TYPE_MAP: Record<string, "album" | "single" | "ep"> = {
  Album: "album",
  Single: "single",
  EP: "ep",
}

export interface MbReleasesIngestResult {
  source: "musicbrainz-releases"
  processed: number
  inserted: number
  errors: string[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mbFetch(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    // Next.js fetch cache 비사용 — cron 에서 fresh data 필요
    cache: "no-store",
  })
  if (res.status === 503) {
    await sleep(5000)
    const retry = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    })
    if (!retry.ok) throw new Error(`MusicBrainz ${retry.status}`)
    return retry.json()
  }
  if (!res.ok) throw new Error(`MusicBrainz ${res.status}`)
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

function parseMbDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null
  const parts = dateStr.split("-")
  if (parts.length === 1 && parts[0].length === 4) return `${parts[0]}-01-01`
  if (parts.length === 2) return `${parts[0]}-${parts[1]}-01`
  if (parts.length === 3) return dateStr
  return null
}

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
    const data = (await mbFetch(`${MB_BASE}/release-group?${params}`)) as MbReleaseGroupsResponse
    const groups = data["release-groups"] ?? []
    all.push(...groups)

    const total = data["release-group-count"] ?? 0
    offset += groups.length
    if (offset >= total || groups.length === 0) break

    await sleep(RATE_LIMIT_MS)
  }

  return all.filter((rg) => {
    const secondary = rg["secondary-types"] ?? []
    return !secondary.some((st) => EXCLUDED_SECONDARY_TYPES.has(st))
  })
}

export async function runMbReleasesIngest(): Promise<MbReleasesIngestResult> {
  const admin = createSupabaseAdminClient()
  const errors: string[] = []

  // ── 대상 아티스트 선정 ─────────────────────────────────────────
  // musicbrainz_id 보유 아티스트 전체
  const { data: mbArtists } = await admin
    .from("kpop_artists")
    .select("id, name, musicbrainz_id")
    .eq("is_active", true)
    .not("musicbrainz_id", "is", null)
    .order("name")

  type ArtistRow = { id: string; name: string; musicbrainz_id: string }
  const allMbArtists = (mbArtists ?? []) as ArtistRow[]

  if (allMbArtists.length === 0) {
    return { source: "musicbrainz-releases", processed: 0, inserted: 0, errors: [] }
  }

  // 최근 SYNC_STALE_DAYS 이내 kpop_albums에 추가된 아티스트 ID 집합 (=최근 동기화 완료)
  const staleThreshold = new Date()
  staleThreshold.setDate(staleThreshold.getDate() - SYNC_STALE_DAYS)

  const { data: recentRows } = await admin
    .from("kpop_albums")
    .select("artist_id")
    .gte("created_at", staleThreshold.toISOString())

  const recentlyUpdatedIds = new Set((recentRows ?? []).map((r) => (r as { artist_id: string }).artist_id))

  // 미동기화 또는 stale 아티스트만 선별
  const targets = allMbArtists
    .filter((a) => !recentlyUpdatedIds.has(a.id))
    .slice(0, MAX_ARTISTS_PER_RUN)

  if (targets.length === 0) {
    return { source: "musicbrainz-releases", processed: 0, inserted: 0, errors: [] }
  }

  // ── 수집 루프 ────────────────────────────────────────────────
  let totalInserted = 0

  for (const artist of targets) {
    try {
      await sleep(RATE_LIMIT_MS)
      const groups = await fetchReleaseGroups(artist.musicbrainz_id)

      for (const rg of groups) {
        const primaryType = rg["primary-type"]
        const albumType = primaryType ? PRIMARY_TYPE_MAP[primaryType] : undefined
        if (!albumType) continue

        const { error: upsertErr } = await admin.from("kpop_albums").upsert(
          {
            artist_id: artist.id,
            mbid: rg.id,
            title: rg.title,
            release_date: parseMbDate(rg["first-release-date"]),
            type: albumType,
            image_url: null,
          },
          { onConflict: "artist_id,mbid" }
        )

        if (upsertErr) {
          errors.push(`${artist.name}/${rg.title}: ${upsertErr.message}`)
        } else {
          totalInserted++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${artist.name}: ${msg}`)
    }
  }

  return {
    source: "musicbrainz-releases",
    processed: targets.length,
    inserted: totalInserted,
    errors,
  }
}
