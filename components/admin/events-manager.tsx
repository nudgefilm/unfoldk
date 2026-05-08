"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Pencil } from "lucide-react"

type EventType = "comeback" | "drama" | "concert" | "fanmeet"

export interface AdminEventRow {
  id: string
  type: EventType
  title: string
  artist_or_drama: string
  event_date: string
  event_time_label: string | null
  description: string | null
  source_api: string | null
  is_premium: boolean
}

interface FormState {
  id?: string
  title: string
  artist_or_drama: string
  type: EventType
  event_date: string                     // YYYY-MM-DDTHH:mm 형식 (datetime-local)
  event_time_label: string
  description: string                    // 한 줄 설명 (영어, ~100자 권고)
  is_premium: boolean
}

const EMPTY_FORM: FormState = {
  title: "",
  artist_or_drama: "",
  type: "comeback",
  event_date: "",
  event_time_label: "",
  description: "",
  is_premium: false,
}

export function EventsManager({ events }: { events: AdminEventRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()

  function startCreate() {
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function startEdit(ev: AdminEventRow) {
    setForm({
      id: ev.id,
      title: ev.title,
      artist_or_drama: ev.artist_or_drama,
      type: ev.type,
      // datetime-local input에 맞게 'YYYY-MM-DDTHH:mm' 까지만 잘라냄
      event_date: ev.event_date ? ev.event_date.slice(0, 16) : "",
      event_time_label: ev.event_time_label ?? "",
      description: ev.description ?? "",
      is_premium: ev.is_premium,
    })
    setOpen(true)
  }

  async function handleSubmit() {
    const isEdit = Boolean(form.id)
    const body = {
      title: form.title,
      artist_or_drama: form.artist_or_drama,
      type: form.type,
      event_date: form.event_date ? new Date(form.event_date).toISOString() : "",
      event_time_label: form.event_time_label || null,
      description: form.description || null,
      is_premium: form.is_premium,
    }

    const url = isEdit ? `/api/admin/events/${form.id}` : "/api/admin/events"
    const method = isEdit ? "PATCH" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast({ title: isEdit ? "수정 실패" : "등록 실패", description: err.error?.toString?.() ?? "알 수 없는 오류" })
      return
    }

    toast({ title: isEdit ? "수정 완료" : "등록 완료" })
    setOpen(false)
    startTransition(() => router.refresh())
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제하시겠습니까?")) return
    const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast({ title: "삭제 실패", description: err.error?.toString?.() ?? "알 수 없는 오류" })
      return
    }
    toast({ title: "삭제 완료" })
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={startCreate}
          className="rounded-full"
          style={{ backgroundColor: "#FF4B6E", color: "white" }}
        >
          <Plus className="w-4 h-4 mr-1" /> 신규 이벤트
        </Button>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">제목</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">날짜</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">타입</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">출처</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">유료</th>
              <th className="text-right text-muted-foreground text-sm font-medium px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground text-sm text-center py-8">
                  이벤트 없음
                </td>
              </tr>
            )}
            {events.map((ev) => (
              <tr key={ev.id} className="border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#202024]">
                <td className="text-foreground text-sm px-4 py-3">
                  <div>{ev.title}</div>
                  <div className="text-muted-foreground text-xs">{ev.artist_or_drama}</div>
                </td>
                <td className="text-muted-foreground text-sm px-4 py-3">
                  {new Date(ev.event_date).toLocaleDateString("ko-KR")}
                </td>
                <td className="text-muted-foreground text-sm px-4 py-3">{ev.type}</td>
                <td className="text-muted-foreground text-sm px-4 py-3">{ev.source_api ?? "—"}</td>
                <td className="text-muted-foreground text-sm px-4 py-3">{ev.is_premium ? "✓" : "—"}</td>
                <td className="text-right px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(ev)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(ev.id)}>
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
            <DialogTitle>{form.id ? "이벤트 수정" : "신규 이벤트"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-muted-foreground text-xs mb-1 block">제목</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="bg-[#0d0d0f] border-[#2a2a2a]"
              />
            </div>
            <div>
              <label className="text-muted-foreground text-xs mb-1 block">아티스트 / 드라마</label>
              <Input
                value={form.artist_or_drama}
                onChange={(e) => setForm((f) => ({ ...f, artist_or_drama: e.target.value }))}
                className="bg-[#0d0d0f] border-[#2a2a2a]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">타입</label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as EventType }))}>
                  <SelectTrigger className="bg-[#0d0d0f] border-[#2a2a2a]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comeback">Comeback</SelectItem>
                    <SelectItem value="drama">Drama</SelectItem>
                    <SelectItem value="concert">Concert</SelectItem>
                    <SelectItem value="fanmeet">Fan Meet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">유료 (Premium)</label>
                <div className="flex items-center h-10">
                  <Switch
                    checked={form.is_premium}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, is_premium: checked }))}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-muted-foreground text-xs mb-1 block">이벤트 일시</label>
              <Input
                type="datetime-local"
                value={form.event_date}
                onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                className="bg-[#0d0d0f] border-[#2a2a2a]"
              />
            </div>
            <div>
              <label className="text-muted-foreground text-xs mb-1 block">표시용 시간 라벨 (예: 7:00 PM KST)</label>
              <Input
                value={form.event_time_label}
                onChange={(e) => setForm((f) => ({ ...f, event_time_label: e.target.value }))}
                className="bg-[#0d0d0f] border-[#2a2a2a]"
              />
            </div>
            <div>
              <label className="text-muted-foreground text-xs mb-1 block">
                한 줄 설명 (영어, ~100자 권장)
                <span className="text-muted-foreground/70 ml-1">— 비워두면 인제스트 시 Claude 가 자동 생성</span>
              </label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="bg-[#0d0d0f] border-[#2a2a2a] min-h-[60px] resize-y"
                placeholder="aespa is back! The iconic K-pop quartet drops their highly anticipated new album."
                maxLength={2000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
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
