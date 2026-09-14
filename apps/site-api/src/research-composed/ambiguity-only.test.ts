import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { hash, parsePassageRelease } from '../research-passages/release';
import { parseUnitCatalog, SOURCE_SHA } from './catalog';
import { CAPABILITY_SHA, CAPABILITY_UNIT_SHA, parseCapabilities, validateSupportRequirements } from './capabilities';
import { analysisInput, analysisVersion, parseQuestionAnalysis } from './question-analysis';
import { demandInput, initialDemand, parseDemandSelection, parseDemandReview, plannerMaterialIds, type DemandState } from './demand-selection';
import { createCatalogAbsenceCertificate, assertCatalogAbsenceCertificate } from './catalog-absence';
import { createComposedAnswerService } from './answer';
import { createComposedProvider, planSchemaForInput } from './provider';
import { questionFragment } from './question-contract';

const now = Date.parse('2026-09-12T12:00:00Z');
const read = (p: string) => readFileSync(new URL(`../../../../data/research/${p}`, import.meta.url));
const release = parsePassageRelease(JSON.parse(read('releases/scope2-website.v1.json').toString()), now);
const verified = { release, passages: release.passages, sha256: SOURCE_SHA };
const catalogBytes = read('answer-units/scope2-website.epa-acquisition.v1.json'), capabilityBytes = read('capabilities/scope2-website.epa-limitations.v1.json');
const catalog = parseUnitCatalog(catalogBytes, CAPABILITY_UNIT_SHA, verified, now).catalog;
const caps = parseCapabilities(capabilityBytes, CAPABILITY_SHA, catalog, CAPABILITY_UNIT_SHA, now);
const binding = { catalog_sha256: CAPABILITY_UNIT_SHA, capability_sha256: CAPABILITY_SHA, profile_sha256: 'a'.repeat(64) };
const question = 'Concerning that provision, explain the date boundary.';
const rawAnalysis = (): any => ({ operation: 'explain', parts: [
  { id: 'q1', start_token: 0, kind: 'ambiguous_reference', requirements: [], ambiguity_context_ids: ['referenced_requirement'] },
  { id: 'q2', start_token: 3, kind: 'request', requirements: [{ kind: 'limitation', subject: 'agreement_period_alignment' }], ambiguity_context_ids: [] },
] });
const demand = () => initialDemand(parseQuestionAnalysis(rawAnalysis(), question));
const proposal = (): any => ({ facets: [], question_contract: { parts: [
  { id: 'q1', resolution: 'context_required', facet_ids: [], context_ids: ['referenced_requirement'] },
  { id: 'q2', resolution: 'withheld', facet_ids: [], context_ids: [] },
] } });
const review = (d: DemandState = demand()): any => ({ decision: 'pass', decomposition_complete: true, relevant: true, scope_appropriate: true, context_appropriate: true, premise_handled: true, task_fit: true, proportionate: true, facets: [], issues: [],
  question_parts: demandInput(d, question).parts.map(p => ({ id: p.id, faithful: true, appropriately_resolved: true, requirements: p.requirements.map(r => ({ id: r.id, capability_ids: [], blocking_limit_ids: [] })), additional_requirements: [] })) });
const parse = (p = proposal(), d = demand()) => parseDemandSelection(p, question, catalog, d);
function harness(outputs: unknown[]) {
  const calls: { stage: string; input: any }[] = [];
  const cloudBinding = { scopeId: 'offline', buildId: 'offline', namespace: 'offline', releaseId: release.release_id, releaseVersion: release.version, releaseSha256: SOURCE_SHA, profileSha256: 'offline', sourceSha256: release.sources.map(s => s.sha256) };
  const service = createComposedAnswerService({ catalogBytes, catalogSha256: CAPABILITY_UNIT_SHA, capabilityBytes, capabilitySha256: CAPABILITY_SHA, now: () => now,
    repository: { loadForQuestion: async () => ({ verified, binding: cloudBinding, candidateIds: ['S01'] }), recheck: async () => {} },
    provider: { model: 'offline', remaining: () => 30 - calls.length, invoke: async (stage, input) => { calls.push({ stage, input }); return outputs.shift(); } } });
  return { service, calls };
}

test('referent-only zero needs remain material, exact and source blind', () => {
  const d = demand(), p = parse();
  expect(d.analysis.version).toBe('question-analysis.v4');
  expect(analysisInput(question).original_question).toBe(question);
  expect(plannerMaterialIds(demandInput(d, question), question)).toEqual(['q1', 'q2']);
  expect(p.question_contract.parts.map(p => questionFragment(question, p)).join('')).toBe(question);
  expect(p.question_contract.parts.map(p => p.resolution)).toEqual(['context_required', 'not_answered']);
  expect(p.question_contract.parts[0]!.context_ids).toEqual(['referenced_requirement']);
  const schema: any = planSchemaForInput({ original_question: question, question_analysis: demandInput(d, question) }, false);
  expect(schema.properties.question_contract.properties.parts.items.properties.id.enum).toEqual(['q1', 'q2']);
});

test('zero needs are not allowed for request or condition; ambiguity IDs and all-background rejection remain strict', () => {
  for (const mutate of [
    (a: any) => { a.parts[0].kind = 'request'; a.parts[0].ambiguity_context_ids = []; },
    (a: any) => { a.parts[0].kind = 'condition'; a.parts[0].ambiguity_context_ids = []; },
    (a: any) => { a.parts[0].ambiguity_context_ids = []; },
    (a: any) => { a.parts[0].ambiguity_context_ids = ['referenced_requirement', 'referenced_requirement']; },
    (a: any) => { a.parts[0].ambiguity_context_ids = ['location']; },
    (a: any) => { a.parts.forEach((p: any) => { p.kind = 'background'; p.requirements = []; p.ambiguity_context_ids = []; }); },
  ]) { const a = rawAnalysis(); mutate(a); expect(() => parseQuestionAnalysis(a, question)).toThrow('question_analysis_invalid'); }
});

test('identifiable needs on an ambiguous part remain present and must all be reviewed', () => {
  const a = rawAnalysis(); a.parts[0].requirements = [{ kind: 'conditional_rule', subject: 'reporting_methods' }];
  const d = initialDemand(parseQuestionAnalysis(a, question)), p = parse(proposal(), d);
  expect(d.analysis.parts[0]!.requirements).toHaveLength(1);
  expect(() => parseDemandReview(review(), p, [], catalog, caps, d)).toThrow('selection_review_invalid');
  expect(parseDemandReview(review(d), p, [], catalog, caps, d).review.decision).toBe('pass');
  a.parts[0].requirements = Array.from({ length: 4 }, () => ({ kind: 'conditional_rule', subject: 'reporting_methods' }));
  expect(() => parseQuestionAnalysis(a, question)).toThrow('question_analysis_invalid');
});

test('ambiguity cannot be cleared, relabeled, hidden or answered by empty proof', () => {
  for (const state of ['source_available', 'withheld', 'coverage_missing', 'action_out_of_scope', 'background']) {
    const p = proposal(); p.question_contract.parts[0].resolution = state; p.question_contract.parts[0].context_ids = [];
    const before = structuredClone(p); expect(() => parse(p)).toThrow('selection_invalid'); expect(p).toEqual(before);
  }
  for (const mutate of [
    (p: any) => { p.question_contract.parts[0].context_ids = ['referenced_subject']; },
    (p: any) => { p.question_contract.parts[0].facet_ids = ['f99']; },
    (p: any) => { p.question_contract.parts.reverse(); },
    (p: any) => { p.question_contract.parts.shift(); },
  ]) { const p = proposal(); mutate(p); expect(() => parse(p)).toThrow('selection_invalid'); }
});

test('empty-proof permission is canonical ambiguity/context only and never an affirmative exemption', () => {
  const p = parse(), r = review();
  expect(parseDemandReview(r, p, [], catalog, caps, demand()).review.decision).toBe('pass');
  r.question_parts[1].requirements = [];
  expect(() => parseDemandReview(r, p, [], catalog, caps, demand())).toThrow('selection_review_invalid');
  const options = { background: false, covered: false, appropriatelyResolved: true, ownUnitIds: [], capabilities: caps };
  expect(() => validateSupportRequirements([], options)).toThrow('selection_review_invalid');
  expect(() => validateSupportRequirements([], { ...options, ambiguityContext: true, covered: true })).toThrow('selection_review_invalid');
  const injected = review(); injected.question_parts[1].ambiguityContext = true;
  expect(() => parseDemandReview(injected, p, [], catalog, caps, demand())).toThrow('selection_review_invalid');
});

test('newly identified cumulative need on an empty part cannot disappear or be retyped', () => {
  const first = review(), p = parse();
  first.question_parts[0].additional_requirements = [{ kind: 'conditional_rule', subject: 'reporting_methods', capability_ids: [], blocking_limit_ids: [] }];
  const checked = parseDemandReview(first, p, [], catalog, caps, demand());
  expect(checked.demand.additions[0]!.requirements[0]!.id).toBe('q1-a1');
  expect(plannerMaterialIds(demandInput(checked.demand, question), question)).toEqual(['q1', 'q2']);
  expect(() => parseDemandReview(review(), p, [], catalog, caps, checked.demand)).toThrow('selection_review_invalid');
  const second = review(checked.demand);
  expect(parseDemandReview(second, p, [], catalog, caps, checked.demand).review.decision).toBe('pass');
  second.question_parts[0].requirements[0].id = 'q1-r1';
  expect(() => parseDemandReview(second, p, [], catalog, caps, checked.demand)).toThrow('selection_review_invalid');
  expect(createCatalogAbsenceCertificate(question, p, checked.demand, catalog, caps, binding, now)).toBeNull();
});

test('pure ambiguity-only can clarify only after ordinary full review, with no certificate', async () => {
  const q = 'That requirement?', a = { operation: 'explain', parts: [{ id: 'q1', start_token: 0, kind: 'ambiguous_reference', requirements: [], ambiguity_context_ids: ['referenced_requirement'] }] };
  const d = initialDemand(parseQuestionAnalysis(a, q)), p = proposal(); p.question_contract.parts.pop();
  const parsed = parseDemandSelection(p, q, catalog, d), r = review(); r.question_parts.pop();
  expect(createCatalogAbsenceCertificate(q, parsed, d, catalog, caps, binding, now)).toBeNull();
  const h = harness([a, p, r]), answer = await h.service.answer(q);
  expect(answer.status).toBe('needs_input'); expect(answer.claims).toEqual([]); expect(answer.composition).toBeNull();
  expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'verify']);
  expect(h.calls[2]!.input.review_mode).toBeUndefined(); expect(h.calls[2]!.input.unit_catalog).toHaveLength(24);
  expect(h.calls[2]!.input.selection.question_contract.parts).toHaveLength(1);
  expect(h.calls[2]!.input.question_analysis.parts[0].requirements).toEqual([]);
  for (const operation of ['calculate', 'submit_or_file']) {
    const operationDemand = initialDemand(parseQuestionAnalysis({ ...a, operation }, q));
    expect(() => parseDemandSelection(p, q, catalog, operationDemand)).toThrow('selection_invalid');
  }
});

test('separate known action or coverage cause retains precedence without retyping ambiguity', () => {
  const q = question + ' Calculate the amount.', a = rawAnalysis();
  a.parts.push({ id: 'q3', start_token: 7, kind: 'request', requirements: [{ kind: 'explanation', subject: 'electricity_units' }], ambiguity_context_ids: [] });
  for (const [operation, reason] of [['calculate', 'action_out_of_scope'], ['submit_or_file', 'action_out_of_scope'], ['explain', 'coverage_missing']] as const) {
    const d = initialDemand(parseQuestionAnalysis({ ...a, operation }, q)), p = proposal();
    p.question_contract.parts.push({ id: 'q3', resolution: reason, facet_ids: [], context_ids: [] });
    const parsed = parseDemandSelection(p, q, catalog, d);
    expect(parsed.reason).toBe(reason); expect(parsed.question_contract.parts[0]!.resolution).toBe('context_required');
    expect(createCatalogAbsenceCertificate(q, parsed, d, catalog, caps, binding, now)).toBeNull();
  }
});

test('false ambiguity or hidden identifiable effect remains terminal fresh analysis rejection', async () => {
  for (const explanation of ['The named requirement is already resolved in the full question.', 'The empty reference part conceals an identifiable conditional effect.']) {
    const negative = review(); negative.decision = 'revise'; negative.question_parts[0].faithful = false;
    negative.issues = [{ code: 'question_part', target_id: 'q1', explanation }];
    const h = harness([rawAnalysis(), proposal(), negative, proposal(), review()]), answer = await h.service.answer(question);
    expect(answer.reason_code).toBe('question_analysis_not_verified'); expect(answer.claims).toEqual([]); expect(h.calls).toHaveLength(3);
  }
});

test('fresh negative selection review remains negative after the sole correction', async () => {
  const negative = review(); negative.decision = 'revise'; negative.question_parts[1].appropriately_resolved = false;
  negative.issues = [{ code: 'question_part', target_id: 'q2', explanation: 'The boundary hides a separate established source gap.' }];
  const h = harness([rawAnalysis(), proposal(), negative, proposal(), structuredClone(negative), review()]);
  const answer = await h.service.answer(question);
  expect(answer.reason_code).toBe('selection_not_verified'); expect(answer.claims).toEqual([]);
  expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'verify', 'plan', 'verify']);
});

test('an initially empty part gaining a need must carry it through replacement and final review', async () => {
  const first = review(); first.decision = 'revise'; first.question_parts[0].appropriately_resolved = false;
  first.question_parts[0].additional_requirements = [{ kind: 'limitation', subject: 'agreement_period_alignment', capability_ids: [], blocking_limit_ids: [] }];
  first.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'A separately identifiable boundary need must remain represented.' }];
  for (const omit of [false, true]) {
    const last = review(); if (!omit) last.question_parts[0].requirements.push({ id: 'q1-a1', capability_ids: [], blocking_limit_ids: [] });
    const h = harness([rawAnalysis(), proposal(), structuredClone(first), proposal(), last]), answer = await h.service.answer(question);
    expect(h.calls).toHaveLength(5);
    expect(h.calls[3]!.input.question_analysis.parts[0].requirements[0].id).toBe('q1-a1');
    expect(answer.status).toBe(omit ? 'needs_review' : 'needs_input');
    expect(answer.reason_code).toBe(omit ? 'selection_review_invalid' : 'context_required');
    expect(answer.claims).toEqual([]);
  }
});

test('serialized ambiguity certificate is rejected while pure substantive absence still certifies', () => {
  const q = 'Explain this unrepresented conditional effect.', a = { operation: 'explain', parts: [{ id: 'q1', start_token: 0, kind: 'request', requirements: [{ kind: 'conditional_rule', subject: 'unrepresented_subject' }], ambiguity_context_ids: [] }] };
  const d = initialDemand(parseQuestionAnalysis(a, q)), p = parseDemandSelection({ facets: [], question_contract: { parts: [{ id: 'q1', resolution: 'coverage_missing', facet_ids: [], context_ids: [] }] } }, q, catalog, d);
  const certificate = createCatalogAbsenceCertificate(q, p, d, catalog, caps, binding, now)!;
  expect(certificate).not.toBeNull();
  const bad: any = structuredClone(certificate); bad.parts[0].kind = 'ambiguous_reference'; bad.parts[0].requirements = [];
  const { certificate_sha256: _old, ...body } = bad; bad.certificate_sha256 = hash(JSON.stringify(body));
  expect(() => assertCatalogAbsenceCertificate(bad, q, p, d, catalog, caps, binding, now)).toThrow('selection_review_invalid');
});

test('tampered initial fragments or old analysis seal fail before request reservation', async () => {
  let reservations = 0, network = 0;
  const provider = createComposedProvider({ apiKey: 'synthetic', budget: { maxCalls: 5, remaining: () => 5, reserve: () => ++reservations }, fetch: async () => { network++; throw Error('unexpected I/O'); } });
  for (const mutate of [
    (x: any) => { x.question_analysis.version = 'question-analysis.v3'; },
    (x: any) => { x.question_analysis.parts[0].question_fragment += ' extra'; },
    (x: any) => { x.question_analysis.initial_seal_sha256 = '0'.repeat(64); },
  ]) {
    const input = { original_question: question, question_analysis: demandInput(demand(), question) }; mutate(input);
    await expect(provider.invoke('plan', input, new AbortController().signal)).rejects.toThrow('question_analysis_invalid');
  }
  expect(reservations).toBe(0); expect(network).toBe(0); expect(analysisVersion).toBe('question-analysis.v4');
});
