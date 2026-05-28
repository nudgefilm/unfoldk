"use client"

// /mypage/settings — 기본 설정
//
// 수정 가능: name (public.users.name) — RLS users_update_own 통과
// 읽기 전용: email (Supabase Auth 관리, 변경은 별도 플로우 필요)
// 알림: 글로벌 toggle 컬럼이 없음. 대신 per-event 알림(HallyuCalendar) 안내 + 결제 알림(Resend) 상시 안내.
//
// ⚠️ users 테이블 RLS update 시 plan_type 은 절대 건드리지 말 것 (페어 컬럼 클래스 버그 — CLAUDE.md §7)

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MypageShell } from "@/components/mypage/mypage-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/components/ui/use-toast"
import { Bell, ExternalLink } from "lucide-react"

export default function SettingsPage() {
  return (
    <MypageShell activeLabel="Settings">
      <SettingsBody />
      <Toaster />
    </MypageShell>
  )
}

function SettingsBody() {
  const { toast } = useToast()
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [email, setEmail] = useState("")
  const [originalName, setOriginalName] = useState("")
  const [name, setName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [planType, setPlanType] = useState<string>("free")
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowserClient()

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      setEmail(user.email ?? "")

      const { data: profile } = await supabase
        .from("users")
        .select("name, plan_type")
        .eq("id", user.id)
        .single()

      const dbName = (profile as { name?: string | null; plan_type?: string | null } | null)?.name ?? ""
      const dbPlan = (profile as { plan_type?: string | null } | null)?.plan_type ?? "free"
      // DB name 없으면 Google full_name 으로 채우기
      const meta = (user.user_metadata ?? {}) as { full_name?: string }
      const initialName = dbName || meta.full_name?.trim() || ""

      if (!cancelled) {
        setOriginalName(initialName)
        setName(initialName)
        setPlanType(dbPlan)
        setLoaded(true)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const isDirty = name.trim() !== originalName.trim()
  const hasActiveSub = planType === "monthly" || planType === "annual"

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch("/api/account/delete", { method: "POST" })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        toast({ title: "Delete failed", description: body.error ?? "Please try again." })
        setIsDeleting(false)
        return
      }
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.signOut()
      router.push("/")
    } catch {
      toast({ title: "Delete failed", description: "Network error. Please try again." })
      setIsDeleting(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: "Session expired", description: "Please log in again." })
        setIsSaving(false)
        return
      }

      const trimmed = name.trim()
      const { error } = await supabase
        .from("users")
        .update({ name: trimmed || null, updated_at: new Date().toISOString() })
        .eq("id", user.id)

      if (error) {
        console.error("[settings] name 업데이트 실패:", error.message)
        toast({ title: "Save failed", description: error.message })
        setIsSaving(false)
        return
      }

      setOriginalName(trimmed)
      toast({ title: "Saved", description: "Your profile name was updated." })
    } catch (err) {
      console.error("[settings] 예외:", err)
      toast({
        title: "Save failed",
        description: "Network error. Please try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

      {!loaded ? (
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
          Loading...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profile */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Profile</h2>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6 space-y-4">
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">Display name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="Your name"
                  className="h-11 bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div>
                <label className="text-muted-foreground text-xs mb-1 block">Email</label>
                <Input
                  value={email}
                  readOnly
                  disabled
                  className="h-11 bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-muted-foreground cursor-not-allowed"
                />
                <p className="text-muted-foreground/70 text-xs mt-1">
                  Email is managed by your sign-in provider and can&apos;t be changed here. Contact{" "}
                  <a
                    href="/contact"
                    className="hover:underline"
                    style={{ color: "#FF4B6E" }}
                  >
                    support@unfoldk.com
                  </a>{" "}
                  to update it.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  className="rounded-full font-medium text-white px-6"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Notifications</h2>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#FF4B6E" }} />
                <div className="text-sm">
                  <p className="text-foreground font-medium mb-1">Event reminders</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Reminders (D-7 / D-1 / day of) are set per event. Open any event from{" "}
                    <Link
                      href="/calendar"
                      className="hover:underline"
                      style={{ color: "#FF4B6E" }}
                    >
                      HallyuCalendar
                    </Link>{" "}
                    to subscribe and choose your timing.
                  </p>
                </div>
              </div>

              <div className="border-t border-border/30" />

              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div className="text-sm">
                  <p className="text-foreground font-medium mb-1">Account &amp; billing emails</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Important account messages (payment receipts, plan changes, security alerts)
                    are always sent to your email. These can&apos;t be turned off.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Privacy & data */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Privacy &amp; Data</h2>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6 space-y-3 text-sm">
              <Link
                href="/privacy"
                className="flex items-center justify-between text-foreground hover:underline"
              >
                <span>Privacy Policy</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </Link>
              <Link
                href="/terms"
                className="flex items-center justify-between text-foreground hover:underline"
              >
                <span>Terms of Use</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </Link>
              <Link
                href="/gdpr"
                className="flex items-center justify-between text-foreground hover:underline"
              >
                <span>GDPR &amp; your rights</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </Link>
              <div className="border-t border-border/30 pt-4">
                <p className="text-muted-foreground text-xs mb-3">
                  Permanently deletes your account and all associated data.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="rounded-full">
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>
                            This will permanently delete your account and all associated data.
                            This action cannot be undone.
                          </p>
                          {hasActiveSub && (
                            <p>
                              You have an active subscription. Deleting your account will not
                              automatically cancel it. Please cancel first or contact{" "}
                              <a
                                href="mailto:support@unfoldk.com"
                                className="hover:underline"
                                style={{ color: "#FF4B6E" }}
                              >
                                support@unfoldk.com
                              </a>
                              .
                            </p>
                          )}
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "Deleting..." : "Delete Account"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
