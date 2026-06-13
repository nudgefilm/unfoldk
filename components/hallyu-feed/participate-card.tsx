"use client"

import { MessageCircle, Globe, Music } from "lucide-react"

const VARIANTS = [
  {
    Icon: MessageCircle,
    title: "What's Your Hallyu Story?",
    body: "Obsessed with a comeback? Found your bias? Share your K-pop journey, drama reviews, travel moments, and more with fans worldwide.",
    button: "Write Your Feed →",
  },
  {
    Icon: Globe,
    title: "Join the Global Hallyu Conversation",
    body: "From Seoul street food to your favorite OST — every Hallyu fan has a story worth sharing. Be part of a community that lives and breathes Korean culture.",
    button: "Share Your Story →",
  },
  {
    Icon: Music,
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
  const { Icon } = v

  return (
    <div className="rounded-2xl bg-pink-950/30 border border-pink-800/40 p-4 flex flex-col gap-4">
      <Icon className="w-8 h-8 text-pink-500" />
      <div className="flex flex-col gap-2">
        <p className="text-white font-bold text-base leading-snug">{v.title}</p>
        <p className="text-white/75 text-xs leading-relaxed">{v.body}</p>
      </div>
      <button
        type="button"
        onClick={() => userId ? onWrite() : onLoginPrompt()}
        className="self-start px-4 py-2 rounded-xl border border-pink-500 text-pink-400 text-sm font-semibold hover:bg-pink-500/10 transition-colors"
      >
        {v.button}
      </button>
    </div>
  )
}
