import { describe, expect, test } from 'bun:test';
import { validateSupportRequirements, type CapabilityCatalog, type SupportRequirement } from './capabilities';

// Synthetic metadata tests only. A structurally valid reference is not proof
// that its wording answers a natural-language question.
const capabilities = { units: [
    { unit_id: 'A', capabilities: [{ id: 'A-C01', kind: 'definition', subject: 'accounting_methods' }], limits: [{ id: 'A-L01' }] },
    { unit_id: 'B', capabilities: [{ id: 'B-C01', kind: 'conditional_rule', subject: 'generation_boundary' }], limits: [] },
    { unit_id: 'C', capabilities: [{ id: 'C-C01', kind: 'source_route', subject: 'grid_factor_source' }], limits: [] },
    { unit_id: 'D', capabilities: [{ id: 'D-C01', kind: 'inquiry_step', subject: 'supplier_factor_inquiry' }], limits: [] },
    { unit_id: 'E', capabilities: [{ id: 'E-C01', kind: 'limitation', subject: 'grid_factor_uncertainty' }], limits: [] },
] } as unknown as CapabilityCatalog;
const requirement = (kind: SupportRequirement['kind'], subject: SupportRequirement['subject'], ids: string[]): SupportRequirement => ({ kind, subject, capability_ids: ids, blocking_limit_ids: [] });
const check = (requirements: unknown, ownUnitIds = ['A', 'B', 'C', 'D', 'E'], covered = true, appropriatelyResolved = true) => validateSupportRequirements(requirements, { background: false, covered, appropriatelyResolved, ownUnitIds, capabilities });

describe('Conceptual labels and strict requested effects', () => {
    for (const kind of ['definition', 'explanation', 'general_recommendation'] as const) test(`${kind} does not require an identical source-role or subject label`, () => {
        expect(() => check([requirement(kind, 'reporting_methods', ['A-C01'])])).not.toThrow();
    });
    test('a conceptually unrelated own capability can pass structure; relevance remains an independent semantic judgment', () => {
        expect(() => check([requirement('explanation', 'accounting_methods', ['D-C01'])])).not.toThrow();
    });
    for (const [kind, subject, id] of [
        ['conditional_rule', 'generation_boundary', 'B-C01'],
        ['inquiry_step', 'supplier_factor_inquiry', 'D-C01'], ['limitation', 'grid_factor_uncertainty', 'E-C01'],
    ] as const) test(`${kind} retains exact role and subject support`, () => {
        expect(() => check([requirement(kind, subject, [id])])).not.toThrow();
        expect(() => check([requirement(kind, subject, ['A-C01'])])).toThrow('selection_review_invalid');
        expect(() => check([requirement(kind, 'reporting_methods', [id])])).toThrow('selection_review_invalid');
        expect(() => check([requirement(kind, subject, ['A-C01', id])])).not.toThrow();
    });
    test('general advice or definition never supplies an absent-agreement applicability effect', () => {
        expect(() => check([requirement('conditional_rule', 'reporting_methods', ['A-C01'])])).toThrow('selection_review_invalid');
        expect(() => check([requirement('conditional_rule', 'reporting_methods', [])], [], false, true)).not.toThrow();
    });
    test('one fulfilled conceptual need cannot conceal a second unmet effect or inquiry need', () => {
        for (const second of [requirement('conditional_rule', 'reporting_methods', []), requirement('inquiry_step', 'supplier_factor_inquiry', [])]) {
            expect(() => check([requirement('explanation', 'accounting_methods', ['A-C01']), second])).toThrow('selection_review_invalid');
        }
    });
    test('every conceptual requirement still needs known own support and no applicable blocking limit', () => {
        for (const value of [requirement('explanation', 'accounting_methods', []), requirement('explanation', 'accounting_methods', ['unknown']), { ...requirement('explanation', 'accounting_methods', ['A-C01']), blocking_limit_ids: ['A-L01'] }, requirement('explanation', 'unrepresented_subject', ['A-C01'])]) {
            expect(() => check([value])).toThrow('selection_review_invalid');
        }
        expect(() => check([requirement('explanation', 'accounting_methods', ['D-C01'])], ['A'])).toThrow('selection_review_invalid');
        expect(() => check([requirement('explanation', 'accounting_methods', []), requirement('definition', 'reporting_methods', ['A-C01'])])).toThrow('selection_review_invalid');
    });
});
