import Link from "next/link"
import { Header } from "@/components/header"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Languages } from "lucide-react"

const services = [
  {
    icon: "📅",
    title: "HallyuCalendar",
    description: "Never miss a comeback, album drop, or drama premiere. Auto-syncs to Google Calendar and iCal.",
    href: "/calendar",
  },
  {
    icon: "🎵",
    title: "KpopStats",
    description: "Real-time YouTube views, Last.fm streams, and global ranking charts for every artist.",
    href: "/kpop",
  },
  {
    icon: "🎬",
    title: "KdramaMatch",
    description: "AI-powered recommendations based on your taste. Track what you watch and discover new favorites.",
    href: "/drama",
  },
  {
    icon: <Languages className="w-9 h-9 text-primary" />,
    title: "HangeulGo",
    description: "Learn Korean through actual drama lines — with AI grammar explanations and native TTS pronunciation.",
    href: "/korean",
  },
  {
    icon: "🍜",
    title: "KfoodKit",
    description: "Cook the food from your favorite K-drama anywhere, with local ingredient substitutions powered by AI.",
    href: "/food",
  },
]

const stats = [
  { value: "5", label: "Services built" },
  { value: "30,000+", label: "Hallyu fans (goal)" },
  { value: "12", label: "Countries reached" },
  { value: "1", label: "Passionate team" },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-[1320px] mx-auto px-5">
        {/* Hero Section */}
        <section className="pt-24 pb-16 text-center relative">
          {/* Radial glow */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
            style={{ 
              background: "radial-gradient(circle, rgba(255, 75, 110, 0.15) 0%, transparent 70%)",
              filter: "blur(60px)"
            }}
          />
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 relative z-10">
            Built for Hallyu fans,<br />by a Hallyu fan.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto relative z-10">
            UnfoldK started because keeping up with K-pop comebacks, K-dramas, and Korean culture is a full-time job. So we built the tools to make it effortless.
          </p>
        </section>

        {/* Mission Card */}
        <section className="pb-16">
          <div 
            className="w-full rounded-2xl p-8 md:p-12 text-center"
            style={{ backgroundColor: "#1a1a1a" }}
          >
            <h2 
              className="text-sm font-medium uppercase tracking-wider mb-4"
              style={{ color: "#FF4B6E" }}
            >
              Our Mission
            </h2>
            <p className="text-xl md:text-2xl text-foreground font-medium max-w-3xl mx-auto leading-relaxed">
              To make Korean culture accessible and joyful for fans everywhere — no matter where you live, what language you speak, or how deep your Hallyu rabbit hole goes.
            </p>
          </div>
        </section>

        {/* Stats Row */}
        <section className="pb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {stats.map((stat) => (
              <div 
                key={stat.label}
                className="rounded-2xl p-6 text-center border border-border/30"
                style={{ backgroundColor: "#141416" }}
              >
                <div 
                  className="text-3xl md:text-4xl font-bold mb-2"
                  style={{ color: "#FF4B6E" }}
                >
                  {stat.value}
                </div>
                <div className="text-muted-foreground text-sm">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* The Story */}
        <section className="pb-16">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-6">
            How it started
          </h2>
          <div className="space-y-4 text-muted-foreground text-lg leading-relaxed max-w-3xl">
            <p>
              We run UNFOLD LAB — a small indie studio building tools for global audiences. After launching tubewatch.kr, we kept hearing from K-pop fans who struggled to track comebacks, find dramas, and learn Korean.
            </p>
            <p>
              UnfoldK is our answer to that. Five focused services. One affordable subscription. Zero fluff.
            </p>
          </div>
        </section>

        {/* Services Grid */}
        <section className="pb-16">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-8 text-center">
            Our Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Link 
                key={service.title}
                href={service.href}
                className="rounded-2xl p-6 border border-white/20 hover:border-primary/50 transition-colors"
                style={{
                  background: "rgba(231, 236, 235, 0.08)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <div className="flex flex-col gap-3">
                  <span className="text-4xl flex items-center justify-center w-fit">
                    {service.icon}
                  </span>
                  <h3 className="text-foreground text-xl font-semibold">{service.title}</h3>
                  <p className="text-muted-foreground text-base leading-relaxed">{service.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="pb-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            Ready to unfold Korean culture?
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button
                className="px-8 py-3 rounded-full font-medium text-white"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                Start for free
              </Button>
            </Link>
            <Link 
              href="/#pricing"
              className="font-medium hover:underline"
              style={{ color: "#FF4B6E" }}
            >
              Or view Hallyu Pass →
            </Link>
          </div>
        </section>
      </main>

      <FooterSection />
    </div>
  )
}
