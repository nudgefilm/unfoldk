// 블로그 자동 포스팅 — 토픽 풀
//
// Haiku 가 매일 1개 선택 (스펙). 5개로 고정 — 늘리려면 reviewer 1차 통과 후 추가 권장
// (퀄리티 분산 우려). 각 topic 은 영어 audience 기준 동작.

export interface BlogTopic {
  id: string
  label: string // 한국어 사람 라벨 (스펙 표기 그대로)
  englishPrompt: string // Haiku 에 줄 영어 가이드
  defaultTags: string[]
  imageQueryHint: string // Unsplash 검색 기본 키워드 (Haiku 가 보강)
}

export const TOPIC_POOL: readonly BlogTopic[] = [
  {
    id: "kpop-comebacks-this-week",
    label: "이번 주 K팝 컴백 정리",
    englishPrompt:
      "Recap notable K-pop comebacks or releases happening this week. Focus on what's new, who's behind it, and why fans should care. Do not fabricate specific song titles, dates, or chart positions — write at a thematic level (genres, group concepts, fan reactions).",
    defaultTags: ["K-pop", "Comebacks"],
    imageQueryHint: "kpop concert stage lights",
  },
  {
    id: "new-kdrama-introduction",
    label: "신작 K드라마 소개",
    englishPrompt:
      "Introduce a recent or upcoming K-drama trend or genre wave (e.g., revenge thrillers, healing slice-of-life, time-slip romance). Avoid naming specific titles unless they are universally known classics — frame the post around the mood, themes, and what kind of viewer will love them.",
    defaultTags: ["K-drama", "Behind the scenes"],
    imageQueryHint: "korean drama cinematic film",
  },
  {
    id: "artist-global-chart-analysis",
    label: "아티스트 글로벌 차트 분석",
    englishPrompt:
      "Explore what global K-pop chart performance actually means in 2026 — the difference between streams, listeners, subscribers, sales, and social mentions. Make it educational. Do not invent specific numbers; speak in patterns and signals.",
    defaultTags: ["K-pop", "Data", "Charts"],
    imageQueryHint: "music streaming data analytics",
  },
  {
    id: "korean-expression-tip",
    label: "한국어 표현 학습 팁",
    englishPrompt:
      "Teach 3–5 Korean phrases that K-pop and K-drama fans hear constantly. For each: the Hangul, romanization, English meaning, and one tip about when/how Koreans actually use it. Beginner-friendly tone.",
    defaultTags: ["Learning", "Korean language"],
    imageQueryHint: "korean language hangul learning",
  },
  {
    id: "kfood-recipe",
    label: "K푸드 레시피 소개",
    englishPrompt:
      "Introduce one approachable Korean dish drama fans often see on screen (e.g., kimchi jjigae, tteokbokki, bibimbap, jjajangmyeon). Cover: what it is, when Koreans eat it, key ingredients, and a 5-step easy version for home cooks. Do not invent precise gram measurements — use 'a handful', 'a splash', practical phrasing.",
    defaultTags: ["Recipes", "Korean food"],
    imageQueryHint: "korean food bibimbap cooking",
  },
] as const

export type TopicId = (typeof TOPIC_POOL)[number]["id"]

export function getTopicById(id: string): BlogTopic | null {
  return TOPIC_POOL.find((t) => t.id === id) ?? null
}
