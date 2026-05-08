// Supabase 세션 자동 갱신 + 보호 라우트 가드
// /mypage/* 미로그인 → /login
// /admin/* 미로그인 → /login, 비관리자 → /

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

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
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
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

  // /mypage·/admin 미로그인 → /login 리디렉트 (원래 경로 redirect 쿼리로)
  if (!user && (isMypage || isAdmin)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", path)
    return NextResponse.redirect(url)
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
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  // _next 정적자원·이미지 제외, 그 외 모든 페이지·라우트에서 동작
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
