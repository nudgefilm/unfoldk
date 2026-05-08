import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

// OAuth 콜백 — Google 로그인 성공 시 Supabase 가 ?code=... 로 redirect
// code → session 교환 후 ?next 경로 (또는 /mypage) 로 이동
//
// ⚠️ 처리 순서가 중요:
//    이전 구현은 NextResponse.redirect 를 먼저 만든 뒤 exchangeCodeForSession 을
//    호출해, 일부 케이스에서 발급된 Set-Cookie 가 redirect 응답에 반영되지 않았음.
//    아래 순서로 교체:
//      1) supabase 가 발급할 쿠키를 버퍼에 적재하며 교환 먼저 수행
//      2) 성공 확인 후 NextResponse.redirect 응답 생성
//      3) 버퍼된 쿠키를 response.cookies.set 으로 직접 기록
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const nextRaw = searchParams.get("next") ?? "/mypage"
  // open redirect 방지 — 내부 경로만 허용
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/mypage"

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()

  // 응답이 아직 없으므로 supabase 가 setAll 로 넘기는 쿠키는 일단 버퍼에 적재
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => pendingCookies.push(c))
        },
      },
    }
  )

  // 1. code → session 교환을 먼저 — 이 과정에서 pendingCookies 가 채워짐
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error("[auth/callback] exchange 실패:", error.message)
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // 2. 성공 확인 후 redirect 응답 생성
  const response = NextResponse.redirect(`${origin}${next}`)

  // 3. 버퍼된 쿠키를 응답에 직접 기록 — Set-Cookie 헤더 누락 방지
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  return response
}
