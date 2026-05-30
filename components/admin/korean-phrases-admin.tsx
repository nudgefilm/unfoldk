"use client"

import { useRef, useState, useMemo } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Search, ImageIcon, Upload, X, ChevronLeft, ChevronRight } from "lucide-react"

export interface KoreanPhraseAdminRow {
  id: string
  korean: string
  english: string
  drama_name: string | null
  difficulty: string | null
  image_url: string | null
  scene_description: string | null
  featured_date: string | null
  created_at: string
}

const PAGE_SIZE = 100

interface RowState {
  imageUrl: string
  uploading: boolean
}

export function KoreanPhrasesAdmin({ rows }: { rows: KoreanPhraseAdminRow[] }) {
  const { toast } = useToast()
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [rowState, setRowState] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {}
    for (const r of rows) {
      init[r.id] = { imageUrl: r.image_url ?? "", uploading: false }
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleQueryChange(v: string) {
    setQuery(v)
    setPage(0)
  }

  async function handleFileChange(id: string, file: File | undefined) {
    if (!file) return
    setRowState((prev) => ({ ...prev, [id]: { ...prev[id], uploading: true } }))
    const form = new FormData()
    form.append("file", file)
    try {
      const res = await fetch(`/api/admin/korean/phrases/${id}/image`, { method: "POST", body: form })
      const json = await res.json() as { ok?: boolean; image_url?: string; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error ?? "업로드 실패")
      setRowState((prev) => ({ ...prev, [id]: { imageUrl: json.image_url ?? "", uploading: false } }))
      toast({ description: "이미지 업로드 완료" })
    } catch (e) {
      setRowState((prev) => ({ ...prev, [id]: { ...prev[id], uploading: false } }))
      toast({ description: `업로드 실패: ${String(e)}`, variant: "destructive" })
    }
    const input = fileInputRefs.current[id]
    if (input) input.value = ""
  }

  async function removeImage(id: string) {
    setRowState((prev) => ({ ...prev, [id]: { ...prev[id], uploading: true } }))
    try {
      const res = await fetch(`/api/admin/korean/phrases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: null }),
      })
      if (!res.ok) throw new Error(await res.text())
      setRowState((prev) => ({ ...prev, [id]: { imageUrl: "", uploading: false } }))
      toast({ description: "이미지 삭제됨" })
    } catch (e) {
      setRowState((prev) => ({ ...prev, [id]: { ...prev[id], uploading: false } }))
      toast({ description: `삭제 실패: ${String(e)}`, variant: "destructive" })
    }
  }

  const withImage = rows.filter((r) => r.image_url).length

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        전체 {rows.length}건 · 이미지 있음 {withImage}건 · 없음 {rows.length - withImage}건
      </p>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="한국어 표현 / 영어 / 드라마명 검색"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="pl-9 bg-[#1a1a1a] border-border/30"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {query ? `검색 결과 ${filtered.length}건` : `전체 ${filtered.length}건`}
          {totalPages > 1 && ` · ${page + 1}/${totalPages} 페이지`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="h-7 px-2">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-1">{page + 1} / {totalPages}</span>
            <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="h-7 px-2">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {pageRows.map((row) => {
          const state = rowState[row.id] ?? { imageUrl: "", uploading: false }
          return (
            <div key={row.id} className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 flex gap-4 items-center">
              <div className="flex-shrink-0 w-24 h-14 rounded-lg overflow-hidden bg-[#252528] flex items-center justify-center">
                {state.imageUrl ? (
                  <Image src={state.imageUrl} alt={row.korean} width={96} height={54} className="w-full h-full object-cover" unoptimized />
                ) : (
                  <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-foreground font-medium text-sm">{row.korean}</span>
                  <span className="text-muted-foreground text-xs">{row.english}</span>
                  {row.drama_name && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[#252528] text-muted-foreground">{row.drama_name}</span>
                  )}
                  {row.difficulty && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[#252528] text-muted-foreground capitalize">{row.difficulty}</span>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center gap-2">
                {state.imageUrl && (
                  <Button size="sm" variant="ghost" onClick={() => removeImage(row.id)} disabled={state.uploading} className="h-8 px-2 text-muted-foreground hover:text-red-400" title="이미지 삭제">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
                <input ref={(el) => { fileInputRefs.current[row.id] = el }} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFileChange(row.id, e.target.files?.[0])} />
                <Button size="sm" onClick={() => fileInputRefs.current[row.id]?.click()} disabled={state.uploading} className="h-8 px-3 text-white text-xs" style={{ backgroundColor: "#FF4B6E" }}>
                  {state.uploading ? "업로드 중..." : (<><Upload className="w-3.5 h-3.5 mr-1" />{state.imageUrl ? "교체" : "업로드"}</>)}
                </Button>
              </div>
            </div>
          )
        })}

        {pageRows.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            {query ? "검색 결과가 없습니다." : "등록된 표현이 없습니다."}
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="h-7 px-2">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="h-7 px-2">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
