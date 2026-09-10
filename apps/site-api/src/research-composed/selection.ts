import { record } from '../research-passages/release';
import { validateSupportRequirements, type CapabilityCatalog, type SupportRequirement } from './capabilities';
import { CompositionError, compositionLimits, exactKeys, need, resolveUnitClosure, selectedUnits, strings, titleTextCharacters, type AnswerUnit, type UnitCatalog } from './catalog';
import { ContractValidationError, contractGuidance, contractNeed, questionFragment, resolveQuestionContract, validateQuestionContract, type QuestionContract, type QuestionContractProposal } from './question-contract';
export interface Selection {
    question_contract: QuestionContract;
    decision: 'answer' | 'unsupported' | 'needs_input';
    reason: 'covered' | 'coverage_missing' | 'action_out_of_scope' | 'context_required';
    facets: {
        id: string;
        unit_ids: string[];
    }[];
}
export type SelectionProposal = Omit<Selection, 'question_contract'> & { question_contract: QuestionContractProposal };
/** Reviewer-only projection. Each facet receives separate original fragments
 * from its assigned parts, including noncontiguous/shared assignments. Neither
 * model can supply replacement text or an invented facet paraphrase.
 */
export function selectionForReview(plan: Selection, question: string, catalog: UnitCatalog) {
    const parts = plan.question_contract.parts.map(part => ({ ...part, question_fragment: questionFragment(question, part) }));
    return { ...plan, question_contract: { ...plan.question_contract, parts }, facets: plan.facets.map(facet => ({
        ...facet, question_part_ids: parts.filter(part => part.facet_ids.includes(facet.id)).map(part => part.id),
        unit_ids: selectedUnits(facet.unit_ids, catalog).map(unit => unit.id),
    })) };
}
export interface SelectionReview {
    decision: 'pass' | 'revise' | 'fail';
    decomposition_complete: boolean;
    relevant: boolean;
    scope_appropriate: boolean;
    context_appropriate: boolean;
    premise_handled: boolean;
    task_fit: boolean;
    proportionate: boolean;
    question_parts: { id: string; faithful: boolean; appropriately_resolved: boolean; support_requirements: SupportRequirement[] }[];
    facets: {
        id: string;
        covered: boolean;
        unit_ids: string[];
    }[];
    issues: {
        code: string;
        target_id: string;
        explanation: string;
    }[];
}
/** Validate every facet and ID before any size decision. An oversized earlier
 * facet must not conceal a malformed or foreign selection later in the plan.
 */
function validateSelection(raw: unknown, question: string, catalog: UnitCatalog): Selection {
    contractNeed(exactKeys(raw, ['decision', 'reason', 'facets', 'question_contract']), 'selection_shape');
    const proposal = raw as SelectionProposal;
    const p: Selection = { ...proposal, question_contract: resolveQuestionContract(proposal.question_contract, question) };
    contractNeed(['answer', 'unsupported', 'needs_input'].includes(p.decision) && ['covered', 'coverage_missing', 'action_out_of_scope', 'context_required'].includes(p.reason) && Array.isArray(p.facets) && p.facets.length <= 6, 'selection_shape');
    contractNeed(p.decision === 'answer' ? p.reason === 'covered' && p.facets.length > 0 : p.facets.length === 0, 'decision_consistency');
    for (let i = 0; i < p.facets.length; i++) {
        const f = p.facets[i]!;
        contractNeed(exactKeys(f, ['id', 'unit_ids']) && f.id === `f${i + 1}`, 'facet_shape');
        resolveUnitClosure(f.unit_ids, catalog);
    }
    const expected = validateQuestionContract(p.question_contract, question, p.facets.map(f => f.id));
    contractNeed(p.decision === expected.decision && p.reason === expected.reason, 'decision_consistency');
    return p;
}
export function parseSelection(raw: unknown, question: string, catalog: UnitCatalog): Selection {
    const plan = validateSelection(raw, question, catalog);
    if (plan.decision === 'answer')
        selectedUnits([...new Set(plan.facets.flatMap(f => f.unit_ids))], catalog);
    return plan;
}
/** Invalid JSON selections are untrusted proposals. Only a bounded, fixed rule
 * identifier and the unchanged proposal are returned; provider/transport/review
 * failures cannot acquire this single structural correction opportunity.
 */
export function analyzeSelectionContract(raw: unknown, question: string, catalog: UnitCatalog) {
    try { validateSelection(raw, question, catalog); return null; }
    catch (error) {
        if (!(error instanceof CompositionError) || error.code !== 'selection_invalid') return null;
        const issue = error instanceof ContractValidationError ? error.issue : 'unit_selection';
        return { kind: 'selection_contract' as const, previous_selection_trust: 'untrusted' as const,
            previous_selection: structuredClone(raw), validation_issue: issue, validation_guidance: contractGuidance[issue] };
    }
}
export interface SelectionSizePacket {
    kind: 'selection_size';
    previous_selection_trust: 'untrusted';
    previous_selection: Selection;
    closure_unit_ids: string[];
    closure_title_text_characters: number;
    limits: typeof compositionLimits;
}
/** A complete valid selection may be reconsidered once for size. This is a
 * diagnostic, never a trimmed answer or permission to omit a requested facet.
 */
export function analyzeSelectionSize(raw: unknown, question: string, catalog: UnitCatalog): SelectionSizePacket | null {
    try {
        const plan = validateSelection(raw, question, catalog);
        if (plan.decision !== 'answer') return null;
        const units = resolveUnitClosure([...new Set(plan.facets.flatMap(f => f.unit_ids))], catalog);
        const characters = titleTextCharacters(units);
        if (units.length <= compositionLimits.maxUnits && characters <= compositionLimits.maxTitleTextCharacters) return null;
        return { kind: 'selection_size', previous_selection_trust: 'untrusted', previous_selection: structuredClone(plan),
            closure_unit_ids: units.map(u => u.id), closure_title_text_characters: characters, limits: { ...compositionLimits } };
    }
    catch { return null; }
}
export function parseSelectionReview(raw: unknown, plan: Selection, units: AnswerUnit[], catalog: UnitCatalog, capabilities: CapabilityCatalog): SelectionReview {
    need(exactKeys(raw, ['decision', 'decomposition_complete', 'relevant', 'scope_appropriate', 'context_appropriate', 'premise_handled', 'task_fit', 'proportionate', 'question_parts', 'facets', 'issues']), 'selection_review_invalid');
    const v = raw as SelectionReview;
    const flags = ['decomposition_complete', 'relevant', 'scope_appropriate', 'context_appropriate', 'premise_handled', 'task_fit', 'proportionate'] as const;
    need(['pass', 'revise', 'fail'].includes(v.decision) && flags.every(k => typeof v[k] === 'boolean') && Array.isArray(v.facets) && v.facets.length === plan.facets.length && Array.isArray(v.issues) && v.issues.length <= 25, 'selection_review_invalid');
    need(v.facets.every(f => exactKeys(f, ['id', 'covered', 'unit_ids'])), 'selection_review_invalid');
    need(new Set(v.facets.map(f => f.id)).size === v.facets.length, 'selection_review_invalid');
    for (const f of v.facets) {
        const expected = plan.facets.find(p => p.id === f.id);
        need(exactKeys(f, ['id', 'covered', 'unit_ids']) && expected && typeof f.covered === 'boolean' && strings(f.unit_ids), 'selection_review_invalid');
        const own = selectedUnits(expected!.unit_ids, catalog).map(u => u.id);
        need(f.unit_ids.length === own.length && f.unit_ids.every(id => own.includes(id) && units.some(u => u.id === id)), 'selection_review_invalid');
    }
    need(Array.isArray(v.question_parts) && v.question_parts.length === plan.question_contract.parts.length, 'selection_review_invalid');
    for (let i = 0; i < v.question_parts.length; i++) {
        const part = v.question_parts[i]!;
        const originalPart = plan.question_contract.parts[i]!;
        need(exactKeys(part, ['id', 'faithful', 'appropriately_resolved', 'support_requirements']) && part.id === originalPart.id && typeof part.faithful === 'boolean' && typeof part.appropriately_resolved === 'boolean', 'selection_review_invalid');
        const ownUnitIds = [...new Set(plan.facets.filter(facet => originalPart.facet_ids.includes(facet.id)).flatMap(facet => selectedUnits(facet.unit_ids, catalog).map(unit => unit.id)))];
        validateSupportRequirements(part.support_requirements, { background: originalPart.kind === 'background', covered: originalPart.resolution === 'covered', ambiguityContext: originalPart.kind === 'ambiguous_reference' && originalPart.resolution === 'context_required', appropriatelyResolved: part.appropriately_resolved, ownUnitIds, capabilities });
    }
    const globalIssue: Record<string, string> = { decomposition: 'decomposition_complete', relevance: 'relevant', scope: 'scope_appropriate', context: 'context_appropriate', premise: 'premise_handled', task_fit: 'task_fit', proportionality: 'proportionate' };
    for (const issue of v.issues) {
        need(exactKeys(issue, ['code', 'target_id', 'explanation']) && typeof issue.explanation === 'string' && issue.explanation.trim().length > 0 && issue.explanation.length <= 2000, 'selection_review_invalid');
        if (issue.code === 'question_part')
            need(v.question_parts.some(p => p.id === issue.target_id && (!p.faithful || !p.appropriately_resolved)), 'selection_review_invalid');
        else if (issue.code === 'coverage')
            need(v.facets.some(f => f.id === issue.target_id && !f.covered), 'selection_review_invalid');
        else
            need(issue.target_id === 'answer' && Object.hasOwn(globalIssue, issue.code) && record(v) && v[globalIssue[issue.code]!] === false, 'selection_review_invalid');
    }
    for (const [code, key] of Object.entries(globalIssue))
        if ((v as unknown as Record<string, unknown>)[key] === false)
            need(v.issues.some(i => i.code === code && i.target_id === 'answer'), 'selection_review_invalid');
    for (const f of v.facets)
        if (!f.covered)
            need(v.issues.some(i => i.code === 'coverage' && i.target_id === f.id), 'selection_review_invalid');
    for (const part of v.question_parts)
        if (!part.faithful || !part.appropriately_resolved)
            need(v.issues.some(i => i.code === 'question_part' && i.target_id === part.id), 'selection_review_invalid');
    const pass = flags.every(k => v[k]) && v.facets.every(f => f.covered) && v.question_parts.every(p => p.faithful && p.appropriately_resolved);
    need(v.decision === 'pass' ? pass && v.issues.length === 0 : !pass && v.issues.length > 0, 'selection_review_invalid');
    return v;
}
