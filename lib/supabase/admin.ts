import { createClient } from "@supabase/supabase-js"

// 서버 전용 admin 클라이언트 — RLS 우회 (인제스트 잡, 웹훅, 시드 등)
// ⚠️ 클라이언트 코드에서 절대 import 하지 말 것 (service_role 키 노출)
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
