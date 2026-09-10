import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { hash, parsePassageRelease } from '../research-passages/release';
import { SOURCE_SHA, selectedUnits, parseUnitCatalog } from './catalog';
import { CAPABILITY_SHA, CAPABILITY_UNIT_SHA } from './capabilities';
import { createComposedAnswerService } from './answer';
import { initialDemand } from './demand-selection';
import { analysisInput, parseQuestionAnalysis } from './question-analysis';
import type { ComposedStage } from './provider';
import type { ContextId } from './question-contract';

// Authored synthetic model outputs test control flow, not live language fidelity.
// Only the existing approved EPA catalogs are used; no private traces or gold.
const now = Date.parse('2026-09-12T12:00:00Z');
const read = (p: string) => readFileSync(new URL(`../../../../data/research/${p}`, import.meta.url));
const release = parsePassageRelease(JSON.parse(read('releases/scope2-website.v1.json').toString()), now);
const catalogBytes = read('answer-units/scope2-website.epa-acquisition.v1.json');
const catalog = parseUnitCatalog(catalogBytes, CAPABILITY_UNIT_SHA, { release, passages: release.passages, sha256: SOURCE_SHA }, now).catalog;
const capabilityBytes = read('capabilities/scope2-website.epa-limitations.v1.json');
const requestPart = (id = 'q1', start_token = 0, subject = 'unrepresented_subject', kind = 'explanation') => ({ id, start_token, kind: 'request', requirements: [{ kind, subject }], ambiguity_context_ids: [] as string[] });
const caseAnalysis = () => ({ operation: 'assess_specific_case', parts: [requestPart()] });
const contextPlan = (ids: ContextId[] = ['location', 'reporting_period', 'electricity_supply']) => ({ facets: [], question_contract: { parts: [{ id: 'q1', resolution: 'context_required', facet_ids: [], context_ids: ids }] } });
const scopeMessage = 'cannot establish a company-specific conclusion';

function review(a: any, question: string, units: string[] = [], proof: string[] = []): any {
    const demand = initialDemand(parseQuestionAnalysis(a, question));
    return { decision: 'pass', decomposition_complete: true, relevant: true, scope_appropriate: true, context_appropriate: true, premise_handled: true, task_fit: true, proportionate: true,
        question_parts: demand.analysis.parts.map(p => ({ id: p.id, faithful: true, appropriately_resolved: true, requirements: p.requirements.map(r => ({ id: r.id, capability_ids: proof, blocking_limit_ids: [] })), additional_requirements: [] })),
        facets: units.length ? [{ id: 'f1', covered: true, unit_ids: selectedUnits(units, catalog).map(u => u.id) }] : [], issues: [] };
}
function harness(outputs: unknown[], failRecheck = false) {
    const calls: { stage: ComposedStage; input: any }[] = []; let rechecks = 0;
    const binding = { scopeId: 'offline', buildId: 'offline', namespace: 'offline', releaseId: release.release_id, releaseVersion: release.version, releaseSha256: SOURCE_SHA, profileSha256: 'offline', sourceSha256: release.sources.map(s => s.sha256) };
    const service = createComposedAnswerService({ catalogBytes, catalogSha256: CAPABILITY_UNIT_SHA, capabilityBytes, capabilitySha256: CAPABILITY_SHA, now: () => now,
        repository: { loadForQuestion: async () => ({ verified: { release, passages: release.passages, sha256: SOURCE_SHA }, binding, candidateIds: ['S01'] }), recheck: async () => { rechecks++; if (failRecheck) throw new Error('synthetic final evidence failure'); } },
        provider: { model: 'offline', remaining: () => 15 - calls.length, invoke: async (stage, input) => { calls.push({ stage, input }); if (!outputs.length) throw new Error('unexpected additional stage'); return outputs.shift(); } } });
    return { service, calls, rechecks: () => rechecks };
}

test('accepted actual-case clarification preserves concrete gaps and explains the product boundary', async () => {
    for (const q of ['Determine the actual reason our recorded footprint changed.', 'Determine whether this documented instrument qualifies for our organization.']) {
        const a = caseAnalysis(), p = contextPlan(), h = harness([a, p, review(a, q)]);
        const result = await h.service.answer(q);
        expect(result.status).toBe('needs_input'); expect(result.reason_code).toBe('context_required');
        expect(result.message).toContain(scopeMessage); expect(result.message).not.toContain('determine the cause');
        expect(result.missing_context).toEqual(['location', 'reporting_period', 'electricity_supply']);
        expect(result.scope_gaps).toEqual([{ question_fragment: q, reason: 'context_required', context_ids: p.question_contract.parts[0]!.context_ids }]);
        expect(result.claims).toEqual([]); expect(result.evidence).toEqual([]); expect(result.sources).toEqual([]);
        expect(result.correction_attempted).toBe(false); expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'verify']); expect(h.rechecks()).toBe(1);
    }
});

test('genuine referent-only explanation remains a reviewed clarification without company-data demands', async () => {
    const q = 'What does that provision mean?', a = { operation: 'explain', parts: [{ id: 'q1', start_token: 0, kind: 'ambiguous_reference', requirements: [], ambiguity_context_ids: ['referenced_requirement'] }] };
    const h = harness([a, contextPlan(['referenced_requirement']), review(a, q)]), result = await h.service.answer(q);
    expect(result.status).toBe('needs_input'); expect(result.message).not.toContain(scopeMessage);
    expect(result.missing_context).toEqual(['referenced_requirement']); expect(result.claims).toEqual([]);
    expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'verify']);
    expect(h.calls[1]!.input.question_analysis.parts[0].requirements).toEqual([]);
});

test('mixed genuine ambiguity and identifiable assessment retain both obligations and their distinct contexts', async () => {
    const q = 'Identify that provision. Assess the implications for our site.', a = { operation: 'assess_specific_case', parts: [
        { id: 'q1', start_token: 0, kind: 'ambiguous_reference', requirements: [], ambiguity_context_ids: ['referenced_requirement'] }, requestPart('q2', 3),
    ] };
    const p = { facets: [], question_contract: { parts: [
        { id: 'q1', resolution: 'context_required', facet_ids: [], context_ids: ['referenced_requirement'] },
        { id: 'q2', resolution: 'context_required', facet_ids: [], context_ids: ['location', 'reporting_period'] },
    ] } };
    const h = harness([a, p, review(a, q)]), result = await h.service.answer(q);
    expect(result.status).toBe('needs_input'); expect(result.scope_gaps).toHaveLength(2);
    expect(result.scope_gaps.map(g => g.question_fragment).join('')).toBe(q);
    expect(result.missing_context).toEqual(['referenced_requirement', 'location', 'reporting_period']);
    expect(h.calls[2]!.input.question_analysis.parts[1].requirements).toEqual(h.calls[1]!.input.question_analysis.parts[1].requirements);
    expect(h.calls[2]!.input.question_analysis.parts[1].requirements[0].id).toBe('q2-r1');
});

test('rejected interpretation or context and final evidence failure cannot acquire the accepted scope message', async () => {
    const q = 'Assess the documented change at our site.', a = caseAnalysis();
    for (const flag of ['faithful', 'context_appropriate']) {
        const r = review(a, q); r.decision = 'fail';
        if (flag === 'faithful') { r.question_parts[0].faithful = false; r.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'The declared request omits an identifiable effect.' }]; }
        else { r.context_appropriate = false; r.issues = [{ code: 'context', target_id: 'answer', explanation: 'The proposed clarification is not useful for this request.' }]; }
        const h = harness([a, contextPlan(), r]), result = await h.service.answer(q);
        expect(result.status).toBe('needs_review'); expect(result.message).not.toContain(scopeMessage);
        expect(result.reason_code).toBe(flag === 'faithful' ? 'question_analysis_not_verified' : 'selection_not_verified');
        expect(result.missing_context).toEqual([]); expect(result.claims).toEqual([]); expect(h.calls).toHaveLength(3); expect(h.rechecks()).toBe(0);
    }
    const h = harness([a, contextPlan(), review(a, q)], true), result = await h.service.answer(q);
    expect(result.status).not.toBe('needs_input'); expect(result.message).not.toContain(scopeMessage); expect(h.calls).toHaveLength(3);
});

test('first-person conceptual explanations, comparisons and inquiries keep their accepted answer paths', async () => {
    for (const [operation, q, units, kind, subject, proof] of [
        ['explain', 'For our team, explain grid-average electricity accounting.', ['U01'], 'definition', 'accounting_methods', ['U01-C01']],
        ['compare', 'Help our team compare the two electricity accounting perspectives.', ['U01', 'U02'], 'definition', 'accounting_methods', ['U01-C01']],
        ['prepare_inquiry', 'Help me prepare questions for an electricity supplier.', ['U23'], 'inquiry_step', 'supplier_factor_inquiry', ['U23-C01']],
    ] as const) {
        const a = { operation, parts: [requestPart('q1', 0, subject, kind)] }, p = { facets: [{ id: 'f1', unit_ids: [...units] }], question_contract: { parts: [{ id: 'q1', resolution: 'source_available', facet_ids: ['f1'], context_ids: [] }] } };
        const h = harness([a, p, review(a, q, [...units], [...proof])]), result = await h.service.answer(q);
        expect(['supported', 'qualified']).toContain(result.status); expect(result.message).not.toContain(scopeMessage);
        expect(result.missing_context).toEqual([]); expect(result.claims.map(c => c.id)).toEqual(selectedUnits([...units], catalog).map(u => u.id));
        expect(h.calls).toHaveLength(3); expect(result.correction_attempted).toBe(false);
    }
});

test('source-blind packet remains exact and carries no company facts, sources or expected answer', () => {
    const q = 'Assess an observed result.', packet = analysisInput(q);
    expect(packet.original_question).toBe(q); expect(packet.question_index.tokens.map(t => t[1]).join('')).toBe(q);
    expect(Object.keys(packet)).toEqual(['original_question', 'question_index', 'taxonomy_version', 'definitions']);
    expect(hash(catalogBytes)).toBe(CAPABILITY_UNIT_SHA); expect(hash(capabilityBytes)).toBe(CAPABILITY_SHA);
});
