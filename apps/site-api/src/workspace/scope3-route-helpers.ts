import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"

/**
 * Shared helpers of the Scope 3 workspace routes (round 2, ENG-14; Claude, lane B, 31 October 2026): one place for the
 * UUID pattern, the origin and bearer prelude, exact-key checks and the JSON body reader, so every Scope 3 JSON write
 * (assessment PUT, report POST, approval POST, spend-mapping POST) requires `application/json` and the same limits.
 * Round 2b integration: the spend routes use them too (the spend CSV import reads its `text/csv` body with the same reader).
 */
export const SCOPE3_UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
export const SCOPE3_UUID = new RegExp(`^${SCOPE3_UUID_SOURCE}$`)
export const scope3Respond = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } })
/** Round 3 (EN-1, owner decision 6): a refusal the client may retry after `seconds` (Retry-After), e.g. 503 while busy. */
export const scope3RespondRetry = (status: number, body: unknown, seconds: number) => Response.json(body, { status, headers: { "cache-control": "no-store", "retry-after": String(seconds) } })
/**
 * Round 3 (EN-1): the refusal for a write the database stopped before it saved anything: 55P03 (another write held the
 * company lock past lock_timeout, after the one retry) or 57014 (statement timeout). Null for any other error.
 */
export function scope3BusyResponse(error: unknown): Response | null {
  const code = (error as { code?: string } | null)?.code
  if (code === "55P03") return scope3RespondRetry(503, { code: "company_busy", error: "Another change to this company's records is still being saved, so nothing was saved. Try again in a few seconds." }, 5)
  if (code === "57014") return scope3RespondRetry(503, { code: "write_timed_out", error: "This took too long and nothing was saved. Try again in a minute; a smaller file saves faster." }, 30)
  return null
}
export const isPlainObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
export const hasExactKeys = (value: unknown, keys: readonly string[]) => isPlainObject(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|")

/** A refusal with its HTTP status and body (the route answers it as is). */
export class Scope3RouteProblem extends Error { constructor(readonly status: number, readonly body: Record<string, unknown>) { super(String(body.error)) } }

/** The media type of a request, lower-cased, without parameters ("" when absent). */
export const scope3ContentType = (request: Request) => request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? ""

/**
 * The body bytes of a write (round 2b integration: shared by the JSON writes and the spend CSV import, so every Scope 3
 * write refuses a wrong media type with 415 at the same step, once the actor and the setup are checked): the media type
 * must be `mediaType` (415 with `messages.unsupported`), and the body at most `maxBytes` (413 with `messages.tooLarge`;
 * the declared length is checked first).
 */
export async function readScope3Body(request: Request, mediaType: "application/json" | "text/csv", maxBytes: number, messages: { unsupported: string; tooLarge: string }): Promise<Uint8Array> {
  if (scope3ContentType(request) !== mediaType) throw new Scope3RouteProblem(415, { error: messages.unsupported })
  const claimed = request.headers.get("content-length")
  if (claimed && (!/^\d+$/.test(claimed) || Number(claimed) > maxBytes)) throw new Scope3RouteProblem(413, { error: messages.tooLarge })
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > maxBytes) throw new Scope3RouteProblem(413, { error: messages.tooLarge })
  return bytes
}

/**
 * The JSON body of a write: `application/json` (415 otherwise), at most `maxBytes` (413; the declared length is checked
 * first), parsed as strict UTF-8 JSON (422 with `invalidMessage` otherwise).
 */
export async function readScope3JsonBody(request: Request, maxBytes: number, invalidMessage: string): Promise<unknown> {
  const bytes = await readScope3Body(request, "application/json", maxBytes, { unsupported: "JSON content type required.", tooLarge: "Request too large." })
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) } catch { throw new Scope3RouteProblem(422, { error: invalidMessage }) }
}

/**
 * The prelude every Scope 3 route shares: a cross-origin request is refused, a write must carry the configured origin
 * (403); the method must be allowed (405); a bearer token must name a user (401; 503 when authentication is unavailable).
 * Returns the actor, or the response to send.
 */
export async function scope3RoutePrelude(request: Request, deps: { origin: string; validateUser: (token: string) => Promise<AuthenticatedUser | null> }, allowed: readonly string[]): Promise<{ actor: AuthenticatedUser } | { response: Response }> {
  const origin = request.headers.get("origin")
  if ((origin && origin !== deps.origin) || (request.method !== "GET" && origin !== deps.origin)) return { response: scope3Respond(403, { error: "Forbidden." }) }
  if (!allowed.includes(request.method)) return { response: scope3Respond(405, { error: "Method not allowed." }) }
  const token = extractBearerToken(request.headers)
  if (!token || token.length > 8192) return { response: scope3Respond(401, { error: "Authentication required." }) }
  let actor: AuthenticatedUser | null
  try { actor = await deps.validateUser(token) } catch { return { response: scope3Respond(503, { error: "Authentication is unavailable." }) } }
  if (!actor) return { response: scope3Respond(401, { error: "Authentication required." }) }
  return { actor }
}

/**
 * Round 3 (owner decision 6): a full garbage collection between the phases of a report prepare (the previous version's
 * parse, the results and document once the texts exist), so the next phase never sits on the last one's garbage. Prepare is
 * one at a time per instance and rare; Bun only (a no-op elsewhere).
 */
export function scope3CollectGarbage(): void { (globalThis as { Bun?: { gc(force: boolean): void } }).Bun?.gc(true) }
