import { describe, expect, test } from 'bun:test';
import { hash } from '../research-passages/release';
import { resolveUnitClosure, type UnitCatalog } from './catalog';
import { demandSelectionCorrection as correctionWithCaps, initialDemand, parseDemandSelection, parseDemandSizeSelection as parseSizeWithCaps, sizeChoicePolicy, sizeChoiceVersion, type DemandSizeCorrectionPacket } from './demand-selection';
import { type CapabilityCatalog } from './capabilities';
import { type DemandState } from './demand-selection';
import { parseQuestionAnalysis } from './question-analysis';
import { questionFragment } from './question-contract';

// Declared capability type fixtures only; matching these labels is not semantic proof.
const fixtureCaps = (catalog: UnitCatalog): CapabilityCatalog => ({ units: catalog.units.map(unit => ({ unit_id: unit.id,
    capabilities: (['explanation', 'conditional_rule', 'inquiry_step'] as const).map((kind, i) => ({ id: `${unit.id}-C0${i + 1}`, kind, subject: 'generation_boundary', anchor: [0, 1] })), limits: [{ id: `${unit.id}-L01`, anchor: [0, 1] }] })) } as CapabilityCatalog);
const demandSelectionCorrection = (raw: unknown, q: string, c: UnitCatalog, d: DemandState) => correctionWithCaps(raw, q, c, d, fixtureCaps(c));
const parseDemandSizeSelection = (raw: unknown, q: string, c: UnitCatalog, d: DemandState, packet: unknown) => parseSizeWithCaps(raw, q, c, d, packet, fixtureCaps(c));

// Synthetic dependency/parser fixtures only; no source wording or task-coverage claim.
const makeCatalog = (costs: number[], deps: Record<number, number[]> = {}): UnitCatalog => ({
    schema_version: 1, catalog_id: 'synthetic', version: 'synthetic', source_release_sha256: '0'.repeat(64), condition_catalog_sha256: '0'.repeat(64),
    review: { status: 'synthetic', expires_at: '2100-01-01', source_review: {}, qa_review: {} },
    units: costs.map((cost, i) => ({ id: `U${String(i + 1).padStart(2, '0')}`, title: 'Unit', text: 'x'.repeat(cost - 4), type: 'source_summary', passage_ids: [], support: [], coverage: [], required_unit_ids: (deps[i + 1] ?? []).map(n => `U${String(n).padStart(2, '0')}`) })),
});
const question = 'Discuss violet.\nCompare amber.\nExplain indigo.';
const demand = initialDemand(parseQuestionAnalysis({ operation: 'explain', parts: [
    { id: 'q1', start_token: 0, kind: 'request', requirements: [{ kind: 'explanation', subject: 'generation_boundary' }], ambiguity_context_ids: [] },
    { id: 'q2', start_token: 2, kind: 'condition', requirements: [{ kind: 'conditional_rule', subject: 'generation_boundary' }], ambiguity_context_ids: [] },
    { id: 'q3', start_token: 4, kind: 'request', requirements: [{ kind: 'inquiry_step', subject: 'generation_boundary' }], ambiguity_context_ids: [] },
] }, question));
const proposal = (facets = [{ id: 'f1', unit_ids: ['U03'] }, { id: 'f2', unit_ids: ['U04'] }]) => ({ facets,
    question_contract: { parts: ['q1', 'q2', 'q3'].map((id, i) => ({ id, resolution: 'source_available', facet_ids: [i === 1 ? 'f2' : 'f1'], context_ids: [] as string[] })) } });
const packetFor = (catalog: UnitCatalog, previous = proposal()): DemandSizeCorrectionPacket => {
    const packet = demandSelectionCorrection(previous, question, catalog, demand);
    expect(packet?.kind).toBe('selection_size');
    if (packet?.kind !== 'selection_size') throw new Error('synthetic setup was not oversized');
    return packet;
};
const named = (packet: DemandSizeCorrectionPacket, ids: string[]) => {
    const bundle = packet.feasible_bundles.bundles.find(b => JSON.stringify(b.unit_ids) === JSON.stringify(ids));
    expect(bundle).toBeDefined(); return { bundle_id: bundle!.id, alternative_selection: [] };
};
const c = makeCatalog([800, 900, 900, 1500, 100], { 2: [1], 3: [2] });

describe('Explicit size choice projects the original closed assignments', () => {
    test('a prior companion stays assigned after its original parent is not chosen', () => {
        const previous = proposal(), packet = packetFor(c, previous), raw = named(packet, ['U01', 'U02', 'U04']);
        const before = JSON.stringify({ previous, packet, raw, demand, c });
        const plan = parseDemandSizeSelection(raw, question, c, demand, packet);
        expect(plan.facets).toEqual([{ id: 'f1', unit_ids: ['U01', 'U02'] }, { id: 'f2', unit_ids: ['U04'] }]);
        expect(plan.question_contract.parts.map(p => p.facet_ids)).toEqual([['f1'], ['f2'], ['f1']]);
        expect(plan.question_contract.parts.map(p => questionFragment(question, p)).join('')).toBe(question);
        expect(JSON.stringify({ previous, packet, raw, demand, c })).toBe(before);
        expect(packet.size_choice_provenance.previous_selection_sha256).toBe(hash(JSON.stringify(previous)));
    });
    test('shared prerequisites and noncontiguous assignments survive with exact full parts', () => {
        const shared = makeCatalog([500, 900, 900, 1800], { 2: [1], 3: [1] });
        const previous = proposal([{ id: 'f1', unit_ids: ['U02'] }, { id: 'f2', unit_ids: ['U03', 'U04'] }]), packet = packetFor(shared, previous);
        const plan = parseDemandSizeSelection(named(packet, ['U01', 'U02', 'U04']), question, shared, demand, packet);
        expect(plan.facets).toEqual([{ id: 'f1', unit_ids: ['U01', 'U02'] }, { id: 'f2', unit_ids: ['U01', 'U04'] }]);
        expect(plan.question_contract.parts.map(p => [p.id, p.kind, p.resolution, p.facet_ids, p.context_ids])).toEqual([
            ['q1', 'request', 'covered', ['f1'], []], ['q2', 'condition', 'covered', ['f2'], []], ['q3', 'request', 'covered', ['f1'], []],
        ]);
        const union = resolveUnitClosure([...new Set(plan.facets.flatMap(f => f.unit_ids))], shared).map(u => u.id);
        expect(union).toEqual(['U01', 'U02', 'U04']);
        for (const facet of plan.facets) expect(resolveUnitClosure(facet.unit_ids, shared).map(u => u.id)).toEqual(facet.unit_ids);
    });
    test('a budget-feasible bundle that empties an original facet is omitted before choices are named', () => {
        const packet = packetFor(c);
        expect(packet.feasible_bundles.bundles.some(bundle => JSON.stringify(bundle.unit_ids) === JSON.stringify(['U01', 'U02']))).toBe(false);
        expect(packet.feasible_bundles.bundles.some(bundle => JSON.stringify(bundle.unit_ids) === JSON.stringify(['U04']))).toBe(false);
        expect((packet.previous_selection as ReturnType<typeof proposal>).facets.map(f => f.id)).toEqual(['f1', 'f2']);
    });
    test('unknown choices, redundant legacy fields and any named alternative plan are rejected unchanged', () => {
        const packet = packetFor(c), choice = named(packet, ['U01', 'U02', 'U04']);
        for (const raw of [
            { ...choice, bundle_id: 'b00' }, { ...choice, bundle_id: 'b33' }, { ...choice, bundle_id: 'unknown' }, { ...choice, bundle_id: null },
            { ...choice, decision: 'answer' }, { ...choice, facets: [] }, { ...choice, alternative_selection: [proposal()] },
            { bundle_id: choice.bundle_id, ...proposal() },
        ]) { const before = JSON.stringify(raw); expect(() => parseDemandSizeSelection(raw, question, c, demand, packet)).toThrow('selection_invalid'); expect(JSON.stringify(raw)).toBe(before); }
    });
    test('altered costs, pool, bundle IDs/units/hash, predecessor and extra packet fields fail recomputation', () => {
        const packet = packetFor(c), choice = named(packet, ['U01', 'U02', 'U04']);
        const edits = [
            (p: any) => { p.feasible_bundles.pool_unit_ids.pop(); }, (p: any) => { p.feasible_bundles.bundles[0].id = 'b32'; },
            (p: any) => { p.feasible_bundles.bundles[0].unit_ids.pop(); }, (p: any) => { p.feasible_bundles.bundles[0].title_text_characters++; },
            (p: any) => { p.feasible_bundles.sha256 = '0'.repeat(64); }, (p: any) => { p.closure_title_text_characters--; },
            (p: any) => { p.exact_unit_costs[0].required_unit_ids = ['U99']; }, (p: any) => { p.size_choice_provenance.version = 'stale'; },
            (p: any) => { p.previous_selection.facets[0].unit_ids = ['U99']; }, (p: any) => { p.previous_selection.question_contract.parts.pop(); },
            (p: any) => { p.previous_selection.question_contract.parts[1].facet_ids = ['f99']; }, (p: any) => { p.extra = true; },
        ];
        for (const edit of edits) { const changed = structuredClone(packet); edit(changed); expect(() => parseDemandSizeSelection(choice, question, c, demand, changed)).toThrow('selection_invalid'); }
    });
    test('stale full catalog, question or cumulative demand cannot reuse an older packet', () => {
        const packet = packetFor(c), choice = named(packet, ['U01', 'U02', 'U04']);
        const outsideChanged = structuredClone(c); outsideChanged.units[4]!.text += 'x';
        expect(() => parseDemandSizeSelection(choice, question, outsideChanged, demand, packet)).toThrow('selection_invalid');
        expect(() => parseDemandSizeSelection(choice, question + ' ', c, demand, packet)).toThrow('selection_invalid');
        const additions = [{ part_id: 'q1', requirements: [{ id: 'q1-a1', kind: 'limitation' as const, subject: 'generation_boundary' as const }] }];
        const next = { analysis: demand.analysis, additions, seal_sha256: hash(JSON.stringify({ initial_seal_sha256: demand.analysis.seal_sha256, additions })) };
        expect(() => parseDemandSizeSelection(choice, question, c, next, packet)).toThrow('selection_invalid');
    });
    test('manual may select a different approved unit outside the prior pool under the same full parser', () => {
        const packet = packetFor(c), alternative = proposal([{ id: 'f1', unit_ids: ['U05'] }, { id: 'f2', unit_ids: ['U05'] }]);
        expect(packet.feasible_bundles.pool_unit_ids).not.toContain('U05');
        const raw = { bundle_id: 'manual', alternative_selection: [alternative] };
        expect(parseDemandSizeSelection(raw, question, c, demand, packet)).toEqual(parseDemandSelection(alternative, question, c, demand));
        for (const alternatives of [[], [alternative, alternative]]) expect(() => parseDemandSizeSelection({ ...raw, alternative_selection: alternatives }, question, c, demand, packet)).toThrow('selection_invalid');
        expect(() => parseDemandSizeSelection({ bundle_id: 'manual', alternative_selection: [proposal()] }, question, c, demand, packet)).toThrow('selection_too_large');
        const missing = structuredClone(alternative); missing.question_contract.parts.pop();
        expect(() => parseDemandSizeSelection({ bundle_id: 'manual', alternative_selection: [missing] }, question, c, demand, packet)).toThrow('selection_invalid');
    });
    test('none accepts one complete whole boundary only; all actual withheld states stay explicit', () => {
        const packet = packetFor(c), alternative = { facets: [], question_contract: { parts: ['q1', 'q2', 'q3'].map((id, i) => ({ id, resolution: i === 1 ? 'coverage_missing' : 'withheld', facet_ids: [], context_ids: [] })) } };
        const plan = parseDemandSizeSelection({ bundle_id: 'none', alternative_selection: [alternative] }, question, c, demand, packet);
        expect(plan.question_contract.parts.map(p => p.resolution)).toEqual(['not_answered', 'coverage_missing', 'not_answered']);
        expect(() => parseDemandSizeSelection({ bundle_id: 'none', alternative_selection: [] }, question, c, demand, packet)).toThrow('selection_invalid');
        expect(() => parseDemandSizeSelection({ bundle_id: 'manual', alternative_selection: [alternative] }, question, c, demand, packet)).toThrow('selection_invalid');
        expect(() => parseDemandSizeSelection({ bundle_id: 'none', alternative_selection: [proposal([{ id: 'f1', unit_ids: ['U05'] }, { id: 'f2', unit_ids: ['U05'] }])] }, question, c, demand, packet)).toThrow('selection_invalid');
    });
    test('a malformed oversized original gets only its original contract diagnostic, never a size choice', () => {
        const malformed = proposal(); malformed.question_contract.parts[1]!.facet_ids = ['f99'];
        const packet = demandSelectionCorrection(malformed, question, c, demand);
        expect(packet?.kind).toBe('selection_contract'); expect(packet).not.toHaveProperty('feasible_bundles');
        expect(() => parseDemandSizeSelection({ bundle_id: 'b01', alternative_selection: [] }, question, c, demand, packet)).toThrow('selection_invalid');
    });
    test('versioned policy is frozen and explicitly leaves semantic acceptance to fresh review', () => {
        expect(Object.isFrozen(sizeChoicePolicy)).toBe(true);
        expect(sizeChoicePolicy.schema_version).toBe(sizeChoiceVersion);
        expect(sizeChoicePolicy.review).toContain('fresh semantic review');
    });
});
