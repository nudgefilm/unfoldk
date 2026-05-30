import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "K-pop & K-drama Event Calendar 2026 | HallyuCalendar by UnfoldK",
  description:
    "Never miss a K-pop comeback, concert, or K-drama premiere. Subscribe to the ultimate Hallyu event calendar with Google Calendar sync.",
  alternates: { canonical: "https://www.unfoldk.com/calendar" },
  openGraph: {
    title: "K-pop & K-drama Event Calendar 2026 | HallyuCalendar by UnfoldK",
    description:
      "Never miss a K-pop comeback, concert, or K-drama premiere. Subscribe to the ultimate Hallyu event calendar with Google Calendar sync.",
    url: "https://www.unfoldk.com/calendar",
    images: [{ url: "https://www.unfoldk.com/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "K-pop & K-drama Event Calendar 2026 | HallyuCalendar by UnfoldK",
    description:
      "Never miss a K-pop comeback, concert, or K-drama premiere. Subscribe to the ultimate Hallyu event calendar with Google Calendar sync.",
  },
}

export default function CalendarLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
