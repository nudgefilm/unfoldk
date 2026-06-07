"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

interface AdSlot {
  id: string
  slot_name: string
  location_description: string
  monthly_price: number
  max_capacity: number
}

interface Props {
  userType: "supplier" | "buyer" | "seller"
  onClose: () => void
}

export function AdRequestForm({ userType, onClose }: Props) {
  const isKorean = userType === "supplier"
  const supabase = createSupabaseBrowserClient()

  const [slots, setSlots] = useState<AdSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase
      .from("beauty_ad_slots")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => setSlots((data ?? []) as AdSlot[]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedSlotData = slots.find((s) => s.id === selectedSlot)

  function getMinEndDate() {
    if (!startDate) return new Date().toISOString().split("T")[0]
    const d = new Date(startDate)
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().split("T")[0]
  }

  function calcCost() {
    if (!selectedSlotData || !startDate || !endDate) return null
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffDays = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const months = Math.max(1, Math.ceil(diffDays / 30))
    return months * selectedSlotData.monthly_price
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSlot || !title.trim() || !linkUrl.trim()) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error(isKorean ? "로그인이 필요합니다." : "Login required.")
      setSubmitting(false)
      return
    }

    const slot = slots.find((s) => s.id === selectedSlot)
    if (!slot) { setSubmitting(false); return }

    const { error } = await supabase.from("beauty_ads").insert({
      slot_id: selectedSlot,
      advertiser_id: user.id,
      advertiser_type: userType,
      title: title.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      link_url: linkUrl.trim(),
      start_date: startDate || null,
      end_date: endDate || null,
      monthly_price: slot.monthly_price,
      status: "pending",
    })

    if (error) {
      toast.error(isKorean ? "신청 중 오류가 발생했습니다." : "An error occurred. Please try again.")
      setSubmitting(false)
      return
    }

    toast.success(
      isKorean
        ? "광고 신청이 접수됐습니다. 관리자 승인 후 집행됩니다."
        : "Your ad request has been submitted. It will go live after admin approval."
    )
    onClose()
  }

  const cost = calcCost()
  const todayStr = new Date().toISOString().split("T")[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: '"Pretendard Variable", Pretendard, -apple-system, sans-serif' }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E8E2DA]">
          <h2 className="text-base font-bold text-[#0F0F0F]">
            {isKorean ? "광고 신청" : "Advertise on UnfoldK Beauty"}
          </h2>
          <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* 슬롯 선택 */}
          <div>
            <label className="block text-xs font-semibold text-[#0F0F0F] mb-1.5">
              {isKorean ? "광고 슬롯" : "Ad Placement"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              required
              className="w-full border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm text-[#0F0F0F] focus:outline-none focus:ring-1 focus:ring-[#1A3A5C] bg-white"
            >
              <option value="">{isKorean ? "슬롯 선택" : "Select a placement"}</option>
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.slot_name} — ${slot.monthly_price}/mo
                </option>
              ))}
            </select>
            {selectedSlotData && (
              <p className="text-xs text-[#6B6B6B] mt-1">{selectedSlotData.location_description}</p>
            )}
          </div>

          {/* 광고 제목 */}
          <div>
            <label className="block text-xs font-semibold text-[#0F0F0F] mb-1.5">
              {isKorean ? "광고 제목" : "Ad Title"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={80}
              placeholder={isKorean ? "광고 제목을 입력하세요" : "Enter a concise ad title"}
              className="w-full border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm text-[#0F0F0F] focus:outline-none focus:ring-1 focus:ring-[#1A3A5C]"
            />
          </div>

          {/* 광고 설명 */}
          <div>
            <label className="block text-xs font-semibold text-[#0F0F0F] mb-1.5">
              {isKorean ? "광고 설명" : "Ad Description"}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder={isKorean ? "광고 설명 (선택)" : "Brief description (optional)"}
              className="w-full border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm text-[#0F0F0F] focus:outline-none focus:ring-1 focus:ring-[#1A3A5C] resize-none"
            />
          </div>

          {/* 이미지 URL */}
          <div>
            <label className="block text-xs font-semibold text-[#0F0F0F] mb-1.5">
              {isKorean ? "이미지 URL" : "Image URL"}
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm text-[#0F0F0F] focus:outline-none focus:ring-1 focus:ring-[#1A3A5C]"
            />
          </div>

          {/* 랜딩 URL */}
          <div>
            <label className="block text-xs font-semibold text-[#0F0F0F] mb-1.5">
              {isKorean ? "랜딩 URL" : "Landing URL"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              required
              placeholder="https://your-website.com"
              className="w-full border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm text-[#0F0F0F] focus:outline-none focus:ring-1 focus:ring-[#1A3A5C]"
            />
          </div>

          {/* 집행 기간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F0F0F] mb-1.5">
                {isKorean ? "집행 시작일" : "Start Date"}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={todayStr}
                className="w-full border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm text-[#0F0F0F] focus:outline-none focus:ring-1 focus:ring-[#1A3A5C]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F0F0F] mb-1.5">
                {isKorean ? "집행 종료일" : "End Date"}
                <span className="text-[#6B6B6B] font-normal ml-1">
                  ({isKorean ? "최소 1개월" : "min. 1 month"})
                </span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={getMinEndDate()}
                className="w-full border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm text-[#0F0F0F] focus:outline-none focus:ring-1 focus:ring-[#1A3A5C]"
              />
            </div>
          </div>

          {/* 예상 비용 */}
          {cost !== null && (
            <div className="bg-[#F8F7F5] border border-[#E8E2DA] rounded-lg px-4 py-3">
              <p className="text-xs text-[#6B6B6B]">
                {isKorean ? "예상 비용" : "Estimated Cost"}
              </p>
              <p className="text-xl font-bold text-[#0F0F0F] mt-0.5">${cost.toLocaleString()}</p>
              <p className="text-xs text-[#6B6B6B] mt-0.5">
                {isKorean
                  ? "결제는 관리자 승인 후 별도 안내됩니다."
                  : "Payment details will be provided after admin approval."}
              </p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-[#E8E2DA] rounded-xl text-sm font-medium text-[#6B6B6B] hover:bg-[#F8F7F5] transition-colors"
            >
              {isKorean ? "취소" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#1A3A5C" }}
            >
              {submitting
                ? (isKorean ? "신청 중..." : "Submitting...")
                : (isKorean ? "광고 신청하기" : "Submit Ad Request")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
