// KOPIS 공연 데이터 → 'concert'/'fanmeet' 이벤트 인제스트
// 라우트(ingest-kopis) 에서 import 해 재사용

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  fetchKopisList,
  toKopisDate,
  KOPIS_GENRE_KPOP,
  type KopisListItem,
} from "@/lib/api/kopis"

export interface KopisIngestResult {
  source: "kopis"
  scanned: number
  upserted: number
  error?: string
  details?: string
  hint?: string
  code?: string
  note?: string
}

// prfnm 키워드 기반 fanmeet 판정 — 매칭 안 되면 concert
function classifyType(prfnm: string): "concert" | "fanmeet" {
  const lower = prfnm.toLowerCase()
  const fanmeetKeywords = [
    "팬미팅", "팬 미팅", "팬미트", "팬콘", "팬 콘",
    "fan meeting", "fanmeeting", "fanmeet", "fan-meet", "fancon",
  ]
  return fanmeetKeywords.some((k) => lower.includes(k.toLowerCase()))
    ? "fanmeet"
    : "concert"
}

// KOPIS prfpdfrom ('YYYY.MM.DD') → ISO datetime
// 목록 API 는 시간 정보가 없어 콘서트 일반 시작 시간 KST 19:00 으로 가정
function toEventDate(prfpdfrom: string): string | null {
  if (!/^\d{4}\.\d{2}\.\d{2}$/.test(prfpdfrom)) return null
  const isoDate = prfpdfrom.replace(/\./g, "-")
  return new Date(`${isoDate}T19:00:00+09:00`).toISOString()
}

export async function runKopisIngest(): Promise<KopisIngestResult> {
  const today = new Date()
  const sixMonthsLater = new Date()
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)

  const baseParams = {
    stdate: toKopisDate(today),
    eddate: toKopisDate(sixMonthsLater),
    shcate: KOPIS_GENRE_KPOP,
    rows: 100,
    cpage: 1,
  }

  // 공연예정(01) + 공연중(02) 병렬 조회 — KOPIS prfstate 는 단일 값만 받음
  let list01: KopisListItem[] = []
  let list02: KopisListItem[] = []
  try {
    ;[list01, list02] = await Promise.all([
      fetchKopisList({ ...baseParams, prfstate: "01" }),
      fetchKopisList({ ...baseParams, prfstate: "02" }),
    ])
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    return { source: "kopis", scanned: 0, upserted: 0, error: msg }
  }

  // mt20id 기준 중복 제거 — 한 공연이 예정·중 양쪽에 잡히는 케이스 방지
  const dedupedMap = new Map<string, KopisListItem>()
  for (const it of [...list01, ...list02]) dedupedMap.set(it.mt20id, it)
  const items = Array.from(dedupedMap.values())

  const rows = items
    .map((it) => {
      const eventDate = toEventDate(it.prfpdfrom)
      if (!eventDate) return null
      return {
        type: classifyType(it.prfnm),
        title: it.prfnm,
        artist_or_drama: it.prfnm,
        event_date: eventDate,
        event_time_label: "7:00 PM KST",
        description: it.fcltynm ? `${it.fcltynm} · ${it.area}` : null,
        source_api: "kopis" as const,
        source_id: it.mt20id,
        thumbnail_url: it.poster || null,
        // TODO: KOPIS 캘린더 재노출 시 Melon Ticket 외부 링크를 url 에 채울 것.
        // 현재 events API 가 .neq("source_api","kopis") 로 노출 차단 중이라 우선순위 낮음.
        is_premium: false,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) {
    return {
      source: "kopis",
      scanned: items.length,
      upserted: 0,
      note: "유효 prfpdfrom 매칭 없음",
    }
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .upsert(rows, {
      onConflict: "source_api,source_id",
      ignoreDuplicates: false,
    })
    .select("id")

  if (error) {
    console.error("[ingest-kopis] upsert 실패:", error)
    return {
      source: "kopis",
      scanned: items.length,
      upserted: 0,
      error: error.message,
      details: error.details ?? undefined,
      hint: error.hint ?? undefined,
      code: error.code ?? undefined,
    }
  }

  return {
    source: "kopis",
    scanned: items.length,
    upserted: data?.length ?? 0,
  }
}
