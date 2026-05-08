import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

// OAuth 콜백 — Google 로그인 성공 시 Supabase 가 ?code=... 로 redirect
// code → session 교환 후 신규/기존 유저 분기:
//   - users.agreed_to_terms = false → /start?new=true (플랜 + 약관 동의)
//   - users.agreed_to_terms = true  → ?next 경로 (기본 /mypage)
//
// C안: next/headers cookies() 기반 cookieStore 패턴 (Supabase 공식 정석)
//   - createServerClient 의 setAll 콜백에서 cookieStore.set 으로 직접 적용
//   - Next.js Route Handler 컨텍스트에선 cookieStore 변경분이 자동으로 응답 Set-Cookie 에
//     반영되므로, NextResponse.redirect 를 그대로 반환해도 쿠키 누락 없음
// 참고: https://supabase.com/docs/guides/auth/server-side/nextjs
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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 서버 컴포넌트에서 호출 시 throw — Route Handler 에선 정상 동작 (안전 가드)
          }
        },
      },
    }
  )

  // code → session 교환 — setAll 콜백이 호출되며 cookieStore 에 새 쿠키 기록
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error("[auth/callback] exchange 실패:", error.message)
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // 세션 교환 완료 — 현재 유저 조회
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // 정상 흐름이면 도달 불가, 방어용 가드
    console.error("[auth/callback] getUser 실패 — 세션 교환 후 user null")
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  // 신규/기존 분기 — public.users.agreed_to_terms 조회
  // ⚠️ handle_new_user 트리거가 auth.users insert 시점에 public.users 행을 만들어주므로
  //    이 시점엔 행이 존재한다고 가정. 만약 없으면(예: 트리거 누락) 신규로 간주해 /start 로 보냄.
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("agreed_to_terms")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    console.error("[auth/callback] users 조회 실패:", profileError.message)
  }

  const isExistingMember = profile?.agreed_to_terms === true

  if (!isExistingMember) {
    // 신규 가입자 — 플랜 선택 + 약관 동의 화면으로
    return NextResponse.redirect(`${origin}/start?new=true`)
  }

  // 기존 유저 — 원래 가려던 경로 (기본 /mypage)
  return NextResponse.redirect(`${origin}${next}`)
}
