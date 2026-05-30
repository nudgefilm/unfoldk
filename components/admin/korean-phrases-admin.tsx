"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Search, ImageIcon, Check, X } from "lucide-react"

export interface KoreanPhraseAdminRow {
  id: string
  korean: string
  english: string
  drama_name: string | null
  difficulty: string | null
  image_url: string | null
  featured_date: string | null
}

interface RowState {
  imageUrl: string
  saving: boolean
  saved: boolean
}

export function KoreanPhrasesAdmin({ rows }: { rows: KoreanPhraseAdminRow[] }) {
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [rowState, setRowState] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {}
    for (const r of rows) {
      init[r.id] = { imageUrl: r.image_url ?? "", saving: false, saved: false }
    }
    return init
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.korean.toLowerCase().includes(q) ||
        r.english.toLowerCase().includes(q) ||
        (r.drama_name ?? "").toLowerCase().includes(q)
    )
  }, [rows, query])

  function setUrl(id: string, value: string) {
    setRowState((prev) => ({ ...prev, [id]: { ...prev[id], imageUrl: value, saved: false } }))
  }

  async function save(id: string) {
    const url = rowState[id]?.imageUrl ?? ""
    setRowState((prev) => ({ ...prev, [id]: { ...prev[id], saving: true } }))
    try {
      const res = await fetch(`/api/admin/korean/phrases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: url.trim() || null }),
      })
      if (!res.ok) throw new Error(await res.text())
      setRowState((prev) => ({ ...prev, [id]: { ...prev[id], saving: false, saved: true } }))
      toast({ description: "이미지 URL 저장됨" })
    } catch (e) {
      setRowState((prev) => ({ ...prev, [id]: { ...prev[id], saving: false } }))
      toast({ description: `저장 실패: ${String(e)}`, variant: "destructive" })
    }
  }

  const withImage = rows.filter((r) => r.image_url).length

  return (
    <div className="space-y-6">
      {/* 통계 */}
      <p className="text-muted-foreground text-sm">
        전체 {rows.length}건 · 이미지 있음 {withImage}건 · 없음 {rows.length - withImage}건
      </p>

      {/* 검색 */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="한국어 표현 / 영어 / 드라마명 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-[#1a1a1a] border-border/30"
        />
      </div>

      {/* 결과 */}
      <p className="text-xs text-muted-foreground">
        {query ? `검색 결과 ${filtered.length}건` : `전체 ${filtered.length}건`}
      </p>

      <div className="space-y-3">
        {filtered.map((row) => {
          const state = rowState[row.id] ?? { imageUrl: "", saving: false, saved: false }
          return (
            <div
              key={row.id}
              className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 flex gap-4 items-start"
            >
              {/* 이미지 미리보기 */}
              <div className="flex-shrink-0 w-24 h-14 rounded-lg overflow-hidden bg-[#252528] flex items-center justify-center">
                {state.imageUrl ? (
                  <Image
                    src={state.imageUrl}
                    alt={row.korean}
                    width={96}
                    height={54}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                )}
              </div>

              {/* 표현 정보 + 입력 */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-foreground font-medium">{row.korean}</span>
                  <span className="text-muted-foreground text-sm">{row.english}</span>
                  {row.drama_name && (
                    <span className="text-xs px-2 py-0.5 rounded bg-[#252528] text-muted-foreground">
                      {row.drama_name}
                    </span>
                  )}
                  {row.difficulty && (
                    <span className="text-xs px-2 py-0.5 rounded bg-[#252528] text-muted-foreground capitalize">
                      {row.difficulty}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="이미지 URL (https://...)"
                    value={state.imageUrl}
                    onChange={(e) => setUrl(row.id, e.target.value)}
                    className="bg-[#141416] border-border/20 text-sm h-8"
                  />
                  <Button
                    size="sm"
                    onClick={() => save(row.id)}
                    disabled={state.saving}
                    className="h-8 px-3 text-white flex-shrink-0"
                    style={{ backgroundColor: state.saved ? "#22c55e" : "#FF4B6E" }}
                  >
                    {state.saved ? <Check className="w-3.5 h-3.5" /> : state.saving ? "저장 중..." : "저장"}
                  </Button>
                  {state.imageUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setUrl(row.id, "")}
                      className="h-8 px-2 text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            검색 결과가 없습니다.
          </p>
        )}
      </div>
    </div>
  )
}
