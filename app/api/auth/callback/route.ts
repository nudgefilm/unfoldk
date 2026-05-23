import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// OAuth 콜백 — Google 로그인 성공 시 Supabase 가 ?code=... 로 redirect
// code → session 교환 후 신규/기존 유저 분기:
//   - users.agreed_to_terms = false → /start?new=true (플랜 + 약관 동의)
//   - users.agreed_to_terms = true  → ?next 경로 (기본 /mypage)
//
// ⚠️ Route Handler 의 cookieStore.set 으로 적은 신규 세션 쿠키가
//    NextResponse.redirect(...) 응답에 자동 적재되지 않아 — 다음 페이지에서
//    getUser() 가 null 로 판단되며 /start 가드가 / 로 튕기는 사례 다수 보고됨.
//    middleware.ts 의 supabaseResponse 패턴을 그대로 사용해 cookie 를 명시 복사.
// 참고: https://supabase.com/docs/guides/auth/server-side/nextjs
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // open redirect 방지 — 내부 경로만 허용. nextRaw 가 빈 문자열·외부 URL 이면 null.
  const nextRaw = searchParams.get("next")
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : null

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  // supabaseResponse 를 만들어 setAll 콜백이 직접 응답에 쿠키를 적재하도록.
  // (middleware 와 동일 — Next.js 15 Route Handler 의 cookieStore.set 자동 반영
  //  의존을 피하고 ResponseCookie options 를 보존)
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

  // code → session 교환 — setAll 이 호출되며 supabaseResponse 에 새 쿠키 기록
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error("[auth/callback] exchange 실패:", error.message)
    return redirectWithCookies(`${origin}/login?error=auth`, supabaseResponse)
  }

  // 세션 교환 완료 — 현재 유저 조회
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // 정상 흐름이면 도달 불가, 방어용 가드
    console.error("[auth/callback] getUser 실패 — 세션 교환 후 user null")
    return redirectWithCookies(`${origin}/login?error=no_user`, supabaseResponse)
  }

  // 신규/기존 분기 — public.users.agreed_to_terms 조회
  // ⚠️ handle_new_user 트리거가 auth.users insert 시점에 public.users 행을 만들어주므로
  //    이 시점엔 행이 존재한다고 가정. 만약 없으면(예: 트리거 누락) 신규로 간주해 /start 로 보냄.
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("agreed_to_terms, country")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    console.error("[auth/callback] users 조회 실패:", profileError.message)
  }

  // country 보정 — 매 로그인 시 x-vercel-ip-country 있고 DB country 가 NULL 이면 저장.
  // complete-signup 에서 못 잡은 케이스 (로컬 dev 테스트·0028 이전 가입자) 를 로그인 시 보완.
  // 기존에 이미 채워진 country 는 덮어쓰지 않음 (.is("country", null) 가드).
  const rawIpCountry = request.headers.get("x-vercel-ip-country")
  if (
    rawIpCountry &&
    /^[A-Z]{2}$/.test(rawIpCountry.toUpperCase()) &&
    profile !== null &&
    !profile.country
  ) {
    const admin = createSupabaseAdminClient()
    const { error: countryErr } = await admin
      .from("users")
      .update({ country: rawIpCountry.toUpperCase() })
      .eq("id", user.id)
      .is("country", null)
    if (countryErr) {
      console.warn("[auth/callback] country 업데이트 실패:", countryErr.message)
    }
  }

  const isExistingMember = profile?.agreed_to_terms === true

  if (!isExistingMember) {
    // 신규 가입자 — 플랜 선택 + 약관 동의 화면으로
    // next 가 명시돼 있으면 보존 → /start 가 가입 완료 후 원래 경로로 복귀
    const startUrl = new URL("/start", origin)
    startUrl.searchParams.set("new", "true")
    if (next) {
      startUrl.searchParams.set("next", next)
    }
    return redirectWithCookies(startUrl, supabaseResponse)
  }

  // 기존 유저 — 원래 가려던 경로 (next 없으면 /mypage)
  return redirectWithCookies(`${origin}${next ?? "/mypage"}`, supabaseResponse)
}

// redirect 응답에 supabaseResponse 의 쿠키(options 포함) 명시 복사
// middleware.ts 의 redirectWithCookies 와 동일 구조
function redirectWithCookies(
  url: string | URL,
  source: NextResponse
): NextResponse {
  const redirect = NextResponse.redirect(url)
  source.cookies.getAll().forEach((c) => redirect.cookies.set(c))
  return redirect
}
