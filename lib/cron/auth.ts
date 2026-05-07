// CRON_SECRET 검증 — Vercel Cron 또는 수동 호출 인증
// Vercel Cron 은 Authorization: Bearer <CRON_SECRET> 헤더 자동 포함

export interface CronAuthResult {
  ok: boolean
  reason?: string
  debug?: {
    envSet: boolean
    envLen: number
    envPrefix: string
    headerPresent: boolean
    headerLen: number
    headerPrefix: string
    expectedLen: number
    schemeOk: boolean
    matched: boolean
  }
}

function safePrefix(s: string, n = 4): string {
  if (!s) return ""
  return s.slice(0, n) + (s.length > n ? "…" : "")
}

export function verifyCronAuth(request: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET ?? ""
  const auth = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  const schemeOk = auth.startsWith("Bearer ")
  const matched = secret.length > 0 && auth === expected

  const debug: CronAuthResult["debug"] = {
    envSet: secret.length > 0,
    envLen: secret.length,
    envPrefix: safePrefix(secret),
    headerPresent: auth.length > 0,
    headerLen: auth.length,
    // "Bearer xxxx…" 형태로 앞 일부만 — 토큰 자체는 마스킹
    headerPrefix: schemeOk ? `Bearer ${safePrefix(auth.slice(7))}` : safePrefix(auth, 12),
    expectedLen: expected.length,
    schemeOk,
    matched,
  }

  // 서버 콘솔(=pnpm dev 터미널) 로그
  console.log("[cron-auth]", debug)

  if (secret.length === 0) {
    return { ok: false, reason: "server: CRON_SECRET 환경변수 미설정", debug }
  }
  if (!auth) {
    return { ok: false, reason: "client: Authorization 헤더 없음", debug }
  }
  if (!schemeOk) {
    return { ok: false, reason: "client: 'Bearer ' scheme 누락", debug }
  }
  if (!matched) {
    return { ok: false, reason: "값 불일치", debug }
  }

  return { ok: true }
}
