import { Languages } from "lucide-react"
import Link from "next/link"

interface FeatureCard {
  icon: string | React.ReactNode
  title: string
  description: string
  highlighted?: boolean
  href: string
}

const FeatureCard = ({ icon, title, description, highlighted, href }: FeatureCard) => (
  <Link href={href} className="block">
    <div
      className={`overflow-hidden rounded-2xl flex flex-col justify-start items-start relative p-6 h-full transition-all hover:scale-[1.02] hover:shadow-lg ${
        highlighted
          ? "border-2 border-primary bg-primary/5"
          : "border border-white/20 hover:border-primary/50"
      }`}
      style={{
        background: highlighted ? "rgba(255, 75, 110, 0.08)" : "rgba(231, 236, 235, 0.08)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      {/* Additional subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-3">
        <span className="text-4xl flex items-center justify-center">{icon}</span>
        <h3 className="text-foreground text-xl font-semibold">{title}</h3>
        <p className="text-muted-foreground text-base leading-relaxed">{description}</p>
      </div>
    </div>
  </Link>
)

export function BentoSection() {
  const cards: FeatureCard[] = [
    {
      icon: "📅",
      title: "HallyuCalendar",
      description: "Never miss a comeback. Auto-syncs to your Google Calendar.",
      highlighted: true,
      href: "/calendar",
    },
    {
      icon: "🎵",
      title: "KpopStats",
      description: "Real-time charts for every K-pop artist, updated daily.",
      href: "/kpop",
    },
    {
      icon: "🎬",
      title: "KdramaMatch",
      description: "Find your next K-drama in 30 seconds.",
      href: "/drama",
    },
    {
      icon: <Languages className="w-9 h-9 text-primary" />,
      title: "HangeulGo",
      description: "Learn Korean from real drama dialogue.",
      href: "/korean",
    },
    {
      icon: "🍜",
      title: "KfoodKit",
      description: "537 authentic Korean recipes, straight from your favorite dramas.",
      href: "/food",
    },
    {
      icon: "🗺️",
      title: "Curation K",
      description: "Filming spots, hidden gems, and 1-day trips across Korea.",
      href: "/curation-k",
    },
  ]

  return (
    <section id="features" className="w-full px-5 flex flex-col justify-center items-center overflow-visible bg-transparent">
      <div className="w-full pt-4 pb-8 md:pt-8 md:pb-16 relative flex flex-col justify-start items-start gap-6">
        <div className="w-[547px] h-[938px] absolute top-[614px] left-[80px] origin-top-left rotate-[-33.39deg] bg-primary/10 blur-[130px] z-0" />
        <div className="self-stretch pt-4 pb-8 md:pt-6 md:pb-14 flex flex-col justify-center items-center gap-2 z-10">
          <div className="flex flex-col justify-start items-center gap-4">
            <h2 className="w-full max-w-[655px] text-center text-foreground text-4xl md:text-6xl font-semibold leading-tight md:leading-[66px] text-balance">
              Everything a Hallyu fan needs
            </h2>
            <p className="w-full max-w-[600px] text-center text-muted-foreground text-lg md:text-xl font-medium leading-relaxed">
              Six services. One subscription. Zero FOMO.
            </p>
          </div>
        </div>
        <div className="self-stretch grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 z-10">
          {cards.map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </section>
  )
}
