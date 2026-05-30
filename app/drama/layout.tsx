import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "K-drama Recommendations & Watch Tracker | KdramaMatch by UnfoldK",
  description:
    "Get personalized K-drama recommendations powered by UnfoldK. Track what you're watching and discover your next favorite series.",
  alternates: { canonical: "https://www.unfoldk.com/drama" },
  openGraph: {
    title: "K-drama Recommendations & Watch Tracker | KdramaMatch by UnfoldK",
    description:
      "Get personalized K-drama recommendations powered by UnfoldK. Track what you're watching and discover your next favorite series.",
    url: "https://www.unfoldk.com/drama",
    images: [{ url: "https://www.unfoldk.com/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "K-drama Recommendations & Watch Tracker | KdramaMatch by UnfoldK",
    description:
      "Get personalized K-drama recommendations powered by UnfoldK. Track what you're watching and discover your next favorite series.",
  },
}

export default function DramaLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
