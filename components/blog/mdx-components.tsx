// MDX 렌더 컴포넌트 매핑 — 다크테마 (마이페이지/푸터 페이지와 동일 톤)
//
// next-mdx-remote 의 components prop 으로 전달.
// Tailwind 의 typography 플러그인 미설치 환경이라 prose 클래스 대신 element 별 직접 스타일.

import Link from "next/link"
import type { ComponentPropsWithoutRef } from "react"

type AnchorProps = ComponentPropsWithoutRef<"a">

function Anchor({ href = "", children, ...rest }: AnchorProps) {
  // 내부 링크 → next/link prefetch, 외부 → 새 탭 + noopener
  const isExternal = /^https?:\/\//.test(href) && !href.includes("unfoldk.com")
  const baseClass = "underline-offset-4 hover:underline"

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClass}
        style={{ color: "#FF4B6E" }}
        {...rest}
      >
        {children}
      </a>
    )
  }

  return (
    <Link href={href} className={baseClass} style={{ color: "#FF4B6E" }}>
      {children}
    </Link>
  )
}

export const mdxComponents = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h1
      className="text-3xl md:text-4xl font-bold text-white mt-12 mb-6 leading-tight tracking-tight"
      {...props}
    />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="text-2xl md:text-3xl font-bold text-white mt-10 mb-4 leading-tight tracking-tight"
      {...props}
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className="text-xl md:text-2xl font-semibold text-white mt-8 mb-3 leading-snug"
      {...props}
    />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="text-foreground/85 leading-relaxed my-5" {...props} />
  ),
  a: Anchor,
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="list-disc list-outside pl-6 my-5 space-y-2 text-foreground/85 marker:text-[#FF4B6E]"
      {...props}
    />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="list-decimal list-outside pl-6 my-5 space-y-2 text-foreground/85 marker:text-[#FF4B6E]"
      {...props}
    />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li className="leading-relaxed" {...props} />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="border-l-2 pl-4 my-6 italic text-muted-foreground"
      style={{ borderColor: "#FF4B6E" }}
      {...props}
    />
  ),
  hr: () => <hr className="my-10 border-border/40" />,
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code
      className="bg-[#1a1a1a] border border-border/30 rounded px-1.5 py-0.5 text-sm font-mono text-foreground"
      {...props}
    />
  ),
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="bg-[#0d0d0f] border border-border/30 rounded-xl p-4 my-6 overflow-x-auto text-sm leading-relaxed [&>code]:bg-transparent [&>code]:border-0 [&>code]:p-0"
      {...props}
    />
  ),
  img: (props: ComponentPropsWithoutRef<"img">) => (
    // 본문 이미지는 외부 URL 사용 가정 (CLAUDE.md §7: 아티스트 이미지 서버 저장 금지 — 블로그도 동일 톤)
    // eslint-disable-next-line @next/next/no-img-element
    <img className="rounded-xl my-6 w-full" loading="lazy" alt="" {...props} />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="text-white font-semibold" {...props} />
  ),
  em: (props: ComponentPropsWithoutRef<"em">) => (
    <em className="text-foreground/90" {...props} />
  ),
}
