export function DashboardPreview() {
  const eventDays: Record<number, string> = {
    3: "BTS Concert",
    15: "BLACKPINK Comeback",
    21: "NewJeans Fan Meet",
  }

  return (
    <div className="w-[calc(100vw-32px)] md:w-[1160px]">
      <div className="bg-[#0d0d0d] border border-border/20 rounded-2xl p-6 md:p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-foreground text-xl md:text-2xl font-semibold">
            K-pop Events · May 2026
          </h2>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2 md:gap-3">
          {/* Day Headers */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-muted-foreground text-xs md:text-sm font-medium py-3 border-b border-border/20"
            >
              {day}
            </div>
          ))}

          {/* Empty cells for May 2026 starting on Friday */}
          {[...Array(5)].map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square md:aspect-[4/3]" />
          ))}

          {/* Calendar days */}
          {[...Array(31)].map((_, i) => {
            const day = i + 1
            const event = eventDays[day]

            return (
              <div
                key={day}
                className={`aspect-square md:aspect-[4/3] rounded-xl p-2 md:p-3 flex flex-col transition-all ${
                  event
                    ? "bg-[#1a1a1a] border border-border/30"
                    : "hover:bg-[#1a1a1a]/50"
                }`}
              >
                <span
                  className={`text-sm md:text-base font-medium ${
                    event ? "text-foreground" : "text-foreground/60"
                  }`}
                >
                  {day}
                </span>
                {event && (
                  <div className="mt-auto">
                    <span
                      className="inline-block text-[10px] md:text-xs font-medium px-2 py-1 rounded-md truncate max-w-full"
                      style={{ backgroundColor: "#FF4B6E", color: "white" }}
                    >
                      {event}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-border/20">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: "#FF4B6E" }}
            />
            <span className="text-muted-foreground text-xs md:text-sm">Scheduled Events</span>
          </div>
          <div className="ml-auto text-muted-foreground text-xs md:text-sm">
            3 events this month
          </div>
        </div>
      </div>
    </div>
  )
}
