import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "K-drama Filming Locations & Korea Travel Guide | Curation K by UnfoldK",
  description:
    "Explore K-drama filming spots, K-pop pilgrimages, and hidden gems across Korea. Your ultimate Hallyu travel guide.",
  alternates: { canonical: "https://www.unfoldk.com/curation-k" },
  openGraph: {
    title: "K-drama Filming Locations & Korea Travel Guide | Curation K by UnfoldK",
    description:
      "Explore K-drama filming spots, K-pop pilgrimages, and hidden gems across Korea. Your ultimate Hallyu travel guide.",
    url: "https://www.unfoldk.com/curation-k",
    images: [{ url: "https://www.unfoldk.com/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "K-drama Filming Locations & Korea Travel Guide | Curation K by UnfoldK",
    description:
      "Explore K-drama filming spots, K-pop pilgrimages, and hidden gems across Korea. Your ultimate Hallyu travel guide.",
  },
}

export default function CurationKLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
