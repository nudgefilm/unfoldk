import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Admin = ReturnType<typeof createSupabaseAdminClient>

export interface TrackedArtist {
  artist_id: string
  name: string
}

/**
 * 유저가 추적 중인 아티스트 목록을 두 소스에서 병합해 반환.
 *
 * 소스 A — kpop_artist_follows
 *   KpopStats "Track this artist" 버튼으로 직접 저장된 아티스트.
 *
 * 소스 B — user_calendar_subscriptions → hallyu_calendar_events → kpop_artists 이름 매칭
 *   HallyuCalendar Set Reminder 또는 Track 버튼 경유 이벤트 구독에서 추출.
 *
 * @param admin  service_role 클라이언트 (RLS 우회)
 * @param userId 특정 유저 ID. 생략 시 전체 유저 합산 (cron 용도).
 */
export async function getTrackedArtists(
  admin: Admin,
  userId?: string
): Promise<TrackedArtist[]> {
  const artistIdSet = new Set<string>()

  // ── 소스 A: kpop_artist_follows ────────────────────────────────────────────
  const { data: followRows } = userId
    ? await admin.from("kpop_artist_follows").select("artist_id").eq("user_id", userId)
    : await admin.from("kpop_artist_follows").select("artist_id")

  for (const row of (followRows ?? []) as Array<{ artist_id: string }>) {
    artistIdSet.add(row.artist_id)
  }

  // ── 소스 B: user_calendar_subscriptions → hallyu_calendar_events → kpop_artists ──
  const { data: subRows } = userId
    ? await admin.from("user_calendar_subscriptions").select("event_id").eq("user_id", userId)
    : await admin.from("user_calendar_subscriptions").select("event_id")

  const eventIds = [
    ...new Set(((subRows ?? []) as Array<{ event_id: string }>).map((r) => r.event_id)),
  ]

  if (eventIds.length > 0) {
    const { data: eventRows } = await admin
      .from("hallyu_calendar_events")
      .select("artist_or_drama")
      .in("id", eventIds)

    const eventNames = new Set<string>()
    for (const row of (eventRows ?? []) as Array<{ artist_or_drama: string | null }>) {
      const n = row.artist_or_drama?.trim().toLowerCase()
      if (n) eventNames.add(n)
    }

    if (eventNames.size > 0) {
      const { data: allArtists } = await admin
        .from("kpop_artists")
        .select("id, name, name_ko")
        .eq("is_active", true)
        .limit(2000)

      for (const a of (allArtists ?? []) as Array<{
        id: string
        name: string
        name_ko: string | null
      }>) {
        const n = a.name.toLowerCase()
        const nko = a.name_ko?.toLowerCase() ?? null
        const matched = [...eventNames].some(
          (en) => en.includes(n) || (nko !== null && en.includes(nko))
        )
        if (matched) artistIdSet.add(a.id)
      }
    }
  }

  if (artistIdSet.size === 0) return []

  // 아티스트 이름 조회
  const { data: artistRows } = await admin
    .from("kpop_artists")
    .select("id, name")
    .in("id", [...artistIdSet])

  return ((artistRows ?? []) as Array<{ id: string; name: string }>).map((r) => ({
    artist_id: r.id,
    name: r.name,
  }))
}
