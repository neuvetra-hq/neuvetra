import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js"

export interface AuthenticatedUser {
  id: string
  phone: string | null
  email: string | null
  fullName: string | null
}

/**
 * Pulls the JWT off an `Authorization: Bearer <token>` header.
 * Returns null if the header is missing or doesn't follow the Bearer
 * scheme. Validation of the token itself is `validateUserFromToken`'s job.
 */
export function extractBearerToken(headers: Headers): string | null {
  const raw = headers.get("authorization")
  if (!raw) return null
  const trimmed = raw.trim()
  const match = trimmed.match(/^bearer\s+(.+)$/i)
  if (!match) return null
  const token = match[1]?.trim()
  return token && token.length > 0 ? token : null
}

/** Seconds a token may be past its `exp` (by this server's clock) and still be sent to Supabase. */
export const TOKEN_PRECHECK_CLOCK_SKEW_SECONDS = 60
const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/

function decodeJsonObjectSegment(segment: string): Record<string, unknown> | null {
  // A base64url segment never has a length of 1 mod 4 (unpadded).
  if (segment.length % 4 === 1) return null
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(segment, "base64url"))
    const value: unknown = JSON.parse(text)
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch { return null }
}

/**
 * API-02: a cheap local filter run before the network call to Supabase. Returns false for a token that is not
 * structurally a JWT (three unpadded base64url segments, a JSON-object header and payload) or whose numeric `exp` is
 * more than `skewSeconds` in the past; such a token cannot be accepted by Supabase. Returns true otherwise.
 *
 * It verifies NO signature: `true` means only "worth asking Supabase", never "authentic". A token that passes must
 * still be validated by `validateUserFromToken`. A token without `exp` passes (Supabase decides); a non-numeric `exp`
 * does not.
 */
export function isPlausibleUnexpiredJwt(token: string, nowMs = Date.now(), skewSeconds = TOKEN_PRECHECK_CLOCK_SKEW_SECONDS): boolean {
  const parts = token.split(".")
  if (parts.length !== 3 || !parts.every(part => BASE64URL_SEGMENT.test(part))) return false
  const header = decodeJsonObjectSegment(parts[0]!)
  const payload = decodeJsonObjectSegment(parts[1]!)
  if (!header || !payload) return false
  if (!("exp" in payload)) return true
  const exp = payload.exp
  if (typeof exp !== "number" || !Number.isFinite(exp)) return false
  return exp * 1000 > nowMs - skewSeconds * 1000
}

/**
 * Validates a Supabase JWT and returns the user, or null if the token is
 * invalid / expired / unknown. The SupabaseClient is taken as a parameter
 * (DI pattern) so tests can pass a mock without dragging the real
 * client's env-var dependency into the test runner.
 *
 * Today: calls Supabase's auth API once per request (~50-100ms). Future
 * optimization: local JWT verification with the project's JWT secret
 * skips the round-trip; not needed for M2.1.
 */
export async function validateUserFromToken(
  token: string,
  supabase: SupabaseClient,
  options: { throwWhenUnavailable?: boolean } = {},
): Promise<AuthenticatedUser | null> {
  const { data, error } = await supabase.auth.getUser(token)
  if (error && options.throwWhenUnavailable) {
    const status = (error as { status?: unknown }).status
    if (isAuthRetryableFetchError(error) || status === 429 || (typeof status === "number" && status >= 500)) throw new Error("Authentication provider unavailable.")
  }
  if (error || !data.user) return null
  const user = data.user
  return {
    id: user.id,
    phone: user.phone ?? null,
    email: user.email ?? null,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
  }
}
