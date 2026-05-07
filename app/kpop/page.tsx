"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Search, TrendingUp, TrendingDown, Minus, Lock } from "lucide-react"
import Link from "next/link"

const chartData = [
  { rank: 1, artist: "BTS", youtube: "2.4B", lastfm: "8.2M", change: "up", changeValue: "+2" },
  { rank: 2, artist: "BLACKPINK", youtube: "1.9B", lastfm: "6.1M", change: "same", changeValue: "0" },
  { rank: 3, artist: "aespa", youtube: "980M", lastfm: "3.4M", change: "up", changeValue: "+1" },
  { rank: 4, artist: "NewJeans", youtube: "870M", lastfm: "2.9M", change: "down", changeValue: "-1" },
  { rank: 5, artist: "SEVENTEEN", youtube: "760M", lastfm: "2.5M", change: "up", changeValue: "+3" },
]

export default function KpopStatsPage() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0d0d0f" }}>
      <Header />
      
      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Page Header */}
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            KpopStats
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Real-time global charts & streaming data
          </p>
          
          {/* Search Bar */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search artist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-border/30 rounded-full py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </section>

        {/* Global Chart - Top 5 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">
            Global Chart — Top 5 this week
          </h2>
          
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/30 text-sm text-muted-foreground font-medium">
              <div className="col-span-1">Rank</div>
              <div className="col-span-4">Artist</div>
              <div className="col-span-3 text-right">YouTube Views</div>
              <div className="col-span-2 text-right">Last.fm Listeners</div>
              <div className="col-span-2 text-right">Change</div>
            </div>
            
            {/* Table Rows */}
            {chartData.map((item) => (
              <div 
                key={item.rank}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/20 last:border-b-0 hover:bg-[#252525] transition-colors"
              >
                {/* Rank Badge */}
                <div className="col-span-1 flex items-center">
                  <span 
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      item.rank === 1 
                        ? "bg-primary/20 text-primary" 
                        : "bg-[#252525] text-foreground"
                    }`}
                  >
                    #{item.rank}
                  </span>
                </div>
                
                {/* Artist Name */}
                <div className="col-span-4 flex items-center">
                  <span className="text-foreground font-medium">{item.artist}</span>
                </div>
                
                {/* YouTube Views */}
                <div className="col-span-3 flex items-center justify-end">
                  <span className="text-foreground">{item.youtube}</span>
                </div>
                
                {/* Last.fm Listeners */}
                <div className="col-span-2 flex items-center justify-end">
                  <span className="text-foreground">{item.lastfm}</span>
                </div>
                
                {/* Change */}
                <div className="col-span-2 flex items-center justify-end gap-1">
                  {item.change === "up" && (
                    <>
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-green-500 font-medium">{item.changeValue}</span>
                    </>
                  )}
                  {item.change === "down" && (
                    <>
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      <span className="text-red-500 font-medium">{item.changeValue}</span>
                    </>
                  )}
                  {item.change === "same" && (
                    <>
                      <Minus className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{item.changeValue}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* View Full Chart Link */}
          <div className="mt-4 text-center">
            <Link 
              href="/kpop/chart" 
              className="text-sm font-medium hover:underline"
              style={{ color: "#FF4B6E" }}
            >
              View full chart
            </Link>
          </div>
        </section>

        {/* Artist Spotlight - BTS */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">
            Artist Spotlight
          </h2>
          
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 md:p-8">
            {/* Artist Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">BTS</h3>
                <div className="flex gap-2">
                  <span className="px-3 py-1 rounded-full bg-[#252525] text-muted-foreground text-xs">K-pop</span>
                  <span className="px-3 py-1 rounded-full bg-[#252525] text-muted-foreground text-xs">Boy Group</span>
                  <span className="px-3 py-1 rounded-full bg-[#252525] text-muted-foreground text-xs">HYBE</span>
                </div>
              </div>
              <Link href="/login">
                <Button
                  className="px-6 py-2 rounded-full font-medium text-white"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  Track this artist
                </Button>
              </Link>
            </div>
            
            {/* Stats Boxes */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-[#141416] rounded-xl p-4 text-center">
                <p className="text-muted-foreground text-sm mb-1">YouTube Subscribers</p>
                <p className="text-2xl font-bold text-white">75M</p>
              </div>
              <div className="bg-[#141416] rounded-xl p-4 text-center">
                <p className="text-muted-foreground text-sm mb-1">Weekly Views</p>
                <p className="text-2xl font-bold text-white">45M</p>
              </div>
              <div className="bg-[#141416] rounded-xl p-4 text-center">
                <p className="text-muted-foreground text-sm mb-1">Last.fm Listeners</p>
                <p className="text-2xl font-bold text-white">8.2M</p>
              </div>
            </div>
            
            {/* Line Graph Placeholder */}
            <div className="bg-[#141416] rounded-xl p-6 h-48 relative overflow-hidden">
              <p className="text-muted-foreground text-sm mb-4">Weekly Trend</p>
              {/* SVG Line Graph */}
              <svg className="w-full h-32" viewBox="0 0 400 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FF4B6E" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#FF4B6E" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Area under the line */}
                <path
                  d="M0,80 Q50,70 100,60 T200,40 T300,50 T400,30 L400,100 L0,100 Z"
                  fill="url(#lineGradient)"
                />
                {/* The line itself */}
                <path
                  d="M0,80 Q50,70 100,60 T200,40 T300,50 T400,30"
                  fill="none"
                  stroke="#FF4B6E"
                  strokeWidth="2"
                />
                {/* Data points */}
                <circle cx="0" cy="80" r="4" fill="#FF4B6E" />
                <circle cx="100" cy="60" r="4" fill="#FF4B6E" />
                <circle cx="200" cy="40" r="4" fill="#FF4B6E" />
                <circle cx="300" cy="50" r="4" fill="#FF4B6E" />
                <circle cx="400" cy="30" r="4" fill="#FF4B6E" />
              </svg>
              {/* X-axis labels */}
              <div className="absolute bottom-2 left-0 right-0 flex justify-between px-2 text-xs text-muted-foreground">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>
          </div>
        </section>

        {/* Artist Comparison - Pro Feature (Blurred) */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-6">
            Artist Comparison <span className="text-muted-foreground text-base font-normal">(Pro)</span>
          </h2>
          
          <div className="relative">
            {/* Blurred Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 blur-[4px] pointer-events-none">
              {/* Card 1 */}
              <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#252525]" />
                  <div>
                    <h4 className="text-white font-medium">BTS</h4>
                    <p className="text-muted-foreground text-sm">75M subscribers</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">YouTube Views</span>
                    <span className="text-white">2.4B</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Monthly Listeners</span>
                    <span className="text-white">8.2M</span>
                  </div>
                </div>
              </div>
              
              {/* Card 2 */}
              <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#252525]" />
                  <div>
                    <h4 className="text-white font-medium">BLACKPINK</h4>
                    <p className="text-muted-foreground text-sm">92M subscribers</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">YouTube Views</span>
                    <span className="text-white">1.9B</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Monthly Listeners</span>
                    <span className="text-white">6.1M</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                >
                  <Lock className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                </div>
                <p className="text-foreground font-medium mb-4">
                  Unlock comparisons with Hallyu Pass
                </p>
                <Link href="/signup">
                  <Button
                    className="px-6 py-2 rounded-full font-medium text-white"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    Upgrade — $15/month
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <FooterSection />
    </div>
  )
}
