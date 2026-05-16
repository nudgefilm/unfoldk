import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Header } from '@/components/header'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'UnfoldK',
  description: 'Your Pass to Korean Culture',
  generator: 'v0.app',
  metadataBase: new URL('https://www.unfoldk.com'),
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'UnfoldK',
    description: 'Your Pass to Korean Culture',
    url: 'https://www.unfoldk.com',
    siteName: 'UnfoldK',
    images: [
      {
        url: 'https://www.unfoldk.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'UnfoldK — Your Pass to Korean Culture',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UnfoldK',
    description: 'Your Pass to Korean Culture',
    images: ['https://www.unfoldk.com/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-background pt-[72px]">
        {/* Header 단일 마운트 — 페이지 navigation 간 unmount 안 돼 인증/프로필
            state 영속, 깜빡임 0. /admin·/login 등은 Header 내부에서 pathname 가드로 null 반환. */}
        <Header />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
