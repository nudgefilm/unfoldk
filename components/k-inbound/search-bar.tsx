"use client"

import { useState, useRef } from "react"
import { Search, Loader2, X } from "lucide-react"

interface Props {
  onSearch: (flightNumber: string) => void
  loading?: boolean
  error?: string | null
}

const EXAMPLES = ["KE001", "OZ202", "KE081", "OZ271"]

export function FlightSearchBar({ onSearch, loading = false, error }: Props) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const trimmed = value.trim().toUpperCase()
    if (!trimmed || loading) return
    onSearch(trimmed)
  }

  const clear = () => {
    setValue("")
    inputRef.current?.focus()
  }

  return (
    <div className="w-full">
      {/* 입력창 + Track 버튼 — 패널 카드와 동일한 반투명 컨테이너 */}
      <div className="flex items-center bg-black/75 backdrop-blur-sm border border-[#4a9eff]/30 rounded-xl overflow-hidden">
        <Search className="shrink-0 ml-3 w-4 h-4 text-[#4a9eff]/50 pointer-events-none" />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder={`e.g. ${EXAMPLES[0]}`}
          maxLength={10}
          spellCheck={false}
          className="flex-1 h-10 pl-2.5 pr-2 text-sm font-mono bg-transparent text-white placeholder-[#4a9eff]/35 focus:outline-none"
        />

        {value && (
          <button
            onClick={clear}
            className="shrink-0 px-1.5 text-[#4a9eff]/40 hover:text-[#4a9eff]/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* 구분선 */}
        <div className="w-px h-5 bg-[#4a9eff]/20 shrink-0" />

        {/* Track 버튼 */}
        <button
          onClick={submit}
          disabled={loading || !value.trim()}
          className="shrink-0 h-10 px-4 bg-transparent hover:bg-white/5 disabled:opacity-35 disabled:cursor-not-allowed text-sm font-semibold text-[#4a9eff] hover:text-white transition-colors flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Track"}
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <p className="mt-1.5 text-[11px] text-red-400/90 text-center">{error}</p>
      )}
    </div>
  )
}
