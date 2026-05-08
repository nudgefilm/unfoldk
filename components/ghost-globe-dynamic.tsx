"use client"

import dynamic from "next/dynamic"

// WebGL/Three.js는 SSR 불가 — 클라이언트에서만 로드. ssr:false 옵션 때문에 클라이언트 래퍼 필요.
export const GhostGlobe = dynamic(
  () => import("@/components/ghost-globe").then(m => ({ default: m.GhostGlobe })),
  { ssr: false }
)
