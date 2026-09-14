import { describe, expect, test } from 'bun:test'
import { APPLY_SQL, changeExposure, ExposureError, ORIGINAL_SCHEMAS, parseSchemaProbe, publicSchemaProbe, RESEARCH_SCHEMAS, ROLLBACK_SQL, SETTINGS_QUERY, TABLES_QUERY, type SchemaProbe } from './data-api-exposure'
import { INVENTORY_QUERIES, PROJECT_REF } from './database-inventory'

const settings = [{ role_scope: 'authenticator', database_scope: 'postgres', db_schemas: RESEARCH_SCHEMAS.join(', ') }]
const tables = ['research_active_builds', 'research_ingestion_runs', 'research_memberships', 'research_objects', 'research_passages', 'research_releases', 'research_scopes', 'research_sources'].map(relname => ({ relname, relrowsecurity: true }))
const observation = (schemas: readonly string[], observed_at = new Date().toISOString()): SchemaProbe => ({ code: 'PGRST106', http_status: 406, schemas: [...schemas], observed_at })
const probes = (before = observation(ORIGINAL_SCHEMAS), after = observation(RESEARCH_SCHEMAS)) => {
  let calls = 0
  return { get calls() { return calls }, value: async () => ++calls === 1 ? before : after }
}
function database(options: { baseline?: unknown[]; recheck?: unknown[]; after?: unknown[]; session?: Record<string, unknown>; tables?: typeof tables; failAt?: string } = {}) {
  const calls: string[] = []
  let settingReads = 0
  return { calls, value: {
    reserve: async () => {
      calls.push('reserve')
      return {
        unsafe: async (query: string): Promise<unknown[]> => {
          calls.push(query)
          if (query === options.failAt) throw new Error('synthetic-private-driver-detail')
          if (query === INVENTORY_QUERIES.session) return [options.session ?? { database: 'postgres', database_role: 'postgres', read_only: 'on', tls: true }]
          if (query === TABLES_QUERY) return options.tables ?? tables
          if (query === SETTINGS_QUERY) return [options.baseline ?? [], options.recheck ?? options.baseline ?? [], options.after ?? settings][settingReads++]!
          return []
        },
        release: async () => { calls.push('release') },
      }
    },
    end: async () => { calls.push('end') },
  } }
}

describe('bounded public schema metadata', () => {
  test('accepts the observed hint and documented older message without returning provider prose', () => {
    const now = new Date().toISOString()
    const result = parseSchemaProbe(406, { code: 'PGRST106', message: 'Invalid schema: probe', hint: 'Only the following schemas are exposed: public, graphql_public', details: 'ignored provider prose' }, now)
    expect(result).toEqual(observation(ORIGINAL_SCHEMAS, now))
    expect(parseSchemaProbe(406, { code: 'PGRST106', message: 'The schema must be one of the following: public, graphql_public' }).schemas).toEqual([...ORIGINAL_SCHEMAS])
    expect(JSON.stringify(result)).not.toContain('provider prose')
  })
  test('does not infer schemas from bare status, wrong code, conflicting fields or ambiguous names', () => {
    for (const body of [null, {}, { code: 'other', hint: 'Only the following schemas are exposed: public' }, { code: 'PGRST106', message: 'Invalid schema' }, { code: 'PGRST106', message: 'The schema must be one of the following: public', hint: 'Only the following schemas are exposed: frontdesk' }, { code: 'PGRST106', hint: 'Only the following schemas are exposed: public, public' }, { code: 'PGRST106', hint: 'Only the following schemas are exposed: public, "quoted,name"' }]) expect(() => parseSchemaProbe(406, body)).toThrow('probe_failed')
    expect(() => parseSchemaProbe(200, { code: 'PGRST106', hint: 'Only the following schemas are exposed: public' })).toThrow('probe_failed')
  })
  test('transport pins endpoint, zero rows, public key class and no redirects; response is bounded', async () => {
    const originalFetch = globalThis.fetch
    const key = 'sb_publishable_synthetic_0123456789'
    let calls = 0
    try {
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        calls++
        expect(String(url)).toBe(`https://${PROJECT_REF}.supabase.co/rest/v1/research_scopes?select=scope_id&limit=0`)
        expect(init?.redirect).toBe('error')
        expect(init?.headers).toEqual({ apikey: key, 'Accept-Profile': 'neuvetra_probe_unexposed' })
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(JSON.stringify({ code: 'PGRST106', hint: 'Only the following schemas are exposed: public, graphql_public' }), { status: 406 })
      }) as typeof fetch
      expect((await publicSchemaProbe(key)()).schemas).toEqual([...ORIGINAL_SCHEMAS])
      expect(calls).toBe(1)
      for (const invalid of ['service_role_synthetic_secret', 'eyJsyntheticJWT', '', key + '\n']) expect(() => publicSchemaProbe(invalid)).toThrow('invalid_input')
      globalThis.fetch = Object.assign(async () => new Response('x'.repeat(16_385), { status: 406 }), { preconnect: originalFetch.preconnect })
      await expect(publicSchemaProbe(key)()).rejects.toThrow('probe_failed')
      globalThis.fetch = Object.assign(async () => { throw new Error(key) }, { preconnect: originalFetch.preconnect })
      try { await publicSchemaProbe(key)(); throw new Error('should reject') }
      catch (error) { expect(String(error)).toBe('Error: probe_failed'); expect(String(error)).not.toContain(key) }
    } finally { globalThis.fetch = originalFetch }
  })
})

describe('one fixed configuration change with reversible preconditions', () => {
  test('captures absence, applies only the append, verifies setting and API, closes after commit', async () => {
    const db = database(), api = probes()
    const result = await changeExposure(db.value, api.value, 'apply')
    expect(result).toMatchObject({ committed: true, api_verified: true, before_settings: [], after_settings: settings, customer_rows_requested: 0, table_or_grant_writes: 0, connection_mode: 'direct' })
    expect(db.calls.filter(q => q.startsWith('ALTER'))).toEqual([APPLY_SQL])
    expect(db.calls.slice(0, 5)).toEqual(['reserve', 'BEGIN READ ONLY', INVENTORY_QUERIES.session, SETTINGS_QUERY, TABLES_QUERY])
    expect(db.calls.slice(-5)).toEqual(["NOTIFY pgrst, 'reload config'", "NOTIFY pgrst, 'reload schema'", 'COMMIT', 'release', 'end'])
    expect(db.calls.filter(q => q === SETTINGS_QUERY)).toHaveLength(3)
    expect(api.calls).toBe(2)
    expect(APPLY_SQL).toBe("ALTER ROLE authenticator IN DATABASE postgres SET pgrst.db_schemas = 'public, graphql_public, neuvetra_research_dev'")
  })
  test('rollback requires our exact override and restores prior absence without resetting other settings', async () => {
    const db = database({ baseline: settings, after: [] }), api = probes(observation(RESEARCH_SCHEMAS), observation(ORIGINAL_SCHEMAS))
    const result = await changeExposure(db.value, api.value, 'rollback')
    expect(result).toMatchObject({ committed: true, api_verified: true, before_settings: settings, after_settings: [] })
    expect(db.calls.filter(q => q.startsWith('ALTER'))).toEqual([ROLLBACK_SQL])
    expect(ROLLBACK_SQL).toBe('ALTER ROLE authenticator IN DATABASE postgres RESET pgrst.db_schemas')
    expect(db.calls).not.toContain(TABLES_QUERY)
  })
  test('stale, reordered, missing or newly added exposure prevents even opening a DB connection', async () => {
    for (const before of [observation(['graphql_public', 'public']), observation(['public']), observation([...ORIGINAL_SCHEMAS, 'frontdesk']), observation(ORIGINAL_SCHEMAS, '2000-01-01T00:00:00Z'), observation(ORIGINAL_SCHEMAS, 'invalid-date')]) {
      const db = database(), api = probes(before)
      await expect(changeExposure(db.value, api.value, 'apply')).rejects.toThrow('schema_drift')
      expect(db.calls).toEqual(['end'])
      expect(api.calls).toBe(1)
    }
  })
  test('catalog drift at either preflight or write transaction stops before any ALTER', async () => {
    const drift = [{ role_scope: 'all_roles', database_scope: 'postgres', db_schemas: 'public, graphql_public' }]
    for (const config of [{ baseline: drift }, { recheck: drift }]) {
      const db = database(config)
      await expect(changeExposure(db.value, probes().value, 'apply')).rejects.toThrow('settings_drift')
      expect(db.calls).not.toContain(APPLY_SQL)
      expect(db.calls.slice(-3)).toEqual(['ROLLBACK', 'release', 'end'])
    }
    const db = database()
    await expect(changeExposure(db.value, probes().value, 'rollback')).rejects.toThrow('settings_drift')
    expect(db.calls).not.toContain(ROLLBACK_SQL)
  })
  test('direct TLS, exact operator/database and read-only preflight are required', async () => {
    for (const changes of [{ tls: false }, { read_only: 'off' }, { database: 'other' }, { database_role: 'authenticator' }]) {
      const db = database({ session: { database: 'postgres', database_role: 'postgres', read_only: 'on', tls: true, ...changes } })
      await expect(changeExposure(db.value, probes().value, 'apply')).rejects.toThrow('session_guard')
      expect(db.calls).not.toContain('BEGIN READ WRITE')
      expect(db.calls.slice(-3)).toEqual(['ROLLBACK', 'release', 'end'])
    }
  })
  test('missing, unexpected or unprotected research tables stop before exposure', async () => {
    for (const records of [tables.slice(1), [...tables, { relname: 'unreviewed_table', relrowsecurity: true }], tables.map((t, i) => ({ ...t, relrowsecurity: i !== 0 }))]) {
      const db = database({ tables: records })
      await expect(changeExposure(db.value, probes().value, 'apply')).rejects.toThrow('research_schema_guard')
      expect(db.calls).not.toContain(APPLY_SQL)
    }
  })
  test('catalog mismatch after ALTER rolls back without committing or requesting reload', async () => {
    const db = database({ after: [] })
    await expect(changeExposure(db.value, probes().value, 'apply')).rejects.toThrow('settings_drift')
    expect(db.calls.filter(q => q.startsWith('ALTER'))).toEqual([APPLY_SQL])
    expect(db.calls).not.toContain('COMMIT')
    expect(db.calls.some(q => q.startsWith('NOTIFY'))).toBe(false)
    expect(db.calls.slice(-3)).toEqual(['ROLLBACK', 'release', 'end'])
  })
  test('commit uncertainty is explicit and does not retry or issue an inverse ALTER', async () => {
    const db = database({ failAt: 'COMMIT' }), api = probes()
    let caught: unknown
    try { await changeExposure(db.value, api.value, 'apply') } catch (error) { caught = error }
    expect(caught).toBeInstanceOf(ExposureError)
    expect(caught).toMatchObject({ code: 'commit_outcome_unknown', commit_attempted: true })
    expect(String(caught)).not.toContain('private-driver')
    expect(db.calls.filter(q => q.startsWith('ALTER'))).toEqual([APPLY_SQL])
    expect(api.calls).toBe(1)
  })
  test('asynchronous API reload remains pending after confirmed commit and never triggers another write', async () => {
    const db = database(), api = probes(observation(ORIGINAL_SCHEMAS), observation(ORIGINAL_SCHEMAS))
    const result = await changeExposure(db.value, api.value, 'apply')
    expect(result).toMatchObject({ committed: true, api_verified: false, after_api: null, after_settings: settings })
    expect(db.calls.filter(q => q.startsWith('ALTER'))).toEqual([APPLY_SQL])
    expect(db.calls.slice(-3)).toEqual(['COMMIT', 'release', 'end'])
    expect(api.calls).toBe(2)
  })
  test('query failure exposes only the fixed category and preserves cleanup', async () => {
    const db = database({ failAt: APPLY_SQL })
    try { await changeExposure(db.value, probes().value, 'apply'); throw new Error('should reject') }
    catch (error) { expect(String(error)).toBe('Error: database_failed'); expect(String(error)).not.toContain('private-driver') }
    expect(db.calls.slice(-3)).toEqual(['ROLLBACK', 'release', 'end'])
    expect(db.calls).not.toContain('COMMIT')
  })
})
