"use client"

import { useEffect, useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

interface DramaItem {
  id: string
  drama_title: string
  drama_title_ko: string | null
  name: string
  name_ko: string | null
  category: "fashion" | "beauty" | "lifestyle"
  brand: string | null
  description: string | null
  description_ko: string | null
  purchase_url: string | null
  is_approved: boolean
  created_at: string
}

const CATEGORY_KO: Record<string, string> = {
  fashion: "패션",
  beauty: "뷰티",
  lifestyle: "라이프스타일",
}

const CATEGORY_COLOR: Record<string, string> = {
  fashion: "#FF4B6E",
  beauty: "#a78bfa",
  lifestyle: "#22d3ee",
}

export default function DramaItemsAdminPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<DramaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending")
  const [page, setPage] = useState(1)
  const [urlDraft, setUrlDraft] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  const PAGE_SIZE = 20

  useEffect(() => {
    setLoading(true)
    fetch("/api/admin/drama-items")
      .then((r) => r.json())
      .then((body: { items: DramaItem[] }) => setItems(body.items ?? []))
      .catch((err) => console.error("[drama-items] fetch 실패:", err))
      .finally(() => setLoading(false))
  }, [])

  const filtered = items.filter((it) => {
    if (filter === "pending") return !it.is_approved
    if (filter === "approved") return it.is_approved
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  async function patch(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/admin/drama-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast({ title: "변경 실패", description: String(body.error ?? "오류") })
      return false
    }
    return true
  }

  function onApprove(id: string) {
    startTransition(async () => {
      const ok = await patch(id, { is_approved: true })
      if (ok) {
        setItems((prev) => prev.map((it) => it.id === id ? { ...it, is_approved: true } : it))
        toast({ title: "승인 완료" })
      }
    })
  }

  function onReject(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/drama-items/${id}`, { method: "DELETE" })
      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.id !== id))
        toast({ title: "삭제 완료" })
      } else {
        toast({ title: "삭제 실패" })
      }
    })
  }

  function onSaveUrl(id: string) {
    const url = (urlDraft[id] ?? "").trim() || null
    startTransition(async () => {
      const ok = await patch(id, { purchase_url: url })
      if (ok) {
        setItems((prev) => prev.map((it) => it.id === id ? { ...it, purchase_url: url } : it))
        toast({ title: "링크 저장 완료" })
      }
    })
  }

  const pendingCount = items.filter((it) => !it.is_approved).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">Shop this drama — 아이템 검수</h1>
        <p className="text-muted-foreground text-sm">
          미승인 {pendingCount}건 · 전체 {items.length}건
        </p>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2">
        {(["pending", "approved", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setFilter(f); setPage(1) }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === f
                ? "text-white border-[#FF4B6E]"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
            style={filter === f ? { backgroundColor: "#FF4B6E" } : undefined}
          >
            {f === "pending" ? `미승인 (${pendingCount})` : f === "approved" ? "승인됨" : "전체"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">로딩 중...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">항목 없음</p>
      ) : (
        <div className="space-y-3">
          {paged.map((item) => (
            <div
              key={item.id}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                      style={{ color: CATEGORY_COLOR[item.category], background: `${CATEGORY_COLOR[item.category]}20` }}
                    >
                      {item.category}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {item.drama_title}
                      {item.drama_title_ko && (
                        <span className="ml-1 text-muted-foreground/60">({item.drama_title_ko})</span>
                      )}
                    </span>
                    {item.is_approved && (
                      <span className="text-[10px] text-green-400 border border-green-400/30 px-1.5 py-0.5 rounded">승인됨</span>
                    )}
                  </div>
                  <p className="text-foreground font-medium">
                    {item.name}
                    {item.name_ko && (
                      <span className="ml-1.5 text-muted-foreground font-normal text-sm">({item.name_ko})</span>
                    )}
                  </p>
                  {item.brand && <p className="text-muted-foreground text-sm">{item.brand}</p>}
                  {item.description && (
                    <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{item.description}</p>
                  )}
                  {item.description_ko && (
                    <p className="text-muted-foreground/70 text-xs mt-0.5 leading-relaxed">{item.description_ko}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {!item.is_approved && (
                    <Button size="sm" onClick={() => onApprove(item.id)}
                      className="text-white h-8 px-3"
                      style={{ backgroundColor: "#22c55e" }}>
                      승인
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => onReject(item.id)}
                    className="h-8 px-3 border-red-500/40 text-red-400 hover:bg-red-500/10">
                    삭제
                  </Button>
                </div>
              </div>

              {/* 구매 링크 입력 */}
              <div className="flex gap-2">
                <Input
                  placeholder="구매 링크 입력 (선택)"
                  value={urlDraft[item.id] ?? item.purchase_url ?? ""}
                  onChange={(e) => setUrlDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  className="h-8 text-sm bg-[#0d0d0f] border-[#2a2a2a] flex-1"
                />
                <Button size="sm" variant="outline" onClick={() => onSaveUrl(item.id)}
                  className="h-8 px-3">
                  저장
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <p className="text-muted-foreground text-sm">
            {((safePage - 1) * PAGE_SIZE + 1)}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length}건
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                safePage <= 1
                  ? "border-border/20 text-muted-foreground/40 cursor-not-allowed"
                  : "border-border/40 text-foreground hover:bg-secondary/50"
              }`}
            >
              이전
            </button>
            <span className="text-sm text-muted-foreground px-1">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                safePage >= totalPages
                  ? "border-border/20 text-muted-foreground/40 cursor-not-allowed"
                  : "border-border/40 text-foreground hover:bg-secondary/50"
              }`}
            >
              다음
            </button>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  )
}
