import { CompositionError, exactKeys, strings } from './catalog';

export const contractIssues = ['selection_shape', 'facet_shape', 'unit_selection', 'contract_shape', 'part_shape', 'question_partition', 'part_references', 'resolution_consistency', 'context_ids_required', 'context_ids_forbidden', 'ambiguity_context_mismatch', 'decision_consistency', 'operation_boundary'] as const;
export type ContractIssue = typeof contractIssues[number];
/** Fixed structural guidance only; never incorporates model text or answer facts. */
export const contractGuidance: Record<ContractIssue, string> = {
    selection_shape: 'Return only question_contract, decision, reason and facets with the declared types and limits.',
    facet_shape: 'Facets must use sequential f1, f2 and later IDs, with only id and unit_ids. Return no copied or paraphrased question text.',
    unit_selection: 'Use only distinct known unit_ids and their required companion closure. A unit reference cannot expand the reviewed evidence.',
    contract_shape: 'Return the requested operation and 1-12 ordered question parts. Preserve the complete question, all conditions and its actual task.',
    part_shape: 'Each part must contain only id, start_token, kind, resolution, facet_ids and context_ids. Use sequential q IDs and no end_token fields.',
    question_partition: 'The first start_token must be 0. Later starts must be strictly increasing safe integers smaller than question_index.token_count. The server derives every end. Each resulting part must contain non-whitespace text; retain leading whitespace with the first substantive part.',
    part_references: 'Every facet reference must name an existing facet. For unsupported or needs_input decisions, facets and every part facet_ids must be empty. Preserve actual coverage_missing, action_out_of_scope or context_required gap parts; other material parts withheld with the whole response must be not_answered, even when related evidence exists. Do not delete a real gap to obtain an answer.',
    resolution_consistency: 'Choose the whole-question decision first. covered means answered in this response. A withheld response keeps actual gap resolutions and uses not_answered for other material parts; background uses background, and ambiguous_reference requires context_required with relevant context_ids.',
    context_ids_required: 'A context_required part must name 1-3 distinct known relevant context IDs. Do not invent an ID; preserve independent action/coverage gaps and every material part.',
    context_ids_forbidden: 'Only context_required may have context IDs. All other resolutions require an empty context_ids array.',
    ambiguity_context_mismatch: 'A sealed ambiguous_reference must remain context_required with exactly its sealed ambiguity_context_ids; do not guess, remove or replace the unresolved reference.',
    decision_consistency: 'The whole-question decision and reason must follow every material part: action_out_of_scope precedes coverage_missing, then context_required, then covered. Do not convert an excluded action or missing coverage into a partial answer.',
    operation_boundary: 'A request to calculate or submit_or_file requires action_out_of_scope. An explanation cannot perform that excluded execution.',
};
export class ContractValidationError extends CompositionError {
    constructor(public readonly issue: ContractIssue, public readonly partId?: string) { super('selection_invalid'); }
}
export const contractNeed = (ok: unknown, issue: ContractIssue, partId?: string): void => { if (!ok) throw new ContractValidationError(issue, partId); };
const need = (ok: unknown, issue: ContractIssue = 'resolution_consistency') => contractNeed(ok, issue);

export const contextIds = ['referenced_requirement', 'referenced_subject', 'intended_use', 'factor_description', 'supplier_documentation', 'base_year_method', 'target_method', 'change_description', 'location', 'reporting_period', 'electricity_supply'] as const;
export const operations = ['explain', 'compare', 'prepare_inquiry', 'assess_specific_case', 'calculate', 'submit_or_file'] as const;
export const partKinds = ['request', 'condition', 'background', 'ambiguous_reference'] as const;
export const resolutions = ['covered', 'coverage_missing', 'action_out_of_scope', 'context_required', 'not_answered', 'background'] as const;
export type ContextId = typeof contextIds[number];
export interface QuestionPart {
    id: string;
    start_token: number;
    end_token: number;
    kind: typeof partKinds[number];
    resolution: typeof resolutions[number];
    facet_ids: string[];
    context_ids: ContextId[];
}
export interface QuestionContract {
    operation: typeof operations[number];
    parts: QuestionPart[];
}
/** A token retains the exact following whitespace. Leading whitespace is its
 * own token; a whitespace-only part is never a valid semantic part. Token indices
 * are zero based and ranges are end exclusive. No normalization or fuzzy repair.
 */
export const questionTokens = (question: string): string[] => question.match(/\S+\s*|\s+/gu) ?? [];
export function questionIndex(question: string) {
    const tokens = questionTokens(question);
    return { range_convention: 'zero_based_end_exclusive', token_count: tokens.length,
        full_range: { start_token: 0, end_token: tokens.length }, tokens: tokens.map((text, index) => [index, text] as const) };
}
export type QuestionContractProposal = Omit<QuestionContract, 'parts'> & { parts: Omit<QuestionPart, 'end_token'>[] };
/** The wire contract supplies starts only. After exact raw-shape and boundary
 * validation, the server derives ends; it never accepts, repairs or ignores a
 * model-supplied end. The existing resolved contract validator remains required.
 */
export function resolveQuestionContract(raw: unknown, question: string): QuestionContract {
    need(exactKeys(raw, ['operation', 'parts']), 'contract_shape');
    const proposal = raw as QuestionContractProposal;
    need(operations.includes(proposal.operation) && Array.isArray(proposal.parts) && proposal.parts.length > 0 && proposal.parts.length <= 12, 'contract_shape');
    const count = questionTokens(question).length;
    for (let i = 0; i < proposal.parts.length; i++) {
        const part = proposal.parts[i]!;
        need(exactKeys(part, ['id', 'start_token', 'kind', 'resolution', 'facet_ids', 'context_ids']), 'part_shape');
        need(Number.isSafeInteger(part.start_token) && part.start_token >= 0 && part.start_token < count, 'question_partition');
        need(i === 0 ? part.start_token === 0 : part.start_token > proposal.parts[i - 1]!.start_token, 'question_partition');
    }
    return { operation: proposal.operation, parts: proposal.parts.map((part, i) => ({ ...part, end_token: proposal.parts[i + 1]?.start_token ?? count })) };
}
export function questionFragment(question: string, part: Pick<QuestionPart, 'start_token' | 'end_token'>): string {
    const tokens = questionTokens(question);
    need(Number.isSafeInteger(part.start_token) && Number.isSafeInteger(part.end_token) && part.start_token >= 0 && part.end_token > part.start_token && part.end_token <= tokens.length, 'question_partition');
    const fragment = tokens.slice(part.start_token, part.end_token).join('');
    need(fragment.trim().length > 0, 'question_partition');
    return fragment;
}

/** Mechanical completeness is not semantic completeness: the independent
 * reviewer must still challenge conditions mislabeled as background, ambiguous
 * references guessed from context, and source mappings that merely share a topic.
 */
export function validateQuestionContract(raw: unknown, question: string, facetIds: string[]) {
    need(exactKeys(raw, ['operation', 'parts']), 'contract_shape');
    const contract = raw as QuestionContract;
    need(operations.includes(contract.operation) && Array.isArray(contract.parts) && contract.parts.length > 0 && contract.parts.length <= 12, 'contract_shape');
    let nextToken = 0;
    for (let i = 0; i < contract.parts.length; i++) {
        const part = contract.parts[i]!;
        need(exactKeys(part, ['id', 'start_token', 'end_token', 'kind', 'resolution', 'facet_ids', 'context_ids']) && part.id === `q${i + 1}` && partKinds.includes(part.kind) && resolutions.includes(part.resolution) && strings(part.facet_ids) && strings(part.context_ids), 'part_shape');
        need(part.start_token === nextToken, 'question_partition');
        questionFragment(question, part);
        nextToken = part.end_token;
        need(part.facet_ids.every(id => facetIds.includes(id)) && part.context_ids.every(id => contextIds.includes(id)), 'part_references');
        if (part.kind === 'background') need(part.resolution === 'background');
        else need(part.resolution !== 'background');
        if (part.kind === 'ambiguous_reference') need(part.resolution === 'context_required');
        need(part.resolution === 'covered' ? part.facet_ids.length > 0 : part.facet_ids.length === 0);
        need(part.resolution === 'context_required' ? part.context_ids.length > 0 && part.context_ids.length <= 3 : part.context_ids.length === 0);
    }
    need(contract.parts.some(p => p.kind !== 'background'));
    need(nextToken === questionTokens(question).length, 'question_partition');
    need(contract.parts.map(p => questionFragment(question, p)).join('') === question, 'question_partition');
    need(facetIds.every(id => contract.parts.some(p => p.facet_ids.includes(id))), 'part_references');
    const has = (resolution: QuestionPart['resolution']) => contract.parts.some(p => p.resolution === resolution);
    const reason = has('action_out_of_scope') ? 'action_out_of_scope' : has('coverage_missing') ? 'coverage_missing' : has('context_required') ? 'context_required' : 'covered';
    need(reason === 'covered' ? !has('not_answered') : !has('covered'));
    // The requested execution cannot be replaced with explanatory background.
    if (contract.operation === 'calculate' || contract.operation === 'submit_or_file') need(reason === 'action_out_of_scope', 'operation_boundary');
    return { contract, reason, decision: reason === 'covered' ? 'answer' : reason === 'context_required' ? 'needs_input' : 'unsupported', missingContext: [...new Set(contract.parts.flatMap(p => p.context_ids))] } as const;
}
