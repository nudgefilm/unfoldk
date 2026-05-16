"use client"

// Early Access — 이메일 알림 신청 폼 (재사용).
// 사용처: RoadmapModal / ComingSoonBanner (서비스 페이지 상단).
//
// POST /api/early-access/notify { email, services? }
// 성공 시 inline "We'll keep you posted" 상태로 전환 (모달·배너 닫지 않음).

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, Send } from "lucide-react"

interface Props {
  // 알림 신청 시 함께 보낼 관심 서비스 (선택). 미지정 시 전체로 간주.
  services?: string[]
  // 소스 라벨 — 어드민 알림 이메일 식별용 (예: "roadmap-modal", "drama-page").
  source: string
  // 폼 크기 — sm = 인라인 한 줄, md = 모달 내부 큰 폼.
  size?: "sm" | "md"
}

export function EmailSignupForm({ services, source, size = "md" }: Props) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/early-access/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, services: services ?? [], source }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? "Couldn't sign you up — try again.")
        return
      }
      setSuccess(true)
    } catch (err) {
      console.error("[early-access/notify] 요청 실패:", err)
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div
        className={`flex items-center gap-2 rounded-full px-4 ${
          size === "sm" ? "h-10 text-sm" : "h-11"
        }`}
        style={{ backgroundColor: "rgba(34, 197, 94, 0.12)", color: "#22c55e" }}
      >
        <CheckCircle2 className="w-4 h-4" />
        <span className="font-medium">You&apos;re on the list — we&apos;ll email you.</span>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={size === "sm" ? "flex flex-col sm:flex-row gap-2" : "flex flex-col sm:flex-row gap-2"}
    >
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        disabled={loading}
        maxLength={200}
        className={`flex-1 bg-[#0d0d0f] border-[#2a2a2a] rounded-full px-4 text-foreground placeholder:text-muted-foreground ${
          size === "sm" ? "h-10" : "h-11"
        }`}
      />
      <Button
        type="submit"
        disabled={loading || email.trim().length === 0}
        className={`rounded-full font-medium text-white px-5 whitespace-nowrap ${
          size === "sm" ? "h-10" : "h-11"
        }`}
        style={{ backgroundColor: "#FF4B6E" }}
      >
        <Send className="w-4 h-4 mr-1.5" />
        {loading ? "Sending..." : "Notify me"}
      </Button>
      {error && (
        <p className="text-xs basis-full" style={{ color: "#FF4B6E" }}>
          {error}
        </p>
      )}
    </form>
  )
}
