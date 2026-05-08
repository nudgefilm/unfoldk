// Supabase 세션 자동 갱신 + 보호 라우트 가드
// /mypage/* 미로그인 → /login
// /admin/* 미로그인 → /login, 비관리자 → /
//
// ⚠️ Supabase SSR 가이드 핵심: redirect 응답에도 token refresh로 새로 발급된 쿠키를
//    반드시 복사해야 함. 그러지 않으면 다음 요청에서 회전된 refresh_token이 무효화되어
//    세션이 끊김.

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// supabaseResponse(token refresh가 적힌)로부터 redirect 응답으로 쿠키 복사
function redirectWithCookies(url: URL, source: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url)
  source.cookies.getAll().forEach((c) => redirect.cookies.set(c))
  return redirect
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 세션 갱신 (만료된 access_token 을 refresh_token 으로 교체)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isMypage = path.startsWith("/mypage")
  const isAdmin = path.startsWith("/admin")

  // /mypage·/admin 미로그인 → /login 리디렉트
  if (!user && (isMypage || isAdmin)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", path)
    return redirectWithCookies(url, supabaseResponse)
  }

  // /admin 로그인했으나 is_admin 아님 → 홈으로
  if (user && isAdmin) {
    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.is_admin) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      url.search = ""
      return redirectWithCookies(url, supabaseResponse)
    }
  }

  return supabaseResponse
}

export const config = {
  // _next 정적자원·이미지 제외, 그 외 모든 페이지·라우트에서 동작
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
