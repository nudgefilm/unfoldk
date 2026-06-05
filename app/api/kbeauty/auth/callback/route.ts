import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// kbeauty Google OAuth 콜백
// beauty_suppliers → /kbeauty/dashboard/supplier
// beauty_buyers    → /kbeauty/dashboard/buyer
// 둘 다 없음       → /kbeauty/auth (신규 가입 선택)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(`${origin}/kbeauty/login?error=missing_code`)
  }

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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error("[kbeauty/auth/callback] exchange 실패:", error.message)
    return redirectWithCookies(`${origin}/kbeauty/login?error=auth`, supabaseResponse)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return redirectWithCookies(`${origin}/kbeauty/login?error=no_user`, supabaseResponse)
  }

  const { data: supplier } = await supabase
    .from("beauty_suppliers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (supplier) {
    return redirectWithCookies(`${origin}/kbeauty/dashboard/supplier`, supabaseResponse)
  }

  const { data: buyer } = await supabase
    .from("beauty_buyers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (buyer) {
    return redirectWithCookies(`${origin}/kbeauty/dashboard/buyer`, supabaseResponse)
  }

  return redirectWithCookies(`${origin}/kbeauty/auth`, supabaseResponse)
}

function redirectWithCookies(url: string, source: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url)
  source.cookies.getAll().forEach((c) => redirect.cookies.set(c))
  return redirect
}
