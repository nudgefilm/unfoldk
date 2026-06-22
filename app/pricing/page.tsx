import type { Metadata } from "next"
import { PricingSection } from "@/components/pricing-section"
import { FooterSection } from "@/components/footer-section"

export const metadata: Metadata = {
  title: "Pricing — UnfoldK Hallyu Pass",
  description: "Get full access to HallyuCalendar, HangeulGo, KfoodKit, and Curation K with a single Hallyu Pass subscription.",
  alternates: { canonical: "https://www.unfoldk.com/pricing" },
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[1320px] mx-auto px-6 pt-28 pb-16">
        <PricingSection />
      </main>
      <FooterSection />
    </div>
  )
}
