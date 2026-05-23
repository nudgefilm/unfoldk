"use client"

import { StartModal } from "@/components/start-modal"
import { Button } from "@/components/ui/button"

export function EarlyAccessSection() {
  return (
    <section className="w-full px-5">
      <div
        className="rounded-2xl border border-border/30 px-8 py-14 md:py-20 flex flex-col items-center text-center"
        style={{ backgroundColor: "#141418" }}
      >
        {/* Early Access 배지 */}
        <span
          className="inline-block px-4 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
          style={{
            backgroundColor: "rgba(255, 75, 110, 0.15)",
            color: "#FF4B6E",
            border: "1px solid rgba(255, 75, 110, 0.3)",
          }}
        >
          Early Access
        </span>

        <h2 className="text-foreground text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight mb-4 max-w-xl">
          Be Among the First Hallyu Fans
        </h2>

        <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-lg mb-10">
          UnfoldK is in early access. Join now and shape the future of K-culture discovery.
        </p>

        <StartModal
          trigger={
            <Button
              className="px-8 py-3 text-base font-medium rounded-[99px] text-white shadow-[0px_0px_0px_4px_rgba(255,75,110,0.2)] hover:opacity-90 transition-all duration-200"
              style={{ backgroundColor: "#FF4B6E" }}
              size="lg"
            >
              Start for Free
            </Button>
          }
        />
      </div>
    </section>
  )
}
