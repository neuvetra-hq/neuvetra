import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { Extraction, Passage, PassageRelease, PassageSource, PassageSpan, ReasonCode, VerifiedPassages } from './types'

export class PassageError extends Error {
  constructor(public readonly code: ReasonCode) { super(code) }
}
export const hash = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex')
export const normalizePage = (value: string): string => value.normalize('NFKC').replace(/\s+/gu, ' ').trim()
function fail(): never { throw new PassageError('source_unavailable') }
export const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const object = (v: unknown): Record<string, unknown> => record(v) ? v : fail()
const string = (v: unknown): string => typeof v === 'string' && v.trim() ? v : fail()
const nullable = (v: unknown): string | null => v === null ? null : string(v)
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : fail()
const strings = (v: unknown): string[] => array(v).map(string)
const integer = (v: unknown): number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : fail()
const digest = (v: unknown): string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v) ? v : fail()
const unique = (items: { id: string }[]) => { if (new Set(items.map(i => i.id)).size !== items.length) fail() }
const RIGHTS = 'approved_internal_research_evaluation_only'
const SCOPE2_GUIDANCE_URL = 'https://ghgprotocol.org/sites/default/files/2023-03/Scope%202%20Guidance.pdf'

export function parsePassageRelease(raw: unknown, now = Date.now()): PassageRelease {
  const value = object(raw), scope = object(value.scope), review = object(value.review)
  if (value.schema_version !== 2 || value.status !== 'approved' || value.commercial_runtime_approval !== false) fail()
  const release: PassageRelease = {
    schema_version: 2, release_id: string(value.release_id), version: string(value.version), status: 'approved', commercial_runtime_approval: false,
    scope: { jurisdictions: strings(scope.jurisdictions), allowed_actions: strings(scope.allowed_actions), exclusions: strings(scope.exclusions) },
    review: { author: string(review.author), reviewer: nullable(review.reviewer), reviewed_at: nullable(review.reviewed_at), expires_at: nullable(review.expires_at), approved_passage_ids: strings(review.approved_passage_ids) },
    sources: array(value.sources).map(raw => {
      const v = object(raw)
      const source: PassageSource = { id: string(v.id), title: string(v.title), version: string(v.version), status: string(v.status), canonical_url: string(v.canonical_url), local_path: string(v.local_path), sha256: digest(v.sha256), review_status: string(v.review_status), rights_review: string(v.rights_review), rights_scope: string(v.rights_scope) }
      if (v.bytes !== undefined) source.bytes = integer(v.bytes)
      const url = new URL(source.canonical_url)
      const allowedPublisher = ['www.epa.gov', 'epa.gov'].includes(url.hostname) || url.href === SCOPE2_GUIDANCE_URL
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowedPublisher) fail()
      return source
    }),
    extractions: array(value.extractions).map(raw => {
      const v = object(raw), tool = object(v.tool)
      if (v.format !== 'normalized_pages_json_v1' || v.normalization !== 'nfkc_whitespace_v1') fail()
      return { id: string(v.id), source_id: string(v.source_id), source_sha256: digest(v.source_sha256), local_path: string(v.local_path), sha256: digest(v.sha256), format: 'normalized_pages_json_v1', normalization: 'nfkc_whitespace_v1', tool: { name: string(tool.name), version: string(tool.version) } } satisfies Extraction
    }),
    passages: array(value.passages).map(raw => {
      const v = object(raw), detail = object(v.locator_detail)
      if (detail.normalization !== 'nfkc_whitespace_v1' || (detail.separator !== undefined && detail.separator !== '\n\n') || (detail.offset_unit !== undefined && detail.offset_unit !== 'unicode_code_points')) fail()
      const spans = array(detail.spans).map(raw => {
        const s = object(raw)
        return { pdf_page_1_based: integer(s.pdf_page_1_based), printed_page: string(s.printed_page), context_start: integer(s.context_start), context_end_exclusive: integer(s.context_end_exclusive), normalized_page_sha256: digest(s.normalized_page_sha256), context_sha256: digest(s.context_sha256) } satisfies PassageSpan
      })
      const passage: Passage = { id: string(v.id), source_id: string(v.source_id), extraction_id: string(v.extraction_id), title: string(v.title), coverage: strings(v.coverage), text: string(v.text), sha256: digest(v.sha256), locator: string(v.locator), locator_detail: { normalization: string(detail.normalization), spans }, required_passage_ids: strings(v.required_passage_ids), qualifications: strings(v.qualifications), exclusions: strings(v.exclusions), review_status: string(v.review_status), rights_scope: string(v.rights_scope) }
      if (!spans.length || !passage.coverage.length || passage.text.length > 12_000 || passage.sha256 !== hash(passage.text) || new Set(passage.required_passage_ids).size !== passage.required_passage_ids.length) fail()
      return passage
    }),
  }
  if (release.scope.jurisdictions.length !== 1 || release.scope.jurisdictions[0] !== 'US' || release.scope.allowed_actions.length !== 1 || release.scope.allowed_actions[0] !== 'conceptual_research') fail()
  const r = release.review
  if (!r.reviewer || r.author === r.reviewer || !r.reviewed_at || !r.expires_at) fail()
  const reviewed = Date.parse(string(r.reviewed_at)), expires = Date.parse(string(r.expires_at))
  if (!Number.isFinite(reviewed) || !Number.isFinite(expires) || reviewed > now || expires <= reviewed) fail()
  if (expires <= now) throw new PassageError('source_stale')
  unique(release.sources); unique(release.extractions); unique(release.passages)
  if (new Set(r.approved_passage_ids).size !== r.approved_passage_ids.length || !r.approved_passage_ids.length) fail()
  for (const passage of release.passages) {
    const source = release.sources.find(s => s.id === passage.source_id), extraction = release.extractions.find(e => e.id === passage.extraction_id)
    if (!source || !extraction || extraction.source_id !== source.id || extraction.source_sha256 !== source.sha256) fail()
    if (r.approved_passage_ids.includes(passage.id) && (passage.review_status !== 'approved' || passage.rights_scope !== RIGHTS || source.review_status !== 'approved' || source.rights_review !== 'approved' || source.rights_scope !== RIGHTS)) fail()
    if (r.approved_passage_ids.includes(passage.id) && source.status !== 'published_guidance') throw new PassageError('source_stale')
  }
  for (const id of r.approved_passage_ids) if (!release.passages.some(p => p.id === id)) fail()
  // Every approved context dependency must resolve to approved material. Reject
  // cycles so context closure is bounded and deterministic.
  const approved = release.passages.filter(p => r.approved_passage_ids.includes(p.id))
  for (const p of approved) dependencyClosure([p.id], approved, new Set())
  const versions = new Map<string, string>()
  for (const source of release.sources.filter(s => approved.some(p => p.source_id === s.id))) {
    const previous = versions.get(source.canonical_url)
    if (previous && previous !== `${source.version}:${source.sha256}`) throw new PassageError('source_stale')
    versions.set(source.canonical_url, `${source.version}:${source.sha256}`)
  }
  return release
}

export function dependencyClosure(ids: string[], available: Passage[], visiting = new Set<string>()): Passage[] {
  const included = new Set<string>()
  const visit = (id: string) => {
    if (visiting.has(id)) throw new PassageError('selection_invalid')
    if (included.has(id)) return
    const passage = available.find(p => p.id === id)
    if (!passage) throw new PassageError('selection_invalid')
    visiting.add(id)
    for (const dependency of passage.required_passage_ids) visit(dependency)
    visiting.delete(id); included.add(id)
  }
  ids.forEach(visit)
  return available.filter(p => included.has(p.id))
}

function localAbsolute(value: string): string {
  if (path.win32.parse(value.replaceAll('/', '\\')).root.startsWith('\\\\') || !path.isAbsolute(value) || value.includes('\0') || (process.platform === 'win32' && value.slice(2).includes(':'))) fail()
  return value
}
export interface PassageLoaderOptions { releasePath: string; expectedSha256: string; sourceRoots: string[]; now?: () => number }
export function createPassageLoader(options: PassageLoaderOptions): () => Promise<VerifiedPassages> {
  return async () => {
    try {
      digest(options.expectedSha256)
      const releasePath = localAbsolute(options.releasePath)
      if ((await stat(releasePath)).size > 1_000_000 || !options.sourceRoots.length) fail()
      const bytes = await readFile(releasePath)
      if (hash(bytes) !== options.expectedSha256) fail()
      const release = parsePassageRelease(JSON.parse(bytes.toString('utf8')), options.now?.())
      const roots = await Promise.all(options.sourceRoots.map(root => realpath(localAbsolute(root))))
      const verifiedRead = async (file: string, sha256: string, maxBytes: number, expectedBytes?: number) => {
        const resolved = await realpath(localAbsolute(file))
        if (!roots.some(root => { const relative = path.relative(root, resolved); return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) })) fail()
        const size = (await stat(resolved)).size
        if (size > maxBytes || (expectedBytes !== undefined && size !== expectedBytes)) fail()
        const data = await readFile(resolved)
        if (hash(data) !== sha256) fail()
        return data
      }
      const passages = release.passages.filter(p => release.review.approved_passage_ids.includes(p.id))
      for (const source of release.sources.filter(s => passages.some(p => p.source_id === s.id))) await verifiedRead(source.local_path, source.sha256, 30_000_000, source.bytes)
      for (const extraction of release.extractions.filter(e => passages.some(p => p.extraction_id === e.id))) {
        const artifact = object(JSON.parse((await verifiedRead(extraction.local_path, extraction.sha256, 2_000_000)).toString('utf8')))
        if (artifact.source_sha256 !== extraction.source_sha256 || artifact.normalization !== extraction.normalization) fail()
        const pages = array(artifact.pages).map(raw => { const p = object(raw); return { number: integer(p.pdf_page_1_based), text: string(p.text) } })
        if (new Set(pages.map(p => p.number)).size !== pages.length || pages.some(p => p.number < 1 || normalizePage(p.text) !== p.text)) fail()
        for (const passage of passages.filter(p => p.extraction_id === extraction.id)) {
          const parts = passage.locator_detail.spans.map(span => {
            const page = pages.find(p => p.number === span.pdf_page_1_based)
            if (!page || hash(page.text) !== span.normalized_page_sha256) return fail()
            const points = Array.from(page.text)
            if (span.context_end_exclusive <= span.context_start || span.context_end_exclusive > points.length) fail()
            const text = points.slice(span.context_start, span.context_end_exclusive).join('')
            if (hash(text) !== span.context_sha256) fail()
            return text
          })
          if (parts.join('\n\n') !== passage.text) fail()
        }
      }
      return { release, passages, sha256: options.expectedSha256 }
    } catch (error) {
      if (error instanceof PassageError) throw error
      throw new PassageError('source_unavailable')
    }
  }
}
