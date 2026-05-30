// HangeulGo Phase 1 — DB row → API 응답 매핑 (snake_case → camelCase)

export interface WordBreakdownItem {
  word: string
  romanization: string
  meaning: string
}

export interface KoreanPhraseApi {
  id: string
  dramaId: string | null
  dramaName: string | null
  korean: string
  romanization: string | null
  english: string
  wordBreakdown: WordBreakdownItem[]
  synonyms: string[]
  antonyms: string[]
  difficulty: "beginner" | "intermediate" | "advanced" | null
  audioUrl: string | null
  imageUrl: string | null
  sceneDescription: string | null
  featuredDate: string | null
  createdAt: string
}

interface KoreanPhraseRowDb {
  id: string
  drama_id: string | null
  drama_name: string | null
  korean: string
  romanization: string | null
  english: string
  word_breakdown: unknown
  synonyms: string[] | null
  antonyms: string[] | null
  difficulty: string | null
  audio_url: string | null
  image_url: string | null
  scene_description: string | null
  featured_date: string | null
  created_at: string
}

export function mapKoreanPhraseRow(row: unknown): KoreanPhraseApi {
  const r = row as KoreanPhraseRowDb
  const wb = Array.isArray(r.word_breakdown)
    ? (r.word_breakdown as WordBreakdownItem[])
    : []
  const difficulty =
    r.difficulty === "beginner" ||
    r.difficulty === "intermediate" ||
    r.difficulty === "advanced"
      ? r.difficulty
      : null

  return {
    id: r.id,
    dramaId: r.drama_id,
    dramaName: r.drama_name,
    korean: r.korean,
    romanization: r.romanization,
    english: r.english,
    wordBreakdown: wb,
    synonyms: r.synonyms ?? [],
    antonyms: r.antonyms ?? [],
    difficulty,
    audioUrl: r.audio_url,
    imageUrl: r.image_url,
    sceneDescription: r.scene_description,
    featuredDate: r.featured_date,
    createdAt: r.created_at,
  }
}
