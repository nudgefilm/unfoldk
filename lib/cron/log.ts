import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// cron 실행 로그 기록 — 어드민 모니터 페이지에서 조회
// 로그 기록 자체는 cron 본 작업과 분리 — 로그 실패가 cron 실패를 의미하면 안 됨
export async function recordCronLog(
  route: string,
  status: "success" | "failed",
  resultJson: unknown
): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient()
    await supabase.from("cron_logs").insert({
      route,
      status,
      result_json: resultJson as object,
    })
  } catch (err) {
    console.error(`[cron-log] ${route} 로그 기록 실패:`, err)
  }
}
