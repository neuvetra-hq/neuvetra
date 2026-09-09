import type { AnswerStatus } from '../research/types'
import { dependencyClosure, PassageError } from './release'
import { validateDraft, validatePlan, validateVerdict } from './validation'
import type { Passage, PassageAnswer, ReasonCode, Stage, StageProvider, VerifiedPassages } from './types'
import { facetLimits } from './types'

const messages: Record<ReasonCode, string> = {
  none: 'Each statement cites the reviewed paragraphs used, with their qualifications. This is a private research experiment.',
  coverage_missing: 'The reviewed material does not fully support this question. More source coverage or review is needed.',
  action_out_of_scope: 'This experiment explains reviewed concepts and source workflows. It does not select numeric factors, calculate emissions, diagnose company results or determine legal duties.',
  context_required: 'This company-specific question needs location, reporting period or electricity-supply context. Providing those details does not enable numerical selection or calculations in this experiment.',
  source_unavailable: 'The reviewed evidence could not be verified. No answer was released.',
  source_stale: 'Source status or applicability requires review before an answer can be released.',
  selection_invalid: 'The selected evidence did not pass the source and coverage checks.',
  draft_invalid: 'The drafted statements or their citations did not pass validation. No draft was released.',
  draft_empty: 'The drafting stage could not produce a complete supported answer. No draft was released.',
  numeric_output_not_allowed: 'The draft included an unsupported number or a quantitative result that this conceptual experiment cannot release.',
  support_not_verified: 'The support and completeness review did not approve this answer. No draft was released.',
  context_limit: 'The complete required evidence exceeds this experiment’s request size limit. No evidence was trimmed.',
  provider_disabled: 'The experimental answering provider is disabled.',
  provider_failure: 'The model service did not complete a valid response. No answer was released.',
  provider_truncated: 'The model response reached its output limit before completion. No partial answer was released.',
  budget_exhausted: 'The experimental call budget cannot support another complete answer.',
  request_in_progress: 'Another experimental answer is in progress. Please wait until it finishes.',
  request_timeout: 'The experimental answer reached its time limit. No answer was released.',
  request_cancelled: 'The experimental answer was cancelled.',
}
const failureStatus = (code: ReasonCode): AnswerStatus => code === 'coverage_missing' || code === 'action_out_of_scope' ? 'unsupported' : code === 'context_required' ? 'needs_input' : code === 'source_stale' ? 'stale_or_conflicting' : ['selection_invalid', 'draft_invalid', 'draft_empty', 'numeric_output_not_allowed', 'support_not_verified'].includes(code) ? 'needs_review' : 'unavailable'

export function planningInput(question: string, verified: VerifiedPassages) {
  return { question, scope: verified.release.scope, sources: verified.release.sources.filter(s => verified.passages.some(p => p.source_id === s.id)).map(({ id, title, version, status }) => ({ id, title, version, status })), catalog: verified.passages.map(({ id, source_id, title, coverage, required_passage_ids, qualifications, exclusions }) => ({ id, source_id, title, coverage, required_passage_ids, qualifications, exclusions })) }
}
export function evidenceInput(question: string, selected: Passage[], verified: VerifiedPassages) {
  return { question, scope: verified.release.scope, sources: verified.release.sources.filter(s => selected.some(p => p.source_id === s.id)).map(({ id, title, version, status }) => ({ id, title, version, status })), passages: selected.map(({ id, source_id, text, locator, required_passage_ids, qualifications, exclusions }) => ({ id, source_id, text, locator, required_passage_ids, qualifications, exclusions })) }
}
export interface PassageServiceOptions {
  loadRelease: () => Promise<VerifiedPassages>; provider: StageProvider
  /** Tests may shorten this; production never exceeds the fixed 150-second cap. */
  deadlineMs?: number
}
export function createPassageService(options: PassageServiceOptions) {
  let inFlight = false
  const result = (code: ReasonCode, verified?: VerifiedPassages, status = failureStatus(code)): PassageAnswer => ({
    status, message: messages[code], reason_code: code, answer_mode: 'passage_grounded', claims: [], evidence: [], sources: [], missing_context: [],
    release: verified ? { id: verified.release.release_id, version: verified.release.version, sha256: verified.sha256 } : null,
    provider: { mode: options.provider.mode, model: options.provider.model, stages: options.provider.stageProfiles },
  })
  return {
    async status() {
      let release: PassageAnswer['release'] = null, reason: ReasonCode = 'none'
      try {
        const verified = await options.loadRelease()
        options.provider.preflight('plan', planningInput('x'.repeat(2000), verified))
        release = { id: verified.release.release_id, version: verified.release.version, sha256: verified.sha256 }
      } catch (error) { reason = error instanceof PassageError ? error.code : 'source_unavailable' }
      if (reason === 'none' && options.provider.mode === 'disabled') reason = 'provider_disabled'
      if (reason === 'none' && options.provider.limits().remaining_calls < 3) reason = 'budget_exhausted'
      if (reason === 'none' && inFlight) reason = 'request_in_progress'
      return { service: 'neuvetra-research-passages', answer_mode: 'passage_grounded', readiness: reason === 'none' ? 'ready' : !release ? 'evidence_unavailable' : 'provider_unavailable', reason_code: reason, message: messages[reason], release, provider: { mode: options.provider.mode, model: options.provider.model, stages: options.provider.stageProfiles }, limits: options.provider.limits() }
    },
    async answer(question: string, callerSignal?: AbortSignal): Promise<PassageAnswer> {
      if (!question.trim() || question.length > 2000) return result('action_out_of_scope')
      if (callerSignal?.aborted) return result('request_cancelled')
      if (inFlight) return result('request_in_progress')
      inFlight = true
      const timeout = new AbortController()
      const timer = setTimeout(() => timeout.abort(), Math.min(150_000, Math.max(1, options.deadlineMs ?? 150_000)))
      const signal = callerSignal ? AbortSignal.any([timeout.signal, callerSignal]) : timeout.signal
      const cancelled = () => timeout.signal.aborted ? 'request_timeout' as const : 'request_cancelled' as const
      const check = () => { if (signal.aborted) throw new PassageError(cancelled()) }
      const call = async (stage: Stage, input: unknown) => {
        check()
        options.provider.preflight(stage, input) // Exact configured profile, never trim.
        const value = await options.provider.invoke(stage, input, signal)
        check()
        return value
      }
      const work = (async () => {
        let verified: VerifiedPassages | undefined
        try {
          verified = await options.loadRelease(); check()
          const catalog = planningInput(question, verified)
          options.provider.preflight('plan', catalog)
          if (options.provider.mode === 'disabled') return result('provider_disabled', verified)
          if (options.provider.limits().remaining_calls < 3) return result('budget_exhausted', verified)
          const plan = validatePlan(await call('plan', catalog), verified.passages)
          if (plan.action !== 'conceptual_research' || !verified.release.scope.allowed_actions.includes(plan.action)) {
            if (['numeric_factor_selection', 'company_diagnosis'].includes(plan.action) && plan.decision === 'needs_input') {
              const response = result('context_required', verified); response.missing_context = plan.missing_context; return response
            }
            return result('action_out_of_scope', verified)
          }
          if (plan.decision !== 'answer') {
            // A conceptual question must not solicit private company information.
            return result(plan.decision === 'stale_or_conflicting' ? 'source_stale' : 'coverage_missing', verified)
          }
          const selected = dependencyClosure(plan.passage_ids, verified.passages)
          const context = { ...evidenceInput(question, selected, verified), evidence_policy: { claim_support: 'Only each claim’s cited passage IDs and their required dependency closure may support that claim.', other_context: 'Other supplied paragraphs can reveal contradictions or missing coverage, but cannot supply uncited support.' }, facets: plan.facets.map(facet => ({ ...facet, context_passage_ids: dependencyClosure(facet.passage_ids, selected).map(p => p.id), budget: facetLimits(plan.facets.length) })) }
          const claims = validateDraft(await call('draft', context), selected, plan.facets, context.sources)
          // A separate call sees the original question, complete paragraphs and
          // assembled answer; no planner rationale or assumed previous verdict.
          validateVerdict(await call('verify', { ...context, claims, claim_support: claims.map(({ id, passage_ids }) => ({ claim_id: id, allowed_passage_ids: passage_ids })) }), claims, plan.facets)
          const current = await options.loadRelease(); check()
          if (current.sha256 !== verified.sha256) throw new PassageError('source_unavailable')
          const answer = result('none', verified, claims.some(c => c.qualifications.length) ? 'qualified' : 'supported')
          answer.claims = claims.map(({ id, text, qualifications, passage_ids }) => ({ id, text, qualifications, evidence_ids: passage_ids }))
          const cited = new Set(claims.flatMap(c => c.passage_ids))
          answer.evidence = selected.filter(p => cited.has(p.id)).map(p => ({ id: p.id, source_id: p.source_id, locator: p.locator, excerpt: p.text }))
          const sources = new Set(answer.evidence.map(p => p.source_id))
          answer.sources = verified.release.sources.filter(s => sources.has(s.id)).map(({ id, title, version, status, canonical_url }) => ({ id, title, version, status, canonical_url }))
          return answer
        } catch (error) {
          return result(signal.aborted ? cancelled() : error instanceof PassageError ? error.code : 'provider_failure', verified)
        } finally { clearTimeout(timer); inFlight = false }
      })()
      // Bound the HTTP response even if a faulty adapter ignores cancellation.
      // The lock stays held until underlying work settles, and check() prevents
      // any subsequent paid stage after cancellation.
      let onAbort: (() => void) | undefined
      const aborted = new Promise<PassageAnswer>(resolve => {
        onAbort = () => resolve(result(cancelled()))
        if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true })
      })
      try { return await Promise.race([work, aborted]) } finally { if (onAbort) signal.removeEventListener('abort', onAbort) }
    },
  }
}
