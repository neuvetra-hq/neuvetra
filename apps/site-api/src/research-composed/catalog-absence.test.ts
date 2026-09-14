import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';
import { hash } from '../research-passages/release';
import { type UnitCatalog } from './catalog';
import { LEGACY_CAPABILITY_UNIT_SHA, LEGACY_CAPABILITY_SHA, CAPABILITY_UNIT_SHA, PRIOR_ACQUISITION_CAPABILITY_SHA as CAPABILITY_SHA, capabilityKinds, capabilitySubjects, type CapabilityCatalog } from './capabilities';
import { parseQuestionAnalysis, type AnalysisRequirement } from './question-analysis';
import { initialDemand, parseDemandSelection, type DemandState } from './demand-selection';
import { type Selection } from './selection';
import { assertBoundaryFidelityInput, assertCatalogAbsenceCertificate, boundaryFidelityPrompt, boundaryFidelitySchema, catalogAbsencePolicy, certifiedBoundaryInput, createCatalogAbsenceCertificate, parseBoundaryFidelityReview, type CatalogAbsenceBinding } from './catalog-absence';

// Synthetic declared-type fixtures only. No natural-language semantic proof,
// source passages, live examples or private evaluation questions are used.
const question = 'Explain the violet boundary.';
const digest = (n: number) => String(n).repeat(64);
// The complete verified-catalog precondition is represented synthetically here;
// these recognized pair identifiers are not claims about this synthetic text.
const binding: CatalogAbsenceBinding = { catalog_sha256: LEGACY_CAPABILITY_UNIT_SHA, capability_sha256: LEGACY_CAPABILITY_SHA, profile_sha256: digest(3) };
const catalog: UnitCatalog = {
    schema_version: 1, catalog_id: 'scope2-website-answer-units', version: '2-epa-inquiry', source_release_sha256: digest(4), condition_catalog_sha256: digest(5),
    review: { status: 'approved_private', expires_at: '2099-01-01T00:00:00Z', source_review: {}, qa_review: {} },
    units: ['U01', 'U02'].map(id => ({ id, title: 'Synthetic unit', text: 'Synthetic declared support wording only.', type: 'source_summary', passage_ids: ['S01'], support: [{ passage_id: 'S01', quote: 'Synthetic support.' }], required_unit_ids: [], coverage: ['synthetic'] })),
};
const capabilities: CapabilityCatalog = {
    schema_version: 1, capability_catalog_id: 'scope2-website-unit-capabilities', version: '1', unit_catalog_sha256: binding.catalog_sha256, source_release_sha256: catalog.source_release_sha256, condition_catalog_sha256: catalog.condition_catalog_sha256,
    review: { status: 'approved_private', expires_at: '2099-01-01T00:00:00Z', source_review: { reviewer: 'a', disposition: 'approved_private', record_path: 'synthetic-a' }, qa_review: { reviewer: 'b', disposition: 'approved_private', record_path: 'synthetic-b' } },
    kinds: [...capabilityKinds], subjects: [...capabilitySubjects],
    units: [
        { unit_id: 'U01', capabilities: [{ id: 'U01-C01', kind: 'conditional_rule', subject: 'generation_boundary', anchor: [0, 12] }], limits: [{ id: 'U01-L01', anchor: [12, 20] }] },
        { unit_id: 'U02', capabilities: [{ id: 'U02-C01', kind: 'conditional_rule', subject: 'agreement_period_alignment', anchor: [0, 12] }], limits: [{ id: 'U02-L01', anchor: [12, 20] }] },
    ],
    absence_policy: 'Synthetic fixture only.', provenance: { reviewed_draft_sha256: digest(6), qa_record_sha256: digest(7), assembled_at: '2026-01-01T00:00:00Z', approval_note: 'Synthetic fixture only.' },
};
const req = (kind: AnalysisRequirement['kind'] = 'conditional_rule', subject: AnalysisRequirement['subject'] = 'reporting_methods') => ({ kind, subject });
function demandFor(requirements = [req()], text = question, operation = 'explain', parts?: unknown[]): DemandState {
    return initialDemand(parseQuestionAnalysis({ operation, parts: parts ?? [{ id: 'q1', start_token: 0, kind: 'request', requirements, ambiguity_context_ids: [] }] }, text));
}
function planFor(demand: DemandState, text = question, resolutions?: string[]): Selection {
    const resolved = resolutions ?? demand.analysis.parts.map(p => p.kind === 'background' ? 'background' : p.kind === 'ambiguous_reference' ? 'context_required' : 'coverage_missing');
    const reason = resolved.includes('action_out_of_scope') ? 'action_out_of_scope' : resolved.includes('coverage_missing') ? 'coverage_missing' : resolved.includes('context_required') ? 'context_required' : 'covered';
    return parseDemandSelection({ facets: reason === 'covered' ? [{ id: 'f1', unit_ids: ['U01'] }] : [], question_contract: { parts: demand.analysis.parts.map((p, i) => ({ id: p.id, resolution: resolved[i], facet_ids: reason === 'covered' && p.kind !== 'background' ? ['f1'] : [], context_ids: resolved[i] === 'context_required' ? p.ambiguity_context_ids.length ? p.ambiguity_context_ids : ['intended_use'] : [] })) } }, text, catalog, demand);
}
function fixture(requirements = [req()]) {
    const demand = demandFor(requirements), plan = planFor(demand);
    const certificate = createCatalogAbsenceCertificate(question, plan, demand, catalog, capabilities, binding);
    return { demand, plan, certificate };
}
function addNeeds(demand: DemandState, rows: { part_id: string; requirements: { kind: AnalysisRequirement['kind']; subject: AnalysisRequirement['subject'] }[] }[]): DemandState {
    const additions = rows.map(row => ({ part_id: row.part_id, requirements: row.requirements.map((r, i) => ({ id: `${row.part_id}-a${i + 1}`, ...r })) }));
    return { analysis: demand.analysis, additions, seal_sha256: hash(JSON.stringify({ initial_seal_sha256: demand.analysis.seal_sha256, additions })) };
}
const pass = (demand: DemandState) => ({ operation_faithful: true, decomposition_complete: true, boundary_mapping_faithful: true, question_parts: demand.analysis.parts.map(p => ({ id: p.id, faithful: true })), issues: [] as { code: string; target: string }[], decision: 'pass' });
const expectCode = (run: () => unknown, code = 'selection_review_invalid') => { try { run(); throw new Error('expected rejection'); } catch (error) { expect((error as { code?: string }).code).toBe(code); } };
afterEach(() => setSystemTime());

describe('catalog absence: declared-type consistency, not semantic proof', () => {
    test('strict absence is frozen, deterministic and binds the whole approved release', () => {
        const { demand, plan, certificate } = fixture();
        expect(certificate).not.toBeNull();
        expect(certificate!.claim).toBe('no_approved_support_under_this_release');
        expect(certificate!.parts[0]!.requirements).toEqual([...demand.analysis.parts[0]!.requirements]);
        expect(certificate!.catalog_record_sha256).toBe(hash(JSON.stringify(catalog)));
        expect(certificate!.capability_record_sha256).toBe(hash(JSON.stringify(capabilities)));
        expect(certificate!.source_release_sha256).toBe(catalog.source_release_sha256);
        expect(certificate!.condition_catalog_sha256).toBe(catalog.condition_catalog_sha256);
        expect(certificate!.profile_sha256).toBe(binding.profile_sha256);
        expect(certificate!.predicate_sha256).toBe(catalogAbsencePolicy.predicate_sha256);
        expect(Object.isFrozen(certificate!.parts[0]!.requirements[0])).toBe(true);
        expect(createCatalogAbsenceCertificate(question, plan, demand, catalog, capabilities, binding)).toEqual(certificate);
        expect(() => assertCatalogAbsenceCertificate(JSON.parse(JSON.stringify(certificate)), question, plan, demand, catalog, capabilities, binding)).not.toThrow();
    });

    test.each(['definition', 'explanation', 'general_recommendation'] as const)('broad conceptual matcher retains full review for %s, despite different subject/kind', kind => {
        expect(fixture([req(kind, 'reporting_methods')]).certificate).toBeNull();
    });
    test.each(['generation_boundary', 'agreement_period_alignment'] as const)('an existing strict conditional capability for %s prevents a certificate', subject => {
        expect(fixture([req('conditional_rule', subject)]).certificate).toBeNull();
    });
    test('source route target mismatch always retains ordinary source review', () => {
        const caps = structuredClone(capabilities); caps.units[1]!.capabilities[0]!.kind = 'source_route';
        const demand = demandFor([req('source_route', 'reporting_methods')]), plan = planFor(demand);
        expect(createCatalogAbsenceCertificate(question, plan, demand, catalog, caps, binding)).toBeNull();
    });
    test('any one matching need anywhere in the entire catalog blocks certification; limits do not erase it', () => {
        const { demand, plan } = fixture([req(), req('conditional_rule', 'agreement_period_alignment')]);
        expect(plan.facets).toEqual([]);
        expect(capabilities.units[1]!.limits).toHaveLength(1);
        expect(createCatalogAbsenceCertificate(question, plan, demand, catalog, capabilities, binding)).toBeNull();
    });
    test('an unrepresented declared subject is absence only, including for a broad conceptual kind', () => {
        expect(fixture([req('explanation', 'unrepresented_subject')]).certificate).not.toBeNull();
    });
    test('cumulative additions change seals and requirements; any supported addition restores full review', () => {
        const base = fixture();
        const added = addNeeds(base.demand, [{ part_id: 'q1', requirements: [req('inquiry_step', 'methodology_adjustment')] }]);
        const cert = createCatalogAbsenceCertificate(question, base.plan, added, catalog, capabilities, binding)!;
        expect(cert).not.toBeNull(); expect(cert.demand_seal_sha256).not.toBe(base.certificate!.demand_seal_sha256);
        expect(cert.demand_sha256).not.toBe(base.certificate!.demand_sha256);
        expect(cert.certificate_sha256).not.toBe(base.certificate!.certificate_sha256);
        expect(cert.parts[0]!.requirements.map(r => r.id)).toEqual(['q1-r1', 'q1-a1']);
        expectCode(() => assertCatalogAbsenceCertificate(base.certificate, question, base.plan, added, catalog, capabilities, binding));
        const supported = addNeeds(base.demand, [{ part_id: 'q1', requirements: [req('conditional_rule', 'generation_boundary')] }]);
        expect(createCatalogAbsenceCertificate(question, base.plan, supported, catalog, capabilities, binding)).toBeNull();
    });
    test.each(['calculate', 'submit_or_file'])('actual %s execution stays on full review', operation => {
        const demand = demandFor([req()], question, operation), plan = planFor(demand, question, ['action_out_of_scope']);
        expect(createCatalogAbsenceCertificate(question, plan, demand, catalog, capabilities, binding)).toBeNull();
    });
    test('an actual-case assessment is ineligible even when every declared need is absent', () => {
        const demand = demandFor([req()], question, 'assess_specific_case'), plan = planFor(demand);
        expect(createCatalogAbsenceCertificate(question, plan, demand, catalog, capabilities, binding)).toBeNull();
    });
    test('new acquisition release version/hash pair is accepted and crossed pairs reject', () => {
        const { demand, plan } = fixture(), units = structuredClone(catalog), caps = structuredClone(capabilities);
        units.version = '3-epa-acquisition'; caps.version = '2-epa-acquisition'; caps.unit_catalog_sha256 = CAPABILITY_UNIT_SHA;
        const next = { ...binding, catalog_sha256: CAPABILITY_UNIT_SHA, capability_sha256: CAPABILITY_SHA };
        expect(createCatalogAbsenceCertificate(question, plan, demand, units, caps, next)).not.toBeNull();
        expectCode(() => createCatalogAbsenceCertificate(question, plan, demand, units, caps, { ...next, capability_sha256: LEGACY_CAPABILITY_SHA }));
        units.version = '2-epa-inquiry';
        expectCode(() => createCatalogAbsenceCertificate(question, plan, demand, units, caps, next));
    });
    test('explicit service time is honored by creation/recomputation and invalid clocks reject', () => {
        const { demand, plan, certificate } = fixture();
        expect(() => assertCatalogAbsenceCertificate(certificate, question, plan, demand, catalog, capabilities, binding, Date.parse('2098-01-01T00:00:00Z'))).not.toThrow();
        expectCode(() => createCatalogAbsenceCertificate(question, plan, demand, catalog, capabilities, binding, Date.parse('2100-01-01T00:00:00Z')));
        expectCode(() => createCatalogAbsenceCertificate(question, plan, demand, catalog, capabilities, binding, NaN));
    });
    test.each(['withheld', 'action_out_of_scope', 'context_required'])('mixed material %s stays on full review', resolution => {
        const text = 'Explain violet. Explain amber.';
        const demand = demandFor([req()], text, 'explain', [
            { id: 'q1', start_token: 0, kind: 'request', requirements: [req()], ambiguity_context_ids: [] },
            { id: 'q2', start_token: 2, kind: 'request', requirements: [req('inquiry_step', 'methodology_adjustment')], ambiguity_context_ids: [] },
        ]);
        const plan = planFor(demand, text, ['coverage_missing', resolution]);
        expect(createCatalogAbsenceCertificate(text, plan, demand, catalog, capabilities, binding)).toBeNull();
    });
    test('a genuinely unresolved reference is ineligible even alongside strict absence', () => {
        const text = 'Explain violet. Explain that.';
        const demand = demandFor([req()], text, 'explain', [
            { id: 'q1', start_token: 0, kind: 'request', requirements: [req()], ambiguity_context_ids: [] },
            { id: 'q2', start_token: 2, kind: 'ambiguous_reference', requirements: [req('conditional_rule', 'unrepresented_subject')], ambiguity_context_ids: ['referenced_subject'] },
        ]);
        expect(createCatalogAbsenceCertificate(text, planFor(demand, text), demand, catalog, capabilities, binding)).toBeNull();
    });
    test('source available and whole answered plans are ineligible', () => {
        const demand = demandFor();
        expect(createCatalogAbsenceCertificate(question, planFor(demand, question, ['source_available']), demand, catalog, capabilities, binding)).toBeNull();
    });
    test('all background and zero-needs cannot issue a vacuous certificate', () => {
        const base = structuredClone(demandFor()) as any;
        base.analysis.parts[0].kind = 'background'; base.analysis.parts[0].requirements = [];
        const { seal_sha256, ...body } = base.analysis;
        base.analysis.seal_sha256 = hash(JSON.stringify(body)); base.seal_sha256 = base.analysis.seal_sha256;
        expect(createCatalogAbsenceCertificate(question, {} as Selection, base, catalog, capabilities, binding)).toBeNull();
    });
    test('nonempty stale, incomplete, foreign-version and mismatched catalog pairs fail closed', () => {
        const { demand, plan } = fixture();
        const changes = [
            (c: any) => { c.unit_catalog_sha256 = digest(9); },
            (c: any) => { c.source_release_sha256 = digest(9); },
            (c: any) => { c.condition_catalog_sha256 = digest(9); },
            (c: any) => { c.version = 'future'; },
            (c: any) => { c.review.expires_at = '2000-01-01T00:00:00Z'; },
            (c: any) => { c.units.pop(); },
            (c: any) => { c.units[0].capabilities = []; },
            (c: any) => { c.units[0].capabilities[0].id = 'foreign'; },
        ];
        for (const change of changes) { const caps = structuredClone(capabilities); change(caps); expectCode(() => createCatalogAbsenceCertificate(question, plan, demand, catalog, caps, binding)); }
    });
    test('tampered certificate hashes, IDs, versions, nested fields and binding changes reject on recomputation', () => {
        const { demand, plan, certificate } = fixture();
        for (const key of Object.keys(certificate!).filter(key => key.endsWith('_sha256'))) {
            const cert = structuredClone(certificate) as any; cert[key] = digest(9);
            expectCode(() => assertCatalogAbsenceCertificate(cert, question, plan, demand, catalog, capabilities, binding));
        }
        for (const change of [
            (c: any) => { c.parts[0].id = 'q2'; }, (c: any) => { c.parts[0].requirements[0].id = 'q1-a1'; },
            (c: any) => { c.parts[0].requirements[0].subject = 'generation_boundary'; }, (c: any) => { c.version = 'future'; },
            (c: any) => { c.parts[0].source_text = 'injected'; }, (c: any) => { c.extra = false; },
        ]) { const cert = structuredClone(certificate); change(cert); expectCode(() => assertCatalogAbsenceCertificate(cert, question, plan, demand, catalog, capabilities, binding)); }
        for (const key of Object.keys(binding)) expectCode(() => assertCatalogAbsenceCertificate(certificate, question, plan, demand, catalog, capabilities, { ...binding, [key]: digest(9) }));
        const changedCatalog = structuredClone(catalog); changedCatalog.units[0]!.title += ' amended';
        expectCode(() => assertCatalogAbsenceCertificate(certificate, question, plan, demand, changedCatalog, capabilities, binding));
        expectCode(() => assertCatalogAbsenceCertificate(certificate, question + ' ', plan, demand, catalog, capabilities, binding));
    });
    test('malformed parsed plans and cumulative need seals fail closed', () => {
        const { demand, plan } = fixture();
        for (const change of [(p: any) => { p.extra = 'injected'; }, (p: any) => { p.question_contract.parts[0].end_token--; }, (p: any) => { p.question_contract.parts[0].kind = 'condition'; }]) {
            const mutated = structuredClone(plan); change(mutated); expectCode(() => createCatalogAbsenceCertificate(question, mutated, demand, catalog, capabilities, binding));
        }
        const added = addNeeds(demand, [{ part_id: 'q1', requirements: [req('inquiry_step', 'methodology_adjustment')] }]);
        const broken = structuredClone(added) as any; broken.additions[0].requirements[0].id = 'q1-a2';
        expectCode(() => createCatalogAbsenceCertificate(question, plan, broken, catalog, capabilities, binding));
    });
});

describe('source-independent fidelity packet and terminal review', () => {
    test('exact original and cumulative needs survive a JSON audit roundtrip without mutating caller objects', () => {
        const { demand, plan, certificate } = fixture();
        const cert = structuredClone(certificate!); const before = JSON.stringify({ plan, demand, cert });
        const input = certifiedBoundaryInput(question, plan, demand, cert);
        expect(() => assertBoundaryFidelityInput(JSON.parse(JSON.stringify(input)))).not.toThrow();
        expect(input.original_question).toBe(question);
        expect(input.demand.parts.map(p => p.question_fragment).join('')).toBe(question);
        expect(Object.isFrozen(input.demand.parts[0]!.requirements[0])).toBe(true);
        expect(Object.isFrozen(cert)).toBe(false);
        expect(JSON.stringify({ plan, demand, cert })).toBe(before);
        expect(Object.keys(input)).toEqual(['original_question', 'taxonomy_version', 'definitions', 'demand', 'coverage_mapping', 'certificate']);
    });
    test('addition order across parts is preserved and audit seals reconstruct exactly', () => {
        const text = 'Explain violet. Explain amber.';
        const base = demandFor([req()], text, 'explain', [
            { id: 'q1', start_token: 0, kind: 'request', requirements: [req()], ambiguity_context_ids: [] },
            { id: 'q2', start_token: 2, kind: 'request', requirements: [req('inquiry_step', 'methodology_adjustment')], ambiguity_context_ids: [] },
        ]);
        const demand = addNeeds(base, [{ part_id: 'q2', requirements: [req('limitation', 'reporting_methods')] }, { part_id: 'q1', requirements: [req('inquiry_step', 'product_label_documentation')] }]);
        const plan = planFor(demand, text), cert = createCatalogAbsenceCertificate(text, plan, demand, catalog, capabilities, binding)!;
        const input = certifiedBoundaryInput(text, plan, demand, cert);
        expect(input.demand.additions.map(p => p.part_id)).toEqual(['q2', 'q1']);
        expect(() => assertBoundaryFidelityInput(JSON.parse(JSON.stringify(input)))).not.toThrow();
    });
    test('auxiliary source fields, tampered definitions and nested open shapes reject before provider I/O', () => {
        const { demand, plan, certificate } = fixture(), input = certifiedBoundaryInput(question, plan, demand, certificate!);
        const changes = [
            (v: any) => { v.catalog = { text: 'injected' }; }, (v: any) => { v.history = []; },
            (v: any) => { v.definitions.subjects.reporting_methods = 'source availability'; },
            (v: any) => { v.definitions.sources = []; }, (v: any) => { v.demand.source_cards = []; },
            (v: any) => { v.demand.parts[0].source_text = 'injected'; }, (v: any) => { v.demand.parts[0].requirements[0].capability_ids = []; },
            (v: any) => { v.coverage_mapping.parts[0].source_ranking = []; }, (v: any) => { v.certificate.source_wording = 'injected'; },
            (v: any) => { v.demand.parts[0].question_fragment += ' amended'; }, (v: any) => { v.certificate.parts[0].requirements = []; },
            (v: any) => { v.certificate.parts[0].requirements[0].id = 'q1-r2'; },
        ];
        for (const change of changes) { const modified = structuredClone(input); change(modified); expectCode(() => assertBoundaryFidelityInput(modified)); }
        setSystemTime(new Date('2100-01-01T00:00:00Z'));
        expectCode(() => assertBoundaryFidelityInput(input));
    });
    test('a recomputed shape hash cannot substitute for checking the actual catalog at release', () => {
        const { demand, plan, certificate } = fixture(), input = certifiedBoundaryInput(question, plan, demand, certificate!);
        const wire = structuredClone(input); wire.certificate.profile_sha256 = digest(9);
        const { certificate_sha256, ...body } = wire.certificate; wire.certificate.certificate_sha256 = hash(JSON.stringify(body));
        // Input validation establishes closed shape and internal consistency;
        // only the required service recomputation establishes the current pin.
        expect(() => assertBoundaryFidelityInput(wire)).not.toThrow();
        expectCode(() => assertCatalogAbsenceCertificate(wire.certificate, question, plan, demand, catalog, capabilities, binding));
    });
    test('a complete positive fidelity review passes without modifying raw output', () => {
        const { demand } = fixture(), review = pass(demand), before = JSON.stringify(review);
        expect(() => parseBoundaryFidelityReview(review, demand)).not.toThrow();
        expect(JSON.stringify(review)).toBe(before);
    });
    test.each([
        ['operation_faithful', 'operation'], ['decomposition_complete', 'decomposition'], ['boundary_mapping_faithful', 'boundary_mapping'],
    ])('an honored negative %s is terminal, including an omitted or wrongly declared meaning', (flag, code) => {
        const { demand } = fixture(), review = pass(demand) as any;
        review[flag!] = false; review.decision = 'fail'; review.issues = [{ code, target: 'answer' }];
        expectCode(() => parseBoundaryFidelityReview(review, demand), 'question_analysis_not_verified');
    });
    test('a condition hidden as background can fail part fidelity and cannot acquire a new-need label', () => {
        const text = 'Violet context. Explain amber.';
        const demand = demandFor([req()], text, 'explain', [
            { id: 'q1', start_token: 0, kind: 'background', requirements: [], ambiguity_context_ids: [] },
            { id: 'q2', start_token: 2, kind: 'request', requirements: [req()], ambiguity_context_ids: [] },
        ]);
        const review = pass(demand); review.question_parts[0]!.faithful = false; review.decomposition_complete = false; review.decision = 'fail';
        review.issues = [{ code: 'decomposition', target: 'answer' }, { code: 'question_part', target: 'q1' }];
        expectCode(() => parseBoundaryFidelityReview(review, demand), 'question_analysis_not_verified');
        expectCode(() => parseBoundaryFidelityReview({ ...review, additional_requirements: [req()] }, demand));
    });
    test('inconsistent decisions, unaligned issues, missing/foreign parts and extra proof fields are malformed', () => {
        const { demand } = fixture();
        const changes = [
            (v: any) => { v.operation_faithful = false; }, (v: any) => { v.decision = 'fail'; },
            (v: any) => { v.decision = 'revise'; }, (v: any) => { v.question_parts = []; },
            (v: any) => { v.question_parts[0].id = 'q2'; }, (v: any) => { v.question_parts[0].requirements = []; },
            (v: any) => { v.question_parts[0].faithful = false; v.decision = 'fail'; v.issues = [{ code: 'question_part', target: 'answer' }]; },
            (v: any) => { v.issues = [{ code: 'operation', target: 'answer' }]; },
            (v: any) => { v.operation_faithful = 'true'; }, (v: any) => { v.new_need = req(); },
        ];
        for (const change of changes) { const review = pass(demand); change(review); expectCode(() => parseBoundaryFidelityReview(review, demand)); }
    });
    test('static schema is closed and the prompt separates modal rationale from a conditional effect', () => {
        expect(boundaryFidelitySchema.additionalProperties).toBe(false);
        expect(boundaryFidelityPrompt).toContain('An asserted modal premise in a request for rationale');
        expect(boundaryFidelityPrompt).toContain('permits, requires, waives or changes');
        expect(boundaryFidelityPrompt).toContain('does not prove');
    });
});


describe('Route target tightening cannot create special absence approval', () => {
    test.each(['reporting_methods', 'unrepresented_subject'] as const)('an unmatched source_route for %s always retains full review', subject => {
        const { certificate } = fixture([req('source_route', subject)]);
        expect(certificate).toBeNull();
    });
    test('a cumulative source-route need disables a previously eligible strict absence', () => {
        const { demand, plan, certificate } = fixture();
        expect(certificate).not.toBeNull();
        const next = addNeeds(demand, [{ part_id: 'q1', requirements: [req('source_route', 'unrepresented_subject')] }]);
        expect(createCatalogAbsenceCertificate(question, plan, next, catalog, capabilities, binding)).toBeNull();
        expectCode(() => assertCatalogAbsenceCertificate(certificate, question, plan, next, catalog, capabilities, binding));
    });
    test('even a rehashed serialized source-route certificate is rejected', () => {
        const { demand, plan, certificate } = fixture();
        const forged = structuredClone(certificate!);
        (forged.parts[0]!.requirements[0]! as { kind: string }).kind = 'source_route';
        const { certificate_sha256, ...body } = forged;
        forged.certificate_sha256 = hash(JSON.stringify(body));
        expectCode(() => certifiedBoundaryInput(question, plan, demand, forged));
    });
})
