import { planTestInput } from './test-plan-input';
import { describe, expect, test } from 'bun:test';
import { composedRequestBody, composedSchemas, createComposedProvider } from './provider';

describe('Size assistance and canonical reviewer transport contracts', () => {
    test('only the sole size correction uses an explicit bundle choice; the same plan model and output bound remain', () => {
        const normal = JSON.parse(composedRequestBody('plan', planTestInput()));
        const size = JSON.parse(composedRequestBody('plan', { ...planTestInput(), correction_packet: { kind: 'selection_size' } }));
        expect(normal.output_config.format.schema.properties.bundle_id).toBeUndefined();
        expect(size.output_config.format.schema.required).toEqual(['bundle_id','alternative_selection']);
        expect(size.output_config.format.schema.properties.facets).toBeUndefined();
        expect(size.output_config.format.schema.properties.question_contract).toBeUndefined();
        expect(size.output_config.format.schema.properties.alternative_selection.items).toEqual(normal.output_config.format.schema);
        expect(size.system).toContain('do not repeat facets, part states or unit IDs');
        expect(size.output_config.format.schema.properties.bundle_id.enum).toEqual(['none', 'manual', ...Array.from({ length: 32 }, (_, i) => `b${String(i + 1).padStart(2, '0')}`)]);
        expect(size.model).toBe(normal.model); expect(size.max_tokens).toBe(normal.max_tokens); expect(size.thinking).toEqual(normal.thinking);
    });
    test('the new schema uses only the established provider-compatible keyword subset', () => {
        const allowed = new Set(['type', 'additionalProperties', 'required', 'properties', 'items', 'enum']);
        const inspect = (node: any): void => {
            for (const key of Object.keys(node)) expect(allowed.has(key)).toBe(true);
            if (node.type === 'object') {
                expect(node.additionalProperties).toBe(false);
                expect([...node.required].sort()).toEqual(Object.keys(node.properties).sort());
                Object.values(node.properties).forEach(inspect);
            }
            if (node.items) inspect(node.items);
        };
        inspect(composedSchemas.plan_size);
    });
    test('the reviewer receives canonical-state instructions rather than the raw planner-wire prohibition', () => {
        const normal = JSON.parse(composedRequestBody('plan', planTestInput()));
        const review = JSON.parse(composedRequestBody('verify', { selection_representation: 'canonical_response_v2' }));
        expect(normal.system).toContain('Never emit canonical covered or not_answered wire states.');
        expect(review.system).not.toContain('Never emit canonical covered or not_answered wire states.');
        expect(review.system).toContain('selection is the server-validated canonical response');
        expect(review.system).toContain('not_answered means only neutral unanswered remainder');
    });
    test('an oversized assistance packet fails before another reservation or network request', async () => {
        let reservations = 0, fetches = 0;
        const provider = createComposedProvider({ apiKey: 'offline', budget: { maxCalls: 5, remaining: () => 5, reserve: () => ++reservations }, fetch: async () => { fetches++; return Response.json({}); } });
        await expect(provider.invoke('plan', { ...planTestInput(), correction_packet: { kind: 'selection_size', feasible_bundles: 'x'.repeat(64000) } }, new AbortController().signal)).rejects.toThrow('context_limit');
        expect(reservations).toBe(0); expect(fetches).toBe(0);
    });
});
