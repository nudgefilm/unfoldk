"use client"

// ⚠️ 임의 수정 금지 — 아래 항목은 개선 작업으로 확정된 사항임
// 변경이 필요하다고 판단되는 경우 반드시 먼저 확인 요청할 것
//
// 반영 완료 항목:
// - 1시간 rotating 시스템 메시지 (SYSTEM_MESSAGES, setInterval 3_600_000, 로컬 상태만)
// - isExpanded / onToggle props — 펼침/접힘 상태는 page.tsx 에서 관리 (controlled)
// - 접힌 상태: 헤더 1줄만 표시 (lastMsg 미리보기 제거)
// - 펼친 상태: 메시지 영역 flex-1 min-h-0 (부모 50vh 기준 자동 채움)
// - backdrop-blur-md + rgba(0,0,0,0.45) 반투명 처리

import { useEffect, useMemo, useRef, useState } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

interface KMessage {
  id: string
  message: string
  city: string
  country_code: string
  created_at: string
}

interface SystemMessage {
  id: string
  type: "system"
  message: string
  created_at: string
}

type DisplayMessage =
  | (KMessage & { type: "user" })
  | SystemMessage

const SYSTEM_MESSAGES = [
  "✈ Enter a flight number above to track it live on the 3D globe!",
  "🌏 KE017, OZ201, AA280... Search any flight heading to Korea.",
  "👋 Chat with fellow travelers watching the same flight!",
]

const BLOCKED = ["fuck", "shit", "bitch", "cunt", "asshole", "dickhead", "motherfucker"]
const hasBadWord = (t: string) => BLOCKED.some(w => t.toLowerCase().includes(w))

interface GlobalCommsProps {
  isExpanded: boolean
  onToggle:   () => void
}

export function GlobalComms({ isExpanded, onToggle }: GlobalCommsProps) {
  const [msgs, setMsgs]         = useState<KMessage[]>([])
  const [sysMessages, setSysMessages] = useState<SystemMessage[]>([])
  const [input, setInput]       = useState("")
  const [city, setCity]         = useState("Unknown")
  const [ccCode, setCcCode]     = useState("")
  const bottomRef   = useRef<HTMLDivElement>(null)
  const sysIndexRef = useRef(0)
  const supabase    = useRef(createSupabaseBrowserClient()).current

  // IP → 도시/국가 코드
  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then(r => r.json())
      .then((d: { city?: string; country_code?: string }) => {
        if (d.city)         setCity(d.city)
        if (d.country_code) setCcCode(d.country_code)
      })
      .catch(() => {})
  }, [])

  // 초기 메시지 50개 로드
  useEffect(() => {
    supabase
      .from("kinbound_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) console.error("[GlobalComms] initial load error:", error)
        if (data)  setMsgs((data as KMessage[]).reverse())
      })
  }, [supabase])

  // Realtime INSERT 구독
  useEffect(() => {
    const ch = supabase
      .channel("kinbound_messages_rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kinbound_messages" },
        payload => setMsgs(prev => {
          const msg = payload.new as KMessage
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg].slice(-50)
        }),
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase])

  // 1시간마다 시스템 메시지 순서대로 로컬 상태에만 추가
  useEffect(() => {
    const timer = setInterval(() => {
      const message = SYSTEM_MESSAGES[sysIndexRef.current % SYSTEM_MESSAGES.length]
      sysIndexRef.current += 1
      setSysMessages(prev => [
        ...prev,
        { id: `sys-${sysIndexRef.current}`, type: "system", message, created_at: new Date().toISOString() },
      ])
    }, 3_600_000)
    return () => clearInterval(timer)
  }, [])

  // 유저 메시지 + 시스템 메시지 시간순 병합 (최대 50개)
  const allMessages = useMemo<DisplayMessage[]>(() => {
    const user: DisplayMessage[] = msgs.map(m => ({ ...m, type: "user" }))
    return [...user, ...sysMessages]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-50)
  }, [msgs, sysMessages])

  // 새 메시지 자동 스크롤 (펼친 상태에서만)
  useEffect(() => {
    if (isExpanded) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [allMessages, isExpanded])

  const send = async () => {
    const text = input.trim()
    if (!text || hasBadWord(text)) { setInput(""); return }
    setInput("")
    const { error } = await supabase.from("kinbound_messages").insert({
      message:      text.slice(0, 100),
      city,
      country_code: ccCode,
    })
    if (error) console.error("[GlobalComms] insert error:", error)
    // 로컬 즉시 추가 없음 — Realtime INSERT 이벤트로만 표시
  }

  return (
    <div
      className="w-full h-full font-mono flex flex-col backdrop-blur-md"
      style={{
        background:   "transparent",
        border:       "1px solid rgba(255,75,110,0.3)",
        borderRadius: "12px",
        overflow:     "hidden",
      }}
    >
      {/* 헤더 — 항상 표시, 클릭으로 펼침/접힘 */}
      <div
        className="shrink-0 flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        style={{ borderBottom: "1px solid rgba(255,75,110,0.2)" }}
        onClick={onToggle}
      >
        <span className="text-[#FF4B6E] text-[11px] font-bold tracking-widest">✈ GLOBAL COMMS</span>
        <span className="text-[#FF4B6E] text-[9px]">{isExpanded ? "▼" : "▲"}</span>
      </div>

      {/* 펼친 상태 — 메시지 영역 flex-1 (부모 50vh 기준) + 입력창 */}
      {isExpanded && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {allMessages.length === 0 ? (
              <p className="text-[#94a3b8] text-[11px] text-center pt-4">
                No messages yet... Say hello! 👋
              </p>
            ) : (
              <div className="space-y-1.5">
                {allMessages.map(m =>
                  m.type === "system" ? (
                    <div
                      key={m.id}
                      className="text-[11px] leading-relaxed rounded px-1"
                      style={{ background: "rgba(74, 222, 128, 0.05)" }}
                    >
                      <span className="font-bold mr-1" style={{ color: "#4ade80" }}>[SYSTEM]</span>
                      <span className="italic" style={{ color: "#94a3b8" }}>{m.message}</span>
                    </div>
                  ) : (
                    <div key={m.id} className="text-[11px] leading-relaxed">
                      <span className="text-[#4a9eff]/80 mr-1">[{m.city || "?"}]</span>
                      <span className="text-white/80 break-words">{m.message}</span>
                    </div>
                  )
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* 입력 */}
          <div
            className="shrink-0 flex items-center gap-2 px-3 py-2"
            style={{ borderTop: "1px solid rgba(255,75,110,0.15)" }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value.slice(0, 100))}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Send a message..."
              className="flex-1 bg-transparent text-white text-[11px] placeholder-[#94a3b8]/50 focus:outline-none"
            />
            <button
              onClick={send}
              className="text-[#FF4B6E] text-[10px] font-bold tracking-widest hover:text-[#ff6080] transition-colors shrink-0"
            >
              SEND
            </button>
          </div>
        </>
      )}
    </div>
  )
}
