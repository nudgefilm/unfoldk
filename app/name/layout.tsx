import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Korean Name Generator — Get Your Korean Name Free | UnfoldK",
  description:
    "Discover your Korean name based on your personality, favorite K-pop artist, and MBTI. Free Korean name generator loved by Hallyu fans worldwide.",
  keywords: [
    "Korean name generator",
    "my Korean name",
    "Kpop Korean name",
    "Korean name for English name",
    "한글 이름",
    "get Korean name",
    "K-drama Korean name",
    "free Korean name",
    "Korean name meaning",
  ],
  alternates: { canonical: "https://www.unfoldk.com/name" },
  openGraph: {
    title: "Korean Name Generator — Get Your Korean Name Free | UnfoldK",
    description:
      "Discover your Korean name based on your personality, favorite K-pop artist, and MBTI. Free Korean name generator loved by Hallyu fans worldwide.",
    url: "https://www.unfoldk.com/name",
    images: [{ url: "https://www.unfoldk.com/og-image.png", width: 1200, height: 630, alt: "Korean Name Generator by UnfoldK" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Korean Name Generator — Get Your Korean Name Free | UnfoldK",
    description:
      "Discover your Korean name based on your personality, favorite K-pop artist, and MBTI. Free Korean name generator loved by Hallyu fans worldwide.",
    images: ["https://www.unfoldk.com/og-image.png"],
  },
}

const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Korean Name Generator",
  url: "https://www.unfoldk.com/name",
  applicationCategory: "EntertainmentApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description:
    "Free Korean name generator that creates authentic Korean names based on your personality vibe, gender feel, and favorite K-pop style.",
  provider: {
    "@type": "Organization",
    name: "UnfoldK",
    url: "https://www.unfoldk.com",
  },
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does the Korean name generator work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our Korean name generator matches your personality vibe and gender preference to curated Korean names. Each name is composed of meaningful Korean characters (한자) selected to reflect your chosen style — bright, cool, strong, gentle, creative, or smart.",
      },
    },
    {
      "@type": "Question",
      name: "Are the Korean names authentic?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Every name in our generator uses real Korean surname-given name combinations that native Koreans actually use. Each character carries a specific meaning, just like real Korean names given at birth.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use my Korean name on social media?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely. Many K-pop fans use their Korean names as fan names on platforms like Twitter, Instagram, and TikTok. Your Korean name from UnfoldK comes with romanization (e.g. Lee Seo-yeon) so non-Korean speakers can read it too.",
      },
    },
    {
      "@type": "Question",
      name: "What is the Korean name format?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Korean names follow the format: Family name (성) + Given name (이름). For example, '이서연' — 이 is the family name (Lee), 서연 is the given name. Korean family names are typically one syllable, and given names are one or two syllables.",
      },
    },
    {
      "@type": "Question",
      name: "Is the Korean name generator free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, the Korean name generator is completely free. No sign-up required — just pick your vibe, choose a gender feel, and get your Korean name instantly.",
      },
    },
  ],
}

export default function NameLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {children}
    </>
  )
}
