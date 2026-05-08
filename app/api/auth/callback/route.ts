import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// OAuth 콜백 — Google 로그인 성공 시 Supabase 가 ?code=... 로 redirect
// code → session 교환 후 ?next 경로 (또는 /mypage) 로 이동
//
// Supabase 공식 Next.js SSR 패턴 (request/response 양방향 쿠키 연결):
//   - getAll() : request 쿠키를 읽음
//   - setAll() : (1) request 쿠키에 즉시 반영 → 같은 핸들러 안에서 후속 supabase
//                    호출이 새 토큰을 볼 수 있게 함
//                (2) supabaseResponse 를 redirect 로 새로 만들고 쿠키를 옵션과 함께
//                    응답에 적재 → exchangeCodeForSession 이 발급한 Set-Cookie 가
//                    응답에서 누락되지 않음
//   - 마지막에 supabaseResponse 를 그대로 반환
// 참고: https://supabase.com/docs/guides/auth/server-side/nextjs
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const nextRaw = searchParams.get("next") ?? "/mypage"
  // open redirect 방지 — 내부 경로만 허용
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/mypage"

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  // 성공 시 사용할 redirect 응답 — setAll 호출마다 새로 생성하며 쿠키를 적재
  let supabaseResponse = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.redirect(`${origin}${next}`)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // code → session 교환 — setAll 콜백이 호출되며 supabaseResponse 에 쿠키가 적재됨
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error("[auth/callback] exchange 실패:", error.message)
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // ⚠️ 공식 가이드: supabaseResponse 객체를 그대로 반환해야 쿠키 동기화가 보장됨
  return supabaseResponse
}
