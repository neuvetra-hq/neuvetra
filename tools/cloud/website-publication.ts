/** Fixed EPA website preparation/publication. Functions only: no import I/O,
 * ENV loading, automatic retry, Auth creation or synthetic approval shortcuts.
 * Root supplies independently reviewed pins, private in-memory credentials and
 * a direct verified-TLS database factory (apply-development.directWriteOptions).
 * A saved coordinator receipt is evidence, not a provider signature.
 */
import { request as httpsRequest } from 'node:https'
import { createHash } from 'node:crypto'
import { COLUMNS, type Client } from './apply-development'
import { INVENTORY_QUERIES, PROJECT_REF } from './database-inventory'
import { parsePassageRelease, normalizePage } from '../../apps/site-api/src/research-passages/release'

export const SCOPE = '90000000-0000-4000-8000-00000000000c'
export const BUILD = '63f0190c-9694-46db-9ea8-85445a80f6be'
export const NAMESPACE = 'nv-63f0190c969446db9ea885445a80f6be'
export const SCHEMA = 'neuvetra_research_dev'
export const BUCKET = 'neuvetra-research-dev'
export const SUPABASE_HOST = `${PROJECT_REF}.supabase.co`
export const PINECONE_HOST = 'neuvetra-ghg-dev-0msj1fa.svc.aped-4627-b74a.pinecone.io'
export const PROFILE_SHA = '756dd7589f918a257dad2fad38e3d8839c7d9c55a007885f0e1505f5528871f5'
export const SOURCE_SHA = '14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3'
export const EXTRACTION_SHA = '6c0dd2224703fa7bd48f6a18a666d3a29212d2435f6348382cef76950ffb36a4'
export const MIGRATION_SHA = 'f2002b8c10cc913180fde2bcb14398ebf504b13eea409a93ee46333328ae35a9'
export const RUN_ID = 'neuvetra-website-epa-20260909'
export const READER_EMAIL = `${RUN_ID}@neuvetra.invalid`
export const IDS = Array.from({ length: 18 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`)
const SOURCE_URL = 'https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf'
const SHA = /^[a-f0-9]{64}$/
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
type Row = Record<string, unknown>
type Table = keyof typeof COLUMNS
type Stage = Record<Table, Row[]>
type Kind = 'source' | 'extraction' | 'release'
export type RawObjects = Record<Kind, Buffer>
export type Journal = (value: Row) => unknown
export class WebsitePublicationError extends Error {
  constructor(public readonly code: string, public readonly diagnostic?: Row) { super(code) }
}
function need(ok: unknown, code: string): asserts ok { if (!ok) throw new WebsitePublicationError(code) }
export const sha = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex')
const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v)
function obj(v: unknown): Row { need(record(v), 'invalid_document'); return v }
function list(v: unknown): Row[] { need(Array.isArray(v) && v.every(record), 'invalid_document'); return v }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (record(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  return JSON.stringify(value)
}
function same(a: unknown, b: unknown, code = 'binding_mismatch') { need(canonical(a) === canonical(b), code) }
function parse(bytes: Buffer, pin: string): Row {
  need(SHA.test(pin) && bytes.length > 0 && bytes.length <= 1_000_000 && sha(bytes) === pin, 'artifact_pin_mismatch')
  try { return obj(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))) }
  catch (error) { if (error instanceof WebsitePublicationError) throw error; throw new WebsitePublicationError('invalid_document') }
}
export function journalSnapshot(journal: Journal, value: Row) {
  need(typeof journal === 'function', 'journal_required')
  try {
    const result = journal(structuredClone(value))
    if (result && (typeof result === 'object' || typeof result === 'function') && 'then' in result && typeof result.then === 'function') {
      // An asynchronous write has not completed durably. Refuse before the next
      // provider call and consume any rejection without exposing its contents.
      Promise.resolve(result).catch(() => {})
      throw new WebsitePublicationError('journal_must_be_synchronous')
    }
  } catch (error) {
    if (error instanceof WebsitePublicationError) throw error
    throw new WebsitePublicationError('journal_failed')
  }
}
const save = journalSnapshot

export interface WebsitePlan {
  schema_version: 1; scope_id: string; build_id: string; namespace: string
  release_sha256: string; profile_sha256: string; review_expires_at: string
  stage: Stage; records: Row[]; manifest_sha256: string
}

/** Pure, deterministic projection of an ALREADY independently approved release.
 * Caller must not manufacture approval metadata to obtain a plan. No source
 * bytes enter a provider until verifyOriginals also succeeds below.
 */
export function prepareWebsitePlan(releaseBytes: Buffer, releasePin: string, now: number): WebsitePlan {
  const raw = parse(releaseBytes, releasePin)
  let release: ReturnType<typeof parsePassageRelease>
  try { release = parsePassageRelease(raw, now) } catch { throw new WebsitePublicationError('source_not_approved') }
  need(release.release_id === 'scope2-website' && release.version === '1' && release.sources.length === 1 && release.extractions.length === 1, 'wrong_release')
  const hosted = obj(raw.hosted_processing), review = obj(raw.review)
  need(hosted.review_status === 'approved' && hosted.commercial_runtime_approval === false && hosted.public_redistribution_approval === false, 'hosted_use_not_approved')
  same(release.review.approved_passage_ids, IDS, 'incomplete_approved_passages')
  same(release.passages.map(p => p.id), IDS, 'incomplete_approved_passages')
  same(review.approved_source_ids, ['epa-electricity-2023']); same(review.approved_extraction_ids, ['epa-electricity-2023-pages-v1'])
  const source = release.sources[0]!, extraction = release.extractions[0]!
  need(source.id === 'epa-electricity-2023' && source.sha256 === SOURCE_SHA && source.bytes === 396931 && source.version === 'December 2023'
    && source.canonical_url === SOURCE_URL && extraction.sha256 === EXTRACTION_SHA && extraction.source_sha256 === SOURCE_SHA, 'source_identity_mismatch')
  const sourceRows: Row[] = [{ scope_id: SCOPE, source_sha256: SOURCE_SHA, source_id: source.id, title: source.title,
    canonical_url: source.canonical_url, version: source.version, review_status: 'pending' }]
  const objects: Row[] = ([['source', SOURCE_SHA, 396931, 'source.pdf'], ['extraction', EXTRACTION_SHA, 31214, 'extraction.json'],
    ['release', releasePin, releaseBytes.length, 'release.json']] as const).map(([kind, hash, size, suffix]) => ({ scope_id: SCOPE,
      object_sha256: hash, kind, byte_size: size, bucket: BUCKET, object_key: `${SCOPE}/sha256/${hash}/${suffix}` }))
  const passages: Row[] = release.passages.map(p => ({ scope_id: SCOPE, release_sha256: releasePin, build_id: BUILD,
    passage_id: p.id, vector_id: sha(SCOPE + releasePin + p.id), source_sha256: SOURCE_SHA, extraction_sha256: EXTRACTION_SHA,
    text: p.text, text_sha256: p.sha256, locator: p.locator, spans: p.locator_detail.spans,
    dependency_ids: p.required_passage_ids, qualifications: p.qualifications, review_status: 'pending', is_active: true }))
  const records = passages.map(p => ({ _id: p.vector_id, text: p.text, scope_id: SCOPE, release_sha256: releasePin,
    profile_sha256: PROFILE_SHA, passage_id: p.passage_id, text_sha256: p.text_sha256, is_active: true }))
  const stage: Stage = { research_scopes: [{ scope_id: SCOPE, label: 'reviewed-epa-private', is_synthetic: false }], research_objects: objects,
    research_sources: sourceRows, research_releases: [{ scope_id: SCOPE, release_sha256: releasePin, build_id: BUILD, profile_sha256: PROFILE_SHA,
      namespace: NAMESPACE, version: release.version, status: 'candidate', review_expires_at: release.review.expires_at, commercial_runtime_approval: false }],
    research_passages: passages, research_ingestion_runs: [] }
  // Bind all staged content, object metadata and embedded text without a circular
  // self-hash in the ingestion row. Original bytes are separately hash-verified.
  const manifest_sha256 = sha(canonical({ stage, records, scope_id: SCOPE, build_id: BUILD, namespace: NAMESPACE, profile_sha256: PROFILE_SHA, release_sha256: releasePin }))
  stage.research_ingestion_runs = [{ scope_id: SCOPE, build_id: BUILD, release_sha256: releasePin, manifest_sha256,
    expected_passage_ids: IDS, state: 'staged' }]
  return { schema_version: 1, scope_id: SCOPE, build_id: BUILD, namespace: NAMESPACE, release_sha256: releasePin,
    profile_sha256: PROFILE_SHA, review_expires_at: release.review.expires_at!, stage, records, manifest_sha256 }
}
export const planSha = (plan: WebsitePlan) => sha(canonical(plan))
export interface Inputs { release: Buffer; releasePin: string; target: Buffer; targetPin: string; now: number }
/** Every effect re-derives the complete plan; a mutable caller plan is not trusted. */
export function preflight(input: Inputs) {
  const plan = prepareWebsitePlan(input.release, input.releasePin, input.now), target = parse(input.target, input.targetPin)
  same({ project_ref: target.project_ref, scope_id: target.scope_id, build_id: target.build_id, namespace: target.namespace,
    release_sha256: target.release_sha256, profile_sha256: target.profile_sha256, plan_sha256: target.plan_sha256, bucket: target.bucket,
    supabase_host: target.supabase_host, pinecone_host: target.pinecone_host, pinecone_index: target.pinecone_index },
  { project_ref: PROJECT_REF, scope_id: SCOPE, build_id: BUILD, namespace: NAMESPACE, release_sha256: input.releasePin,
    profile_sha256: PROFILE_SHA, plan_sha256: planSha(plan), bucket: BUCKET, supabase_host: SUPABASE_HOST, pinecone_host: PINECONE_HOST, pinecone_index: 'neuvetra-ghg-dev' })
  need(target.status === 'approved_private_research' && typeof target.approved_by === 'string' && !!target.approved_by, 'target_not_approved')
  const approved = Date.parse(String(target.approved_at)), expires = Date.parse(String(target.review_expires_at))
  need(Number.isFinite(input.now) && Number.isFinite(approved) && approved <= input.now && Number.isFinite(expires)
    && expires > input.now && expires <= Date.parse(plan.review_expires_at), 'target_review_expired')
  return { plan, target }
}
export function verifyOriginals(input: Inputs, bytes: RawObjects) {
  const { plan } = preflight(input)
  for (const o of plan.stage.research_objects) {
    const b = bytes[o.kind as Kind]
    need(Buffer.isBuffer(b) && b.length === o.byte_size && sha(b) === o.object_sha256, 'source_hash_mismatch')
  }
  need(bytes.release.equals(input.release), 'source_hash_mismatch')
  const artifact = parse(bytes.extraction, EXTRACTION_SHA)
  need(artifact.source_sha256 === SOURCE_SHA && artifact.normalization === 'nfkc_whitespace_v1', 'extraction_mismatch')
  const pages = list(artifact.pages)
  need(pages.length === 8 && new Set(pages.map(p => p.pdf_page_1_based)).size === 8, 'extraction_mismatch')
  for (const p of pages) need(typeof p.text === 'string' && normalizePage(p.text) === p.text, 'extraction_mismatch')
  for (const passage of plan.stage.research_passages) {
    const parts = list(passage.spans).map(s => {
      const page = pages.find(p => p.pdf_page_1_based === s.pdf_page_1_based)
      need(page && typeof page.text === 'string' && sha(page.text) === s.normalized_page_sha256, 'locator_mismatch')
      const points = Array.from(page.text), start = Number(s.context_start), end = Number(s.context_end_exclusive)
      need(Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end > start && end <= points.length, 'locator_mismatch')
      const text = points.slice(start, end).join(''); need(sha(text) === s.context_sha256, 'locator_mismatch'); return text
    })
    need(parts.join('\n\n') === passage.text, 'locator_mismatch')
  }
  return plan
}

/** Apply the exact additive constraint migration once. The caller first binds a
 * reviewed current inventory and verified direct connection; the SQL preserves
 * its own full BEGIN/COMMIT and validates its fixed project acknowledgement.
 */
export async function applyWebsiteScopeMigration(bytes: Buffer, pin: string, factory: () => Client) {
  need(pin === MIGRATION_SHA && sha(bytes) === MIGRATION_SHA, 'migration_pin_mismatch')
  let client: Client | undefined, db: Connection | undefined, committed = false
  let phase = 'reserve'
  try {
    client = factory(); db = await client.reserve(); phase = 'readonly_session'
    await db.unsafe('BEGIN READ ONLY'); const session = await db.unsafe(INVENTORY_QUERIES.session)
    need(session.length === 1 && session[0]!.database === 'postgres' && session[0]!.database_role === 'postgres'
      && session[0]!.read_only === 'on' && session[0]!.tls === true, 'live_session_refused')
    await db.unsafe('ROLLBACK'); phase = 'migration'
    await db.unsafe(`SET neuvetra.target_project_ref = '${PROJECT_REF}';\n${bytes.toString('utf8')}`)
    committed = true
    return { operation: 'extend_website_epa_scope', status: 'completed', committed: true, project_ref: PROJECT_REF,
      migration_sha256: MIGRATION_SHA, scope_rows_inserted: 0, approvals_written: 0, activations: 0 }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null
    throw new WebsitePublicationError(error instanceof WebsitePublicationError ? error.code : 'database_operation_failed',
      { stage: phase, sqlstate: typeof code === 'string' && SQLSTATES.has(code) ? code : null, outcome: 'failed_or_outcome_unconfirmed' })
  } finally {
    if (db) { if (!committed) try { await db.unsafe('ROLLBACK') } catch { /* readback before retry */ }
      try { await db.release() } catch { /* close below */ } }
    if (client) try { await client.end({ timeout: 5 }) } catch { /* sanitized */ }
  }
}

type Connection = Awaited<ReturnType<Client['reserve']>>
const ARRAY_FIELDS = new Set(['dependency_ids', 'qualifications', 'expected_passage_ids'])
const SQLSTATES = new Set(['08006', '22023', '22P02', '23502', '23503', '23505', '23514', '25P02', '40001', '40P01', '42501', '42703', '42804', '42P01', '55P03', '57014'])
function bindings(columns: readonly string[], row: Row) {
  return columns.map((c, i) => ({ sql: c === 'spans' ? `$${i + 1}::text::jsonb` : ARRAY_FIELDS.has(c)
    ? `ARRAY(SELECT jsonb_array_elements_text($${i + 1}::text::jsonb))` : c === 'review_expires_at' ? `$${i + 1}::timestamptz` : `$${i + 1}`,
  value: c === 'spans' || ARRAY_FIELDS.has(c) ? JSON.stringify(row[c]) : row[c] }))
}
async function transaction<T>(factory: () => Client, work: (db: Connection, position: Row) => Promise<T>): Promise<T> {
  let client: Client | undefined, db: Connection | undefined, committed = false
  const position: Row = { stage: 'reserve', table: null, row_index_0based: null }
  try {
    client = factory(); db = await client.reserve(); position.stage = 'readonly_session'
    await db.unsafe('BEGIN READ ONLY'); const session = await db.unsafe(INVENTORY_QUERIES.session)
    need(session.length === 1 && session[0]!.database === 'postgres' && session[0]!.database_role === 'postgres'
      && session[0]!.read_only === 'on' && session[0]!.tls === true, 'live_session_refused')
    await db.unsafe('ROLLBACK'); await db.unsafe('BEGIN')
    await db.unsafe("SET LOCAL lock_timeout = '3s'"); await db.unsafe("SET LOCAL statement_timeout = '30s'")
    const result = await work(db, position); position.stage = 'commit'; position.table = null; position.row_index_0based = null
    await db.unsafe('COMMIT'); committed = true; return result
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null
    throw new WebsitePublicationError(error instanceof WebsitePublicationError ? error.code : 'database_operation_failed',
      { ...position, sqlstate: typeof code === 'string' && SQLSTATES.has(code) ? code : null, outcome: committed ? 'committed' : 'failed_or_outcome_unconfirmed' })
  } finally {
    if (db) { if (!committed) try { await db.unsafe('ROLLBACK') } catch { /* uncertain outcome; caller readback */ }
      try { await db.release() } catch { /* close below */ } }
    if (client) try { await client.end({ timeout: 5 }) } catch { /* never expose provider errors */ }
  }
}
async function lockAndCheckEmpty(db: Connection) {
  await db.unsafe(`LOCK TABLE ${[...Object.keys(COLUMNS), 'research_memberships', 'research_active_builds'].map(t => `${SCHEMA}.${t}`).join(', ')} IN SHARE ROW EXCLUSIVE MODE`)
  for (const table of ['research_memberships', 'research_active_builds']) {
    const count = await db.unsafe(`SELECT count(*)::int AS count FROM ${SCHEMA}.${table} WHERE scope_id = $1::uuid`, [SCOPE])
    need(count.length === 1 && count[0]!.count === 0, 'existing_membership_or_activation')
  }
}
async function compareProjection(db: Connection, stage: Stage, position: Row) {
  for (const table of Object.keys(COLUMNS) as Table[]) {
    position.stage = 'projection_compare'; position.table = table
    const count = await db.unsafe(`SELECT count(*)::int AS count FROM ${SCHEMA}.${table} WHERE scope_id = $1::uuid`, [SCOPE])
    need(count.length === 1 && count[0]!.count === stage[table].length, 'projection_count_mismatch')
    for (const [i, row] of stage[table].entries()) {
      position.row_index_0based = i; const columns = COLUMNS[table], values = bindings(columns, row)
      const matches = await db.unsafe(`SELECT count(*)::int AS matching FROM ${SCHEMA}.${table} WHERE ${columns.map((c, n) => `${c} IS NOT DISTINCT FROM ${values[n]!.sql}`).join(' AND ')}`, values.map(v => v.value))
      need(matches.length === 1 && matches[0]!.matching === 1, 'projection_row_mismatch')
    }
  }
}
export async function stageWebsite(input: Inputs, factory: () => Client) {
  const { plan } = preflight(input)
  return transaction(factory, async (db, position) => {
    await lockAndCheckEmpty(db)
    for (const table of Object.keys(COLUMNS) as Table[]) for (const [i, row] of plan.stage[table].entries()) {
      position.stage = 'stage_insert'; position.table = table; position.row_index_0based = i
      const columns = COLUMNS[table], values = bindings(columns, row)
      await db.unsafe(`INSERT INTO ${SCHEMA}.${table} (${columns.join(',')}) VALUES (${values.map(v => v.sql).join(',')}) ON CONFLICT DO NOTHING`, values.map(v => v.value))
    }
    await compareProjection(db, plan.stage, position)
    return { operation: 'stage_website_epa', status: 'completed', committed: true, project_ref: PROJECT_REF, scope_id: SCOPE,
      release_sha256: input.releasePin, target_sha256: input.targetPin, plan_sha256: planSha(plan), manifest_sha256: plan.manifest_sha256,
      stage_rows: 25, approvals_written: 0, activations: 0 }
  })
}

export interface ResponseBytes { status: number; body: Buffer }
export type Transport = (origin: 'supabase' | 'pinecone' | 'control', method: 'GET' | 'POST', path: string, body?: Buffer, contentType?: string) => Promise<ResponseBytes>
export interface Secrets { supabaseAdminKey: string; pineconeApiKey: string }
/** Direct HTTPS ignores proxy variables. Validate the finite route BEFORE
 * attaching credentials; no redirects, retries or raw provider error logging.
 */
export function createWebsiteTransport(input: Inputs, secrets: Secrets): Transport {
  const { plan } = preflight(input)
  const objectRoutes = plan.stage.research_objects.map(o => ({ row: o,
    get: `/storage/v1/object/authenticated/${BUCKET}/${o.object_key}`, put: `/storage/v1/object/${BUCKET}/${o.object_key}` }))
  const upsertBody = Buffer.from(plan.records.map(r => JSON.stringify(r)).join('\n') + '\n')
  const fetchPath = `/vectors/fetch?namespace=${NAMESPACE}${plan.records.map(r => `&ids=${r._id}`).join('')}`
  const admin = secrets.supabaseAdminKey, pinecone = secrets.pineconeApiKey
  need(typeof admin === 'string' && typeof pinecone === 'string' && pinecone.length > 0 && !/[\r\n]/.test(pinecone), 'invalid_credentials')
  const modern = /^sb_secret_[A-Za-z0-9_-]{16,300}$/.test(admin)
  if (!modern) {
    try { const claims = JSON.parse(Buffer.from(admin.split('.')[1]!, 'base64url').toString('utf8'))
      need(admin.split('.').length === 3 && claims.role === 'service_role' && claims.ref === PROJECT_REF && !/[\r\n]/.test(admin), 'invalid_credentials')
    } catch { throw new WebsitePublicationError('invalid_credentials') }
  }
  return async (origin, method, path, body, contentType) => {
    const objectRoute = objectRoutes.find(o => method === 'GET' ? o.get === path : o.put === path)
    const allowed = origin === 'supabase' ? method === 'GET' && path === `/storage/v1/bucket/${BUCKET}`
      || !!objectRoute
      : origin === 'control' ? method === 'GET' && path === '/indexes/neuvetra-ghg-dev'
        : origin === 'pinecone' && (method === 'POST' && path === `/records/namespaces/${NAMESPACE}/upsert`
          || method === 'GET' && path === fetchPath)
    need(allowed && !/[\\#\r\n]/.test(path) && (!body || body.length <= 1_000_000), 'destination_refused')
    if (method === 'GET') need(body === undefined, 'request_body_refused')
    if (method === 'POST' && origin === 'supabase') need(objectRoute && body && body.length === objectRoute.row.byte_size
      && sha(body) === objectRoute.row.object_sha256 && contentType === 'application/octet-stream', 'request_body_refused')
    if (method === 'POST' && origin === 'pinecone') need(body && body.equals(upsertBody) && contentType === 'application/x-ndjson', 'request_body_refused')
    const host = origin === 'supabase' ? SUPABASE_HOST : origin === 'pinecone' ? PINECONE_HOST : 'api.pinecone.io'
    const headers: Record<string, string> = origin === 'supabase' ? { apikey: admin, ...(modern ? {} : { Authorization: `Bearer ${admin}` }) }
      : { 'Api-Key': pinecone, 'X-Pinecone-Api-Version': '2026-04' }
    if (body) { headers['Content-Type'] = contentType ?? 'application/json'; headers['Content-Length'] = String(body.length) }
    return new Promise<ResponseBytes>((resolve, reject) => {
      const req = httpsRequest({ hostname: host, port: 443, path, method, headers, rejectUnauthorized: true, agent: false }, response => {
        const status = response.statusCode ?? 0
        if (status >= 300 && status < 400) { response.destroy(); reject(new WebsitePublicationError('redirect_refused')); return }
        const chunks: Buffer[] = []; let size = 0
        response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1_000_000) { response.destroy(); reject(new WebsitePublicationError('response_too_large')) } else chunks.push(chunk) })
        response.on('end', () => resolve({ status, body: Buffer.concat(chunks) }))
        response.on('error', () => reject(new WebsitePublicationError('provider_unavailable')))
      })
      req.setTimeout(30000, () => { req.destroy(); reject(new WebsitePublicationError('provider_timeout')) })
      req.on('error', () => reject(new WebsitePublicationError('provider_unavailable')))
      if (body) req.write(body); req.end()
    })
  }
}
function responseJson(r: ResponseBytes): Row {
  need(r.status >= 200 && r.status < 300, `provider_http_${r.status}`)
  try { return obj(JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(r.body))) } catch { throw new WebsitePublicationError('provider_json_invalid') }
}
function missingObject(r: ResponseBytes) {
  if (r.status === 404) return true
  if (r.status !== 400 || r.body.length > 2048) return false
  try { const v = JSON.parse(r.body.toString('utf8')); return String(v.statusCode) === '404' && v.code === 'NoSuchKey' } catch { return false }
}
export function verifyVectorReadback(plan: WebsitePlan, result: Row) {
  need(result.namespace === NAMESPACE, 'vector_namespace_mismatch')
  const vectors = obj(result.vectors)
  same(Object.keys(vectors).sort(), plan.records.map(r => String(r._id)).sort(), 'vector_set_mismatch')
  for (const r of plan.records) {
    const v = obj(vectors[String(r._id)]); need(v.id === r._id && Array.isArray(v.values) && v.values.length === 1024
      && v.values.every(x => typeof x === 'number' && Number.isFinite(x)), 'vector_dimension_mismatch')
    same(v.metadata, Object.fromEntries(Object.entries(r).filter(([k]) => k !== '_id')), 'vector_metadata_mismatch')
  }
}
async function checkProviders(transport: Transport) {
  const bucket = responseJson(await transport('supabase', 'GET', `/storage/v1/bucket/${BUCKET}`))
  need(bucket.id === BUCKET && bucket.public === false && bucket.file_size_limit === 1_000_000, 'bucket_policy_mismatch')
  same(bucket.allowed_mime_types, ['application/octet-stream'])
  const index = responseJson(await transport('control', 'GET', '/indexes/neuvetra-ghg-dev')), embed = obj(index.embed)
  need(index.name === 'neuvetra-ghg-dev' && index.host === PINECONE_HOST && index.dimension === 1024 && index.metric === 'cosine'
    && obj(index.status).ready === true && embed.model === 'llama-text-embed-v2', 'index_profile_mismatch')
  same(embed.field_map, { text: 'text' }); same(embed.read_parameters, { dimension: 1024, input_type: 'query', truncate: 'NONE' })
  same(embed.write_parameters, { dimension: 1024, input_type: 'passage', truncate: 'NONE' })
  return { id: BUCKET, public: false, file_size_limit: 1_000_000, allowed_mime_types: ['application/octet-stream'] }
}
export interface PublicationInputs extends Inputs { objects: RawObjects; stageReceipt: Buffer; stageReceiptPin: string }
function publicationPreflight(input: PublicationInputs) {
  const plan = verifyOriginals(input, input.objects), stage = parse(input.stageReceipt, input.stageReceiptPin)
  same({ operation: stage.operation, status: stage.status, committed: stage.committed, project_ref: stage.project_ref, scope_id: stage.scope_id,
    target_sha256: stage.target_sha256, release_sha256: stage.release_sha256, plan_sha256: stage.plan_sha256, manifest_sha256: stage.manifest_sha256,
    stage_rows: stage.stage_rows, approvals_written: stage.approvals_written, activations: stage.activations },
  { operation: 'stage_website_epa', status: 'completed', committed: true, project_ref: PROJECT_REF, scope_id: SCOPE, target_sha256: input.targetPin,
    release_sha256: input.releasePin, plan_sha256: planSha(plan), manifest_sha256: plan.manifest_sha256, stage_rows: 25, approvals_written: 0, activations: 0 }, 'stage_not_verified')
  return plan
}
async function publication(input: PublicationInputs, transport: Transport, journal: Journal, write: boolean) {
  // Own copies prevent a caller from replacing mutable Buffer content after
  // the final preflight while an earlier provider request is awaiting I/O.
  const frozen: PublicationInputs = { ...input, release: Buffer.from(input.release), target: Buffer.from(input.target),
    stageReceipt: Buffer.from(input.stageReceipt), objects: { source: Buffer.from(input.objects.source),
      extraction: Buffer.from(input.objects.extraction), release: Buffer.from(input.objects.release) } }
  const plan = publicationPreflight(frozen)
  const report: Row = { operation: write ? 'publish_website_epa' : 'verify_website_epa', status: 'started', project_ref: PROJECT_REF,
    scope_id: SCOPE, build_id: BUILD, namespace: NAMESPACE, target_sha256: input.targetPin, release_sha256: input.releasePin,
    plan_sha256: planSha(plan), manifest_sha256: plan.manifest_sha256, approvals_written: 0, activated: false, phase: 'preflight', attempts: 0 }
  save(journal, report)
  const send: Transport = async (...args) => { report.attempts = Number(report.attempts) + 1; save(journal, report); return transport(...args) }
  try {
    report.bucket = await checkProviders(send); report.phase = 'objects'; save(journal, report)
    const receipts: Row[] = []
    for (const object of plan.stage.research_objects) {
      const key = String(object.object_key), get = `/storage/v1/object/authenticated/${BUCKET}/${key}`
      let response = await send('supabase', 'GET', get)
      if (write && missingObject(response)) {
        const put = await send('supabase', 'POST', `/storage/v1/object/${BUCKET}/${key}`, frozen.objects[object.kind as Kind], 'application/octet-stream')
        need(put.status >= 200 && put.status < 300, `provider_http_${put.status}`)
        response = await send('supabase', 'GET', get)
      }
      need(response.status >= 200 && response.status < 300 && response.body.length === object.byte_size && sha(response.body) === object.object_sha256, 'object_readback_mismatch')
      receipts.push(object); report.object_receipts = receipts; save(journal, report)
    }
    if (write) {
      report.phase = 'upsert'; save(journal, report)
      const body = Buffer.from(plan.records.map(r => JSON.stringify(r)).join('\n') + '\n')
      const result = await send('pinecone', 'POST', `/records/namespaces/${NAMESPACE}/upsert`, body, 'application/x-ndjson')
      need(result.status >= 200 && result.status < 300, `provider_http_${result.status}`)
      report.status = 'uploaded_readiness_pending'; report.vectors_upserted = 18
    } else {
      report.phase = 'fetch_vectors'; save(journal, report)
      const result = responseJson(await send('pinecone', 'GET', `/vectors/fetch?namespace=${NAMESPACE}${plan.records.map(r => `&ids=${r._id}`).join('')}`))
      verifyVectorReadback(plan, result)
      report.status = 'verified'; report.vector_receipt = { namespace: NAMESPACE, vectors_verified: 18, profile_sha256: PROFILE_SHA }
    }
    report.phase = 'complete'; report.finished_at = new Date().toISOString(); save(journal, report); return report
  } catch (error) {
    report.status = 'failed_or_outcome_unconfirmed'; report.error = error instanceof WebsitePublicationError ? error.code : 'publication_failed'
    try { save(journal, report) } catch { report.error = 'journal_failed' }
    return report
  }
}
export const publishWebsite = (input: PublicationInputs, transport: Transport, journal: Journal) => publication(input, transport, journal, true)
export const verifyWebsitePublication = (input: PublicationInputs, transport: Transport, journal: Journal) => publication(input, transport, journal, false)

export interface ActivationInputs extends Inputs { publicationReceipt: Buffer; publicationPin: string; identityReceipt: Buffer; identityPin: string }
export async function activateWebsite(input: ActivationInputs, factory: () => Client) {
  const { plan } = preflight(input), receipt = parse(input.publicationReceipt, input.publicationPin), identity = parse(input.identityReceipt, input.identityPin)
  need(receipt.operation === 'verify_website_epa' && receipt.status === 'verified' && receipt.phase === 'complete'
    && receipt.activated === false && receipt.approvals_written === 0, 'publication_not_verified')
  for (const [k, v] of Object.entries({ project_ref: PROJECT_REF, scope_id: SCOPE, build_id: BUILD, namespace: NAMESPACE,
    target_sha256: input.targetPin, release_sha256: input.releasePin, plan_sha256: planSha(plan), manifest_sha256: plan.manifest_sha256 })) same(receipt[k], v)
  same(receipt.object_receipts, plan.stage.research_objects)
  same(receipt.bucket, { id: BUCKET, public: false, file_size_limit: 1_000_000, allowed_mime_types: ['application/octet-stream'] })
  same(receipt.vector_receipt, { namespace: NAMESPACE, vectors_verified: 18, profile_sha256: PROFILE_SHA })
  const finished = Date.parse(String(receipt.finished_at))
  need(Number.isFinite(finished) && finished <= input.now && finished >= input.now - 30 * 60000, 'publication_receipt_stale')
  need(identity.project_ref === PROJECT_REF && identity.run_id === RUN_ID && identity.scope_id === SCOPE && identity.email === READER_EMAIL
    && identity.status === 'signed_in' && typeof identity.auth_user_id === 'string' && UUID.test(identity.auth_user_id)
    && typeof identity.expires_at === 'number' && identity.expires_at * 1000 > input.now, 'identity_not_verified')
  return transaction(factory, async (db, position) => {
    await lockAndCheckEmpty(db); await compareProjection(db, plan.stage, position)
    position.stage = 'known_auth_identity'; position.table = 'auth.users'
    const users = await db.unsafe('SELECT id,email,role,email_confirmed_at,raw_app_meta_data FROM auth.users WHERE id=$1::uuid FOR SHARE', [identity.auth_user_id])
    need(users.length === 1 && users[0]!.id === identity.auth_user_id && users[0]!.email === READER_EMAIL
      && users[0]!.role === 'authenticated' && !!users[0]!.email_confirmed_at, 'identity_not_verified')
    const app = obj(users[0]!.raw_app_meta_data)
    need(app.run_marker === RUN_ID && app.scope_id === SCOPE && app.kind === 'private_research_reader', 'identity_not_verified')
    position.stage = 'insert_membership'; position.table = 'research_memberships'
    await db.unsafe(`INSERT INTO ${SCHEMA}.research_memberships(scope_id,user_id) VALUES ($1::uuid,$2::uuid)`, [SCOPE, identity.auth_user_id])
    for (const [table, field, before, after, count] of [['research_sources', 'review_status', 'pending', 'approved', 1],
      ['research_passages', 'review_status', 'pending', 'approved', 18], ['research_releases', 'status', 'candidate', 'approved', 1],
      ['research_ingestion_runs', 'state', 'staged', 'verified', 1]] as const) {
      position.stage = 'approved_epa_projection'; position.table = table
      const changed = await db.unsafe(`UPDATE ${SCHEMA}.${table} SET ${field}='${after}' WHERE scope_id=$1::uuid AND ${field}='${before}' RETURNING scope_id`, [SCOPE])
      need(changed.length === count, 'approval_count_mismatch')
    }
    position.stage = 'activate_rpc'; position.table = 'research_active_builds'
    await db.unsafe(`SELECT ${SCHEMA}.activate_research_build($1::uuid,$2::uuid,$3::text)`, [SCOPE, BUILD, plan.manifest_sha256])
    const active = await db.unsafe(`SELECT scope_id,release_sha256,build_id FROM ${SCHEMA}.research_active_builds WHERE scope_id=$1::uuid`, [SCOPE])
    same(active, [{ scope_id: SCOPE, release_sha256: input.releasePin, build_id: BUILD }])
    return { operation: 'activate_website_epa', status: 'completed', committed: true, scope_id: SCOPE, build_id: BUILD,
      release_sha256: input.releasePin, target_sha256: input.targetPin, plan_sha256: planSha(plan), memberships_inserted: 1,
      passages_approved: 18, builds_activated: 1, commercial_runtime_approval: false }
  })
}
