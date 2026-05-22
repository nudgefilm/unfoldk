import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
// 각 cron route handler 직접 import — Vercel 내부 HTTP fetch 차단 우회.
// 같은 프로젝트 내 함수끼리 외부 URL로 fetch하면 응답을 못 받는 경우가 있어
// 직접 호출 방식으로 전환 (2026-05-23).
import { GET as ingestAll } from "@/app/api/cron/ingest-all/route"
import { GET as ingestTicketmaster } from "@/app/api/cron/ingest-ticketmaster/route"
import { GET as ingestKpopStats } from "@/app/api/cron/ingest-kpop-stats/route"
import { GET as ingestTmdbDramas } from "@/app/api/cron/ingest-tmdb-dramas/route"
import { GET as ingestTourSpots } from "@/app/api/cron/ingest-tour-spots/route"
import { GET as ingestFilmingKpop } from "@/app/api/cron/ingest-filming-kpop/route"
import { GET as ingestKoreanPhrases } from "@/app/api/cron/ingest-korean-phrases/route"
import { GET as ingestFoodRecipes } from "@/app/api/cron/ingest-food-recipes/route"
import { GET as sendReminders } from "@/app/api/cron/send-reminders/route"
import { GET as backfillFilmingDescriptions } from "@/app/api/cron/backfill-filming-descriptions/route"

export const dynamic = "force-dynamic"
export const maxDuration = 300

// ⚠️ 신규 cron 라우트 추가 시:
//   1. vercel.json crons 배열
//   2. app/admin/cron/page.tsx ROUTES + ROUTE_DISPLAY_NAMES
//   3. 본 파일 import + CRON_HANDLERS 맵
//   4. components/admin/cron-monitor.tsx summarizeRunResult
//   네 곳을 함께 갱신해야 어드민 수동 실행이 정상 동작.

const PostSchema = z.object({
  route: z.enum([
    "ingest-all",
    "ingest-ticketmaster",
    "ingest-kpop-stats",
    "ingest-tmdb-dramas",
    "ingest-tour-spots",
    "ingest-filming-kpop",
    "ingest-korean-phrases",
    "ingest-food-recipes",
    "send-reminders",
    "backfill-filming-descriptions",
  ]),
  // 선택적 쿼리 파라미터 — cron 라우트가 옵션을 받을 때 (e.g. ingest-tour-spots?only_festivals=true)
  // 값은 모두 문자열로 직렬화. 키·값 길이는 64자 cap.
  params: z
    .record(z.string().max(64), z.string().max(64))
    .optional(),
})

type RouteKey = z.infer<typeof PostSchema>["route"]

// route → handler 매핑. zod enum 과 반드시 동기화.
const CRON_HANDLERS: Record<RouteKey, (req: Request) => Promise<Response>> = {
  "ingest-all": ingestAll,
  "ingest-ticketmaster": ingestTicketmaster,
  "ingest-kpop-stats": ingestKpopStats,
  "ingest-tmdb-dramas": ingestTmdbDramas,
  "ingest-tour-spots": ingestTourSpots,
  "ingest-filming-kpop": ingestFilmingKpop,
  "ingest-korean-phrases": ingestKoreanPhrases,
  "ingest-food-recipes": ingestFoodRecipes,
  "send-reminders": sendReminders,
  "backfill-filming-descriptions": backfillFilmingDescriptions,
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    console.warn("[admin/cron/run] auth 실패:", auth.reason)
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ")
    console.warn("[admin/cron/run] zod parse 실패:", issues, "| receivedRoute:", (body as { route?: unknown })?.route)
    return NextResponse.json(
      {
        error: `invalid_body: ${issues}`,
        receivedRoute: (body as { route?: unknown })?.route,
      },
      { status: 400 }
    )
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[admin/cron/run] CRON_SECRET 미설정")
    return NextResponse.json({ error: "CRON_SECRET 미설정" }, { status: 500 })
  }

  const { route, params } = parsed.data
  const qs = new URLSearchParams(params ?? {}).toString()
  // 핸들러 내부에서 searchParams 를 읽기 위한 URL — domain 은 placeholder (verifyCronAuth 는 헤더만 검사).
  const internalUrl = `https://internal/api/cron/${route}${qs ? `?${qs}` : ""}`
  const internalReq = new Request(internalUrl, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  })

  console.log("[admin/cron/run] 직접 호출 →", route, qs ? `(${qs})` : "")

  const t0 = Date.now()
  try {
    const res = await CRON_HANDLERS[route](internalReq)
    const json = await res.json().catch(() => ({}))
    console.log("[admin/cron/run] 완료 status:", res.status, "elapsed:", Date.now() - t0, "ms")
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      elapsedMs: Date.now() - t0,
      result: json,
    })
  } catch (err) {
    console.error("[admin/cron/run] 핸들러 예외:", err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "핸들러 실행 실패" },
      { status: 500 }
    )
  }
}
