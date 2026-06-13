"use client"

const VARIANTS = [
  {
    emoji: "💬",
    title: "What's Your Hallyu Story?",
    body: "Obsessed with a comeback? Found your bias? Share your K-pop journey, drama reviews, travel moments, and more with fans worldwide.",
    button: "Write Your Feed →",
  },
  {
    emoji: "🌏",
    title: "Join the Global Hallyu Conversation",
    body: "From Seoul street food to your favorite OST — every Hallyu fan has a story worth sharing. Be part of a community that lives and breathes Korean culture.",
    button: "Share Your Story →",
  },
  {
    emoji: "🎵",
    title: "Your Bias Deserves More Than Just Streams",
    body: "Write about your favorite artist, that one MV that changed everything, or the K-drama scene that made you cry. Real fans, real stories.",
    button: "Post Your Feed →",
  },
]

interface ParticipateCardProps {
  variantIndex: number
  userId: string | null
  onWrite: () => void
  onLoginPrompt: () => void
}

export function ParticipateCard({ variantIndex, userId, onWrite, onLoginPrompt }: ParticipateCardProps) {
  const v = VARIANTS[variantIndex % 3] ?? VARIANTS[0]

  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-pink-600 to-rose-500 p-4 flex flex-col gap-4">
      <div className="text-3xl">{v.emoji}</div>
      <div className="flex flex-col gap-2">
        <p className="text-white font-bold text-base leading-snug">{v.title}</p>
        <p className="text-white/85 text-xs leading-relaxed">{v.body}</p>
      </div>
      <button
        type="button"
        onClick={() => userId ? onWrite() : onLoginPrompt()}
        className="self-start px-4 py-2 rounded-xl bg-white text-pink-600 text-sm font-semibold hover:bg-white/90 transition-colors"
      >
        {v.button}
      </button>
    </div>
  )
}
