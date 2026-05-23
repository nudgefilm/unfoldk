import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  description:
    "Learn Korean through real K-drama dialogue. Daily expressions, grammar explanations, and drama learning packs — powered by UnfoldK.",
}

export default function KoreanLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
