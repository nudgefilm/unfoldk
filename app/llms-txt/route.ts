import { readFile } from "node:fs/promises"
import path from "node:path"

export const dynamic = "force-static"

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "llms.txt")
  const content = await readFile(filePath, "utf-8")

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  })
}
