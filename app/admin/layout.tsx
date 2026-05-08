import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin/auth"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { Toaster } from "@/components/ui/toaster"

// 어드민 레이아웃 — 모든 /admin/* 페이지 진입 전 is_admin 검증
// middleware도 이미 가드하지만, 직접 RSC 렌더 우회 가능성 차단을 위해 이중 검증
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    redirect(auth.reason === "unauthenticated" ? "/login?redirect=/admin" : "/")
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#0d0d0f" }}>
      <AdminSidebar />
      <main className="flex-1 min-w-0 p-8">{children}</main>
      <Toaster />
    </div>
  )
}
