import Link from "next/link"
import { Instagram, Linkedin } from "lucide-react"

export const metadata = {
  title: "Refund Policy — UnfoldK Beauty",
  description: "UnfoldK Beauty refund and cancellation policy for subscriptions and one-time purchases.",
}

export default function KBeautyRefundPage() {
  return (
    <div className="min-h-screen" style={{ background: "#F8F7F5", fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>
      {/* Header */}
      <header className="bg-white border-b border-[#E8E2DA] px-6 py-4">
        <div className="max-w-[860px] mx-auto flex items-center justify-between">
          <Link href="/kbeauty" className="flex items-center gap-1">
            <span className="font-bold text-[#0F0F0F]">UnfoldK Beauty</span>
            <span className="text-[#C8A882] text-xs">&#9670;</span>
          </Link>
          <Link href="/kbeauty" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            ← Back
          </Link>
        </div>
      </header>

      <main className="max-w-[860px] mx-auto px-6 py-12 md:py-16">
        {/* Title */}
        <div className="mb-10">
          <h1
            className="text-[#0F0F0F] mb-2"
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontSize: 36,
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            Refund Policy
          </h1>
          <p className="text-sm text-[#6B6B6B]">Last updated: June 6, 2026</p>
        </div>

        {/* Content */}
        <div className="space-y-5">
          <Section title="Overview">
            <p>
              We want you to feel confident when subscribing to or purchasing UnfoldK Beauty services.
              This policy outlines when and how refunds are issued for subscription plans and one-time
              purchases. All payments are processed by{" "}
              <strong className="text-[#0F0F0F]">Paddle</strong> (paddle.com), our Merchant of Record.
              Paddle handles billing, taxes, and refunds on behalf of UNFOLD LAB.
            </p>
          </Section>

          <Section title="Monthly Subscription (Hallyu Pass)">
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>You may cancel your subscription at any time from <strong className="text-[#0F0F0F]">My Page → Subscription</strong>.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>Access continues until the end of the current billing period.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span><strong className="text-[#0F0F0F]">No refunds</strong> are issued for the remaining days of an active monthly billing period after cancellation.</span>
              </li>
            </ul>
          </Section>

          <Section title="Annual Subscription (Hallyu Pass)">
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>You may cancel your annual plan at any time.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>
                  If you request a refund within{" "}
                  <strong className="text-[#0F0F0F]">14 days of purchase</strong>, you are eligible
                  for a full refund — no questions asked.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>Refund requests made after 14 days are not eligible.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>
                  To request a refund, email us at{" "}
                  <a href="mailto:support@unfoldk.com" className="text-[#1A3A5C] underline hover:opacity-70 transition-opacity">
                    support@unfoldk.com
                  </a>{" "}
                  with your order details.
                </span>
              </li>
            </ul>
          </Section>

          <Section title="One-Time Purchase — Sourcing Sniper">
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>Sourcing Sniper is a one-time lifetime purchase within the UnfoldK Beauty platform.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>
                  If you request a refund within{" "}
                  <strong className="text-[#0F0F0F]">7 days of purchase</strong> and have not actively
                  used Sourcing Sniper features, you are eligible for a full refund.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>
                  &quot;Active use&quot; means running one or more sourcing scans or accessing supplier intelligence reports.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>
                  To request a refund, email{" "}
                  <a href="mailto:support@unfoldk.com" className="text-[#1A3A5C] underline hover:opacity-70 transition-opacity">
                    support@unfoldk.com
                  </a>{" "}
                  within 7 days of your purchase date.
                </span>
              </li>
            </ul>
          </Section>

          <Section title="How Refunds Are Processed">
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>Approved refunds are returned to the original payment method.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>Processing time is typically 5–10 business days depending on your bank or card issuer.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>Refunds are handled by Paddle on behalf of UNFOLD LAB. You may receive correspondence from Paddle during the process.</span>
              </li>
            </ul>
          </Section>

          <Section title="Exceptions">
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>
                  Refunds will not be issued for accounts suspended or terminated due to violations of our{" "}
                  <Link href="/terms" className="text-[#1A3A5C] underline hover:opacity-70 transition-opacity">
                    Terms of Use
                  </Link>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C8A882] flex-shrink-0 mt-0.5">•</span>
                <span>Promotional or discounted purchases may be non-refundable — this will be stated at the time of purchase.</span>
              </li>
            </ul>
          </Section>

          <Section title="Contact">
            <p>
              For any refund request or billing question, please contact us at:{" "}
              <a
                href="mailto:support@unfoldk.com"
                className="font-semibold text-[#1A3A5C] underline hover:opacity-70 transition-opacity"
              >
                support@unfoldk.com
              </a>
            </p>
            <p className="mt-2 text-[#9CA3AF]">UNFOLD LAB · unfoldk.com</p>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#0F0F0F] py-12 px-6 mt-12">
        <div className="max-w-[860px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-1 mb-2">
                <span className="font-bold text-white">UnfoldK Beauty</span>
                <span className="text-[#C8A882]">&#9670;</span>
              </div>
              <p className="text-[13px] text-white/40">Your gateway to verified K-Beauty trade.</p>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <Link href="/privacy" className="text-sm text-white/60 hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="text-sm text-white/60 hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/kbeauty/refund" className="text-sm text-white/60 hover:text-white transition-colors">Refund Policy</Link>
              <a href="mailto:support@unfoldk.com" className="text-sm text-white/60 hover:text-white transition-colors">Contact</a>
            </div>
          </div>
          <div className="border-t border-white/10 my-6" />
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-sm text-white/40">&copy; 2026 UnfoldK Beauty by Unfold Lab.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-white/60 hover:text-white transition-colors">
                <Instagram className="w-5 h-5" />
                <span className="sr-only">Instagram</span>
              </a>
              <a href="#" className="text-white/60 hover:text-white transition-colors">
                <Linkedin className="w-5 h-5" />
                <span className="sr-only">LinkedIn</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E8E2DA] rounded-xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <h2
        className="mb-3"
        style={{ fontSize: 16, fontWeight: 700, color: "#1A3A5C" }}
      >
        {title}
      </h2>
      <div className="text-sm text-[#6B6B6B] leading-relaxed space-y-1">{children}</div>
    </div>
  )
}
