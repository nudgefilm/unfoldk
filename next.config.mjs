/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // 외부 이미지 도메인 명시적 허용. next/image 최적화 활성 (이전 unoptimized:true 제거).
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
