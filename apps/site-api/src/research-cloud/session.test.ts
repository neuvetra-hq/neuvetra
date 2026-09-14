import { describe, expect, test } from 'bun:test'
import { PROJECT_HOST, RESEARCH_SCOPE } from './repository'
import { createReaderSession, SESSION_RUN_MARKER, type ReaderSessionConfig, type ReaderSessionSnapshot } from './session'

const NOW = Date.parse('2026-09-09T06:00:00Z'), USER = '90000000-0000-4000-8000-000000000001'
const metadata = { scope_id: RESEARCH_SCOPE, run_marker: SESSION_RUN_MARKER, kind: 'private_research_reader' }
const token = (overrides: Record<string, unknown> = {}) => `header.${Buffer.from(JSON.stringify({ sub: USER, role: 'authenticated', aud: 'authenticated', iss: `https://${PROJECT_HOST}/auth/v1`, exp: NOW / 1000 + 3600, app_metadata: metadata, ...overrides })).toString('base64url')}.synthetic-signature`
const reply = () => ({ access_token: token(), refresh_token: 'synthetic-refresh-1', token_type: 'bearer', user: { id: USER, role: 'authenticated', app_metadata: { ...metadata } } })
function fixture() {
  let clock = NOW
  const calls: { url: string; init: RequestInit }[] = []
  let responder = async () => Response.json(reply())
  const config: ReaderSessionConfig = { supabaseHost: PROJECT_HOST, publishableKey: 'sb_publishable_synthetic_0123456789', email: 'synthetic@neuvetra.invalid', password: 'synthetic-private-password', expectedUserId: USER,
    expectedAppMetadata: { ...metadata }, now: () => clock, fetch: async (url, init) => { calls.push({ url, init }); return responder() } }
  return { config, calls, time: (value: number) => { clock = value }, response: (value: () => Promise<Response>) => { responder = value } }
}

describe('private ordinary-reader session lifecycle without live calls', () => {
  test('lazy sign-in shares one concurrent exchange, then caches only the validated session', async () => {
    const f = fixture(), persisted: Readonly<ReaderSessionSnapshot>[] = []
    let release: (() => void) | undefined
    const hold = new Promise<void>(resolve => { release = resolve })
    f.response(async () => { await hold; return Response.json(reply()) })
    const session = createReaderSession({ ...f.config, onSession: snapshot => { persisted.push(snapshot) } })
    expect(f.calls).toHaveLength(0)
    const first = session.getJwt(), second = session.getJwt()
    expect(first).toBe(second)
    expect(f.calls).toHaveLength(1)
    release!()
    expect(await first).toBe(token()); expect(await second).toBe(token())
    expect(await session.getJwt()).toBe(token())
    expect(f.calls).toHaveLength(1)
    expect(persisted).toHaveLength(1)
    expect(Object.isFrozen(persisted[0])).toBe(true)
    expect(f.calls[0].url).toBe(`https://${PROJECT_HOST}/auth/v1/token?grant_type=password`)
    expect(JSON.parse(String(f.calls[0].init.body))).toEqual({ email: f.config.email, password: f.config.password })
    expect(f.calls[0].init.redirect).toBe('error')
    expect(f.calls[0].init.signal).toBeInstanceOf(AbortSignal)
    expect(f.calls[0].init.headers).toEqual({ apikey: f.config.publishableKey, 'Content-Type': 'application/json' })
  })
  test('near-expiry requests share one refresh and rotate without resending a password', async () => {
    const f = fixture(), session = createReaderSession(f.config)
    await session.getJwt()
    f.time(NOW + 3_550_000)
    const next = token({ exp: NOW / 1000 + 7200 })
    f.response(async () => Response.json({ ...reply(), access_token: next, refresh_token: 'synthetic-refresh-2' }))
    const result = await Promise.all([session.getJwt(), session.getJwt(), session.getJwt()])
    expect(result).toEqual([next, next, next])
    expect(f.calls).toHaveLength(2)
    expect(f.calls[1].url).toBe(`https://${PROJECT_HOST}/auth/v1/token?grant_type=refresh_token`)
    expect(JSON.parse(String(f.calls[1].init.body))).toEqual({ refresh_token: 'synthetic-refresh-1' })
    expect(String(f.calls[1].init.body)).not.toContain('password')
  })
  test('configuration refuses other hosts, secret API keys, scope or run markers without requests', () => {
    const f = fixture()
    for (const change of [{ supabaseHost: 'attacker.example' }, { publishableKey: 'sb_secret_synthetic' }, { expectedAppMetadata: { ...metadata, scope_id: 'other' } }, { expectedAppMetadata: { ...metadata, run_marker: 'other' } }, { expectedAppMetadata: { ...metadata, kind: 'admin' } }]) expect(() => createReaderSession({ ...f.config, ...change })).toThrow('reader_session_configuration_invalid')
    expect(f.calls).toHaveLength(0)
  })
  test('wrong user, role and server metadata are not rescued by user-editable metadata', async () => {
    const changes = [(raw: ReturnType<typeof reply>) => { raw.user.id = 'other' }, (raw: ReturnType<typeof reply>) => { raw.user.role = 'service_role' }, (raw: ReturnType<typeof reply>) => { raw.user.app_metadata.scope_id = 'other' }, (raw: ReturnType<typeof reply>) => { raw.user.app_metadata.run_marker = 'other' }]
    for (const change of changes) {
      const f = fixture(), raw = reply(); change(raw)
      f.response(async () => Response.json({ ...raw, user: { ...raw.user, user_metadata: metadata } }))
      const session = createReaderSession(f.config)
      await expect(session.getJwt()).rejects.toThrow('reader_session_invalid')
      await expect(session.getJwt()).rejects.toThrow('reader_session_invalid')
      expect(f.calls).toHaveLength(1)
    }
  })
  test('deny-only token validation rejects mismatched claims, near expiry and malformed token', async () => {
    for (const access_token of [token({ sub: 'other' }), token({ role: 'service_role' }), token({ iss: 'https://attacker.example/auth/v1' }), token({ aud: 'service_role' }), token({ exp: NOW / 1000 + 59 }), token({ app_metadata: { ...metadata, kind: 'other' } }), 'not-a-jwt']) {
      const f = fixture(); f.response(async () => Response.json({ ...reply(), access_token }))
      await expect(createReaderSession(f.config).getJwt()).rejects.toThrow('reader_session_invalid')
      expect(f.calls).toHaveLength(1)
    }
  })
  test('failed refresh latches failure without returning old token, repeating transport or password fallback', async () => {
    const f = fixture(), session = createReaderSession(f.config)
    await session.getJwt(); f.time(NOW + 3_550_000)
    f.response(async () => new Response('synthetic-private-provider-detail', { status: 401 }))
    await expect(session.getJwt()).rejects.toThrow('reader_session_unavailable')
    await expect(session.getJwt()).rejects.toThrow('reader_session_unavailable')
    expect(f.calls).toHaveLength(2)
    expect(f.calls.filter(call => call.url.endsWith('grant_type=password'))).toHaveLength(1)
  })
  test('failed persistence does not adopt a session or repeat a potentially completed exchange', async () => {
    const f = fixture(), session = createReaderSession({ ...f.config, onSession: async () => { throw new Error('synthetic-private-persistence-detail') } })
    await expect(session.getJwt()).rejects.toThrow('reader_session_persistence_failed')
    await expect(session.getJwt()).rejects.toThrow('reader_session_persistence_failed')
    expect(f.calls).toHaveLength(1)
  })
  test('oversized, redirected and raw-error responses remain sanitized and terminal', async () => {
    for (const response of [async () => new Response('x'.repeat(64_001)), async () => new Response(null, { status: 302 }), async () => { throw new Error('synthetic-private-password-url') }]) {
      const f = fixture(); f.response(response)
      const session = createReaderSession(f.config)
      try { await session.getJwt(); throw new Error('should reject') }
      catch (error) { expect(String(error)).toMatch(/^Error: reader_session_(invalid|unavailable)$/); expect(String(error)).not.toContain('password-url') }
      await expect(session.getJwt()).rejects.toThrow()
      expect(f.calls).toHaveLength(1)
    }
  })
})
