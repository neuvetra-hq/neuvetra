import { createClient } from "@supabase/supabase-js"
import { getSupabaseConfig } from "./supabase-config"

const config = getSupabaseConfig(
  import.meta.env?.VITE_SUPABASE_URL,
  import.meta.env?.VITE_SUPABASE_ANON_KEY,
)

export const AUTH_UNAVAILABLE_MESSAGE = import.meta.env?.DEV
  ? "Sign-in is unavailable in this preview."
  : "Sign-in is temporarily unavailable."

/**
 * Browser-side Supabase client (singleton). Default config: persists
 * sessions in localStorage and auto-restores them on page load. The same
 * instance is imported wherever auth is needed — login flows, the chat
 * transport (for the Bearer header), and components reading auth state.
 */
export const supabase = config ? createClient(config.url, config.anonKey) : null
