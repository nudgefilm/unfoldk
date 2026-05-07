import Link from "next/link"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"

const quickLinks = [
  { name: "HallyuCalendar", href: "/calendar" },
  { name: "KpopStats", href: "/kpop" },
  { name: "KdramaMatch", href: "/drama" },
  { name: "HangeulGo", href: "/korean" },
  { name: "KfoodKit", href: "/food" },
]

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      {/* Navbar */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative">
        {/* Glow Effect */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255, 75, 110, 0.25) 0%, transparent 70%)" }}
        />

        {/* 404 Text */}
        <h1 
          className="font-bold text-white relative z-10"
          style={{ fontSize: "120px", lineHeight: 1 }}
        >
          404
        </h1>

        {/* Subtitle */}
        <h2 className="text-2xl md:text-3xl font-semibold text-white mt-4 relative z-10">
          This page has gone on hiatus.
        </h2>

        {/* Muted Text */}
        <p className="text-muted-foreground mt-3 text-center max-w-md relative z-10">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-8 relative z-10">
          <Link href="/">
            <Button 
              className="px-8 py-3 rounded-full font-medium text-white min-w-[160px]"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              Go to Home
            </Button>
          </Link>
          <Link href="/#features">
            <Button 
              variant="outline"
              className="px-8 py-3 rounded-full font-medium border-border/50 hover:bg-secondary/50 min-w-[160px]"
            >
              Browse Services
            </Button>
          </Link>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-10 relative z-10">
          <span className="text-muted-foreground text-sm">Or jump to:</span>
          {quickLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="px-3 py-1.5 text-sm text-foreground bg-[#1a1a1a] rounded-full border border-transparent hover:border-primary transition-colors"
            >
              {link.name}
            </Link>
          ))}
        </div>
      </main>

      {/* Copyright */}
      <footer className="py-6 text-center">
        <p className="text-muted-foreground text-sm">
          © 2026 UNFOLD LAB · unfoldk.com
        </p>
      </footer>
    </div>
  )
}
