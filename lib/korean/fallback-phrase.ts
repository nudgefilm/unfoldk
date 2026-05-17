// HangeulGo Phase 1 — Claude 생성 / DB insert 실패 시 사용하는 fallback 표현.
//
// 목적: ANTHROPIC_API_KEY 미설정·Anthropic 장애·DB 일시 장애 상황에서도
// /korean 페이지가 "오늘의 표현을 불러오지 못했어요" 빈 화면이 되지 않도록 안전망.
//
// 주의: DB 에 저장하지 않음 — 캐시 오염 방지. 다음 요청 때 다시 Claude 호출 재시도.

import type { KoreanPhraseApi } from "@/lib/korean/mapper"

export function buildFallbackKoreanPhrase(today: string): KoreanPhraseApi {
  return {
    id: `fallback-${today}`,
    dramaId: null,
    dramaName: "K-drama",
    korean: "안녕하세요",
    romanization: "Annyeonghaseyo",
    english: "Hello",
    wordBreakdown: [
      { word: "안녕", romanization: "annyeong", meaning: "peace / hi" },
      { word: "하세요", romanization: "haseyo", meaning: "polite ending" },
    ],
    synonyms: ["안녕"],
    antonyms: [],
    difficulty: "beginner",
    audioUrl: null,
    featuredDate: today,
    createdAt: new Date().toISOString(),
  }
}
