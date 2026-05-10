"use client"

import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

// 쿠키 동의 배너 — Footer 도달 시 IntersectionObserver 가 1회 트리거 (footer-section.tsx).
// localStorage 키 'cookie_consent'='accepted' 가 저장되면 이후 재방문 시 미노출.
// Manage 클릭은 /cookie 로 navigate (수락은 별도 — 재방문 때 다시 노출됨).

export const COOKIE_CONSENT_KEY = "cookie_consent"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CookieConsentBanner({ open, onOpenChange }: Props) {
  const handleAccept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "accepted")
    } catch {
      // localStorage 비활성(시크릿 모드 일부 / 설정 차단) — 동의 박제 못해 매번 노출됨.
      // 사용자 차단 의도 존중하고 silent fail.
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141418] border-[#2a2a2a] text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle>We use cookies</DialogTitle>
          <DialogDescription className="text-muted-foreground leading-relaxed">
            We use cookies to improve your experience. By continuing, you agree to our Cookie Policy.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Link href="/cookie">
            <Button variant="ghost">Manage</Button>
          </Link>
          <Button
            onClick={handleAccept}
            className="rounded-full"
            style={{ backgroundColor: "#FF4B6E", color: "white" }}
          >
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
