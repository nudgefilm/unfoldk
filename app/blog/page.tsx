// /blog — 블로그 목록 (페이지네이션)
// Server Component. content/blog/*.mdx 를 build 시 읽어 frontmatter 만 렌더.
// 빈 상태 (포스트 0건) 는 안내 카드로 fallback.
// ?page=N 쿼리로 12개씩 페이지네이션. 첫·마지막 + 현재 ±2 + ellipsis 패턴.
// Link 기본 scroll=true 로 페이지 변경 시 상단 이동 (App Router 기본).

import Link from "next/link"
import type { Metadata } from "next"
import { FooterSection } from "@/components/footer-section"
import { BookOpen, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { getAllPosts, formatBlogDate } from "@/lib/blog"

export const metadata: Metadata = {
  title: "Blog · UnfoldK",
  description: "Long-form features, artist deep-dives, and Korean-culture guides from UnfoldK.",
}

const POSTS_PER_PAGE = 12

// 페이지네이션 표시 — 항상 첫·마지막 페이지 + 현재 ±2 + 사이 공백은 ellipsis.
// edge 보정: current<=4 면 앞 5개 / current>=total-3 이면 뒤 5개 (app/food/page.tsx 동일 패턴).
type PaginationItem = number | "ellipsis-left" | "ellipsis-right"
function getPaginationItems(current: number, total: number): PaginationItem[] {
  if (total <= 1) return [1]
  let start: number
  let end: number
  if (current <= 4) {
    start = 2
    end = Math.min(total - 1, 5)
  } else if (current >= total - 3) {
    start = Math.max(2, total - 4)
    end = total - 1
  } else {
    start = current - 2
    end = current + 2
  }
  const items: PaginationItem[] = [1]
  if (start > 2) items.push("ellipsis-left")
  for (let i = start; i <= end; i++) items.push(i)
  if (end < total - 1) items.push("ellipsis-right")
  items.push(total)
  return items
}

// 페이지 N → href. 1페이지는 query 없는 canonical URL (?page=1 중복 노출 방지).
function pageHref(page: number): string {
  return page === 1 ? "/blog" : `/blog?page=${page}`
}

interface BlogPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function BlogIndexPage({ searchParams }: BlogPageProps) {
  const posts = getAllPosts()
  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE))

  // ?page= 파싱 — 1 ~ totalPages 범위 강제. 잘못된 값은 1 로 fallback.
  const { page: pageParam } = await searchParams
  const rawPage = Number.parseInt(pageParam ?? "1", 10)
  const currentPage =
    Number.isFinite(rawPage) && rawPage >= 1 && rawPage <= totalPages ? rawPage : 1

  const startIdx = (currentPage - 1) * POSTS_PER_PAGE
  const pagedPosts = posts.slice(startIdx, startIdx + POSTS_PER_PAGE)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 max-w-[880px] mx-auto px-5 py-16 md:py-24 w-full">
        <header className="mb-12 md:mb-16 text-center">
          <div className="flex justify-center mb-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(255, 75, 110, 0.12)" }}
            >
              <BookOpen className="w-7 h-7" style={{ color: "#FF4B6E" }} />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">Blog</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Long-form features, artist deep-dives, and Korean-culture guides.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-16 text-center">
            <p className="text-foreground font-medium mb-2">No posts yet.</p>
            <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
              The first stories are on the way. Check back soon — or follow UnfoldK on social for
              updates.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {pagedPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="block bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 md:p-7 hover:bg-[#202023] hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                    <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
                    <span aria-hidden>·</span>
                    <span>{post.readingTimeMinutes} min read</span>
                    {post.tags && post.tags.length > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="flex flex-wrap gap-1.5">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: "rgba(255, 75, 110, 0.12)",
                                color: "#FF4B6E",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      </>
                    )}
                  </div>
                  <h2 className="text-xl md:text-2xl font-semibold text-white mb-2 leading-snug">
                    {post.title}
                  </h2>
                  {post.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                      {post.description}
                    </p>
                  )}
                  <span
                    className="inline-flex items-center gap-1 text-sm font-medium"
                    style={{ color: "#FF4B6E" }}
                  >
                    Read more <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              ))}
            </div>

            {/* 페이지네이션 — Link 기반. App Router 기본 scroll=true 로 페이지 변경 시 상단 이동. */}
            {totalPages > 1 && (
              <nav
                aria-label="Blog pagination"
                className="flex items-center justify-center gap-2 mt-12 flex-wrap"
              >
                {currentPage > 1 ? (
                  <Link
                    href={pageHref(currentPage - 1)}
                    className="inline-flex items-center gap-1 px-4 h-10 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-foreground hover:bg-[#252525] text-sm font-medium"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex items-center gap-1 px-4 h-10 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-muted-foreground/50 text-sm font-medium opacity-50 cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </span>
                )}

                {getPaginationItems(currentPage, totalPages).map((item, idx) => {
                  if (item === "ellipsis-left" || item === "ellipsis-right") {
                    return (
                      <span
                        key={`${item}-${idx}`}
                        aria-hidden
                        className="px-2 text-muted-foreground select-none tabular-nums"
                      >
                        …
                      </span>
                    )
                  }
                  const isCurrent = item === currentPage
                  if (isCurrent) {
                    return (
                      <span
                        key={item}
                        aria-current="page"
                        className="inline-flex items-center justify-center min-w-10 h-10 px-3 rounded-full text-white text-sm font-medium tabular-nums"
                        style={{ backgroundColor: "#FF4B6E" }}
                      >
                        {item}
                      </span>
                    )
                  }
                  return (
                    <Link
                      key={item}
                      href={pageHref(item)}
                      className="inline-flex items-center justify-center min-w-10 h-10 px-3 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-foreground hover:bg-[#252525] text-sm font-medium tabular-nums"
                    >
                      {item}
                    </Link>
                  )
                })}

                {currentPage < totalPages ? (
                  <Link
                    href={pageHref(currentPage + 1)}
                    className="inline-flex items-center gap-1 px-4 h-10 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-foreground hover:bg-[#252525] text-sm font-medium"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex items-center gap-1 px-4 h-10 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-muted-foreground/50 text-sm font-medium opacity-50 cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </main>

      <FooterSection />
    </div>
  )
}
