"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WriteFeedModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function WriteFeedModal({ onClose, onSuccess }: WriteFeedModalProps) {
  const [title, setTitle]           = useState("")
  const [content, setContent]       = useState("")
  const [keyword, setKeyword]       = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/community-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), artist_keyword: keyword.trim() || undefined }),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error === "pro_required" ? "Hallyu Pass is required to post." : "Failed to post. Please try again.")
        return
      }
      onSuccess()
      onClose()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#141418] border border-border/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
          <h2 className="text-foreground font-semibold text-base">Write a Feed</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 제목 */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Title <span className="text-[#FF4B6E]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Why BLACKPINK's comeback is a global moment"
              className="w-full bg-[#0d0d0f] border border-border/30 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#FF4B6E]/60 transition-colors"
              required
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Content <span className="text-[#FF4B6E]">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Share your thoughts, reviews, travel experiences..."
              className="w-full bg-[#0d0d0f] border border-border/30 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#FF4B6E]/60 transition-colors resize-none"
              required
            />
            <p className="text-[11px] text-muted-foreground/60 mt-1 text-right">{content.length} / 2000</p>
          </div>

          {/* 아티스트 키워드 */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Artist / Keyword <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              maxLength={100}
              placeholder="e.g. BTS, Squid Game, Korean skincare"
              className="w-full bg-[#0d0d0f] border border-border/30 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#FF4B6E]/60 transition-colors"
            />
          </div>

          {error && (
            <p className="text-[#FF4B6E] text-xs">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-border/40 text-muted-foreground hover:text-foreground"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim() || !content.trim()}
              className="flex-1 text-white"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
