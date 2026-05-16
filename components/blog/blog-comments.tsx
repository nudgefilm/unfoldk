"use client"

// 블로그 댓글 — slug 별 댓글 목록·작성·삭제.
//
// 상태:
//   - 비로그인: "Sign in to comment" + StartModal 트리거 (현재 URL ?next 으로 복귀)
//   - 로그인: 입력창 + 작성 버튼. 본인 댓글은 카드 우상단에 삭제 버튼.
// 데이터: /api/blog/[slug]/comments (GET/POST/DELETE).
//
// CLAUDE.md §7 토스트 페어 컬럼: root layout 에 Toaster 미마운트 → 페이지에서 mount.

import { useEffect, useState } from "react"
import { Trash2, MessageCircle, Send } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { StartModal } from "@/components/start-modal"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/components/ui/use-toast"

interface CommentItem {
  id: string
  content: string
  created_at: string
  updated_at: string
  user: {
    id: string
    name: string
    avatar_url: string | null
  }
}

const MAX_LEN = 1000

export function BlogComments({ slug }: { slug: string }) {
  const { toast } = useToast()
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [draft, setDraft] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signinOpen, setSigninOpen] = useState(false)
  const [signinNext, setSigninNext] = useState<string | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 마운트 시 인증 + 목록 동시 로드
  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowserClient()

    const load = async () => {
      const [{ data: userData }, listRes] = await Promise.all([
        supabase.auth.getUser(),
        fetch(`/api/blog/${slug}/comments`, { cache: "no-store" }),
      ])

      if (cancelled) return

      setCurrentUserId(userData.user?.id ?? null)
      setAuthChecked(true)

      try {
        if (listRes.ok) {
          const data = (await listRes.json()) as { comments: CommentItem[] }
          if (!cancelled) setComments(data.comments ?? [])
        }
      } catch (err) {
        console.error("[blog-comments] 목록 fetch 실패:", err)
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    if (trimmed.length > MAX_LEN) {
      toast({
        title: "Comment too long",
        description: `Max ${MAX_LEN.toLocaleString()} characters.`,
      })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/blog/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      })
      if (res.status === 401) {
        // 세션 만료 — 로그인 모달 재오픈
        openSignIn()
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown }
        const msg =
          typeof data.error === "string" ? data.error : "Failed to post comment."
        toast({ title: "Post failed", description: msg })
        return
      }
      const json = (await res.json()) as { comment: CommentItem }
      // 새 댓글을 목록 최상단에 prepend
      setComments((prev) => [json.comment, ...prev])
      setDraft("")
    } catch (err) {
      console.error("[blog-comments] POST 예외:", err)
      toast({ title: "Network error", description: "Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this comment?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/blog/${slug}/comments?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown }
        const msg =
          typeof data.error === "string" ? data.error : "Failed to delete."
        toast({ title: "Delete failed", description: msg })
        return
      }
      setComments((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      console.error("[blog-comments] DELETE 예외:", err)
      toast({ title: "Network error", description: "Please try again." })
    } finally {
      setDeletingId(null)
    }
  }

  const openSignIn = () => {
    // 현재 페이지 경로 + 댓글 영역 fragment — OAuth 완료 후 같은 위치로 복귀
    if (typeof window !== "undefined") {
      setSigninNext(window.location.pathname + "#comments")
    }
    setSigninOpen(true)
  }

  return (
    <section id="comments" className="mt-16 pt-10 border-t border-border/30">
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle className="w-5 h-5" style={{ color: "#FF4B6E" }} />
        <h2 className="text-2xl font-semibold text-white">
          Comments{" "}
          <span className="text-muted-foreground text-base font-normal">
            ({comments.length})
          </span>
        </h2>
      </div>

      {/* Composer 또는 로그인 안내 */}
      {!authChecked ? (
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-6 text-center text-muted-foreground text-sm">
          Loading...
        </div>
      ) : currentUserId ? (
        <form
          onSubmit={handleSubmit}
          className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-5 mb-8"
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share your thoughts..."
            maxLength={MAX_LEN}
            className="bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground min-h-[100px] resize-y"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-muted-foreground/70 text-xs">
              {draft.length.toLocaleString()}/{MAX_LEN.toLocaleString()}
            </p>
            <Button
              type="submit"
              disabled={isSubmitting || draft.trim().length === 0}
              className="rounded-full font-medium text-white px-5 h-10"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              {isSubmitting ? "Posting..." : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Post comment
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-8 mb-8 text-center">
          <p className="text-foreground font-medium mb-2">Sign in to join the conversation</p>
          <p className="text-muted-foreground text-sm mb-5">
            Comments are open to all logged-in UnfoldK readers.
          </p>
          <Button
            type="button"
            onClick={openSignIn}
            className="rounded-full font-medium text-white px-6"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            Sign in
          </Button>
        </div>
      )}

      {/* 목록 */}
      {listLoading ? (
        <div className="text-muted-foreground text-sm text-center py-8">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
          Be the first to comment.
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              isOwn={currentUserId === c.user.id}
              isDeleting={deletingId === c.id}
              onDelete={() => handleDelete(c.id)}
            />
          ))}
        </ul>
      )}

      {/* 모달 + 토스트 */}
      <StartModal open={signinOpen} onOpenChange={setSigninOpen} next={signinNext} />
      <Toaster />
    </section>
  )
}

function CommentCard({
  comment,
  isOwn,
  isDeleting,
  onDelete,
}: {
  comment: CommentItem
  isOwn: boolean
  isDeleting: boolean
  onDelete: () => void
}) {
  const ago = relativeTime(comment.created_at)
  const initial = comment.user.name.charAt(0).toUpperCase() || "U"

  return (
    <li className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {comment.user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.user.avatar_url}
            alt={comment.user.name}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            {initial}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-foreground font-medium text-sm">{comment.user.name}</span>
            <span className="text-muted-foreground text-xs">·</span>
            <time
              className="text-muted-foreground text-xs"
              dateTime={comment.created_at}
              title={new Date(comment.created_at).toLocaleString()}
            >
              {ago}
            </time>
          </div>
          <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        </div>

        {isOwn && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label="Delete comment"
            className="text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </li>
  )
}

// date-fns formatDistanceToNow 의 영문 결과를 그대로 사용. ISO 파싱 실패 시 그대로 노출.
function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return iso
  }
}
