import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// OAuth 콜백 — Google 로그인 성공 시 Supabase 가 ?code=... 로 redirect
// code → session 교환 후 ?next 경로 (또는 /mypage) 로 이동
//
// 쿠키 버퍼 패턴 (A안):
//   - setAll 콜백은 응답을 만들지 않고 버퍼(cookiesToWrite) 에만 누적
//   - exchangeCodeForSession 완료 후 단 한 번 redirect 응답을 생성
//   - 버퍼의 모든 쿠키를 응답에 일괄 적용
//   ↳ setAll 이 여러 번 호출되어도 이전 쿠키가 유실되지 않음 (멀티 호출 안전)
//   ↳ NextResponse.redirect 는 NextResponse.next({request}) 와 달리 request 쿠키
//     자동 forward 가 없으므로, 콜백처럼 단발성 redirect 핸들러에 가장 안전한 형태
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

  // 교환 과정에서 supabase 가 발급할 모든 쿠키를 누적 — 마지막에 일괄 반영
  const cookiesToWrite: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 핸들러 내 후속 supabase 호출이 새 토큰을 볼 수 있도록 request 쪽에도 반영
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // 응답은 아직 만들지 않고 버퍼에만 적재
          cookiesToWrite.push(...cookiesToSet)
        },
      },
    }
  )

  // code → session 교환 (성공 시 setAll 호출되며 cookiesToWrite 채워짐)
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error("[auth/callback] exchange 실패:", error.message)
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // 교환 성공 — 이제 redirect 응답을 만들고 버퍼된 모든 쿠키를 일괄 기록
  const response = NextResponse.redirect(`${origin}${next}`)
  cookiesToWrite.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  return response
}
