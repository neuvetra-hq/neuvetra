import { describe, expect, test } from 'bun:test';
import { hash } from '../research-passages/release';
import { type UnitCatalog } from './catalog';
import { capabilityMatchPolicy, type Capability, type CapabilityCatalog } from './capabilities';
import { demandSelectionCorrection, initialDemand, parseDemandSizeSelection, type DemandState } from './demand-selection';
import { parseQuestionAnalysis } from './question-analysis';
import { prepareSizeBundles } from './size-bundles';

// Synthetic label/dependency fixtures only. These tests do not prove source meaning.
const catalog = (): UnitCatalog => ({ schema_version: 1, catalog_id: 'synthetic', version: 'synthetic', source_release_sha256: '0'.repeat(64), condition_catalog_sha256: '0'.repeat(64),
    review: { status: 'synthetic', expires_at: '2100-01-01', source_review: {}, qa_review: {} },
    units: Array.from({ length: 10 }, (_, i) => ({ id: `U${String(i + 1).padStart(2, '0')}`, title: 'Unit', text: 'x'.repeat(496), type: 'source_summary', passage_ids: [], support: [], coverage: [], required_unit_ids: [] })) });
const ids = Array.from({ length: 9 }, (_, i) => `U${String(i + 1).padStart(2, '0')}`);
const q = 'Describe violet. Explain amber.';
const route = { kind: 'source_route', subject: 'supplier_factor_inquiry' } as const;
const rule = { kind: 'conditional_rule', subject: 'generation_boundary' } as const;
const makeDemand = (first = route, second = rule) => initialDemand(parseQuestionAnalysis({ operation: 'explain', parts: [
    { id: 'q1', start_token: 0, kind: 'request', requirements: [first], ambiguity_context_ids: [] },
    { id: 'q2', start_token: 2, kind: 'request', requirements: [second], ambiguity_context_ids: [] },
] }, q));
const d = makeDemand();
const plan = (shared = true) => ({ facets: [{ id: 'f1', unit_ids: ids.slice(0, 4) }, { id: 'f2', unit_ids: ids.slice(4) }],
    question_contract: { parts: ['q1', 'q2'].map((id, i) => ({ id, resolution: 'source_available', facet_ids: shared ? ['f1', 'f2'] : [`f${i + 1}`], context_ids: [] })) } });
type Labels = Pick<Capability, 'kind' | 'subject'>;
const caps = (labels: Record<string, Labels[]>, c = catalog()): CapabilityCatalog => ({ units: c.units.map(unit => ({ unit_id: unit.id,
    capabilities: (labels[unit.id] ?? []).map((label, i) => ({ ...label, id: `${unit.id}-C0${i + 1}`, anchor: [0, 1] })),
    limits: [{ id: `${unit.id}-L01`, anchor: [0, 1] }] })) } as CapabilityCatalog);
const good = () => caps({ U01: [route], U05: [rule] });
const packet = (capabilities = good(), demand = d, previous = plan(), c = catalog()) => {
    const result = demandSelectionCorrection(previous, q, c, demand, capabilities);
    if (result?.kind !== 'selection_size') throw new Error('Synthetic oversize setup failed');
    return result;
};
const named = (p: ReturnType<typeof packet>) => ({ bundle_id: p.feasible_bundles.bundles[0]!.id, alternative_selection: [] });

describe('Named size candidates require cumulative part-owned capability matches', () => {
    test('false eligibility does not prune additions and filtering occurs before top32', () => {
        const c = catalog();
        const ordinary = prepareSizeBundles(ids, c);
        expect(ordinary.bundles.some(b => b.unit_ids.join(',') === 'U01,U09')).toBe(false);
        const filtered = prepareSizeBundles(ids, c, own => own.join(',') === 'U01,U09');
        expect(filtered.bundles.map(b => b.unit_ids)).toEqual([['U01', 'U09']]);
        expect(filtered.eligible_candidates_seen).toBe(1);
        expect(filtered.feasible_candidates_seen).toBe(ordinary.feasible_candidates_seen);
        expect(filtered.visited).toBe(ordinary.visited);
        expect(filtered.output_limited).toBe(false);
    });
    test('each need may be supported across the same part\'s multiple assigned facets', () => {
        const additions = [{ part_id: 'q1', requirements: [{ ...rule, id: 'q1-a1' }] }];
        const demand: DemandState = { analysis: d.analysis, additions, seal_sha256: hash(JSON.stringify({ initial_seal_sha256: d.analysis.seal_sha256, additions })) };
        const p = packet(good(), demand);
        expect(p.feasible_bundles.bundles.length).toBeGreaterThan(0);
        for (const b of p.feasible_bundles.bundles) { expect(b.unit_ids).toContain('U01'); expect(b.unit_ids).toContain('U05'); }
        const parsed = parseDemandSizeSelection(named(p), q, catalog(), demand, p, good());
        expect(parsed.question_contract.parts.map(part => part.facet_ids)).toEqual([['f1', 'f2'], ['f1', 'f2']]);
    });
    test('another part\'s potential support cannot be borrowed across assignments', () => {
        const foreign = caps({ U01: [rule], U05: [route] });
        expect(packet(foreign, d, plan(true)).feasible_bundles.bundles.length).toBeGreaterThan(0);
        expect(packet(foreign, d, plan(false)).feasible_bundles.bundles).toEqual([]);
        expect(packet(good(), d, plan(false)).feasible_bundles.bundles.length).toBeGreaterThan(0);
    });
    test('source-route wrong subject, wrong kind, or an independently missing need eliminates named choices', () => {
        for (const label of [{ kind: 'source_route', subject: 'grid_factor_source' }, { kind: 'inquiry_step', subject: 'supplier_factor_inquiry' }] as Labels[]) {
            expect(packet(caps({ U01: [label], U05: [rule] })).feasible_bundles.bundles).toEqual([]);
        }
        expect(packet(caps({ U01: [route] })).feasible_bundles.bundles).toEqual([]);
        const missing = structuredClone(d); (missing.analysis.parts[0]!.requirements[0] as { subject: string }).subject = 'unrepresented_subject';
        expect(packet(good(), missing).feasible_bundles.bundles).toEqual([]);
    });
    test('conceptual flexibility remains broad and limits do not remove present capability matches', () => {
        const conceptual = initialDemand(parseQuestionAnalysis({ operation: 'explain', parts: [
            { id: 'q1', start_token: 0, kind: 'request', requirements: [{ kind: 'explanation', subject: 'accounting_methods' }], ambiguity_context_ids: [] },
            { id: 'q2', start_token: 2, kind: 'request', requirements: [rule], ambiguity_context_ids: [] },
        ] }, q));
        const c = good(); expect(c.units.every(unit => unit.limits.length > 0)).toBe(true);
        expect(packet(c, conceptual).feasible_bundles.bundles.length).toBeGreaterThan(0);
        expect(packet(c).feasible_bundles.bundles.length).toBeGreaterThan(0);
    });
    test('cumulative additions narrow choices, alter provenance, and invalidate older packets', () => {
        const c = caps({ U01: [route], U05: [rule], U09: [{ kind: 'limitation', subject: 'generation_boundary' }] });
        const old = packet(c), additions = [{ part_id: 'q1', requirements: [{ id: 'q1-a1', kind: 'limitation' as const, subject: 'generation_boundary' as const }] }];
        const next: DemandState = { analysis: d.analysis, additions, seal_sha256: hash(JSON.stringify({ initial_seal_sha256: d.analysis.seal_sha256, additions })) };
        const updated = packet(c, next);
        expect(updated.feasible_bundles.bundles.length).toBeGreaterThan(0);
        expect(updated.feasible_bundles.bundles.every(b => b.unit_ids.includes('U09'))).toBe(true);
        expect(updated.size_choice_provenance.demand_record_sha256).not.toBe(old.size_choice_provenance.demand_record_sha256);
        expect(() => parseDemandSizeSelection(named(old), q, catalog(), next, old, c)).toThrow('selection_invalid');
    });
    test('full capability record and predicate identity are bound before every named/manual/none choice', () => {
        const c = good(), p = packet(c);
        expect(p.size_choice_provenance.capability_record_sha256).toBe(hash(JSON.stringify(c)));
        expect(p.size_choice_provenance.predicate_sha256).toBe(capabilityMatchPolicy.predicate_sha256);
        for (const field of ['capability_record_sha256', 'predicate_sha256', 'predicate_version'] as const) {
            const altered = structuredClone(p); (altered.size_choice_provenance as Record<string, string>)[field] = 'tampered';
            expect(() => parseDemandSizeSelection(named(p), q, catalog(), d, altered, c)).toThrow('selection_invalid');
        }
        const changed = structuredClone(c); changed.units[9]!.limits[0]!.anchor = [0, 2];
        expect(() => parseDemandSizeSelection(named(p), q, catalog(), d, p, changed)).toThrow('selection_invalid');
        expect(() => parseDemandSizeSelection(named(p), q, catalog(), d, p, undefined as unknown as CapabilityCatalog)).toThrow('selection_invalid');
    });
    test('no named option is not an absence verdict; explicit manual full-catalog and none remain', () => {
        const c = caps({}), p = packet(c);
        expect(p.feasible_bundles.bundles).toEqual([]);
        const alternate = plan(); alternate.facets.forEach(facet => { facet.unit_ids = ['U10']; });
        const parsed = parseDemandSizeSelection({ bundle_id: 'manual', alternative_selection: [alternate] }, q, catalog(), d, p, c);
        expect(parsed.facets.every(facet => facet.unit_ids.includes('U10'))).toBe(true);
        const boundary = { facets: [], question_contract: { parts: ['q1', 'q2'].map(id => ({ id, resolution: 'coverage_missing', facet_ids: [], context_ids: [] })) } };
        expect(parseDemandSizeSelection({ bundle_id: 'none', alternative_selection: [boundary] }, q, catalog(), d, p, c).decision).toBe('unsupported');
        expect(() => parseDemandSizeSelection({ bundle_id: 'b01', alternative_selection: [] }, q, catalog(), d, p, c)).toThrow('selection_invalid');
    });
    test('shared companion capabilities stay in each projected own closure without mutating records', () => {
        const c = catalog(); c.units[1]!.required_unit_ids = ['U01']; c.units[4]!.required_unit_ids = ['U01'];
        const cap = caps({ U01: [route, rule] }, c), previous = plan(false), before = JSON.stringify({ c, cap, previous, d });
        const p = packet(cap, d, previous, c);
        expect(p.feasible_bundles.bundles.length).toBeGreaterThan(0);
        const result = parseDemandSizeSelection(named(p), q, c, d, p, cap);
        expect(result.facets.every(facet => facet.unit_ids.includes('U01'))).toBe(true);
        expect(JSON.stringify({ c, cap, previous, d })).toBe(before);
        expect(p.feasible_bundles.visited).toBeLessThanOrEqual(32768);
        expect(p.feasible_bundles.bundles.length).toBeLessThanOrEqual(32);
        expect(Buffer.byteLength(JSON.stringify(p.feasible_bundles))).toBeLessThanOrEqual(10000);
    });
});
