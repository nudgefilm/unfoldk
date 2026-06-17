"use client"

import { useEffect, useRef, useState } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

interface KMessage {
  id: string
  message: string
  city: string
  country_code: string
  created_at: string
}

const BLOCKED = ["fuck", "shit", "bitch", "cunt", "asshole", "dickhead", "motherfucker"]
const hasBadWord = (t: string) => BLOCKED.some(w => t.toLowerCase().includes(w))

export function GlobalComms() {
  const [msgs, setMsgs]   = useState<KMessage[]>([])
  const [input, setInput] = useState("")
  const [city, setCity]   = useState("Unknown")
  const [ccCode, setCcCode] = useState("")
  const [mini, setMini]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const supabase                = useRef(createSupabaseBrowserClient()).current

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

  // 새 메시지 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [msgs])

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
      className="absolute bottom-4 left-2 z-20 w-[280px] font-mono"
      style={{
        background:   "rgba(0,0,0,0.75)",
        border:       "1px solid rgba(255,75,110,0.3)",
        borderRadius: "12px",
        overflow:     "hidden",
      }}
    >
      {/* 헤더 — 클릭으로 접기/펼치기 */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        style={{ borderBottom: mini ? "none" : "1px solid rgba(255,75,110,0.2)" }}
        onClick={() => setMini(m => !m)}
      >
        <span className="text-[#FF4B6E] text-[11px] font-bold tracking-widest">✈ GLOBAL COMMS</span>
        <span className="text-[#FF4B6E]/50 text-[9px]">{mini ? "▼" : "▲"}</span>
      </div>

      {!mini && (
        <>
          {/* 메시지 목록 */}
          <div className="h-[160px] overflow-y-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {msgs.length === 0 ? (
              <p className="text-[#94a3b8]/40 text-[11px] text-center pt-6">
                No messages yet... Say hello! 👋
              </p>
            ) : (
              <div className="space-y-2">
                {msgs.map(m => (
                  <div key={m.id} className="text-[11px] leading-relaxed">
                    <span className="text-[#4a9eff]/80 mr-1">[{m.city || "?"}]</span>
                    <span className="text-white/80 break-words">{m.message}</span>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* 입력 */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderTop: "1px solid rgba(255,75,110,0.15)" }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value.slice(0, 100))}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Send a message..."
              className="flex-1 bg-transparent text-white text-[11px] placeholder-[#94a3b8]/30 focus:outline-none"
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
