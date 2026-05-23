// 블로그 자동 포스팅 — 토픽 풀 + 최근 사용 topicId 수집
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

// ─── 최근 사용 topicId 수집 (GitHub Contents API) ───────────────────────────
// used-images.ts 의 GitHub 호출 패턴과 동일. 별도 파일로 분리하지 않고 토픽 관련
// 로직을 한 곳에 집중.

interface GHDirEntry {
  name: string
  type: string
  download_url: string | null
}

async function fetchBlogDirEntries(): Promise<GHDirEntry[]> {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  const branch = process.env.GITHUB_BRANCH ?? "main"
  if (!token || !repo) return []

  const url = `https://api.github.com/repos/${repo}/contents/content/blog?ref=${encodeURIComponent(branch)}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "unfoldk-blog-cron",
    },
    cache: "no-store",
  })
  if (res.status === 404) return []
  if (!res.ok) return []
  const json = (await res.json()) as unknown
  if (!Array.isArray(json)) return []
  return (json as GHDirEntry[]).filter((e) => e.type === "file" && e.name.endsWith(".mdx"))
}

// MDX frontmatter 의 topicId 라인 추출.
// 형식: topicId: "kpop-comebacks-this-week" (run.ts 가 저장하는 형식)
function extractTopicIdFromFrontmatter(mdx: string): string | null {
  const fm = mdx.match(/^---\n([\s\S]*?)\n---/)
  if (!fm) return null
  const line = fm[1].match(/^topicId:\s*(.+)$/m)
  if (!line) return null
  const raw = line[1].trim().replace(/^["']|["']$/g, "")
  return TOPIC_POOL.some((t) => t.id === raw) ? raw : null
}

// 최근 N 개 포스트의 topicId 목록 (최신순). 실패 시 빈 배열 — 생성 자체는 진행.
export async function listRecentTopicIds(limit = 5): Promise<string[]> {
  let entries: GHDirEntry[]
  try {
    entries = await fetchBlogDirEntries()
  } catch {
    return []
  }

  // YYYY-MM-DD-* 파일명 → desc 정렬로 최신순
  entries.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0))
  const targets = entries.slice(0, limit)

  const ids: string[] = []
  await Promise.all(
    targets.map(async (entry) => {
      if (!entry.download_url) return
      try {
        const res = await fetch(entry.download_url, { cache: "no-store" })
        if (!res.ok) return
        const id = extractTopicIdFromFrontmatter(await res.text())
        if (id) ids.push(id)
      } catch {
        // swallow — 중복 회피 실패해도 생성은 진행
      }
    })
  )
  return ids
}

// ─── Claude 프롬프트 헬퍼 ─────────────────────────────────────────────────────

// 제외 토픽 지시문. excludeIds 가 비어있으면 빈 문자열 반환.
export function buildExcludeInstruction(excludeIds: string[]): string {
  if (excludeIds.length === 0) return ""
  return `\nRecently used topics — do NOT pick these: ${excludeIds.join(", ")}. Choose a different topic from the pool.`
}

// 모든 토픽이 최근에 사용된 경우 가장 오래된 것을 fallback 으로 반환.
// excludeIds 는 최신순이므로 마지막 항목이 가장 오래된 것.
export function pickFallbackTopic(excludeIds: string[]): BlogTopic {
  const oldestId = excludeIds[excludeIds.length - 1]
  return TOPIC_POOL.find((t) => t.id === oldestId) ?? TOPIC_POOL[0]
}

// 모든 토픽이 제외 목록에 있는지 여부
export function allTopicsExcluded(excludeIds: string[]): boolean {
  return TOPIC_POOL.every((t) => excludeIds.includes(t.id))
}
