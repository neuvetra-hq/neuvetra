/** Read-only authenticated cloud evidence. No ENV, local source reads or I/O on import. */
import { dependencyClosure, hash, normalizePage, parsePassageRelease, PassageError, record } from '../research-passages/release'
import type { PassageRelease, VerifiedPassages } from '../research-passages/types'
import type { CloudBinding, CloudErrorCode, CloudEvidence, CloudRepository, CloudRepositoryConfig } from './types'

export const PROJECT_HOST = 'icockcoguyadhryzydvl.supabase.co'
export const PINECONE_HOST = 'neuvetra-ghg-dev-0msj1fa.svc.aped-4627-b74a.pinecone.io'
export const RESEARCH_SCOPE = '90000000-0000-4000-8000-00000000000c'
export const PROFILE_SHA256 = '756dd7589f918a257dad2fad38e3d8839c7d9c55a007885f0e1505f5528871f5'
export const PROFILE = { model: 'llama-text-embed-v2', dimension: 1024, metric: 'cosine', field_map: { text: 'text' },
  read_parameters: { input_type: 'query', dimension: 1024, truncate: 'NONE' },
  write_parameters: { input_type: 'passage', dimension: 1024, truncate: 'NONE' } } as const
export const TOP_K = 10
const MAX_BYTES = 1_000_000
// Metadata remains tightly bounded; approved original PDFs may be larger.
const MAX_SOURCE_BYTES = 5_000_000
const MAX_ROWS = 32
const HEX = /^[a-f0-9]{64}$/
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
type Row = Record<string, unknown>
export class CloudError extends Error { constructor(public readonly code: CloudErrorCode) { super(code) } }
const requireValue: (condition: unknown, code?: CloudErrorCode) => asserts condition = (condition, code = 'cloud_metadata_invalid') => { if (!condition) throw new CloudError(code) }
const json = (bytes: Uint8Array): unknown => { try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw new CloudError('cloud_metadata_invalid') } }
const equal = (left: unknown, right: unknown): boolean => {
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, i) => equal(value, right[i]))
  if (record(left) && record(right)) return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => Object.hasOwn(right, key) && equal(left[key], right[key]))
  return left === right
}
const dateValid = (value: unknown, now: number): boolean => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) > now
const checkAbort = (signal: AbortSignal) => { if (signal.aborted) throw new CloudError('cloud_cancelled') }

export function createCloudRepository(config: CloudRepositoryConfig): CloudRepository {
  // Copy configuration so callers cannot change destinations/pins after validation.
  const target = Object.freeze({ ...config.target })
  requireValue(target.supabaseHost === PROJECT_HOST && target.pineconeHost === PINECONE_HOST && target.pineconeIndex === 'neuvetra-ghg-dev'
    && target.schema === 'neuvetra_research_dev' && target.bucket === 'neuvetra-research-dev' && target.scopeId === RESEARCH_SCOPE
    && UUID.test(target.buildId) && UUID.test(target.expectedReaderUserId) && target.namespace === `nv-${target.buildId.replaceAll('-', '')}`
    && HEX.test(target.releaseSha256) && target.profileSha256 === PROFILE_SHA256
    && /^sb_publishable_[A-Za-z0-9_-]{16,300}$/.test(config.supabasePublishableKey)
    && typeof config.pineconeApiKey === 'string' && config.pineconeApiKey.length > 0 && !/[\r\n]/.test(config.pineconeApiKey)
    && (typeof config.readerJwt === 'string' || typeof config.readerJwt === 'function'), 'cloud_configuration_invalid')
  const publicKey = config.supabasePublishableKey, pineconeKey = config.pineconeApiKey, readerJwt = config.readerJwt
  const fetcher = config.fetch ?? fetch, now = config.now ?? Date.now
  requireValue(dateValid(target.reviewExpiresAt, now()), 'cloud_source_stale')
  const checkActive = (signal: AbortSignal) => { checkAbort(signal); requireValue(dateValid(target.reviewExpiresAt, now()), 'cloud_source_stale') }

  async function request(origin: 'supabase' | 'pinecone' | 'control', path: string, token: string, signal: AbortSignal, payload?: unknown, limit = MAX_BYTES) {
    checkActive(signal)
    const host = origin === 'supabase' ? target.supabaseHost : origin === 'pinecone' ? target.pineconeHost : 'api.pinecone.io'
    requireValue(path.startsWith('/') && !path.startsWith('//') && !/[\\#\r\n]/.test(path), 'cloud_configuration_invalid')
    const headers: Record<string, string> = origin === 'supabase'
      ? { apikey: publicKey, Authorization: `Bearer ${token}`, 'Accept-Profile': target.schema }
      : { 'Api-Key': pineconeKey, 'X-Pinecone-Api-Version': '2026-04' }
    const body = payload === undefined ? undefined : JSON.stringify(payload)
    if (body) { requireValue(new TextEncoder().encode(body).length <= 16_000, 'cloud_search_invalid'); headers['Content-Type'] = 'application/json' }
    try {
      const response = await fetcher(`https://${host}${path}`, { method: body ? 'POST' : 'GET', headers, body, redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) })
      checkActive(signal)
      if (!response.ok) { await response.body?.cancel(); throw new CloudError(response.status === 401 || response.status === 403 ? 'cloud_unauthorized' : 'cloud_provider_unavailable') }
      const declared = response.headers.get('content-length')
      if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) { await response.body?.cancel(); throw new CloudError('cloud_response_too_large') }
      requireValue(response.body, 'cloud_provider_unavailable')
      const reader = response.body.getReader(), chunks: Uint8Array[] = []
      let length = 0
      try {
        while (true) {
          checkActive(signal)
          const part = await reader.read()
          if (part.done) break
          length += part.value.byteLength
          requireValue(length <= limit, 'cloud_response_too_large')
          chunks.push(part.value)
        }
      } finally { await reader.cancel().catch(() => {}) }
      checkActive(signal)
      return new Uint8Array(Buffer.concat(chunks))
    } catch (error) {
      if (signal.aborted) throw new CloudError('cloud_cancelled')
      if (error instanceof CloudError) throw error
      throw new CloudError('cloud_provider_unavailable')
    }
  }
  async function table(name: string, filters: Record<string, string>, token: string, signal: AbortSignal): Promise<Row[]> {
    requireValue(['research_memberships', 'research_active_builds', 'research_releases', 'research_objects', 'research_sources', 'research_passages'].includes(name))
    const query = new URLSearchParams({ select: '*', limit: String(MAX_ROWS + 1), ...Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, `eq.${value}`])) })
    const data = json(await request('supabase', `/rest/v1/${name}?${query}`, token, signal))
    requireValue(Array.isArray(data) && data.length <= MAX_ROWS && data.every(record))
    requireValue(data.every(row => Object.entries(filters).every(([key, value]) => row[key] === value)))
    return data
  }
  async function one(name: string, filters: Record<string, string>, token: string, signal: AbortSignal, code: CloudErrorCode = 'cloud_metadata_invalid') {
    const found = await table(name, filters, token, signal)
    requireValue(found.length === 1, code)
    return found[0]!
  }
  async function identity(signal: AbortSignal): Promise<string> {
    checkActive(signal)
    let token: string
    try { token = typeof readerJwt === 'function' ? await readerJwt() : readerJwt } catch { throw new CloudError('cloud_identity_unavailable') }
    checkActive(signal)
    // Decoding is deny-only. The remote Auth request below verifies the token.
    try {
      requireValue(typeof token === 'string' && token.length < 16_000 && token.split('.').length === 3, 'cloud_unauthorized')
      const claims = json(Buffer.from(token.split('.')[1]!, 'base64url'))
      requireValue(record(claims) && claims.role === 'authenticated' && claims.sub === target.expectedReaderUserId
        && claims.iss === `https://${PROJECT_HOST}/auth/v1` && claims.aud === 'authenticated'
        && typeof claims.exp === 'number' && claims.exp * 1000 > now(), 'cloud_unauthorized')
    } catch { throw new CloudError('cloud_unauthorized') }
    const user = json(await request('supabase', '/auth/v1/user', token, signal, undefined, 32_000))
    requireValue(record(user) && user.id === target.expectedReaderUserId && user.role === 'authenticated', 'cloud_unauthorized')
    const memberships = await table('research_memberships', { user_id: target.expectedReaderUserId }, token, signal)
    requireValue(memberships.length === 1 && memberships[0]!.scope_id === target.scopeId, 'cloud_membership_invalid')
    return token
  }
  async function verifyIndex(token: string, signal: AbortSignal) {
    const data = json(await request('control', `/indexes/${target.pineconeIndex}`, token, signal, undefined, 128_000))
    requireValue(record(data) && data.name === target.pineconeIndex && data.host === target.pineconeHost && record(data.status) && data.status.ready === true
      && data.dimension === PROFILE.dimension && data.metric === PROFILE.metric && record(data.embed)
      && data.embed.model === PROFILE.model && equal(data.embed.field_map, PROFILE.field_map)
      && equal(data.embed.read_parameters, PROFILE.read_parameters) && equal(data.embed.write_parameters, PROFILE.write_parameters), 'cloud_profile_invalid')
  }
  async function load(signal: AbortSignal) {
    const token = await identity(signal)
    const bind = { scope_id: target.scopeId, release_sha256: target.releaseSha256, build_id: target.buildId }
    const pointer = await one('research_active_builds', { scope_id: target.scopeId }, token, signal, 'cloud_build_changed')
    requireValue(pointer.build_id === target.buildId && pointer.release_sha256 === target.releaseSha256, 'cloud_build_changed')
    const metadata = await one('research_releases', bind, token, signal, 'cloud_source_unavailable')
    requireValue(metadata.status === 'approved' && metadata.profile_sha256 === target.profileSha256 && metadata.namespace === target.namespace
      && metadata.commercial_runtime_approval === false, 'cloud_source_unavailable')
    requireValue(dateValid(metadata.review_expires_at, now()), 'cloud_source_stale')
    const [objects, sources, projected] = await Promise.all([
      table('research_objects', { scope_id: target.scopeId }, token, signal),
      table('research_sources', { scope_id: target.scopeId }, token, signal),
      table('research_passages', bind, token, signal),
    ])
    async function object(sha: string, kind: 'release' | 'source' | 'extraction', expectedBytes?: number) {
      const matches = objects.filter(row => row.object_sha256 === sha)
      requireValue(matches.length === 1, 'cloud_source_unavailable')
      const row = matches[0]!, suffix = kind === 'source' ? 'source.pdf' : `${kind}.json`
      const byteLimit = kind === 'source' ? MAX_SOURCE_BYTES : MAX_BYTES
      const key = `${target.scopeId}/sha256/${sha}/${suffix}`
      requireValue(HEX.test(sha) && row.kind === kind && row.bucket === target.bucket && row.object_key === key
        && typeof row.byte_size === 'number' && Number.isSafeInteger(row.byte_size) && row.byte_size > 0 && row.byte_size <= byteLimit
        && (expectedBytes === undefined || expectedBytes === row.byte_size), 'cloud_source_unavailable')
      const bytes = await request('supabase', `/storage/v1/object/authenticated/${target.bucket}/${key}`, token, signal, undefined, byteLimit)
      requireValue(bytes.length === row.byte_size && hash(bytes) === sha, 'cloud_source_unavailable')
      return bytes
    }
    let release: PassageRelease
    try { release = parsePassageRelease(json(await object(target.releaseSha256, 'release')), now()) }
    catch (error) {
      if (error instanceof CloudError) throw error
      throw new CloudError(error instanceof PassageError && error.code === 'source_stale' ? 'cloud_source_stale' : 'cloud_source_unavailable')
    }
    requireValue(release.release_id === 'scope2-website' && metadata.version === release.version
      && Date.parse(String(metadata.review_expires_at)) === Date.parse(release.review.expires_at!), 'cloud_source_unavailable')
    const passages = release.passages.filter(p => release.review.approved_passage_ids.includes(p.id))
    requireValue(passages.length > 0 && passages.length <= MAX_ROWS && release.sources.length <= 4 && release.extractions.length <= 4)
    requireValue(projected.length === passages.length && new Set(projected.map(row => row.passage_id)).size === projected.length)
    const activeSources = release.sources.filter(source => passages.some(p => p.source_id === source.id))
    await Promise.all(activeSources.map(async source => {
      const matches = sources.filter(row => row.source_sha256 === source.sha256)
      requireValue(matches.length === 1, 'cloud_source_unavailable')
      const row = matches[0]!
      requireValue(row.review_status === 'approved' && row.source_id === source.id && row.title === source.title
        && row.version === source.version && row.canonical_url === source.canonical_url, 'cloud_source_unavailable')
      await object(source.sha256, 'source', source.bytes)
    }))
    await Promise.all(release.extractions.filter(e => passages.some(p => p.extraction_id === e.id)).map(async extraction => {
      const artifact = json(await object(extraction.sha256, 'extraction'))
      requireValue(record(artifact) && artifact.source_sha256 === extraction.source_sha256 && artifact.normalization === extraction.normalization
        && Array.isArray(artifact.pages) && artifact.pages.length <= 100 && artifact.pages.every(record), 'cloud_source_unavailable')
      const pages = artifact.pages
      requireValue(new Set(pages.map(p => p.pdf_page_1_based)).size === pages.length && pages.every(p => Number.isSafeInteger(p.pdf_page_1_based) && Number(p.pdf_page_1_based) > 0 && typeof p.text === 'string' && normalizePage(p.text) === p.text), 'cloud_source_unavailable')
      for (const p of passages.filter(p => p.extraction_id === extraction.id)) {
        const parts = p.locator_detail.spans.map(span => {
          const page = pages.find(page => page.pdf_page_1_based === span.pdf_page_1_based)
          requireValue(page && typeof page.text === 'string' && hash(page.text) === span.normalized_page_sha256, 'cloud_source_unavailable')
          const points = Array.from(page.text)
          requireValue(span.context_end_exclusive > span.context_start && span.context_end_exclusive <= points.length, 'cloud_source_unavailable')
          const part = points.slice(span.context_start, span.context_end_exclusive).join('')
          requireValue(hash(part) === span.context_sha256, 'cloud_source_unavailable')
          return part
        })
        requireValue(parts.join('\n\n') === p.text, 'cloud_source_unavailable')
      }
    }))
    for (const p of passages) {
      const row = projected.find(row => row.passage_id === p.id)
      const source = activeSources.find(s => s.id === p.source_id)!, extraction = release.extractions.find(e => e.id === p.extraction_id)!
      requireValue(row && row.review_status === 'approved' && row.is_active === true && row.text === p.text && row.text_sha256 === p.sha256
        && row.source_sha256 === source.sha256 && row.extraction_sha256 === extraction.sha256 && row.locator === p.locator
        && equal(row.spans, p.locator_detail.spans) && equal(row.dependency_ids, p.required_passage_ids) && equal(row.qualifications, p.qualifications)
        && row.vector_id === hash(target.scopeId + target.releaseSha256 + p.id), 'cloud_metadata_invalid')
      dependencyClosure([p.id], passages)
    }
    await verifyIndex(token, signal)
    checkActive(signal)
    requireValue(dateValid(release.review.expires_at, now()) && dateValid(metadata.review_expires_at, now()), 'cloud_source_stale')
    const verified: VerifiedPassages = { release, passages, sha256: target.releaseSha256 }
    const binding: CloudBinding = { scopeId: target.scopeId, buildId: target.buildId, namespace: target.namespace,
      releaseId: release.release_id, releaseVersion: release.version, releaseSha256: target.releaseSha256,
      profileSha256: target.profileSha256, sourceSha256: activeSources.map(s => s.sha256).sort() }
    return { verified, binding, token }
  }
  return {
    async loadForQuestion(question, signal): Promise<CloudEvidence> {
      requireValue(typeof question === 'string' && question.trim() && question.length <= 2000, 'cloud_search_invalid')
      const { verified, binding, token } = await load(signal)
      const filter = { scope_id: { $eq: target.scopeId }, release_sha256: { $eq: target.releaseSha256 }, profile_sha256: { $eq: target.profileSha256 }, is_active: { $eq: true } }
      const result = json(await request('pinecone', `/records/namespaces/${target.namespace}/search`, token, signal,
        { query: { inputs: { text: question }, top_k: TOP_K, filter }, fields: ['passage_id', 'scope_id', 'release_sha256', 'profile_sha256', 'is_active', 'text_sha256'] }))
      requireValue(record(result) && record(result.result) && Array.isArray(result.result.hits) && result.result.hits.length <= TOP_K, 'cloud_search_invalid')
      const candidateIds: string[] = []
      for (const hit of result.result.hits) {
        requireValue(record(hit) && record(hit.fields), 'cloud_search_invalid')
        const fields = hit.fields, p = verified.passages.find(p => p.id === fields.passage_id)
        requireValue(p && !candidateIds.includes(p.id) && hit._id === hash(target.scopeId + target.releaseSha256 + p.id)
          && typeof hit._score === 'number' && Number.isFinite(hit._score) && fields.text_sha256 === p.sha256
          && Object.entries(filter).every(([key, value]) => fields[key] === value.$eq), 'cloud_search_invalid')
        candidateIds.push(p.id)
      }
      // Empty search has no hidden local fallback. The full cloud catalog is
      // retained for semantic completeness once at least one valid hit exists.
      requireValue(candidateIds.length, 'cloud_no_candidates')
      return { verified, binding, candidateIds }
    },
    async recheck(binding, signal) {
      requireValue(binding.scopeId === target.scopeId && binding.buildId === target.buildId && binding.releaseSha256 === target.releaseSha256
        && binding.profileSha256 === target.profileSha256 && binding.namespace === target.namespace, 'cloud_build_changed')
      const current = await load(signal)
      requireValue(equal(current.binding, binding), 'cloud_build_changed')
    },
  }
}
