"use client"

import { useMemo, useState } from "react"
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

export interface FoodAdminRow {
  id: string
  mafra_rcp_seq: string | null
  title: string
  title_en: string | null
  image_url: string | null
  image_source: ImageSource
}

type Filter = "all" | "with" | "without"
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"])

export function FoodAdminTable({ rows: initial }: { rows: FoodAdminRow[] }) {
  const { toast } = useToast()
  const [rows, setRows] = useState<FoodAdminRow[]>(initial)
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter === "with" && !r.image_url) return false
      if (filter === "without" && r.image_url) return false
      if (q.length === 0) return true
      const inKo = r.title.toLowerCase().includes(q)
      const inEn = r.title_en?.toLowerCase().includes(q) ?? false
      const inSeq = r.mafra_rcp_seq?.toLowerCase().includes(q) ?? false
      return inKo || inEn || inSeq
    })
  }, [rows, filter, search])

  const editing = editingId ? rows.find((r) => r.id === editingId) ?? null : null

  // 낙관적 업데이트 후 결과 반영
  const applyRowUpdate = (id: string, patch: Partial<FoodAdminRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const handleSaved = (id: string, image_url: string | null, image_source: ImageSource) => {
    applyRowUpdate(id, { image_url, image_source })
    setEditingId(null)
    toast({ title: "이미지 갱신 완료" })
  }

  return (
    <div className="space-y-4">
      {/* 필터 + 검색 */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="inline-flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5">
          {(
            [
              ["all", "전체"],
              ["with", "이미지 있음"],
              ["without", "이미지 없음"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-md ${
                filter === key
                  ? "bg-[#252525] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          type="search"
          placeholder="recipe_nm / title_en / mafra_rcp_seq 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm bg-[#1a1a1a] border-[#2a2a2a]"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length.toLocaleString()} / {rows.length.toLocaleString()}
        </span>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-[#2a2a2a]">
              <th className="px-4 py-3 w-16">seq</th>
              <th className="px-4 py-3 w-28">image</th>
              <th className="px-4 py-3">recipe_nm_ko</th>
              <th className="px-4 py-3">title_en</th>
              <th className="px-4 py-3 w-24">source</th>
              <th className="px-4 py-3 w-20 text-right">action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-[#2a2a2a] last:border-b-0">
                <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                  {r.mafra_rcp_seq ?? "-"}
                </td>
                <td className="px-4 py-2.5">
                  {r.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.image_url}
                      alt={r.title}
                      referrerPolicy="no-referrer"
                      className="w-24 aspect-video object-cover rounded border border-[#2a2a2a]"
                    />
                  ) : (
                    <div className="w-24 aspect-video rounded border border-dashed border-[#2a2a2a] flex items-center justify-center text-muted-foreground text-xs">
                      —
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-foreground">{r.title}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {r.title_en ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <SourceBadge source={r.image_source} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(r.id)}
                    className="h-7 px-2.5 text-xs bg-transparent border-[#3a3a3a] text-foreground hover:bg-[#252525]"
                  >
                    수정
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FoodImageEditDialog
        row={editing}
        onClose={() => setEditingId(null)}
        onSaved={handleSaved}
        onError={(msg) => toast({ title: "저장 실패", description: msg })}
      />
    </div>
  )
}

function SourceBadge({ source }: { source: ImageSource }) {
  if (!source) return <span className="text-muted-foreground text-xs">—</span>
  const colors: Record<NonNullable<ImageSource>, string> = {
    mfds: "bg-blue-500/15 text-blue-400",
    unsplash: "bg-purple-500/15 text-purple-400",
    upload: "bg-emerald-500/15 text-emerald-400",
    manual: "bg-amber-500/15 text-amber-400",
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${colors[source]}`}>
      {source}
    </span>
  )
}

function FoodImageEditDialog({
  row,
  onClose,
  onSaved,
  onError,
}: {
  row: FoodAdminRow | null
  onClose: () => void
  onSaved: (id: string, image_url: string | null, image_source: ImageSource) => void
  onError: (msg: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [urlInput, setUrlInput] = useState("")
  const [saving, setSaving] = useState(false)

  // row 변경 시 입력 리셋
  const open = row !== null
  const dialogKey = row?.id ?? "none"

  const handleFileSave = async () => {
    if (!row || !file) return
    if (file.size > MAX_BYTES) {
      onError("파일 크기는 5MB 이하여야 합니다.")
      return
    }
    if (!ALLOWED_MIME.has(file.type)) {
      onError("JPG / PNG / WEBP 만 업로드 가능합니다.")
      return
    }

    setSaving(true)
    try {
      // 서버 사이드 업로드 — service_role 로 Storage RLS 우회.
      // (browser 직접 업로드 시 is_admin(auth.uid()) RLS 평가가 fail 하던 케이스 회피)
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/admin/food/${row.id}/image`, {
        method: "POST",
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "업로드 실패")
      }
      if (typeof json.image_url !== "string") {
        throw new Error("응답 image_url 누락")
      }
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
    if (trimmed.length === 0) {
      onError("URL 을 입력하세요.")
      return
    }
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

  const handleClear = async () => {
    if (!row) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/food/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: null, image_source: null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "PATCH 실패")
      onSaved(row.id, null, null)
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

        {/* 현재 이미지 미리보기 — 16:9 비율 통일 (카드·모달과 일치) */}
        {row?.image_url && (
          <div className="mb-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              현재 이미지
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.image_url}
              alt={row.title}
              referrerPolicy="no-referrer"
              className="w-full aspect-video object-cover rounded border border-[#2a2a2a] bg-[#0d0d0f]"
            />
          </div>
        )}

        {/* 파일 업로드 */}
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

        {/* URL 직접 입력 */}
        <section className="space-y-2 pt-3 border-t border-[#2a2a2a]">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            URL 직접 입력
          </p>
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

        {/* 이미지 제거 */}
        {row?.image_url && (
          <section className="pt-3 border-t border-[#2a2a2a]">
            <Button
              type="button"
              onClick={handleClear}
              disabled={saving}
              variant="outline"
              className="bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              이미지 제거
            </Button>
          </section>
        )}
      </DialogContent>
    </Dialog>
  )
}
