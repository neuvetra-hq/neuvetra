import type { SupabaseClient } from "@supabase/supabase-js"

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
): Promise<AuthenticatedUser | null> {
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  const user = data.user
  return {
    id: user.id,
    phone: user.phone ?? null,
    email: user.email ?? null,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
  }
}
