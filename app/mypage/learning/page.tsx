"use client"

// /mypage/learning — HangeulGo Coming Soon
// M+3 로드맵. ElevenLabs TTS 인프라 출시 후 학습 진도·streak 분기 추가.

import Link from "next/link"
import { Languages } from "lucide-react"
import { MypageShell } from "@/components/mypage/mypage-shell"

export default function MyLearningPage() {
  return (
    <MypageShell activeLabel="Learning Progress">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Learning Progress</h1>
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-16 text-center">
          <div className="flex justify-center mb-4">
            <Languages className="w-12 h-12" style={{ color: "#FF4B6E" }} />
          </div>
          <p className="text-foreground font-semibold text-lg mb-2">
            HangeulGo is launching soon.
          </p>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Learn Korean phrases from your favorite K-dramas with native-speaker audio. Track your
            daily streak and progress here.
          </p>
          <Link
            href="/korean"
            className="inline-block text-sm font-medium hover:underline"
            style={{ color: "#FF4B6E" }}
          >
            Preview HangeulGo →
          </Link>
        </div>
      </div>
    </MypageShell>
  )
}
