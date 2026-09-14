/** Lazy private-preview sign-in only. No account creation, ENV, disk or import I/O. */
import { PROJECT_HOST, RESEARCH_SCOPE } from './repository'
import { record } from '../research-passages/release'

export const SESSION_RUN_MARKER = 'neuvetra-website-epa-20260909'
export type SessionErrorCode = 'reader_session_configuration_invalid' | 'reader_session_unavailable' | 'reader_session_invalid' | 'reader_session_persistence_failed'
export class ReaderSessionError extends Error { constructor(public readonly code: SessionErrorCode) { super(code) } }
export interface ReaderSessionSnapshot {
  accessToken: string; refreshToken: string; expiresAt: number; userId: string
}
export interface ReaderSessionConfig {
  supabaseHost: string; publishableKey: string; email: string; password: string; expectedUserId: string
  expectedAppMetadata: { scope_id: string; run_marker: string; kind: string }
  /** Optional encrypted-state writer owned by the private bootstrap. Never log. */
  onSession?: (session: Readonly<ReaderSessionSnapshot>) => void | Promise<void>
  fetch?: (url: string, init: RequestInit) => Promise<Response>
  now?: () => number
}
const fail = (code: SessionErrorCode): never => { throw new ReaderSessionError(code) }
const isToken = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 16_000 && !/[\r\n]/.test(value)

export function createReaderSession(config: ReaderSessionConfig): { getJwt(): Promise<string> } {
  const { email, password, publishableKey, expectedUserId, onSession } = config
  const expected = Object.freeze({ ...config.expectedAppMetadata })
  if (config.supabaseHost !== PROJECT_HOST || !/^sb_publishable_[A-Za-z0-9_-]{16,300}$/.test(publishableKey)
    || typeof email !== 'string' || !email.includes('@') || email.length > 320 || /[\r\n]/.test(email)
    || typeof password !== 'string' || !password.length || password.length > 1024
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(expectedUserId)
    || expected.scope_id !== RESEARCH_SCOPE || expected.run_marker !== SESSION_RUN_MARKER || expected.kind !== 'private_research_reader') return fail('reader_session_configuration_invalid')
  const fetcher = config.fetch ?? fetch, now = config.now ?? Date.now
  const metadataMatches = (value: unknown) => record(value) && Object.entries(expected).every(([key, item]) => value[key] === item)
  let current: ReaderSessionSnapshot | null = null
  let pending: Promise<string> | null = null
  let failed: SessionErrorCode | null = null

  async function exchange(): Promise<string> {
    // A failed rotation is terminal for this instance. The coordinator must
    // investigate and explicitly recreate it; no hidden password fallback.
    const refreshing = current !== null
    const payload = refreshing ? { refresh_token: current!.refreshToken } : { email, password }
    try {
      const response = await fetcher(`https://${PROJECT_HOST}/auth/v1/token?grant_type=${refreshing ? 'refresh_token' : 'password'}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
        headers: { apikey: publishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!response.ok || !response.body) { await response.body?.cancel(); return fail('reader_session_unavailable') }
      const declared = response.headers.get('content-length')
      if (declared && (!/^\d+$/.test(declared) || Number(declared) > 64_000)) { await response.body.cancel(); return fail('reader_session_invalid') }
      const reader = response.body.getReader(), chunks: Uint8Array[] = []
      let size = 0
      try {
        while (true) {
          const part = await reader.read()
          if (part.done) break
          size += part.value.length
          if (size > 64_000) return fail('reader_session_invalid')
          chunks.push(part.value)
        }
      } finally { await reader.cancel().catch(() => {}) }
      let raw: unknown
      try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) } catch { return fail('reader_session_invalid') }
      if (!record(raw) || !isToken(raw.access_token) || !isToken(raw.refresh_token) || raw.token_type !== 'bearer'
        || !record(raw.user) || raw.user.id !== expectedUserId || raw.user.role !== 'authenticated' || !metadataMatches(raw.user.app_metadata)) return fail('reader_session_invalid')
      let claims: unknown
      try {
        if (raw.access_token.split('.').length !== 3) return fail('reader_session_invalid')
        claims = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(raw.access_token.split('.')[1]!, 'base64url')))
      } catch { return fail('reader_session_invalid') }
      // Deny-only inspection of the response from the fixed verified-TLS Auth
      // endpoint. Repository /user performs a fresh authentication before use.
      if (!record(claims) || claims.sub !== expectedUserId || claims.role !== 'authenticated' || claims.aud !== 'authenticated'
        || claims.iss !== `https://${PROJECT_HOST}/auth/v1` || !metadataMatches(claims.app_metadata) || typeof claims.exp !== 'number' || !Number.isSafeInteger(claims.exp)
        || claims.exp * 1000 <= now() + 60_000) return fail('reader_session_invalid')
      const snapshot: ReaderSessionSnapshot = { accessToken: raw.access_token, refreshToken: raw.refresh_token, expiresAt: claims.exp * 1000, userId: expectedUserId }
      if (onSession) {
        try { await onSession(Object.freeze({ ...snapshot })) } catch { return fail('reader_session_persistence_failed') }
      }
      if (snapshot.expiresAt <= now() + 60_000) return fail('reader_session_invalid')
      current = snapshot
      return snapshot.accessToken
    } catch (error) {
      failed = error instanceof ReaderSessionError ? error.code : 'reader_session_unavailable'
      throw new ReaderSessionError(failed)
    }
  }
  return {
    getJwt() {
      if (failed) return Promise.reject(new ReaderSessionError(failed))
      if (pending) return pending
      if (current && current.expiresAt > now() + 60_000) return Promise.resolve(current.accessToken)
      pending = exchange().finally(() => { pending = null })
      return pending
    },
  }
}
