/**
 * Typed access to environment variables.
 * Crashes loudly at startup if anything required is missing — better than
 * silently 500ing on the first chat turn in production.
 */

function required(name: string): string {
  const value = Bun.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function optionalNumber(name: string, fallback: number): number {
  const raw = Bun.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Env var ${name} must be a positive number; got ${raw}`)
  }
  return parsed
}

export const env = {
  ANTHROPIC_API_KEY: required("ANTHROPIC_API_KEY"),
  LANGFUSE_HOST: required("LANGFUSE_HOST"),
  LANGFUSE_PUBLIC_KEY: required("LANGFUSE_PUBLIC_KEY"),
  LANGFUSE_SECRET_KEY: required("LANGFUSE_SECRET_KEY"),
  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_ANON_KEY: required("SUPABASE_ANON_KEY"),
  /** Max requests per window per IP for `/chat`. Defaults to 10. */
  CHAT_RATE_LIMIT_MAX: optionalNumber("CHAT_RATE_LIMIT_MAX", 10),
  /** Rate-limit window for `/chat` in milliseconds. Defaults to 60_000 (1 min). */
  CHAT_RATE_LIMIT_WINDOW_MS: optionalNumber("CHAT_RATE_LIMIT_WINDOW_MS", 60_000),
} as const
