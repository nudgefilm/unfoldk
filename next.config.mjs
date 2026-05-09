/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    // Google OAuth 프로필 이미지 CDN — 향후 next/image 전환 시 필요
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      // TMDB 포스터·썸네일 — KdramaMatch / HallyuCalendar 카드에 사용
      // 출처 표기 의무: "This product uses the TMDB API but is not endorsed or certified by TMDB."
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
    ],
  },
}

export default nextConfig
