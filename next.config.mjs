/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/hallyu-news", destination: "/hallyu-feed", permanent: true },
      { source: "/hallyu-news/:path*", destination: "/hallyu-feed/:path*", permanent: true },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // next/image 옵티마이저 비활성 — 메인 페이지의 next/image 사용처 (testimonial,
    // social-proof, large-testimonial) 가 로컬 SVG·PNG 까지 전부 optimizer 함수에
    // 통과시켜 Vercel Image Optimization cold start 가 누적, 메인 페이지 hang +
    // Ghost Globe 미작동 발생 (커밋 f4f0f80 이후). 출시 전 strict 전환 보류.
    // remotePatterns 은 외부 도메인 next/image 사용 시 대비 유지.
    unoptimized: true,
    remotePatterns: [
      // Google OAuth 프로필 이미지 CDN
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      // TMDB 포스터·썸네일 — KdramaMatch / HallyuCalendar 카드.
      // 출처 표기 의무: "This product uses the TMDB API but is not endorsed or certified by TMDB."
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      // YouTube 채널 썸네일 — KpopStats 아티스트 프로필
      {
        protocol: "https",
        hostname: "yt3.googleusercontent.com",
      },
      // Ticketmaster 이벤트 썸네일 — HallyuCalendar Featured 카드
      {
        protocol: "https",
        hostname: "s1.ticketm.net",
      },
      // YouTube 영상 썸네일 (img.youtube.com/vi/{videoId}/...) — YouTube 컴백 이벤트
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
    ],
  },
}

export default nextConfig
