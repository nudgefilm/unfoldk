// /blog/[slug] — 블로그 상세
// Server Component. MDXRemote 로 frontmatter + 본문 렌더.

import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { MDXRemote } from "next-mdx-remote/rsc"
import { ChevronLeft } from "lucide-react"
import { FooterSection } from "@/components/footer-section"
import { mdxComponents } from "@/components/blog/mdx-components"
import { BlogComments } from "@/components/blog/blog-comments"
import { getAllSlugs, getPostBySlug, formatBlogDate } from "@/lib/blog"

interface Params {
  slug: string
}

export function generateStaticParams(): Params[] {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return { title: "Not found · UnfoldK Blog" }

  return {
    title: `${post.title} · UnfoldK Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      images: post.cover ? [{ url: post.cover }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: post.cover ? [post.cover] : undefined,
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 max-w-[760px] mx-auto px-5 py-12 md:py-16 w-full">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        <article>
          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4">
              <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
              <span aria-hidden>·</span>
              <span>{post.readingTimeMinutes} min read</span>
              <span aria-hidden>·</span>
              <span>By {post.author}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight mb-4">
              {post.title}
            </h1>
            {post.description && (
              <p className="text-lg text-muted-foreground leading-relaxed">
                {post.description}
              </p>
            )}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: "rgba(255, 75, 110, 0.12)",
                      color: "#FF4B6E",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {post.cover && (
              <figure className="mt-8">
                {/* 본문 cover 이미지 — 외부 URL 가정 (CLAUDE.md §7) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.cover}
                  alt={post.title}
                  className="w-full rounded-2xl object-cover max-h-[420px]"
                />
                {post.imageCredit && (
                  <figcaption className="text-muted-foreground/70 text-xs mt-2 text-center italic">
                    {post.imageCredit}
                  </figcaption>
                )}
              </figure>
            )}
          </header>

          <div className="text-foreground">
            <MDXRemote source={post.content} components={mdxComponents} />
          </div>
        </article>

        {/* 댓글 — slug 별 독립. 로그인/비로그인 분기는 컴포넌트 내부에서 처리. */}
        <BlogComments slug={post.slug} />

        <div className="mt-16 pt-8 border-t border-border/30">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
            style={{ color: "#FF4B6E" }}
          >
            <ChevronLeft className="w-4 h-4" />
            More posts
          </Link>
        </div>
      </main>

      <FooterSection />
    </div>
  )
}
