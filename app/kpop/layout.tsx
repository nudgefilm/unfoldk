import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "K-pop Global Charts & Streaming Stats | KpopStats by UnfoldK",
  description:
    "Real-time K-pop artist rankings, global listener data, and weekly chart analysis. Track your favorite artist's worldwide growth.",
  alternates: { canonical: "https://www.unfoldk.com/kpop" },
  openGraph: {
    title: "K-pop Global Charts & Streaming Stats | KpopStats by UnfoldK",
    description:
      "Real-time K-pop artist rankings, global listener data, and weekly chart analysis. Track your favorite artist's worldwide growth.",
    url: "https://www.unfoldk.com/kpop",
    images: [{ url: "https://www.unfoldk.com/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "K-pop Global Charts & Streaming Stats | KpopStats by UnfoldK",
    description:
      "Real-time K-pop artist rankings, global listener data, and weekly chart analysis. Track your favorite artist's worldwide growth.",
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "KpopStats",
  url: "https://www.unfoldk.com/kpop",
  applicationCategory: "EntertainmentApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description:
    "Real-time K-pop artist rankings, global listener data, and weekly chart analysis.",
}

export default function KpopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
