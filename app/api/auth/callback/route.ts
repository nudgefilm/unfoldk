import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"

// OAuth 콜백 — Google 로그인 성공 시 Supabase 가 ?code=... 로 redirect
// code → session 교환 후 ?next 경로 (또는 /mypage)로 이동
//
// ⚠️ 핵심: exchangeCodeForSession이 발급한 쿠키를 redirect 응답에 직접 적어야 함.
//    cookies() store 만 사용하면 NextResponse.redirect 가 새 응답을 만들면서 쿠키를
//    누락시킴 → 첫 진입에서 세션 미인식 → middleware가 다시 /login 으로 보내는 무한 루프.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const nextRaw = searchParams.get("next") ?? "/mypage"
  // open redirect 방지 — 내부 경로만 허용
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/mypage"

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  // redirect 응답을 먼저 만들고, 쿠키 setter가 이 응답에 직접 쓰도록 연결
  const response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // request.headers.get('cookie') 파싱 대신 표준 cookies API 사용
          const header = request.headers.get("cookie") ?? ""
          return header
            .split(";")
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) => {
              const eq = c.indexOf("=")
              if (eq === -1) return { name: c, value: "" }
              return { name: c.slice(0, eq), value: decodeURIComponent(c.slice(eq + 1)) }
            })
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error("[auth/callback] exchange 실패:", error.message)
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  return response
}
