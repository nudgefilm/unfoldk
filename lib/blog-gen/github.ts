// GitHub Contents API — content/blog/{filename}.mdx 자동 push
//
// 흐름:
//   - getFileSha(path) — 기존 파일 SHA 조회. 없으면 null.
//   - putFile(path, content, message) — 신규(insert) 또는 기존(update) 자동 분기.
//   - push 성공 시 Vercel 자동 배포 트리거 (push to main 기준).
//
// 인증: GITHUB_TOKEN (PAT 또는 GitHub App token). 권한 — contents: write
// 대상: GITHUB_REPO ("owner/repo"), 기본 branch "main" (GITHUB_BRANCH override 가능)
//
// 보안:
//   - path 는 호출자가 검증 (slug regex). 본 모듈은 단순 전달.
//   - 본 API 는 cron 라우트만 호출. 외부 입력 직접 노출 없음.
//
// 멱등성:
//   - 동일 path 에 동일 내용 push 시 GitHub 가 409 Conflict 반환 (sha 미일치).
//   - run.ts 가 이를 dup 으로 해석.

export interface PutFileResult {
  ok: boolean
  status: number
  htmlUrl?: string
  commitSha?: string
  error?: string
  duplicate?: boolean // 동일 경로 파일 이미 존재 (오늘 cron 재실행 등)
}

export class GitHubError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = "GitHubError"
  }
}

interface GitHubContentResponse {
  content?: { html_url?: string; sha?: string }
  commit?: { sha?: string }
}

function getConfig() {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  const branch = process.env.GITHUB_BRANCH ?? "main"
  if (!token) throw new GitHubError("GITHUB_TOKEN 미설정")
  if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) {
    throw new GitHubError(`GITHUB_REPO 형식 위반 (expect 'owner/repo'): ${String(repo)}`)
  }
  return { token, repo, branch }
}

// 기존 파일 SHA 조회. 없으면 null.
export async function getFileSha(filePath: string): Promise<string | null> {
  const { token, repo, branch } = getConfig()
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "unfoldk-blog-cron",
    },
    // 캐시 회피 — cron 재실행 시 최신 상태 확인 필요
    cache: "no-store",
  })

  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new GitHubError(`getFileSha HTTP ${res.status}: ${body.slice(0, 200)}`, res.status)
  }
  const json = (await res.json()) as { sha?: string }
  return json.sha ?? null
}

export async function putFile(
  filePath: string,
  content: string,
  commitMessage: string
): Promise<PutFileResult> {
  const { token, repo, branch } = getConfig()

  // 기존 파일 SHA — 있으면 update 모드
  let existingSha: string | null
  try {
    existingSha = await getFileSha(filePath)
  } catch (err) {
    return {
      ok: false,
      status: err instanceof GitHubError && err.status ? err.status : 0,
      error: `getFileSha 실패: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (existingSha) {
    // 이미 존재 — 오늘 cron 재실행으로 보고 중단. 덮어쓰지 않음 (안전 우선).
    return {
      ok: false,
      status: 409,
      duplicate: true,
      error: `파일 이미 존재: ${filePath} (sha=${existingSha.slice(0, 7)})`,
    }
  }

  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`

  // GitHub Contents API 는 base64 content 요구
  const contentBase64 = Buffer.from(content, "utf8").toString("base64")

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "unfoldk-blog-cron",
    },
    body: JSON.stringify({
      message: commitMessage,
      content: contentBase64,
      branch,
      // committer 는 미지정 → 토큰 소유자로 자동 귀속
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    return {
      ok: false,
      status: res.status,
      error: `PUT contents HTTP ${res.status}: ${body.slice(0, 200)}`,
    }
  }

  const json = (await res.json()) as GitHubContentResponse
  return {
    ok: true,
    status: res.status,
    htmlUrl: json.content?.html_url,
    commitSha: json.commit?.sha,
  }
}
