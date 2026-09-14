import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { activateSynthetic, prepareActivation, ActivationError, type ActivationInputs } from './activate-synthetic'
import { COLUMNS, sha256, type Client } from './apply-development'

const root = new URL('../../evaluations/cloud-integration/', import.meta.url)
const target = readFileSync(new URL('resource-target.synthetic-01.json', root))
const stage = readFileSync(new URL('stage.synthetic-01.json', root))
const targetJson = JSON.parse(target.toString()), stageJson = JSON.parse(stage.toString())
const NOW = Date.parse('2026-09-09T06:30:00Z')
const SCOPE_IDS = Object.keys(targetJson.builds).sort()
const USER_IDS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']

function inputs(): ActivationInputs {
  const publication = Buffer.from(JSON.stringify({ operation: 'verify_synthetic_publication', status: 'verified', phase: 'complete', readiness_verified: true, activated: false, approvals_written: 0,
    project_ref: 'icockcoguyadhryzydvl', target_sha256: sha256(target), stage_sha256: sha256(stage), fixture_sha256: targetJson.fixture_sha256,
    adapter_sha256: '3ca78f070155d66be9565a7e9ca76b6cac9b6622c0aeacbfa1137226601dd23b', review_expires_at: targetJson.review_expires_at,
    finished_at: new Date(NOW - 60000).toISOString(), bucket: { id: 'neuvetra-research-dev', public: false, file_size_limit: 1000000, allowed_mime_types: ['application/octet-stream'] },
    object_receipts: stageJson.research_objects,
    vector_receipts: SCOPE_IDS.map(scope_id => ({ ...targetJson.builds[scope_id], scope_id, vectors_verified: true, activated: false })) }))
  const identities = Buffer.from(JSON.stringify({ project_ref: 'icockcoguyadhryzydvl', run_id: targetJson.run_prefix, status: 'complete', attempts: 4,
    identities: SCOPE_IDS.map((scope_id, index) => ({ scope_id, email: `${targetJson.run_prefix}-${index === 0 ? 'a' : 'b'}@neuvetra.invalid`, auth_user_id: USER_IDS[index], phase: 'signed_in', expires_at: NOW / 1000 + 3600 })) }))
  return { target, stage, publication, publicationPin: sha256(publication), identities, identitiesPin: sha256(identities), now: NOW }
}

function mock(options: { mismatch?: boolean; wrongAuth?: boolean; existingMembership?: boolean; failMembership?: boolean; failCommit?: boolean; tls?: boolean } = {}) {
  const calls: { query: string; parameters?: unknown[] }[] = []
  let reserves = 0, ended = false
  const users = JSON.parse(inputs().identities.toString()).identities
  const client: Client = { reserve: async () => { reserves++; return { unsafe: async (query, parameters) => {
    calls.push({ query, parameters })
    if (query.startsWith('SELECT current_database')) return [{ database: 'postgres', database_role: 'postgres', read_only: 'on', tls: options.tls ?? true }]
    if (query.startsWith('SELECT count(*)::int AS count')) {
      const table = query.match(/FROM neuvetra_research_dev\.([a-z_]+)/)![1]!
      return [{ count: table === 'research_memberships' ? options.existingMembership ? 1 : 0 : stageJson[table]?.length ?? 0 }]
    }
    if (query.startsWith('SELECT count(*)::int AS matching')) return [{ matching: options.mismatch && query.includes('research_passages') ? 0 : 1 }]
    if (query.startsWith('SELECT id, email, role')) {
      const user = users.find((u: any) => u.auth_user_id === parameters![0])
      return [{ id: user.auth_user_id, email: user.email, role: 'authenticated', email_confirmed_at: new Date(NOW), raw_app_meta_data: { neuvetra_synthetic: true, neuvetra_run_id: targetJson.run_prefix, neuvetra_scope_id: options.wrongAuth ? 'foreign' : user.scope_id } }]
    }
    if (query.startsWith('INSERT') && options.failMembership) throw Object.assign(new Error('private provider detail'), { code: '23503', detail: 'secret', query })
    if (query.startsWith('UPDATE')) {
      const table = query.match(/UPDATE neuvetra_research_dev\.([a-z_]+)/)![1]!
      return stageJson[table].map((r: any) => ({ scope_id: r.scope_id }))
    }
    if (query.startsWith('SELECT scope_id,release_sha256,build_id')) return SCOPE_IDS.map(scope_id => ({ scope_id, release_sha256: targetJson.builds[scope_id].release_sha256, build_id: targetJson.builds[scope_id].build_id }))
    if (query === 'COMMIT' && options.failCommit) throw Object.assign(new Error('private connection detail'), { code: '08006' })
    return []
  }, release: async () => {} } }, end: async () => { ended = true } }
  return { client, calls, state: () => ({ reserves, ended }) }
}

describe('reviewed synthetic receipt and identity gates', () => {
  test('actual frozen stage and publication shape accept hyphenated bucket and exact six-object/two-build receipts', () => {
    const prepared = prepareActivation(inputs())
    expect(prepared.stage.research_passages).toHaveLength(6)
    expect(prepared.users).toHaveLength(2)
  })
  test('wrong receipt bytes, object set, build, bucket, stale time and incomplete identities reject before factory', async () => {
    for (const change of [
      (r: any) => { r.status = 'failed_or_outcome_unconfirmed' },
      (r: any) => { r.object_receipts.pop() },
      (r: any) => { r.object_receipts[0].object_sha256 = 'a'.repeat(64) },
      (r: any) => { r.vector_receipts[0].scope_id = SCOPE_IDS[1] },
      (r: any) => { r.bucket.id = 'neuvetra_research_dev' },
      (r: any) => { r.bucket.public = true },
      (r: any) => { r.finished_at = new Date(NOW - 31 * 60000).toISOString() },
      (r: any) => { r.review_expires_at = '2099-01-01T00:00:00Z' },
    ]) {
      const x = inputs(), r = JSON.parse(x.publication.toString()); change(r); x.publication = Buffer.from(JSON.stringify(r)); x.publicationPin = sha256(x.publication)
      let factories = 0
      await expect(activateSynthetic(x, () => { factories++; return mock().client })).rejects.toThrow()
      expect(factories).toBe(0)
    }
    const x = inputs(); x.publicationPin = 'a'.repeat(64)
    expect(() => prepareActivation(x)).toThrow('artifact_pin_mismatch')
    const y = inputs(), u = JSON.parse(y.identities.toString()); u.identities[1].auth_user_id = u.identities[0].auth_user_id
    y.identities = Buffer.from(JSON.stringify(u)); y.identitiesPin = sha256(y.identities)
    expect(() => prepareActivation(y)).toThrow('duplicate_identity')
  })
})

describe('single scoped first-activation transaction', () => {
  test('full twenty-row comparison precedes all mutations; only known two Auth users are read', async () => {
    const m = mock(); const result = await activateSynthetic(inputs(), () => m.client)
    expect(result).toMatchObject({ committed: true, memberships_inserted: 2, synthetic_passages_approved: 6, builds_activated: 2, commercial_runtime_approval: false })
    const firstWrite = m.calls.findIndex(c => c.query.startsWith('INSERT'))
    const comparisons = m.calls.filter(c => c.query.startsWith('SELECT count(*)::int AS matching'))
    expect(comparisons).toHaveLength(20)
    expect(m.calls.slice(0, firstWrite).filter(c => c.query.startsWith('SELECT count(*)::int AS matching'))).toHaveLength(20)
    expect(m.calls.filter(c => c.query.startsWith('SELECT id, email, role')).map(c => c.parameters)).toEqual(USER_IDS.map(id => [id]))
    expect(m.calls.filter(c => c.query.includes('FROM auth.users')).every(c => c.query.endsWith('WHERE id = $1::uuid FOR SHARE'))).toBe(true)
    expect(m.calls.filter(c => c.query.includes('activate_research_build('))).toHaveLength(2)
    expect(m.calls.filter(c => c.query === 'COMMIT')).toHaveLength(1)
    expect(m.calls.filter(c => c.query.startsWith('INSERT'))).toHaveLength(2)
    expect(m.calls.filter(c => c.query.startsWith('UPDATE')).every(c => c.query.includes(`scope_id IN ('${SCOPE_IDS[0]}','${SCOPE_IDS[1]}')`))).toBe(true)
    for (const table of Object.keys(COLUMNS)) expect(m.calls.find(c => c.query.startsWith('LOCK TABLE'))!.query).toContain('neuvetra_research_dev.' + table)
    const passageCompare = comparisons.find(c => c.query.includes('research_passages'))!
    expect(passageCompare.query).toContain('$11::text::jsonb')
    expect(passageCompare.query).toContain('jsonb_array_elements_text($12::text::jsonb)')
    expect(m.state()).toEqual({ reserves: 1, ended: true })
  })
  test('projection drift, wrong real Auth metadata, prior membership and backend TLS block mutation', async () => {
    for (const options of [{ mismatch: true }, { wrongAuth: true }, { existingMembership: true }, { tls: false }]) {
      const m = mock(options)
      await expect(activateSynthetic(inputs(), () => m.client)).rejects.toThrow()
      expect(m.calls.some(c => /^(INSERT|UPDATE)/.test(c.query))).toBe(false)
      expect(m.calls.some(c => c.query === 'COMMIT')).toBe(false)
      expect(m.calls.at(-1)!.query).toBe('ROLLBACK')
    }
  })
  test('membership failure rolls back and reports no raw details or automatic retry', async () => {
    const m = mock({ failMembership: true }); let error: unknown
    try { await activateSynthetic(inputs(), () => m.client) } catch (caught) { error = caught }
    expect(error).toBeInstanceOf(ActivationError)
    expect((error as ActivationError).diagnostic).toEqual({ phase: 'insert_membership', table: 'research_memberships', row_index_0based: 0, sqlstate: '23503' })
    expect(String(error)).toBe('Error: activation_failed')
    expect(m.calls.filter(c => c.query.startsWith('INSERT'))).toHaveLength(1)
    expect(m.calls.some(c => c.query.startsWith('UPDATE') || c.query === 'COMMIT')).toBe(false)
    expect(m.calls.at(-1)!.query).toBe('ROLLBACK')
  })
  test('lost commit response throws unconfirmed outcome and never retries', async () => {
    const m = mock({ failCommit: true }); let error: unknown
    try { await activateSynthetic(inputs(), () => m.client) } catch (caught) { error = caught }
    expect((error as ActivationError).diagnostic).toMatchObject({ phase: 'commit', sqlstate: '08006' })
    expect(m.calls.filter(c => c.query === 'COMMIT')).toHaveLength(1)
    expect(m.calls.at(-1)!.query).toBe('ROLLBACK')
  })
})
