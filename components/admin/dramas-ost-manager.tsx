"use client"

// 어드민 — 드라마별 OST 아티스트 매핑 매니저
//
// UI:
//   - 좌측: 드라마 목록 + 검색 (title/title_ko) + 현재 매핑 카운트
//   - 우측: 선택 드라마 상세 + 검색으로 kpop_artists 추가 + 매핑 제거
// 저장:
//   - PATCH /api/admin/dramas/[id] body { ost_artist_ids: string[] }
//   - 변경 후 toast + 인라인 상태 갱신

import { useMemo, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Search, Music, X, Plus } from "lucide-react"
import type {
  AdminDramaRow,
  AdminKpopArtistOption,
} from "@/app/admin/dramas/page"

interface Props {
  dramas: AdminDramaRow[]
  artists: AdminKpopArtistOption[]
}

export function DramasOstManager({ dramas: initialDramas, artists }: Props) {
  const { toast } = useToast()
  const [dramas, setDramas] = useState<AdminDramaRow[]>(initialDramas)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDramas[0]?.id ?? null
  )
  const [artistSearch, setArtistSearch] = useState("")
  const [saving, setSaving] = useState(false)

  // 좌측 드라마 필터 — title / title_ko / original_name 검색
  const filteredDramas = useMemo(() => {
    if (!search.trim()) return dramas
    const q = search.trim().toLowerCase()
    return dramas.filter((d) => {
      return (
        d.title.toLowerCase().includes(q) ||
        (d.title_ko && d.title_ko.toLowerCase().includes(q)) ||
        (d.original_name && d.original_name.toLowerCase().includes(q))
      )
    })
  }, [dramas, search])

  const selected = useMemo(
    () => dramas.find((d) => d.id === selectedId) ?? null,
    [dramas, selectedId]
  )

  const selectedArtistIds = useMemo(
    () => selected?.ost_artist_ids ?? [],
    [selected]
  )

  const artistById = useMemo(() => {
    const map = new Map<string, AdminKpopArtistOption>()
    for (const a of artists) map.set(a.id, a)
    return map
  }, [artists])

  // 우측 검색 — 이미 매핑된 아티스트 제외
  const filteredArtists = useMemo(() => {
    const q = artistSearch.trim().toLowerCase()
    return artists
      .filter((a) => !selectedArtistIds.includes(a.id))
      .filter((a) => {
        if (!q) return true
        return (
          a.name.toLowerCase().includes(q) ||
          (a.name_ko && a.name_ko.toLowerCase().includes(q))
        )
      })
      .slice(0, 30)
  }, [artists, selectedArtistIds, artistSearch])

  const saveMapping = async (dramaId: string, newIds: string[]) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/dramas/${dramaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ost_artist_ids: newIds }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      // 로컬 state 갱신
      setDramas((prev) =>
        prev.map((d) =>
          d.id === dramaId ? { ...d, ost_artist_ids: newIds } : d
        )
      )
      toast({ title: "OST 매핑 업데이트 완료" })
    } catch (err) {
      console.error("[admin/dramas] 저장 실패:", err)
      toast({
        title: "저장 실패",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const addArtist = (artistId: string) => {
    if (!selected) return
    const next = [...selectedArtistIds, artistId]
    void saveMapping(selected.id, next)
  }

  const removeArtist = (artistId: string) => {
    if (!selected) return
    const next = selectedArtistIds.filter((id) => id !== artistId)
    void saveMapping(selected.id, next)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-4">
      {/* 좌측 — 드라마 목록 */}
      <aside className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 max-h-[700px] overflow-y-auto">
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dramas..."
            className="w-full bg-[#252525] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
        </div>
        <ul className="space-y-1">
          {filteredDramas.map((d) => {
            const count = d.ost_artist_ids?.length ?? 0
            const active = d.id === selectedId
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${
                    active
                      ? "bg-[#252525] text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-[#252525]/50"
                  }`}
                >
                  <div className="w-8 h-12 rounded bg-[#252525] flex-shrink-0 overflow-hidden">
                    {d.poster_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.poster_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.year ?? "—"} · {d.title_ko ?? d.original_name ?? ""}
                    </p>
                  </div>
                  {count > 0 && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{
                        backgroundColor: "rgba(255, 75, 110, 0.15)",
                        color: "#FF4B6E",
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
          {filteredDramas.length === 0 && (
            <li className="text-muted-foreground text-sm py-4 text-center">
              No matches.
            </li>
          )}
        </ul>
      </aside>

      {/* 우측 — 선택 드라마 상세 */}
      <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
        {!selected ? (
          <p className="text-muted-foreground text-sm">Select a drama to manage OST artists.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-foreground text-lg font-semibold mb-1">
                {selected.title}
              </h2>
              <p className="text-muted-foreground text-xs">
                {selected.year ?? "—"} ·{" "}
                {selected.title_ko ?? selected.original_name ?? ""}
              </p>
            </div>

            {/* 현재 매핑된 아티스트 */}
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
                Linked OST artists
              </p>
              {selectedArtistIds.length === 0 ? (
                <p className="text-muted-foreground text-sm">No artists linked yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedArtistIds.map((id) => {
                    const a = artistById.get(id)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#252525] border border-[#2a2a2a] text-xs text-foreground"
                      >
                        {a?.thumbnail_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.thumbnail_url}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        )}
                        <Music className="w-3 h-3 text-muted-foreground" />
                        {a?.name ?? `Unknown (${id.slice(0, 8)}…)`}
                        <button
                          type="button"
                          onClick={() => removeArtist(id)}
                          disabled={saving}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                          aria-label={`Remove ${a?.name ?? "artist"}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 검색으로 아티스트 추가 */}
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
                Add artist
              </p>
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={artistSearch}
                  onChange={(e) => setArtistSearch(e.target.value)}
                  placeholder="Search kpop_artists..."
                  className="w-full bg-[#252525] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
              <ul className="max-h-[300px] overflow-y-auto space-y-1">
                {filteredArtists.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => addArtist(a.id)}
                      disabled={saving}
                      className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 text-muted-foreground hover:text-foreground hover:bg-[#252525] disabled:opacity-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#252525] overflow-hidden flex-shrink-0">
                        {a.thumbnail_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.thumbnail_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">
                          {a.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.name_ko ?? ""}
                          {a.member_count != null
                            ? ` · ${a.member_count === 1 ? "Solo" : `${a.member_count} members`}`
                            : ""}
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  </li>
                ))}
                {filteredArtists.length === 0 && (
                  <li className="text-muted-foreground text-sm py-4 text-center">
                    No matches.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
