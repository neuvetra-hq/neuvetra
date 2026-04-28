/**
 * Server-side origin allowlist for `/chat`.
 *
 * The `@elysiajs/cors` plugin enforces origin in the *browser* — preflight
 * + Access-Control-Allow-Origin response headers. That stops cross-origin
 * fetches from a malicious page; it does NOT stop a curl script or a
 * server-side bot that simply ignores CORS.
 *
 * This check runs server-side, before rate-limit + handler, and rejects any
 * request whose `Origin` header isn't in the allowlist (or is missing
 * entirely). Strict by design — legitimate callers (the web app, dev) all
 * send Origin; everything else is junk.
 */

export interface OriginCheckResult {
  allowed: boolean
  /** The Origin header value, for logging. `null` when absent. */
  origin: string | null
}

export function checkOrigin(
  headers: Headers,
  allowedOrigins: readonly string[],
): OriginCheckResult {
  const origin = headers.get("origin")
  if (!origin) {
    return { allowed: false, origin: null }
  }
  return { allowed: allowedOrigins.includes(origin), origin }
}
