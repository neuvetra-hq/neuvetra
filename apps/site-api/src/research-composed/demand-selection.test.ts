import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { hash, parsePassageRelease } from '../research-passages/release';
import { LEGACY_CAPABILITY_SHA as CAPABILITY_SHA, parseCapabilities } from './capabilities';
import { SOURCE_SHA, parseUnitCatalog, selectedUnits, titleTextCharacters } from './catalog';
import { analysisInput, parseQuestionAnalysis } from './question-analysis';
import { demandInput, initialDemand, parseDemandReview, parseDemandSelection, demandSelectionCorrection, type DemandReview, type DemandState } from './demand-selection';
import { createComposedAnswerService } from './answer';
import { composedRequestBody, createComposedProvider, type ComposedStage, type ComposedStageEvent } from './provider';

const now = Date.parse('2026-09-12T12:00:00Z');
const read = (name: string) => readFileSync(new URL(`../../../../data/research/${name}`, import.meta.url));
const catalogBytes = read('answer-units/scope2-website.epa-inquiry.v1.json'), catalogSha = hash(catalogBytes);
const release = parsePassageRelease(JSON.parse(read('releases/scope2-website.v1.json').toString()), now);
const verified = { release, passages: release.passages, sha256: SOURCE_SHA };
const catalog = parseUnitCatalog(catalogBytes, catalogSha, verified, now).catalog;
const capabilityBytes = read('capabilities/scope2-website.epa-inquiry.v1.json');
const capabilities = parseCapabilities(capabilityBytes, CAPABILITY_SHA, catalog, catalogSha, now);
const question = 'Explain the requested conceptual distinction.';
const binding = { scopeId: 'offline', buildId: 'offline', namespace: 'offline', releaseId: release.release_id, releaseVersion: release.version, releaseSha256: SOURCE_SHA, profileSha256: 'offline', sourceSha256: release.sources.map(s => s.sha256) };
const rawAnalysis = (requirements = [{ kind: 'definition', subject: 'accounting_methods' }], operation = 'explain') => ({ operation, parts: [{ id: 'q1', start_token: 0, kind: 'request', requirements, ambiguity_context_ids: [] as string[] }] });
const demand = (raw = rawAnalysis(), q = question) => initialDemand(parseQuestionAnalysis(raw, q));
const plan = (ids = ['U01']) => ({ facets: [{ id: 'f1', unit_ids: ids }], question_contract: { parts: [{ id: 'q1', resolution: 'source_available', facet_ids: ['f1'], context_ids: [] as string[] }] } });
const boundary = () => ({ facets: [], question_contract: { parts: [{ id: 'q1', resolution: 'coverage_missing', facet_ids: [] as string[], context_ids: [] as string[] }] } });
const proof = (id = 'q1-r1', caps = ['U01-C01']) => ({ id, capability_ids: caps, blocking_limit_ids: [] as string[] });
const review = (p = plan(), proofs = [proof()]): DemandReview => ({ decision: 'pass', decomposition_complete: true, relevant: true, scope_appropriate: true, context_appropriate: true, premise_handled: true, task_fit: true, proportionate: true,
    facets: p.facets.map(f => ({ ...f, unit_ids: selectedUnits(f.unit_ids, catalog).map(u => u.id), covered: true })),
    question_parts: [{ id: 'q1', faithful: true, appropriately_resolved: true, requirements: proofs, additional_requirements: [] }], issues: [] });
function checkReview(raw: unknown, p = plan(), d = demand(), q = question) {
    const selection = parseDemandSelection(p, q, catalog, d), units = selection.decision === 'answer' ? selectedUnits(selection.facets.flatMap(f => f.unit_ids), catalog) : [];
    return parseDemandReview(raw, selection, units, catalog, capabilities, d);
}
function harness(outputs: unknown[], remaining = 30) {
    const calls: { stage: ComposedStage; input: any }[] = [];
    const service = createComposedAnswerService({ catalogBytes, catalogSha256: catalogSha, capabilityBytes, capabilitySha256: CAPABILITY_SHA, now: () => now,
        repository: { loadForQuestion: async () => ({ verified, binding, candidateIds: ['S01'] }), recheck: async () => {} },
        provider: { model: 'offline', remaining: () => remaining - calls.length, invoke: async (stage, input) => { calls.push({ stage, input }); return outputs.shift(); } } });
    return { service, calls };
}

describe('Immutable source-blind demand contract', () => {
    test('normal three stages expose only the original and taxonomy to analysis, then sealed fragments without a duplicate index', async () => {
        const p = plan(), h = harness([rawAnalysis(), p, review(p)]), answer = await h.service.answer(question);
        expect(answer.status).toBe('qualified'); expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'verify']);
        expect(h.calls[0]!.input).toEqual(analysisInput(question));
        for (const call of h.calls.slice(1)) { expect(call.input.question_index).toBeUndefined(); expect(call.input.original_question).toBe(question); expect(call.input.question_analysis.parts[0].question_fragment).toBe(question); }
        expect(h.calls[2]!.input.selection_representation).toBe('canonical_response_v2');
        expect(h.calls[2]!.input.selection.question_contract.parts[0]).toEqual({ id: 'q1', resolution: 'covered', facet_ids: ['f1'], context_ids: [] });
        expect(h.calls[2]!.input.question_analysis.initial_seal_sha256).toBe(h.calls[1]!.input.question_analysis.seal_sha256);
    });
    test('an invalid analysis consumes one stage with no source-exposed correction', async () => {
        const h = harness([{ ...rawAnalysis(), source_ids: ['S01'] }, plan(), review()]);
        expect((await h.service.answer(question)).reason_code).toBe('question_analysis_invalid'); expect(h.calls.map(c => c.stage)).toEqual(['analyze']);
    });
    test('five-stage admission refuses a question before any provider request', async () => {
        const h = harness([], 4); expect((await h.service.answer(question)).reason_code).toBe('budget_exhausted'); expect(h.calls).toEqual([]);
    });
    test('plan cannot change the operation, partitions, kinds or legacy response state', () => {
        for (const extra of [{ operation: 'calculate' }, { parts: [{ ...plan().question_contract.parts[0], start_token: 1 }] }, { parts: [{ ...plan().question_contract.parts[0], kind: 'background' }] }, { parts: [{ ...plan().question_contract.parts[0], resolution: 'covered' }] }, { parts: [{ ...plan().question_contract.parts[0], resolution: 'not_answered' }] }]) {
            const p = plan(); Object.assign(p.question_contract, extra);
            expect(() => parseDemandSelection(p, question, catalog, demand())).toThrow('selection_invalid');
        }
        expect(() => parseDemandSelection(plan(), question + ' Changed.', catalog, demand())).toThrow('selection_invalid');
    });
    test('whole withholding projects neutral withheld explicitly and preserves the actual independent gap', () => {
        const q = 'Explain the concept. Address the unavailable instruction.';
        const a = rawAnalysis(); a.parts.push({ ...a.parts[0]!, id: 'q2', start_token: 3 });
        const d = demand(a, q), p = boundary(); p.question_contract.parts = [{ id: 'q1', resolution: 'withheld', facet_ids: [], context_ids: [] }, { id: 'q2', resolution: 'coverage_missing', facet_ids: [], context_ids: [] }];
        const before = structuredClone(p), parsed = parseDemandSelection(p, q, catalog, d);
        expect(parsed.question_contract.parts.map(part => part.resolution)).toEqual(['not_answered', 'coverage_missing']); expect(p).toEqual(before);
        p.question_contract.parts[0]!.facet_ids = ['f99'];
        expect(() => parseDemandSelection(p, q, catalog, d)).toThrow('selection_invalid'); expect(p.question_contract.parts[0]!.facet_ids).toEqual(['f99']);
    });
    test('a sealed unresolved reference stays context-required alongside an independent source gap', () => {
        const q = 'What does that mean? Explain an unavailable process.';
        const a = rawAnalysis(); a.parts[0]!.kind = 'ambiguous_reference'; a.parts[0]!.ambiguity_context_ids = ['referenced_subject']; a.parts.push({ ...a.parts[0]!, id: 'q2', start_token: 4, kind: 'request', ambiguity_context_ids: [] });
        const d = demand(a, q), p = boundary(); p.question_contract.parts = [{ id: 'q1', resolution: 'context_required', facet_ids: [], context_ids: ['referenced_subject'] }, { id: 'q2', resolution: 'coverage_missing', facet_ids: [], context_ids: [] }];
        expect(parseDemandSelection(p, q, catalog, d).reason).toBe('coverage_missing');
        p.question_contract.parts[0]!.context_ids = ['location']; expect(() => parseDemandSelection(p, q, catalog, d)).toThrow('selection_invalid');
    });
    test('an excluded operation cannot be replaced with a conceptual answer', () => {
        const d = demand(rawAnalysis(undefined, 'calculate'));
        expect(() => parseDemandSelection(plan(), question, catalog, d)).toThrow('selection_invalid');
        const p = boundary(); p.question_contract.parts[0]!.resolution = 'action_out_of_scope';
        expect(parseDemandSelection(p, question, catalog, d).reason).toBe('action_out_of_scope');
    });
    test('a conditional effect cannot be downgraded to general advice by omitting or retyping its sealed need', () => {
        const q = 'When an arrangement is absent, does a reporting instruction apply?';
        const d = demand(rawAnalysis([{ kind: 'conditional_rule', subject: 'reporting_methods' }]), q), p = plan(['U02']);
        const r = review(p, [proof('q1-r1', ['U02-C01'])]);
        expect(() => checkReview(r, p, d, q)).toThrow('selection_review_invalid');
        Object.assign(r.question_parts[0]!.requirements[0]!, { kind: 'general_recommendation', subject: 'reporting_methods' });
        expect(() => checkReview(r, p, d, q)).toThrow('selection_review_invalid');
        r.question_parts[0]!.requirements = []; expect(() => checkReview(r, p, d, q)).toThrow('selection_review_invalid');
        const b = boundary(), correct = review(b, [proof('q1-r1', [])]);
        expect(checkReview(correct, b, d, q).review.decision).toBe('pass');
    });
    test('a semantic rejection of sealed task meaning stops without rewriting analysis', async () => {
        const p = plan(), r = review(p); r.decision = 'revise'; r.question_parts[0]!.faithful = false; r.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'The sealed operation changes the original request.' }];
        const h = harness([rawAnalysis(), p, r, p, review(p)]);
        expect((await h.service.answer(question)).reason_code).toBe('question_analysis_not_verified'); expect(h.calls).toHaveLength(3);
    });
    test('compatible additions survive the sole replacement and its fresh review under server IDs', async () => {
        const p = plan(), r = review(p); r.decision = 'revise'; r.question_parts[0]!.appropriately_resolved = false;
        r.question_parts[0]!.additional_requirements = [{ kind: 'general_recommendation', subject: 'reporting_methods', capability_ids: [], blocking_limit_ids: [] }];
        r.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'A compatible additional requested recommendation has no selected support.' }];
        const corrected = plan(['U01', 'U02']), fresh = review(corrected, [proof(), proof('q1-a1', ['U02-C01'])]);
        const h = harness([rawAnalysis(), p, r, corrected, fresh]), answer = await h.service.answer(question);
        expect(answer.status).toBe('qualified'); expect(answer.correction_kind).toBe('source_review'); expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'verify', 'plan', 'verify']);
        const fixed = h.calls[3]!.input.question_analysis, final = h.calls[4]!.input.question_analysis;
        expect(fixed).toEqual(final); expect(final.parts[0].requirements.map((n: any) => n.id)).toEqual(['q1-r1', 'q1-a1']); expect(Object.isFrozen(checkReview(r, p).demand)).toBe(true);
        fresh.question_parts[0]!.requirements.pop(); const omitted = harness([rawAnalysis(), p, r, corrected, fresh]);
        expect((await omitted.service.answer(question)).reason_code).toBe('selection_review_invalid'); expect(omitted.calls).toHaveLength(5);
    });
    test('duplicate or ID-bearing additions reject, and late unmet additions cannot buy a sixth stage', async () => {
        for (const addition of [null, 7, 'invalid', { kind: 'definition', subject: 'accounting_methods', capability_ids: ['U01-C01'], blocking_limit_ids: [] }, { id: 'q1-r1', kind: 'general_recommendation', subject: 'reporting_methods', capability_ids: [], blocking_limit_ids: [] }]) {
            const r = review(); r.question_parts[0]!.additional_requirements = [addition as any]; expect(() => checkReview(r)).toThrow('selection_review_invalid');
        }
        const p = plan(), r = review(p); r.decision = 'revise'; r.premise_handled = false; r.issues = [{ code: 'premise', target_id: 'answer', explanation: 'A selected premise needs reconsideration.' }];
        const final = review(p); final.decision = 'revise'; final.question_parts[0]!.appropriately_resolved = false; final.question_parts[0]!.additional_requirements = [{ kind: 'conditional_rule', subject: 'reporting_methods', capability_ids: [], blocking_limit_ids: [] }]; final.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'A newly identified compatible need remains unsupported.' }];
        const h = harness([rawAnalysis(), p, r, p, final, p, review(p)]);
        expect((await h.service.answer(question)).reason_code).toBe('selection_not_verified'); expect(h.calls).toHaveLength(5);
    });
    test('a late compatible addition can pass only with support already in the unchanged final selection', async () => {
        const p = plan(['U01', 'U02']), first = review(p); first.decision = 'revise'; first.premise_handled = false;
        first.issues = [{ code: 'premise', target_id: 'answer', explanation: 'Reconsider the selected treatment of the premise.' }];
        const final = review(p); final.question_parts[0]!.additional_requirements = [{ kind: 'general_recommendation', subject: 'reporting_methods', capability_ids: ['U02-C01'], blocking_limit_ids: [] }];
        const h = harness([rawAnalysis(), p, first, p, final]);
        expect((await h.service.answer(question)).status).toBe('qualified'); expect(h.calls).toHaveLength(5);
        const invalid = review(p); invalid.question_parts[0]!.additional_requirements = [null as any];
        const malformed = harness([rawAnalysis(), p, invalid]);
        expect((await malformed.service.answer(question)).reason_code).toBe('selection_review_invalid'); expect(malformed.calls).toHaveLength(3);
    });
    test('exact size diagnostics count the deduplicated required closure without changing the proposed selection', () => {
        const p = plan(catalog.units.map(u => u.id)), before = structuredClone(p), packet: any = demandSelectionCorrection(p, question, catalog, demand(), capabilities);
        expect(packet.kind).toBe('selection_size'); expect(packet.closure_unit_ids).toHaveLength(23); expect(packet.closure_title_text_characters).toBe(titleTextCharacters(catalog.units));
        expect(packet.minimum_reduction.units).toBe(15); expect(packet.exact_unit_costs.find((u: any) => u.id === 'U03').closure_unit_ids).toEqual(['U01', 'U02', 'U03']);
        expect(p).toEqual(before); expect(packet.previous_selection).toEqual(p);
    });
    test('irrelevant own wording rejected by a valid semantic review is never displayed without a fresh complete replacement pass', async () => {
        // The flexible structural check accepts an own inquiry capability for a
        // conceptual label; the semantic reviewer must reject its actual fit.
        const unrelated = plan(['U23']), negative = review(unrelated, [proof('q1-r1', ['U23-C01'])]);
        negative.decision = 'revise'; negative.question_parts[0]!.appropriately_resolved = false;
        negative.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'The selected inquiry wording does not explain the requested concept.' }];
        expect(checkReview(negative, unrelated).review.decision).toBe('revise');
        const failed = harness([rawAnalysis(), unrelated, negative, unrelated, negative]);
        expect((await failed.service.answer(question)).reason_code).toBe('selection_not_verified'); expect(failed.calls).toHaveLength(5);
        const corrected = plan(), h = harness([rawAnalysis(), unrelated, negative, corrected, review(corrected)]), answer = await h.service.answer(question);
        expect(answer.status).toBe('qualified'); expect(answer.claims.map(claim => claim.id)).toEqual(['U01']); expect(h.calls).toHaveLength(5);
    });
});

describe('Bounded analyze transport and failure metadata', () => {
    test('analysis packets reject source/candidate fields before reservation or I/O', async () => {
        let reservations = 0, fetches = 0;
        const provider = createComposedProvider({ apiKey: 'offline', budget: { maxCalls: 10, remaining: () => 10, reserve: () => ++reservations }, fetch: async () => { fetches++; return Response.json({}); } });
        const polluted = { ...analysisInput(question), unit_catalog: [{ id: 'U01' }] };
        expect(() => composedRequestBody('analyze', polluted)).toThrow('question_analysis_invalid');
        await expect(provider.invoke('analyze', polluted, new AbortController().signal)).rejects.toThrow('question_analysis_invalid');
        expect(reservations).toBe(0); expect(fetches).toBe(0);
    });
    test('truncated output records only enum/number metadata and never partial text or thinking', async () => {
        const events: ComposedStageEvent[] = [];
        const provider = createComposedProvider({ apiKey: 'offline', budget: { maxCalls: 10, remaining: () => 10, reserve: () => 1 }, onStage: e => events.push(e), fetch: async () => Response.json({ model: 'claude-opus-5', stop_reason: 'max_tokens', usage: { input_tokens: 123, output_tokens: 8192, cache: 'private-marker' }, content: [{ type: 'thinking', thinking: 'secret-thinking' }, { type: 'text', text: 'partial-answer' }] }) });
        await expect(provider.invoke('verify', {}, new AbortController().signal)).rejects.toThrow('provider_truncated');
        expect(events.at(-1)).toEqual({ stage: 'verify', attempt: 1, phase: 'failed', code: 'provider_truncated', http_status: 200, stop_reason: 'max_tokens', usage: { input_tokens: 123, output_tokens: 8192 }, elapsed_ms: expect.any(Number), failure_phase: 'decoding', abort_source: 'none' });
        expect(JSON.stringify(events)).not.toMatch(/private-marker|secret-thinking|partial-answer/);
    });
    test('invalid usage values and unrecognized stop text are excluded from failure metadata', async () => {
        const events: ComposedStageEvent[] = [];
        const provider = createComposedProvider({ apiKey: 'offline', budget: { maxCalls: 10, remaining: () => 10, reserve: () => 1 }, onStage: e => events.push(e), fetch: async () => Response.json({ model: 'claude-opus-5', stop_reason: 'private-stop-text', usage: { input_tokens: -1, output_tokens: 'private-output', extra: 'private-extra' }, content: [] }) });
        await expect(provider.invoke('verify', {}, new AbortController().signal)).rejects.toThrow('provider_failure');
        expect(events.at(-1)).toEqual({ stage: 'verify', attempt: 1, phase: 'failed', code: 'provider_failure', http_status: 200, elapsed_ms: expect.any(Number), failure_phase: 'decoding', abort_source: 'none' });
        expect(JSON.stringify(events)).not.toContain('private-');
    });
    test('the whole-question deadline cancels the actual provider and cannot reserve a later stage', async () => {
        let reserved = 0, fetches = 0; const events: ComposedStageEvent[] = [];
        const provider = createComposedProvider({ apiKey: 'offline', budget: { maxCalls: 10, remaining: () => 10 - reserved, reserve: () => ++reserved }, onStage: event => events.push(event), fetch: async (_url, init) => {
            fetches++; return new Promise<Response>((_resolve, reject) => { const signal = init.signal!; const abort = () => reject(new Error('private-abort-reason')); if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }); });
        } });
        const service = createComposedAnswerService({ provider, catalogBytes, catalogSha256: catalogSha, capabilityBytes, capabilitySha256: CAPABILITY_SHA, now: () => now, deadlineMs: 15,
            repository: { loadForQuestion: async () => ({ verified, binding, candidateIds: ['S01'] }), recheck: async () => {} } });
        const result = await service.answer(question); await new Promise(resolve => setTimeout(resolve, 5));
        expect(result.reason_code).toBe('request_timeout'); expect(result.claims).toEqual([]); expect(reserved).toBe(1); expect(fetches).toBe(1);
        expect(events.at(-1)).toMatchObject({ phase: 'failed', code: 'request_cancelled', abort_source: 'caller' });
        expect(JSON.stringify(events)).not.toContain('private-abort-reason');
    });
});


describe('Route targets and canonical review states', () => {
    for (const example of [
        { question: 'Where can I obtain a regional electricity emission factor?', subject: 'grid_factor_source', unit: 'U04', cap: 'U04-C02' },
        { question: 'Where can I obtain records of electricity entering a facility?', subject: 'activity_records', unit: 'U09', cap: 'U09-C01' },
        { question: 'Where can I look up the geographic subregion?', subject: 'subregion_lookup', unit: 'U10', cap: 'U10-C01' },
        { question: 'Where can I find the period represented by factor data?', subject: 'factor_data_period', unit: 'U11', cap: 'U11-C01' },
    ]) test(`a wrong source-route target stays withheld after the sole unchanged replacement: ${example.subject}`, async () => {
        const analysis = rawAnalysis([{ kind: 'source_route', subject: example.subject }]);
        const p = plan([example.unit]), r = review(p, [proof('q1-r1', [example.cap])]);
        // A positive review cannot substitute a route to a different target.
        // Correctly negative reviews still proceed through the one correction.
        expect(() => checkReview(r, p, demand(analysis, example.question), example.question)).toThrow('selection_review_invalid');
        r.decision = 'revise'; r.question_parts[0]!.appropriately_resolved = false;
        r.question_parts[0]!.requirements[0]!.capability_ids = [];
        r.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'The cited route points to a different information target than the original request.' }];
        const h = harness([analysis, p, r, p, r]), result = await h.service.answer(example.question);
        expect(result.reason_code).toBe('selection_not_verified'); expect(result.claims).toEqual([]); expect(h.calls).toHaveLength(5);
        expect(h.calls[4]!.input.question_analysis.parts[0].requirements[0].subject).toBe(example.subject);
    });
    test('a route correction can display only after a fresh review approves the unchanged requested target', async () => {
        const q = 'Where can I obtain a regional electricity emission factor?', analysis = rawAnalysis([{ kind: 'source_route', subject: 'grid_factor_source' }]);
        const wrong = plan(['U04']), rejected = review(wrong, [proof('q1-r1', ['U04-C02'])]);
        rejected.decision = 'revise'; rejected.question_parts[0]!.appropriately_resolved = false;
        rejected.question_parts[0]!.requirements[0]!.capability_ids = [];
        rejected.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'Consumption records do not provide the requested grid factor route.' }];
        const corrected = plan(['U09']), accepted = review(corrected, [proof('q1-r1', ['U09-C01'])]);
        const h = harness([analysis, wrong, rejected, corrected, accepted]), result = await h.service.answer(q);
        expect(result.status).toBe('qualified'); expect(result.claims.map(c => c.id)).toContain('U09'); expect(h.calls).toHaveLength(5);
        expect(h.calls[4]!.input.question_analysis.parts[0].requirements[0]).toEqual(h.calls[2]!.input.question_analysis.parts[0].requirements[0]);
    });
    test('a validated whole boundary reaches review as canonical not_answered with its exact independent gap', async () => {
        const q = 'Explain the concept. Describe the unavailable subject.';
        const analysis = rawAnalysis(); analysis.parts.push({ id: 'q2', start_token: 3, kind: 'request', requirements: [{ kind: 'definition', subject: 'unrepresented_subject' }], ambiguity_context_ids: [] });
        const p = boundary(); p.question_contract.parts = [
            { id: 'q1', resolution: 'withheld', facet_ids: [], context_ids: [] },
            { id: 'q2', resolution: 'coverage_missing', facet_ids: [], context_ids: [] },
        ];
        const r = review(p, [proof('q1-r1', [])]); r.question_parts.push({ id: 'q2', faithful: true, appropriately_resolved: true, requirements: [proof('q2-r1', [])], additional_requirements: [] });
        const original = structuredClone(p), h = harness([analysis, p, r]), result = await h.service.answer(q);
        expect(result.reason_code).toBe('coverage_missing'); expect(result.claims).toEqual([]); expect(h.calls).toHaveLength(3);
        expect(p).toEqual(original); expect(h.calls[2]!.input.selection_representation).toBe('canonical_response_v2');
        expect(h.calls[2]!.input.selection.question_contract.parts.map((part: { resolution: string }) => part.resolution)).toEqual(['not_answered', 'coverage_missing']);
        expect(result.scope_gaps).toEqual([{ question_fragment: 'Describe the unavailable subject.', reason: 'coverage_missing', context_ids: [] }]);
    });
});


describe('One bounded size correction with optional bundle assistance', () => {
    const oversize = () => plan(['U04', 'U09', 'U13', 'U23']);
    test('a complete manual alternative outside the prior selection still receives fresh review within four stages', async () => {
        const first = oversize(), corrected = { bundle_id: 'manual', alternative_selection: [plan()] };
        const h = harness([rawAnalysis(), first, corrected, review()]), result = await h.service.answer(question);
        expect(result.status).toBe('qualified'); expect(result.claims.map(c => c.id)).toEqual(['U01']);
        expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'plan', 'verify']);
        expect(h.calls[2]!.input.correction_packet.feasible_bundles.pool_unit_ids).not.toContain('U01');
        expect(h.calls[3]!.input.question_analysis.parts).toEqual(h.calls[2]!.input.question_analysis.parts);
        expect(result.correction_kind).toBe('selection_size');
    });
    test('manual never bypasses size limits or receives another correction', async () => {
        const p = oversize(), h = harness([rawAnalysis(), p, { bundle_id: 'manual', alternative_selection: [p] }, review()]);
        const result = await h.service.answer(question);
        expect(result.reason_code).toBe('selection_too_large'); expect(result.claims).toEqual([]); expect(h.calls).toHaveLength(3);
    });
    test('a listed bundle is not semantic approval and an adverse fresh review ends the sole correction', async () => {
        const first = oversize(), packet = demandSelectionCorrection(first, question, catalog, demand(), capabilities);
        if (!packet || packet.kind !== 'selection_size') throw new Error('expected size packet');
        const bundle = packet.feasible_bundles.bundles.find(b => b.unit_ids.includes('U04'))!;
        const corrected = { bundle_id: bundle.id, alternative_selection: [] }, negative = review(plan([...bundle.unit_ids]), [proof('q1-r1', ['U04-C01'])]);
        negative.decision = 'revise'; negative.task_fit = false;
        negative.issues = [{ code: 'task_fit', target_id: 'answer', explanation: 'The compact selection does not perform the requested conceptual task.' }];
        const h = harness([rawAnalysis(), first, corrected, negative, plan(), review()]), result = await h.service.answer(question);
        expect(result.reason_code).toBe('selection_not_verified'); expect(result.claims).toEqual([]); expect(h.calls).toHaveLength(4);
    });
    test('a listed ID cannot silently select a different union or clear unknown references', async () => {
        for (const replacement of [{ ...plan(), bundle_id: 'b99' }, { ...plan(), bundle_id: 'b01' }, { ...plan(), bundle_id: 'none' }]) {
            const h = harness([rawAnalysis(), oversize(), replacement, review()]), result = await h.service.answer(question);
            expect(result.reason_code).toBe('selection_invalid'); expect(result.claims).toEqual([]); expect(h.calls).toHaveLength(3);
        }
        const invalidPlan = boundary(); invalidPlan.question_contract.parts[0]!.facet_ids = ['f99']; const invalid = { bundle_id: 'none', alternative_selection: [invalidPlan] };
        const h = harness([rawAnalysis(), oversize(), invalid, review()]);
        expect((await h.service.answer(question)).reason_code).toBe('selection_invalid'); expect(h.calls).toHaveLength(3);
    });
});

// A known companion is not thereby relevant to a different requested task.
test('choice-only projection still withholds a wrong-topic retained companion after fresh review', async () => {
    const q = 'Explain what electricity consumption records should be gathered.';
    const a = rawAnalysis([{ kind: 'explanation', subject: 'activity_records' }]);
    const d = demand(a, q), first = plan(['U08', 'U09', 'U11', 'U13', 'U23']);
    const packet = demandSelectionCorrection(first, q, catalog, d, capabilities);
    if (!packet || packet.kind !== 'selection_size') throw new Error('expected size packet');
    const bundle = packet.feasible_bundles.bundles[0]!;
    expect(bundle.unit_ids).not.toContain('U04');
    const support = capabilities.units.find(u => bundle.unit_ids.includes(u.unit_id))!.capabilities[0]!;
    const r = review(plan([...bundle.unit_ids]), [proof('q1-r1', [support.id])]);
    r.decision = 'revise'; r.question_parts[0]!.appropriately_resolved = false; r.task_fit = false; r.facets[0]!.covered = false;
    r.issues = [
        {code:'question_part',target_id:'q1',explanation:'The retained grid and supplier factor wording does not perform the requested consumption-record collection task.'},
        {code:'coverage',target_id:'f1',explanation:'Known factor-source companions are not the required activity-record instructions.'},
        {code:'task_fit',target_id:'answer',explanation:'Mechanical closure does not establish the requested information target.'},
    ];
    const h = harness([a, first, {bundle_id:bundle.id,alternative_selection:[]}, r, first]);
    const answer = await h.service.answer(q);
    expect(answer.reason_code).toBe('selection_not_verified'); expect(answer.claims).toEqual([]);
    expect(answer.correction_kind).toBe('selection_size'); expect(h.calls).toHaveLength(4);
    expect(h.calls[3]!.input.selection.facets[0].unit_ids).toEqual([...bundle.unit_ids]);
    expect(h.calls[3]!.input.question_analysis.parts[0].question_fragment).toBe(q);
});
