import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { rootCertificates } from 'node:tls'
import { applyDevelopment, argumentsFor, CA_SHA256, COLUMNS, CONTRACT_SHA256, directWriteOptions, failureSummary, MIGRATION_SHA256, preflight, SCHEMA, sha256, validateStage, type Inputs, type Client } from './apply-development'
import { certificateAuthority, PROJECT_REF } from './database-inventory'

// Public CA only. No export, credential, network or driver is read by these tests.
const ca = readFileSync(new URL('./fixtures/supabase-prod-ca-2021.crt', import.meta.url))
const migration = readFileSync(new URL('../../infra/cloud/001-neuvetra-research-dev.sql', import.meta.url))
const now = Date.parse('2026-09-09T05:00:00Z')
function stageFixture() {
  const tables: Record<string, any[]> = Object.fromEntries(Object.keys(COLUMNS).map(k => [k, []]))
  for (const suffix of ['a', 'b']) {
    const sid = `90000000-0000-4000-8000-00000000000${suffix}`, build = `10000000-0000-4000-8000-00000000000${suffix}`
    const hashes = { source: sha256('source-' + suffix), extraction: sha256('extraction-' + suffix), release: sha256('release-' + suffix) }
    tables.research_scopes!.push({ scope_id: sid, label: 'synthetic-' + suffix, is_synthetic: true })
    for (const [kind, hash] of Object.entries(hashes)) tables.research_objects!.push({ scope_id: sid, object_sha256: hash, kind, byte_size: 100, bucket: 'neuvetra-research-dev', object_key: `${sid}/sha256/${hash}/${kind === 'source' ? 'source.txt' : kind + '.json'}` })
    tables.research_sources!.push({ scope_id: sid, source_sha256: hashes.source, source_id: 'synthetic-' + suffix, title: 'Owned mock source', canonical_url: `https://${PROJECT_REF}.supabase.co/storage/v1/object/authenticated/neuvetra-research-dev/${sid}/sha256/${hashes.source}/source.txt`, version: 'synthetic-v1', review_status: 'pending' })
    tables.research_releases!.push({ scope_id: sid, release_sha256: hashes.release, build_id: build, profile_sha256: sha256('mock-profile'), namespace: 'mock-' + suffix, version: 'synthetic-v1', status: 'candidate', review_expires_at: '2026-09-15T23:20:32Z', commercial_runtime_approval: false })
    const ids = suffix === 'a' ? ['A01', 'A02', 'A03', 'A04'] : ['B01', 'B02']
    for (const id of ids) {
      const text = 'Owned mock paragraph ' + id
      tables.research_passages!.push({ scope_id: sid, release_sha256: hashes.release, build_id: build, passage_id: id, vector_id: sid + '-' + id, source_sha256: hashes.source, extraction_sha256: hashes.extraction, text, text_sha256: sha256(text), locator: 'Mock page 1', spans: [{ page: 1, start: 0, end: text.length, page_sha256: sha256(text) }], dependency_ids: id === 'A01' ? ['A02'] : [], qualifications: [], review_status: 'pending', is_active: id !== 'A04' })
    }
    tables.research_ingestion_runs!.push({ scope_id: sid, build_id: build, release_sha256: hashes.release, manifest_sha256: sha256('mock-manifest-' + suffix), expected_passage_ids: ids.filter(id => id !== 'A04'), state: 'staged' })
  }
  return tables
}
function inputs(mode: 'migrate' | 'stage' = 'migrate'): Inputs {
  const report = { project_ref: PROJECT_REF, operation: 'catalog_inventory', customer_rows_requested: 0, ca_sha256: CA_SHA256, connection_mode: 'direct', metadata: { session: [{ database: 'postgres', database_role: 'postgres', read_only: 'on', tls: true }], schemas: mode === 'migrate' ? [] : [{ schema: SCHEMA }], tables: [], columns: Object.entries(COLUMNS).flatMap(([table, columns]) => columns.map(column => ({ schema: SCHEMA, table, column }))), constraints: [], policies: [], grants: [] } }
  const inventory = Buffer.from(JSON.stringify(report)), stage = Buffer.from(JSON.stringify(stageFixture()))
  return { mode, inventory, inventoryPin: sha256(inventory), migration, migrationPin: MIGRATION_SHA256, ca, now, ...(mode === 'stage' ? { stage, stagePin: sha256(stage), contractPin: CONTRACT_SHA256 } : {}) }
}
function mock(mode: 'migrate' | 'stage', options: { failInsert?: number; failureCode?: unknown; existing?: boolean; tls?: boolean; conflict?: boolean; migrationFailure?: boolean } = {}) {
  const calls: { query: string; values?: unknown[] }[] = []
  let inserts = 0, reserves = 0, ended = false, released = false
  const client: Client = { reserve: async () => { reserves++; return { unsafe: async (query, values) => {
    calls.push({ query, values })
    if (query.startsWith('SELECT current_database()')) return [{ database: 'postgres', database_role: 'postgres', read_only: 'on', tls: options.tls ?? true }]
    if (query.startsWith('SELECT nspname')) return (mode === 'stage' || options.existing) ? [{ schema: SCHEMA }] : []
    if (query.startsWith('SET neuvetra') && options.migrationFailure) throw new Error('secret raw migration error')
    if (query.startsWith('INSERT') && ++inserts === options.failInsert) throw Object.assign(new Error('secret raw database detail'), { code: options.failureCode, detail: 'secret parameter content', query, parameters: values })
    if (query.startsWith('SELECT count')) return [{ matching: options.conflict ? 0 : 1 }]
    return []
  }, release: async () => { released = true } } }, end: async () => { ended = true } }
  return { client, calls, state: () => ({ reserves, ended, released }) }
}

describe('public-file checks precede any connection factory', () => {
  test('mismatched bytes/pins, failed inventory, wrong CA and foreign project refuse with zero calls', async () => {
    const variants: Inputs[] = []
    for (const mutate of [
      (x: Inputs) => { x.migration = Buffer.concat([x.migration, Buffer.from('\n')]) },
      (x: Inputs) => { x.migrationPin = 'a'.repeat(64) },
      (x: Inputs) => { x.ca = Buffer.from(rootCertificates[0]!) },
      (x: Inputs) => { x.inventoryPin = 'a'.repeat(64) },
    ]) { const x = inputs(); mutate(x); variants.push(x) }
    for (const mutate of [
      (r: any) => { r.metadata.session[0].tls = false },
      (r: any) => { r.metadata.session[0].read_only = 'off' },
      (r: any) => { r.error = 'inventory_failed' },
      (r: any) => { r.project_ref = 'foreign' },
      (r: any) => { r.connection_mode = 'pooler' },
      (r: any) => { r.metadata.schemas.push({ schema: SCHEMA }) },
    ]) { const x = inputs(), r = JSON.parse(x.inventory.toString()); mutate(r); x.inventory = Buffer.from(JSON.stringify(r)); x.inventoryPin = sha256(x.inventory); variants.push(x) }
    for (const x of variants) { let factories = 0; await expect(applyDevelopment(x, () => { factories++; return mock('migrate').client })).rejects.toThrow(); expect(factories).toBe(0) }
  })
  test('stage rejects arbitrary tables/columns, approval/state changes, wrong scope, object path and text hash before I/O', async () => {
    for (const mutate of [
      (s: any) => { s.research_memberships = [] },
      (s: any) => { s.research_passages[0].approved_at = 'now' },
      (s: any) => { s.research_passages[0].review_status = 'approved' },
      (s: any) => { s.research_releases[0].status = 'approved' },
      (s: any) => { s.research_ingestion_runs[0].state = 'active' },
      (s: any) => { s.research_scopes[0].scope_id = 'foreign' },
      (s: any) => { s.research_objects[0].object_key = s.research_objects[0].object_key.replace('source.txt', 'release.json') },
      (s: any) => { s.research_passages[0].text = 'changed without hash' },
      (s: any) => { s.research_passages[0].dependency_ids = ['B01'] },
    ]) {
      const x = inputs('stage'), s = JSON.parse(x.stage!.toString()); mutate(s); x.stage = Buffer.from(JSON.stringify(s)); x.stagePin = sha256(x.stage)
      let factories = 0; await expect(applyDevelopment(x, () => { factories++; return mock('stage').client })).rejects.toThrow(); expect(factories).toBe(0)
    }
    const x = inputs('stage'); expect(() => validateStage(x.stage!, x.stagePin!, 'a'.repeat(64), now)).toThrow('contract_pin_mismatch')
    expect(() => validateStage(x.stage!, x.stagePin!, CONTRACT_SHA256, Date.parse('2027-01-01'))).toThrow()
  })
  test('direct retarget validates original project and preserves only same-project credentials with verified CA', () => {
    const authority = certificateAuthority(ca)
    const options = directWriteOptions(`postgres://postgres.${PROJECT_REF}:mock%40password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`, authority)
    expect(options).toMatchObject({ host: `db.${PROJECT_REF}.supabase.co`, port: 5432, username: 'postgres', password: 'mock@password', ssl: { ca: authority.pem, rejectUnauthorized: true }, connection: { default_transaction_read_only: 'off' } })
    expect(() => directWriteOptions('postgres://postgres.foreign:mock@aws-0-us-east-1.pooler.supabase.com:6543/postgres', authority)).toThrow('target_mismatch')
  })
  test('check mode cannot read an export or accept arbitrary SQL and live mode must be explicit', () => {
    const common = ['--operation', 'migrate', '--inventory', 'public-report', '--inventory-sha', 'pin', '--migration-sha', 'pin', '--ca-file', 'public-ca']
    expect(argumentsFor(common).mode).toBe('check')
    for (const extra of [['--export', 'secret-file'], ['--sql', 'DROP SCHEMA'], ['--mode', 'execute'], ['--mode', 'execute', '--export', 'explicit-file']]) expect(() => argumentsFor([...common, ...extra])).toThrow('invalid_arguments')
  })
})

describe('atomic fixed operations using injected transport only', () => {
  test('migration sends unchanged complete transaction once and never writes product rows', async () => {
    const m = mock('migrate'); const result = await applyDevelopment(inputs(), () => m.client)
    expect(result.committed).toBe(true)
    expect(m.calls.filter(c => c.query.startsWith('SET neuvetra')).map(c => c.query)).toEqual([`SET neuvetra.target_project_ref = '${PROJECT_REF}';\n` + migration.toString()])
    expect(m.calls.some(c => c.query.startsWith('INSERT'))).toBe(false)
    expect(m.state()).toEqual({ reserves: 1, ended: true, released: true })
  })
  test('existing schema or lost backend TLS prevents migration', async () => {
    for (const options of [{ existing: true }, { tls: false }]) { const m = mock('migrate', options); await expect(applyDevelopment(inputs(), () => m.client)).rejects.toThrow(); expect(m.calls.some(c => c.query.startsWith('SET neuvetra'))).toBe(false); expect(m.calls.at(-1)!.query).toBe('ROLLBACK') }
  })
  test('migration failure is sanitized, rolls back and is never retried', async () => {
    const m = mock('migrate', { migrationFailure: true }); await expect(applyDevelopment(inputs(), () => m.client)).rejects.toThrow('database_operation_failed')
    expect(m.calls.filter(c => c.query.startsWith('SET neuvetra'))).toHaveLength(1); expect(m.calls.at(-1)!.query).toBe('ROLLBACK')
  })
  test('stage has one write transaction, finite parameterized rows, conflict verification and no approval writes', async () => {
    const x = inputs('stage'), s = JSON.parse(x.stage!.toString()); s.research_sources[0].title = "Synthetic'); DROP TABLE public.users; --"
    x.stage = Buffer.from(JSON.stringify(s)); x.stagePin = sha256(x.stage)
    const m = mock('stage'); const result = await applyDevelopment(x, () => m.client)
    expect(result.stage_rows).toBe(20); expect(m.calls.filter(c => c.query === 'BEGIN')).toHaveLength(1); expect(m.calls.filter(c => c.query === 'COMMIT')).toHaveLength(1)
    const inserts = m.calls.filter(c => c.query.startsWith('INSERT')); expect(inserts).toHaveLength(20)
    expect(inserts.every(c => c.query.startsWith('INSERT INTO neuvetra_research_dev.') && !!c.values)).toBe(true)
    expect(m.calls.some(c => c.query.includes('DROP TABLE public.users'))).toBe(false)
    expect(inserts.some(c => c.values?.includes(s.research_sources[0].title))).toBe(true)
    expect(inserts.some(c => /research_memberships|research_active_builds|UPDATE|activate_research_build/.test(c.query))).toBe(false)
  })
  test('partial staging failure and conflicting existing approval roll back without commit', async () => {
    for (const options of [{ failInsert: 2 }, { conflict: true }]) { const m = mock('stage', options); await expect(applyDevelopment(inputs('stage'), () => m.client)).rejects.toThrow(); expect(m.calls.some(c => c.query === 'COMMIT')).toBe(false); expect(m.calls.at(-1)!.query).toBe('ROLLBACK'); expect(m.state().ended).toBe(true) }
  })
  test('identical staging rerun uses the same insert identities and never updates conflicts', async () => {
    const x = inputs('stage'), first = mock('stage'), second = mock('stage')
    await applyDevelopment(x, () => first.client); await applyDevelopment(x, () => second.client)
    expect(first.calls).toEqual(second.calls)
    expect(second.calls.filter(c => c.query.startsWith('INSERT')).every(c => c.query.endsWith('ON CONFLICT DO NOTHING'))).toBe(true)
  })
  test('all valid fixture pins can be checked without the driver', () => { expect(preflight(inputs()).stage).toBeUndefined(); expect(preflight(inputs('stage')).stage!.research_passages).toHaveLength(6) })
  test('PostgreSQL hash-derived UUIDs retain canonical syntax without an RFC variant restriction', () => {
    const x = inputs('stage'), s = JSON.parse(x.stage!.toString())
    for (const rows of Object.values(s) as any[][]) for (const row of rows) if (row.build_id && row.scope_id.endsWith('00b')) row.build_id = 'b39e5c40-098a-4001-4e0c-99c7a180332a'
    x.stage = Buffer.from(JSON.stringify(s)); x.stagePin = sha256(x.stage)
    expect(preflight(x).stage!.research_releases[1]!.build_id).toBe('b39e5c40-098a-4001-4e0c-99c7a180332a')
  })
  test('diagnostics reveal only fixed position and explicitly allowlisted SQLSTATE', async () => {
    for (const code of ['23514', '42883', 'private-driver-value', undefined]) {
      const m = mock('stage', { failInsert: 2, failureCode: code })
      let captured: unknown
      try { await applyDevelopment(inputs('stage'), () => m.client) } catch (error) { captured = error }
      const summary = failureSummary(captured)
      expect(summary).toEqual({ error: 'database_operation_failed', diagnostic: { stage: 'stage_insert', table: 'research_scopes', row_index_0based: 1, sqlstate: ['23514', '42883'].includes(code ?? '') ? code! : null } })
      const rendered = JSON.stringify(summary)
      for (const sensitive of ['secret', 'private-driver-value', 'INSERT INTO', 'parameters']) expect(rendered).not.toContain(sensitive)
      expect(m.calls.at(-1)!.query).toBe('ROLLBACK')
      expect(m.calls.some(c => c.query === 'COMMIT')).toBe(false)
    }
  })
  test('preflight remains diagnostic-free and live gate reports only a fixed stage', async () => {
    const m = mock('migrate', { tls: false })
    let captured: unknown
    try { await applyDevelopment(inputs(), () => m.client) } catch (error) { captured = error }
    expect(failureSummary(captured)).toEqual({ error: 'live_session_refused', diagnostic: { stage: 'session', table: null, row_index_0based: null, sqlstate: null } })
    const x = inputs(); x.migrationPin = '0'.repeat(64)
    try { preflight(x) } catch (error) { expect(failureSummary(error)).toEqual({ error: 'migration_pin_mismatch' }) }
  })
  test('installed Postgres.js serializer roundtrip preserves JSON arrays, including empty and escaped values', async () => {
    // Import the installed driver's pure serializer, never initialize a client.
    const driverRoot = new URL('../../packages/frontdesk-database/node_modules/postgres/', import.meta.url)
    expect(JSON.parse(readFileSync(new URL('package.json', driverRoot), 'utf8')).version).toBe('3.4.9')
    const { serializers } = await import(new URL('src/types.js', driverRoot).href)
    const x = inputs('stage'), source = JSON.parse(x.stage!.toString())
    source.research_passages[0].qualifications = ['Quoted "value"; slash \\; Unicode café', 'line one\nline two']
    x.stage = Buffer.from(JSON.stringify(source)); x.stagePin = sha256(x.stage)
    const m = mock('stage'); await applyDevelopment(x, () => m.client)
    for (const table of ['research_passages', 'research_ingestion_runs'] as const) {
      const statements = m.calls.filter(c => c.query.startsWith(`INSERT INTO ${SCHEMA}.${table} `))
      for (const [index, statement] of statements.entries()) for (const column of ['spans', 'dependency_ids', 'qualifications', 'expected_passage_ids']) {
        const position = (COLUMNS[table] as readonly string[]).indexOf(column)
        if (position < 0) continue
        expect(statement.query).toContain(`$${position + 1}::text::jsonb`)
        const parameter = statement.values![position]
        // Prior ::jsonb inference chooses OID3802, double-encoding this string.
        expect(typeof JSON.parse(serializers[3802](parameter))).toBe('string')
        // Explicit ::text inference chooses OID25; JSONB parses the exact array.
        const decoded = JSON.parse(serializers[25](parameter))
        expect(Array.isArray(decoded)).toBe(true)
        expect(decoded).toEqual(source[table][index][column])
      }
    }
  })
})
