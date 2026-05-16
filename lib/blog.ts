// 블로그 — content/blog/*.mdx 파일 시스템 기반
//
// 동작:
//   - content/blog/*.mdx 를 디스크에서 읽어 frontmatter (gray-matter) + 본문 (string) 으로 분리
//   - 목록(getAllPosts) 은 frontmatter 만, 본문 미반환 (메모리·페이로드 절약)
//   - 상세(getPostBySlug) 는 frontmatter + raw body 반환 (서버 컴포넌트에서 MDXRemote 로 렌더)
//
// frontmatter 필수 필드:
//   title, description, date (YYYY-MM-DD), author
// 선택 필드:
//   tags (string[])
//   cover / image (이미지 URL — image 가 우선. cover 는 하위 호환)
//   imageCredit (이미지 출처 텍스트, 예: "Photo by Foo on Unsplash")
//   readingTime (수동 분 단위 override — 누락 시 본문 길이로 자동 추정)
//   draft (boolean) — true 면 목록 제외 (단일 URL 직접 접근은 허용)

import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"

const BLOG_DIR = path.join(process.cwd(), "content", "blog")

export interface BlogFrontmatter {
  title: string
  description: string
  date: string
  author: string
  tags?: string[]
  cover?: string
  imageCredit?: string
  draft?: boolean
}

export interface BlogPostMeta extends BlogFrontmatter {
  slug: string
  readingTimeMinutes: number
}

export interface BlogPost extends BlogPostMeta {
  content: string
}

// 파일명에서 slug 추출 — "2026-05-16-hello.mdx" → "hello", "hello.mdx" → "hello"
// 날짜 prefix 가 있으면 제거. 없으면 그대로 사용.
function fileToSlug(filename: string): string {
  const base = filename.replace(/\.mdx?$/, "")
  return base.replace(/^\d{4}-\d{2}-\d{2}-/, "")
}

// 대략적인 읽기 시간 — 한·영 혼용 기준 분당 200 단어 (라틴) + 한글 350자/분 평균.
// 정확한 분리는 과한 비용. 토큰화 없이 길이로만 추정.
function estimateReadingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).length
  const minutes = Math.max(1, Math.round(words / 200))
  return minutes
}

function readPostFile(filename: string): BlogPost | null {
  const fullPath = path.join(BLOG_DIR, filename)
  if (!fs.existsSync(fullPath)) return null
  const raw = fs.readFileSync(fullPath, "utf8")
  const { data, content } = matter(raw)

  // frontmatter 최소 검증 — 누락 시 콘솔 경고 후 skip
  if (!data.title || !data.date) {
    console.warn(`[blog] frontmatter 누락 (title/date), skip: ${filename}`)
    return null
  }

  // image 와 cover 둘 다 지원 — image 가 우선 (cron 자동 생성 frontmatter 규약).
  const coverUrl = data.image ? String(data.image) : data.cover ? String(data.cover) : undefined

  // readingTime frontmatter override — 정수면 사용, 아니면 본문 길이로 추정
  const fmReadingTime = typeof data.readingTime === "number" && data.readingTime > 0
    ? Math.round(data.readingTime)
    : null

  const fm: BlogFrontmatter = {
    title: String(data.title),
    description: String(data.description ?? ""),
    date: String(data.date),
    author: String(data.author ?? "UnfoldK"),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : undefined,
    cover: coverUrl,
    imageCredit: data.imageCredit ? String(data.imageCredit) : undefined,
    draft: data.draft === true,
  }

  return {
    ...fm,
    slug: fileToSlug(filename),
    readingTimeMinutes: fmReadingTime ?? estimateReadingMinutes(content),
    content,
  }
}

// 모든 발행 포스트 (draft 제외, 날짜 desc)
export function getAllPosts(): BlogPostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  const files = fs.readdirSync(BLOG_DIR).filter((f) => /\.mdx?$/.test(f))
  const posts: BlogPostMeta[] = []

  for (const file of files) {
    const post = readPostFile(file)
    if (!post) continue
    if (post.draft) continue
    // 목록에서는 content 제외 (메모리)
    const { content: _omit, ...meta } = post
    void _omit
    posts.push(meta)
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : -1))
  return posts
}

// 단일 포스트 — draft 도 직접 URL 접근 시엔 허용 (preview 목적). 목록엔 안 뜸.
export function getPostBySlug(slug: string): BlogPost | null {
  if (!fs.existsSync(BLOG_DIR)) return null

  const files = fs.readdirSync(BLOG_DIR).filter((f) => /\.mdx?$/.test(f))
  for (const file of files) {
    if (fileToSlug(file) === slug) {
      return readPostFile(file)
    }
  }
  return null
}

// 정적 경로 생성용
export function getAllSlugs(): string[] {
  return getAllPosts().map((p) => p.slug)
}

// 사람이 읽는 날짜 — "May 16, 2026"
export function formatBlogDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
