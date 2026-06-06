"use client"

import { useState } from "react"
import { Star, X } from "lucide-react"
import { toast } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

interface Props {
  open: boolean
  onClose: () => void
  supplierId: string
  supplierName: string
  reviewerType: "buyer" | "seller"
  referenceType: "match" | "sample" | "sourcing"
  referenceId: string
  onSuccess?: () => void
}

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#0F0F0F]">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="w-7 h-7 flex items-center justify-center"
          >
            <Star
              className="w-5 h-5 transition-colors"
              fill={(hovered || value) >= star ? "#C8A882" : "none"}
              stroke={(hovered || value) >= star ? "#C8A882" : "#D1D5DB"}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export function RatingModal({
  open,
  onClose,
  supplierId,
  supplierName,
  reviewerType,
  referenceType,
  referenceId,
  onSuccess,
}: Props) {
  const supabase = createSupabaseBrowserClient()

  const [responseSpeed, setResponseSpeed] = useState(0)
  const [productQuality, setProductQuality] = useState(0)
  const [communication, setCommunication] = useState(0)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  async function handleSubmit() {
    if (!responseSpeed || !productQuality || !communication) {
      toast.error("Please rate all three categories.")
      return
    }

    setSubmitting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error("Please sign in to submit a review.")
      setSubmitting(false)
      return
    }

    const { error } = await supabase.from("beauty_ratings").insert({
      supplier_id: supplierId,
      reviewer_id: user.id,
      reviewer_type: reviewerType,
      reference_type: referenceType,
      reference_id: referenceId,
      response_speed: responseSpeed,
      product_quality: productQuality,
      communication: communication,
      comment: comment.trim() || null,
    })

    if (error) {
      if (error.code === "23505") {
        toast.error("You've already rated this experience.")
      } else {
        console.error("[RatingModal] insert error", error)
        toast.error("Something went wrong. Please try again.")
      }
    } else {
      toast.success("Thank you for your review!")
      onSuccess?.()
      onClose()
    }

    setSubmitting(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={() => {
        if (!submitting) onClose()
      }}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-[#0F0F0F]">Rate Supplier</h3>
            <p className="text-sm text-[#6B6B6B] mt-0.5">{supplierName}</p>
          </div>
          <button
            onClick={() => {
              if (!submitting) onClose()
            }}
            className="text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 mb-5">
          <StarRow label="Response Speed" value={responseSpeed} onChange={setResponseSpeed} />
          <StarRow label="Product Quality" value={productQuality} onChange={setProductQuality} />
          <StarRow label="Communication" value={communication} onChange={setCommunication} />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-[#0F0F0F] mb-1.5">
            Comment{" "}
            <span className="text-[#6B6B6B] font-normal">(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Share your experience with this supplier..."
            className="w-full border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#1A3A5C] transition-colors placeholder:text-[#9CA3AF]"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              if (!submitting) onClose()
            }}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#E8E2DA] text-sm font-medium text-[#6B6B6B] hover:bg-[#F8F7F5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "#1A3A5C" }}
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  )
}
