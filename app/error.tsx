"use client"

import { useEffect } from "react"
import { RefreshCw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          An error occurred while loading the page. Please try refreshing.
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white"
        style={{ backgroundColor: "#FF4B6E" }}
      >
        <RefreshCw className="w-4 h-4" />
        Refresh
      </button>
    </div>
  )
}
