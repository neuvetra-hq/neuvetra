import { record } from '../research-passages/release';
import { compositionLimits, exactKeys, need, resolveUnitClosure, selectedUnits, strings, titleTextCharacters, type AnswerUnit, type UnitCatalog } from './catalog';
export interface Selection {
    decision: 'answer' | 'unsupported' | 'needs_input';
    reason: 'covered' | 'coverage_missing' | 'action_out_of_scope' | 'context_required';
    facets: {
        id: string;
        question_fragment: string;
        unit_ids: string[];
    }[];
}
export interface SelectionReview {
    decision: 'pass' | 'revise' | 'fail';
    decomposition_complete: boolean;
    relevant: boolean;
    scope_appropriate: boolean;
    context_appropriate: boolean;
    premise_handled: boolean;
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
/** Question fragments may differ only in straight/curly quotation typography.
 * Keep original bytes and all other wording intact; source anchors stay exact.
 */
function normalizeQuestionQuotes(text: string): string {
    return text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
}
/** Validate every facet and ID before any size decision. An oversized earlier
 * facet must not conceal a malformed or foreign selection later in the plan.
 */
function validateSelection(raw: unknown, question: string, catalog: UnitCatalog): Selection {
    need(exactKeys(raw, ['decision', 'reason', 'facets']));
    const p = raw as Selection;
    need(['answer', 'unsupported', 'needs_input'].includes(p.decision) && ['covered', 'coverage_missing', 'action_out_of_scope', 'context_required'].includes(p.reason) && Array.isArray(p.facets) && p.facets.length <= 6);
    if (p.decision !== 'answer') {
        need(p.facets.length === 0 && (p.decision === 'needs_input' ? p.reason === 'context_required' : ['coverage_missing', 'action_out_of_scope'].includes(p.reason)));
        return p;
    }
    need(p.reason === 'covered' && p.facets.length > 0);
    for (let i = 0; i < p.facets.length; i++) {
        const f = p.facets[i]!;
        need(exactKeys(f, ['id', 'question_fragment', 'unit_ids']) && f.id === `f${i + 1}` && typeof f.question_fragment === 'string' && f.question_fragment.trim().length > 0 && normalizeQuestionQuotes(question).includes(normalizeQuestionQuotes(f.question_fragment)));
        resolveUnitClosure(f.unit_ids, catalog);
    }
    return p;
}
export function parseSelection(raw: unknown, question: string, catalog: UnitCatalog): Selection {
    const plan = validateSelection(raw, question, catalog);
    if (plan.decision === 'answer')
        selectedUnits([...new Set(plan.facets.flatMap(f => f.unit_ids))], catalog);
    return plan;
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
export function parseSelectionReview(raw: unknown, plan: Selection, units: AnswerUnit[], catalog: UnitCatalog): SelectionReview {
    need(exactKeys(raw, ['decision', 'decomposition_complete', 'relevant', 'scope_appropriate', 'context_appropriate', 'premise_handled', 'facets', 'issues']), 'selection_review_invalid');
    const v = raw as SelectionReview;
    const flags = ['decomposition_complete', 'relevant', 'scope_appropriate', 'context_appropriate', 'premise_handled'] as const;
    need(['pass', 'revise', 'fail'].includes(v.decision) && flags.every(k => typeof v[k] === 'boolean') && Array.isArray(v.facets) && v.facets.length === plan.facets.length && Array.isArray(v.issues) && v.issues.length <= 12, 'selection_review_invalid');
    need(v.facets.every(f => exactKeys(f, ['id', 'covered', 'unit_ids'])), 'selection_review_invalid');
    need(new Set(v.facets.map(f => f.id)).size === v.facets.length, 'selection_review_invalid');
    for (const f of v.facets) {
        const expected = plan.facets.find(p => p.id === f.id);
        need(exactKeys(f, ['id', 'covered', 'unit_ids']) && expected && typeof f.covered === 'boolean' && strings(f.unit_ids), 'selection_review_invalid');
        const own = selectedUnits(expected!.unit_ids, catalog).map(u => u.id);
        need(f.unit_ids.length === own.length && f.unit_ids.every(id => own.includes(id) && units.some(u => u.id === id)), 'selection_review_invalid');
    }
    const globalIssue: Record<string, string> = { decomposition: 'decomposition_complete', relevance: 'relevant', scope: 'scope_appropriate', context: 'context_appropriate', premise: 'premise_handled' };
    for (const issue of v.issues) {
        need(exactKeys(issue, ['code', 'target_id', 'explanation']) && typeof issue.explanation === 'string' && issue.explanation.trim().length > 0 && issue.explanation.length <= 2000, 'selection_review_invalid');
        if (issue.code === 'coverage')
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
    const pass = flags.every(k => v[k]) && v.facets.every(f => f.covered);
    need(v.decision === 'pass' ? pass && v.issues.length === 0 : !pass && v.issues.length > 0, 'selection_review_invalid');
    return v;
}
