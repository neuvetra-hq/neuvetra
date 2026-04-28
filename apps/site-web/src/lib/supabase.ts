import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — auth flows will not work locally. " +
      "Populate apps/web/.env (use apps/web/.env.example as a template).",
  )
}

/**
 * Browser-side Supabase client (singleton). Default config: persists
 * sessions in localStorage and auto-restores them on page load. The same
 * instance is imported wherever auth is needed — login flows, the chat
 * transport (for the Bearer header), and components reading auth state.
 */
export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "")
