import { Suspense } from "react"
import { KoreanContent } from "./korean-content"

export default function HangeulGoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#0d0d0f" }} />}>
      <KoreanContent />
    </Suspense>
  )
}
