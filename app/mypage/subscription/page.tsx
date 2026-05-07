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
  Download,
  Check
} from "lucide-react"

const sidebarLinks = [
  { icon: Home, label: "Dashboard", href: "/mypage" },
  { icon: Calendar, label: "My Calendar", href: "/mypage/calendar" },
  { icon: Music, label: "My Artists", href: "/mypage/artists" },
  { icon: Film, label: "My Dramas", href: "/mypage/dramas" },
  { icon: Languages, label: "Learning Progress", href: "/mypage/learning" },
  { icon: UtensilsCrossed, label: "Saved Recipes", href: "/mypage/recipes" },
  { icon: CreditCard, label: "Subscription", href: "/mypage/subscription" },
  { icon: Settings, label: "Settings", href: "/mypage/settings" },
]

const billingHistory = [
  { date: "May 7, 2026", description: "Hallyu Pass", amount: "$15.00", status: "Paid" },
  { date: "Apr 7, 2026", description: "Hallyu Pass", amount: "$15.00", status: "Paid" },
  { date: "Mar 7, 2026", description: "Hallyu Pass", amount: "$15.00", status: "Paid" },
]

export default function SubscriptionPage() {
  const [currentPlan] = useState<"monthly" | "annual">("monthly")

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      <Header />
      
      <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 md:px-6 py-8 gap-8">
        {/* Left Sidebar */}
        <aside className="hidden md:flex flex-col w-[240px] flex-shrink-0">
          {/* User Profile */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
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
              const isActive = link.label === "Subscription"
              return (
                <Link
                  key={link.label}
                  href={link.href}
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
          <h1 className="text-2xl font-bold text-foreground mb-8">Subscription</h1>

          {/* Section 1: Current Plan */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Current Plan</h2>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl font-bold text-foreground">Hallyu Pass</span>
                    <span style={{ color: "#FF4B6E" }}>&#10022;</span>
                    <span 
                      className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}
                    >
                      Active
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Price: </span>
                      <span className="text-foreground font-medium">$15.00/month</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Next billing: </span>
                      <span className="text-foreground">June 7, 2026</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Card on file: </span>
                      <span className="text-foreground">Visa •••• 4242</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/mypage/subscription/payment">
                  <Button
                    variant="outline"
                    className="rounded-full border-border/50 hover:bg-secondary/50"
                  >
                    Change payment method
                  </Button>
                </Link>
                <Link href="/mypage/subscription/cancel">
                  <Button
                    variant="outline"
                    className="rounded-full border-border/50 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50"
                  >
                    Cancel subscription
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* Section 2: Billing History */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Billing History</h2>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left text-muted-foreground text-sm font-medium px-6 py-4">Date</th>
                      <th className="text-left text-muted-foreground text-sm font-medium px-6 py-4">Description</th>
                      <th className="text-left text-muted-foreground text-sm font-medium px-6 py-4">Amount</th>
                      <th className="text-left text-muted-foreground text-sm font-medium px-6 py-4">Status</th>
                      <th className="text-left text-muted-foreground text-sm font-medium px-6 py-4">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingHistory.map((item, index) => (
                      <tr 
                        key={index}
                        className={index !== billingHistory.length - 1 ? "border-b border-border/30" : ""}
                      >
                        <td className="text-foreground text-sm px-6 py-4">{item.date}</td>
                        <td className="text-foreground text-sm px-6 py-4">{item.description}</td>
                        <td className="text-foreground text-sm px-6 py-4">{item.amount}</td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1 text-sm" style={{ color: "#22c55e" }}>
                            {item.status} <Check className="w-4 h-4" />
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link 
                            href="/mypage/subscription/receipt"
                            className="flex items-center gap-1 text-sm hover:underline"
                            style={{ color: "#FF4B6E" }}
                          >
                            <Download className="w-4 h-4" /> Download
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section 3: Switch Plan */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Switch Plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Monthly Plan */}
              <div 
                className="bg-[#1a1a1a] rounded-xl p-6 relative"
                style={{ 
                  border: currentPlan === "monthly" ? "2px solid #FF4B6E" : "1px solid rgba(255,255,255,0.1)"
                }}
              >
                {currentPlan === "monthly" && (
                  <span 
                    className="absolute top-4 right-4 text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
                  >
                    Current
                  </span>
                )}
                <h3 className="text-foreground font-semibold text-lg mb-2">Monthly</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-foreground">$15</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-muted-foreground text-sm">Billed monthly. Cancel anytime.</p>
              </div>

              {/* Annual Plan */}
              <div 
                className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6 relative"
              >
                <span 
                  className="absolute top-4 right-4 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
                >
                  Save 33%
                </span>
                <h3 className="text-foreground font-semibold text-lg mb-2">Annual</h3>
                <div className="mb-1">
                  <span className="text-3xl font-bold text-foreground">$10</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-muted-foreground text-sm mb-4">$120/year, billed annually</p>
                <Link href="/mypage/subscription">
                  <Button
                    className="w-full rounded-full font-medium text-white"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    Switch to Annual
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* Section 4: Cancel Subscription */}
          <section className="mb-8">
            <div className="bg-[#141416] border border-border/20 rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <p className="text-muted-foreground text-sm">
                  If you cancel, you&apos;ll keep access until <span className="text-foreground">June 7, 2026</span>.
                </p>
                <Link 
                  href="/mypage/subscription/cancel"
                  className="text-sm font-medium hover:underline text-red-500"
                >
                  Cancel subscription
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
