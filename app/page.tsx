import { HeroSection } from "@/components/hero-section"
import { FloatingCalendarWidget } from "@/components/floating-calendar-widget"
import { BentoSection } from "@/components/bento-section"

import { PricingSection } from "@/components/pricing-section"
import { TestimonialGridSection } from "@/components/testimonial-grid-section"
import { FAQSection } from "@/components/faq-section"
import { CTASection } from "@/components/cta-section"
import { FooterSection } from "@/components/footer-section"
import { AnimatedSection } from "@/components/animated-section"
import { UnauthorizedToast } from "@/components/unauthorized-toast"

export default function LandingPage() {
  return (
    <>
      {/* 비관리자 /admin 접근 거부 시 middleware 가 ?toast=unauthorized 로 redirect — 감지해 토스트 노출
          ⚠️ overflow-hidden 래퍼 밖에 두는 이유: position:fixed 는 일반적으로 viewport 기준이지만,
             상위에 transform/filter/perspective 가 추가되면 containing block 이 바뀌어 클리핑되는
             케이스가 있어 가장 바깥에 두는 것이 안전. */}
      <UnauthorizedToast />
      <div className="min-h-screen bg-background relative overflow-hidden pb-0">
        <FloatingCalendarWidget />
        <div className="relative z-10">
          <main className="max-w-[1320px] mx-auto relative">
            <HeroSection />
          </main>

          <AnimatedSection id="features-section" className="relative z-10 max-w-[1320px] mx-auto mt-12 md:mt-20" delay={0.2}>
            <BentoSection />
          </AnimatedSection>
          <AnimatedSection
            id="pricing-section"
            className="relative z-10 max-w-[1320px] mx-auto mt-16 md:mt-24"
            delay={0.2}
          >
            <PricingSection />
          </AnimatedSection>
          <AnimatedSection
            id="testimonials-section"
            className="relative z-10 max-w-[1320px] mx-auto mt-16 md:mt-24"
            delay={0.2}
          >
            <TestimonialGridSection />
          </AnimatedSection>
          <AnimatedSection id="faq-section" className="relative z-10 max-w-[1320px] mx-auto mt-16 md:mt-24" delay={0.2}>
            <FAQSection />
          </AnimatedSection>
          <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-16 md:mt-24" delay={0.2}>
            <CTASection />
          </AnimatedSection>
          <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-12 md:mt-16" delay={0.2}>
            <FooterSection />
          </AnimatedSection>
        </div>
      </div>
    </>
  )
}
