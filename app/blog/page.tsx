// /blog — 블로그 목록
// Server Component. content/blog/*.mdx 를 build 시 읽어 frontmatter 만 렌더.
// 빈 상태 (포스트 0건) 는 안내 카드로 fallback.

import Link from "next/link"
import type { Metadata } from "next"
import { FooterSection } from "@/components/footer-section"
import { BookOpen, ArrowRight } from "lucide-react"
import { getAllPosts, formatBlogDate } from "@/lib/blog"

export const metadata: Metadata = {
  title: "Blog · UnfoldK",
  description: "Long-form features, artist deep-dives, and Korean-culture guides from UnfoldK.",
}

// 정적 생성 — content/blog/ 추가 시 자동 반영. revalidate 로 ISR 도 가능하지만
// 블로그 빈도 낮음 → 풀 정적 + 재배포 트리거 패턴이 간단.
export const dynamic = "force-static"

export default function BlogIndexPage() {
  const posts = getAllPosts()

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
          <div className="space-y-4">
            {posts.map((post) => (
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
        )}
      </main>

      <FooterSection />
    </div>
  )
}
