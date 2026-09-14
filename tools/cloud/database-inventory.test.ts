import { describe, expect, test } from 'bun:test'
import { rootCertificates } from 'node:tls'
import { argumentsFor, certificateAuthority, connectionOptions, extractDatabaseUrl, failureSummary, initializeClient, installedDriver, inventory, INVENTORY_QUERIES, PROJECT_REF, resolveDriver } from './database-inventory'

const secret = 'synthetic-secret-only'
const direct = `postgresql://postgres:${secret}@db.${PROJECT_REF}.supabase.co:5432/postgres?sslmode=require`

describe('explicit credential/target boundary without connections', () => {
  test('extracts one named assignment without evaluating unrelated exports', () => {
    expect(extractDatabaseUrl(`OTHER_SECRET=do-not-load\nDATABASE_URL="${direct}"\nAFTER=ignored`)).toBe(direct)
    expect(extractDatabaseUrl(`{\n  "DATABASE_URL": "${direct}",\n  "OTHER": "ignored"\n}`)).toBe(direct)
    expect(extractDatabaseUrl(`export DATABASE_URL='${direct}'`)).toBe(direct)
  })
  test('missing, duplicated and malformed assignments fail without leaking values', () => {
    for (const value of ['OTHER=value', `DATABASE_URL=${direct}\nDATABASE_URL=${direct}`, 'DATABASE_URL="unterminated', 'DATABASE_URL=', 'DATABASE_URL="a\\nb"']) {
      try { extractDatabaseUrl(value); throw new Error('should reject') }
      catch (error) { expect(String(error)).toBe('Error: invalid_export'); expect(String(error)).not.toContain(secret) }
    }
  })
  test('pins direct and pooler routing to the exact project and verifies TLS', () => {
    const options = connectionOptions(direct)
    expect(options).toMatchObject({ host: `db.${PROJECT_REF}.supabase.co`, database: 'postgres', ssl: { rejectUnauthorized: true }, max: 1, prepare: false, connection: { default_transaction_read_only: 'on', statement_timeout: 5000, lock_timeout: 1000 } })
    expect(connectionOptions(`postgres://postgres.${PROJECT_REF}:${secret}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`).port).toBe(6543)
    for (const url of [direct.replace(PROJECT_REF, 'foreign'), direct.replace('supabase.co', 'supabase.co.attacker.example'), direct.replace('sslmode=require', 'sslmode=disable'), direct + '&options=unsafe', direct.replace('/postgres?', '/other?'), direct.replace('postgres:', 'reader:'), `postgres://postgres.foreign:${secret}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`]) {
      try { connectionOptions(url); throw new Error('should reject') }
      catch (error) { expect(String(error)).toBe('Error: target_mismatch'); expect(String(error)).not.toContain(secret) }
    }
  })
  test('default mode is nonconnecting check and inventory requires a unique output argument', () => {
    expect(argumentsFor(['--export', 'fixture.txt'])).toMatchObject({ mode: 'check' })
    expect(argumentsFor(['--mode', 'inventory', '--export', 'fixture.txt', '--out', 'inventory.json']).mode).toBe('inventory')
    for (const args of [[], ['--mode', 'inventory', '--export', 'fixture.txt'], ['--export', 'fixture.txt', '--query', 'SELECT secret'], ['--export', 'one', '--export', 'two'], ['--mode', 'other', '--export', 'fixture']]) expect(() => argumentsFor(args)).toThrow('invalid_arguments')
  })
  test('installed Bun namespace export is normalized without creating a connection', () => {
    expect(typeof installedDriver()).toBe('function')
    const factory = () => { throw new Error(secret) }
    expect(resolveDriver(factory)).toBe(factory)
    expect(resolveDriver({ default: factory })).toBe(factory)
    expect(() => resolveDriver({ default: {} })).toThrow('driver_unavailable')
    expect(() => initializeClient(factory, connectionOptions(direct))).toThrow('driver_initialization_failed')
  })
  test('explicit public CA is bounded, parsed, hashed and never disables TLS validation', () => {
    const authority = certificateAuthority(Buffer.from(rootCertificates[0]!))
    expect(authority.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(connectionOptions(direct, authority).ssl).toEqual({ rejectUnauthorized: true, ca: authority.pem })
    expect(argumentsFor(['--export', 'fixture', '--ca-file', 'public-ca.crt']).caFile).toBe('public-ca.crt')
    for (const bytes of [Buffer.alloc(0), Buffer.alloc(131_073), Buffer.from('not a certificate'), Buffer.from(rootCertificates[0]! + '\nPRIVATE-KEY-DATA')]) expect(() => certificateAuthority(bytes)).toThrow('invalid_ca_file')
  })
})

describe('catalog-only transaction with injected transport', () => {
  function client(failAt?: string, session: { read_only?: unknown; tls?: unknown } | null = { read_only: 'on', tls: true }, failure: unknown = new Error('private connection detail ' + secret)) {
    const calls: string[] = []
    return { calls, value: {
      reserve: async () => {
        calls.push('reserve')
        return {
          unsafe: async (query: string) => {
            calls.push(query)
            if (failAt && query.includes(failAt)) throw failure
            return query === INVENTORY_QUERIES.session && session ? [session] : []
          },
          release: async () => { calls.push('release') },
        }
      },
      end: async () => { calls.push('end') },
    } }
  }
  test('begins read only, uses fixed metadata queries, rolls back and closes', async () => {
    const c = client()
    expect(await inventory(c.value)).toMatchObject({ project_ref: PROJECT_REF, customer_rows_requested: 0 })
    expect(c.calls.slice(0, 4)).toEqual(['reserve', 'BEGIN READ ONLY', "SET LOCAL statement_timeout = '5s'", "SET LOCAL lock_timeout = '1s'"])
    expect(c.calls.slice(4, -3)).toEqual(Object.values(INVENTORY_QUERIES))
    expect(c.calls.slice(-3)).toEqual(['ROLLBACK', 'release', 'end'])
    for (const query of Object.values(INVENTORY_QUERIES)) {
      expect(query).toStartWith('SELECT ')
      expect(query).not.toMatch(/\bFROM\s+(?:auth|public|frontdesk|storage)\./i)
      expect(query).not.toMatch(/pg_get_expr|pg_get_functiondef|column_default|SELECT\s+\*/i)
    }
  })
  test('driver failure still rolls back and returns only a fixed sanitized error', async () => {
    const c = client('information_schema.columns')
    await expect(inventory(c.value)).rejects.toThrow('inventory_failed')
    expect(c.calls.slice(-3)).toEqual(['ROLLBACK', 'release', 'end'])
    expect(c.calls).not.toContain(INVENTORY_QUERIES.policies)
  })
  test('unverified TLS or writable transaction is never reported as a completed inventory', async () => {
    for (const session of [{ read_only: 'off', tls: true }, { read_only: 'on', tls: false }]) {
      const c = client(undefined, session)
      await expect(inventory(c.value)).rejects.toThrow('inventory_failed')
      expect(c.calls.slice(-3)).toEqual(['ROLLBACK', 'release', 'end'])
    }
  })
  test('connection, TLS and authentication failures are distinguished without raw details', async () => {
    for (const [code, expected] of [['ENOTFOUND', 'inventory_connection_failed'], ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'inventory_tls_failed'], ['28P01', 'inventory_authentication_failed']]) {
      let ended = false
      const c = { reserve: async () => { throw Object.assign(new Error(secret), { code }) }, end: async () => { ended = true } }
      await expect(inventory(c)).rejects.toThrow(expected)
      expect(ended).toBe(true)
    }
  })
  test('query and transaction failures identify their fixed stage without exposing driver properties', async () => {
    for (const [failAt, stage, code, sqlstate] of [
      ['information_schema.columns', 'columns', '42501', '42501'],
      ['BEGIN READ ONLY', 'begin', '0A000', '0A000'],
      ['pg_catalog.pg_policies', 'policies', secret, null],
    ] as const) {
      const raw = Object.assign(new Error(secret), { code, detail: direct, query: secret, parameters: [secret], address: direct })
      const c = client(failAt, undefined, raw)
      let captured: unknown
      try { await inventory(c.value) } catch (error) { captured = error }
      const summary = failureSummary(captured)
      expect(summary).toEqual({ error: 'inventory_failed', diagnostic: { stage, reason: 'driver_error', sqlstate } })
      expect(JSON.stringify(summary)).not.toContain(secret)
      expect(JSON.stringify(summary)).not.toContain(direct)
      expect(c.calls.slice(-3)).toEqual(['ROLLBACK', 'release', 'end'])
    }
    expect(failureSummary(Object.assign(new Error(secret), { code: '42501' }))).toEqual({ error: 'invalid_export' })
  })
  test('session guard reports normalized backend observations while preserving every rejection', async () => {
    const cases = [
      { session: null, reason: 'session_missing', checks: { read_only: 'unknown', backend_tls: null } },
      { session: { read_only: 'off', tls: true }, reason: 'transaction_not_read_only', checks: { read_only: 'off', backend_tls: true } },
      { session: { read_only: 'on', tls: false }, reason: 'backend_tls_not_observed', checks: { read_only: 'on', backend_tls: false } },
      { session: { read_only: secret, tls: direct }, reason: 'transaction_not_read_only', checks: { read_only: 'unknown', backend_tls: null } },
    ] as const
    for (const { session, reason, checks } of cases) {
      const c = client(undefined, session)
      let captured: unknown
      try { await inventory(c.value) } catch (error) { captured = error }
      const summary = failureSummary(captured)
      expect(summary).toEqual({ error: 'inventory_failed', diagnostic: { stage: 'validate_session', reason, sqlstate: null, session_checks: checks } })
      expect(JSON.stringify(summary)).not.toContain(secret)
      expect(JSON.stringify(summary)).not.toContain(direct)
      expect(c.calls.slice(-3)).toEqual(['ROLLBACK', 'release', 'end'])
    }
  })
})
