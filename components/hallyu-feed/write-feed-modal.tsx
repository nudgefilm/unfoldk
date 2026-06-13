"use client"

import { useState, useRef } from "react"
import { X, Loader2, ImagePlus, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

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
  const [imageFile, setImageFile]   = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.")
      if (fileRef.current) fileRef.current.value = ""
      return
    }
    setError(null)
    setImageFile(file)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      let uploadedImageUrl: string | undefined
      if (imageFile) {
        const supabase = createSupabaseBrowserClient()
        const ext = imageFile.name.split(".").pop() ?? "jpg"
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("community-feed-images")
          .upload(path, imageFile, { contentType: imageFile.type, upsert: false })
        if (uploadError) {
          setError("Image upload failed. Please try again.")
          return
        }
        const { data: { publicUrl } } = supabase.storage.from("community-feed-images").getPublicUrl(path)
        uploadedImageUrl = publicUrl
      }

      const res = await fetch("/api/community-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:          title.trim(),
          content:        content.trim(),
          artist_keyword: keyword.trim() || undefined,
          image_url:      uploadedImageUrl,
        }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error === "unauthenticated" ? "Please sign in to post." : "Failed to post. Please try again.")
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
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

          {/* 이미지 업로드 */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Image{" "}
              <span className="text-muted-foreground/50">(optional · jpg, png, webp · max 5MB)</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageSelect}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border border-border/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="preview" className="w-full max-h-48 object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed border-border/40 text-sm text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                Add image
              </button>
            )}
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
