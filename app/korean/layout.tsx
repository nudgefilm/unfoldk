import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Learn Korean Through K-dramas | HangeulGo by UnfoldK",
  description:
    "Learn Korean with phrases from your favorite K-dramas. Daily expressions, pronunciation guides, and drama-based lessons.",
  alternates: { canonical: "https://www.unfoldk.com/korean" },
  openGraph: {
    title: "Learn Korean Through K-dramas | HangeulGo by UnfoldK",
    description:
      "Learn Korean with phrases from your favorite K-dramas. Daily expressions, pronunciation guides, and drama-based lessons.",
    url: "https://www.unfoldk.com/korean",
    images: [{ url: "https://www.unfoldk.com/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Learn Korean Through K-dramas | HangeulGo by UnfoldK",
    description:
      "Learn Korean with phrases from your favorite K-dramas. Daily expressions, pronunciation guides, and drama-based lessons.",
  },
}

export default function KoreanLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
