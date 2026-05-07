// CRON_SECRET 검증 — Vercel Cron 또는 수동 호출 인증
// Vercel Cron 은 Authorization: Bearer <CRON_SECRET> 헤더 자동 포함

export function verifyCronAuth(request: Request): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return { ok: false, reason: "CRON_SECRET 환경변수 미설정" }
  }

  const auth = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  if (auth !== expected) {
    return { ok: false, reason: "invalid bearer token" }
  }

  return { ok: true }
}
