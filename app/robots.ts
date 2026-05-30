import type { MetadataRoute } from "next"

const BASE_URL = "https://www.unfoldk.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/mypage/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
