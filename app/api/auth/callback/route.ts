import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

// OAuth 콜백 — Google 로그인 성공 시 Supabase 가 ?code=... 로 redirect
// code → session 교환 후 ?next 경로 (또는 /mypage) 로 이동
//
// C안: next/headers cookies() 기반 cookieStore 패턴 (Supabase 공식 정석)
//   - createServerClient 의 setAll 콜백에서 cookieStore.set 으로 직접 적용
//   - Next.js Route Handler 컨텍스트에선 cookieStore 변경분이 자동으로 응답 Set-Cookie 에
//     반영되므로, NextResponse.redirect 를 그대로 반환해도 쿠키 누락 없음
//   - lib/supabase/server.ts 와 같은 패턴 — App Router + Supabase SSR 조합에서 가장 안정
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

  // cookieStore 에 적용된 쿠키는 Route Handler 응답에 자동 반영됨
  return NextResponse.redirect(`${origin}${next}`)
}
