import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import { Header } from '@/components/header'
import { PaddleProvider } from '@/components/PaddleProvider'
import './globals.css'
import 'flag-icons/css/flag-icons.min.css'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

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
  verification: {
    other: {
      'msvalidate.01': '1443F8775AAEF86D67C4DFE27F6ACD60',
    },
  },
}

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "UnfoldK",
  url: "https://www.unfoldk.com",
  description: "The all-in-one platform for Hallyu fans — K-pop, K-drama, Korean language, and more.",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: "https://www.unfoldk.com/kpop?q={search_term_string}" },
    "query-input": "required name=search_term_string",
  },
}

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "UnfoldK",
  url: "https://www.unfoldk.com",
  logo: "https://www.unfoldk.com/favicon.png",
  sameAs: [],
  description: "UnfoldK is the ultimate Hallyu fan platform — K-pop charts, K-drama tracker, Korean name generator, and more.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-background pt-[72px]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {/* Header 단일 마운트 — 페이지 navigation 간 unmount 안 돼 인증/프로필
            state 영속, 깜빡임 0. /admin·/login 등은 Header 내부에서 pathname 가드로 null 반환. */}
        <Header />
        <PaddleProvider>
        {children}
        </PaddleProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
        {PIXEL_ID && (
          <>
            <Script
              id="meta-pixel"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`,
              }}
            />
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
        <Script
          id="crisp-chat"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.$crisp=[];window.CRISP_WEBSITE_ID="7b8d0841-0a14-40b8-8501-87cfaaa21bbc";window.CRISP_READY_TRIGGER=function(){window.$crisp.push(["do","chat:hide"]);window.$crisp.push(["on","chat:closed",function(){window.$crisp.push(["do","chat:hide"]);}]);};(function(){var d=document;var s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`,
          }}
        />
      </body>
    </html>
  )
}
