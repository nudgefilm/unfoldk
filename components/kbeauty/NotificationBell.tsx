"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  CheckCheck,
  Handshake,
  Package,
  FlaskConical,
  ChevronRight,
  CheckCircle2,
} from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"

// ─── 타입 ──────────────────────────────────────────────────────────────────

type NotifType =
  | "match_request"    | "match_approved"    | "match_rejected"
  | "sample_request"   | "sample_approved"   | "sample_rejected"
  | "sourcing_request" | "sourcing_approved" | "sourcing_rejected"
  | "product_approved"

interface Notification {
  id: string
  type: NotifType
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
}

// ─── 타입별 아이콘 ─────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  NotifType,
  { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>, iconColor: string }
> = {
  match_request:     { icon: Handshake,     iconColor: "#1A3A5C" },
  match_approved:    { icon: CheckCircle2,  iconColor: "#16a34a" },
  match_rejected:    { icon: Handshake,     iconColor: "#dc2626" },
  sample_request:    { icon: FlaskConical,  iconColor: "#8B6F47" },
  sample_approved:   { icon: CheckCheck,    iconColor: "#16a34a" },
  sample_rejected:   { icon: FlaskConical,  iconColor: "#dc2626" },
  sourcing_request:  { icon: Package,       iconColor: "#8B6F47" },
  sourcing_approved: { icon: CheckCheck,    iconColor: "#16a34a" },
  sourcing_rejected: { icon: Package,       iconColor: "#dc2626" },
  product_approved:  { icon: CheckCircle2,  iconColor: "#16a34a" },
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────

export function NotificationBell({
  userId,
  theme = "gold",
}: {
  userId: string
  theme?: "navy" | "gold"
}) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  const accent = theme === "navy" ? "#1A3A5C" : "#8B6F47"
  const accentBg = theme === "navy" ? "#1A3A5C14" : "#C8A88220"
  const unreadCount = notifications.filter((n) => !n.is_read).length

  // ── 초기 로드 ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    supabase
      .from("beauty_notifications")
      .select("id, type, title, message, link, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setNotifications((data ?? []) as Notification[])
      })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime 구독 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`beauty_notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "beauty_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) =>
            [payload.new as Notification, ...prev].slice(0, 20)
          )
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 외부 클릭 닫기 ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // ── 읽음 처리 ────────────────────────────────────────────────────────────
  const markRead = async (n: Notification) => {
    if (!n.is_read) {
      await supabase
        .from("beauty_notifications")
        .update({ is_read: true })
        .eq("id", n.id)
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      )
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return
    await supabase
      .from("beauty_notifications")
      .update({ is_read: true })
      .in("id", unreadIds)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* 벨 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg transition-colors hover:bg-[#F8F7F5]"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-[#6B6B6B]" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none"
            style={{ background: "#EF4444" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E8E2DA] rounded-xl shadow-xl z-50 overflow-hidden">

          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E2DA]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#0F0F0F]">Notifications</span>
              {unreadCount > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white leading-none"
                  style={{ background: "#EF4444" }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-70"
                style={{ color: accent }}
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* 목록 */}
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="w-6 h-6 mx-auto mb-2" style={{ color: "#E8E2DA" }} />
              <p className="text-xs text-[#6B6B6B]">No notifications yet</p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-[#F0EDE8]">
              {notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.match_request
                const Icon = cfg.icon
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => markRead(n)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FAFAF9]",
                        !n.is_read && "bg-[#FAFAF9]"
                      )}
                    >
                      {/* 아이콘 */}
                      <div
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                        style={{ background: accentBg }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: cfg.iconColor }} />
                      </div>

                      {/* 텍스트 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-xs leading-snug text-[#0F0F0F]",
                              !n.is_read ? "font-semibold" : "font-medium"
                            )}
                          >
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span
                              className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1"
                              style={{ background: accent }}
                            />
                          )}
                        </div>
                        <p className="text-xs text-[#6B6B6B] mt-0.5 leading-snug line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-[#9B9B9B] mt-1">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>

                      {n.link && (
                        <ChevronRight className="w-3 h-3 text-[#C8C8C8] mt-1 flex-shrink-0" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
