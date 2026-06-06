"use client"

import { useEffect, useState } from "react"

interface RateData {
  rate: number
  updated_at: string
}

function formatDateKo(utcString: string): string {
  try {
    const d = new Date(utcString)
    const m = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    return `${m}월 ${day}일 기준`
  } catch {
    return "기준"
  }
}

export function ExchangeRateBadge() {
  const [data, setData] = useState<RateData | null>(null)

  useEffect(() => {
    fetch("/api/kbeauty/exchange-rate")
      .then((r) => r.json())
      .then((json: RateData) => setData(json))
      .catch(() => setData({ rate: 1400, updated_at: new Date().toISOString() }))
  }, [])

  if (!data) {
    return (
      <div className="h-5 w-48 rounded bg-[#E8E2DA] animate-pulse" />
    )
  }

  const rateFormatted = Math.round(data.rate).toLocaleString("ko-KR")
  const dateLabel = formatDateKo(data.updated_at)

  return (
    <span className="text-xs text-[#6B6B6B] text-right whitespace-nowrap">
      💱 1 USD = {rateFormatted} ₩&nbsp;&nbsp;
      <span className="text-[#A09080]">({dateLabel})</span>
    </span>
  )
}
