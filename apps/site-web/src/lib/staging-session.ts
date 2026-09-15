export const STAGING_PROFILE = "neuvetra.private-synthetic-staging.v1"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export interface StagingAccess { user: { id: string }; access: { role: "owner" | "admin" | "member"; workspaceId: string | null; evidenceId: string | null }; profile: typeof STAGING_PROFILE }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) }

export function decodeStagingConfig(value: unknown): { supabaseUrl: string; anonKey: string; projectRef: string } {
  if (!record(value) || value.profile !== STAGING_PROFILE || typeof value.supabaseUrl !== "string" || typeof value.anonKey !== "string") throw new Error("Private staging is unavailable.")
  const url = new URL(value.supabaseUrl)
  const match = /^([a-z]{20})\.supabase\.co$/.exec(url.hostname)
  if (url.protocol !== "https:" || !match || url.username || url.password || url.port || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new Error("Private staging is unavailable.")
  // Publishable keys are public by design. Legacy keys must explicitly be anon.
  const key = value.anonKey
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) {
    try {
      const parts = key.split(".")
      const claims: unknown = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))
      if (parts.length !== 3 || !record(claims) || claims.role !== "anon" || claims.ref !== match[1]) throw new Error()
    } catch { throw new Error("Private staging is unavailable.") }
  }
  return { supabaseUrl: url.origin, anonKey: key, projectRef: match[1] }
}

export function decodeStagingAccess(value: unknown, expectedUserId: string): StagingAccess {
  if (!record(value) || value.profile !== STAGING_PROFILE || !record(value.user) || value.user.id !== expectedUserId || !UUID.test(expectedUserId) || !record(value.access)) throw new Error("Your staging access could not be verified.")
  const access = value.access
  if (!["owner", "admin", "member"].includes(String(access.role)) || !(access.workspaceId === null || typeof access.workspaceId === "string" && UUID.test(access.workspaceId)) || !(access.evidenceId === null || typeof access.evidenceId === "string" && UUID.test(access.evidenceId)) || access.workspaceId === null && access.evidenceId !== null) throw new Error("Your staging access could not be verified.")
  return value as unknown as StagingAccess
}
