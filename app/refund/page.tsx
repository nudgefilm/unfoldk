import { FooterSection } from "@/components/footer-section"

export const metadata = {
  title: "Refund Policy — UnfoldK",
  description: "UnfoldK refund and cancellation policy for subscriptions and one-time purchases.",
}

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[800px] mx-auto px-5 py-16 md:py-24">
        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-3">
          Refund Policy
        </h1>
        <p className="text-muted-foreground text-center mb-12">
          Last updated: June 6, 2026
        </p>

        {/* Content */}
        <div className="space-y-6">
          <Section title="Overview">
            <p>
              We want you to feel confident subscribing to UnfoldK. This policy outlines when and
              how refunds are issued for our subscription plans and one-time purchases. All payments
              are processed by <strong className="text-foreground">Paddle</strong> (paddle.com), our
              Merchant of Record. Paddle handles billing, taxes, and refunds on behalf of UNFOLD LAB.
            </p>
          </Section>

          <Section title="Monthly Subscription (Hallyu Pass)">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>You may cancel your subscription at any time from <strong className="text-foreground">My Page → Subscription</strong>.</li>
              <li>Access continues until the end of the current billing period.</li>
              <li>
                <strong className="text-foreground">No refunds</strong> are issued for the remaining
                days of an active monthly billing period after cancellation.
              </li>
            </ul>
          </Section>

          <Section title="Annual Subscription (Hallyu Pass)">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>You may cancel your annual plan at any time.</li>
              <li>
                If you request a refund within <strong className="text-foreground">14 days of purchase</strong>,
                you are eligible for a full refund — no questions asked.
              </li>
              <li>Refund requests made after 14 days are not eligible.</li>
              <li>To request a refund, email us at <a href="mailto:support@unfoldk.com" className="underline hover:text-foreground transition-colors">support@unfoldk.com</a> with your order details.</li>
            </ul>
          </Section>

          <Section title="One-Time Purchase — Sourcing Sniper">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>
                Sourcing Sniper is a one-time lifetime purchase available within the UnfoldK Beauty platform.
              </li>
              <li>
                If you request a refund within <strong className="text-foreground">7 days of purchase</strong> and
                have not actively used the Sourcing Sniper features, you are eligible for a full refund.
              </li>
              <li>
                &quot;Active use&quot; means running one or more sourcing scans or accessing supplier intelligence reports.
              </li>
              <li>
                To request a refund, email <a href="mailto:support@unfoldk.com" className="underline hover:text-foreground transition-colors">support@unfoldk.com</a> within 7 days of your purchase date.
              </li>
            </ul>
          </Section>

          <Section title="How Refunds Are Processed">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Approved refunds are returned to the original payment method.</li>
              <li>Processing time is typically 5–10 business days depending on your bank or card issuer.</li>
              <li>Refunds are handled by Paddle on behalf of UNFOLD LAB. You may receive correspondence from Paddle during the process.</li>
            </ul>
          </Section>

          <Section title="Exceptions">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Refunds will not be issued for accounts suspended or terminated due to violations of our <a href="/terms" className="underline hover:text-foreground transition-colors">Terms of Use</a>.</li>
              <li>Promotional or discounted purchases may be non-refundable — this will be stated at the time of purchase.</li>
            </ul>
          </Section>

          <Section title="Contact">
            <p>
              For any refund request or billing question, please contact us at:{" "}
              <a href="mailto:support@unfoldk.com" className="underline hover:text-foreground transition-colors font-medium">
                support@unfoldk.com
              </a>
            </p>
            <p className="mt-2">
              UNFOLD LAB · unfoldk.com
            </p>
          </Section>
        </div>
      </main>

      <FooterSection />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="text-muted-foreground leading-relaxed">{children}</div>
    </div>
  )
}
