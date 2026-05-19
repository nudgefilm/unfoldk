// Unsplash 이미지 검색 — 블로그 cover 이미지 자동 매칭
//
// 흐름:
//   1. /search/photos?query=...&per_page=15&orientation=landscape
//   2. (옵션) excludeImageSlugs 로 기존 포스트에 쓰인 이미지 필터링 (중복 회피)
//   3. 남은 결과 중 랜덤 선택 (per_page 의 1~k 사이) — 같은 query 라도 다양성 확보
//   4. (옵션) Unsplash 가이드라인의 download_location 을 GET — "download" 트래킹.
//      비차단 fire-and-forget.
//
// API 키: UNSPLASH_ACCESS_KEY 환경변수 (Server-side only)
// Rate limit: free tier 50 req/hour. 일 1회 호출이라 여유 충분.
//
// 실패 시 throw — 호출자(run.ts) 가 GitHub push 까지 진행 안 함.

export interface UnsplashImage {
  imageUrl: string // 본문에 삽입할 이미지 URL (raw + w 파라미터)
  imageCredit: string // "Photo by Foo Bar on Unsplash"
  photoPageUrl: string // unsplash 사진 페이지 (출처 링크)
  authorName: string
  authorProfileUrl: string
}

export class UnsplashError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsplashError"
  }
}

interface UnsplashSearchResponse {
  results: Array<{
    id: string
    urls: {
      raw: string
      full: string
      regular: string
    }
    links: {
      html: string
      download_location: string
    }
    user: {
      name: string
      username: string
      links: {
        html: string
      }
    }
  }>
}

const UTM = "utm_source=unfoldk&utm_medium=referral"
const PER_PAGE = 15

// URL → Unsplash slug (`photo-{...}` 뒷부분). 식별자.
function extractSlugFromUrl(url: string): string | null {
  const m = url.match(/images\.unsplash\.com\/photo-([^?]+)/)
  return m?.[1] ?? null
}

export async function searchUnsplashImage(
  query: string,
  opts: { excludeImageSlugs?: Set<string> } = {}
): Promise<UnsplashImage> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) {
    throw new UnsplashError("UNSPLASH_ACCESS_KEY 미설정")
  }

  const url = new URL("https://api.unsplash.com/search/photos")
  url.searchParams.set("query", query)
  url.searchParams.set("per_page", String(PER_PAGE))
  url.searchParams.set("orientation", "landscape")
  url.searchParams.set("content_filter", "high") // 안전한 콘텐츠만

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
    })
  } catch (err) {
    throw new UnsplashError(
      `네트워크 오류: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!response.ok) {
    throw new UnsplashError(`HTTP ${response.status} from /search/photos`)
  }

  const json = (await response.json()) as UnsplashSearchResponse
  const allResults = json.results ?? []
  if (allResults.length === 0) {
    throw new UnsplashError(`검색 결과 없음 (query="${query}")`)
  }

  // 중복 회피 — 기존 포스트 슬러그 제외. 전부 제외되면 전체에서 랜덤 (마지막 fallback).
  const excludeSlugs = opts.excludeImageSlugs
  const filtered =
    excludeSlugs && excludeSlugs.size > 0
      ? allResults.filter((r) => {
          const slug = extractSlugFromUrl(r.urls.raw)
          return slug === null || !excludeSlugs.has(slug)
        })
      : allResults

  const pool = filtered.length > 0 ? filtered : allResults
  const pick = pool[Math.floor(Math.random() * pool.length)]

  // 본문에 삽입할 이미지 URL — w=1600 로 cap (모바일~데스크탑 cover 적정)
  const imageBase = new URL(pick.urls.raw)
  imageBase.searchParams.set("w", "1600")
  imageBase.searchParams.set("q", "80")
  imageBase.searchParams.set("auto", "format")
  imageBase.searchParams.set("fit", "max")

  const authorName = pick.user.name?.trim() || pick.user.username || "Unsplash photographer"
  const authorProfileUrl = `${pick.user.links.html}?${UTM}`
  const photoPageUrl = `${pick.links.html}?${UTM}`
  const imageCredit = `Photo by ${authorName} on Unsplash`

  // Unsplash 가이드라인 — 사용 시 download_location 비콘 GET (비차단)
  // 실패해도 본 함수의 성공 여부에 영향 없음.
  triggerDownloadBeacon(pick.links.download_location, accessKey)

  return {
    imageUrl: imageBase.toString(),
    imageCredit,
    photoPageUrl,
    authorName,
    authorProfileUrl,
  }
}

function triggerDownloadBeacon(downloadLocation: string, accessKey: string): void {
  // fire-and-forget — Promise 무시
  fetch(downloadLocation, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  }).catch((err) => {
    console.warn("[unsplash] download beacon 실패 (무시):", err)
  })
}
