import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { Evidence, Proposition, Release, Source, VerifiedRelease } from './types'

export class ReleaseError extends Error {
  constructor(public readonly reason: 'unavailable' | 'stale_or_conflicting') {
    super(reason)
  }
}

const fail = (): never => { throw new ReleaseError('unavailable') }
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  return value as Record<string, unknown>
}
const string = (value: unknown): string => typeof value === 'string' && value.trim().length > 0 ? value : fail()
const nullableString = (value: unknown): string | null => value === null ? null : string(value)
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : fail()
const strings = (value: unknown): string[] => list(value).map(string)
const unique = (items: { id: string }[]) => {
  if (new Set(items.map(item => item.id)).size !== items.length) fail()
}
const statuses = new Set(['published_guidance', 'published_standard', 'draft', 'superseded', 'withdrawn', 'announcement'])
const published = new Set(['published_guidance', 'published_standard'])

// These are review controls, not regulatory effective dates. The release hash
// must be pinned by the operator after independent review, outside this file.
export function parseRelease(value: unknown, now = Date.now()): Release {
  const data = object(value)
  const scope = object(data.scope)
  const review = object(data.review)
  if (data.schema_version !== 1 || data.status !== 'approved' || data.commercial_runtime_approval !== false) fail()
  const release: Release = {
    schema_version: 1, release_id: string(data.release_id), version: string(data.version), status: 'approved', commercial_runtime_approval: false,
    scope: { topics: strings(scope.topics), excluded: strings(scope.excluded) },
    review: { author: string(review.author), reviewer: nullableString(review.reviewer), reviewed_at: nullableString(review.reviewed_at), expires_at: nullableString(review.expires_at), approved_proposition_ids: strings(review.approved_proposition_ids) },
    sources: list(data.sources).map(value => {
      const source = object(value)
      const result: Source = {
        id: string(source.id), title: string(source.title), version: string(source.version), source_type: string(source.source_type),
        status: string(source.status), canonical_url: string(source.canonical_url), local_path: string(source.local_path), sha256: string(source.sha256),
        document_date: nullableString(source.document_date), rights_review: string(source.rights_review), rights_scope: string(source.rights_scope), review_status: string(source.review_status),
      }
      if (!statuses.has(result.status) || !/^[a-f0-9]{64}$/.test(result.sha256)) fail()
      const url = new URL(result.canonical_url)
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !['www.epa.gov', 'epa.gov', 'ghgprotocol.org', 'www.ghgprotocol.org', 'ww2.arb.ca.gov'].includes(url.hostname)) fail()
      return result
    }),
    evidence: list(data.evidence).map(value => {
      const span = object(value)
      const result: Evidence = { id: string(span.id), source_id: string(span.source_id), locator: string(span.locator), excerpt: string(span.excerpt), review_status: string(span.review_status) }
      if (result.excerpt.length > 4000 || result.locator.length > 500) fail()
      return result
    }),
    propositions: list(data.propositions).map(value => {
      const item = object(value)
      const result: Proposition = { id: string(item.id), text: string(item.text), evidence_ids: strings(item.evidence_ids), qualifications: strings(item.qualifications), keywords: strings(item.keywords), topic: string(item.topic) }
      if (!result.evidence_ids.length || !result.keywords.length || result.text.length > 3000 || new Set(result.evidence_ids).size !== result.evidence_ids.length) fail()
      return result
    }),
  }
  if (!release.review.reviewer || release.review.reviewer === release.review.author || !release.review.reviewed_at || !release.review.expires_at) fail()
  const reviewed = Date.parse(string(release.review.reviewed_at))
  const expires = Date.parse(string(release.review.expires_at))
  if (!Number.isFinite(reviewed) || !Number.isFinite(expires) || reviewed > now || expires <= reviewed) fail()
  if (expires <= now) throw new ReleaseError('stale_or_conflicting')
  unique(release.sources); unique(release.evidence); unique(release.propositions)
  if (release.review.approved_proposition_ids.some(id => !release.propositions.some(item => item.id === id))) fail()
  const sourceIds = new Set(release.sources.map(source => source.id))
  const evidenceIds = new Set(release.evidence.map(span => span.id))
  if (release.evidence.some(span => !sourceIds.has(span.source_id))) fail()
  if (release.propositions.some(item => !release.scope.topics.includes(item.topic) || item.evidence_ids.some(id => !evidenceIds.has(id)))) fail()
  const versions = new Map<string, string>()
  for (const source of release.sources.filter(item => item.review_status === 'approved' && item.rights_review === 'approved')) {
    if (source.rights_scope !== 'approved_internal_research_evaluation_only') fail()
    if (!published.has(source.status)) throw new ReleaseError('stale_or_conflicting')
    const prior = versions.get(source.canonical_url)
    if (prior && prior !== `${source.version}:${source.sha256}`) throw new ReleaseError('stale_or_conflicting')
    versions.set(source.canonical_url, `${source.version}:${source.sha256}`)
  }
  return release
}

export function eligiblePropositions(release: Release): Proposition[] {
  const sources = new Set(release.sources.filter(source => source.review_status === 'approved' && source.rights_review === 'approved' && published.has(source.status)).map(source => source.id))
  const evidence = new Set(release.evidence.filter(span => span.review_status === 'approved' && sources.has(span.source_id)).map(span => span.id))
  return release.propositions.filter(item => release.review.approved_proposition_ids.includes(item.id) && item.evidence_ids.every(id => evidence.has(id)))
}

function localAbsolute(value: string): string {
  // Reject UNC/device shares before any filesystem resolution, including mixed separators.
  const windows = path.win32.parse(value.replaceAll('/', '\\'))
  if (windows.root.startsWith('\\\\') || !path.isAbsolute(value) || value.includes('\0')) fail()
  if (process.platform === 'win32' && value.slice(2).includes(':')) fail()
  return value
}

export interface ReleaseLoaderOptions {
  releasePath: string
  expectedSha256: string
  sourceRoots: string[]
  now?: () => number
}

export function createReleaseLoader(options: ReleaseLoaderOptions): () => Promise<VerifiedRelease> {
  return async () => {
    try {
      if (!/^[a-f0-9]{64}$/.test(options.expectedSha256) || !options.sourceRoots.length) fail()
      const releasePath = localAbsolute(options.releasePath)
      if ((await stat(releasePath)).size > 512_000) fail()
      const bytes = await readFile(releasePath)
      const hash = createHash('sha256').update(bytes).digest('hex')
      if (hash !== options.expectedSha256) fail()
      const release = parseRelease(JSON.parse(bytes.toString('utf8')), options.now?.())
      const propositions = eligiblePropositions(release)
      if (!propositions.length) fail()
      const roots = await Promise.all(options.sourceRoots.map(root => realpath(localAbsolute(root))))
      // Re-read approved originals on every request. This is a local demo check,
      // not a race-proof content store or an automatic source review service.
      const eligibleEvidence = new Set(propositions.flatMap(item => item.evidence_ids))
      const sourceIds = new Set(release.evidence.filter(span => eligibleEvidence.has(span.id)).map(span => span.source_id))
      for (const source of release.sources.filter(item => sourceIds.has(item.id))) {
        const sourcePath = await realpath(localAbsolute(source.local_path))
        if (!roots.some(root => {
          const relative = path.relative(root, sourcePath)
          return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
        })) fail()
        if ((await stat(sourcePath)).size > 30_000_000) fail()
        if (createHash('sha256').update(await readFile(sourcePath)).digest('hex') !== source.sha256) fail()
      }
      return { release, sha256: hash, propositions }
    } catch (error) {
      if (error instanceof ReleaseError) throw error
      throw new ReleaseError('unavailable')
    }
  }
}
