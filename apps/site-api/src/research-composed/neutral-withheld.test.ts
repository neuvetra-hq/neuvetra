import { planTestInput } from './test-plan-input';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parsePassageRelease } from '../research-passages/release';
import { parseUnitCatalog, SOURCE_SHA } from './catalog';
import { parseCapabilities, CAPABILITY_SHA, CAPABILITY_UNIT_SHA } from './capabilities';
import { parseQuestionAnalysis } from './question-analysis';
import { demandSelectionCorrection, initialDemand, parseDemandReview, parseDemandSelection } from './demand-selection';
import { createComposedAnswerService } from './answer';
import { canonicalReviewRepresentation, composedRequestBody, safeComposedUsage } from './provider';
import { createCatalogAbsenceCertificate } from './catalog-absence';

const now = Date.parse('2026-09-12T12:00:00Z');
const read = (p: string) => readFileSync(new URL(`../../../../data/research/${p}`, import.meta.url));
const release = parsePassageRelease(JSON.parse(read('releases/scope2-website.v1.json').toString()), now);
const verified = { release, passages: release.passages, sha256: SOURCE_SHA };
const catalogBytes = read('answer-units/scope2-website.epa-acquisition.v1.json');
const capabilityBytes = read('capabilities/scope2-website.epa-limitations.v1.json');
const catalog = parseUnitCatalog(catalogBytes, CAPABILITY_UNIT_SHA, verified, now).catalog;
const caps = parseCapabilities(capabilityBytes, CAPABILITY_SHA, catalog, CAPABILITY_UNIT_SHA, now);
const question = 'What does that mean? Explain its timing. Address an unrelated task.';
const analysis = () => ({ operation: 'explain', parts: [
    { id: 'q1', start_token: 0, kind: 'ambiguous_reference', requirements: [{ kind: 'explanation', subject: 'unrepresented_subject' }], ambiguity_context_ids: ['referenced_subject'] },
    { id: 'q2', start_token: 4, kind: 'request', requirements: [{ kind: 'limitation', subject: 'agreement_period_alignment' }], ambiguity_context_ids: [] },
    { id: 'q3', start_token: 7, kind: 'request', requirements: [{ kind: 'conditional_rule', subject: 'unrepresented_subject' }], ambiguity_context_ids: [] },
] });
const demand = () => initialDemand(parseQuestionAnalysis(analysis(), question));
const proposal = (): any => ({ facets: [], question_contract: { parts: [
    { id: 'q1', resolution: 'context_required', facet_ids: [], context_ids: ['referenced_subject'] },
    { id: 'q2', resolution: 'withheld', facet_ids: [], context_ids: [] },
    { id: 'q3', resolution: 'coverage_missing', facet_ids: [], context_ids: [] },
] } });
const review = (): any => ({ decision: 'pass', decomposition_complete: true, relevant: true, scope_appropriate: true, context_appropriate: true, premise_handled: true, task_fit: true, proportionate: true,
    facets: [], issues: [], question_parts: analysis().parts.map(p => ({ id: p.id, faithful: true, appropriately_resolved: true, requirements: [{ id: `${p.id}-r1`, capability_ids: [], blocking_limit_ids: [] }], additional_requirements: [] })) });
const parse = (p = proposal()) => parseDemandSelection(p, question, catalog, demand());
function harness(outputs: unknown[]) {
    const calls: { stage: string; input: any }[] = [];
    const binding = { scopeId: 'offline', buildId: 'offline', namespace: 'offline', releaseId: release.release_id, releaseVersion: release.version, releaseSha256: SOURCE_SHA, profileSha256: 'offline', sourceSha256: release.sources.map(s => s.sha256) };
    const service = createComposedAnswerService({ catalogBytes, catalogSha256: CAPABILITY_UNIT_SHA, capabilityBytes, capabilitySha256: CAPABILITY_SHA, now: () => now,
        repository: { loadForQuestion: async () => ({ verified, binding, candidateIds: ['S01'] }), recheck: async () => {} },
        provider: { model: 'offline', remaining: () => 30 - calls.length, invoke: async (stage, input) => { calls.push({ stage, input }); return outputs.shift(); } } });
    return { service, calls };
}

describe('Neutral unanswered remainder and exact clarification diagnostics', () => {
    test('mixed refusal preserves original parts, explicit ambiguity and independent coverage, without a source claim', () => {
        const p = proposal(), before = structuredClone(p), result = parse(p);
        expect(p).toEqual(before); expect(result.reason).toBe('coverage_missing');
        expect(result.question_contract.parts.map(p => p.resolution)).toEqual(['context_required', 'not_answered', 'coverage_missing']);
        expect(result.question_contract.parts[0]!.context_ids).toEqual(['referenced_subject']);
        expect(parseDemandReview(review(), result, [], catalog, caps, demand()).review.decision).toBe('pass');
        expect(createCatalogAbsenceCertificate(question, result, demand(), catalog, caps, { catalog_sha256: CAPABILITY_UNIT_SHA, capability_sha256: CAPABILITY_SHA, profile_sha256: 'a'.repeat(64) }, now)).toBeNull();
    });
    test('all-withheld has no refusal cause, and an answer cannot contain withheld', () => {
        const a = analysis(); a.parts[0]!.kind = 'request'; a.parts[0]!.ambiguity_context_ids = [];
        const d = initialDemand(parseQuestionAnalysis(a, question)), p = proposal();
        p.question_contract.parts.forEach((part: any) => { part.resolution = 'withheld'; part.context_ids = []; });
        expect(() => parseDemandSelection(p, question, catalog, d)).toThrow('selection_invalid');
        p.facets = [{ id: 'f1', unit_ids: ['U01'] }]; p.question_contract.parts[0].resolution = 'source_available'; p.question_contract.parts[0].facet_ids = ['f1'];
        expect(() => parseDemandSelection(p, question, catalog, d)).toThrow('selection_invalid');
    });
    test('sealed ambiguity, explicit wire version and every supplied reference remain strict', () => {
        for (const mutation of [
            (p: any) => { p.question_contract.parts[0].resolution = 'withheld'; p.question_contract.parts[0].context_ids = []; },
            (p: any) => { p.question_contract.parts[1].resolution = 'source_available'; },
            (p: any) => { p.question_contract.parts[1].resolution = 'not_answered'; },
            (p: any) => { p.question_contract.parts[1].facet_ids = ['f99']; },
            (p: any) => { p.question_contract.parts.pop(); },
            (p: any) => { p.question_contract.parts[0].context_ids = ['location']; },
        ]) { const p = proposal(); mutation(p); const before = structuredClone(p); expect(() => parse(p)).toThrow('selection_invalid'); expect(p).toEqual(before); }
    });
    test('empty clarification and forbidden IDs identify the exact validated part without filling anything', () => {
        const p = proposal(); p.question_contract.parts[1].resolution = 'context_required';
        const before = structuredClone(p), packet = demandSelectionCorrection(p, question, catalog, demand(), caps);
        expect(packet).toMatchObject({ kind: 'selection_contract', validation_issue: 'context_ids_required', validation_target: { part_id: 'q2', field: 'context_ids' } });
        expect(p).toEqual(before);
        p.question_contract.parts[1].resolution = 'withheld'; p.question_contract.parts[1].context_ids = ['location'];
        expect(demandSelectionCorrection(p, question, catalog, demand(), caps)).toMatchObject({ validation_issue: 'context_ids_forbidden', validation_target: { part_id: 'q2', field: 'context_ids' } });
        p.question_contract.parts[1].resolution = 'context_required'; p.question_contract.parts[1].context_ids = ['referenced_subject'];
        expect(parse(p).question_contract.parts[1]!.context_ids).toEqual(['referenced_subject']);
    });
    test('calculate and submit keep deterministic action precedence', () => {
        for (const operation of ['calculate', 'submit_or_file']) {
            const a = analysis(); a.operation = operation; const d = initialDemand(parseQuestionAnalysis(a, question));
            expect(() => parseDemandSelection(proposal(), question, catalog, d)).toThrow('selection_invalid');
            const p = proposal(); p.question_contract.parts[2].resolution = 'action_out_of_scope';
            expect(parseDemandSelection(p, question, catalog, d).reason).toBe('action_out_of_scope');
        }
    });
    test('compatible added need on neutral remainder persists without forcing positive support', () => {
        const p = parse(), first = review();
        first.question_parts[1].additional_requirements = [{ kind: 'limitation', subject: 'generation_boundary', capability_ids: [], blocking_limit_ids: [] }];
        const checked = parseDemandReview(first, p, [], catalog, caps, demand());
        expect(checked.demand.additions[0]!.requirements[0]!.id).toBe('q2-a1');
        expect(() => parseDemandReview(review(), p, [], catalog, caps, checked.demand)).toThrow('selection_review_invalid');
        const second = review(); second.question_parts[1].requirements.push({ id: 'q2-a1', capability_ids: [], blocking_limit_ids: [] });
        expect(parseDemandReview(second, p, [], catalog, caps, checked.demand).review.decision).toBe('pass');
    });
    test('fresh semantic rejection of concealed gap is preserved and cannot buy a second correction', async () => {
        const bad = proposal(); bad.question_contract.parts[1].resolution = 'context_required';
        const negative = review(); negative.decision = 'revise'; negative.question_parts[1].appropriately_resolved = false;
        negative.issues = [{ code: 'question_part', target_id: 'q2', explanation: 'This neutral remainder hides an independently established gap.' }];
        const h = harness([analysis(), bad, proposal(), negative, proposal(), review()]);
        expect((await h.service.answer(question)).reason_code).toBe('selection_not_verified');
        expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'plan', 'verify']);
    });
    test('second invalid empty-context proposal stops at three stages; no automatic withheld conversion', async () => {
        const bad = proposal(); bad.question_contract.parts[1].resolution = 'context_required';
        const h = harness([analysis(), bad, structuredClone(bad), review()]);
        expect((await h.service.answer(question)).reason_code).toBe('selection_invalid'); expect(h.calls).toHaveLength(3);
    });
    test('normal boundary uses versioned neutral canonical input and exposes only actual gap records', async () => {
        const h = harness([analysis(), proposal(), review()]), answer = await h.service.answer(question);
        expect(answer.status).toBe('unsupported'); expect(answer.reason_code).toBe('coverage_missing');
        expect(h.calls).toHaveLength(3); expect(h.calls[2]!.input.selection_representation).toBe(canonicalReviewRepresentation);
        expect(canonicalReviewRepresentation).toBe('canonical_response_v2');
        expect(answer.scope_gaps?.map(g => g.reason)).toEqual(['context_required', 'coverage_missing']);
        expect(answer.claims).toEqual([]);
    });
});

describe('Verifier capacity and numeric-only diagnostics', () => {
    test('review capacity changes only the explicit review ceiling, retaining high effort and byte bounds', () => {
        const body = JSON.parse(composedRequestBody('verify', { selection_representation: canonicalReviewRepresentation }));
        expect(JSON.stringify(body)).toContain('If an affirmative part lacks matching support'); expect(JSON.stringify(body)).toContain('any affirmatively covered part'); expect(body.max_tokens).toBe(16384); expect(body.output_config.effort).toBe('high'); expect(body.thinking).toEqual({ type: 'adaptive', display: 'omitted' });
        expect(JSON.parse(composedRequestBody('plan', planTestInput())).max_tokens).toBe(3000);
        expect(() => composedRequestBody('verify', { arbitrary: 'x'.repeat(64000) })).toThrow('context_limit');
    });
    test('only bounded numeric token counts are retained; absent breakdown is not inferred', () => {
        expect(safeComposedUsage({ input_tokens: 3, output_tokens: 12, output_tokens_details: { thinking_tokens: 9, secret: 'NO' }, secret: 'NO' })).toEqual({ input_tokens: 3, output_tokens: 12, thinking_tokens: 9 });
        for (const value of [-1, 13, 1.5, '9', null, Infinity]) expect(safeComposedUsage({ output_tokens: 12, output_tokens_details: { thinking_tokens: value } })).toEqual({ output_tokens: 12 });
        expect(safeComposedUsage({ output_tokens: 12 })).toEqual({ output_tokens: 12 });
        expect(safeComposedUsage({ output_tokens_details: { thinking_tokens: 0 }, text: 'NO' })).toBeUndefined();
        expect(safeComposedUsage({ input_tokens: 0, output_tokens: 0, output_tokens_details: { thinking_tokens: 0 } })).toEqual({ input_tokens: 0, output_tokens: 0, thinking_tokens: 0 });
    });
});
