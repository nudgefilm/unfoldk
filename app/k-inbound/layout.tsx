import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "K-Inbound Flight Simulator | UnfoldK",
  description: "Track real-time flights inbound to Korea on a 3D globe.",
}

export default function KInboundLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
