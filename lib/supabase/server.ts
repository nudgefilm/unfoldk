import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// 서버 컴포넌트·라우트 핸들러용 Supabase 클라이언트
// auth.uid() 기반 RLS가 동작하려면 반드시 cookies()를 통해 세션 전달
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
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
            // 서버 컴포넌트에서 set 호출 시 throw — 미들웨어가 갱신을 처리하므로 무시
          }
        },
      },
    }
  )
}
