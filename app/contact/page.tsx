// /contact — 공개 문의 폼
// 폼 로직은 components/contact-form.tsx 단일 진실원 (About 모달 등과 공유).
// honeypot + Resend 발송은 컴포넌트 내부에서 처리.

import { FooterSection } from "@/components/footer-section"
import { ContactForm } from "@/components/contact-form"
import { Mail } from "lucide-react"

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 max-w-[680px] mx-auto px-5 py-16 md:py-24 w-full">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(255, 75, 110, 0.12)" }}
            >
              <Mail className="w-8 h-8" style={{ color: "#FF4B6E" }} />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">Contact us</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
            Questions, feedback, partnership ideas — we&apos;d love to hear from you. We typically
            reply within 1–2 business days.
          </p>
        </div>

        <ContactForm />
      </main>

      <FooterSection />
    </div>
  )
}
