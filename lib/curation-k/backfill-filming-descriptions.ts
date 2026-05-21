// Curation K — filming_spots.spot_description NULL backfill
//
// 흐름:
//   1. filming_spots 에서 spot_description IS NULL + spot_name != '__no_spots_found__' 인 row 최대 N개 fetch
//   2. 각 row 마다 Claude Haiku 단발 호출로 영문 1~2문장 description 생성
//   3. spot_description update — 빈 문자열도 저장해 NULL 차단 (무한 재호출 방지)
//
// 분리 배경 (2026-05-21):
//   원래 runFilmingSpotsIngest 끝에 직렬 추가되어 있었으나, ingest-curation-k cron 이
//   tour + filming + kpop + backfill 전체 직렬 실행 시 300초 timeout 으로 죽는 문제 발견.
//   description backfill 만 별도 cron route 로 분리해 budget 회수.
//
// 모델: claude-haiku-4-5-20251001 (CLAUDE.md §6 AI 처리 원칙)
// 비용: 10건 × ~$0.0008 = ~$0.008/일. NULL row 소진 후 0건 → 자동 no-op.

import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const client = new Anthropic()

const BACKFILL_CAP = 10

export interface FilmingDescriptionsBackfillResult {
  source: "backfill-filming-descriptions"
  scanned: number    // 대상 fetch 된 row 수 (0 ~ BACKFILL_CAP)
  updated: number    // spot_description 채워진 row 수 (빈 문자열 저장 포함)
  apiErrors: number  // Claude API 일시 에러 → NULL 유지, 다음 run 재시도
  errors: string[]
}

const SYSTEM_PROMPT = `You are a K-drama filming location curator for UnfoldK.

Given a Korean drama title and a filming spot name, write 1–2 concise English sentences describing the iconic scene or context filmed at this location — what fans recognize when they visit. Keep spoiler-light.

Strict rules:
- Output the description text only. No preamble, no quotes, no explanation.
- If you don't have reliable knowledge of this specific drama or location, output the single character: 모름
- Maximum 2 sentences. Keep concise.`

// 반환 규약:
//   - string (빈 문자열 포함) → DB 저장. 빈 문자열도 저장해야 NULL 차단 → 다음 cron 에서 재호출 X.
//   - null → API 일시 에러. 호출자가 skip → NULL 유지 → 다음 cron 재시도.
async function generateSpotDescription(
  dramaTitle: string,
  spotName: string
): Promise<string | null> {
  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `K-drama: "${dramaTitle}"\nFilming spot: "${spotName}"\n\nWrite the description.`,
        },
      ],
    })
  } catch (err) {
    console.warn(
      `[backfill-filming-descriptions] Haiku 호출 실패 "${dramaTitle} / ${spotName}":`,
      err instanceof Error ? err.message : String(err)
    )
    return null
  }

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  )
  const raw = textBlock?.text?.trim() ?? ""

  // 거부 / 모름 / 너무 짧음 → 빈 문자열 (NULL 차단해 재호출 방지)
  if (raw.length === 0) return ""
  if (raw === "모름") return ""
  if (raw.length < 20) return ""
  if (/^(i don't|i do not|i cannot|i can't|i'm not|sorry|unfortunately|i have no)/i.test(raw)) {
    return ""
  }

  return raw.slice(0, 600)
}

export async function runFilmingDescriptionsBackfill(): Promise<FilmingDescriptionsBackfillResult> {
  const result: FilmingDescriptionsBackfillResult = {
    source: "backfill-filming-descriptions",
    scanned: 0,
    updated: 0,
    apiErrors: 0,
    errors: [],
  }

  const supabase = createSupabaseAdminClient()

  const { data: rows, error: fetchErr } = await supabase
    .from("filming_spots")
    .select("id, drama_title, spot_name")
    .is("spot_description", null)
    .neq("spot_name", "__no_spots_found__")
    .order("created_at", { ascending: true })
    .limit(BACKFILL_CAP)

  if (fetchErr) {
    result.errors.push(`fetch 실패: ${fetchErr.message}`)
    return result
  }

  type Row = { id: string; drama_title: string; spot_name: string }
  const list = (rows ?? []) as Row[]
  result.scanned = list.length

  for (const row of list) {
    try {
      const desc = await generateSpotDescription(row.drama_title, row.spot_name)
      if (desc === null) {
        result.apiErrors++
        continue
      }

      const { error: upErr } = await supabase
        .from("filming_spots")
        .update({ spot_description: desc })
        .eq("id", row.id)

      if (upErr) {
        result.errors.push(
          `update 실패 ${row.drama_title} / ${row.spot_name}: ${upErr.message}`
        )
        continue
      }
      result.updated++
    } catch (err) {
      result.errors.push(
        `예외 ${row.spot_name}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return result
}
