import type { AnswerResponse, AnswerStatus } from '../research/types';
import type { CloudRepository, CloudBinding } from '../research-cloud/types';
import type { CloudAnswer } from '../research-cloud/answer';
import { PassageError } from '../research-passages/release';
import { CompositionError, parseUnitCatalog, resolveUnitClosure, selectedUnits, titleTextCharacters, type AnswerUnit, type UnitCatalog } from './catalog';
import { analyzeSelectionSize, parseSelection, parseSelectionReview, type Selection, type SelectionReview } from './selection';
import type { ComposedProvider, ComposedStage } from './provider';
export type ComposedAnswer = Omit<CloudAnswer, 'answer_mode' | 'correction_kind'> & {
    answer_mode: 'cloud_reviewed_composition';
    correction_kind: 'selection_size' | 'source_review' | null;
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
    action_out_of_scope: { status: 'unsupported', message: 'This private preview explains purchased-electricity guidance. Company-specific factors, emissions calculations, instrument eligibility and legal filing decisions are outside its coverage.' },
    coverage_missing: { status: 'unsupported', message: 'The reviewed explanations do not yet cover every part of this question. No partial answer was presented as complete.' },
    context_required: { status: 'needs_input', message: 'More context is needed to identify the applicable source discussion. This preview can explain guidance, but cannot select a company-specific factor.' },
    selection_not_verified: { status: 'needs_review', message: 'The selected explanations did not pass the question-coverage check. No incomplete answer was displayed.' },
    selection_invalid: { status: 'needs_review', message: 'The explanation selection did not pass validation. No answer was displayed.' },
    selection_too_large: { status: 'needs_review', message: 'The selected explanations exceed this preview’s response limit. No incomplete answer was displayed.' },
    selection_review_invalid: { status: 'needs_review', message: 'The question-coverage check could not be validated. No answer was displayed.' },
    unit_catalog_invalid: { status: 'unavailable', message: 'The reviewed explanations could not be verified. No answer was displayed.' },
    unit_catalog_stale: { status: 'stale_or_conflicting', message: 'The explanations need a current review before this question can be answered.' },
    cloud_source_stale: { status: 'stale_or_conflicting', message: 'The source review has expired. A current review is needed before answering.' },
    budget_exhausted: { status: 'unavailable', message: 'This private preview has reached its configured usage allowance.' },
    request_in_progress: { status: 'unavailable', message: 'An answer is already being checked. Please wait for it to finish.' },
    request_cancelled: { status: 'unavailable', message: 'The request was cancelled before an answer was ready.' },
    request_timeout: { status: 'unavailable', message: 'The source checks took too long. No incomplete answer was displayed.' },
};
const catalogInput = (catalog: UnitCatalog) => catalog.units.map(({ id, title, text, type, passage_ids, required_unit_ids, coverage }) => {
    const closure = resolveUnitClosure([id], catalog);
    return { id, title, text, type, passage_ids, required_unit_ids, coverage,
        closure_unit_ids: closure.map(unit => unit.id), closure_title_text_characters: titleTextCharacters(closure) };
});
export function createComposedAnswerService(options: {
    repository: CloudRepository;
    provider: ComposedProvider;
    catalogBytes: Uint8Array;
    catalogSha256: string;
    now?: () => number;
    deadlineMs?: number;
}) {
    const bytes = Uint8Array.from(options.catalogBytes), expectedSha = options.catalogSha256, now = options.now ?? Date.now;
    let inFlight = false, healthBinding: CloudBinding | undefined, healthCatalogExpiry = 0;
    const result = (code: string, binding?: CloudBinding): ComposedAnswer => {
        const message = messages[code] ?? { status: 'unavailable' as const, message: 'The research service could not verify a complete answer. Your question can be tried again after its connection is checked.' };
        return { ...message, answer_mode: 'cloud_reviewed_composition', reason_code: code, claims: [], evidence: [], sources: [], missing_context: code === 'context_required' ? ['location', 'reporting_period', 'electricity_supply'] : [], release: binding ? { id: binding.releaseId, version: binding.releaseVersion, sha256: binding.releaseSha256 } : null, provider: { mode: 'live', model: options.provider.model }, retrieval: null, composition: null, correction_attempted: false, correction_kind: null };
    };
    const errorCode = (e: unknown) => e instanceof CompositionError || e instanceof PassageError ? e.code : e instanceof Error && 'code' in e && typeof e.code === 'string' && /^cloud_[a-z_]+$/.test(e.code) ? e.code : 'provider_failure';
    return {
        async initialize() { const loaded = await options.repository.loadForQuestion('U.S. purchased-electricity accounting methods and source records', AbortSignal.timeout(60000)); const parsed = parseUnitCatalog(bytes, expectedSha, loaded.verified, now()); healthCatalogExpiry = Date.parse(parsed.catalog.review.expires_at); healthBinding = loaded.binding; },
        async status() { let reason = 'none'; try {
            if (!healthBinding)
                reason = 'cloud_source_unavailable';
            else
                await options.repository.recheck(healthBinding, AbortSignal.timeout(20000));
            if (reason === 'none' && now() >= healthCatalogExpiry)
                reason = 'unit_catalog_stale';
            if (reason === 'none' && options.provider.remaining() < 4)
                reason = 'budget_exhausted';
            if (reason === 'none' && inFlight)
                reason = 'request_in_progress';
        }
        catch (e) {
            reason = errorCode(e);
        } return { service: 'neuvetra-research-cloud', answer_mode: 'cloud_reviewed_composition', readiness: reason === 'none' ? 'ready' : 'unavailable', reason_code: reason, data_connection: 'cloud', scope: 'private_internal_epa_concepts', remaining_stages: options.provider.remaining() }; },
        async answer(question: string, callerSignal?: AbortSignal): Promise<ComposedAnswer> {
            if (!question.trim() || question.length > 2000)
                return result('action_out_of_scope');
            if (callerSignal?.aborted)
                return result('request_cancelled');
            if (inFlight)
                return result('request_in_progress');
            if (options.provider.remaining() < 4)
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
                    const input = { original_question: question, ranked_candidate_passage_ids: loaded.candidateIds, unit_catalog: catalogInput(catalog) };
                    const firstSelection = await call('plan', input);
                    let plan: Selection, units: AnswerUnit[] = [], review: SelectionReview | undefined;
                    try { plan = parseSelection(firstSelection, question, catalog); }
                    catch (error) {
                        const packet = error instanceof CompositionError && error.code === 'selection_too_large'
                            ? analyzeSelectionSize(firstSelection, question, catalog) : null;
                        if (!packet) throw error;
                        correctionKind = 'selection_size';
                        plan = parseSelection(await call('plan', { ...input, correction_packet: packet }), question, catalog);
                    }
                    for (let round = 0; round < 2; round++) {
                        units = plan.decision === 'answer' ? selectedUnits([...new Set(plan.facets.flatMap(f => f.unit_ids))], catalog) : [];
                        const expanded: Selection = { ...plan, facets: plan.facets.map(f => ({ ...f, unit_ids: selectedUnits(f.unit_ids, catalog).map(u => u.id) })) };
                        review = parseSelectionReview(await call('verify', { ...input, selection: expanded, selected_units: units.map(({ id, title, text, type, required_unit_ids }) => ({ id, title, text, type, required_unit_ids })) }), plan, units, catalog);
                        if (review.decision === 'pass')
                            break;
                        if (round === 1 || correctionKind !== null || review.decision !== 'revise')
                            throw new CompositionError('selection_not_verified');
                        correctionKind = 'source_review';
                        plan = parseSelection(await call('plan', { ...input, correction_packet: { previous_selection: expanded, review } }), question, catalog);
                    }
                    if (review?.decision !== 'pass')
                        throw new CompositionError('selection_not_verified');
                    await options.repository.recheck(binding, signal);
                    check();
                    parseUnitCatalog(bytes, expectedSha, loaded.verified, now());
                    healthBinding = binding;
                    healthCatalogExpiry = Date.parse(catalog.review.expires_at);
                    if (plan.decision !== 'answer')
                        return finish(result(plan.reason, binding));
                    const cited = new Set(units.flatMap(u => u.passage_ids)), passages = loaded.verified.passages.filter(p => cited.has(p.id));
                    const evidence = passages.map(p => ({ id: p.id, source_id: p.source_id, locator: p.locator, excerpt: p.text })), sourceIds = new Set(evidence.map(e => e.source_id));
                    const claims: AnswerResponse['claims'] = units.map(u => ({ id: u.id, text: u.text, evidence_ids: [...u.passage_ids], qualifications: [...new Set(passages.filter(p => u.passage_ids.includes(p.id)).flatMap(p => p.qualifications))] }));
                    return finish({ ...result('none', binding), status: claims.some(c => c.qualifications.length) ? 'qualified' : 'supported', message: 'Selected from independently reviewed explanations of EPA guidance. Interpretations are labeled separately; open each reference to inspect the source.', claims, evidence, sources: loaded.verified.release.sources.filter(s => sourceIds.has(s.id)).map(({ id, title, version, status, canonical_url }) => ({ id, title, version, status, canonical_url })), retrieval: { mode: 'cloud', store: 'Supabase', search: 'Pinecone', build_id: binding.buildId, release_sha256: binding.releaseSha256, candidate_ids: loaded.candidateIds, selected_ids: passages.map(p => p.id), checked_at: new Date(now()).toISOString() }, composition: { catalog_id: catalog.catalog_id, version: catalog.version, sha256, units: units.map(({ id, title, type }) => ({ id, title, type })), wording: 'reviewed_verbatim' } });
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
