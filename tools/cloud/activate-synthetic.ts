/** First activation of the frozen six-fictional-passage build only; no import I/O.
 * Root supplies reviewed public artifacts/pins and a direct verified-TLS client
 * factory using apply-development.directWriteOptions. No ENV or CLI loading.
 * Independently reviewed publication receipts are coordinator evidence, not a
 * cryptographic provider attestation. Never use this helper for a real corpus.
 * One transaction checks all staged rows + two known Auth users, then inserts
 * memberships, approves synthetic rows, verifies runs and invokes the fixed RPC.
 * Existing memberships/active pointers or non-pending rows refuse; no retry,
 * deletion, customer-row discovery, deadline extension or commercial approval.
 */
import { COLUMNS, CONTRACT_SHA256, validateStage, sha256, type Client } from './apply-development'
import { INVENTORY_QUERIES, PROJECT_REF } from './database-inventory'

const SCHEMA = 'neuvetra_research_dev'
const BUCKET = 'neuvetra-research-dev'
const TARGET_SHA = 'fff2d429b00a4dc31806cf029d386de87be263efa2f55ec366b5e928dd5be055'
const STAGE_SHA = 'b98ef3e1a52d294a5916f2b2f9cf8972d40a2445a25c6cb98597c05af0311ce5'
const ADAPTER_SHA = '3ca78f070155d66be9565a7e9ca76b6cac9b6622c0aeacbfa1137226601dd23b'
const FIXTURE_SHA = '1d048902d03a948d27ea8fc9d08975970de794242a065ae83b0b743be2958098'
const RUN_ID = 'neuvetra-cloud-smoke-20260909'
const SCOPES = ['90000000-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-00000000000b']
type Row = Record<string, unknown>
type Table = keyof typeof COLUMNS
type Diagnostic = { phase: string; table: string | null; row_index_0based: number | null; sqlstate: string | null }
export class ActivationError extends Error { constructor(public readonly code: string, public readonly diagnostic?: Diagnostic) { super(code) } }
function need(ok: unknown, code: string): asserts ok { if (!ok) throw new ActivationError(code) }
function parse(bytes: Buffer, pin: string) {
  need(/^[0-9a-f]{64}$/.test(pin) && bytes.length <= 2_000_000 && sha256(bytes) === pin, 'artifact_pin_mismatch')
  try { return JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(bytes)) as Row } catch { throw new ActivationError('artifact_invalid') }
}
function canonical(value: unknown): string {
  return JSON.stringify(value, function (_key, v) { return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v })
}
function same(actual: unknown, expected: unknown) { need(canonical(actual) === canonical(expected), 'receipt_mismatch') }
function rows(value: unknown): Row[] { need(Array.isArray(value) && value.every(r => r && typeof r === 'object' && !Array.isArray(r)), 'artifact_invalid'); return value as Row[] }
function sorted(value: Row[], key: string) { return [...value].sort((a, b) => String(a[key]).localeCompare(String(b[key]))) }
function uuid(value: unknown) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) && value !== '00000000-0000-0000-0000-000000000000' }
export type ActivationInputs = { target: Buffer; stage: Buffer; publication: Buffer; publicationPin: string; identities: Buffer; identitiesPin: string; now: number }

export function prepareActivation(input: ActivationInputs) {
  need(Number.isFinite(input.now), 'invalid_time')
  const target = parse(input.target, TARGET_SHA)
  const stage = validateStage(input.stage, STAGE_SHA, CONTRACT_SHA256, input.now)
  const publication = parse(input.publication, input.publicationPin), identities = parse(input.identities, input.identitiesPin)
  need(target.status === 'approved_synthetic_development' && target.synthetic_use_approved === true, 'target_not_approved')
  need(publication.operation === 'verify_synthetic_publication' && publication.status === 'verified' && publication.phase === 'complete'
    && publication.readiness_verified === true && publication.activated === false && publication.approvals_written === 0, 'publication_not_verified')
  for (const [key, value] of Object.entries({ project_ref: PROJECT_REF, target_sha256: TARGET_SHA, stage_sha256: STAGE_SHA, fixture_sha256: FIXTURE_SHA, adapter_sha256: ADAPTER_SHA, review_expires_at: target.review_expires_at })) same(publication[key], value)
  const finished = typeof publication.finished_at === 'string' ? Date.parse(publication.finished_at) : NaN
  need(Number.isFinite(finished) && finished <= input.now && finished >= input.now - 30 * 60_000, 'publication_receipt_stale')
  need(Date.parse(String(target.review_expires_at)) > input.now, 'review_expired')
  const bucket = publication.bucket as Row
  need(bucket?.id === BUCKET && bucket.public === false && typeof bucket.file_size_limit === 'number' && bucket.file_size_limit > 0 && bucket.file_size_limit <= 1_000_000, 'bucket_receipt_invalid')
  same(bucket.allowed_mime_types, ['application/octet-stream'])
  same(sorted(rows(publication.object_receipts), 'object_sha256'), sorted(stage.research_objects, 'object_sha256'))
  const builds = target.builds as Record<string, Row>
  const expectedVectors = SCOPES.map(scope_id => ({ ...builds[scope_id], scope_id, vectors_verified: true, activated: false }))
  same(sorted(rows(publication.vector_receipts), 'scope_id'), sorted(expectedVectors, 'scope_id'))
  need(identities.project_ref === PROJECT_REF && identities.run_id === RUN_ID && identities.status === 'complete' && identities.attempts === 4, 'identities_not_ready')
  const users = rows(identities.identities)
  need(users.length === 2, 'identities_not_ready')
  for (const [index, sid] of SCOPES.entries()) {
    const match = users.filter(u => u.scope_id === sid)
    need(match.length === 1 && uuid(match[0]!.auth_user_id) && match[0]!.phase === 'signed_in'
      && match[0]!.email === `${RUN_ID}-${index === 0 ? 'a' : 'b'}@neuvetra.invalid`
      && typeof match[0]!.expires_at === 'number' && match[0]!.expires_at * 1000 > input.now, 'identities_not_ready')
  }
  need(new Set(users.map(u => u.auth_user_id)).size === 2, 'duplicate_identity')
  return { stage, users, builds }
}

const scopeFilter = `scope_id IN ('${SCOPES[0]}','${SCOPES[1]}')`
const ARRAY_COLUMNS = new Set(['dependency_ids', 'qualifications', 'expected_passage_ids'])
function valuesFor(columns: readonly string[], row: Row) {
  return columns.map((c, i) => ({ sql: c === 'spans' ? `$${i + 1}::text::jsonb` : ARRAY_COLUMNS.has(c) ? `ARRAY(SELECT jsonb_array_elements_text($${i + 1}::text::jsonb))` : c === 'review_expires_at' ? `$${i + 1}::timestamptz` : `$${i + 1}`, value: c === 'spans' || ARRAY_COLUMNS.has(c) ? JSON.stringify(row[c]) : row[c] }))
}
const SQLSTATES = new Set(['08006', '08P01', '22023', '22P02', '23502', '23503', '23505', '23514', '25006', '25P02', '40001', '40P01', '42501', '42601', '42703', '42804', '42883', '42P01', '55P03', '57014', '57P01'])

export async function activateSynthetic(input: ActivationInputs, factory: () => Client) {
  const { stage, users, builds } = prepareActivation(input)
  let client: Client | undefined, connection: Awaited<ReturnType<Client['reserve']>> | undefined, committed = false
  let position = { phase: 'reserve', table: null as string | null, row_index_0based: null as number | null }
  try {
    client = factory(); connection = await client.reserve()
    position.phase = 'readonly_session'
    await connection.unsafe('BEGIN READ ONLY')
    const session = await connection.unsafe(INVENTORY_QUERIES.session)
    need(session.length === 1 && session[0]!.database === 'postgres' && session[0]!.database_role === 'postgres' && session[0]!.read_only === 'on' && session[0]!.tls === true, 'live_session_refused')
    await connection.unsafe('ROLLBACK')
    position.phase = 'begin_activation'
    await connection.unsafe('BEGIN')
    await connection.unsafe("SET LOCAL lock_timeout = '3s'")
    await connection.unsafe("SET LOCAL statement_timeout = '30s'")
    // Lock only the isolated schema tables so comparison and approval cannot race.
    await connection.unsafe(`LOCK TABLE ${[...Object.keys(COLUMNS), 'research_memberships', 'research_active_builds'].map(t => `${SCHEMA}.${t}`).join(', ')} IN SHARE ROW EXCLUSIVE MODE`)
    for (const table of Object.keys(COLUMNS) as Table[]) {
      position = { phase: 'projection_count', table, row_index_0based: null }
      const count = await connection.unsafe(`SELECT count(*)::int AS count FROM ${SCHEMA}.${table} WHERE ${scopeFilter}`)
      need(count.length === 1 && count[0]!.count === stage[table].length, 'projection_count_mismatch')
      for (const [index, row] of stage[table].entries()) {
        position = { phase: 'projection_compare', table, row_index_0based: index }
        const columns = COLUMNS[table], values = valuesFor(columns, row)
        const result = await connection.unsafe(`SELECT count(*)::int AS matching FROM ${SCHEMA}.${table} WHERE ${columns.map((c, i) => `${c} IS NOT DISTINCT FROM ${values[i]!.sql}`).join(' AND ')}`, values.map(v => v.value))
        need(result.length === 1 && result[0]!.matching === 1, 'projection_row_mismatch')
      }
    }
    for (const table of ['research_memberships', 'research_active_builds']) {
      position = { phase: 'first_activation_guard', table, row_index_0based: null }
      const count = await connection.unsafe(`SELECT count(*)::int AS count FROM ${SCHEMA}.${table} WHERE ${scopeFilter}`)
      need(count.length === 1 && count[0]!.count === 0, 'existing_membership_or_activation')
    }
    // Retrieve metadata for only the two returned, pinned Auth IDs. No listing.
    for (const [index, user] of users.entries()) {
      position = { phase: 'known_auth_identity', table: 'auth.users', row_index_0based: index }
      const result = await connection.unsafe('SELECT id, email, role, email_confirmed_at, raw_app_meta_data FROM auth.users WHERE id = $1::uuid FOR SHARE', [user.auth_user_id])
      need(result.length === 1 && result[0]!.id === user.auth_user_id && result[0]!.email === user.email && result[0]!.role === 'authenticated' && !!result[0]!.email_confirmed_at, 'auth_identity_mismatch')
      const app = result[0]!.raw_app_meta_data as Row
      need(app?.neuvetra_synthetic === true && app.neuvetra_run_id === RUN_ID && app.neuvetra_scope_id === user.scope_id, 'auth_identity_mismatch')
    }
    for (const [index, user] of users.entries()) {
      position = { phase: 'insert_membership', table: 'research_memberships', row_index_0based: index }
      await connection.unsafe(`INSERT INTO ${SCHEMA}.research_memberships(scope_id,user_id) VALUES ($1::uuid,$2::uuid)`, [user.scope_id, user.auth_user_id])
    }
    for (const [table, field, before, after, expected] of [
      ['research_sources', 'review_status', 'pending', 'approved', 2],
      ['research_passages', 'review_status', 'pending', 'approved', 6],
      ['research_releases', 'status', 'candidate', 'approved', 2],
      ['research_ingestion_runs', 'state', 'staged', 'verified', 2],
    ] as const) {
      position = { phase: 'synthetic_approval', table, row_index_0based: null }
      const result = await connection.unsafe(`UPDATE ${SCHEMA}.${table} SET ${field} = '${after}' WHERE ${scopeFilter} AND ${field} = '${before}' RETURNING scope_id`)
      need(result.length === expected, 'approval_count_mismatch')
    }
    for (const [index, sid] of SCOPES.entries()) {
      position = { phase: 'activate_rpc', table: 'research_active_builds', row_index_0based: index }
      await connection.unsafe(`SELECT ${SCHEMA}.activate_research_build($1::uuid,$2::uuid,$3::text)`, [sid, builds[sid]!.build_id, builds[sid]!.manifest_sha256])
    }
    position = { phase: 'verify_pointers', table: 'research_active_builds', row_index_0based: null }
    const active = await connection.unsafe(`SELECT scope_id,release_sha256,build_id FROM ${SCHEMA}.research_active_builds WHERE ${scopeFilter}`)
    same(sorted(active, 'scope_id'), sorted(SCOPES.map(scope_id => ({ scope_id, release_sha256: builds[scope_id]!.release_sha256, build_id: builds[scope_id]!.build_id })), 'scope_id'))
    position = { phase: 'commit', table: null, row_index_0based: null }
    await connection.unsafe('COMMIT'); committed = true
    return { operation: 'activate_synthetic_builds', project_ref: PROJECT_REF, committed: true, target_sha256: TARGET_SHA, stage_sha256: STAGE_SHA, publication_sha256: input.publicationPin, identities_sha256: input.identitiesPin, memberships_inserted: 2, synthetic_sources_approved: 2, synthetic_passages_approved: 6, builds_activated: 2, commercial_runtime_approval: false }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null
    throw new ActivationError(error instanceof ActivationError ? error.code : 'activation_failed', { ...position, sqlstate: typeof code === 'string' && SQLSTATES.has(code) ? code : null })
  } finally {
    if (connection) {
      if (!committed) try { await connection.unsafe('ROLLBACK') } catch { /* outcome needs independent readback */ }
      try { await connection.release() } catch { /* close still runs */ }
    }
    if (client) try { await client.end({ timeout: 5 }) } catch { /* no raw provider output */ }
  }
}
