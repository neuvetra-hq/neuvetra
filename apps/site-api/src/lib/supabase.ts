import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let cached: SupabaseClient | null = null

/**
 * Server-side Supabase client (singleton). Uses the anon key — every
 * request validates a user-supplied JWT, so the anon key is sufficient.
 *
 * Reads env vars lazily via `process.env` rather than importing the
 * project's typed env wrapper, so unit-test files that don't need a
 * Supabase call can safely import other modules in this lib without
 * triggering the boot-time env validator. The boot-time validator at
 * `apps/api/src/env.ts` is still the authoritative check; this defensive
 * throw catches the misconfiguration if `getSupabase()` somehow gets
 * called without env vars set (e.g. an integration test that forgot
 * to seed them).
 */
export function getSupabase(): SupabaseClient {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      "[getSupabase] SUPABASE_URL and SUPABASE_ANON_KEY must be set. " +
        "These are validated at boot via env.ts; if you're seeing this " +
        "in a test, set them via process.env before invoking getSupabase().",
    )
  }
  cached = createClient(url, key, {
    auth: {
      // Server doesn't persist sessions — every request stands on its own
      // JWT validated via supabase.auth.getUser(token).
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  return cached
}
