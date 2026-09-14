import { describe, expect, test } from 'bun:test';
import { hash } from '../research-passages/release';
import { compositionLimits, resolveUnitClosure, titleTextCharacters, type UnitCatalog } from './catalog';
import { prepareSizeBundles, sizeBundleLimits, sizeBundlePolicy } from './size-bundles';
import { demandSelectionCorrection as correctionWithCaps, initialDemand, parseDemandSizeSelection as parseSizeWithCaps } from './demand-selection';
import { type CapabilityCatalog } from './capabilities';
import { type DemandState } from './demand-selection';
import { parseQuestionAnalysis } from './question-analysis';

// Declared capability type fixtures only; matching these labels is not semantic proof.
const fixtureCaps = (catalog: UnitCatalog): CapabilityCatalog => ({ units: catalog.units.map(unit => ({ unit_id: unit.id,
    capabilities: (['explanation', 'conditional_rule', 'inquiry_step'] as const).map((kind, i) => ({ id: `${unit.id}-C0${i + 1}`, kind, subject: 'generation_boundary', anchor: [0, 1] })), limits: [{ id: `${unit.id}-L01`, anchor: [0, 1] }] })) } as CapabilityCatalog);
const demandSelectionCorrection = (raw: unknown, q: string, c: UnitCatalog, d: DemandState) => correctionWithCaps(raw, q, c, d, fixtureCaps(c));
const parseDemandSizeSelection = (raw: unknown, q: string, c: UnitCatalog, d: DemandState, packet: unknown) => parseSizeWithCaps(raw, q, c, d, packet, fixtureCaps(c));

// Synthetic parser/search fixtures only, never source content or semantic proof.
const catalog = (costs: number[], dependencies: Record<number, number[]> = {}): UnitCatalog => ({
    schema_version: 1, catalog_id: 'synthetic', version: 'synthetic', source_release_sha256: '0'.repeat(64), condition_catalog_sha256: '0'.repeat(64),
    review: { status: 'synthetic', expires_at: '2100-01-01', source_review: {}, qa_review: {} },
    units: costs.map((cost, i) => ({ id: `U${String(i + 1).padStart(2, '0')}`, title: 'Unit', text: 'x'.repeat(cost - 4), type: 'source_summary', passage_ids: [], support: [], coverage: [],
        required_unit_ids: (dependencies[i + 1] ?? []).map(n => `U${String(n).padStart(2, '0')}`) })),
});
const ids = (c: UnitCatalog) => c.units.map(unit => unit.id);
const verify = (c: UnitCatalog, set: ReturnType<typeof prepareSizeBundles>) => {
    expect(set.bundles.length).toBeLessThanOrEqual(32);
    expect(set.visited).toBeLessThanOrEqual(32768);
    expect(Buffer.byteLength(JSON.stringify(set))).toBeLessThanOrEqual(10000);
    expect(set.bundles.map(bundle => bundle.id)).toEqual(set.bundles.map((_bundle, i) => `b${String(i + 1).padStart(2, '0')}`));
    expect(new Set(set.bundles.map(bundle => bundle.unit_ids.join(','))).size).toBe(set.bundles.length);
    for (const bundle of set.bundles) {
        const closure = resolveUnitClosure([...bundle.unit_ids], c);
        expect(closure.map(unit => unit.id)).toEqual([...bundle.unit_ids]);
        expect(bundle.unit_count).toBe(closure.length);
        expect(bundle.title_text_characters).toBe(titleTextCharacters(closure));
        expect(bundle.unit_count).toBeGreaterThan(0);
        expect(bundle.unit_count).toBeLessThanOrEqual(compositionLimits.maxUnits);
        expect(bundle.title_text_characters).toBeLessThanOrEqual(compositionLimits.maxTitleTextCharacters);
        expect(bundle.unit_ids.every(id => set.pool_unit_ids.includes(id))).toBe(true);
    }
    const { sha256, ...record } = set;
    expect(hash(JSON.stringify(record))).toBe(sha256);
};

describe('Bounded deterministic closed-subset assistance', () => {
    test('small exhaustive oracle agrees with every feasible subset, including the exact character boundary', () => {
        const c = catalog([1000, 1000, 1000, 1000, 1000]), set = prepareSizeBundles(ids(c), c);
        const oracle: string[] = [];
        for (let mask = 1; mask < 1 << 5; mask++) {
            const subset = ids(c).filter((_id, i) => mask & (1 << i));
            if (subset.length <= 4) oracle.push(subset.join(','));
        }
        expect(set.bundles.map(bundle => bundle.unit_ids.join(',')).sort()).toEqual(oracle.sort());
        expect(set.search_limited).toBe(false); expect(set.output_limited).toBe(false);
        expect(set.bundles.some(bundle => bundle.title_text_characters === 4000)).toBe(true);
        verify(c, set);
    });
    test('mandatory transitive companions remain in every returned subset', () => {
        const c = catalog(Array(9).fill(100), Object.fromEntries(Array.from({ length: 8 }, (_v, i) => [i + 2, [i + 1]])));
        const set = prepareSizeBundles(['U09'], c);
        expect(set.bundles).toHaveLength(8);
        expect(set.bundles.map(bundle => bundle.unit_count).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(set.bundles.some(bundle => bundle.unit_ids.includes('U09'))).toBe(false);
        verify(c, set);
    });
    test('shared companions count once and no unit outside the original closure enters an option', () => {
        const c = catalog([1000, 1100, 1200, 1300, 50], { 2: [1], 3: [1], 4: [1] });
        const set = prepareSizeBundles(['U02', 'U03', 'U04'], c);
        expect(set.pool_unit_ids).toEqual(['U01', 'U02', 'U03', 'U04']);
        expect(set.bundles.some(bundle => bundle.unit_ids.join(',') === 'U01,U02,U03' && bundle.title_text_characters === 3300)).toBe(true);
        expect(JSON.stringify(set.bundles)).not.toContain('U05');
        verify(c, set);
    });
    test('a 24-unit pool produces feasible options within the hard visit and row ceilings', () => {
        const c = catalog(Array(24).fill(100)), set = prepareSizeBundles(ids(c), c);
        expect(set.bundles).toHaveLength(32); expect(set.visited).toBe(32768);
        expect(set.search_limited).toBe(true); expect(set.output_limited).toBe(true);
        expect(set.bundles.every(bundle => bundle.unit_count === 8)).toBe(true);
        expect(set.limitation).toContain('may omit useful alternatives');
        expect(set.limitation).toContain('no completeness or task-coverage claim');
        verify(c, set);
    });
    test('canonical results do not depend on direct ID order or duplicate declarations across facets', () => {
        const c = catalog(Array(9).fill(700)), forward = ids(c), reverse = [...forward].reverse();
        expect(prepareSizeBundles(forward, c)).toEqual(prepareSizeBundles([...reverse, ...reverse], c));
    });
    test('ranking follows retained roots and units, then exact cost and canonical IDs without semantic claims', () => {
        const c = catalog([800, 900, 1000, 1100, 1200]), set = prepareSizeBundles(ids(c), c);
        for (let i = 1; i < set.bundles.length; i++) {
            const previous = set.bundles[i - 1]!, current = set.bundles[i]!;
            expect(previous.unit_count >= current.unit_count).toBe(true);
            if (previous.unit_count === current.unit_count) expect(previous.title_text_characters <= current.title_text_characters).toBe(true);
        }
        expect(set.ranking).toContain('not a semantic ranking'); verify(c, set);
    });
    test('the assistance byte ceiling removes whole candidate rows and exposes output omission', () => {
        const c = catalog(Array(9).fill(100)); c.units.forEach(unit => { unit.id += 'z'.repeat(500); });
        const set = prepareSizeBundles(ids(c), c);
        expect(set.bundles.length).toBeLessThan(32); expect(set.output_limited).toBe(true);
        expect(set.pool_unit_ids).toEqual(ids(c)); verify(c, set);
    });
    test('oversized assistance metadata itself fails instead of shortening identifiers', () => {
        const c = catalog(Array(9).fill(100)); c.units.forEach(unit => { unit.id += 'z'.repeat(2000); });
        expect(() => prepareSizeBundles(ids(c), c)).toThrow('size_bundle_packet_too_large');
    });
    test('no feasible option stays explicit and does not claim missing evidence', () => {
        const c = catalog([4100, 4200]), set = prepareSizeBundles(ids(c), c);
        expect(set.bundles).toEqual([]); expect(set.search_limited).toBe(false); expect(set.output_limited).toBe(false);
        expect(set.limitation).toContain('not proof of missing source evidence'); verify(c, set);
    });
    test('inputs stay unchanged and all returned nested data and public policy are frozen', () => {
        const c = catalog(Array(9).fill(100)), roots = ids(c), snapshot = structuredClone(c), set = prepareSizeBundles(roots, c);
        expect(c).toEqual(snapshot); expect(roots).toEqual(ids(c));
        expect(Object.isFrozen(set)).toBe(true); expect(Object.isFrozen(set.bundles)).toBe(true);
        expect(Object.isFrozen(set.bundles[0]!.unit_ids)).toBe(true); expect(Object.isFrozen(set.limits)).toBe(true);
        expect(Object.isFrozen(sizeBundlePolicy)).toBe(true); expect(Object.isFrozen(sizeBundleLimits)).toBe(true);
        expect(() => (set.bundles[0]!.unit_ids as string[]).push('outside')).toThrow();
        expect(c).toEqual(snapshot);
    });
    test('unknown IDs, cycles, excessive pools and already-small requests cannot obtain size assistance', () => {
        expect(() => prepareSizeBundles(['U99'], catalog([100]))).toThrow('selection_invalid');
        expect(() => prepareSizeBundles([], catalog([100]))).toThrow('size_bundle_invalid');
        expect(() => prepareSizeBundles(['U01'], catalog([100], { 1: [1] }))).toThrow('unit_catalog_invalid');
        const tooMany = catalog(Array(25).fill(100)); expect(() => prepareSizeBundles(ids(tooMany), tooMany)).toThrow('size_bundle_pool_too_large');
        expect(() => prepareSizeBundles(['U01'], catalog([100]))).toThrow('size_bundle_not_oversized');
    });
});

const question = 'Describe the first feature and the second feature.';
const demand = initialDemand(parseQuestionAnalysis({ operation: 'explain', parts: [
    { id: 'q1', start_token: 0, kind: 'request', requirements: [{ kind: 'explanation', subject: 'generation_boundary' }], ambiguity_context_ids: [] },
    { id: 'q2', start_token: 5, kind: 'request', requirements: [{ kind: 'explanation', subject: 'generation_boundary' }], ambiguity_context_ids: [] },
] }, question));
const c = catalog(Array(9).fill(100));
const original = (unit_ids = ids(c)) => ({ facets: [{ id: 'f1', unit_ids }],
    question_contract: { parts: ['q1', 'q2'].map(id => ({ id, resolution: 'source_available', facet_ids: ['f1'], context_ids: [] })) } });
const packetFor = (full = c, previous = original()) => {
    const packet = demandSelectionCorrection(previous, question, full, demand);
    if (packet?.kind !== 'selection_size') throw new Error('synthetic setup');
    return packet;
};
const packet = packetFor(), bundles = packet.feasible_bundles;
const answer = () => original([...bundles.bundles[0]!.unit_ids]);
const choice = () => ({ bundle_id: bundles.bundles[0]!.id, alternative_selection: [] });
const boundary = () => ({ facets: [], question_contract: { parts: [
    { id: 'q1', resolution: 'coverage_missing', facet_ids: [], context_ids: [] }, { id: 'q2', resolution: 'withheld', facet_ids: [], context_ids: [] },
] } });

describe('Size-only replacement preserves the full existing contract', () => {
    test('a valid exact named choice preserves both sealed parts and raw input', () => {
        const raw = choice(), before = structuredClone(raw), sealed = JSON.stringify(demand);
        const parsed = parseDemandSizeSelection(raw, question, c, demand, packet);
        expect(parsed.question_contract.parts.map(part => part.id)).toEqual(['q1', 'q2']);
        expect(parsed.facets).toEqual(answer().facets); expect(raw).toEqual(before); expect(JSON.stringify(demand)).toBe(sealed);
    });
    test('an explicit valid whole boundary uses none and retains the other withheld material part', () => {
        const raw = { bundle_id: 'none', alternative_selection: [boundary()] }, before = structuredClone(raw), parsed = parseDemandSizeSelection(raw, question, c, demand, packet);
        expect(parsed.decision).toBe('unsupported'); expect(parsed.facets).toEqual([]);
        expect(parsed.question_contract.parts.map(part => part.resolution)).toEqual(['coverage_missing', 'not_answered']); expect(raw).toEqual(before);
    });
    test('wrong bundle IDs, none for answers, a bundle for boundaries and null all fail', () => {
        for (const bundle_id of ['none', 'b00', 'b33', 'invented', null]) expect(() => parseDemandSizeSelection({ ...choice(), bundle_id }, question, c, demand, packet)).toThrow('selection_invalid');
        expect(() => parseDemandSizeSelection({ bundle_id: 'b01', alternative_selection: [boundary()] }, question, c, demand, packet)).toThrow('selection_invalid');
        expect(() => parseDemandSizeSelection({ bundle_id: 'manual', alternative_selection: [boundary()] }, question, c, demand, packet)).toThrow('selection_invalid');
        expect(() => parseDemandSizeSelection({ bundle_id: 'none', alternative_selection: [answer()] }, question, c, demand, packet)).toThrow('selection_invalid');
    });
    test('explicit manual selection can use an omitted alternative or another approved unit while named choices have no override', () => {
        const full = catalog(Array(10).fill(100)), completePacket = packetFor(full, original(ids(full).slice(0, 9)));
        const alternate = original(['U10']), raw = { bundle_id: 'manual', alternative_selection: [alternate] };
        expect(parseDemandSizeSelection(raw, question, full, demand, completePacket).facets[0]!.unit_ids).toEqual(['U10']);
        expect(() => parseDemandSizeSelection({ ...raw, bundle_id: completePacket.feasible_bundles.bundles[0]!.id }, question, full, demand, completePacket)).toThrow('selection_invalid');
        expect(() => parseDemandSizeSelection({ ...raw, bundle_id: 'invented' }, question, full, demand, completePacket)).toThrow('selection_invalid');
    });
    test('manual fallback cannot bypass size, known IDs, nonempty facets or sealed parts', () => {
        for (const unit_ids of [ids(c), ['U99'], []]) {
            const raw = { bundle_id: 'manual', alternative_selection: [original(unit_ids)] };
            expect(() => parseDemandSizeSelection(raw, question, c, demand, packet)).toThrow(unit_ids.length === 9 ? 'selection_too_large' : 'selection_invalid');
        }
        const alternate = answer(); alternate.question_contract.parts.pop();
        expect(() => parseDemandSizeSelection({ bundle_id: 'manual', alternative_selection: [alternate] }, question, c, demand, packet)).toThrow('selection_invalid');
    });
    test('known outside units, unknown IDs, empty selection and a proper subset cannot override the chosen exact bundle', () => {
        const chosen = bundles.bundles[0]!, outside = ids(c).find(id => !chosen.unit_ids.includes(id))!;
        for (const unit_ids of [[outside], ['U99'], [], chosen.unit_ids.slice(0, -1)]) {
            const raw = { ...choice(), facets: [{ id: 'f1', unit_ids }] };
            expect(() => parseDemandSizeSelection(raw, question, c, demand, packet)).toThrow('selection_invalid');
        }
        const changed = structuredClone(packet) as any; changed.feasible_bundles.bundles[0].unit_ids.pop();
        expect(() => parseDemandSizeSelection(choice(), question, c, demand, changed)).toThrow('selection_invalid');
    });
    test('missing, changed, duplicate parts and foreign facet references cannot be silently rebuilt', () => {
        for (const edit of [
            (raw: ReturnType<typeof answer>) => { raw.question_contract.parts.pop(); },
            (raw: ReturnType<typeof answer>) => { raw.question_contract.parts[1]!.id = 'q1'; },
            (raw: ReturnType<typeof answer>) => { raw.question_contract.parts[1]!.id = 'q3'; },
            (raw: ReturnType<typeof answer>) => { raw.question_contract.parts[1]!.facet_ids = ['f99']; },
            (raw: ReturnType<typeof answer>) => { Object.assign(raw.question_contract.parts[0]!, { kind: 'background' }); },
            (raw: ReturnType<typeof answer>) => { Object.assign(raw, { replacement_text: 'invented' }); },
        ]) {
            const alternate = answer(); edit(alternate); const raw = { bundle_id: 'manual', alternative_selection: [alternate] }, before = structuredClone(raw);
            expect(() => parseDemandSizeSelection(raw, question, c, demand, packet)).toThrow('selection_invalid'); expect(raw).toEqual(before);
        }
    });
    test('the size diagnostic retains the entire rejected proposal and adds no bundles to invalid proposals', () => {
        const raw = original(), before = structuredClone(raw), packet = demandSelectionCorrection(raw, question, c, demand)!;
        expect(packet.kind).toBe('selection_size'); expect(packet.previous_selection).toEqual(before);
        expect(packet).toHaveProperty('feasible_bundles'); expect(raw).toEqual(before);
        const invalid = { ...raw, facets: [{ id: 'f1', unit_ids: ['U99'] }] };
        const rejected = demandSelectionCorrection(invalid, question, c, demand)!;
        expect(rejected.kind).toBe('selection_contract'); expect(rejected).not.toHaveProperty('feasible_bundles'); expect(rejected.previous_selection).toEqual(invalid);
    });
});
