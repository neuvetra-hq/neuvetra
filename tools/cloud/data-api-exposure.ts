/** Fixed, explicit schema exposure operation. No ENV/file/network work on import. */
import { createHash } from 'node:crypto'
import { certificateAuthority, connectionOptions, installedDriver, initializeClient, INVENTORY_QUERIES, PROJECT_REF, type InventoryClient } from './database-inventory'

export const ORIGINAL_SCHEMAS = ['public', 'graphql_public'] as const
export const RESEARCH_SCHEMAS = [...ORIGINAL_SCHEMAS, 'neuvetra_research_dev'] as const
export const OFFICIAL_CA_SHA256 = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'
export const SETTINGS_QUERY = `SELECT CASE WHEN s.setrole=0 THEN 'all_roles' ELSE r.rolname END AS role_scope, CASE WHEN s.setdatabase=0 THEN 'all_databases' ELSE d.datname END AS database_scope, substring(entry.setting FROM length('pgrst.db_schemas=')+1) AS db_schemas FROM pg_catalog.pg_db_role_setting s LEFT JOIN pg_catalog.pg_roles r ON r.oid=s.setrole LEFT JOIN pg_catalog.pg_database d ON d.oid=s.setdatabase CROSS JOIN LATERAL unnest(s.setconfig) AS entry(setting) WHERE (s.setrole=0 OR r.rolname='authenticator') AND (s.setdatabase=0 OR d.datname=current_database()) AND split_part(entry.setting,'=',1)='pgrst.db_schemas' ORDER BY role_scope,database_scope`
export const TABLES_QUERY = `SELECT c.relname, c.relrowsecurity FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='neuvetra_research_dev' AND c.relkind IN ('r','p') ORDER BY c.relname`
export const APPLY_SQL = "ALTER ROLE authenticator IN DATABASE postgres SET pgrst.db_schemas = 'public, graphql_public, neuvetra_research_dev'"
export const ROLLBACK_SQL = 'ALTER ROLE authenticator IN DATABASE postgres RESET pgrst.db_schemas'
const TABLES = ['research_active_builds', 'research_ingestion_runs', 'research_memberships', 'research_objects', 'research_passages', 'research_releases', 'research_scopes', 'research_sources']
type Mode = 'apply' | 'rollback'
export type SchemaProbe = { code: 'PGRST106'; http_status: 406; schemas: string[]; observed_at: string }
type Probe = () => Promise<SchemaProbe>
export class ExposureError extends Error {
  constructor(public readonly code: 'invalid_input' | 'ca_pin_mismatch' | 'probe_failed' | 'schema_drift' | 'settings_drift' | 'session_guard' | 'research_schema_guard' | 'database_failed' | 'commit_outcome_unknown', public readonly commit_attempted = false) { super(code) }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const expectedSettings = [{ role_scope: 'authenticator', database_scope: 'postgres', db_schemas: RESEARCH_SCHEMAS.join(', ') }]

/** Parse only a bounded metadata error, never return arbitrary provider prose. */
export function parseSchemaProbe(status: number, value: unknown, observed_at = new Date().toISOString()): SchemaProbe {
  if (status !== 406 || !value || typeof value !== 'object') throw new ExposureError('probe_failed')
  const body = value as Record<string, unknown>
  if (body.code !== 'PGRST106') throw new ExposureError('probe_failed')
  const lists = [body.message, body.hint].flatMap(field => {
    if (typeof field !== 'string' || field.length > 2048) return []
    const match = field.match(/^(?:Only the following schemas are exposed:|The schema must be one of the following:)\s*([a-z_][a-z0-9_]*(?:\s*,\s*[a-z_][a-z0-9_]*)*)\s*$/)
    return match ? [match[1]!.split(',').map(name => name.trim())] : []
  })
  if (lists.length !== 1 || lists[0]!.length > 32 || new Set(lists[0]).size !== lists[0]!.length) throw new ExposureError('probe_failed')
  return { code: 'PGRST106', http_status: 406, schemas: lists[0]!, observed_at }
}

export function publicSchemaProbe(publicKey: string): Probe {
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,300}$/.test(publicKey)) throw new ExposureError('invalid_input')
  return async () => {
    try {
      const response = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/research_scopes?select=scope_id&limit=0`, {
        headers: { apikey: publicKey, 'Accept-Profile': 'neuvetra_probe_unexposed' },
        redirect: 'error', signal: AbortSignal.timeout(10_000),
      })
      if (response.status !== 406 || !response.body) throw new ExposureError('probe_failed')
      const reader = response.body.getReader(), chunks: Uint8Array[] = []
      let size = 0
      try {
        while (true) {
          const part = await reader.read()
          if (part.done) break
          size += part.value.byteLength
          if (size > 16_384) throw new ExposureError('probe_failed')
          chunks.push(part.value)
        }
      } finally { await reader.cancel().catch(() => {}) }
      return parseSchemaProbe(response.status, JSON.parse(Buffer.concat(chunks).toString('utf8')))
    } catch { throw new ExposureError('probe_failed') }
  }
}

function checkProbe(probe: SchemaProbe, allowed: readonly (readonly string[])[]) {
  const age = Date.now() - Date.parse(probe.observed_at)
  if (probe.code !== 'PGRST106' || probe.http_status !== 406 || !Number.isFinite(age) || age < -5000 || age > 60_000 || !allowed.some(list => same(probe.schemas, list))) throw new ExposureError('schema_drift')
}
function checkSettings(rows: unknown[], applied: boolean) {
  if (!same(rows, applied ? expectedSettings : [])) throw new ExposureError('settings_drift')
}

/** Injected transport seam for offline tests. Production uses runExposure below. */
export async function changeExposure(client: InventoryClient, probe: Probe, mode: Mode) {
  if (mode !== 'apply' && mode !== 'rollback') throw new ExposureError('invalid_input')
  let connection: Awaited<ReturnType<InventoryClient['reserve']>> | undefined
  let commitAttempted = false, committed = false
  try {
    const beforeApi = await probe()
    checkProbe(beforeApi, mode === 'apply' ? [ORIGINAL_SCHEMAS] : [ORIGINAL_SCHEMAS, RESEARCH_SCHEMAS])
    connection = await client.reserve()
    await connection.unsafe('BEGIN READ ONLY')
    const session = (await connection.unsafe(INVENTORY_QUERIES.session))[0] as Record<string, unknown> | undefined
    if (session?.database !== 'postgres' || session.database_role !== 'postgres' || session.read_only !== 'on' || session.tls !== true) throw new ExposureError('session_guard')
    const beforeSettings = await connection.unsafe(SETTINGS_QUERY)
    checkSettings(beforeSettings, mode === 'rollback')
    if (mode === 'apply') {
      const tables = await connection.unsafe(TABLES_QUERY) as { relname: string; relrowsecurity: boolean }[]
      if (!same(tables.map(t => t.relname), TABLES) || tables.some(t => t.relrowsecurity !== true)) throw new ExposureError('research_schema_guard')
    }
    await connection.unsafe('ROLLBACK')
    await connection.unsafe('BEGIN READ WRITE')
    await connection.unsafe("SET LOCAL lock_timeout = '3s'")
    await connection.unsafe("SET LOCAL statement_timeout = '10s'")
    // Recheck catalog drift immediately before the only persistent change.
    checkSettings(await connection.unsafe(SETTINGS_QUERY), mode === 'rollback')
    checkProbe(beforeApi, mode === 'apply' ? [ORIGINAL_SCHEMAS] : [ORIGINAL_SCHEMAS, RESEARCH_SCHEMAS])
    await connection.unsafe(mode === 'apply' ? APPLY_SQL : ROLLBACK_SQL)
    const afterSettings = await connection.unsafe(SETTINGS_QUERY)
    checkSettings(afterSettings, mode === 'apply')
    await connection.unsafe("NOTIFY pgrst, 'reload config'")
    await connection.unsafe("NOTIFY pgrst, 'reload schema'")
    commitAttempted = true
    await connection.unsafe('COMMIT')
    committed = true
    // Reload is asynchronous. One metadata check; no repeated writes or hidden retry.
    let afterApi: SchemaProbe | null = null
    try { afterApi = await probe(); checkProbe(afterApi, [mode === 'apply' ? RESEARCH_SCHEMAS : ORIGINAL_SCHEMAS]) }
    catch { afterApi = null }
    return { operation: 'data_api_schema_exposure', project_ref: PROJECT_REF, mode, connection_mode: 'direct',
      committed: true, api_verified: afterApi !== null, before_api: beforeApi, after_api: afterApi,
      before_settings: beforeSettings, after_settings: afterSettings, customer_rows_requested: 0, table_or_grant_writes: 0,
      sql_sha256: createHash('sha256').update(mode === 'apply' ? APPLY_SQL : ROLLBACK_SQL).digest('hex') }
  } catch (error) {
    if (commitAttempted && !committed) throw new ExposureError('commit_outcome_unknown', true)
    if (error instanceof ExposureError) throw error
    throw new ExposureError('database_failed')
  } finally {
    if (connection) {
      if (!committed) try { await connection.unsafe('ROLLBACK') } catch { /* Close below; never log raw error. */ }
      try { await connection.release() } catch { /* Close below. */ }
    }
    try { await client.end({ timeout: 5 }) } catch { /* No raw driver details. */ }
  }
}

/** Explicit in-memory inputs from a private coordinator launcher; no export loading. */
export async function runExposure(input: { mode: Mode; databaseUrl: string; caBytes: Buffer; publicKey: string }) {
  const authority = certificateAuthority(input.caBytes)
  if (authority.sha256 !== OFFICIAL_CA_SHA256) throw new ExposureError('ca_pin_mismatch')
  const parsed = connectionOptions(input.databaseUrl, authority)
  const options = { ...parsed, host: `db.${PROJECT_REF}.supabase.co`, port: 5432, username: 'postgres',
    connection: { ...parsed.connection, application_name: 'neuvetra-data-api-exposure' } }
  const probe = publicSchemaProbe(input.publicKey)
  const client = initializeClient(installedDriver(), options)
  return changeExposure(client, probe, input.mode)
}

if (import.meta.main) {
  if (process.argv.length !== 3 || process.argv[2] !== '--check') throw new Error('check_mode_only_use_explicit_private_launcher')
  console.log(JSON.stringify({ project_ref: PROJECT_REF, original_schemas: ORIGINAL_SCHEMAS, desired_schemas: RESEARCH_SCHEMAS,
    ca_sha256: OFFICIAL_CA_SHA256, apply_sql: APPLY_SQL, rollback_sql: ROLLBACK_SQL, remote_connections: 0 }))
}
