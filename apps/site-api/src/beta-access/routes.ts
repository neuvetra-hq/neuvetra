import { BETA_ACCESS_PROFILE, BETA_ACCESS_UUID_PATTERN, parseBetaRedeemRequest } from "../../../../packages/neuvetra-database/src/beta-access-contract"
import { BetaDatabaseError, type BetaAccessDatabase } from "../../../../packages/neuvetra-database/src/beta-access"
import type { VerifiedBetaIdentity } from "./auth"

export const BETA_ACCESS_MAX_BODY_BYTES = 2048

function json(status: number, body: unknown, closeConnection = false): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8", ...(closeConnection ? { connection: "close" } : {}) } })
}

function databaseFailure(error: unknown): Response {
  if (error instanceof BetaDatabaseError && error.kind === "conflict") return json(409, { error: "Request conflict." })
  if (error instanceof BetaDatabaseError && error.kind === "unavailable") return json(404, { error: "Invitation unavailable." })
  return json(503, { error: "Beta access is unavailable." })
}

async function readBoundedBody(request: Request): Promise<string> {
  const reader = request.body?.getReader()
  if (!reader) return ""
  let size = 0
  const decoder = new TextDecoder("utf-8", { fatal: true })
  let body = ""
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > BETA_ACCESS_MAX_BODY_BYTES) {
        await reader.cancel()
        throw new RangeError("body")
      }
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()
    return body
  } finally { reader.releaseLock() }
}

function parseStrictBody(source: string) {
  const keys = [...source.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g)].map(match => match[1])
  if (keys.length !== 2 || keys.filter(key => key === "token").length !== 1 || keys.filter(key => key === "requestId").length !== 1) throw new SyntaxError("keys")
  return parseBetaRedeemRequest(JSON.parse(source))
}

export interface BetaRoutesDependencies {
  database: BetaAccessDatabase
  identity: VerifiedBetaIdentity
}

export async function handleBetaAccessRoute(request: Request, dependencies: BetaRoutesDependencies): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname === "/beta-api/invitations/redeem") {
    if (request.method !== "POST") return json(405, { error: "Method not allowed." })
    if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return json(415, { error: "JSON content required." })
    let source: string
    try { source = await readBoundedBody(request) } catch (error) { return error instanceof RangeError ? json(413, { error: "Request too large." }, true) : json(422, { error: "Invalid request." }) }
    let input
    try { input = parseStrictBody(source) } catch { return json(422, { error: "Invalid request." }) }
    const digest = new Bun.CryptoHasher("sha256").update(input.token).digest("hex")
    try {
      const result = await dependencies.database.redeem(dependencies.identity.id, dependencies.identity.email, digest, input.requestId)
      return json(result.replayed ? 200 : 201, { profile: BETA_ACCESS_PROFILE, ...result.access })
    } catch (error) { return databaseFailure(error) }
  }
  if (url.pathname === "/beta-api/session") {
    if (request.method !== "GET") return json(405, { error: "Method not allowed." })
    try { return json(200, { profile: BETA_ACCESS_PROFILE, access: await dependencies.database.readSession(dependencies.identity.id, dependencies.identity.email) }) } catch (error) { return databaseFailure(error) }
  }
  const match = url.pathname.match(/^\/beta-api\/workspaces\/([^/]+)$/)
  if (match) {
    if (request.method !== "GET") return json(405, { error: "Method not allowed." })
    if (!BETA_ACCESS_UUID_PATTERN.test(match[1]!)) return json(404, { error: "Workspace unavailable." })
    try {
      const access = await dependencies.database.readWorkspace(dependencies.identity.id, dependencies.identity.email, match[1]!)
      return access ? json(200, { profile: BETA_ACCESS_PROFILE, ...access }) : json(404, { error: "Workspace unavailable." })
    } catch (error) { return error instanceof BetaDatabaseError && error.kind === "dependency" ? databaseFailure(error) : json(404, { error: "Workspace unavailable." }) }
  }
  return json(404, { error: "Not found." })
}
