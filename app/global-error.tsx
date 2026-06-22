"use client"

import { useEffect } from "react"
import { RefreshCw } from "lucide-react"

export default function GlobalError({
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
    <html lang="en" translate="no">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
          padding: "16px",
          textAlign: "center",
          backgroundColor: "#0d0d0f",
          color: "#e7eceb",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            Something went wrong
          </h2>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#8a8f8e", maxWidth: "280px", lineHeight: 1.6 }}>
            An error occurred while loading the page. Please try refreshing.
          </p>
        </div>
        <button
          onClick={reset}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "9999px",
            border: "none",
            backgroundColor: "#FF4B6E",
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </body>
    </html>
  )
}
