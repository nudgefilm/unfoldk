"use client"

// 공통 Contact 폼 — /contact 페이지 + About Educational Access 모달 등 다중 컨텍스트 재사용.
// POST /api/contact → Resend 로 support@unfoldk.com 에 발송 (기존 endpoint 그대로).
// honeypot 필드 `website` 로 단순 봇 차단.

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle2 } from "lucide-react"

interface FormState {
  name: string
  email: string
  subject: string
  message: string
  website: string // honeypot
}

const EMPTY: FormState = {
  name: "",
  email: "",
  subject: "",
  message: "",
  website: "",
}

export function ContactForm({
  defaultSubject,
  hideOuterCard = false,
  onSuccess,
}: {
  defaultSubject?: string
  hideOuterCard?: boolean
  onSuccess?: () => void
}) {
  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    subject: defaultSubject ?? "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg("")

    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setErrorMsg("All fields are required.")
      return
    }
    if (form.message.trim().length < 10) {
      setErrorMsg("Message must be at least 10 characters.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown }
        const errorText =
          typeof data.error === "string"
            ? data.error
            : "Failed to send. Please email support@unfoldk.com directly."
        setErrorMsg(errorText)
        setIsSubmitting(false)
        return
      }
      setSent(true)
      setForm({ ...EMPTY, subject: defaultSubject ?? "" })
      onSuccess?.()
    } catch (err) {
      console.error("[contact-form] 제출 예외:", err)
      setErrorMsg("Network error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sent) {
    const successInner = (
      <>
        <CheckCircle2
          className="w-12 h-12 mx-auto mb-4"
          style={{ color: "#22c55e" }}
        />
        <p className="text-foreground font-semibold text-lg mb-2">Message sent.</p>
        <p className="text-muted-foreground text-sm mb-6">
          Thanks for reaching out — we&apos;ll get back to you shortly.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-sm font-medium hover:underline"
          style={{ color: "#FF4B6E" }}
        >
          Send another →
        </button>
      </>
    )
    return hideOuterCard ? (
      <div className="text-center py-6">{successInner}</div>
    ) : (
      <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center">
        {successInner}
      </div>
    )
  }

  const formInner = (
    <>
      {/* honeypot — hidden 필드. 사람은 못 채우고 봇은 모든 input 채우는 패턴 차단. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
        name="website"
        style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px" }}
        aria-hidden="true"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-muted-foreground text-xs mb-1 block">
            Name <span style={{ color: "#FF4B6E" }}>*</span>
          </label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Your name"
            maxLength={100}
            className="h-11 bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="text-muted-foreground text-xs mb-1 block">
            Email <span style={{ color: "#FF4B6E" }}>*</span>
          </label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@example.com"
            maxLength={200}
            className="h-11 bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div>
        <label className="text-muted-foreground text-xs mb-1 block">
          Subject <span style={{ color: "#FF4B6E" }}>*</span>
        </label>
        <Input
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          placeholder="What's this about?"
          maxLength={200}
          className="h-11 bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div>
        <label className="text-muted-foreground text-xs mb-1 block">
          Message <span style={{ color: "#FF4B6E" }}>*</span>
        </label>
        <Textarea
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          placeholder="Tell us more — at least 10 characters."
          maxLength={5000}
          className="bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground min-h-[160px] resize-y"
        />
        <p className="text-muted-foreground/70 text-xs mt-1 text-right">
          {form.message.length}/5000
        </p>
      </div>

      {errorMsg && (
        <p className="text-sm" style={{ color: "#FF4B6E" }}>
          {errorMsg}
        </p>
      )}

      <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-muted-foreground/70 text-xs">
          Or email us directly at{" "}
          <a
            href="mailto:support@unfoldk.com"
            className="hover:underline"
            style={{ color: "#FF4B6E" }}
          >
            support@unfoldk.com
          </a>
        </p>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full font-medium text-white px-8 h-11"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          {isSubmitting ? "Sending..." : "Send message"}
        </Button>
      </div>
    </>
  )

  return hideOuterCard ? (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formInner}
    </form>
  ) : (
    <form
      onSubmit={handleSubmit}
      className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 md:p-8 space-y-4"
    >
      {formInner}
    </form>
  )
}
