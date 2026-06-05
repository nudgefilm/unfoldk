import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

// kbeauty 전용 계정 생성 API
// admin.createUser + email_confirm:true → 확인 이메일 미발송
// 클라이언트 signUp은 프로젝트 설정의 이메일 템플릿(UnfoldK명)이 발송되므로 사용 금지
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 이메일 확인 없이 즉시 인증 상태로 생성 → 확인 이메일 미발송
    })

    if (error) {
      const msg = error.message || ""
      const status = (error as { status?: number }).status ?? 400

      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already been registered")) {
        return NextResponse.json({ error: "already_registered" }, { status: 422 })
      }
      return NextResponse.json({ error: msg }, { status })
    }

    return NextResponse.json({ userId: data.user.id })
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
