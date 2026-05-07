import { createBrowserClient } from "@supabase/ssr"

// 클라이언트 컴포넌트용 Supabase 클라이언트
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
