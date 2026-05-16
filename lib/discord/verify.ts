// Discord 인터랙션 webhook 서명 검증 (Ed25519)
// 외부 패키지 (discord-interactions / tweetnacl) 없이 Node 내장 crypto 만 사용.
//
// Discord 가 매 요청에 X-Signature-Ed25519 / X-Signature-Timestamp 헤더를 보내고,
// `${timestamp}${rawBody}` 를 Ed25519 로 서명. PUBLIC_KEY 는 raw 32-byte hex.
//
// Node crypto.createPublicKey 는 raw 키 직접 import 불가 → SPKI DER prefix 부착해
// 형태 변환. (RFC 8410 §4 Ed25519 SPKI prefix 12 bytes 고정.)

import { createPublicKey, verify as cryptoVerify } from "node:crypto"

// SPKI DER prefix for Ed25519 (12 bytes):
// SEQUENCE(42) → SEQUENCE(5) [OID 1.3.101.112] → BIT STRING(33) (1 unused + 32 raw)
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex")

let cachedKey: ReturnType<typeof createPublicKey> | null = null

function getPublicKey() {
  if (cachedKey) return cachedKey
  const hex = process.env.DISCORD_PUBLIC_KEY
  if (!hex) throw new Error("DISCORD_PUBLIC_KEY 미설정")
  const rawKey = Buffer.from(hex, "hex")
  if (rawKey.length !== 32) {
    throw new Error(`DISCORD_PUBLIC_KEY 길이 오류: ${rawKey.length} bytes (32 expected)`)
  }
  const spki = Buffer.concat([SPKI_PREFIX, rawKey])
  cachedKey = createPublicKey({ key: spki, format: "der", type: "spki" })
  return cachedKey
}

// rawBody 는 반드시 request.text() 로 가져온 원본 문자열 (JSON.parse 후 stringify 금지 — 직렬화 차이로 서명 깨짐)
export function verifyDiscordSignature(
  rawBody: string,
  signatureHex: string | null,
  timestamp: string | null
): boolean {
  if (!signatureHex || !timestamp) return false
  try {
    const sig = Buffer.from(signatureHex, "hex")
    if (sig.length !== 64) return false
    const data = Buffer.concat([Buffer.from(timestamp, "utf8"), Buffer.from(rawBody, "utf8")])
    return cryptoVerify(null, data, getPublicKey(), sig)
  } catch (err) {
    console.error("[discord-verify] 검증 실패:", err)
    return false
  }
}
