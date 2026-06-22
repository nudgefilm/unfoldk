import type { MetadataRoute } from "next"

const BASE_URL = "https://www.unfoldk.com"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticUrls: MetadataRoute.Sitemap = [
    { url: BASE_URL,                          lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE_URL}/name`,                lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/calendar`,            lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE_URL}/korean`,              lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/food`,                lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/curation-k`,          lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/blog`,                lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE_URL}/about`,               lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/careers`,             lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/contact`,             lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/privacy`,             lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE_URL}/terms`,               lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE_URL}/cookie`,              lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE_URL}/gdpr`,                lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ]

  return staticUrls
}
