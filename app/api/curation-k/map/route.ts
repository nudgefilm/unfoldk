import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/curation-k/map — 지도 핀 데이터 (filming_spots + kpop_spots 통합)
//
// RLS:
//   - filming_spots: status='confirmed' 행만 (정책)
//   - kpop_spots: 전체 (정책)
// 클라가 카테고리 토글로 client-side 필터.
//
// GPS 없는 spot 은 핀 불가 → 응답에서 제외.

export const revalidate = 600 // 10분 CDN 캐시

interface FilmingRow {
  id: string
  drama_title: string
  spot_name: string
  region: string | null
  latitude: number | string | null
  longitude: number | string | null
  address: string | null
  image_url: string | null
}

interface KpopRow {
  id: string
  artist_name: string
  spot_name: string
  spot_type: string
  region: string | null
  latitude: number | string | null
  longitude: number | string | null
  address: string | null
  image_url: string | null
}

export interface MapPin {
  id: string
  category: "filming" | "kpop"
  name: string                  // 표시 라벨
  subtitle: string              // 부제 (드라마명 / 아티스트명 + 유형)
  region: string | null
  address: string | null
  image_url: string | null
  lat: number
  lng: number
  spot_type?: string            // kpop 만
}

function toFinite(n: number | string | null): number | null {
  if (n === null) return null
  const v = typeof n === "string" ? Number(n) : n
  return Number.isFinite(v) ? v : null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const [filmingRes, kpopRes] = await Promise.all([
    supabase
      .from("filming_spots")
      .select("id, drama_title, spot_name, region, latitude, longitude, address, image_url")
      .neq("spot_name", "__no_spots_found__"),
    supabase
      .from("kpop_spots")
      .select("id, artist_name, spot_name, spot_type, region, latitude, longitude, address, image_url"),
  ])

  if (filmingRes.error) {
    console.error("[curation-k/map] filming fetch 실패:", filmingRes.error.message)
  }
  if (kpopRes.error) {
    console.error("[curation-k/map] kpop fetch 실패:", kpopRes.error.message)
  }

  const pins: MapPin[] = []

  for (const r of ((filmingRes.data ?? []) as FilmingRow[])) {
    const lat = toFinite(r.latitude)
    const lng = toFinite(r.longitude)
    if (lat === null || lng === null) continue
    pins.push({
      id: r.id,
      category: "filming",
      name: r.spot_name,
      subtitle: r.drama_title,
      region: r.region,
      address: r.address,
      image_url: r.image_url,
      lat,
      lng,
    })
  }

  for (const r of ((kpopRes.data ?? []) as KpopRow[])) {
    const lat = toFinite(r.latitude)
    const lng = toFinite(r.longitude)
    if (lat === null || lng === null) continue
    const subtitlePrefix = r.artist_name
    const typeLabel =
      r.spot_type === "agency"
        ? "Agency"
        : r.spot_type === "mv_location"
          ? "MV location"
          : r.spot_type === "cafe"
            ? "Café"
            : r.spot_type === "concert_venue"
              ? "Concert venue"
              : r.spot_type
    pins.push({
      id: r.id,
      category: "kpop",
      name: r.spot_name,
      subtitle: `${subtitlePrefix} · ${typeLabel}`,
      region: r.region,
      address: r.address,
      image_url: r.image_url,
      lat,
      lng,
      spot_type: r.spot_type,
    })
  }

  return NextResponse.json(
    { pins },
    {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" },
    }
  )
}
