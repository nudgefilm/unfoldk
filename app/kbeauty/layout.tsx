import type { Metadata } from "next"
import { Cormorant_Garamond } from "next/font/google"

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
})

export const metadata: Metadata = {
  title: "UnfoldK Beauty - B2B K-Beauty Platform",
  description:
    "Connect with verified K-Beauty suppliers and buyers. Global customs data backed. FDA-registered Korean manufacturers.",
}

export default function BeautyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${cormorantGaramond.variable} -mt-[72px]`}
      style={{
        fontFamily:
          '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
      }}
    >
      {children}
    </div>
  )
}
