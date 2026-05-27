"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

type ImageSource = "mfds" | "unsplash" | "upload" | "manual" | null

export interface ReviewRow {
  id: string
  title: string
  title_en: string | null
  image_url: string | null
  image_source: ImageSource
}

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"])

export function FoodImageReview({ initialRecipes }: { initialRecipes: ReviewRow[] }) {
  const { toast } = useToast()
  const [recipes, setRecipes] = useState<ReviewRow[]>(initialRecipes)
  const [editingId, setEditingId] = useState<string | null>(null)

  const editing = editingId ? (recipes.find((r) => r.id === editingId) ?? null) : null

  const handleSaved = (id: string, image_url: string | null, image_source: ImageSource) => {
    if (image_source === "upload" || image_source === "manual") {
      // 검수 완료 → 목록에서 제거
      setRecipes((prev) => prev.filter((r) => r.id !== id))
    } else {
      setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, image_url, image_source } : r)))
    }
    setEditingId(null)
    toast({ title: "저장 완료" })
  }

  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
        <p className="text-lg font-medium text-foreground">검수 완료</p>
        <p className="text-sm mt-1">검수할 이미지가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        검수 대상{" "}
        <span className="text-foreground font-medium">{recipes.length}건</span>
        <span className="ml-2 text-xs">(mfds · unsplash · 이미지 없음)</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((r) => (
          <RecipeCard key={r.id} row={r} onEdit={() => setEditingId(r.id)} />
        ))}
      </div>

      <ReviewDialog
        row={editing}
        onClose={() => setEditingId(null)}
        onSaved={handleSaved}
        onError={(msg) => toast({ title: "저장 실패", description: msg })}
      />
    </div>
  )
}

function RecipeCard({ row, onEdit }: { row: ReviewRow; onEdit: () => void }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden flex flex-col">
      {row.image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={row.image_url}
          alt={row.title}
          referrerPolicy="no-referrer"
          className="w-full aspect-video object-cover bg-[#0d0d0f]"
        />
      ) : (
        <div className="w-full aspect-video bg-[#0d0d0f] flex items-center justify-center text-muted-foreground text-xs">
          이미지 없음
        </div>
      )}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{row.title}</p>
        {row.title_en && (
          <p className="text-xs text-muted-foreground line-clamp-1">{row.title_en}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-1.5">
          <SourceBadge source={row.image_source} />
          <Button
            type="button"
            size="sm"
            onClick={onEdit}
            className="h-7 px-3 text-xs rounded-full font-medium text-white"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            검수
          </Button>
        </div>
      </div>
    </div>
  )
}

function SourceBadge({ source }: { source: ImageSource }) {
  if (!source) {
    return <span className="text-[10px] text-muted-foreground">이미지 없음</span>
  }
  const styles: Record<NonNullable<ImageSource>, string> = {
    mfds: "bg-blue-500/15 text-blue-400",
    unsplash: "bg-purple-500/15 text-purple-400",
    upload: "bg-emerald-500/15 text-emerald-400",
    manual: "bg-amber-500/15 text-amber-400",
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${styles[source]}`}>
      {source}
    </span>
  )
}

function ReviewDialog({
  row,
  onClose,
  onSaved,
  onError,
}: {
  row: ReviewRow | null
  onClose: () => void
  onSaved: (id: string, image_url: string | null, image_source: ImageSource) => void
  onError: (msg: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [urlInput, setUrlInput] = useState("")
  const [saving, setSaving] = useState(false)

  const open = row !== null
  const dialogKey = row?.id ?? "none"

  const handleFileSave = async () => {
    if (!row || !file) return
    if (file.size > MAX_BYTES) { onError("파일 크기는 5MB 이하여야 합니다."); return }
    if (!ALLOWED_MIME.has(file.type)) { onError("JPG / PNG / WEBP 만 업로드 가능합니다."); return }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/admin/food/${row.id}/image`, { method: "POST", body: formData })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "업로드 실패")
      if (typeof json.image_url !== "string") throw new Error("응답 image_url 누락")
      onSaved(row.id, json.image_url, "upload")
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleUrlSave = async () => {
    if (!row) return
    const trimmed = urlInput.trim()
    if (!trimmed) { onError("URL 을 입력하세요."); return }
    if (!/^https?:\/\//i.test(trimmed)) {
      onError("URL 은 http:// 또는 https:// 로 시작해야 합니다.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/food/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: trimmed, image_source: "manual" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "PATCH 실패")
      onSaved(row.id, trimmed, "manual")
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setFile(null)
          setUrlInput("")
          onClose()
        }
      }}
      key={dialogKey}
    >
      <DialogContent className="bg-[#141418] border-[#2a2a2a] text-foreground max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold leading-tight">
            {row?.title ?? "Recipe"}
          </DialogTitle>
          {row?.title_en && (
            <p className="text-muted-foreground text-sm">{row.title_en}</p>
          )}
        </DialogHeader>

        {row?.image_url && (
          <div className="mb-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">현재 이미지</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.image_url}
              alt={row.title}
              referrerPolicy="no-referrer"
              className="w-full aspect-video object-cover rounded border border-[#2a2a2a] bg-[#0d0d0f]"
            />
          </div>
        )}

        <section className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            파일 업로드 (JPG / PNG / WEBP · 5MB)
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#252525] file:text-foreground hover:file:bg-[#2f2f2f]"
          />
          <Button
            type="button"
            onClick={handleFileSave}
            disabled={!file || saving}
            className="rounded-full font-medium text-white"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            {saving ? "Saving…" : "Upload & save"}
          </Button>
        </section>

        <section className="space-y-2 pt-3 border-t border-[#2a2a2a]">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">URL 직접 입력</p>
          <Input
            type="url"
            placeholder="https://..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="bg-[#0d0d0f] border-[#2a2a2a]"
            maxLength={2000}
          />
          <Button
            type="button"
            onClick={handleUrlSave}
            disabled={!urlInput.trim() || saving}
            variant="outline"
            className="bg-transparent border-[#3a3a3a] text-foreground hover:bg-[#252525]"
          >
            Save URL
          </Button>
        </section>
      </DialogContent>
    </Dialog>
  )
}
