"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Search,
  Calculator,
  Settings,
  CheckCircle2,
  Clock,
  ChevronLeft,
  Bell,
  Shield,
  Trash2,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// ─── 상수 ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/kbeauty/dashboard/seller" },
  { label: "Discover", icon: Search, href: "/kbeauty/dashboard/seller#discover" },
  { label: "Calculator", icon: Calculator, href: "/kbeauty/dashboard/seller#calculator" },
  { label: "Settings", icon: Settings, href: "/kbeauty/dashboard/seller/settings" },
]

const GOLD_LIGHT = "#C8A882"

// ─── 사이드바 ──────────────────────────────────────────────────────────────

function Sidebar({ companyName, verified }: { companyName: string; verified: boolean }) {
  return (
    <aside
      className="fixed top-0 left-0 h-screen bg-white border-r border-[#E8E2DA] flex flex-col"
      style={{ width: 240 }}
    >
      <div className="px-6 py-5 border-b border-[#E8E2DA]">
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className="font-bold text-[#0F0F0F] text-sm">UnfoldK Beauty</span>
          <span style={{ color: GOLD_LIGHT }} className="text-xs">&#9670;</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/kbeauty/dashboard/seller/settings"
          return (
            <a
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={
                isActive
                  ? { color: "#8B6F47", fontWeight: 600, background: "#FBF8F4" }
                  : { color: "#6B6B6B" }
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </a>
          )
        })}
      </nav>
      <div className="px-4 py-4 border-t border-[#E8E2DA]">
        <p className="text-xs font-medium text-[#0F0F0F] truncate">{companyName || "—"}</p>
        <div className="mt-1">
          {verified ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-[#6B6B6B] bg-[#F8F7F5] px-2 py-0.5 rounded-full border border-[#E8E2DA]">
              <Clock className="w-3 h-3" />Pending
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}

// ─── 토글 스위치 ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
      style={{ background: checked ? "#8B6F47" : "#E8E2DA" }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
      />
    </button>
  )
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────

interface NotifPrefs {
  match_update: boolean
  sourcing_request: boolean
  sample_update: boolean
  marketing: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  match_update: true,
  sourcing_request: true,
  sample_update: true,
  marketing: false,
}

export default function SellerSettingsPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [companyName, setCompanyName] = useState("")
  const [contactVerified, setContactVerified] = useState(false)
  const [userEmail, setUserEmail] = useState("")
  const [loading, setLoading] = useState(true)

  // Notification settings
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [savingNotif, setSavingNotif] = useState(false)

  // Password change
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPw, setSavingPw] = useState(false)

  // Account deletion
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [showDeleteSection, setShowDeleteSection] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/kbeauty"); return }

      setUserEmail(user.email ?? "")

      const meta = user.user_metadata as Record<string, unknown>
      if (meta?.seller_notif_prefs && typeof meta.seller_notif_prefs === "object") {
        setNotifPrefs({ ...DEFAULT_PREFS, ...(meta.seller_notif_prefs as Partial<NotifPrefs>) })
      }

      const { data: seller } = await supabase
        .from("beauty_sellers")
        .select("company_name, contact_verified")
        .eq("user_id", user.id)
        .single()

      if (seller) {
        setCompanyName(seller.company_name ?? "")
        setContactVerified(seller.contact_verified ?? false)
      }

      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function handleSaveNotif() {
    setSavingNotif(true)
    const { error } = await supabase.auth.updateUser({
      data: { seller_notif_prefs: notifPrefs },
    })
    if (error) {
      toast.error("Failed to save notification settings.")
    } else {
      toast.success("Notification settings saved.")
    }
    setSavingNotif(false)
  }

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) {
      toast.error("Please enter a new password.")
      return
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      toast.error("Failed to change password.")
    } else {
      toast.success("Password changed successfully.")
      setNewPassword("")
      setConfirmPassword("")
    }
    setSavingPw(false)
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== companyName) {
      toast.error("Please enter your company name exactly.")
      return
    }
    toast.error("To delete your account, please contact support@unfoldk.com")
  }

  const inputClass =
    "border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C8A882] transition-colors bg-white w-full"
  const sectionClass = "bg-white border border-[#E8E2DA] mb-6"
  const sectionStyle = { borderRadius: 12, padding: 24 }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <p className="text-sm text-[#6B6B6B]">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F7F5]" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>
      <Toaster position="top-right" richColors />

      <Sidebar companyName={companyName} verified={contactVerified} />

      <main style={{ marginLeft: 240, padding: "32px 36px", maxWidth: 840 }}>

        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href="/kbeauty/dashboard/seller"
            className="inline-flex items-center gap-1 text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />Dashboard
          </Link>
          <span className="text-[#E8E2DA] text-sm">/</span>
          <span className="text-sm font-medium text-[#0F0F0F]">Settings</span>
        </div>
        <h1 className="text-xl font-bold text-[#0F0F0F] mb-6">Settings</h1>

        {/* Account Info */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "#8B6F47" }}>
            <Shield className="w-4 h-4" />Account Information
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-[#6B6B6B] mb-1">Email</p>
              <p className="text-sm text-[#0F0F0F] font-medium">{userEmail || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6B6B6B] mb-1">Company</p>
              <p className="text-sm text-[#0F0F0F] font-medium">{companyName || "—"}</p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: "#8B6F47" }}>
            <Bell className="w-4 h-4" />Notification Settings
          </h2>
          <p className="text-xs text-[#6B6B6B] mb-5">Choose which email notifications you want to receive.</p>

          <div className="space-y-4">
            {[
              { key: "match_update" as const, label: "Match Updates", desc: "When a supplier approves or rejects your match request" },
              { key: "sourcing_request" as const, label: "Sourcing Requests", desc: "When a supplier reaches out with a sourcing offer" },
              { key: "sample_update" as const, label: "Sample Updates", desc: "When your sample request status changes" },
              { key: "marketing" as const, label: "Marketing & Promotions", desc: "UnfoldK Beauty updates, tips, and promotions" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#0F0F0F]">{item.label}</p>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">{item.desc}</p>
                </div>
                <Toggle
                  checked={notifPrefs[item.key]}
                  onChange={(v) => setNotifPrefs((prev) => ({ ...prev, [item.key]: v }))}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-5 pt-4 border-t border-[#E8E2DA]">
            <button
              onClick={handleSaveNotif}
              disabled={savingNotif}
              className="text-sm font-semibold px-5 py-2 transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "#8B6F47", color: "white", borderRadius: 8 }}
            >
              {savingNotif ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Password Change */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "#8B6F47" }}>
            <Shield className="w-4 h-4" />Change Password
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#6B6B6B] mb-1">New Password</label>
              <input
                type="password"
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B6B6B] mb-1">Confirm New Password</label>
              <input
                type="password"
                className={inputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleChangePassword}
              disabled={savingPw}
              className="text-sm font-semibold px-5 py-2 transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "#8B6F47", color: "white", borderRadius: 8 }}
            >
              {savingPw ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div
          className="bg-white border mb-10"
          style={{ borderRadius: 12, padding: 24, borderColor: "#FCA5A5" }}
        >
          <h2 className="text-sm font-semibold text-red-600 mb-1 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />Danger Zone
          </h2>
          <p className="text-xs text-[#6B6B6B] mb-4">
            Deleting your account is permanent and cannot be undone. All your data will be removed.
          </p>

          {!showDeleteSection ? (
            <button
              onClick={() => setShowDeleteSection(true)}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete Account
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#0F0F0F]">
                To confirm, type your company name{" "}
                <span className="font-semibold">"{companyName}"</span> below.
              </p>
              <input
                type="text"
                className="border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 transition-colors bg-white w-full"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={companyName}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeleteSection(false); setDeleteConfirm("") }}
                  className="text-sm font-medium px-4 py-2 rounded-lg border border-[#E8E2DA] text-[#6B6B6B] hover:bg-[#F8F7F5] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="text-sm font-semibold px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Request Deletion
                </button>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
