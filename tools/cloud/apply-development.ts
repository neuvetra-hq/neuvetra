/** Explicit, pinned development operations. Importing this module performs no I/O. */
import { readFile, writeFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PROJECT_REF, certificateAuthority, connectionOptions, extractDatabaseUrl, installedDriver, initializeClient, INVENTORY_QUERIES } from './database-inventory'

export const MIGRATION_SHA256 = 'f4a620013b9d61503137c7551030975bc9fcd0737714a3eabc5d4f30d23e2a84'
export const CA_SHA256 = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'
export const SCHEMA = 'neuvetra_research_dev'
const MIGRATION_URL = new URL('../../infra/cloud/001-neuvetra-research-dev.sql', import.meta.url)
const SCOPES = ['90000000-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-00000000000b']
const HEX = /^[0-9a-f]{64}$/
// PostgreSQL UUIDs and the frozen hash-derived build IDs need not be RFC v4.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
type Row = Record<string, unknown>
type Mode = 'migrate' | 'stage'
type ApplyStage = 'reserve' | 'readonly_begin' | 'session' | 'schemas' | 'readonly_end' | 'migration' | 'stage_begin' | 'stage_timeout' | 'stage_lock_timeout' | 'stage_insert' | 'stage_compare' | 'stage_commit'
type Diagnostic = { stage: ApplyStage; table: Table | null; row_index_0based: number | null; sqlstate: string | null }
export class ApplyError extends Error { constructor(public readonly code: string, public readonly diagnostic?: Diagnostic) { super(code) } }
// Explicit protocol codes only. Never expose messages, detail, query, parameters,
// arbitrary driver codes, addresses or identifiers from an exception.
const SAFE_SQLSTATES = new Set(['08000', '08001', '08003', '08004', '08006', '08007', '08P01', '0A000', '22001', '22003', '22007', '22008', '22023', '22P02', '23502', '23503', '23505', '23514', '25001', '25006', '25P02', '28000', '28P01', '40001', '40P01', '42501', '42601', '42703', '42704', '42804', '42883', '42P01', '42P05', '42P18', '53000', '53100', '53200', '53300', '53400', '54000', '54001', '55000', '55P03', '57014', '57P01', '57P02', '57P03', '58000', '58030', 'XX000', 'XX001', 'XX002'])
function operationFailure(error: unknown, position: Omit<Diagnostic, 'sqlstate'>) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  return new ApplyError(error instanceof ApplyError ? error.code : 'database_operation_failed', {
    ...position, sqlstate: typeof code === 'string' && SAFE_SQLSTATES.has(code) ? code : null,
  })
}
export function failureSummary(error: unknown) {
  return error instanceof ApplyError ? { error: error.code, ...(error.diagnostic ? { diagnostic: error.diagnostic } : {}) }
    : { error: 'preflight_or_output_failed' }
}
function need(value: unknown, code = 'invalid_stage'): asserts value { if (!value) throw new ApplyError(code) }
export function sha256(bytes: Buffer | string) { return createHash('sha256').update(bytes).digest('hex') }
function object(value: unknown): Row { need(value && typeof value === 'object' && !Array.isArray(value)); return value as Row }
function exactKeys(row: Row, keys: readonly string[]) { need(Object.keys(row).sort().join('\0') === [...keys].sort().join('\0')) }
function text(value: unknown, max = 16000): value is string { return typeof value === 'string' && value.length > 0 && [...value].length <= max && !value.includes('\0') }
function hash(value: unknown) { return typeof value === 'string' && HEX.test(value) }
function strings(value: unknown, max = 32) { return Array.isArray(value) && value.length <= max && value.every(x => text(x, 1000)) }
function parsed(bytes: Buffer, pin: string, code: string) {
  need(HEX.test(pin) && bytes.length > 0 && bytes.length <= 2_000_000 && sha256(bytes) === pin, code)
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw new ApplyError(code) }
}

/** Frozen finite column contract; identifiers never come from caller input. */
export const COLUMNS = {
  research_scopes: ['scope_id', 'label', 'is_synthetic'],
  research_objects: ['scope_id', 'object_sha256', 'kind', 'byte_size', 'bucket', 'object_key'],
  research_sources: ['scope_id', 'source_sha256', 'source_id', 'title', 'canonical_url', 'version', 'review_status'],
  research_releases: ['scope_id', 'release_sha256', 'build_id', 'profile_sha256', 'namespace', 'version', 'status', 'review_expires_at', 'commercial_runtime_approval'],
  research_passages: ['scope_id', 'release_sha256', 'build_id', 'passage_id', 'vector_id', 'source_sha256', 'extraction_sha256', 'text', 'text_sha256', 'locator', 'spans', 'dependency_ids', 'qualifications', 'review_status', 'is_active'],
  research_ingestion_runs: ['scope_id', 'build_id', 'release_sha256', 'manifest_sha256', 'expected_passage_ids', 'state'],
} as const
export const CONTRACT_SHA256 = sha256(JSON.stringify(COLUMNS))
type Table = keyof typeof COLUMNS
type Stage = Record<Table, Row[]>

/** This checks the externally reviewed projection, not original object bytes. */
export function validateStage(bytes: Buffer, pin: string, contractPin: string, now: number): Stage {
  need(contractPin === CONTRACT_SHA256, 'contract_pin_mismatch')
  const stage = object(parsed(bytes, pin, 'stage_pin_mismatch'))
  exactKeys(stage, Object.keys(COLUMNS))
  const counts = [2, 6, 2, 2, 6, 2]
  for (const [index, name] of (Object.keys(COLUMNS) as Table[]).entries()) {
    need(Array.isArray(stage[name]) && (stage[name] as unknown[]).length === counts[index])
    for (const value of stage[name] as unknown[]) {
      const row = object(value); exactKeys(row, COLUMNS[name]); need(SCOPES.includes(String(row.scope_id)))
      for (const [key, v] of Object.entries(row)) {
        if (key.endsWith('_sha256')) need(hash(v))
        if (key === 'build_id') need(typeof v === 'string' && UUID.test(v))
      }
    }
  }
  const s = stage as Stage
  for (const sid of SCOPES) {
    const rows = (table: Table) => s[table].filter(r => r.scope_id === sid)
    const label = sid.endsWith('00a') ? 'synthetic-a' : 'synthetic-b'
    const scopes = rows('research_scopes'); need(scopes.length === 1 && scopes[0]!.label === label && scopes[0]!.is_synthetic === true)
    const objects = rows('research_objects'); need(objects.length === 3)
    for (const [kind, suffix] of Object.entries({ source: 'source.txt', extraction: 'extraction.json', release: 'release.json' })) {
      const match = objects.filter(r => r.kind === kind); need(match.length === 1)
      const r = match[0]!; need(Number.isSafeInteger(r.byte_size) && Number(r.byte_size) > 0 && Number(r.byte_size) <= 1_000_000)
      need(r.bucket === 'neuvetra-research-dev' && r.object_key === `${sid}/sha256/${r.object_sha256}/${suffix}`)
    }
    const byKind = (kind: string) => objects.find(r => r.kind === kind)!
    const sources = rows('research_sources'); need(sources.length === 1)
    const source = sources[0]!
    need(source.source_sha256 === byKind('source').object_sha256 && source.source_id === label && text(source.title, 500) && source.version === 'synthetic-v1' && source.review_status === 'pending')
    need(source.canonical_url === `https://${PROJECT_REF}.supabase.co/storage/v1/object/authenticated/neuvetra-research-dev/${byKind('source').object_key}`)
    const releases = rows('research_releases'); need(releases.length === 1)
    const release = releases[0]!
    need(release.release_sha256 === byKind('release').object_sha256 && release.version === 'synthetic-v1' && release.status === 'candidate' && release.commercial_runtime_approval === false)
    need(text(release.namespace, 300) && typeof release.review_expires_at === 'string' && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(release.review_expires_at) && Date.parse(release.review_expires_at) > now)
    const passages = rows('research_passages')
    const ids = sid.endsWith('00a') ? ['A01', 'A02', 'A03', 'A04'] : ['B01', 'B02']
    need(passages.map(r => r.passage_id).sort().join() === ids.join())
    for (const r of passages) {
      need(r.build_id === release.build_id && r.release_sha256 === release.release_sha256 && r.source_sha256 === source.source_sha256 && r.extraction_sha256 === byKind('extraction').object_sha256)
      need(text(r.vector_id, 512) && text(r.text) && sha256(r.text) === r.text_sha256 && text(r.locator, 1000))
      need(r.review_status === 'pending' && r.is_active === (r.passage_id !== 'A04'))
      need(strings(r.qualifications) && strings(r.dependency_ids) && (r.dependency_ids as string[]).join() === (r.passage_id === 'A01' ? 'A02' : ''))
      need(Array.isArray(r.spans) && r.spans.length > 0 && r.spans.length <= 8)
      for (const value of r.spans) {
        const span = object(value); exactKeys(span, ['page', 'start', 'end', 'page_sha256'])
        need(Number.isSafeInteger(span.page) && Number(span.page) > 0 && Number.isSafeInteger(span.start) && Number(span.start) >= 0 && Number.isSafeInteger(span.end) && Number(span.end) > Number(span.start) && hash(span.page_sha256))
      }
    }
    need(new Set(passages.map(r => r.vector_id)).size === passages.length)
    const runs = rows('research_ingestion_runs'); need(runs.length === 1)
    const run = runs[0]!
    need(run.build_id === release.build_id && run.release_sha256 === release.release_sha256 && run.state === 'staged')
    need(strings(run.expected_passage_ids) && (run.expected_passage_ids as string[]).join() === ids.filter(id => id !== 'A04').join())
  }
  need(new Set(s.research_releases.map(r => r.namespace)).size === 2)
  return s
}

export type Inputs = { mode: Mode; inventory: Buffer; inventoryPin: string; migration: Buffer; migrationPin: string; ca: Buffer; stage?: Buffer; stagePin?: string; contractPin?: string; now: number }
export function preflight(input: Inputs) {
  need(input.mode === 'migrate' || input.mode === 'stage', 'invalid_mode')
  need(Number.isFinite(input.now), 'invalid_time')
  need(input.migrationPin === MIGRATION_SHA256 && sha256(input.migration) === MIGRATION_SHA256, 'migration_pin_mismatch')
  need(sha256(input.ca) === CA_SHA256, 'ca_pin_mismatch')
  const authority = certificateAuthority(input.ca)
  const report = object(parsed(input.inventory, input.inventoryPin, 'inventory_pin_mismatch'))
  need(report.project_ref === PROJECT_REF && report.operation === 'catalog_inventory' && report.customer_rows_requested === 0 && report.ca_sha256 === CA_SHA256 && report.connection_mode === 'direct' && !('error' in report), 'inventory_not_successful')
  const metadata = object(report.metadata)
  for (const name of Object.keys(INVENTORY_QUERIES)) need(Array.isArray(metadata[name]), 'inventory_not_successful')
  const sessions = metadata.session as Row[]
  need(sessions.length === 1 && sessions[0]!.database === 'postgres' && sessions[0]!.database_role === 'postgres' && sessions[0]!.read_only === 'on' && sessions[0]!.tls === true, 'inventory_not_successful')
  const present = (metadata.schemas as Row[]).some(r => r.schema === SCHEMA)
  need(input.mode === 'migrate' ? !present : present, 'inventory_schema_mismatch')
  if (input.mode === 'stage') {
    for (const [table, columns] of Object.entries(COLUMNS)) for (const column of columns) need((metadata.columns as Row[]).some(r => r.schema === SCHEMA && r.table === table && r.column === column), 'inventory_schema_mismatch')
    need(input.stage && input.stagePin && input.contractPin, 'stage_required')
  } else need(!input.stage && !input.stagePin && !input.contractPin, 'unexpected_stage')
  const stage = input.mode === 'stage' ? validateStage(input.stage!, input.stagePin!, input.contractPin!, input.now) : undefined
  return { authority, stage, migration: input.migration.toString('utf8') }
}

/** Validate supplied target first, then retarget only its same-project direct endpoint. */
export function directWriteOptions(url: string, authority: ReturnType<typeof certificateAuthority>) {
  need(authority.sha256 === CA_SHA256, 'ca_pin_mismatch')
  connectionOptions(url, authority)
  const direct = new URL(url)
  direct.hostname = `db.${PROJECT_REF}.supabase.co`; direct.port = '5432'; direct.username = 'postgres'
  const options = connectionOptions(direct.toString(), authority)
  return { ...options, connection: { ...options.connection, application_name: 'neuvetra-reviewed-development-apply', default_transaction_read_only: 'off', statement_timeout: 30000, lock_timeout: 3000 } }
}
type Connection = { unsafe(query: string, values?: unknown[]): Promise<Row[]>; release(): Promise<void> }
export type Client = { reserve(): Promise<Connection>; end(options: { timeout: number }): Promise<void> }
const ARRAY_COLUMNS = new Set(['dependency_ids', 'qualifications', 'expected_passage_ids'])
function bindings(columns: readonly string[], row: Row) {
  // These values are already JSON strings. Force text parameter inference before
  // parsing as JSONB; otherwise Postgres.js's inferred JSONB serializer encodes
  // the string again and the database receives a scalar instead of an array.
  return columns.map((column, i) => ({ sql: column === 'spans' ? `$${i + 1}::text::jsonb` : ARRAY_COLUMNS.has(column) ? `ARRAY(SELECT jsonb_array_elements_text($${i + 1}::text::jsonb))` : column === 'review_expires_at' ? `$${i + 1}::timestamptz` : `$${i + 1}`, value: column === 'spans' || ARRAY_COLUMNS.has(column) ? JSON.stringify(row[column]) : row[column] }))
}

/** Factory invoked only after revalidation. No automatic retry or activation. */
export async function applyDevelopment(input: Inputs, factory: () => Client) {
  const prepared = preflight(input)
  const mode = input.mode
  let client: Client | undefined, connection: Connection | undefined, committed = false
  let position: Omit<Diagnostic, 'sqlstate'> = { stage: 'reserve', table: null, row_index_0based: null }
  try {
    client = factory(); connection = await client.reserve()
    position = { ...position, stage: 'readonly_begin' }
    await connection.unsafe('BEGIN READ ONLY')
    position = { ...position, stage: 'session' }
    const sessions = await connection.unsafe(INVENTORY_QUERIES.session)
    need(sessions.length === 1 && sessions[0]!.database === 'postgres' && sessions[0]!.database_role === 'postgres' && sessions[0]!.read_only === 'on' && sessions[0]!.tls === true, 'live_session_refused')
    position = { ...position, stage: 'schemas' }
    const schemas = await connection.unsafe(INVENTORY_QUERIES.schemas)
    need(mode === 'migrate' ? !schemas.some(r => r.schema === SCHEMA) : schemas.some(r => r.schema === SCHEMA), 'live_schema_refused')
    position = { ...position, stage: 'readonly_end' }
    await connection.unsafe('ROLLBACK')
    if (mode === 'migrate') {
      // Send the entire unchanged BEGIN...COMMIT migration in one simple query.
      // Fixed acknowledgement precedes it; no splitting, caller SQL or nested BEGIN.
      position = { ...position, stage: 'migration' }
      await connection.unsafe(`SET neuvetra.target_project_ref = '${PROJECT_REF}';\n` + prepared.migration)
    } else {
      position = { ...position, stage: 'stage_begin' }
      await connection.unsafe('BEGIN')
      position = { ...position, stage: 'stage_timeout' }
      await connection.unsafe("SET LOCAL statement_timeout = '30s'")
      position = { ...position, stage: 'stage_lock_timeout' }
      await connection.unsafe("SET LOCAL lock_timeout = '3s'")
      for (const table of Object.keys(COLUMNS) as Table[]) for (const [index, row] of prepared.stage![table].entries()) {
        const columns = COLUMNS[table], values = bindings(columns, row)
        position = { stage: 'stage_insert', table, row_index_0based: index }
        await connection.unsafe(`INSERT INTO ${SCHEMA}.${table} (${columns.join(', ')}) VALUES (${values.map(v => v.sql).join(', ')}) ON CONFLICT DO NOTHING`, values.map(v => v.value))
        // Rerun accepts only identical rows, including pending/staged flags.
        position = { ...position, stage: 'stage_compare' }
        const matches = await connection.unsafe(`SELECT count(*)::int AS matching FROM ${SCHEMA}.${table} WHERE ${columns.map((c, i) => `${c} IS NOT DISTINCT FROM ${values[i]!.sql}`).join(' AND ')}`, values.map(v => v.value))
        need(matches.length === 1 && matches[0]!.matching === 1, 'staging_conflict')
      }
      position = { stage: 'stage_commit', table: null, row_index_0based: null }
      await connection.unsafe('COMMIT')
    }
    committed = true
    return { project_ref: PROJECT_REF, operation: mode, committed: true, approvals_written: 0, activations: 0, auth_users_created: 0, stage_rows: prepared.stage ? 20 : 0 }
  } catch (error) { throw operationFailure(error, position) }
  finally {
    if (connection) {
      if (!committed) try { await connection.unsafe('ROLLBACK') } catch { /* transaction outcome may require coordinator inventory */ }
      try { await connection.release() } catch { /* end still runs */ }
    }
    if (client) try { await client.end({ timeout: 5 }) } catch { /* no raw driver output */ }
  }
}

async function boundedFile(path: string | URL, limit = 2_000_000) {
  const info = await stat(path); need(info.isFile() && info.size > 0 && info.size <= limit, 'invalid_file')
  return readFile(path)
}
export function argumentsFor(argv: string[]) {
  const allowed = ['--mode', '--operation', '--inventory', '--inventory-sha', '--migration-sha', '--ca-file', '--stage', '--stage-sha', '--contract-sha', '--export', '--out']
  need(argv.length % 2 === 0, 'invalid_arguments')
  const args = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 2) { need(allowed.includes(argv[i]!) && !args.has(argv[i]!) && argv[i + 1], 'invalid_arguments'); args.set(argv[i]!, argv[i + 1]!) }
  const mode = args.get('--mode') ?? 'check', operation = args.get('--operation')
  need(['check', 'execute'].includes(mode) && ['migrate', 'stage'].includes(operation ?? ''), 'invalid_arguments')
  for (const key of ['--inventory', '--inventory-sha', '--migration-sha', '--ca-file']) need(args.has(key), 'invalid_arguments')
  need(mode === 'execute' ? args.has('--export') && args.has('--out') : !args.has('--export') && !args.has('--out'), 'invalid_arguments')
  need(operation === 'stage' ? ['--stage', '--stage-sha', '--contract-sha'].every(k => args.has(k)) : ['--stage', '--stage-sha', '--contract-sha'].every(k => !args.has(k)), 'invalid_arguments')
  return { mode, operation: operation as Mode, args }
}

async function main() {
  let output: string | undefined, started: Row | undefined
  try {
    const { mode, operation, args } = argumentsFor(process.argv.slice(2))
    const input: Inputs = { mode: operation, inventory: await boundedFile(args.get('--inventory')!), inventoryPin: args.get('--inventory-sha')!, migration: await boundedFile(MIGRATION_URL), migrationPin: args.get('--migration-sha')!, ca: await boundedFile(args.get('--ca-file')!, 131072), now: Date.now(), ...(operation === 'stage' ? { stage: await boundedFile(args.get('--stage')!), stagePin: args.get('--stage-sha')!, contractPin: args.get('--contract-sha')! } : {}) }
    const prepared = preflight(input)
    if (mode === 'check') { console.log(JSON.stringify({ checked: true, operation, project_ref: PROJECT_REF, remote_connections: 0, credentials_read: false, contract_sha256: CONTRACT_SHA256 })); return }
    // All public-file gates precede export read, driver initialization and I/O.
    const options = directWriteOptions(extractDatabaseUrl((await boundedFile(args.get('--export')!, 1048576)).toString('utf8')), prepared.authority)
    const driver = installedDriver()
    started = { project_ref: PROJECT_REF, operation, status: 'started', started_at: new Date().toISOString(), inventory_sha256: input.inventoryPin, migration_sha256: MIGRATION_SHA256, ca_sha256: CA_SHA256, stage_sha256: input.stagePin ?? null, contract_sha256: operation === 'stage' ? CONTRACT_SHA256 : null, connection_mode: 'direct' }
    await writeFile(args.get('--out')!, JSON.stringify(started, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); output = args.get('--out')
    const result = await applyDevelopment(input, () => initializeClient(driver, options) as Client)
    await writeFile(output!, JSON.stringify({ ...started, ...result, status: 'completed', finished_at: new Date().toISOString() }, null, 2) + '\n', { mode: 0o600 })
    console.log(JSON.stringify(result))
  } catch (error) {
    const failure = failureSummary(error)
    if (output) try { await writeFile(output, JSON.stringify({ ...started, status: 'failed_or_outcome_unconfirmed', ...failure, automatic_retry: false, finished_at: new Date().toISOString() }, null, 2) + '\n', { mode: 0o600 }) } catch { /* retain started record; no retry */ }
    console.error(JSON.stringify({ ...failure, automatic_retry: false })); process.exitCode = 1
  }
}
if (import.meta.main) await main()
