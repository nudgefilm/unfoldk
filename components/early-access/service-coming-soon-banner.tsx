"use client"

// 미구현 서비스 페이지 상단 안내 — 현재 사용 가능한 기능은 그대로 유지됨을 명시.
// 사용처: /drama (KdramaMatch) / /korean (HangeulGo) / /food (KfoodKit).
//
// 디자인: 페이지 콘텐츠 위 카드 (max-w-{1320|1280|6xl} mx-auto px-6 mt-6).
// 다크테마 + brand 컬러. 이메일 알림 폼 인라인.

import { Rocket } from "lucide-react"
import { EmailSignupForm } from "@/components/early-access/email-signup-form"

interface Props {
  serviceName: string      // "KdramaMatch" / "HangeulGo" / "KfoodKit"
  serviceLabel: string     // UI 노출용 라벨 (예: "Full KdramaMatch")
  // EmailSignupForm 의 source/services 식별자
  source: string
}

export function ServiceComingSoonBanner({ serviceName, serviceLabel, source }: Props) {
  return (
    <section className="max-w-[1320px] mx-auto px-6 mt-6">
      <div
        className="rounded-2xl p-5 md:p-6 border"
        style={{
          backgroundColor: "rgba(255, 75, 110, 0.06)",
          borderColor: "rgba(255, 75, 110, 0.25)",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
            >
              <Rocket className="w-5 h-5" style={{ color: "#FF4B6E" }} />
            </div>
            <div className="min-w-0">
              <p className="text-foreground font-semibold text-sm md:text-base">
                🔜 Full {serviceLabel} launching soon
              </p>
              <p className="text-muted-foreground text-xs md:text-sm mt-1 leading-relaxed">
                You can preview what&apos;s here today. Drop your email and we&apos;ll let you
                know the moment the complete experience goes live.
              </p>
            </div>
          </div>
          <div className="md:max-w-sm w-full md:flex-shrink-0">
            <EmailSignupForm source={source} services={[serviceName]} size="sm" />
          </div>
        </div>
      </div>
    </section>
  )
}
