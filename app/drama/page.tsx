"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Star, Plus, Play, Lock } from "lucide-react"
import Link from "next/link"

// Genre, Mood, Platform options
const genres = ["Romance", "Thriller", "Comedy", "Fantasy", "Historical"]
const moods = ["Heartwarming", "Intense", "Light", "Emotional"]
const platforms = ["Netflix", "Viki", "Disney+"]

// Drama data
const dramas = [
  { id: 1, title: "Crash Landing on You", genre: "Romance", year: 2019, platform: "Netflix", rating: 4.9 },
  { id: 2, title: "Goblin", genre: "Fantasy", year: 2016, platform: "Viki", rating: 4.8 },
  { id: 3, title: "My Mister", genre: "Drama", year: 2018, platform: "Netflix", rating: 4.9 },
  { id: 4, title: "Queen of Tears", genre: "Romance", year: 2024, platform: "Netflix", rating: 4.7 },
  { id: 5, title: "Extraordinary Attorney Woo", genre: "Drama", year: 2022, platform: "Netflix", rating: 4.8 },
  { id: 6, title: "Signal", genre: "Thriller", year: 2016, platform: "Viki", rating: 4.9 },
]

// Watchlist data
const watchlistData = {
  watching: [
    { id: 1, title: "Queen of Tears", genre: "Romance", progress: "Ep 8/16" },
    { id: 2, title: "Lovely Runner", genre: "Romance", progress: "Ep 3/16" },
    { id: 3, title: "The Glory", genre: "Thriller", progress: "Ep 12/16" },
  ],
  wantToWatch: [
    { id: 4, title: "Moving", genre: "Action", progress: "" },
    { id: 5, title: "Alchemy of Souls", genre: "Fantasy", progress: "" },
    { id: 6, title: "Hospital Playlist", genre: "Drama", progress: "" },
  ],
  completed: [
    { id: 7, title: "Crash Landing on You", genre: "Romance", progress: "Completed" },
    { id: 8, title: "Goblin", genre: "Fantasy", progress: "Completed" },
    { id: 9, title: "Reply 1988", genre: "Drama", progress: "Completed" },
  ],
}

// Chip component
function Chip({ 
  label, 
  selected, 
  onClick 
}: { 
  label: string
  selected: boolean
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
        selected 
          ? "text-white" 
          : "bg-[#1a1a1a] text-muted-foreground hover:text-foreground border border-border/30"
      }`}
      style={selected ? { backgroundColor: "#FF4B6E" } : {}}
    >
      {label}
    </button>
  )
}

// Drama Card component
function DramaCard({ drama }: { drama: typeof dramas[0] }) {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors group">
      {/* Poster Placeholder */}
      <div 
        className="w-full aspect-[2/3] bg-[#252525] flex items-center justify-center relative"
      >
        <span className="text-muted-foreground text-sm">Poster</span>
        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="w-12 h-12 text-white" fill="white" />
        </div>
      </div>
      
      {/* Info */}
      <div className="p-4">
        <h3 className="text-foreground font-semibold text-sm mb-2 line-clamp-1">{drama.title}</h3>
        
        <div className="flex items-center gap-2 mb-2">
          <span 
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
          >
            {drama.genre}
          </span>
          <span className="text-muted-foreground text-xs">{drama.year}</span>
        </div>
        
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground bg-[#252525] px-2 py-1 rounded">
            {drama.platform}
          </span>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3" style={{ color: "#FF4B6E" }} fill="#FF4B6E" />
            <span className="text-foreground text-xs font-medium">{drama.rating}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <Link 
            href="#" 
            className="text-xs font-medium flex items-center gap-1 hover:underline"
            style={{ color: "#FF4B6E" }}
          >
            <Play className="w-3 h-3" /> Start watching
          </Link>
          <Link href="/login" className="p-1.5 rounded-lg hover:bg-[#252525] transition-colors">
            <Plus className="w-4 h-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// Watchlist Card component
function WatchlistCard({ drama }: { drama: { id: number; title: string; genre: string; progress: string } }) {
  return (
    <div className="flex-shrink-0 w-[200px] bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden">
      <div className="w-full aspect-[2/3] bg-[#252525] flex items-center justify-center">
        <span className="text-muted-foreground text-xs">Poster</span>
      </div>
      <div className="p-3">
        <h4 className="text-foreground font-medium text-sm mb-1 line-clamp-1">{drama.title}</h4>
        <p className="text-muted-foreground text-xs">{drama.progress || drama.genre}</p>
      </div>
    </div>
  )
}

export default function KdramaMatchPage() {
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [activeWatchlistTab, setActiveWatchlistTab] = useState<"watching" | "wantToWatch" | "completed">("watching")

  const toggleSelection = (
    item: string, 
    selected: string[], 
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (selected.includes(item)) {
      setSelected(selected.filter(i => i !== item))
    } else {
      setSelected([...selected, item])
    }
  }

  const handleGetRecommendations = () => {
    setShowRecommendations(true)
  }

  const watchlistTabs = [
    { key: "watching" as const, label: "Watching" },
    { key: "wantToWatch" as const, label: "Want to Watch" },
    { key: "completed" as const, label: "Completed" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-[1320px] mx-auto px-6 py-12">
        {/* Page Header */}
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">KdramaMatch</h1>
          <p className="text-muted-foreground text-lg">AI-powered K-drama recommendations just for you</p>
        </section>

        {/* Taste Onboarding Card */}
        {!showRecommendations && (
          <section className="mb-16 flex justify-center">
            <div className="w-full max-w-[600px] bg-[#141418] border border-border/30 rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-foreground text-center mb-6">
                What&apos;s your K-drama style?
              </h2>
              
              {/* Genre */}
              <div className="mb-6">
                <p className="text-muted-foreground text-sm mb-3">Genre</p>
                <div className="flex flex-wrap gap-2">
                  {genres.map(genre => (
                    <Chip
                      key={genre}
                      label={genre}
                      selected={selectedGenres.includes(genre)}
                      onClick={() => toggleSelection(genre, selectedGenres, setSelectedGenres)}
                    />
                  ))}
                </div>
              </div>
              
              {/* Mood */}
              <div className="mb-6">
                <p className="text-muted-foreground text-sm mb-3">Mood</p>
                <div className="flex flex-wrap gap-2">
                  {moods.map(mood => (
                    <Chip
                      key={mood}
                      label={mood}
                      selected={selectedMoods.includes(mood)}
                      onClick={() => toggleSelection(mood, selectedMoods, setSelectedMoods)}
                    />
                  ))}
                </div>
              </div>
              
              {/* Platform */}
              <div className="mb-8">
                <p className="text-muted-foreground text-sm mb-3">Platform</p>
                <div className="flex flex-wrap gap-2">
                  {platforms.map(platform => (
                    <Chip
                      key={platform}
                      label={platform}
                      selected={selectedPlatforms.includes(platform)}
                      onClick={() => toggleSelection(platform, selectedPlatforms, setSelectedPlatforms)}
                    />
                  ))}
                </div>
              </div>
              
              {/* Submit Button */}
              <Link href="/drama/recommend" className="block">
                <Button
                  onClick={handleGetRecommendations}
                  className="w-full py-3 rounded-xl font-medium text-white"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  Get my recommendations
                </Button>
              </Link>
            </div>
          </section>
        )}

        {/* AI Recommendations */}
        {showRecommendations && (
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Recommended for You</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {dramas.map(drama => (
                <DramaCard key={drama.id} drama={drama} />
              ))}
            </div>
          </section>
        )}

        {/* My Watch List */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-6">My Watch List</h2>
          
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 border-b border-border/30">
            {watchlistTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveWatchlistTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeWatchlistTab === tab.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {activeWatchlistTab === tab.key && (
                  <span 
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: "#FF4B6E" }}
                  />
                )}
              </button>
            ))}
          </div>
          
          {/* Watchlist Cards */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {watchlistData[activeWatchlistTab].map(drama => (
              <WatchlistCard key={drama.id} drama={drama} />
            ))}
          </div>
        </section>

        {/* AI Drama Summary (Pro) - Blurred */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-2xl font-semibold text-foreground">AI Drama Summary</h2>
            <span 
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
            >
              Pro
            </span>
          </div>
          
          <div className="relative">
            {/* Blurred Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 blur-[4px] pointer-events-none">
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
                <h3 className="text-foreground font-semibold mb-2">Crash Landing on You - Episode Analysis</h3>
                <p className="text-muted-foreground text-sm">
                  A comprehensive AI-generated summary of key plot points, character development, 
                  and emotional moments from each episode...
                </p>
              </div>
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
                <h3 className="text-foreground font-semibold mb-2">Character Relationship Map</h3>
                <p className="text-muted-foreground text-sm">
                  Interactive visualization of character connections, family ties, 
                  and romantic relationships throughout the series...
                </p>
              </div>
            </div>
            
            {/* Upgrade Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                >
                  <Lock className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                </div>
                <p className="text-foreground font-medium mb-4">
                  Unlock AI Drama Summaries with Hallyu Pass
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
