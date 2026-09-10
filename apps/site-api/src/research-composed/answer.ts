import type { AnswerResponse, AnswerStatus } from '../research/types';
import type { CloudRepository, CloudBinding } from '../research-cloud/types';
import type { CloudAnswer } from '../research-cloud/answer';
import { PassageError } from '../research-passages/release';
import { CompositionError, parseUnitCatalog, resolveUnitClosure, selectedUnits, titleTextCharacters, type AnswerUnit, type UnitCatalog } from './catalog';
import { selectionForReview, type Selection, type SelectionReview } from './selection';
import { analysisInput, parseQuestionAnalysis } from './question-analysis';
import { initialDemand, demandInput, parseDemandSelection, parseDemandSizeSelection, demandSelectionCorrection, parseDemandReview } from './demand-selection';
import { profileSha256, canonicalReviewRepresentation, type ComposedProvider, type ComposedStage } from './provider';
import { createCatalogAbsenceCertificate, assertCatalogAbsenceCertificate, certifiedBoundaryInput, parseBoundaryFidelityReview } from './catalog-absence';
import { questionFragment, validateQuestionContract, type ContextId } from './question-contract';
import { parseCapabilities, capabilityInput, type CapabilityCatalog } from './capabilities';
export type ComposedAnswer = Omit<CloudAnswer, 'answer_mode' | 'correction_kind'> & {
    answer_mode: 'cloud_reviewed_composition';
    correction_kind: 'selection_size' | 'selection_contract' | 'source_review' | null;
    scope_gaps: { question_fragment: string; reason: 'coverage_missing' | 'action_out_of_scope' | 'context_required'; context_ids: ContextId[] }[];
    composition: {
        catalog_id: string;
        version: string;
        sha256: string;
        units: {
            id: string;
            title: string;
            type: AnswerUnit['type'];
        }[];
        wording: 'reviewed_verbatim';
    } | null;
};
const messages: Record<string, {
    status: AnswerStatus;
    message: string;
}> = {
    question_analysis_invalid: { status: 'needs_review', message: 'The question could not be reliably interpreted. No answer was displayed.' },
    question_analysis_not_verified: { status: 'needs_review', message: 'The question interpretation did not pass its independent check. No answer was displayed.' },
    question_invalid: { status: 'needs_review', message: 'Enter a question of up to 2,000 characters before requesting an answer.' },
    action_out_of_scope: { status: 'unsupported', message: 'This private preview explains purchased-electricity guidance. Company-specific factors, emissions calculations, instrument eligibility and legal filing decisions are outside its coverage.' },
    coverage_missing: { status: 'unsupported', message: 'The reviewed explanations do not yet cover every part of this question. No partial answer was presented as complete.' },
    context_required: { status: 'needs_input', message: 'Please clarify the part of your question identified below. The requested context may help identify the relevant guidance; it does not expand the reviewed source coverage.' },
    selection_not_verified: { status: 'needs_review', message: 'The selected explanations did not pass the question-coverage check. No incomplete answer was displayed.' },
    selection_invalid: { status: 'needs_review', message: 'The explanation selection did not pass validation. No answer was displayed.' },
    selection_too_large: { status: 'needs_review', message: 'The selected explanations exceed this preview’s response limit. No incomplete answer was displayed.' },
    selection_review_invalid: { status: 'needs_review', message: 'The question-coverage check could not be validated. No answer was displayed.' },
    provider_timeout: { status: 'unavailable', message: 'Processing exceeded its response time limit. No answer was displayed.' },
    provider_truncated: { status: 'needs_review', message: 'The response reached the processing limit before its review was complete. No incomplete answer was displayed.' },
    context_limit: { status: 'needs_review', message: 'The question and required evidence exceed this preview’s processing limit. No incomplete answer was displayed.' },
    unit_catalog_invalid: { status: 'unavailable', message: 'The reviewed explanations could not be verified. No answer was displayed.' },
    unit_catalog_stale: { status: 'stale_or_conflicting', message: 'The explanations need a current review before this question can be answered.' },
    cloud_source_stale: { status: 'stale_or_conflicting', message: 'The source review has expired. A current review is needed before answering.' },
    budget_exhausted: { status: 'unavailable', message: 'This private preview has reached its configured usage allowance.' },
    request_in_progress: { status: 'unavailable', message: 'An answer is already being checked. Please wait for it to finish.' },
    request_cancelled: { status: 'unavailable', message: 'The request was cancelled before an answer was ready.' },
    request_timeout: { status: 'unavailable', message: 'The source checks took too long. No incomplete answer was displayed.' },
};
const catalogInput = (catalog: UnitCatalog, capabilities: CapabilityCatalog) => catalog.units.map(({ id, title, text, type, passage_ids, required_unit_ids, coverage }) => {
    const closure = resolveUnitClosure([id], catalog);
    return { id, title, text, type, passage_ids, required_unit_ids, discovery_topics: coverage, ...capabilityInput(capabilities, id),
        closure_unit_ids: closure.map(unit => unit.id), closure_title_text_characters: titleTextCharacters(closure) };
});
export function createComposedAnswerService(options: {
    repository: CloudRepository;
    provider: ComposedProvider;
    catalogBytes: Uint8Array;
    catalogSha256: string;
    capabilityBytes: Uint8Array;
    capabilitySha256: string;
    now?: () => number;
    deadlineMs?: number;
}) {
    const bytes = Uint8Array.from(options.catalogBytes), expectedSha = options.catalogSha256, now = options.now ?? Date.now;
    const capabilityBytes = Uint8Array.from(options.capabilityBytes), capabilitySha = options.capabilitySha256;
    let inFlight = false, healthBinding: CloudBinding | undefined, healthCatalogExpiry = 0;
    const result = (code: string, binding?: CloudBinding): ComposedAnswer => {
        const message = messages[code] ?? { status: 'unavailable' as const, message: 'The research service could not verify a complete answer. Your question can be tried again after its connection is checked.' };
        return { ...message, answer_mode: 'cloud_reviewed_composition', reason_code: code, claims: [], evidence: [], sources: [], missing_context: [], scope_gaps: [], release: binding ? { id: binding.releaseId, version: binding.releaseVersion, sha256: binding.releaseSha256 } : null, provider: { mode: 'live', model: options.provider.model }, retrieval: null, composition: null, correction_attempted: false, correction_kind: null };
    };
    const errorCode = (e: unknown) => e instanceof CompositionError || e instanceof PassageError ? e.code : e instanceof Error && 'code' in e && typeof e.code === 'string' && /^cloud_[a-z_]+$/.test(e.code) ? e.code : 'provider_failure';
    return {
        async initialize() { const loaded = await options.repository.loadForQuestion('U.S. purchased-electricity accounting methods and source records', AbortSignal.timeout(60000)); const parsed = parseUnitCatalog(bytes, expectedSha, loaded.verified, now()); const caps = parseCapabilities(capabilityBytes, capabilitySha, parsed.catalog, expectedSha, now()); healthCatalogExpiry = Math.min(Date.parse(parsed.catalog.review.expires_at), Date.parse(caps.review.expires_at)); healthBinding = loaded.binding; },
        async status() { let reason = 'none'; try {
            if (!healthBinding)
                reason = 'cloud_source_unavailable';
            else
                await options.repository.recheck(healthBinding, AbortSignal.timeout(20000));
            if (reason === 'none' && now() >= healthCatalogExpiry)
                reason = 'unit_catalog_stale';
            if (reason === 'none' && options.provider.remaining() < 5)
                reason = 'budget_exhausted';
            if (reason === 'none' && inFlight)
                reason = 'request_in_progress';
        }
        catch (e) {
            reason = errorCode(e);
        } return { service: 'neuvetra-research-cloud', answer_mode: 'cloud_reviewed_composition', readiness: reason === 'none' ? 'ready' : 'unavailable', reason_code: reason, data_connection: 'cloud', scope: 'private_internal_epa_concepts', remaining_stages: options.provider.remaining() }; },
        async answer(question: string, callerSignal?: AbortSignal): Promise<ComposedAnswer> {
            if (!question.trim() || question.length > 2000)
                return result('question_invalid');
            if (callerSignal?.aborted)
                return result('request_cancelled');
            if (inFlight)
                return result('request_in_progress');
            if (options.provider.remaining() < 5)
                return result('budget_exhausted');
            inFlight = true;
            const timeout = new AbortController(), timer = setTimeout(() => timeout.abort(), Math.min(240000, Math.max(1, options.deadlineMs ?? 240000)));
            const signal = callerSignal ? AbortSignal.any([timeout.signal, callerSignal]) : timeout.signal;
            const cancelled = () => timeout.signal.aborted ? 'request_timeout' : 'request_cancelled';
            const check = () => { if (signal.aborted)
                throw new CompositionError(cancelled()); };
            const call = async (stage: ComposedStage, input: unknown) => { check(); const value = await options.provider.invoke(stage, input, signal); check(); return value; };
            let binding: CloudBinding | undefined, correctionKind: ComposedAnswer['correction_kind'] = null;
            const finish = (value: ComposedAnswer): ComposedAnswer => ({ ...value, correction_attempted: correctionKind !== null, correction_kind: correctionKind });
            const work = (async () => {
                try {
                    const loaded = await options.repository.loadForQuestion(question, signal);
                    check();
                    binding = loaded.binding;
                    const { catalog, sha256 } = parseUnitCatalog(bytes, expectedSha, loaded.verified, now());
                    const capabilities = parseCapabilities(capabilityBytes, capabilitySha, catalog, expectedSha, now());
                    let demand = initialDemand(parseQuestionAnalysis(await call('analyze', analysisInput(question)), question));
                    const input = () => ({ original_question: question, question_analysis: demandInput(demand, question), ranked_candidate_passage_ids: loaded.candidateIds, capability_catalog_sha256: capabilitySha, unit_catalog: catalogInput(catalog, capabilities) });
                    const firstSelection = await call('plan', input());
                    let plan: Selection, units: AnswerUnit[] = [], review: SelectionReview | undefined;
                    const absenceBinding = { catalog_sha256: sha256, capability_sha256: capabilitySha, profile_sha256: profileSha256 };
                    let absenceCertificate: ReturnType<typeof createCatalogAbsenceCertificate> = null, coverageFidelityPassed = false;
                    try { plan = parseDemandSelection(firstSelection, question, catalog, demand); }
                    catch (error) {
                        const packet = demandSelectionCorrection(firstSelection, question, catalog, demand, capabilities);
                        if (!packet) throw error;
                        correctionKind = packet.kind;
                        const replacement = await call('plan', { ...input(), correction_packet: packet });
                        plan = packet.kind === 'selection_size'
                            ? parseDemandSizeSelection(replacement, question, catalog, demand, packet, capabilities)
                            : parseDemandSelection(replacement, question, catalog, demand);
                    }
                    for (let round = 0; round < 2; round++) {
                        units = plan.decision === 'answer' ? selectedUnits([...new Set(plan.facets.flatMap(f => f.unit_ids))], catalog) : [];
                        absenceCertificate = createCatalogAbsenceCertificate(question, plan, demand, catalog, capabilities, absenceBinding, now());
                        if (absenceCertificate) {
                            assertCatalogAbsenceCertificate(absenceCertificate, question, plan, demand, catalog, capabilities, absenceBinding, now());
                            const fidelity = certifiedBoundaryInput(question, plan, demand, absenceCertificate);
                            parseBoundaryFidelityReview(await call('verify', { review_mode: 'catalog_absence_fidelity_v1', fidelity }), demand);
                            coverageFidelityPassed = true;
                            break;
                        }
                        const full = selectionForReview(plan, question, catalog);
                        const expanded = { ...full, question_contract: { parts: full.question_contract.parts.map(({ id, resolution, facet_ids, context_ids }) => ({ id, resolution, facet_ids, context_ids })) } };
                        const checked = parseDemandReview(await call('verify', { ...input(), selection_representation: canonicalReviewRepresentation, selection: expanded, selected_units: units.map(({ id, required_unit_ids }) => ({ id, required_unit_ids })) }), plan, units, catalog, capabilities, demand);
                        review = checked.review; demand = checked.demand;
                        if (review.decision === 'pass') break;
                        if (round === 1 || correctionKind !== null || review.decision !== 'revise') throw new CompositionError('selection_not_verified');
                        correctionKind = 'source_review';
                        plan = parseDemandSelection(await call('plan', { ...input(), correction_packet: { previous_selection: expanded, review } }), question, catalog, demand);
                    }
                    if (!coverageFidelityPassed && review?.decision !== 'pass')
                        throw new CompositionError('selection_not_verified');
                    await options.repository.recheck(binding, signal);
                    check();
                    parseUnitCatalog(bytes, expectedSha, loaded.verified, now());
                    parseCapabilities(capabilityBytes, capabilitySha, catalog, expectedSha, now());
                    if (coverageFidelityPassed) assertCatalogAbsenceCertificate(absenceCertificate, question, plan, demand, catalog, capabilities, absenceBinding, now());
                    healthBinding = binding;
                    healthCatalogExpiry = Math.min(Date.parse(catalog.review.expires_at), Date.parse(capabilities.review.expires_at));
                    if (plan.decision !== 'answer') {
                        const contract = validateQuestionContract(plan.question_contract, question, []);
                        const scope_gaps: ComposedAnswer['scope_gaps'] = contract.contract.parts.flatMap(part => part.resolution === 'coverage_missing' || part.resolution === 'action_out_of_scope' || part.resolution === 'context_required' ? [{ question_fragment: questionFragment(question, part), reason: part.resolution, context_ids: [...part.context_ids] }] : []);
                        const caseClarification = plan.decision === 'needs_input' && demand.analysis.operation === 'assess_specific_case';
                        return finish({ ...result(plan.reason, binding), ...(coverageFidelityPassed ? { message: 'This preview cannot verify every part of this question. No partial answer was presented as complete.' } : {}),
                            ...(caseClarification ? { message: 'This preview explains general guidance; it cannot establish a company-specific conclusion. The clarification below may help identify relevant guidance, but it does not enable that determination.' } : {}),
                            missing_context: plan.decision === 'needs_input' ? [...contract.missingContext] : [], scope_gaps });
                    }
                    const cited = new Set(units.flatMap(u => u.passage_ids)), passages = loaded.verified.passages.filter(p => cited.has(p.id));
                    const evidence = passages.map(p => ({ id: p.id, source_id: p.source_id, locator: p.locator, excerpt: p.text })), sourceIds = new Set(evidence.map(e => e.source_id));
                    const claims: AnswerResponse['claims'] = units.map(u => ({ id: u.id, text: u.text, evidence_ids: [...u.passage_ids], qualifications: [...new Set(passages.filter(p => u.passage_ids.includes(p.id)).flatMap(p => p.qualifications))] }));
                    return finish({ ...result('none', binding), status: claims.some(c => c.qualifications.length) ? 'qualified' : 'supported', message: 'Selected from independently reviewed source explanations. Interpretations are labeled separately; each reference identifies its publisher and source.', claims, evidence, sources: loaded.verified.release.sources.filter(s => sourceIds.has(s.id)).map(({ id, title, version, status, canonical_url }) => ({ id, title, version, status, canonical_url })), retrieval: { mode: 'cloud', store: 'Supabase', search: 'Pinecone', build_id: binding.buildId, release_sha256: binding.releaseSha256, candidate_ids: loaded.candidateIds, selected_ids: passages.map(p => p.id), checked_at: new Date(now()).toISOString() }, composition: { catalog_id: catalog.catalog_id, version: catalog.version, sha256, units: units.map(({ id, title, type }) => ({ id, title, type })), wording: 'reviewed_verbatim' } });
                }
                catch (e) {
                    return finish(result(signal.aborted ? cancelled() : errorCode(e), binding));
                }
                finally {
                    clearTimeout(timer);
                    inFlight = false;
                }
            })();
            let onAbort: (() => void) | undefined;
            const aborted = new Promise<ComposedAnswer>(resolve => { onAbort = () => resolve(finish(result(cancelled(), binding))); if (signal.aborted)
                onAbort();
            else
                signal.addEventListener('abort', onAbort, { once: true }); });
            try {
                return await Promise.race([work, aborted]);
            }
            finally {
                if (onAbort)
                    signal.removeEventListener('abort', onAbort);
            }
        },
    };
}
