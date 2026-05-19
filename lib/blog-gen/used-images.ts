// 기존 블로그 포스트의 cover image 슬러그 수집 — 중복 이미지 회피용
//
// 흐름:
//   1) GitHub Contents API 로 `content/blog/` 디렉토리 list
//   2) 파일명 desc 정렬 (YYYY-MM-DD-* 패턴이라 자연스러운 최신순)
//   3) 최근 N 개 파일의 raw 본문 fetch → frontmatter `image:` 라인 파싱
//   4) Unsplash URL 에서 slug (`photo-{timestamp}-{hash}`) 추출 → Set 반환
//
// "slug" 정의: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=1600`
// → `1535713875002-d1d0cf377fde`. Unsplash API 의 `id` (M-MBuQ-pXqI 형태) 와는 다른 식별자지만
// 동일 사진에 대해 URL slug 는 영구 동일. URL 만 저장된 기존 포스트에서도 추출 가능.

import { GitHubError } from "./github"

const DEFAULT_LIMIT = 30
const BLOG_DIR = "content/blog"

interface GitHubDirEntry {
  name: string
  type: "file" | "dir" | "symlink" | "submodule"
  path: string
  download_url: string | null
}

function getConfig() {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  const branch = process.env.GITHUB_BRANCH ?? "main"
  if (!token) throw new GitHubError("GITHUB_TOKEN 미설정")
  if (!repo) throw new GitHubError("GITHUB_REPO 미설정")
  return { token, repo, branch }
}

// Unsplash 이미지 URL → 슬러그.
// 매칭 안 되면 null (Unsplash 가 아닌 URL 이거나 형식 변경).
export function extractUnsplashSlug(url: string): string | null {
  if (!url) return null
  // images.unsplash.com/photo-{slug}(?...)
  const m = url.match(/images\.unsplash\.com\/photo-([^?]+)/)
  return m?.[1] ?? null
}

// content/blog 디렉토리 listing
async function listBlogFiles(): Promise<GitHubDirEntry[]> {
  const { token, repo, branch } = getConfig()
  const url = `https://api.github.com/repos/${repo}/contents/${BLOG_DIR}?ref=${encodeURIComponent(branch)}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "unfoldk-blog-cron",
    },
    cache: "no-store",
  })

  if (res.status === 404) return []                 // 디렉토리 미존재 — 첫 실행
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new GitHubError(
      `listBlogFiles HTTP ${res.status}: ${body.slice(0, 200)}`,
      res.status
    )
  }

  const json = (await res.json()) as GitHubDirEntry[] | unknown
  if (!Array.isArray(json)) return []
  return json.filter((e) => e.type === "file" && e.name.endsWith(".mdx"))
}

// MDX frontmatter 의 image: 라인 추출.
// 형식: image: "https://images.unsplash.com/photo-..." (yaml double-quoted)
function extractFrontmatterImage(mdx: string): string | null {
  // frontmatter 만 빠르게 추출 — 두 번째 "---" 까지
  const fmMatch = mdx.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) return null
  const fm = fmMatch[1]
  // image: "..." 또는 image: ... 둘 다 매칭
  const imgLine = fm.match(/^image:\s*(.+)$/m)
  if (!imgLine) return null
  // 따옴표 제거
  return imgLine[1].trim().replace(/^["']|["']$/g, "")
}

// 최근 N 개 블로그 포스트의 Unsplash slug 집합. 실패해도 빈 Set 반환 (dedup 안 되더라도
// 생성 자체는 진행) — 호출자가 swallow.
export async function listRecentBlogImageSlugs(
  limit = DEFAULT_LIMIT
): Promise<Set<string>> {
  const slugs = new Set<string>()

  let files: GitHubDirEntry[]
  try {
    files = await listBlogFiles()
  } catch (err) {
    console.warn(
      "[blog-gen/used-images] listBlogFiles 실패 — 중복 회피 비활성:",
      err instanceof Error ? err.message : String(err)
    )
    return slugs
  }

  // 파일명 패턴 YYYY-MM-DD-slug.mdx → desc 정렬로 최신순
  files.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0))
  const target = files.slice(0, limit)

  // raw 본문 병렬 fetch — 30개 × 평균 5KB ≈ 가벼움. download_url 은 인증 불필요.
  await Promise.all(
    target.map(async (file) => {
      if (!file.download_url) return
      try {
        const res = await fetch(file.download_url, { cache: "no-store" })
        if (!res.ok) return
        const text = await res.text()
        const imgUrl = extractFrontmatterImage(text)
        if (!imgUrl) return
        const slug = extractUnsplashSlug(imgUrl)
        if (slug) slugs.add(slug)
      } catch (err) {
        console.warn(
          `[blog-gen/used-images] ${file.name} 본문 fetch 실패:`,
          err instanceof Error ? err.message : String(err)
        )
      }
    })
  )

  return slugs
}
