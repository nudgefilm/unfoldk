import type { MetadataRoute } from "next"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const BASE_URL = "https://www.unfoldk.com"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticUrls: MetadataRoute.Sitemap = [
    { url: BASE_URL,                          lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE_URL}/name`,                lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/calendar`,            lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE_URL}/kpop`,                lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE_URL}/drama`,               lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
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

  // 동적 아티스트 상세 페이지 — kpop_artists 전체 목록 (is_active = true)
  let artistUrls: MetadataRoute.Sitemap = []
  try {
    const admin = createSupabaseAdminClient()
    const { data } = await admin
      .from("kpop_artists")
      .select("id, name, created_at")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(2000)

    if (data) {
      artistUrls = (data as Array<{ id: string; name: string; created_at: string }>).map((a) => ({
        url: `${BASE_URL}/kpop/${a.id}`,
        lastModified: new Date(a.created_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))
    }
  } catch {
    // sitemap 생성 실패해도 정적 URL은 반환
  }

  return [...staticUrls, ...artistUrls]
}
