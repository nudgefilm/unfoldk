"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  Handshake,
  Settings,
  UserCircle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  Bell,
  Shield,
  Trash2,
  Megaphone,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { AdRequestForm } from "@/components/kbeauty/AdRequestForm"

// ─── 상수 ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "대시보드", icon: LayoutDashboard, href: "/kbeauty/dashboard/supplier" },
  { label: "제품 관리", icon: Package, href: "/kbeauty/dashboard/supplier/products/new" },
  { label: "매칭 관리", icon: Handshake, href: "/kbeauty/dashboard/supplier/matches" },
  { label: "프로필 관리", icon: UserCircle, href: "/kbeauty/dashboard/supplier/profile" },
  { label: "계정 설정", icon: Settings, href: "/kbeauty/dashboard/supplier/settings" },
]

// ─── 사이드바 ──────────────────────────────────────────────────────────────

function Sidebar({
  companyName,
  licenseVerified,
  onAdvertiseClick,
}: {
  companyName: string
  licenseVerified: boolean
  onAdvertiseClick: () => void
}) {
  return (
    <aside
      className="fixed top-0 left-0 h-screen bg-white border-r border-[#E8E2DA] flex flex-col"
      style={{ width: 240 }}
    >
      <div className="px-6 py-5 border-b border-[#E8E2DA]">
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className="font-bold text-[#0F0F0F] text-sm">UnfoldK Beauty</span>
          <span className="text-[#C8A882] text-xs">&#9670;</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/kbeauty/dashboard/supplier/settings"
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={
                isActive
                  ? { color: "#1A3A5C", fontWeight: 600, background: "#EEF2F7" }
                  : { color: "#6B6B6B" }
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-3 border-t border-[#E8E2DA]">
        <button
          onClick={onAdvertiseClick}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white py-2 rounded-lg hover:opacity-90 transition-opacity"
          style={{ background: "#C8A882" }}
        >
          <Megaphone className="w-3.5 h-3.5" />광고 신청
        </button>
      </div>
      <div className="px-4 py-4 border-t border-[#E8E2DA]">
        <p className="text-xs font-medium text-[#0F0F0F] truncate">{companyName || "—"}</p>
        <div className="mt-1">
          {licenseVerified ? (
            <span className="inline-flex items-center gap-1 text-xs text-[#1A3A5C] bg-blue-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />인증 완료
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-[#6B6B6B] bg-[#F8F7F5] px-2 py-0.5 rounded-full border border-[#E8E2DA]">
              <Clock className="w-3 h-3" />인증 대기
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
      style={{ background: checked ? "#1A3A5C" : "#E8E2DA" }}
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
  match_request: boolean
  sample_request: boolean
  contact_request: boolean
  marketing: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  match_request: true,
  sample_request: true,
  contact_request: true,
  marketing: false,
}

export default function SupplierSettingsPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [companyName, setCompanyName] = useState("")
  const [licenseVerified, setLicenseVerified] = useState(false)
  const [userEmail, setUserEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [showAdForm, setShowAdForm] = useState(false)

  // 알림 설정
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [savingNotif, setSavingNotif] = useState(false)

  // 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPw, setSavingPw] = useState(false)

  // 계정 탈퇴
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [showDeleteSection, setShowDeleteSection] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/kbeauty"); return }

      setUserEmail(user.email ?? "")

      // 저장된 알림 설정 불러오기 (user metadata)
      const meta = user.user_metadata as Record<string, unknown>
      if (meta?.supplier_notif_prefs && typeof meta.supplier_notif_prefs === "object") {
        setNotifPrefs({ ...DEFAULT_PREFS, ...(meta.supplier_notif_prefs as Partial<NotifPrefs>) })
      }

      const { data: supplier } = await supabase
        .from("beauty_suppliers")
        .select("company_name_ko, cosmetic_license_verified")
        .eq("user_id", user.id)
        .single()

      if (supplier) {
        setCompanyName(supplier.company_name_ko ?? "")
        setLicenseVerified(supplier.cosmetic_license_verified ?? false)
      }

      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function handleSaveNotif() {
    setSavingNotif(true)
    const { error } = await supabase.auth.updateUser({
      data: { supplier_notif_prefs: notifPrefs },
    })
    if (error) {
      toast.error("저장 중 오류가 발생했습니다.")
    } else {
      toast.success("알림 설정이 저장되었습니다.")
    }
    setSavingNotif(false)
  }

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) {
      toast.error("새 비밀번호를 입력해주세요.")
      return
    }
    if (newPassword.length < 8) {
      toast.error("비밀번호는 8자 이상이어야 합니다.")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("새 비밀번호가 일치하지 않습니다.")
      return
    }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      toast.error("비밀번호 변경에 실패했습니다.")
    } else {
      toast.success("비밀번호가 변경되었습니다.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    }
    setSavingPw(false)
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== companyName) {
      toast.error("회사명을 정확히 입력해주세요.")
      return
    }
    toast.error("계정 탈퇴는 고객센터(support@unfoldk.com)로 문의해주세요.")
  }

  const inputClass =
    "border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A3A5C] transition-colors bg-white w-full"
  const sectionClass = "bg-white border border-[#E8E2DA] mb-6"
  const sectionStyle = { borderRadius: 12, padding: 24 }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <p className="text-sm text-[#6B6B6B]">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F7F5]" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>
      <Toaster position="top-right" richColors />
      {showAdForm && <AdRequestForm userType="supplier" onClose={() => setShowAdForm(false)} />}

      <Sidebar companyName={companyName} licenseVerified={licenseVerified} onAdvertiseClick={() => setShowAdForm(true)} />

      <main style={{ marginLeft: 240, padding: "32px 36px", maxWidth: 840 }}>

        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href="/kbeauty/dashboard/supplier"
            className="inline-flex items-center gap-1 text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />대시보드
          </Link>
          <span className="text-[#E8E2DA] text-sm">/</span>
          <span className="text-sm font-medium text-[#0F0F0F]">계정 설정</span>
        </div>
        <h1 className="text-xl font-bold text-[#0F0F0F] mb-6">계정 설정</h1>

        {/* 계정 정보 (읽기 전용) */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-[#1A3A5C] mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4" />계정 정보
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-[#6B6B6B] mb-1">이메일</p>
              <p className="text-sm text-[#0F0F0F] font-medium">{userEmail || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#6B6B6B] mb-1">회사명</p>
              <p className="text-sm text-[#0F0F0F] font-medium">{companyName || "—"}</p>
            </div>
          </div>
        </div>

        {/* 알림 설정 */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-[#1A3A5C] mb-1 flex items-center gap-2">
            <Bell className="w-4 h-4" />알림 설정
          </h2>
          <p className="text-xs text-[#6B6B6B] mb-5">이메일로 알림을 받을 항목을 선택하세요.</p>

          <div className="space-y-4">
            {[
              { key: "match_request" as const, label: "매칭 요청 알림", desc: "새 바이어/셀러로부터 매칭 요청이 들어올 때" },
              { key: "sample_request" as const, label: "샘플 요청 알림", desc: "제품 샘플 요청이 들어올 때" },
              { key: "contact_request" as const, label: "컨택 요청 알림", desc: "새 컨택 요청 메시지가 도착할 때" },
              { key: "marketing" as const, label: "마케팅 알림", desc: "UnfoldK Beauty 업데이트 및 프로모션 소식" },
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
              style={{ background: "#1A3A5C", color: "white", borderRadius: 8 }}
            >
              {savingNotif ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-[#1A3A5C] mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4" />비밀번호 변경
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#6B6B6B] mb-1">새 비밀번호</label>
              <input
                type="password"
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8자 이상"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B6B6B] mb-1">새 비밀번호 확인</label>
              <input
                type="password"
                className={inputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 재입력"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleChangePassword}
              disabled={savingPw}
              className="text-sm font-semibold px-5 py-2 transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "#1A3A5C", color: "white", borderRadius: 8 }}
            >
              {savingPw ? "변경 중..." : "비밀번호 변경"}
            </button>
          </div>
        </div>

        {/* 위험 구역 */}
        <div
          className="bg-white border mb-10"
          style={{ borderRadius: 12, padding: 24, borderColor: "#FCA5A5" }}
        >
          <h2 className="text-sm font-semibold text-red-600 mb-1 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />위험 구역
          </h2>
          <p className="text-xs text-[#6B6B6B] mb-4">
            계정을 탈퇴하면 모든 데이터가 삭제되며 복구할 수 없습니다.
          </p>

          {!showDeleteSection ? (
            <button
              onClick={() => setShowDeleteSection(true)}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              계정 탈퇴
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#0F0F0F]">
                계속하려면 회사명 <span className="font-semibold">"{companyName}"</span>을 아래에 입력하세요.
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
                  취소
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="text-sm font-semibold px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  탈퇴 요청
                </button>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
