import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Unfold K',
  description: 'Your Pass to Korean Culture',
  generator: 'v0.app',
  metadataBase: new URL('https://www.unfoldk.com'),
  icons: {
    icon: '/unfoldk_favicon.jpg',
    apple: '/unfoldk_favicon.jpg',
  },
  openGraph: {
    title: 'Unfold K',
    description: 'Your Pass to Korean Culture',
    url: 'https://www.unfoldk.com',
    siteName: 'Unfold K',
    images: [
      {
        url: 'https://www.unfoldk.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Unfold K — Your Pass to Korean Culture',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Unfold K',
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
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
