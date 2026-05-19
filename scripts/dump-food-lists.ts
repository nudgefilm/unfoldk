// 음식 매칭 수동 확인용 덤프 스크립트 (work 폴더 산출)
//
// 출력:
//   work/mafra_list.txt — food_recipes 테이블 전체 (mafra_rcp_seq | title | image_url 유무 O/X)
//   work/mfds_list.txt  — MFDS COOKRCP01 전체 (RCP_NM | ATT_FILE_NO_MAIN URL)
//
// 실행:
//   pnpm dlx dotenv-cli -e .env.local -- pnpm tsx scripts/dump-food-lists.ts
//
// 필요 환경변수:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — MAFRA 덤프
//   MFDS_API_KEY                                          — COOKRCP01 덤프

import { createClient } from "@supabase/supabase-js"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

const WORK_DIR = join(process.cwd(), "work")
const MFDS_PAGE_SIZE = 1000
const MFDS_BASE = "https://openapi.foodsafetykorea.go.kr/api"

interface FoodRecipeRow {
  mafra_rcp_seq: string | null
  title: string
  image_url: string | null
}

interface MfdsRow {
  RCP_SEQ?: string
  RCP_NM?: string
  ATT_FILE_NO_MAIN?: string
  ATT_FILE_NO_MK?: string
}

interface MfdsEnvelope {
  COOKRCP01?: {
    total_count?: string
    row?: MfdsRow[]
  }
}

async function dumpMafra(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase env 누락")

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  // 1000건 chunk 페이징 — 안전하게 PostgREST 기본 제한 회피
  const rows: FoodRecipeRow[] = []
  const chunk = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from("food_recipes")
      .select("mafra_rcp_seq, title, image_url")
      .range(from, from + chunk - 1)
    if (error) throw error
    const batch = (data ?? []) as FoodRecipeRow[]
    rows.push(...batch)
    if (batch.length < chunk) break
    from += chunk
  }

  // mafra_rcp_seq 숫자 정렬
  rows.sort((a, b) => {
    const an = a.mafra_rcp_seq ? Number(a.mafra_rcp_seq) : Number.MAX_SAFE_INTEGER
    const bn = b.mafra_rcp_seq ? Number(b.mafra_rcp_seq) : Number.MAX_SAFE_INTEGER
    if (an !== bn) return an - bn
    return a.title.localeCompare(b.title, "ko")
  })

  const lines = rows.map(
    (r) =>
      `${r.mafra_rcp_seq ?? "-"} | ${r.title} | ${r.image_url ? "O" : "X"}`
  )
  const header = `# food_recipes 덤프 — total ${rows.length}건 (image_url O=있음 / X=없음)\n`
  return header + lines.join("\n") + "\n"
}

async function fetchMfdsPage(start: number, end: number): Promise<MfdsRow[]> {
  const key = process.env.MFDS_API_KEY
  if (!key) throw new Error("MFDS_API_KEY 미설정")
  const url = `${MFDS_BASE}/${key}/COOKRCP01/json/${start}/${end}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as MfdsEnvelope
  return json.COOKRCP01?.row ?? []
}

async function dumpMfds(): Promise<string> {
  const all: MfdsRow[] = []

  // 첫 호출로 total_count 확인
  const first = await fetchMfdsPage(1, MFDS_PAGE_SIZE)
  all.push(...first)

  // 1001 ~ 2000 (1146 cap 안전)
  let start = MFDS_PAGE_SIZE + 1
  while (true) {
    const end = start + MFDS_PAGE_SIZE - 1
    const page = await fetchMfdsPage(start, end)
    if (page.length === 0) break
    all.push(...page)
    if (page.length < MFDS_PAGE_SIZE) break
    start = end + 1
  }

  // RCP_NM 가나다 정렬
  all.sort((a, b) => (a.RCP_NM ?? "").localeCompare(b.RCP_NM ?? "", "ko"))

  const lines = all.map((r) => {
    const url = (r.ATT_FILE_NO_MAIN || r.ATT_FILE_NO_MK || "").trim()
    return `${r.RCP_NM ?? "-"} | ${url || "(no image)"}`
  })
  const header = `# COOKRCP01 덤프 — total ${all.length}건 (RCP_NM 가나다 정렬)\n`
  return header + lines.join("\n") + "\n"
}

async function main() {
  await mkdir(WORK_DIR, { recursive: true })

  console.log("[dump] MAFRA food_recipes 덤프 시작…")
  const mafraText = await dumpMafra()
  const mafraPath = join(WORK_DIR, "mafra_list.txt")
  await writeFile(mafraPath, mafraText, "utf-8")
  console.log(`[dump] ✅ ${mafraPath} (${mafraText.split("\n").length - 1} lines)`)

  console.log("[dump] MFDS COOKRCP01 덤프 시작…")
  const mfdsText = await dumpMfds()
  const mfdsPath = join(WORK_DIR, "mfds_list.txt")
  await writeFile(mfdsPath, mfdsText, "utf-8")
  console.log(`[dump] ✅ ${mfdsPath} (${mfdsText.split("\n").length - 1} lines)`)
}

main().catch((err) => {
  console.error("[dump] 실패:", err)
  process.exit(1)
})
