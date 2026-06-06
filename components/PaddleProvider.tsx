"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { Paddle } from "@paddle/paddle-js"
import { initializePaddle } from "@paddle/paddle-js"
import { PADDLE_ENV } from "@/lib/paddle/constants"

const PaddleContext = createContext<Paddle | undefined>(undefined)

export function PaddleProvider({ children }: { children: React.ReactNode }) {
  const [paddle, setPaddle] = useState<Paddle>()

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
    if (!token) return
    initializePaddle({ token, environment: PADDLE_ENV }).then((p) => {
      if (p) setPaddle(p)
    })
  }, [])

  return <PaddleContext.Provider value={paddle}>{children}</PaddleContext.Provider>
}

export function usePaddle() {
  return useContext(PaddleContext)
}
