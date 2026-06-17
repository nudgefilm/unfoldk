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
      <div className="relative flex items-center gap-2">
        {/* 입력창 */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4da6ff]/60 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder={`e.g. ${EXAMPLES[0]}`}
            maxLength={10}
            spellCheck={false}
            className="w-full h-10 pl-9 pr-8 text-sm font-mono bg-[#000000]/80 backdrop-blur-md border border-[#1a4a7a]/80 rounded-xl text-white placeholder-[#4da6ff]/40 focus:outline-none focus:border-[#4da6ff] focus:bg-[#000000]/90 transition-colors shadow-lg"
          />
          {value && (
            <button onClick={clear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4da6ff]/40 hover:text-[#4da6ff]/80 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 검색 버튼 */}
        <button
          onClick={submit}
          disabled={loading || !value.trim()}
          className="h-10 px-4 bg-[#1a4a7a]/80 hover:bg-[#2a5a9a]/80 disabled:opacity-40 disabled:cursor-not-allowed border border-[#4da6ff]/40 rounded-xl text-sm font-semibold text-[#4da6ff] transition-colors flex items-center gap-1.5"
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
