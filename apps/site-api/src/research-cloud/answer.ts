import type { AnswerResponse, AnswerStatus } from '../research/types'
import { dependencyClosure, PassageError } from '../research-passages/release'
import { validatePlan } from '../research-passages/validation'
import { planningInput, evidenceInput } from '../research-passages/service'
import type { Stage } from '../research-passages/types'
import type { CloudRepository, CloudBinding } from './types'
import { mayCorrect, parseCloudDraft, parseCloudReview, type CloudClaim } from './answer-contract'
import type { CloudProvider } from './provider'
import { parseConditionCatalog, conditionsForClaim, ConditionLedgerError, type ConditionCatalog } from './condition-ledger'
import { analyzeDraftForRepair } from './draft-repair'

export type CloudAnswer = AnswerResponse & {
  answer_mode: 'cloud_passage_grounded'; reason_code: string
  retrieval: { mode: 'cloud'; store: 'Supabase'; search: 'Pinecone'; build_id: string; release_sha256: string; candidate_ids: string[]; selected_ids: string[]; checked_at: string } | null
  correction_attempted: boolean
  correction_kind: 'draft_contract' | 'source_review' | null
}
const failures: Record<string, { status: AnswerStatus; message: string }> = {
  condition_catalog_invalid: { status: 'unavailable', message: 'The source review checks could not be verified. No answer was displayed.' },
  coverage_missing: { status: 'unsupported', message: 'The reviewed sources do not yet cover every part of this question. Try a question about purchased-electricity methods, records or factor sources.' },
  action_out_of_scope: { status: 'unsupported', message: 'This private preview explains purchased-electricity guidance. Company-specific factor selection, calculations and legal filing decisions are still being developed.' },
  context_required: { status: 'needs_input', message: 'This depends on the facility, reporting period and electricity supply. The preview can explain the source requirements; selecting a company-specific factor is still outside its coverage.' },
  source_stale: { status: 'stale_or_conflicting', message: 'The source version or review status needs confirmation before this question can be answered.' },
  cloud_source_stale: { status: 'stale_or_conflicting', message: 'The evidence review has expired. A current review is needed before answering.' },
  support_not_verified: { status: 'needs_review', message: 'The draft did not pass its source-support and completeness checks. It has been withheld for review.' },
  draft_invalid: { status: 'needs_review', message: 'The draft or its source references did not pass validation. No draft was displayed.' },
  draft_empty: { status: 'needs_review', message: 'The retrieved evidence did not yield a complete supported answer. No draft was displayed.' },
  numeric_output_not_allowed: { status: 'needs_review', message: 'The draft included a quantitative claim that this conceptual preview cannot release.' },
  budget_exhausted: { status: 'unavailable', message: 'This private preview has reached its configured usage allowance. Its operator needs to allocate the next development run.' },
  request_in_progress: { status: 'unavailable', message: 'An answer is already being checked. Please wait for it to finish.' },
  request_cancelled: { status: 'unavailable', message: 'The request was cancelled before an answer was ready.' },
  request_timeout: { status: 'unavailable', message: 'The source checks took too long. No incomplete answer was displayed.' },
}
export function createCloudAnswerService(options: { repository: CloudRepository; provider: CloudProvider; conditionCatalog: unknown; deadlineMs?: number; now?: () => number }) {
  let inFlight = false, healthBinding: CloudBinding | undefined
  const now = options.now ?? Date.now
  const result = (code: string, binding?: CloudBinding): CloudAnswer => {
    const failure = failures[code] ?? { status: 'unavailable' as const, message: 'The cloud research service could not verify a complete answer. Please try again shortly.' }
    return { ...failure, reason_code: code, answer_mode: 'cloud_passage_grounded', claims: [], evidence: [], sources: [], missing_context: [], release: binding ? { id: binding.releaseId, version: binding.releaseVersion, sha256: binding.releaseSha256 } : null, provider: { mode: 'live', model: options.provider.model }, retrieval: null, correction_attempted: false, correction_kind: null }
  }
  const errorCode = (e: unknown) => e instanceof PassageError || e instanceof ConditionLedgerError ? e.code : e instanceof Error && 'code' in e && typeof e.code === 'string' && /^cloud_[a-z_]+$/.test(e.code) ? e.code : 'provider_failure'
  function reviewInput(context: ReturnType<typeof evidenceInput> & { facets: unknown }, claims: CloudClaim[], catalog: ConditionCatalog) {
    return { ...context, claims, claim_support: claims.map(c => ({ claim_id: c.id, passage_ids: c.passage_ids, required_conditions: conditionsForClaim(catalog, c), paragraphs: context.passages.filter(p => c.passage_ids.includes(p.id)) })) }
  }
  return {
    async initialize() {
      const loaded = await options.repository.loadForQuestion('U.S. purchased-electricity accounting methods and source records', AbortSignal.timeout(60000))
      parseConditionCatalog(options.conditionCatalog, loaded.verified)
      healthBinding = loaded.binding
    },
    async status() {
      let reason = 'none'
      try {
        if (!healthBinding) reason = 'cloud_source_unavailable'
        else await options.repository.recheck(healthBinding, AbortSignal.timeout(20000))
        if (reason === 'none' && options.provider.remaining() < 5) reason = 'budget_exhausted'
        if (reason === 'none' && inFlight) reason = 'request_in_progress'
      } catch (e) { reason = errorCode(e) }
      return { service: 'neuvetra-research-cloud', answer_mode: 'cloud_passage_grounded', readiness: reason === 'none' ? 'ready' : 'unavailable', reason_code: reason, data_connection: 'cloud', scope: 'private_internal_epa_concepts', remaining_stages: options.provider.remaining() }
    },
    async answer(question: string, callerSignal?: AbortSignal): Promise<CloudAnswer> {
      if (!question.trim() || question.length > 2000) return result('action_out_of_scope')
      if (callerSignal?.aborted) return result('request_cancelled')
      if (inFlight) return result('request_in_progress')
      if (options.provider.remaining() < 5) return result('budget_exhausted')
      inFlight = true
      const timeout = new AbortController(), timer = setTimeout(() => timeout.abort(), Math.min(240000, Math.max(1, options.deadlineMs ?? 240000)))
      const signal = callerSignal ? AbortSignal.any([timeout.signal, callerSignal]) : timeout.signal
      const cancelled = () => timeout.signal.aborted ? 'request_timeout' : 'request_cancelled'
      const check = () => { if (signal.aborted) throw new PassageError(timeout.signal.aborted ? 'request_timeout' : 'request_cancelled') }
      const call = async (stage: Stage, input: unknown) => { check(); const value = await options.provider.invoke(stage, input, signal); check(); return value }
      let binding: CloudBinding | undefined, correctionKind: CloudAnswer['correction_kind'] = null
      const work = (async () => {
        try {
          const cloud = await options.repository.loadForQuestion(question, signal); check()
          binding = cloud.binding
          const verified = cloud.verified
          const conditionCatalog = parseConditionCatalog(options.conditionCatalog, verified)
          const plan = validatePlan(await call('plan', { ...planningInput(question, verified), ranked_candidate_ids: cloud.candidateIds }), verified.passages)
          if (plan.facets.some(f => f.id === 'answer' || /^c\d+$/.test(f.id))) throw new PassageError('selection_invalid')
          if (plan.action !== 'conceptual_research') {
            if (['numeric_factor_selection', 'company_diagnosis'].includes(plan.action) && plan.decision === 'needs_input') {
              const answer = result('context_required', binding); answer.missing_context = plan.missing_context; return answer
            }
            return result('action_out_of_scope', binding)
          }
          if (plan.decision !== 'answer') return result(plan.decision === 'stale_or_conflicting' ? 'source_stale' : 'coverage_missing', binding)
          const selected = dependencyClosure(plan.passage_ids, verified.passages)
          const context = { ...evidenceInput(question, selected, verified), facets: plan.facets.map(f => ({ ...f, context_passage_ids: dependencyClosure(f.passage_ids, selected).map(p => p.id) })) }
          const draftContext = { ...context, source_conditions: conditionCatalog.conditions.filter(c => selected.some(p => p.id === c.passage_id)) }
          const versions = context.sources.flatMap(s => [s.title, s.version])
          const firstDraft = await call('draft', draftContext)
          let claims: CloudClaim[]
          try { claims = parseCloudDraft(firstDraft, selected, plan.facets, versions) }
          catch (error) {
            const packet = error instanceof PassageError && error.code === 'draft_invalid' ? analyzeDraftForRepair(firstDraft, selected, plan.facets, versions) : null
            if (!packet) throw error
            correctionKind = 'draft_contract'
            claims = parseCloudDraft(await call('draft', { ...draftContext, correction_packet: packet }), selected, plan.facets, versions)
          }
          let review = parseCloudReview(await call('verify', reviewInput(context, claims, conditionCatalog)), claims, plan.facets, conditionCatalog)
          if (correctionKind === null && mayCorrect(review)) {
            correctionKind = 'source_review'
            claims = parseCloudDraft(await call('draft', { ...draftContext, correction_packet: { previous_claims: claims, review } }), selected, plan.facets, versions)
            // Fresh whole-answer review sees neither the previous verdict nor correction history.
            review = parseCloudReview(await call('verify', reviewInput(context, claims, conditionCatalog)), claims, plan.facets, conditionCatalog)
          }
          if (review.decision !== 'pass') throw new PassageError('support_not_verified')
          await options.repository.recheck(binding, signal); check()
          healthBinding = binding
          const cited = new Set(claims.flatMap(c => c.passage_ids))
          const evidence = selected.filter(p => cited.has(p.id)).map(p => ({ id: p.id, source_id: p.source_id, locator: p.locator, excerpt: p.text }))
          const sourceIds = new Set(evidence.map(e => e.source_id))
          const answer: CloudAnswer = {
            ...result('none', binding), status: claims.some(c => c.qualifications.length) ? 'qualified' : 'supported', message: 'Based on the reviewed EPA guidance. Open each reference to inspect the source and its qualifications.',
            claims: claims.map(c => ({ id: c.id, text: c.text, qualifications: c.qualifications, evidence_ids: c.passage_ids })), evidence,
            sources: verified.release.sources.filter(s => sourceIds.has(s.id)).map(({ id, title, version, status, canonical_url }) => ({ id, title, version, status, canonical_url })),
            correction_attempted: correctionKind !== null, correction_kind: correctionKind,
            retrieval: { mode: 'cloud', store: 'Supabase', search: 'Pinecone', build_id: binding.buildId, release_sha256: binding.releaseSha256, candidate_ids: cloud.candidateIds, selected_ids: selected.map(p => p.id), checked_at: new Date(now()).toISOString() },
          }
          return answer
        } catch (error) { return { ...result(signal.aborted ? cancelled() : errorCode(error), binding), correction_attempted: correctionKind !== null, correction_kind: correctionKind } }
        finally { clearTimeout(timer); inFlight = false }
      })()
      let onAbort: (() => void) | undefined
      const aborted = new Promise<CloudAnswer>(resolve => { onAbort = () => resolve({ ...result(cancelled(), binding), correction_attempted: correctionKind !== null, correction_kind: correctionKind }); if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true }) })
      try { return await Promise.race([work, aborted]) } finally { if (onAbort) signal.removeEventListener('abort', onAbort) }
    },
  }
}
