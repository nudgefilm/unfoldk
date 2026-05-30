// scripts/sync-wikidata.ts
// Wikidata SPARQL로 K팝 아티스트 소속사·수상 이력 수집
// 실행: npx tsx scripts/sync-wikidata.ts
//
// 동작:
//   1. kpop_artists에서 musicbrainz_id가 있는 아티스트 조회 (MB ID로 Wikidata 매핑)
//   2. Wikidata SPARQL: MusicBrainz ID(P434) → Q아이디 + 소속사(P137) + 수상(P166)
//   3. kpop_artists 업데이트 (wikidata_id, wd_agency, wd_awards)
//
// Wikidata SPARQL 엔드포인트: 무료, 무제한 (단 복잡한 쿼리는 타임아웃 가능)
// MusicBrainz 없는 아티스트는 이름으로 직접 검색 (fallback)

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// .env.local 수동 파싱
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

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
const USER_AGENT = "UnfoldK/1.0 (support@unfoldk.com)"

async function sparqlQuery(query: string): Promise<unknown> {
  const res = await fetch(
    `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`,
    {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/sparql-results+json",
      },
    }
  )
  if (!res.ok) throw new Error(`SPARQL ${res.status}`)
  return res.json()
}

interface SparqlBinding {
  value: string
  type: string
}

interface SparqlResult {
  results: {
    bindings: Array<Record<string, SparqlBinding>>
  }
}

// MusicBrainz ID 배치로 Wikidata 조회 (50개씩)
async function fetchWikidataByMbids(
  mbids: string[]
): Promise<Map<string, { qid: string; agency: string | null; awards: Array<{ award: string; year?: number }> }>> {
  const result = new Map<string, { qid: string; agency: string | null; awards: Array<{ award: string; year?: number }> }>()
  if (mbids.length === 0) return result

  const mbidValues = mbids.map((id) => `"${id}"`).join(" ")

  const query = `
SELECT ?item ?mbid
       (SAMPLE(?agencyLabel) AS ?agency)
       (GROUP_CONCAT(DISTINCT ?awardLabel; separator="|") AS ?awards)
WHERE {
  VALUES ?mbid { ${mbidValues} }
  ?item wdt:P434 ?mbid.

  OPTIONAL {
    ?item wdt:P137 ?agencyEntity.
    ?agencyEntity rdfs:label ?agencyLabel.
    FILTER(LANG(?agencyLabel) = "en")
  }

  OPTIONAL {
    ?item p:P166 ?awardStatement.
    ?awardStatement ps:P166 ?awardEntity.
    ?awardEntity rdfs:label ?awardLabel.
    FILTER(LANG(?awardLabel) = "en")
  }
}
GROUP BY ?item ?mbid
`

  const data = (await sparqlQuery(query)) as SparqlResult
  for (const binding of data.results.bindings) {
    const mbid = binding.mbid?.value
    const qid = binding.item?.value?.replace("http://www.wikidata.org/entity/", "")
    if (!mbid || !qid) continue

    const agency = binding.agency?.value ?? null
    const awardsRaw = binding.awards?.value ?? ""
    const awards = awardsRaw
      ? awardsRaw
          .split("|")
          .filter(Boolean)
          .map((a) => ({ award: a }))
      : []

    result.set(mbid, { qid, agency, awards })
  }

  return result
}

// 이름으로 직접 Wikidata 검색 (MB ID 없는 아티스트용 fallback)
async function fetchWikidataByName(
  artistName: string
): Promise<{ qid: string; agency: string | null } | null> {
  const query = `
SELECT ?item (SAMPLE(?agencyLabel) AS ?agency)
WHERE {
  ?item rdfs:label "${artistName}"@en.
  ?item wdt:P136 wd:Q213978.  # K-pop genre
  OPTIONAL {
    ?item wdt:P137 ?agencyEntity.
    ?agencyEntity rdfs:label ?agencyLabel.
    FILTER(LANG(?agencyLabel) = "en")
  }
}
GROUP BY ?item
LIMIT 1
`

  const data = (await sparqlQuery(query)) as SparqlResult
  const binding = data.results.bindings[0]
  if (!binding?.item) return null

  return {
    qid: binding.item.value.replace("http://www.wikidata.org/entity/", ""),
    agency: binding.agency?.value ?? null,
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  console.log("=== sync-wikidata 시작 ===\n")

  // 전체 활성 아티스트 조회
  const { data: artists, error } = await supabase
    .from("kpop_artists")
    .select("id, name, musicbrainz_id, wikidata_id")
    .eq("is_active", true)
    .order("name")

  if (error) {
    console.error("kpop_artists 조회 실패:", error.message)
    process.exit(1)
  }

  type ArtistRow = { id: string; name: string; musicbrainz_id: string | null; wikidata_id: string | null }
  const allArtists = (artists ?? []) as ArtistRow[]

  // wikidata_id 없는 아티스트만 대상
  const targets = allArtists.filter((a) => !a.wikidata_id)
  console.log(`처리 대상: ${targets.length}개 (wikidata_id 없는 아티스트)\n`)

  let successCount = 0
  const failedArtists: string[] = []

  // Phase 1: MusicBrainz ID 있는 아티스트를 50개씩 배치 쿼리
  const withMbid = targets.filter((a) => a.musicbrainz_id)
  console.log(`Phase 1: MusicBrainz ID로 배치 매핑 (${withMbid.length}개)`)

  for (let i = 0; i < withMbid.length; i += 50) {
    const batch = withMbid.slice(i, i + 50)
    const mbids = batch.map((a) => a.musicbrainz_id!)

    try {
      const wdMap = await fetchWikidataByMbids(mbids)

      for (const artist of batch) {
        const wd = wdMap.get(artist.musicbrainz_id!)
        if (!wd) {
          console.log(`  ${artist.name} → Wikidata 매핑 없음`)
          failedArtists.push(artist.name)
          continue
        }

        const { error: updateErr } = await supabase
          .from("kpop_artists")
          .update({
            wikidata_id: wd.qid,
            wd_agency: wd.agency,
            wd_awards: wd.awards.length > 0 ? wd.awards : null,
          })
          .eq("id", artist.id)

        if (updateErr) {
          console.log(`  ${artist.name} → DB 저장 실패: ${updateErr.message}`)
          failedArtists.push(artist.name)
        } else {
          console.log(`  ${artist.name} → ${wd.qid} (agency: ${wd.agency ?? "N/A"})`)
          successCount++
        }
      }

      // 배치 간 딜레이
      if (i + 50 < withMbid.length) await sleep(1000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  배치 쿼리 실패: ${msg}`)
      batch.forEach((a) => failedArtists.push(a.name))
    }
  }

  // Phase 2: MusicBrainz ID 없는 아티스트를 이름으로 개별 검색
  const withoutMbid = targets.filter((a) => !a.musicbrainz_id)
  console.log(`\nPhase 2: 이름으로 개별 검색 (${withoutMbid.length}개)`)

  for (let i = 0; i < withoutMbid.length; i++) {
    const artist = withoutMbid[i] as ArtistRow
    console.log(`[${i + 1}/${withoutMbid.length}] ${artist.name}`)
    await sleep(300)

    try {
      const wd = await fetchWikidataByName(artist.name)
      if (!wd) {
        console.log(`  → 매핑 없음`)
        failedArtists.push(artist.name)
        continue
      }

      const { error: updateErr } = await supabase
        .from("kpop_artists")
        .update({
          wikidata_id: wd.qid,
          wd_agency: wd.agency,
        })
        .eq("id", artist.id)

      if (updateErr) {
        console.log(`  → DB 저장 실패: ${updateErr.message}`)
        failedArtists.push(artist.name)
      } else {
        console.log(`  → ${wd.qid} (agency: ${wd.agency ?? "N/A"})`)
        successCount++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  → 오류: ${msg}`)
      failedArtists.push(artist.name)
    }
  }

  console.log("\n=== 결과 ===")
  console.log(`성공: ${successCount}`)
  console.log(`실패/미매핑: ${failedArtists.length}`)
  if (failedArtists.length > 0) {
    console.log("\n실패 아티스트:")
    failedArtists.forEach((name) => console.log(`  - ${name}`))
  }
}

run().catch((err) => {
  console.error("스크립트 실패:", err)
  process.exit(1)
})
