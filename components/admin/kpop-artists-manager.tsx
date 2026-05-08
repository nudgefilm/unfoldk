"use client"

// 어드민 — KpopStats 아티스트 CRUD + 수동 stats 갱신
// 기존 events-manager 패턴 그대로 따름

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Pencil, RefreshCw } from "lucide-react"
import type { AdminKpopArtistRow } from "@/app/admin/kpop/page"

// 큰 숫자 표기 — 80,200,000 → "80.2M"
function fmt(n: number | null): string {
  if (n === null || n === undefined) return "—"
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B"
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K"
  return n.toLocaleString()
}

interface FormState {
  id?: string
  name: string
  name_ko: string
  debut_year: string                       // input[type=number] 은 string 으로 다룸
  youtube_channel_id: string
  lastfm_name: string
  thumbnail_url: string
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  name: "",
  name_ko: "",
  debut_year: "",
  youtube_channel_id: "",
  lastfm_name: "",
  thumbnail_url: "",
  is_active: true,
}

export function KpopArtistsManager({ artists }: { artists: AdminKpopArtistRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()
  const [refreshingId, setRefreshingId] = useState<string | null>(null)

  function startCreate() {
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function startEdit(a: AdminKpopArtistRow) {
    setForm({
      id: a.id,
      name: a.name,
      name_ko: a.name_ko ?? "",
      debut_year: a.debut_year ? String(a.debut_year) : "",
      youtube_channel_id: a.youtube_channel_id ?? "",
      lastfm_name: a.lastfm_name ?? "",
      thumbnail_url: a.thumbnail_url ?? "",
      is_active: a.is_active,
    })
    setOpen(true)
  }

  async function handleSubmit() {
    const isEdit = Boolean(form.id)
    const body = {
      name: form.name.trim(),
      name_ko: form.name_ko.trim() || null,
      debut_year: form.debut_year ? Number(form.debut_year) : null,
      youtube_channel_id: form.youtube_channel_id.trim() || null,
      lastfm_name: form.lastfm_name.trim() || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
      is_active: form.is_active,
    }

    const url = isEdit ? `/api/admin/kpop/${form.id}` : "/api/admin/kpop"
    const method = isEdit ? "PATCH" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast({
        title: isEdit ? "수정 실패" : "등록 실패",
        description: err.error?.toString?.() ?? "알 수 없는 오류",
      })
      return
    }

    toast({ title: isEdit ? "수정 완료" : "등록 완료" })
    setOpen(false)
    startTransition(() => router.refresh())
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`정말 "${name}" 을(를) 삭제하시겠습니까?\n관련 stats 도 함께 삭제됩니다.`)) return
    const res = await fetch(`/api/admin/kpop/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast({ title: "삭제 실패", description: err.error?.toString?.() ?? "알 수 없는 오류" })
      return
    }
    toast({ title: "삭제 완료" })
    startTransition(() => router.refresh())
  }

  async function handleRefresh(id: string) {
    setRefreshingId(id)
    try {
      const res = await fetch(`/api/admin/kpop/${id}/refresh`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && res.status !== 207) {
        toast({ title: "갱신 실패", description: String(data.error ?? "unknown") })
        return
      }
      const errors = (data.errors ?? []) as string[]
      if (errors.length > 0) {
        toast({
          title: "부분 성공",
          description: `upserted=${data.upserted ?? 0} / errors: ${errors.join(", ").slice(0, 200)}`,
        })
      } else {
        toast({ title: "갱신 완료", description: `upserted=${data.upserted ?? 0}` })
      }
      startTransition(() => router.refresh())
    } finally {
      setRefreshingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={startCreate}
          className="rounded-full"
          style={{ backgroundColor: "#FF4B6E", color: "white" }}
        >
          <Plus className="w-4 h-4 mr-1" /> 신규 아티스트
        </Button>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">이름</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">데뷔</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">YT 채널</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">Last.fm</th>
              <th className="text-right text-muted-foreground text-sm font-medium px-4 py-3">최신 구독자</th>
              <th className="text-right text-muted-foreground text-sm font-medium px-4 py-3">최신 청취자</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">상태</th>
              <th className="text-right text-muted-foreground text-sm font-medium px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody>
            {artists.length === 0 && (
              <tr>
                <td colSpan={8} className="text-muted-foreground text-sm text-center py-8">
                  아티스트 없음
                </td>
              </tr>
            )}
            {artists.map((a) => (
              <tr key={a.id} className="border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#202024]">
                <td className="text-foreground text-sm px-4 py-3">
                  <div>{a.name}</div>
                  {a.name_ko && <div className="text-muted-foreground text-xs">{a.name_ko}</div>}
                </td>
                <td className="text-muted-foreground text-sm px-4 py-3">{a.debut_year ?? "—"}</td>
                <td className="text-muted-foreground text-xs px-4 py-3 font-mono truncate max-w-[160px]">
                  {a.youtube_channel_id ?? <span className="text-red-400">미설정</span>}
                </td>
                <td className="text-muted-foreground text-xs px-4 py-3 truncate max-w-[120px]">
                  {a.lastfm_name ?? "—"}
                </td>
                <td className="text-foreground text-sm text-right px-4 py-3">{fmt(a.latest_subscribers)}</td>
                <td className="text-foreground text-sm text-right px-4 py-3">{fmt(a.latest_lastfm_listeners)}</td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={
                      a.is_active
                        ? { backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }
                        : { backgroundColor: "rgba(136, 136, 136, 0.15)", color: "#888888" }
                    }
                  >
                    {a.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="text-right px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRefresh(a.id)}
                      disabled={refreshingId === a.id}
                      title="stats 즉시 갱신"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${refreshingId === a.id ? "animate-spin" : ""}`}
                      />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(a)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id, a.name)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 등록·수정 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#141418] border-[#2a2a2a] text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "아티스트 수정" : "신규 아티스트"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">이름 (영문)</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="bg-[#0d0d0f] border-[#2a2a2a]"
                  placeholder="aespa"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">이름 (한글)</label>
                <Input
                  value={form.name_ko}
                  onChange={(e) => setForm((f) => ({ ...f, name_ko: e.target.value }))}
                  className="bg-[#0d0d0f] border-[#2a2a2a]"
                  placeholder="에스파"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">데뷔 연도</label>
                <Input
                  type="number"
                  value={form.debut_year}
                  onChange={(e) => setForm((f) => ({ ...f, debut_year: e.target.value }))}
                  className="bg-[#0d0d0f] border-[#2a2a2a]"
                  placeholder="2020"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">활성 여부</label>
                <div className="flex items-center h-10">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-muted-foreground text-xs mb-1 block">
                YouTube Channel ID
                <span className="text-muted-foreground/70 ml-1">— 잘못 입력 시 silent 0, 검증 후 갱신 버튼으로 확인</span>
              </label>
              <Input
                value={form.youtube_channel_id}
                onChange={(e) => setForm((f) => ({ ...f, youtube_channel_id: e.target.value }))}
                className="bg-[#0d0d0f] border-[#2a2a2a] font-mono text-sm"
                placeholder="UCxxxxxxxxxxxxxxx"
              />
            </div>

            <div>
              <label className="text-muted-foreground text-xs mb-1 block">Last.fm 아티스트명</label>
              <Input
                value={form.lastfm_name}
                onChange={(e) => setForm((f) => ({ ...f, lastfm_name: e.target.value }))}
                className="bg-[#0d0d0f] border-[#2a2a2a]"
                placeholder="aespa (대개 영어 표기와 일치)"
              />
            </div>

            <div>
              <label className="text-muted-foreground text-xs mb-1 block">썸네일 URL</label>
              <Input
                value={form.thumbnail_url}
                onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                className="bg-[#0d0d0f] border-[#2a2a2a]"
                placeholder="https://..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="rounded-full"
              style={{ backgroundColor: "#FF4B6E", color: "white" }}
            >
              {form.id ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
