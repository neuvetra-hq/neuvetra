import { describe, expect, test } from 'bun:test'
import { hash } from '../research-passages/release'
import type { Passage, PassageRelease } from '../research-passages/types'
import { CloudError, createCloudRepository, PINECONE_HOST, PROFILE, PROFILE_SHA256, PROJECT_HOST, RESEARCH_SCOPE, TOP_K } from './repository'
import type { CloudRepositoryConfig, CloudTarget } from './types'

const NOW = Date.parse('2026-09-09T06:00:00Z')
const USER = '90000000-0000-4000-8000-000000000001'
const BUILD = '90000000-0000-4000-8000-000000000002'
const SOURCE = '%PDF-1.7\nSynthetic original only.\n%%EOF'
const PAGE = 'Synthetic 🌍 context. Grid source paragraph. Required condition paragraph. Supplier source paragraph.'
const JWT = (role = 'authenticated', sub = USER) => `header.${Buffer.from(JSON.stringify({ role, sub, aud: 'authenticated', iss: `https://${PROJECT_HOST}/auth/v1`, exp: NOW / 1000 + 3600 })).toString('base64url')}.synthetic-signature`
const part = (id: string, text: string, dependencies: string[] = []): Passage => ({
  id, source_id: 'epa-fixture', extraction_id: 'extraction', title: `Synthetic ${id}`, coverage: [`concept-${id}`], text, sha256: hash(text), locator: `Synthetic PDF page 1, ${id}`,
  locator_detail: { normalization: 'nfkc_whitespace_v1', spans: [{ pdf_page_1_based: 1, printed_page: '1', context_start: Array.from(PAGE.slice(0, PAGE.indexOf(text))).length,
    context_end_exclusive: Array.from(PAGE.slice(0, PAGE.indexOf(text) + text.length)).length, normalized_page_sha256: hash(PAGE), context_sha256: hash(text) }] },
  required_passage_ids: dependencies, qualifications: id === 'B' ? ['Synthetic mandatory condition.'] : [], exclusions: [], review_status: 'approved', rights_scope: 'approved_internal_research_evaluation_only',
})
function fixture(mutate?: (release: PassageRelease) => void, secondOriginal?: string) {
  const extraction = JSON.stringify({ source_sha256: hash(SOURCE), normalization: 'nfkc_whitespace_v1', pages: [{ pdf_page_1_based: 1, text: PAGE }] })
  const release: PassageRelease = {
    schema_version: 2, release_id: 'scope2-website', version: '1', status: 'approved', commercial_runtime_approval: false,
    scope: { jurisdictions: ['US'], allowed_actions: ['conceptual_research'], exclusions: ['No calculations or legal determinations.'] },
    review: { author: 'synthetic-author', reviewer: 'synthetic-reviewer', reviewed_at: '2026-09-09T05:00:00Z', expires_at: '2026-09-10T05:00:00Z', approved_passage_ids: ['A', 'B', 'C'] },
    sources: [{ id: 'epa-fixture', title: 'Synthetic original fixture', version: 'fixture-v1', status: 'published_guidance', canonical_url: 'https://www.epa.gov/synthetic-fixture', local_path: '/never-read-local-file', sha256: hash(SOURCE), bytes: Buffer.byteLength(SOURCE), review_status: 'approved', rights_review: 'approved', rights_scope: 'approved_internal_research_evaluation_only' }],
    extractions: [{ id: 'extraction', source_id: 'epa-fixture', source_sha256: hash(SOURCE), local_path: '/never-read-extraction', sha256: hash(extraction), format: 'normalized_pages_json_v1', normalization: 'nfkc_whitespace_v1', tool: { name: 'synthetic', version: '1' } }],
    passages: [part('A', 'Grid source paragraph.', ['B']), part('B', 'Required condition paragraph.'), part('C', 'Supplier source paragraph.')],
  }
  const secondExtraction = secondOriginal === undefined ? undefined : JSON.stringify({ source_sha256: hash(secondOriginal), normalization: 'nfkc_whitespace_v1', pages: [{ pdf_page_1_based: 77, text: PAGE }] })
  if (secondOriginal !== undefined && secondExtraction !== undefined) {
    release.sources.push({ ...release.sources[0], id: 'ghgp-fixture', title: 'Second synthetic original', canonical_url: 'https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf', sha256: hash(secondOriginal), bytes: Buffer.byteLength(secondOriginal) })
    release.extractions.push({ ...release.extractions[0], id: 'second-extraction', source_id: 'ghgp-fixture', source_sha256: hash(secondOriginal), sha256: hash(secondExtraction) })
    const extra = part('D', 'Supplier source paragraph.')
    extra.source_id = 'ghgp-fixture'; extra.extraction_id = 'second-extraction'; extra.locator_detail.spans[0].pdf_page_1_based = 77
    release.passages.push(extra); release.review.approved_passage_ids.push('D')
  }
  mutate?.(release)
  const releaseBytes = JSON.stringify(release), releaseSha = hash(releaseBytes), scope_id = RESEARCH_SCOPE
  const target: CloudTarget = { supabaseHost: PROJECT_HOST, schema: 'neuvetra_research_dev', bucket: 'neuvetra-research-dev', pineconeHost: PINECONE_HOST, pineconeIndex: 'neuvetra-ghg-dev', scopeId: scope_id,
    buildId: BUILD, namespace: `nv-${BUILD.replaceAll('-', '')}`, releaseSha256: releaseSha, profileSha256: PROFILE_SHA256, expectedReaderUserId: USER, reviewExpiresAt: '2026-09-10T05:00:00Z' }
  const objects = [{ kind: 'source', suffix: 'source.pdf', bytes: SOURCE }, { kind: 'extraction', suffix: 'extraction.json', bytes: extraction }, { kind: 'release', suffix: 'release.json', bytes: releaseBytes }]
  if (secondOriginal !== undefined && secondExtraction !== undefined) objects.push({ kind: 'source', suffix: 'source.pdf', bytes: secondOriginal }, { kind: 'extraction', suffix: 'extraction.json', bytes: secondExtraction })
  const bytes = new Map(objects.map(o => [`${scope_id}/sha256/${hash(o.bytes)}/${o.suffix}`, o.bytes]))
  const bind = { scope_id, release_sha256: releaseSha, build_id: BUILD }
  const tables: Record<string, Record<string, unknown>[]> = {
    research_memberships: [{ scope_id, user_id: USER }],
    research_active_builds: [{ ...bind }],
    research_releases: [{ ...bind, profile_sha256: PROFILE_SHA256, namespace: target.namespace, status: 'approved', version: release.version, review_expires_at: release.review.expires_at, commercial_runtime_approval: false }],
    research_objects: objects.map(o => ({ scope_id, object_sha256: hash(o.bytes), kind: o.kind, byte_size: Buffer.byteLength(o.bytes), bucket: target.bucket, object_key: `${scope_id}/sha256/${hash(o.bytes)}/${o.suffix}` })),
    research_sources: release.sources.map(s => ({ scope_id, source_sha256: s.sha256, source_id: s.id, title: s.title, canonical_url: s.canonical_url, version: s.version, review_status: 'approved' })),
    research_passages: release.passages.map(p => ({ ...bind, passage_id: p.id, vector_id: hash(scope_id + releaseSha + p.id), source_sha256: release.sources.find(s => s.id === p.source_id)!.sha256, extraction_sha256: release.extractions.find(e => e.id === p.extraction_id)!.sha256,
      text: p.text, text_sha256: p.sha256, locator: p.locator, spans: p.locator_detail.spans, dependency_ids: p.required_passage_ids, qualifications: p.qualifications, review_status: 'approved', is_active: true })),
  }
  let user: Record<string, unknown> = { id: USER, role: 'authenticated' }
  let index: Record<string, unknown> = { name: target.pineconeIndex, host: target.pineconeHost, status: { ready: true }, dimension: 1024, metric: 'cosine', embed: { model: PROFILE.model, field_map: PROFILE.field_map, read_parameters: PROFILE.read_parameters, write_parameters: PROFILE.write_parameters } }
  let hits: unknown[] = [{ _id: hash(scope_id + releaseSha + 'A'), _score: 0.01, fields: { passage_id: 'A', scope_id, release_sha256: releaseSha, profile_sha256: PROFILE_SHA256, is_active: true, text_sha256: release.passages[0].sha256, text: 'UNTRUSTED VECTOR PROSE' } }]
  const calls: { url: URL; init: RequestInit }[] = []
  const fetcher: NonNullable<CloudRepositoryConfig['fetch']> = async (url, init) => {
    const parsed = new URL(url); calls.push({ url: parsed, init })
    if (parsed.hostname === 'api.pinecone.io') return Response.json(index)
    if (parsed.hostname === PINECONE_HOST) return Response.json({ result: { hits } })
    if (parsed.pathname === '/auth/v1/user') return Response.json(user)
    if (parsed.pathname.startsWith('/rest/v1/')) return Response.json(tables[parsed.pathname.split('/').at(-1)!])
    const key = parsed.pathname.split(`/authenticated/${target.bucket}/`)[1]
    return bytes.has(key!) ? new Response(bytes.get(key!)!) : new Response(null, { status: 404 })
  }
  const config: CloudRepositoryConfig = { target, supabasePublishableKey: 'sb_publishable_synthetic_0123456789', pineconeApiKey: 'synthetic-pinecone-key', readerJwt: JWT(), now: () => NOW, fetch: fetcher }
  return { config, release, tables, bytes, calls, fetcher, setUser: (value: Record<string, unknown>) => { user = value }, setIndex: (value: Record<string, unknown>) => { index = value }, setHits: (value: unknown[]) => { hits = value }, getHits: () => structuredClone(hits) }
}
const signal = () => new AbortController().signal

describe('authenticated complete cloud corpus with semantic candidates', () => {
  test('verifies a larger second original and keeps each passage bound to its own source and extraction', async () => {
    const original = '%PDF-1.7\n' + 'synthetic large original\n'.repeat(145_000)
    const f = fixture(undefined, original), repo = createCloudRepository(f.config)
    const loaded = await repo.loadForQuestion('Compare two supported sources', signal())
    expect(loaded.verified.passages).toHaveLength(4)
    expect(loaded.binding.sourceSha256).toEqual([hash(SOURCE), hash(original)].sort())
    expect(f.calls.filter(c => c.url.pathname.endsWith('source.pdf'))).toHaveLength(2)
    f.tables.research_passages[3]!.source_sha256 = hash(SOURCE)
    await expect(repo.recheck(loaded.binding, signal())).rejects.toThrow('cloud_metadata_invalid')
  })
  test('larger-source support does not waive rights, publisher identity or streaming size bounds', async () => {
    for (const mutate of [
      (r: PassageRelease) => { r.sources[1].rights_review = 'pending' },
      (r: PassageRelease) => { r.sources[1].canonical_url = 'https://ghgprotocol.org.attacker.example/sites/default/files/2023-03/Scope%202%20Guidance.pdf' },
      (r: PassageRelease) => { r.sources[1].canonical_url += '?unreviewed=1' },
    ]) {
      const f = fixture(mutate, '%PDF second source')
      await expect(createCloudRepository(f.config).loadForQuestion('question', signal())).rejects.toThrow('cloud_source_unavailable')
      expect(f.calls.some(c => c.url.pathname.endsWith('source.pdf'))).toBe(false)
    }
    const f = fixture(undefined, '%PDF second source')
    const secondKey = [...f.bytes.keys()].find(key => key.includes(hash('%PDF second source')))!
    const repo = createCloudRepository({ ...f.config, fetch: async (url, init) => url.endsWith(secondKey)
      ? new Response('x'.repeat(5_000_001)) : f.fetcher(url, init) })
    await expect(repo.loadForQuestion('question', signal())).rejects.toThrow('cloud_response_too_large')
    expect(f.calls.some(c => c.url.hostname === PINECONE_HOST)).toBe(false)
  })
  test('verifies cloud bytes and Unicode spans, retaining whole catalog and dependencies despite low-scoring single hit', async () => {
    const f = fixture(), repo = createCloudRepository(f.config), answer = await repo.loadForQuestion('A conceptual paraphrase without catalog vocabulary', signal())
    expect(answer.candidateIds).toEqual(['A'])
    expect(answer.verified.passages.map(p => p.id)).toEqual(['A', 'B', 'C'])
    expect(answer.verified.passages[1].qualifications).toEqual(['Synthetic mandatory condition.'])
    expect(JSON.stringify(answer)).not.toContain('UNTRUSTED VECTOR PROSE')
    expect(answer.binding).toMatchObject({ scopeId: RESEARCH_SCOPE, releaseSha256: f.config.target.releaseSha256, profileSha256: PROFILE_SHA256, sourceSha256: [hash(SOURCE)] })
    expect(f.calls[0].url.pathname).toBe('/auth/v1/user')
    const search = f.calls.find(c => c.url.hostname === PINECONE_HOST)!
    const body = JSON.parse(String(search.init.body))
    expect(body.query.top_k).toBe(TOP_K)
    expect(body.query.filter).toEqual({ scope_id: { $eq: RESEARCH_SCOPE }, release_sha256: { $eq: f.config.target.releaseSha256 }, profile_sha256: { $eq: PROFILE_SHA256 }, is_active: { $eq: true } })
    expect(f.calls.every(c => c.init.redirect === 'error' && c.init.signal instanceof AbortSignal)).toBe(true)
    for (const call of f.calls) {
      const headers = call.init.headers as Record<string, string>
      if (call.url.hostname === PROJECT_HOST) { expect(headers.apikey).toBe(f.config.supabasePublishableKey); expect(headers['Api-Key']).toBeUndefined() }
      else { expect(headers.Authorization).toBeUndefined(); expect(headers.apikey).toBeUndefined() }
      expect(call.init.method).toBe(call.url.hostname === PINECONE_HOST ? 'POST' : 'GET')
    }
  })
  test('pins hosts/scope/profile and refuses administrative reader credentials before network', async () => {
    for (const target of [{ supabaseHost: 'attacker.example' }, { pineconeHost: 'another.svc.project.pinecone.io' }, { scopeId: RESEARCH_SCOPE.replace('00c', '00a') }, { profileSha256: 'a'.repeat(64) }]) {
      const f = fixture(); expect(() => createCloudRepository({ ...f.config, target: { ...f.config.target, ...target } })).toThrow('cloud_configuration_invalid'); expect(f.calls).toHaveLength(0)
    }
    const f = fixture(); expect(() => createCloudRepository({ ...f.config, supabasePublishableKey: 'sb_secret_synthetic' })).toThrow('cloud_configuration_invalid')
    await expect(createCloudRepository({ ...f.config, readerJwt: JWT('service_role') }).loadForQuestion('question', signal())).rejects.toThrow('cloud_unauthorized')
    expect(f.calls).toHaveLength(0)
  })
  test('remote identity and single scoped membership precede search or original downloads', async () => {
    for (const mutate of [(f: ReturnType<typeof fixture>) => f.setUser({ id: 'other', role: 'authenticated' }), (f: ReturnType<typeof fixture>) => { f.tables.research_memberships = [] }, (f: ReturnType<typeof fixture>) => { f.tables.research_memberships.push({ scope_id: 'other', user_id: USER }) }]) {
      const f = fixture(); mutate(f)
      await expect(createCloudRepository(f.config).loadForQuestion('question', signal())).rejects.toBeInstanceOf(CloudError)
      expect(f.calls.some(c => c.url.hostname !== PROJECT_HOST || c.url.pathname.startsWith('/storage'))).toBe(false)
    }
  })
  test('changed active build, withdrawn release and expired approval fail before search', async () => {
    for (const mutate of [(f: ReturnType<typeof fixture>) => { f.tables.research_active_builds[0]!.build_id = USER }, (f: ReturnType<typeof fixture>) => { f.tables.research_releases[0]!.status = 'withdrawn' }, (f: ReturnType<typeof fixture>) => { f.tables.research_releases[0]!.review_expires_at = '2000-01-01T00:00:00Z' }]) {
      const f = fixture(); mutate(f)
      await expect(createCloudRepository(f.config).loadForQuestion('question', signal())).rejects.toBeInstanceOf(CloudError)
      expect(f.calls.some(c => c.url.hostname === PINECONE_HOST)).toBe(false)
    }
  })
  test('tampered source, extraction or release bytes cannot become model evidence', async () => {
    for (const suffix of ['source.pdf', 'extraction.json', 'release.json']) {
      const f = fixture(), key = [...f.bytes.keys()].find(k => k.endsWith(suffix))!
      f.bytes.set(key, f.bytes.get(key)! + 'tampered')
      await expect(createCloudRepository(f.config).loadForQuestion('question', signal())).rejects.toThrow('cloud_source_unavailable')
      expect(f.calls.some(c => c.url.hostname === PINECONE_HOST)).toBe(false)
    }
  })
  test('repinning does not excuse broken source spans, missing dependencies, unapproved rights or source URL', async () => {
    for (const mutate of [(r: PassageRelease) => { r.passages[0].locator_detail.spans[0].context_start++ }, (r: PassageRelease) => { r.passages[0].required_passage_ids = ['MISSING'] }, (r: PassageRelease) => { r.sources[0].rights_review = 'pending' }, (r: PassageRelease) => { r.sources[0].canonical_url = 'https://attacker.example/file' }]) {
      const f = fixture(mutate)
      await expect(createCloudRepository(f.config).loadForQuestion('question', signal())).rejects.toBeInstanceOf(CloudError)
      expect(f.calls.some(c => c.url.hostname === PINECONE_HOST)).toBe(false)
    }
  })
  test('metadata substitutions and missing/inactive context fail against immutable release', async () => {
    for (const mutate of [(f: ReturnType<typeof fixture>) => { f.tables.research_passages[1]!.is_active = false }, (f: ReturnType<typeof fixture>) => { f.tables.research_passages[1]!.qualifications = [] }, (f: ReturnType<typeof fixture>) => { f.tables.research_passages.pop() }, (f: ReturnType<typeof fixture>) => { f.tables.research_sources[0]!.title = 'replacement title' }, (f: ReturnType<typeof fixture>) => { f.tables.research_objects[0]!.object_key = '//attacker/source.pdf' }]) {
      const f = fixture(); mutate(f)
      await expect(createCloudRepository(f.config).loadForQuestion('question', signal())).rejects.toBeInstanceOf(CloudError)
      expect(f.calls.some(c => c.url.hostname === PINECONE_HOST)).toBe(false)
    }
  })
  test('foreign, duplicate, unknown and hash-mismatched vector hits are withheld without relaxing filters', async () => {
    type MutableHit = { fields: Record<string, unknown> }
    const mutations = [(hits: MutableHit[]) => { hits[0].fields.scope_id = 'foreign' }, (hits: MutableHit[]) => { hits.push(hits[0]) }, (hits: MutableHit[]) => { hits[0].fields.passage_id = 'unknown' }, (hits: MutableHit[]) => { hits[0].fields.text_sha256 = 'b'.repeat(64) }]
    for (const mutate of mutations) {
      const f = fixture(), hits = f.getHits() as MutableHit[]; mutate(hits); f.setHits(hits)
      await expect(createCloudRepository(f.config).loadForQuestion('question', signal())).rejects.toThrow('cloud_search_invalid')
      expect(f.calls.filter(c => c.url.hostname === PINECONE_HOST)).toHaveLength(1)
    }
    const f = fixture(); f.setHits([])
    await expect(createCloudRepository(f.config).loadForQuestion('question', signal())).rejects.toThrow('cloud_no_candidates')
  })
  test('wrong integrated profile and unknown provider errors are sanitized', async () => {
    const f = fixture(); f.setIndex({ name: f.config.target.pineconeIndex })
    await expect(createCloudRepository(f.config).loadForQuestion('question', signal())).rejects.toThrow('cloud_profile_invalid')
    const repo = createCloudRepository({ ...fixture().config, fetch: async () => { throw new Error('synthetic-private-token-url') } })
    try { await repo.loadForQuestion('question', signal()); throw new Error('should reject') }
    catch (error) { expect(String(error)).toBe('Error: cloud_provider_unavailable'); expect(String(error)).not.toContain('private-token') }
  })
  test('cancellation and oversized transport bodies stop without retries or fallback', async () => {
    const f = fixture(), cancelled = new AbortController(); cancelled.abort()
    await expect(createCloudRepository(f.config).loadForQuestion('question', cancelled.signal)).rejects.toThrow('cloud_cancelled')
    expect(f.calls).toHaveLength(0)
    const repo = createCloudRepository({ ...f.config, fetch: async () => new Response('x'.repeat(32_001)) })
    await expect(repo.loadForQuestion('question', signal())).rejects.toThrow('cloud_response_too_large')
    const controller = new AbortController()
    const afterAuth = createCloudRepository({ ...f.config, fetch: async (url, init) => { const response = await f.fetcher(url, init); controller.abort(); return response } })
    await expect(afterAuth.loadForQuestion('question', controller.signal)).rejects.toThrow('cloud_cancelled')
    expect(f.calls).toHaveLength(1)
  })
  test('final recheck obtains fresh token and rejects lost membership, withdrawal and changed bytes', async () => {
    for (const mutate of [(f: ReturnType<typeof fixture>) => { f.tables.research_memberships = [] }, (f: ReturnType<typeof fixture>) => { f.tables.research_sources[0]!.review_status = 'withdrawn' }, (f: ReturnType<typeof fixture>) => { const key = [...f.bytes.keys()].find(k => k.endsWith('source.pdf'))!; f.bytes.set(key, 'changed') }]) {
      const f = fixture(); let tokens = 0
      const repo = createCloudRepository({ ...f.config, readerJwt: async () => { tokens++; return JWT() } })
      const loaded = await repo.loadForQuestion('question', signal()); mutate(f)
      await expect(repo.recheck(loaded.binding, signal())).rejects.toBeInstanceOf(CloudError)
      expect(tokens).toBe(2)
      expect(f.calls.filter(c => c.url.hostname === PINECONE_HOST)).toHaveLength(1)
    }
    const f = fixture(), repo = createCloudRepository(f.config), loaded = await repo.loadForQuestion('question', signal())
    await repo.recheck(loaded.binding, signal())
    expect(f.calls.filter(c => c.url.pathname === '/auth/v1/user')).toHaveLength(2)
  })
  test('shorter resource authorization expires before network and during an answer independently of source review', async () => {
    const f = fixture()
    expect(() => createCloudRepository({ ...f.config, target: { ...f.config.target, reviewExpiresAt: '2000-01-01T00:00:00Z' } })).toThrow('cloud_source_stale')
    expect(f.calls).toHaveLength(0)
    let current = NOW
    const repo = createCloudRepository({ ...f.config, target: { ...f.config.target, reviewExpiresAt: new Date(NOW + 120_000).toISOString() }, now: () => current })
    const loaded = await repo.loadForQuestion('question', signal()), before = f.calls.length
    current = NOW + 120_001
    await expect(repo.recheck(loaded.binding, signal())).rejects.toThrow('cloud_source_stale')
    expect(f.calls).toHaveLength(before)
    current = NOW
    const during = createCloudRepository({ ...f.config, target: { ...f.config.target, reviewExpiresAt: new Date(NOW + 1000).toISOString() }, now: () => current,
      fetch: async (url, init) => { const response = await f.fetcher(url, init); current = NOW + 1001; return response } })
    await expect(during.loadForQuestion('question', signal())).rejects.toThrow('cloud_source_stale')
    expect(f.calls).toHaveLength(before + 1)
  })
})
