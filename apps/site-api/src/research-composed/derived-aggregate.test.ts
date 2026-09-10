import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { hash, parsePassageRelease } from '../research-passages/release';
import { SOURCE_SHA, parseUnitCatalog } from './catalog';
import { parseQuestionAnalysis } from './question-analysis';
import { demandInput, initialDemand, parseDemandSelection, type DemandState } from './demand-selection';
import { createComposedAnswerService } from './answer';
import { CAPABILITY_SHA } from './capabilities';
import { planSchemaForInput, type ComposedStage } from './provider';

const now = Date.parse('2026-09-12T12:00:00Z');
const read = (path: string) => readFileSync(new URL(`../../../../${path}`, import.meta.url));
const release = parsePassageRelease(JSON.parse(read('data/research/releases/scope2-website.v1.json').toString()), now);
const verified = { release, passages: release.passages, sha256: SOURCE_SHA };
const bytes = read('data/research/answer-units/scope2-website.epa-acquisition.v1.json'), catalogSha = hash(bytes);
const catalog = parseUnitCatalog(bytes, catalogSha, verified, now).catalog;
const capabilityBytes = read('data/research/capabilities/scope2-website.epa-limitations.v1.json');
const question = 'Explain this concept. Explain another concept. Explain a third concept.';
const analysis = (operation = 'explain') => ({ operation, parts: [0, 3, 6].map((start_token, i) => ({ id: `q${i + 1}`, start_token, kind: 'request', requirements: [{ kind: 'definition', subject: 'accounting_methods' }], ambiguity_context_ids: [] })) });
const demand = initialDemand(parseQuestionAnalysis(analysis(), question));
const boundary = (states: string[]): any => ({ facets: [], question_contract: { parts: states.map((resolution, i) => ({ id: `q${i + 1}`, resolution, facet_ids: [], context_ids: resolution === 'context_required' ? ['referenced_subject'] : [] })) } });
const answer = (): any => ({ facets: [{ id: 'f1', unit_ids: ['U01'] }], question_contract: { parts: [1, 2, 3].map(i => ({ id: `q${i}`, resolution: 'source_available', facet_ids: ['f1'], context_ids: [] })) } });

test('existing canonical precedence derives the aggregate after complete validation', () => {
    for (const [states, decision, reason] of [
        [['context_required', 'withheld', 'withheld'], 'needs_input', 'context_required'],
        [['context_required', 'coverage_missing', 'withheld'], 'unsupported', 'coverage_missing'],
        [['context_required', 'coverage_missing', 'action_out_of_scope'], 'unsupported', 'action_out_of_scope'],
    ] as const) {
        const p = boundary([...states]), before = structuredClone(p), result = parseDemandSelection(p, question, catalog, demand);
        expect(result.decision).toBe(decision); expect(result.reason).toBe(reason); expect(p).toEqual(before);
        expect(result.question_contract.parts.map(p => p.resolution)).toEqual(states.map(s => s === 'withheld' ? 'not_answered' : s));
    }
    const result = parseDemandSelection(answer(), question, catalog, demand);
    expect(result.decision).toBe('answer'); expect(result.reason).toBe('covered');
    expect(result.question_contract.parts.at(-1)!.end_token).toBe(10);
});

test('legacy aggregates and invalid references cannot be ignored during derivation', () => {
    for (const extra of [{ decision: 'answer' }, { reason: 'covered' }, { decision: 'unsupported', reason: 'coverage_missing' }])
        expect(() => parseDemandSelection({ ...answer(), ...extra }, question, catalog, demand)).toThrow('selection_invalid');
    const variants = [boundary(['withheld', 'withheld', 'withheld']), boundary(['source_available', 'coverage_missing', 'withheld'])];
    const missing = answer(); missing.question_contract.parts.pop(); variants.push(missing);
    const reordered = answer(); reordered.question_contract.parts.reverse(); variants.push(reordered);
    const foreign = answer(); foreign.question_contract.parts[0].facet_ids = ['f99']; variants.push(foreign);
    const context = boundary(['context_required', 'withheld', 'withheld']); context.question_contract.parts[0].context_ids = ['invented']; variants.push(context);
    const unknownUnit = answer(); unknownUnit.facets[0].unit_ids = ['U99']; variants.push(unknownUnit);
    for (const p of variants) expect(() => parseDemandSelection(p, question, catalog, demand)).toThrow();
});

test('calculation and filing need their own explicit action gap; derivation never invents one', () => {
    for (const operation of ['calculate', 'submit_or_file']) {
        const d = initialDemand(parseQuestionAnalysis(analysis(operation), question));
        expect(() => parseDemandSelection(answer(), question, catalog, d)).toThrow('selection_invalid');
        expect(() => parseDemandSelection(boundary(['context_required', 'withheld', 'withheld']), question, catalog, d)).toThrow('selection_invalid');
        expect(parseDemandSelection(boundary(['context_required', 'withheld', 'action_out_of_scope']), question, catalog, d).reason).toBe('action_out_of_scope');
    }
});

test('normal and size-alternative schemas expose only the two fields, with isolated nested state', () => {
    const input = { original_question: question, question_analysis: demandInput(demand, question) };
    const normal: any = planSchemaForInput(input, false), size: any = planSchemaForInput(input, true);
    expect(normal.required).toEqual(['question_contract', 'facets']); expect(normal.additionalProperties).toBe(false);
    expect(size.properties.alternative_selection.items).toEqual(normal);
    normal.properties.question_contract.properties.parts.items.properties.id.enum.push('foreign');
    expect((planSchemaForInput(input, false) as any).properties.question_contract.properties.parts.items.properties.id.enum).toEqual(['q1', 'q2', 'q3']);
    expect(size.properties.alternative_selection.items.properties.decision).toBeUndefined();
});

// Entirely authored synthetic fixture: no private traces, model outputs or benchmark answer key.
const syntheticQuestion = 'Identify the referenced policy. Explain a synthetic adjustment. Explain a synthetic target effect.';
const syntheticAnalysis = () => ({ operation: 'explain', parts: [
    { id: 'q1', start_token: 0, kind: 'ambiguous_reference', requirements: [], ambiguity_context_ids: ['referenced_requirement'] },
    { id: 'q2', start_token: 4, kind: 'request', requirements: [{ kind: 'explanation', subject: 'methodology_adjustment' }], ambiguity_context_ids: [] },
    { id: 'q3', start_token: 8, kind: 'request', requirements: [{ kind: 'explanation', subject: 'unrepresented_subject' }], ambiguity_context_ids: [] },
] });
const clarifiedParts = (): any => ({ facets: [], question_contract: { parts: [
    { id: 'q1', resolution: 'context_required', facet_ids: [], context_ids: ['referenced_requirement'] },
    { id: 'q2', resolution: 'withheld', facet_ids: [], context_ids: [] },
    { id: 'q3', resolution: 'coverage_missing', facet_ids: [], context_ids: [] },
] } });
test('synthetic mixed withholding preserves the declared gap and ambiguity without repairing invalid inputs', () => {
    const d = initialDemand(parseQuestionAnalysis(syntheticAnalysis(), syntheticQuestion));
    const legacyAggregate = { ...clarifiedParts(), decision: 'needs_input', reason: 'context_required' };
    const mixedFacet = clarifiedParts(); mixedFacet.question_contract.parts[1].facet_ids = ['f1'];
    for (const original of [legacyAggregate, mixedFacet]) {
        const before = structuredClone(original);
        expect(() => parseDemandSelection(original, syntheticQuestion, catalog, d)).toThrow('selection_invalid'); expect(original).toEqual(before);
    }
    const p = clarifiedParts(), result = parseDemandSelection(p, syntheticQuestion, catalog, d);
    expect(result.reason).toBe('coverage_missing'); expect(result.decision).toBe('unsupported');
    expect(result.question_contract.parts.map(p => [p.id, p.resolution, p.context_ids])).toEqual([['q1', 'context_required', ['referenced_requirement']], ['q2', 'not_answered', []], ['q3', 'coverage_missing', []]]);
    p.question_contract.parts[1].facet_ids = ['f1'];
    expect(() => parseDemandSelection(p, syntheticQuestion, catalog, d)).toThrow('selection_invalid');
});

function harness(outputs: unknown[]) {
    const calls: { stage: ComposedStage; input: any }[] = [];
    const binding = { scopeId: 'offline', buildId: 'offline', namespace: 'offline', releaseId: release.release_id, releaseVersion: release.version, releaseSha256: SOURCE_SHA, profileSha256: 'offline', sourceSha256: release.sources.map(s => s.sha256) };
    const service = createComposedAnswerService({ catalogBytes: bytes, catalogSha256: catalogSha, capabilityBytes, capabilitySha256: CAPABILITY_SHA, now: () => now,
        repository: { loadForQuestion: async () => ({ verified, binding, candidateIds: ['S01'] }), recheck: async () => {} },
        provider: { model: 'offline', remaining: () => 40 - calls.length, invoke: async (stage, input) => { calls.push({ stage, input }); return outputs.shift(); } } });
    return { service, calls };
}
const review = (d: DemandState): any => ({ decision: 'pass', facets: [], decomposition_complete: true, relevant: true, scope_appropriate: true, context_appropriate: true, premise_handled: true, task_fit: true, proportionate: true,
    question_parts: d.analysis.parts.map(p => ({ id: p.id, faithful: true, appropriately_resolved: true, requirements: p.requirements.map(r => ({ id: r.id, capability_ids: [], blocking_limit_ids: [] })), additional_requirements: [] })), issues: [] });

test('a fresh negative gap review after the sole structural correction cannot become an answer or another attempt', async () => {
    const a = syntheticAnalysis(), d = initialDemand(parseQuestionAnalysis(a, syntheticQuestion)), invalid = clarifiedParts(); invalid.question_contract.parts[1].facet_ids = ['f1'];
    const negative = review(d); negative.decision = 'revise'; negative.question_parts[2].appropriately_resolved = false;
    negative.issues = [{ code: 'question_part', target_id: 'q3', explanation: 'The requested effect remains dependent on the unresolved requirement; this independent gap is not established.' }];
    const h = harness([a, invalid, clarifiedParts(), negative, clarifiedParts(), review(d)]), result = await h.service.answer(syntheticQuestion);
    expect(result.status).toBe('needs_review'); expect(result.reason_code).toBe('selection_not_verified'); expect(result.claims).toEqual([]);
    expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'plan', 'verify']);
    expect(h.calls[3]!.input.selection.reason).toBe('coverage_missing'); expect(h.calls[3]!.input.review_mode).toBeUndefined();
    expect(h.calls[3]!.input.question_analysis.parts.map((p: any) => p.requirements)).toEqual(h.calls[1]!.input.question_analysis.parts.map((p: any) => p.requirements));
});

test('pure ambiguity still needs an ordinary fresh review, and false fidelity remains terminal', async () => {
    const q = 'What does that mean?', a = { operation: 'explain', parts: [{ id: 'q1', start_token: 0, kind: 'ambiguous_reference', requirements: [], ambiguity_context_ids: ['referenced_subject'] }] };
    const d = initialDemand(parseQuestionAnalysis(a, q)), p = { facets: [], question_contract: { parts: [{ id: 'q1', resolution: 'context_required', facet_ids: [], context_ids: ['referenced_subject'] }] } };
    const h = harness([a, p, review(d)]), result = await h.service.answer(q);
    expect(result.status).toBe('needs_input'); expect(result.missing_context).toEqual(['referenced_subject']); expect(result.claims).toEqual([]);
    expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'verify']); expect(h.calls[2]!.input.review_mode).toBeUndefined();
    const rejected = review(d); rejected.decision = 'fail'; rejected.question_parts[0].faithful = false; rejected.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'The hypothetical sealed reference is unfaithful.' }];
    const bad = harness([a, p, rejected]), failure = await bad.service.answer(q);
    expect(failure.reason_code).toBe('question_analysis_not_verified'); expect(failure.claims).toEqual([]); expect(bad.calls).toHaveLength(3);
});
