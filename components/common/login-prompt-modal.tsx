"use client"

import Link from "next/link"
import { X } from "lucide-react"

interface LoginPromptModalProps {
  isOpen: boolean
  onClose: () => void
  // 페이지별 맥락에 맞는 메시지 override 가능. 기본값: 저장·공유 안내.
  title?: string
  message?: string
}

export function LoginPromptModal({
  isOpen,
  onClose,
  title = "Sign in to continue",
  message = "Sign in to save and share your result — it's free.",
}: LoginPromptModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl p-6 relative animate-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 아이콘 */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: "#FF4B6E22" }}
        >
          <svg
            width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="#FF4B6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">{message}</p>

        <div className="flex flex-col gap-3">
          <Link href="/login" onClick={onClose} className="block">
            <button
              className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              Log in
            </button>
          </Link>
          <Link href="/signup" onClick={onClose} className="block">
            <button
              className="w-full py-3 rounded-xl font-semibold text-muted-foreground bg-[#2a2a2a] border border-border/30 hover:border-primary/40 hover:text-white transition-all"
            >
              Create free account
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
