"use client"

import { useState } from "react"
import { FoodAdminTable, type FoodAdminRow } from "@/components/admin/food-admin-table"
import { ChallengesAdmin, type ChallengeAdminRow } from "@/components/admin/challenges-admin"

// /admin/food 페이지의 탭 wrapper — Recipes / Challenges 두 패널 전환.
// server component (page.tsx) 가 두 데이터 모두 미리 fetch 해 props 로 전달.

type Tab = "recipes" | "challenges"

export function FoodAdminTabs({
  recipes,
  challenges,
  todayIso,
}: {
  recipes: FoodAdminRow[]
  challenges: ChallengeAdminRow[]
  todayIso: string
}) {
  const [tab, setTab] = useState<Tab>("recipes")

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 border-b border-border/30">
        <TabBtn label="Recipes" active={tab === "recipes"} onClick={() => setTab("recipes")} />
        <TabBtn
          label="Challenges"
          active={tab === "challenges"}
          onClick={() => setTab("challenges")}
        />
      </div>

      {tab === "recipes" ? (
        <FoodAdminTable rows={recipes} />
      ) : (
        <ChallengesAdmin rows={challenges} todayIso={todayIso} />
      )}
    </div>
  )
}

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-4 py-3 text-sm font-medium transition-colors ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {active && (
        <span
          className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
          style={{ backgroundColor: "#FF4B6E" }}
        />
      )}
    </button>
  )
}
