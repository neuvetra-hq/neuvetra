import { test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { COLUMNS, type Client } from './apply-development'
import { INVENTORY_QUERIES, PROJECT_REF } from './database-inventory'
import { prepareWebsitePlan, preflight, stageWebsite, activateWebsite, applyWebsiteScopeMigration, createWebsiteTransport,
  publishWebsite, verifyVectorReadback, journalSnapshot, sha, planSha, SCOPE, BUILD, NAMESPACE, BUCKET, SUPABASE_HOST, PINECONE_HOST,
  PROFILE_SHA, MIGRATION_SHA, RUN_ID, READER_EMAIL, type Inputs, type ActivationInputs } from './website-publication'

const now = Date.parse('2026-09-09T07:00:00Z')
const release = readFileSync(new URL('../../data/research/releases/scope2-website.v1.json', import.meta.url))
const json = (v: unknown) => Buffer.from(JSON.stringify(v))
type Row = Record<string, unknown>
function inputs(): Inputs {
  const releasePin = sha(release), plan = prepareWebsitePlan(release, releasePin, now)
  const target = json({ status: 'approved_private_research', approved_by: 'offline-test-reviewer', approved_at: '2026-09-09T06:59:00Z',
    review_expires_at: '2026-09-15T23:20:32Z', project_ref: PROJECT_REF, scope_id: SCOPE, build_id: BUILD, namespace: NAMESPACE,
    release_sha256: releasePin, profile_sha256: PROFILE_SHA, plan_sha256: planSha(plan), bucket: BUCKET,
    supabase_host: SUPABASE_HOST, pinecone_host: PINECONE_HOST, pinecone_index: 'neuvetra-ghg-dev' })
  return { release, releasePin, target, targetPin: sha(target), now }
}
function mock(options: { failInsert?: number; mismatch?: boolean; active?: boolean; badTls?: boolean; auth?: Row } = {}) {
  const input = inputs(), plan = preflight(input).plan, calls: { sql: string; args: unknown[] }[] = []
  let insert = 0, committed = false
  const unsafe = async (sql: string, args: unknown[] = []) => {
    calls.push({ sql, args })
    if (sql === INVENTORY_QUERIES.session) return [{ database: 'postgres', database_role: 'postgres', read_only: 'on', tls: !options.badTls }]
    if (sql === 'COMMIT') committed = true
    if (sql.startsWith('INSERT INTO') && !sql.includes('research_memberships')) {
      insert++; if (insert === options.failInsert) throw Object.assign(new Error('DO NOT LOG PRIVATE DATABASE DETAIL'), { code: '22023' })
    }
    if (sql.includes('count(*)::int AS count')) {
      const table = sql.match(/FROM neuvetra_research_dev\.(\w+)/)?.[1]
      return [{ count: table === 'research_memberships' || table === 'research_active_builds' ? (options.active ? 1 : 0)
        : plan.stage[table as keyof typeof COLUMNS].length }]
    }
    if (sql.includes('AS matching')) return [{ matching: options.mismatch ? 0 : 1 }]
    if (sql.includes('FROM auth.users')) return options.auth ? [options.auth] : []
    if (sql.startsWith('UPDATE')) return Array.from({ length: sql.includes('research_passages') ? 18 : 1 }, () => ({ scope_id: SCOPE }))
    if (sql.startsWith('SELECT scope_id,release_sha256,build_id')) return [{ scope_id: SCOPE, release_sha256: input.releasePin, build_id: BUILD }]
    return []
  }
  let factories = 0
  const factory = () => { factories++; return { reserve: async () => ({ unsafe, release: async () => {} }), end: async () => {} } as unknown as Client }
  return { factory, calls, factories: () => factories, committed: () => committed }
}
function activation(): ActivationInputs {
  const input = inputs(), plan = preflight(input).plan
  const publicationReceipt = json({ operation: 'verify_website_epa', status: 'verified', phase: 'complete', activated: false, approvals_written: 0,
    project_ref: PROJECT_REF, scope_id: SCOPE, build_id: BUILD, namespace: NAMESPACE, target_sha256: input.targetPin,
    release_sha256: input.releasePin, plan_sha256: planSha(plan), manifest_sha256: plan.manifest_sha256,
    object_receipts: plan.stage.research_objects, bucket: { id: BUCKET, public: false, file_size_limit: 1000000, allowed_mime_types: ['application/octet-stream'] },
    vector_receipt: { namespace: NAMESPACE, vectors_verified: 18, profile_sha256: PROFILE_SHA }, finished_at: '2026-09-09T06:59:00Z' })
  const identityReceipt = json({ project_ref: PROJECT_REF, run_id: RUN_ID, scope_id: SCOPE, email: READER_EMAIL, status: 'signed_in',
    auth_user_id: '70000000-0000-4000-8000-000000000001', expires_at: now / 1000 + 3600 })
  return { ...input, publicationReceipt, publicationPin: sha(publicationReceipt), identityReceipt, identityPin: sha(identityReceipt) }
}
test('approved real plan has25rows,18source-exact records, true EPA identity and pending database states', () => {
  const p = preflight(inputs()).plan
  expect(Object.values(p.stage).reduce((n, rows) => n + rows.length, 0)).toBe(25)
  expect(p.stage.research_scopes).toEqual([{ scope_id: SCOPE, label: 'reviewed-epa-private', is_synthetic: false }])
  expect(p.records.length).toBe(18); expect(p.stage.research_sources[0]!.version).toBe('December 2023')
  expect(p.stage.research_objects[0]!.object_key).toEndWith('/source.pdf')
  expect(p.stage.research_passages.every(r => r.review_status === 'pending')).toBe(true)
  expect(p.stage.research_ingestion_runs[0]!.state).toBe('staged')
  expect(p.stage.research_passages.find(p => p.passage_id === 'S12')!.dependency_ids).toEqual(['S11', 'S15'])
})
test('unapproved hosted processing, wrong release and expired target fail before database factory', async () => {
  for (const mode of ['hosted', 'release', 'expired', 'scope', 'plan']) {
    const i = inputs(); const r = JSON.parse(i.release.toString()), t = JSON.parse(i.target.toString())
    if (mode === 'hosted') r.hosted_processing.review_status = 'pending'
    if (mode === 'release') r.status = 'candidate'
    if (mode === 'expired') t.review_expires_at = '2026-09-09T06:00:00Z'
    if (mode === 'scope') t.scope_id = '90000000-0000-4000-8000-00000000000a'
    if (mode === 'plan') t.plan_sha256 = '0'.repeat(64)
    i.release = json(r); i.releasePin = sha(i.release); i.target = json(t); i.targetPin = sha(i.target)
    const db = mock(); await expect(stageWebsite(i, db.factory)).rejects.toBeInstanceOf(Error); expect(db.factories()).toBe(0)
  }
})
test('staging binds fixedscopeonly andJSON as text before jsonb; neither approval norAuth/pointer writes', async () => {
  const db = mock(); const result = await stageWebsite(inputs(), db.factory)
  expect(result.stage_rows).toBe(25); expect(db.committed()).toBe(true)
  const inserts = db.calls.filter(c => c.sql.startsWith('INSERT'))
  expect(inserts.length).toBe(25); expect(inserts.every(c => c.args[0] === SCOPE)).toBe(true)
  const passage = inserts.find(c => c.sql.includes('research_passages'))!
  expect(passage.sql).toContain('::text::jsonb'); expect(JSON.parse(String(passage.args[10]))).toBeInstanceOf(Array)
  expect(db.calls.some(c => /UPDATE|FROM auth.users|INSERT INTO neuvetra_research_dev.research_memberships/.test(c.sql))).toBe(false)
})
test('identical stage rerun compares all25existing rows and refuses conflicting rows', async () => {
  const ok = mock(); await stageWebsite(inputs(), ok.factory)
  expect(ok.calls.filter(c => c.sql.includes('AS matching')).length).toBe(25)
  const bad = mock({ mismatch: true }); await expect(stageWebsite(inputs(), bad.factory)).rejects.toThrow('projection_row_mismatch')
  expect(bad.committed()).toBe(false); expect(bad.calls.at(-1)!.sql).toBe('ROLLBACK')
})
test('second insert failure rolls back with only fixedSQLSTATE/stage diagnostic', async () => {
  const db = mock({ failInsert: 2 })
  try { await stageWebsite(inputs(), db.factory); throw Error('expected refusal') } catch (e) {
    expect(JSON.stringify(e)).not.toContain('PRIVATE'); expect(JSON.stringify(e)).toContain('22023')
  }
  expect(db.committed()).toBe(false); expect(db.calls.at(-1)!.sql).toBe('ROLLBACK')
})
test('existing pointer or missingbackendTLS refuses beforeINSERT', async () => {
  for (const options of [{ active: true }, { badTls: true }]) {
    const db = mock(options); await expect(stageWebsite(inputs(), db.factory)).rejects.toBeInstanceOf(Error)
    expect(db.calls.some(c => c.sql.startsWith('INSERT'))).toBe(false)
  }
})
test('publication refuses wrongoriginalbytes beforeanytransportorjournal call', async () => {
  let calls = 0
  await expect(publishWebsite({ ...inputs(), objects: { source: Buffer.from('not the PDF'), extraction: Buffer.from('{}'), release },
    stageReceipt: Buffer.from('{}'), stageReceiptPin: sha('{}') }, async () => { calls++; throw Error() }, () => { calls++ })).rejects.toThrow('source_hash_mismatch')
  expect(calls).toBe(0)
})
test('journal rejects unfinished async writes and isolates synchronous snapshots', () => {
  let nextOperation = false
  const run = () => { journalSnapshot(async () => { throw new Error('PRIVATE JOURNAL DETAIL') }, { phase: 'before-provider' }); nextOperation = true }
  expect(run).toThrow('journal_must_be_synchronous'); expect(nextOperation).toBe(false)
  const state = { phase: 'prepared' }
  journalSnapshot(value => { value.phase = 'mutated' }, state)
  expect(state.phase).toBe('prepared')
})
test('exact18vector verification rejects foreignnamespace/missingID/badprofile/nonfinitevalue', () => {
  const p = preflight(inputs()).plan
  const valid = { namespace: NAMESPACE, vectors: Object.fromEntries(p.records.map(r => [r._id, { id: r._id, values: Array(1024).fill(0.25), metadata: Object.fromEntries(Object.entries(r).filter(([k]) => k !== '_id')) }])) }
  expect(() => verifyVectorReadback(p, valid)).not.toThrow()
  for (const mode of ['namespace', 'missing', 'profile', 'finite']) {
    const result = structuredClone(valid)
    if (mode === 'namespace') result.namespace = 'another-namespace'
    const first = String(p.records[0]!._id)
    if (mode === 'missing') delete result.vectors[first]
    if (mode === 'profile') result.vectors[first]!.metadata.profile_sha256 = '0'.repeat(64)
    if (mode === 'finite') result.vectors[first]!.values[0] = Infinity
    expect(() => verifyVectorReadback(p, result)).toThrow()
  }
})
test('transport refuses arbitraryorigin/paths/writes beforecredentialattachment ornetwork', async () => {
  const send = createWebsiteTransport(inputs(), { supabaseAdminKey: 'sb_secret_offline_test_value_12345', pineconeApiKey: 'offline' })
  for (const [origin, method, path] of [['supabase', 'POST', '/auth/v1/admin/users'], ['supabase', 'GET', '//other-host/'],
    ['supabase', 'POST', `/storage/v1/object/${BUCKET}/90000000-0000-4000-8000-00000000000a/sha256/${'0'.repeat(64)}/source.pdf`],
    ['pinecone', 'POST', '/records/namespaces/default/upsert'], ['control', 'POST', '/indexes/neuvetra-ghg-dev']] as const) {
    await expect(send(origin, method, path)).rejects.toThrow('destination_refused')
  }
  await expect(send('pinecone', 'POST', `/records/namespaces/${NAMESPACE}/upsert`, Buffer.from('unapproved'), 'application/x-ndjson')).rejects.toThrow('request_body_refused')
  const object = preflight(inputs()).plan.stage.research_objects[0]!
  await expect(send('supabase', 'POST', `/storage/v1/object/${BUCKET}/${object.object_key}`, Buffer.from('unapproved'), 'application/octet-stream')).rejects.toThrow('request_body_refused')
})
test('activation refuses incomplete publication oridentity mismatches beforefactory', async () => {
  for (const mode of ['publication', 'objects', 'identity']) {
    const i = activation()
    if (mode === 'identity') { const d = JSON.parse(i.identityReceipt.toString()); d.scope_id = 'other'; i.identityReceipt = json(d); i.identityPin = sha(i.identityReceipt) }
    else { const d = JSON.parse(i.publicationReceipt.toString()); if (mode === 'publication') d.status = 'uploaded_readiness_pending'; else d.object_receipts.pop()
      i.publicationReceipt = json(d); i.publicationPin = sha(i.publicationReceipt) }
    const db = mock(); await expect(activateWebsite(i, db.factory)).rejects.toBeInstanceOf(Error); expect(db.factories()).toBe(0)
  }
})
test('activation compares25rows then onlyknownAuthID andscopeC membership/approval/RPC', async () => {
  const i = activation(), id = JSON.parse(i.identityReceipt.toString())
  const db = mock({ auth: { id: id.auth_user_id, email: READER_EMAIL, role: 'authenticated', email_confirmed_at: '2026-09-09T06:00:00Z',
    raw_app_meta_data: { scope_id: SCOPE, run_marker: RUN_ID, kind: 'private_research_reader' } } })
  const result = await activateWebsite(i, db.factory)
  expect(result.passages_approved).toBe(18); expect(result.builds_activated).toBe(1)
  expect(db.calls.filter(c => c.sql.includes('FROM auth.users')).length).toBe(1)
  for (const c of db.calls.filter(c => c.sql.startsWith('UPDATE') || c.sql.includes('activate_research_build') || c.sql.startsWith('INSERT'))) expect(c.args[0]).toBe(SCOPE)
  expect(db.committed()).toBe(true)
})
test('migration exactpin preservesfulltransaction andonlyscope/objectchecks; wrongpin zerofactory', async () => {
  const bytes = readFileSync(new URL('../../infra/cloud/003-reviewed-epa-scope.sql', import.meta.url))
  expect(sha(bytes)).toBe(MIGRATION_SHA)
  const sql = bytes.toString(); expect(sql).toContain('source.pdf'); expect(sql).toContain("ELSE 'source.txt'")
  expect(sql).not.toMatch(/\b(?:GRANT|REVOKE|CREATE POLICY|DROP POLICY|INSERT INTO|UPDATE neuvetra_research_dev)\b/)
  const bad = mock(); await expect(applyWebsiteScopeMigration(Buffer.from('SELECT 1'), sha('SELECT 1'), bad.factory)).rejects.toThrow('migration_pin_mismatch'); expect(bad.factories()).toBe(0)
  const good = mock(); await applyWebsiteScopeMigration(bytes, MIGRATION_SHA, good.factory)
  expect(good.calls.filter(c => c.sql.endsWith(sql)).length).toBe(1)
})
