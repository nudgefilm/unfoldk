"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

// /admin/food 챌린지 관리 — 현재 챌린지 + 최근 챌린지 list + 신규 생성 폼.
// 폼 제출 → POST /api/admin/food/challenges → router.refresh() 로 server props 재 fetch.

export interface ChallengeAdminRow {
  id: string
  title: string
  description: string | null
  food_name: string | null
  image_url: string | null
  week_start: string
  week_end: string
  created_at: string
}

export function ChallengesAdmin({
  rows,
  todayIso,
}: {
  rows: ChallengeAdminRow[]
  todayIso: string                              // 서버에서 산출한 오늘 (YYYY-MM-DD) — active 판정
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [foodName, setFoodName] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [weekStart, setWeekStart] = useState("")
  const [weekEnd, setWeekEnd] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setTitle("")
    setDescription("")
    setFoodName("")
    setImageUrl("")
    setWeekStart("")
    setWeekEnd("")
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    if (!title.trim() || !weekStart || !weekEnd) {
      toast({ title: "Title / Week start / Week end 는 필수입니다." })
      return
    }
    if (weekStart > weekEnd) {
      toast({ title: "Week start 가 Week end 보다 늦을 수 없습니다." })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/food/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          food_name: foodName.trim() || null,
          image_url: imageUrl.trim() || null,
          week_start: weekStart,
          week_end: weekEnd,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
      }
      if (!res.ok) {
        toast({
          title: "챌린지 생성 실패",
          description: json.message ?? json.error ?? "다시 시도해 주세요.",
        })
        return
      }
      toast({ title: "챌린지가 추가되었습니다." })
      reset()
      router.refresh()
    } catch (err) {
      console.error("[admin/food/challenges] POST 예외:", err)
      toast({ title: "Network error", description: "다시 시도해 주세요." })
    } finally {
      setSubmitting(false)
    }
  }

  const activeNow = rows.find(
    (r) => r.week_start <= todayIso && todayIso <= r.week_end
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-foreground text-lg font-semibold mb-1">주간 K푸드 챌린지</h2>
        <p className="text-muted-foreground text-sm">
          /food 페이지의 &quot;This Week&apos;s Challenge&quot; 카드로 노출됩니다.
        </p>
      </div>

      {/* 현재 진행 중 챌린지 */}
      <section>
        <h3 className="text-foreground text-sm font-semibold uppercase tracking-wider mb-2">
          진행 중
        </h3>
        {activeNow ? (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-lg p-4">
            <p className="text-foreground font-medium">{activeNow.title}</p>
            {activeNow.food_name && (
              <p className="text-muted-foreground text-xs mt-1">
                음식: {activeNow.food_name}
              </p>
            )}
            <p className="text-muted-foreground text-xs mt-1">
              {activeNow.week_start} ~ {activeNow.week_end}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            현재 진행 중인 챌린지가 없습니다.
          </p>
        )}
      </section>

      {/* 신규 생성 폼 */}
      <section>
        <h3 className="text-foreground text-sm font-semibold uppercase tracking-wider mb-2">
          신규 챌린지 추가
        </h3>
        <form
          onSubmit={handleSubmit}
          className="bg-[#1a1a1a] border border-border/30 rounded-lg p-4 space-y-3"
        >
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Make Japchae"
              maxLength={200}
              required
              className="bg-[#0d0d0f] border-[#2a2a2a] text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: From Itaewon Class · Difficulty: Intermediate"
              maxLength={2000}
              className="bg-[#0d0d0f] border-[#2a2a2a] text-foreground min-h-[60px]"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Food name (레시피 검색 키워드)
              </label>
              <Input
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="예: 잡채"
                maxLength={100}
                className="bg-[#0d0d0f] border-[#2a2a2a] text-foreground"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Image URL</label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                maxLength={500}
                className="bg-[#0d0d0f] border-[#2a2a2a] text-foreground"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Week start *</label>
              <Input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                required
                className="bg-[#0d0d0f] border-[#2a2a2a] text-foreground"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Week end *</label>
              <Input
                type="date"
                value={weekEnd}
                onChange={(e) => setWeekEnd(e.target.value)}
                required
                className="bg-[#0d0d0f] border-[#2a2a2a] text-foreground"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-full font-medium text-white"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              {submitting ? "Saving..." : "추가"}
            </Button>
          </div>
        </form>
      </section>

      {/* 최근 챌린지 목록 (active 포함, 최대 10개) */}
      {rows.length > 0 && (
        <section>
          <h3 className="text-foreground text-sm font-semibold uppercase tracking-wider mb-2">
            최근 챌린지
          </h3>
          <ul className="space-y-2">
            {rows.map((r) => {
              const isActive = r.week_start <= todayIso && todayIso <= r.week_end
              return (
                <li
                  key={r.id}
                  className="bg-[#1a1a1a] border border-border/30 rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-medium truncate">
                      {r.title}
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {r.week_start} ~ {r.week_end}
                      {r.food_name && ` · ${r.food_name}`}
                    </p>
                  </div>
                  {isActive && (
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: "rgba(34, 197, 94, 0.15)",
                        color: "#22c55e",
                      }}
                    >
                      Active
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
