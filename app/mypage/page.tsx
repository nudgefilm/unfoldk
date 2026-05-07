"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/header"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { 
  Home, 
  Calendar, 
  Music, 
  Film, 
  Languages, 
  UtensilsCrossed, 
  CreditCard, 
  Settings,
  ChevronRight,
  Flame
} from "lucide-react"

const sidebarLinks = [
  { icon: Home, label: "Dashboard", href: "/mypage", active: true },
  { icon: Calendar, label: "My Calendar", href: "/mypage/calendar", active: false },
  { icon: Music, label: "My Artists", href: "/mypage/artists", active: false },
  { icon: Film, label: "My Dramas", href: "/mypage/dramas", active: false },
  { icon: Languages, label: "Learning Progress", href: "/mypage/learning", active: false },
  { icon: UtensilsCrossed, label: "Saved Recipes", href: "/mypage/recipes", active: false },
  { icon: CreditCard, label: "Subscription", href: "/mypage/subscription", active: false },
  { icon: Settings, label: "Settings", href: "/mypage/settings", active: false },
]

const activityStats = [
  { label: "Artists Tracking", value: "12" },
  { label: "Events This Month", value: "5" },
  { label: "Korean Lessons", value: "23", suffix: "day streak", hasFlame: true },
  { label: "Saved Recipes", value: "8" },
]

const upcomingEvents = [
  { id: 1, title: "BTS Concert", date: 10, month: "MAY", type: "Concert" },
  { id: 2, title: "BLACKPINK Comeback", date: 15, month: "MAY", type: "K-pop" },
  { id: 3, title: "NewJeans Fan Meet", date: 21, month: "MAY", type: "Fan Meet" },
]

export default function MyPage() {
  const [activeLink, setActiveLink] = useState("Dashboard")

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      <Header />
      
      <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 md:px-6 py-8 gap-8">
        {/* Left Sidebar */}
        <aside className="hidden md:flex flex-col w-[240px] flex-shrink-0">
          {/* User Profile */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              {/* Avatar */}
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                M
              </div>
              <div>
                <p className="text-foreground font-medium">Mia T.</p>
                <span 
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
                >
                  Hallyu Pass
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {sidebarLinks.map((link) => {
              const isActive = link.label === activeLink
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setActiveLink(link.label)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                    isActive 
                      ? "bg-[#1a1a1a] text-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]/50"
                  }`}
                >
                  {isActive && (
                    <span 
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                      style={{ backgroundColor: "#FF4B6E" }}
                    />
                  )}
                  <link.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Section 1: My Activity Stats */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">My Activity</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {activityStats.map((stat) => (
                <div 
                  key={stat.label}
                  className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4"
                >
                  <p className="text-muted-foreground text-sm mb-1">{stat.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                    {stat.hasFlame && <Flame className="w-5 h-5" style={{ color: "#FF4B6E" }} />}
                  </div>
                  {stat.suffix && (
                    <p className="text-muted-foreground text-xs mt-1">{stat.suffix}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Section 2: Upcoming Events */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Upcoming Events</h2>
              <Link 
                href="/calendar" 
                className="text-sm font-medium flex items-center gap-1 hover:underline"
                style={{ color: "#FF4B6E" }}
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {upcomingEvents.map((event) => (
                <div 
                  key={event.id}
                  className="flex-shrink-0 w-[200px] bg-[#1a1a1a] border border-border/30 rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer"
                >
                  {/* Date Badge */}
                  <div 
                    className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white mb-3"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    <span className="text-[10px] font-medium">{event.month}</span>
                    <span className="text-lg font-bold">{event.date}</span>
                  </div>
                  <h3 className="text-foreground font-medium text-sm mb-1">{event.title}</h3>
                  <span className="text-muted-foreground text-xs">{event.type}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Continue Learning */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Continue Learning</h2>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <p className="text-muted-foreground text-sm mb-2">Today&apos;s phrase</p>
                  <p className="text-2xl font-bold text-foreground mb-1">보고 싶었어</p>
                  <p className="text-muted-foreground">&quot;I missed you&quot;</p>
                  <p className="text-sm mt-3">
                    <span className="text-muted-foreground">From: </span>
                    <span className="text-foreground">Crash Landing on You</span>
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Day 23 of streak</span>
                      <span className="flex items-center gap-1" style={{ color: "#FF4B6E" }}>
                        <Flame className="w-4 h-4" /> 23
                      </span>
                    </div>
                    <div className="h-2 bg-[#252525] rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full"
                        style={{ backgroundColor: "#FF4B6E", width: "76%" }}
                      />
                    </div>
                  </div>
                </div>
                
                <Link href="/korean">
                  <Button 
                    className="px-6 py-2 rounded-full font-medium text-white md:self-end"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    Continue
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* Section 4: Subscription */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Subscription</h2>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-foreground font-semibold text-lg">Hallyu Pass</span>
                    <span 
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}
                    >
                      Active
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Next billing: <span className="text-foreground">June 7, 2026</span> · <span className="text-foreground">$15.00</span>
                  </p>
                </div>
                
                <Link 
                  href="/mypage/subscription"
                  className="text-sm font-medium hover:underline"
                  style={{ color: "#FF4B6E" }}
                >
                  Manage subscription
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>

      <FooterSection />
    </div>
  )
}
