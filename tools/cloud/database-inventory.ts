/** Explicit catalog-only inventory. Imports never load credentials or connect. */
import { readFile, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createHash, X509Certificate } from 'node:crypto'

export const PROJECT_REF = 'icockcoguyadhryzydvl'
type InventoryStage = 'reserve' | 'begin' | 'statement_timeout' | 'lock_timeout' | keyof typeof INVENTORY_QUERIES | 'validate_session'
type SessionChecks = { read_only: 'on' | 'off' | 'unknown'; backend_tls: boolean | null }
type InventoryDiagnostic = {
  stage: InventoryStage
  reason: 'driver_error' | 'session_missing' | 'transaction_not_read_only' | 'backend_tls_not_observed'
  sqlstate: string | null
  session_checks?: SessionChecks
}
export class InventoryError extends Error {
  constructor(public readonly code: 'invalid_export' | 'invalid_ca_file' | 'target_mismatch' | 'driver_unavailable' | 'driver_initialization_failed' | 'invalid_arguments' | 'inventory_failed' | 'inventory_connection_failed' | 'inventory_tls_failed' | 'inventory_authentication_failed' | 'output_failed', public readonly diagnostic?: InventoryDiagnostic) { super(code) }
}

/** Read only the named assignment; do not evaluate/interpolate exported values. */
export function extractDatabaseUrl(text: string): string {
  if (Buffer.byteLength(text) > 1_048_576) throw new InventoryError('invalid_export')
  const values: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const dotenv = line.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*?)\s*$/)
    const json = line.match(/^\s*"DATABASE_URL"\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/)
    if (!dotenv && !json) continue
    let value = (dotenv ?? json)![1]!
    try {
      if (value.startsWith('"')) value = JSON.parse(value)
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
    } catch { throw new InventoryError('invalid_export') }
    if (!value || /[\r\n\0]/.test(value)) throw new InventoryError('invalid_export')
    values.push(value)
  }
  if (values.length !== 1) throw new InventoryError('invalid_export')
  return values[0]!
}

export function certificateAuthority(bytes: Buffer) {
  try {
    if (!bytes.length || bytes.length > 131_072) throw new Error()
    const pem = bytes.toString('utf8')
    const expression = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g
    const certificates = pem.match(expression)
    if (!certificates?.length || certificates.length > 8 || pem.replace(expression, '').trim()) throw new Error()
    if (certificates.some(value => !new X509Certificate(value).ca)) throw new Error()
    return { pem, sha256: createHash('sha256').update(bytes).digest('hex') }
  } catch { throw new InventoryError('invalid_ca_file') }
}
export async function loadCertificateAuthority(path: string) {
  try {
    const info = await stat(path)
    if (!info.isFile() || info.size > 131_072) throw new Error()
    return certificateAuthority(await readFile(path))
  } catch { throw new InventoryError('invalid_ca_file') }
}

export function connectionOptions(value: string, authority?: ReturnType<typeof certificateAuthority>) {
  try {
    const u = new URL(value)
    const username = decodeURIComponent(u.username), password = decodeURIComponent(u.password)
    const port = Number(u.port || 5432)
    const direct = u.hostname === `db.${PROJECT_REF}.supabase.co` && username === 'postgres' && port === 5432
    const pooler = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname) && username === `postgres.${PROJECT_REF}` && [5432, 6543].includes(port)
    if (!['postgres:', 'postgresql:'].includes(u.protocol) || (!direct && !pooler) || u.pathname !== '/postgres' || u.hash || !password || /[\x00-\x1f]/.test(username + password)) throw new Error()
    if ([...u.searchParams].some(([key, val]) => key !== 'sslmode' || !['require', 'verify-full'].includes(val)) || u.searchParams.getAll('sslmode').length > 1) throw new Error()
    // Pass explicit options, never the raw URL/query or inherited PG connection options.
    return {
      host: u.hostname, port, database: 'postgres', username, password,
      ssl: { rejectUnauthorized: true, ...(authority ? { ca: authority.pem } : {}) }, max: 1, prepare: false,
      connect_timeout: 10, idle_timeout: 1, max_lifetime: 30,
      connection: { application_name: 'neuvetra-cloud-db-inventory', default_transaction_read_only: 'on', statement_timeout: 5000, lock_timeout: 1000, idle_in_transaction_session_timeout: 10000 },
      onnotice: () => {}, debug: false,
    }
  } catch { throw new InventoryError('target_mismatch') }
}

const schemas = "('public','auth','storage','frontdesk','site','terrascope','neuvetra_research_dev')"
export const INVENTORY_QUERIES = {
  session: `SELECT current_database() AS database, current_user AS database_role, current_setting('transaction_read_only') AS read_only, r.rolsuper AS superuser, r.rolbypassrls AS bypass_rls, (SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls FROM pg_catalog.pg_roles r WHERE r.rolname = current_user`,
  schemas: `SELECT nspname AS schema FROM pg_catalog.pg_namespace WHERE nspname IN ${schemas} ORDER BY nspname`,
  tables: `SELECT n.nspname AS schema, c.relname AS table, c.relkind AS kind, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ${schemas} AND c.relkind IN ('r','p','v','m') ORDER BY 1,2`,
  columns: `SELECT table_schema AS schema, table_name AS table, column_name AS column, data_type, is_nullable FROM information_schema.columns WHERE table_schema IN ${schemas} ORDER BY table_schema,table_name,ordinal_position`,
  constraints: `SELECT n.nspname AS schema, c.relname AS table, k.conname AS constraint, k.contype AS type, rn.nspname AS referenced_schema, rc.relname AS referenced_table FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_class rc ON rc.oid=k.confrelid LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid=rc.relnamespace WHERE n.nspname IN ${schemas} ORDER BY 1,2,3`,
  policies: `SELECT schemaname AS schema, tablename AS table, policyname AS policy, permissive, roles, cmd AS command FROM pg_catalog.pg_policies WHERE schemaname IN ${schemas} ORDER BY 1,2,3`,
  grants: `SELECT table_schema AS schema, table_name AS table, grantee, privilege_type AS privilege FROM information_schema.table_privileges WHERE table_schema IN ${schemas} AND grantee IN ('anon','authenticated','service_role','PUBLIC') ORDER BY 1,2,3,4`,
} as const

type Connection = { unsafe(query: string): Promise<unknown[]>; release(): Promise<void> }
export type InventoryClient = { reserve(): Promise<Connection>; end(options: { timeout: number }): Promise<void> }
type Driver = (options: ReturnType<typeof connectionOptions>) => InventoryClient

export function resolveDriver(module: unknown): Driver {
  if (typeof module === 'function') return module as Driver
  if (module && typeof module === 'object' && 'default' in module && typeof module.default === 'function') return module.default as Driver
  throw new InventoryError('driver_unavailable')
}
export function installedDriver(): Driver {
  try {
    const require = createRequire(new URL('../../packages/frontdesk-database/package.json', import.meta.url))
    return resolveDriver(require('postgres'))
  } catch { throw new InventoryError('driver_unavailable') }
}
export function initializeClient(driver: Driver, options: ReturnType<typeof connectionOptions>) {
  try { return driver(options) } catch { throw new InventoryError('driver_initialization_failed') }
}
// Only recognized protocol codes enter diagnostics. Never echo arbitrary code,
// message, detail, query, parameters, address or other driver-owned properties.
const SAFE_SQLSTATES = new Set(['08000', '08001', '08003', '08004', '08006', '08007', '08P01', '0A000', '22023', '25001', '25006', '25P02', '28000', '28P01', '40001', '40P01', '42501', '42601', '42703', '42704', '42804', '42883', '42P01', '42P05', '42P18', '53000', '53100', '53200', '53300', '53400', '54000', '54001', '55000', '55P03', '57014', '57P01', '57P02', '57P03', '58000', '58030', 'XX000', 'XX001', 'XX002'])
function connectionFailure(error: unknown, connected: boolean, stage: InventoryStage): InventoryError {
  if (error instanceof InventoryError) return error
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  const diagnostic: InventoryDiagnostic = { stage, reason: 'driver_error', sqlstate: typeof code === 'string' && SAFE_SQLSTATES.has(code) ? code : null }
  if (typeof code === 'string' && ['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(code)) return new InventoryError('inventory_tls_failed', diagnostic)
  if (code === '28P01' || code === '28000') return new InventoryError('inventory_authentication_failed', diagnostic)
  return new InventoryError(connected ? 'inventory_failed' : 'inventory_connection_failed', diagnostic)
}
export function failureSummary(error: unknown) {
  return error instanceof InventoryError
    ? { error: error.code, ...(error.diagnostic ? { diagnostic: error.diagnostic } : {}) }
    : { error: 'invalid_export' }
}

/** No arbitrary SQL/application rows. Failure output contains only bounded diagnostics. */
export async function inventory(client: InventoryClient) {
  let connection: Connection | undefined
  let stage: InventoryStage = 'reserve'
  try {
    connection = await client.reserve()
    stage = 'begin'
    await connection.unsafe('BEGIN READ ONLY')
    stage = 'statement_timeout'
    await connection.unsafe("SET LOCAL statement_timeout = '5s'")
    stage = 'lock_timeout'
    await connection.unsafe("SET LOCAL lock_timeout = '1s'")
    const result: Record<string, unknown[]> = {}
    for (const name of Object.keys(INVENTORY_QUERIES) as (keyof typeof INVENTORY_QUERIES)[]) {
      stage = name
      result[name] = await connection.unsafe(INVENTORY_QUERIES[name])
    }
    stage = 'validate_session'
    const session = result.session?.[0] as { read_only?: unknown; tls?: unknown } | undefined
    const session_checks: SessionChecks = { read_only: session?.read_only === 'on' ? 'on' : session?.read_only === 'off' ? 'off' : 'unknown', backend_tls: typeof session?.tls === 'boolean' ? session.tls : null }
    if (session?.read_only !== 'on' || session.tls !== true) {
      const reason = !session ? 'session_missing' : session.read_only !== 'on' ? 'transaction_not_read_only' : 'backend_tls_not_observed'
      throw new InventoryError('inventory_failed', { stage, reason, sqlstate: null, session_checks })
    }
    return { project_ref: PROJECT_REF, operation: 'catalog_inventory', customer_rows_requested: 0, metadata: result }
  } catch (error) { throw connectionFailure(error, connection !== undefined, stage) }
  finally {
    if (connection) {
      try { await connection.unsafe('ROLLBACK') } catch { /* end() closes the failed session */ }
      try { await connection.release() } catch { /* end() still runs */ }
    }
    try { await client.end({ timeout: 5 }) } catch { /* Never expose driver errors */ }
  }
}

export function argumentsFor(argv: string[]) {
  if (argv.some((v, i) => i % 2 === 0 && !['--mode', '--export', '--out', '--ca-file'].includes(v)) || argv.length % 2) throw new InventoryError('invalid_arguments')
  const pairs = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 2) {
    if (pairs.has(argv[i]!)) throw new InventoryError('invalid_arguments')
    pairs.set(argv[i]!, argv[i + 1]!)
  }
  const mode = pairs.get('--mode') ?? 'check', exportPath = pairs.get('--export'), output = pairs.get('--out')
  if (!['check', 'inventory'].includes(mode) || !exportPath || (mode === 'inventory' && !output) || (mode === 'check' && output)) throw new InventoryError('invalid_arguments')
  return { mode, exportPath, output, caFile: pairs.get('--ca-file') }
}

async function main() {
  try {
    const args = argumentsFor(process.argv.slice(2))
    const authority = args.caFile ? await loadCertificateAuthority(args.caFile) : undefined
    const options = connectionOptions(extractDatabaseUrl(await readFile(args.exportPath, 'utf8')), authority)
    // Resolve only the already installed dependency, never the FrontDesk DB client.
    const driver = installedDriver()
    if (args.mode === 'check') {
      console.log(JSON.stringify({ project_ref: PROJECT_REF, target_matches: true, tls_verification: true, ca_sha256: authority?.sha256 ?? null, driver_available: true, remote_connections: 0 }))
      return
    }
    // Reserve output before any remote connection; refuse overwrite.
    try { await writeFile(args.output!, '', { flag: 'wx', mode: 0o600 }) } catch { throw new InventoryError('output_failed') }
    const result = await inventory(initializeClient(driver, options))
    try { await writeFile(args.output!, JSON.stringify({ ...result, ca_sha256: authority?.sha256 ?? null }, null, 2) + '\n', { mode: 0o600 }) } catch { throw new InventoryError('output_failed') }
    console.log(JSON.stringify({ project_ref: PROJECT_REF, operation: 'catalog_inventory', completed: true, customer_rows_requested: 0 }))
  } catch (error) {
    console.error(JSON.stringify(failureSummary(error)))
    process.exitCode = 1
  }
}

if (import.meta.main) await main()
