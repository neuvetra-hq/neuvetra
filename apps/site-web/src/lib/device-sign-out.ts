/**
 * WO-13 (QA B1 of PR #56, then N1, F9 and F10 of its round-2 review; Claude, 12 November 2026): signing out on a shared
 * device. Everything on this device goes first, at once and without the network (`removeStoredSignIn`); then the server
 * is told (`revokeSession`) for at most SIGN_OUT_TIMEOUT_MS.
 *
 * The server is told through Supabase Auth's REST endpoints directly, with the anon key, never through the Supabase
 * client. The client's `signOut` takes the client's lock: a stalled logout would hold it and every later sign-in on the
 * page would wait behind it. It also reads the session from storage, which is already gone. Nothing here writes to storage.
 *
 * - The access token is revoked with `POST /auth/v1/logout?scope=local`, the call the client itself makes; this revokes
 *   only this session.
 * - F9: an answer saying the session is already gone (`session_not_found`, or 404) counts as told.
 * - F10: an expired access token (or one the server refuses with 401/403) can't revoke the session, but its refresh
 *   token still could be used. So, as the client's own `signOut` did before this change, the session is refreshed first
 *   (`POST /auth/v1/token?grant_type=refresh_token`), and the new access token is used to log out. The refreshed session
 *   is never stored. A refresh token the server already refuses (`invalid_grant`, `refresh_token_*`, `session_*`) means
 *   there is nothing left to revoke: told.
 */
export const SIGN_OUT_TIMEOUT_MS = 5_000

/** What the stored sign-in held, read just before it was removed. `removed` is false only when the storage refused. */
export interface StoredSignIn { removed: boolean; accessToken: string | null; refreshToken: string | null; expiresAt: number | null }
type SignInStorage = Pick<Storage, "getItem" | "removeItem" | "key" | "length">

/** Removes this origin's stored Supabase session (`<key>`, `<key>-code-verifier`, `<key>-user`) synchronously. */
export function removeStoredSignIn(storage: SignInStorage | null, key: string | null): StoredSignIn {
  const none: StoredSignIn = { removed: true, accessToken: null, refreshToken: null, expiresAt: null }
  if (!key) return none
  if (!storage) return { ...none, removed: false }
  try {
    const found = { ...none }
    try {
      const value: unknown = JSON.parse(storage.getItem(key) ?? "null")
      if (value && typeof value === "object") {
        const { access_token: access, refresh_token: refresh, expires_at: expires } = value as Record<string, unknown>
        found.accessToken = typeof access === "string" && access ? access : null
        found.refreshToken = typeof refresh === "string" && refresh ? refresh : null
        found.expiresAt = typeof expires === "number" && Number.isFinite(expires) ? expires : null
      }
    } catch { /* unreadable: nothing to tell the server */ }
    const keys: string[] = []
    for (let index = 0; index < storage.length; index++) { const stored = storage.key(index); if (stored !== null) keys.push(stored) }
    for (const stored of keys) if (stored === key || stored.startsWith(`${key}-`)) storage.removeItem(stored)
    return { ...found, removed: storage.getItem(key) === null }
  } catch { return { ...none, removed: false } }
}

/** Where Supabase Auth answers, and how this browser reaches it. */
export interface AuthEndpoint { url: string; anonKey: string; fetch: (input: string, init: RequestInit) => Promise<Response> }
/** WO-13 (QA N2 of PR #56): what a tab says when another tab of this browser signed out. */
export const SIGNED_OUT_ELSEWHERE = "Signed out in another tab of this browser."

type LogoutAnswer = "told" | "refused" | "failed"
async function logout(endpoint: AuthEndpoint, token: string, signal: AbortSignal): Promise<LogoutAnswer> {
  const response = await endpoint.fetch(`${endpoint.url.replace(/\/+$/, "")}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: endpoint.anonKey, authorization: `Bearer ${token}` }, signal })
  if (response.ok || response.status === 404) return "told"
  const code = await errorCode(response)
  // F9: GoTrue's answer for a session that is already revoked or expired away.
  if (code === "session_not_found") return "told"
  return response.status === 401 || response.status === 403 ? "refused" : "failed"
}
type RefreshAnswer = { access: string } | "gone" | "failed"
async function refresh(endpoint: AuthEndpoint, refreshToken: string, signal: AbortSignal): Promise<RefreshAnswer> {
  const response = await endpoint.fetch(`${endpoint.url.replace(/\/+$/, "")}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: endpoint.anonKey, authorization: `Bearer ${endpoint.anonKey}`, "content-type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }), signal })
  if (response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const access = body && typeof body === "object" ? (body as { access_token?: unknown }).access_token : null
    return typeof access === "string" && access ? { access } : "failed"
  }
  const code = await errorCode(response)
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    if (code === "invalid_grant" || /^(refresh_token_|session_)/.test(code ?? "")) return "gone"
  }
  return "failed"
}
async function errorCode(response: Response): Promise<string | null> {
  const body: unknown = await response.json().catch(() => null)
  if (!body || typeof body !== "object") return null
  const { error_code: code, error } = body as { error_code?: unknown; error?: unknown }
  return typeof code === "string" ? code : typeof error === "string" ? error : null
}

/**
 * Tells the server that the session read from storage has ended, for at most `timeoutMs`. True when it was told (or there
 * was nothing to tell, or the session was already gone); false on no answer, a failure or the time limit.
 */
export async function revokeSession(endpoint: AuthEndpoint | null, stored: Pick<StoredSignIn, "accessToken" | "refreshToken" | "expiresAt">, options: { now?: number; timeoutMs?: number } = {}): Promise<boolean> {
  const { accessToken, refreshToken, expiresAt } = stored
  if (!accessToken && !refreshToken) return true
  if (!endpoint) return false
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<false>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(false) }, options.timeoutMs ?? SIGN_OUT_TIMEOUT_MS) })
  const expired = expiresAt !== null && expiresAt * 1000 <= (options.now ?? Date.now())
  const attempt = (async (): Promise<boolean> => {
    if (accessToken && !expired) {
      const answer = await logout(endpoint, accessToken, controller.signal)
      if (answer === "told") return true
      if (answer === "failed") return false
      // Refused (an expired or revoked access token): without a refresh token there is nothing left that could be used.
      if (!refreshToken) return true
    }
    if (!refreshToken) return true
    const fresh = await refresh(endpoint, refreshToken, controller.signal)
    if (fresh === "gone") return true
    if (fresh === "failed") return false
    return await logout(endpoint, fresh.access, controller.signal) === "told"
  })().catch(() => false)
  try { return await Promise.race([attempt, timeout]) } finally { clearTimeout(timer) }
}
