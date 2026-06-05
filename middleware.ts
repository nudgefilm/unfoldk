// Supabase 세션 자동 갱신 + 보호 라우트 가드
// /mypage/* 미로그인 → /login
// /admin/* 미로그인 → /login, 비관리자 → /
//
// Supabase 공식 Next.js SSR 패턴 (updateSession) 적용:
//   - getAll() : request 쿠키를 읽음
//   - setAll() : (1) request 쿠키에 즉시 반영 → 같은 미들웨어 안에서 후속 supabase
//                    호출이 새 토큰을 볼 수 있게 함
//                (2) supabaseResponse 를 NextResponse.next({ request }) 로 새로 만들고
//                    쿠키를 옵션과 함께 응답에 적재 → token refresh 시 발급된 쿠키가
//                    브라우저에 정확히 전달됨
//   - getUser() 호출이 만료된 access_token 을 refresh_token 으로 교체 (이때 setAll 트리거)
//   - 보호 라우트에서 redirect 시 supabaseResponse 의 쿠키를 redirect 응답으로 명시 복사
//     (그러지 않으면 회전된 refresh_token 이 무효화되어 다음 요청에서 세션 끊김)
// 참고: https://supabase.com/docs/guides/auth/server-side/nextjs

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

  // ⚠️ 공식 가이드 경고: createServerClient 와 getUser() 사이에 어떤 로직도 넣지 말 것.
  //    그 사이의 작은 실수가 유저가 임의로 로그아웃되는 디버깅 어려운 버그로 이어짐.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isMypage = path.startsWith("/mypage")
  const isAdmin = path.startsWith("/admin")

  // 진단 로그 — 보호 라우트 진입 시 세션 인식 여부 추적 (Vercel Function Logs)
  if (isMypage || isAdmin) {
    console.log("[middleware]", {
      path,
      hasUser: !!user,
      userId: user?.id ?? null,
      cookieCount: request.cookies.getAll().length,
    })
  }

  // /mypage·/admin 미로그인 → /login 리디렉트
  if (!user && (isMypage || isAdmin)) {
    console.log("[middleware/unauth] redirect to /login", { path })
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", path)
    return redirectWithCookies(url, supabaseResponse)
  }

  // agreed_to_terms 미완료 로그인 유저 → /start 리디렉트
  // /start 미완료 후 재로그인 시 OAuth 콜백 없이 /mypage 직접 진입 가능한 경로 차단
  if (user && isMypage) {
    const { data: profile } = await supabase
      .from("users")
      .select("agreed_to_terms")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.agreed_to_terms !== true) {
      console.log("[middleware/onboarding] agreed_to_terms 미완료 → /start", { userId: user.id })
      const url = request.nextUrl.clone()
      url.pathname = "/start"
      url.searchParams.set("new", "true")
      return redirectWithCookies(url, supabaseResponse)
    }
  }

  // /admin 로그인했으나 is_admin 아님 → 홈으로
  // ⚠️ users 테이블 직접 select 대신 SECURITY DEFINER RPC 사용
  //    0005 의 admin 정책이 users 를 self-reference 해 RLS 평가가
  //    재귀(또는 빈 결과)에 빠지고, 관리자도 profile=null 로 읽혀
  //    / 로 튕기던 문제를 방지 — 0006 에서 만든 public.is_admin(uid) 함수 호출.
  if (user && isAdmin) {
    const { data: isAdminUser, error: rpcError } = await supabase.rpc("is_admin", {
      uid: user.id,
    })

    // 진단 로그 — RPC 결과 (data, error) 그대로 노출. error 가 있으면 0006 미적용 등 의심
    console.log("[middleware/admin]", {
      userId: user.id,
      isAdminUser,
      rpcError: rpcError
        ? { code: rpcError.code, message: rpcError.message, details: rpcError.details }
        : null,
    })

    if (!isAdminUser) {
      console.log("[middleware/admin] redirect to / (toast=unauthorized)", { userId: user.id })
      const url = request.nextUrl.clone()
      url.pathname = "/"
      url.search = ""
      // 랜딩 페이지에서 토스트 노출 (UnauthorizedToast 가 감지해 1초 후 자동 사라지며 파라미터 제거)
      url.searchParams.set("toast", "unauthorized")
      return redirectWithCookies(url, supabaseResponse)
    }
  }

  // ────────────────────────────────────────────────────────────
  // UnfoldK Beauty B2B 라우트 가드 (기존 UnfoldK 로직과 독립)
  // KBEAUTY.md §4 기준
  //   /kbeauty/dashboard/supplier/* → beauty_suppliers 레코드 필요
  //   /kbeauty/dashboard/buyer/*    → beauty_buyers 레코드 필요
  //   /kbeauty/admin                → is_admin RPC (기존 UnfoldK admin 재활용)
  //   미인증 or role 불일치 → /kbeauty 리다이렉트
  // ────────────────────────────────────────────────────────────
  const isKbeautySupplierDash = path.startsWith("/kbeauty/dashboard/supplier")
  const isKbeautyBuyerDash    = path.startsWith("/kbeauty/dashboard/buyer")
  const isKbeautyAdmin        = path.startsWith("/kbeauty/admin")

  if (isKbeautySupplierDash || isKbeautyBuyerDash || isKbeautyAdmin) {
    const kbeautyRedirect = () => {
      const url = request.nextUrl.clone()
      url.pathname = "/kbeauty"
      url.search = ""
      return redirectWithCookies(url, supabaseResponse)
    }

    // 미로그인 → /kbeauty
    if (!user) return kbeautyRedirect()

    if (isKbeautySupplierDash) {
      const { data: supplier } = await supabase
        .from("beauty_suppliers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
      if (!supplier) return kbeautyRedirect()
    }

    if (isKbeautyBuyerDash) {
      const { data: buyer } = await supabase
        .from("beauty_buyers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
      if (!buyer) return kbeautyRedirect()
    }

    if (isKbeautyAdmin) {
      const { data: isAdminUser } = await supabase.rpc("is_admin", { uid: user.id })
      if (!isAdminUser) return kbeautyRedirect()
    }
  }

  // ⚠️ 공식 가이드: supabaseResponse 객체를 그대로 반환해야 쿠키 동기화가 보장됨.
  //    새 응답을 만들어야 한다면 NextResponse.next({ request }) 로 만들고
  //    supabaseResponse.cookies.getAll() 을 명시 복사할 것 (위 redirectWithCookies 참조).
  return supabaseResponse
}

export const config = {
  // _next 정적자원·이미지 제외, 그 외 모든 페이지·라우트에서 동작
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
