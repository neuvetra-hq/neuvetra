import type { SupabaseClient } from "@supabase/supabase-js"

export interface VerifiedBetaIdentity { id: string; email: string }

/** Uses the provider's getUser response. Request claims and metadata are never identity authority. */
export async function validateBetaIdentity(token: string, client: SupabaseClient): Promise<VerifiedBetaIdentity | null> {
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  const user = data.user as typeof data.user & { email_confirmed_at?: string | null; banned_until?: string | null; deleted_at?: string | null }
  if (!user.email || !user.email_confirmed_at || user.deleted_at) return null
  if (user.banned_until && Date.parse(user.banned_until) > Date.now()) return null
  return { id: user.id, email: user.email }
}
