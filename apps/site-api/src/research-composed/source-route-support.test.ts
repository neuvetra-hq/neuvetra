import { describe, expect, test } from 'bun:test';
import { validateSupportRequirements, type CapabilityCatalog, type SupportRequirement } from './capabilities';

// Synthetic task-target examples. ID consistency cannot establish that the
// named information is actually obtained from the cited route.
const capabilities = { units: [
    { unit_id: 'R', capabilities: [{ id: 'R-C01', kind: 'source_route', subject: 'activity_records' }], limits: [{ id: 'R-L01' }] },
    { unit_id: 'G', capabilities: [{ id: 'G-C01', kind: 'source_route', subject: 'grid_factor_source' }], limits: [] },
    { unit_id: 'Q', capabilities: [{ id: 'Q-C01', kind: 'inquiry_step', subject: 'supplier_factor_inquiry' }], limits: [] },
    { unit_id: 'E', capabilities: [{ id: 'E-C01', kind: 'conditional_rule', subject: 'generation_boundary' }], limits: [] },
    { unit_id: 'L', capabilities: [{ id: 'L-C01', kind: 'limitation', subject: 'grid_factor_uncertainty' }], limits: [] },
] } as unknown as CapabilityCatalog;
const need = (kind: SupportRequirement['kind'], subject: SupportRequirement['subject'], ids: string[]): SupportRequirement => ({ kind, subject, capability_ids: ids, blocking_limit_ids: [] });
const check = (requirements: SupportRequirement[], ownUnitIds = ['R', 'G', 'Q', 'E', 'L'], covered = true, appropriatelyResolved = true) => validateSupportRequirements(requirements, { background: false, covered, appropriatelyResolved, ownUnitIds, capabilities });

describe('Source routes require an exact target while full task fit remains semantic', () => {
    test('different source-route subject labels cannot substitute for the requested target', () => {
        expect(() => check([need('source_route', 'source_date_recordkeeping', ['R-C01'])])).toThrow('selection_review_invalid');
    });
    test('a consumption-record route cannot structurally approve a factor target', () => {
        expect(() => check([need('source_route', 'grid_factor_source', ['R-C01'])])).toThrow('selection_review_invalid');
    });
    test('an exact own route target can pass structure but still requires full-text review', () => {
        expect(() => check([need('source_route', 'activity_records', ['R-C01'])], ['R'])).not.toThrow();
        expect(() => check([need('source_route', 'grid_factor_source', ['G-C01'])], ['G'])).not.toThrow();
    });
    test('source routes do not acquire inquiry, conditional-effect or limitation roles', () => {
        for (const kind of ['inquiry_step', 'conditional_rule', 'limitation'] as const) {
            expect(() => check([need(kind, 'activity_records', ['R-C01'])])).toThrow('selection_review_invalid');
        }
        expect(() => check([need('source_route', 'supplier_factor_inquiry', ['Q-C01'])])).toThrow('selection_review_invalid');
    });
    test('conditional effects, inquiry steps and limitations still require exact subjects', () => {
        for (const [kind, id] of [['conditional_rule', 'E-C01'], ['inquiry_step', 'Q-C01'], ['limitation', 'L-C01']] as const) {
            expect(() => check([need(kind, 'reporting_methods', [id])])).toThrow('selection_review_invalid');
        }
    });
    test('every independent route needs an own known route capability and no blocking limit', () => {
        for (const requirement of [need('source_route', 'grid_factor_source', []), need('source_route', 'grid_factor_source', ['unknown']), need('source_route', 'unrepresented_subject', ['R-C01']), { ...need('source_route', 'grid_factor_source', ['R-C01']), blocking_limit_ids: ['R-L01'] }]) {
            expect(() => check([requirement])).toThrow('selection_review_invalid');
        }
        expect(() => check([need('source_route', 'grid_factor_source', ['R-C01'])], ['G'])).toThrow('selection_review_invalid');
        expect(() => check([need('source_route', 'grid_factor_source', ['G-C01']), need('source_route', 'activity_records', [])])).toThrow('selection_review_invalid');
    });
    test('a truthful missing-route boundary remains valid with no positive proof', () => {
        expect(() => check([need('source_route', 'grid_factor_source', [])], [], false, true)).not.toThrow();
    });
});
