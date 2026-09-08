import { ReleaseError } from './release'
import { retrieve, routeQuestion, suspicious } from './retrieval'
import type { AnswerProvider, AnswerResponse, AnswerStatus, Proposition, VerifiedRelease } from './types'

const messages: Record<AnswerStatus, string> = {
  supported: 'These reviewed statements address the question within this limited research release.',
  qualified: 'These reviewed statements address the question with the qualifications shown below.',
  needs_input: 'A company-specific factor question needs location, reporting period and electricity-supply context. Factor selection itself is outside this concept preview.',
  needs_review: 'No answer was released because the request or model selection did not pass the evidence checks.',
  unsupported: 'This preview covers a small set of U.S. purchased-electricity concepts. This request needs evidence or functionality beyond the reviewed release; it does not calculate emissions or determine filing obligations.',
  stale_or_conflicting: 'This preview cannot resolve the requested version or status comparison. A reviewer must check the applicable published guidance and any draft or conflicting material before an answer is released.',
  unavailable: 'Research answering is unavailable. An approved evidence release and a configured model with remaining demo budget are required.',
}

type Candidate = { decision: 'answer' | 'needs_input' | 'unsupported' | 'stale_or_conflicting' | 'needs_review'; claims: { proposition_id: string; evidence_ids: string[] }[]; missing_context: string[] }
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const textList = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string') && new Set(value).size === value.length
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id))

export function validateCandidate(value: unknown, retrieved: Proposition[], requiredTopics: string[]): Candidate | null {
  if (!record(value) || !exactKeys(value, ['decision', 'claims', 'missing_context']) || !['answer', 'needs_input', 'unsupported', 'stale_or_conflicting', 'needs_review'].includes(String(value.decision)) || !Array.isArray(value.claims) || !textList(value.missing_context)) return null
  if (value.missing_context.some(item => !['location', 'reporting_period', 'electricity_supply'].includes(item))) return null
  const claims: Candidate['claims'] = []
  for (const claim of value.claims) {
    if (!record(claim) || !exactKeys(claim, ['proposition_id', 'evidence_ids']) || typeof claim.proposition_id !== 'string' || !textList(claim.evidence_ids)) return null
    const proposition = retrieved.find(item => item.id === claim.proposition_id)
    if (!proposition || !sameIds(claim.evidence_ids, proposition.evidence_ids) || claims.some(item => item.proposition_id === claim.proposition_id)) return null
    claims.push({ proposition_id: claim.proposition_id, evidence_ids: claim.evidence_ids })
  }
  if (value.decision === 'answer') {
    if (!claims.length || value.missing_context.length || requiredTopics.some(topic => !claims.some(claim => retrieved.find(item => item.id === claim.proposition_id)?.topic === topic))) return null
  } else if (claims.length || (value.decision === 'needs_input' ? !value.missing_context.length : value.missing_context.length > 0)) return null
  return { decision: value.decision as Candidate['decision'], claims, missing_context: value.missing_context }
}

export interface ResearchServiceOptions {
  loadRelease: () => Promise<VerifiedRelease>
  provider: AnswerProvider
}

export function createResearchService(options: ResearchServiceOptions) {
  const provider = () => ({ mode: options.provider.mode, model: options.provider.model })
  const result = (status: AnswerStatus, verified?: VerifiedRelease, missingContext: string[] = []): AnswerResponse => ({
    status, message: messages[status], claims: [], evidence: [], sources: [],
    release: verified ? { id: verified.release.release_id, version: verified.release.version, sha256: verified.sha256 } : null,
    provider: provider(), missing_context: missingContext,
  })
  return {
    async status() {
      let release: AnswerResponse['release'] = null
      try { const verified = await options.loadRelease(); release = { id: verified.release.release_id, version: verified.release.version, sha256: verified.sha256 } } catch { /* Safe status only; never disclose local paths. */ }
      const readiness = !release ? 'evidence_unavailable' : !options.provider.available() ? 'provider_unavailable' : 'ready'
      return { service: 'neuvetra-research-preview', readiness, message: readiness === 'ready' ? 'Local research preview is ready for questions within the reviewed release.' : messages.unavailable, provider: provider(), release, limits: options.provider.limits() }
    },
    async answer(question: string): Promise<AnswerResponse> {
      if (!question.trim() || question.length > 2000) return result('unsupported')
      const route = routeQuestion(question)
      if (route.status) return result(route.status, undefined, route.missingContext)
      let verified: VerifiedRelease
      try { verified = await options.loadRelease() } catch (error) { return result(error instanceof ReleaseError ? error.reason : 'unavailable') }
      const selected = retrieve(question, verified, route.topics)
      if (!selected.length) return result('unsupported', verified)
      const evidenceIds = new Set(selected.flatMap(item => item.evidence_ids))
      const evidence = verified.release.evidence.filter(span => evidenceIds.has(span.id))
      if ([...selected.flatMap(item => [item.text, ...item.qualifications, ...item.keywords]), ...evidence.flatMap(span => [span.excerpt, span.locator])].some(suspicious)) return result('needs_review', verified)
      if (!options.provider.available()) return result('unavailable', verified)
      let candidate: Candidate | null
      try { candidate = validateCandidate(await options.provider.select({ question, propositions: selected, evidence }), selected, route.topics) } catch { return result('unavailable', verified) }
      if (!candidate) return result('needs_review', verified)
      if (candidate.decision !== 'answer') return result(candidate.decision, verified, candidate.missing_context)
      // Revalidate both the pinned release and original bytes after model latency.
      // No stream, raw candidate prose, or cached fallback crosses this boundary.
      try { const current = await options.loadRelease(); if (current.sha256 !== verified.sha256) return result('unavailable') } catch (error) { return result(error instanceof ReleaseError ? error.reason : 'unavailable') }
      const ids = new Set(candidate.claims.map(item => item.proposition_id))
      const claims = selected.filter(item => ids.has(item.id)).map(({ id, text, qualifications, evidence_ids }) => ({ id, text, qualifications, evidence_ids }))
      const answer = result(claims.some(item => item.qualifications.length) ? 'qualified' : 'supported', verified)
      answer.claims = claims
      const finalEvidenceIds = new Set(claims.flatMap(item => item.evidence_ids))
      answer.evidence = evidence.filter(span => finalEvidenceIds.has(span.id)).map(({ id, source_id, locator, excerpt }) => ({ id, source_id, locator, excerpt }))
      const sourceIds = new Set(answer.evidence.map(span => span.source_id))
      answer.sources = verified.release.sources.filter(source => sourceIds.has(source.id)).map(({ id, title, version, status, canonical_url }) => ({ id, title, version, status, canonical_url }))
      return answer
    },
  }
}
