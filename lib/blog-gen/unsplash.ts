// Unsplash 이미지 검색 — 블로그 cover 이미지 자동 매칭
//
// 흐름:
//   1. /search/photos?query=...&per_page=5&orientation=landscape
//   2. 결과 중 첫 번째 사진의 URL + 사진작가 이름 + 사진 페이지 URL 추출
//   3. (옵션) Unsplash 가이드라인의 download_location 을 GET — "download" 트래킹.
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

export async function searchUnsplashImage(query: string): Promise<UnsplashImage> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) {
    throw new UnsplashError("UNSPLASH_ACCESS_KEY 미설정")
  }

  const url = new URL("https://api.unsplash.com/search/photos")
  url.searchParams.set("query", query)
  url.searchParams.set("per_page", "5")
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
  const first = json.results?.[0]
  if (!first) {
    throw new UnsplashError(`검색 결과 없음 (query="${query}")`)
  }

  // 본문에 삽입할 이미지 URL — w=1600 로 cap (모바일~데스크탑 cover 적정)
  const imageBase = new URL(first.urls.raw)
  imageBase.searchParams.set("w", "1600")
  imageBase.searchParams.set("q", "80")
  imageBase.searchParams.set("auto", "format")
  imageBase.searchParams.set("fit", "max")

  const authorName = first.user.name?.trim() || first.user.username || "Unsplash photographer"
  const authorProfileUrl = `${first.user.links.html}?${UTM}`
  const photoPageUrl = `${first.links.html}?${UTM}`
  const imageCredit = `Photo by ${authorName} on Unsplash`

  // Unsplash 가이드라인 — 사용 시 download_location 비콘 GET (비차단)
  // 실패해도 본 함수의 성공 여부에 영향 없음.
  triggerDownloadBeacon(first.links.download_location, accessKey)

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
