import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { hash, parsePassageRelease } from '../research-passages/release';
import { parseUnitCatalog, SOURCE_SHA } from './catalog';
import { CAPABILITY_SHA, CAPABILITY_UNIT_SHA, parseCapabilities } from './capabilities';
import { parseQuestionAnalysis } from './question-analysis';
import { demandInput, initialDemand, parseDemandSelection, parseDemandReview, plannerMaterialIds } from './demand-selection';
import { composedRequestBody, composedSchemas, createComposedProvider, planSchemaForInput } from './provider';
import { questionFragment } from './question-contract';

const now = Date.parse('2026-09-12T12:00:00Z');
const read = (p: string) => readFileSync(new URL(`../../../../data/research/${p}`, import.meta.url));
const release = parsePassageRelease(JSON.parse(read('releases/scope2-website.v1.json').toString()), now);
const catalog = parseUnitCatalog(read('answer-units/scope2-website.epa-acquisition.v1.json'), CAPABILITY_UNIT_SHA, { release, passages: release.passages, sha256: SOURCE_SHA }, now).catalog;
const caps = parseCapabilities(read('capabilities/scope2-website.epa-limitations.v1.json'), CAPABILITY_SHA, catalog, CAPABILITY_UNIT_SHA, now);
const question = 'For context. Explain the distinction. Additional context. Explain the recommendation.';
const rawAnalysis = () => ({ operation: 'explain', parts: [
  { id: 'q1', start_token: 0, kind: 'background', requirements: [], ambiguity_context_ids: [] },
  { id: 'q2', start_token: 2, kind: 'request', requirements: [{ kind: 'definition', subject: 'accounting_methods' }], ambiguity_context_ids: [] },
  { id: 'q3', start_token: 5, kind: 'background', requirements: [], ambiguity_context_ids: [] },
  { id: 'q4', start_token: 7, kind: 'request', requirements: [{ kind: 'general_recommendation', subject: 'reporting_methods' }], ambiguity_context_ids: [] },
] });
const demand = () => initialDemand(parseQuestionAnalysis(rawAnalysis(), question));
const input = () => ({ original_question: question, question_analysis: demandInput(demand(), question) });
const proposal = (): any => ({ facets: [{ id: 'f1', unit_ids: ['U01'] }, { id: 'f2', unit_ids: ['U02'] }], question_contract: { parts: [
  { id: 'q2', resolution: 'source_available', facet_ids: ['f1'], context_ids: [] },
  { id: 'q4', resolution: 'source_available', facet_ids: ['f2'], context_ids: [] },
] } });
const parse = (p = proposal()) => parseDemandSelection(p, question, catalog, demand());
const schemaIds = (s: any) => s.properties.question_contract.properties.parts.items.properties.id.enum;

test('only material rows are accepted; full exact background and material fragments are derived', () => {
  const p = proposal(), before = structuredClone(p), result = parse(p);
  expect(p).toEqual(before);
  expect(result.question_contract.parts.map(p => [p.id, p.kind, p.resolution])).toEqual([
    ['q1', 'background', 'background'], ['q2', 'request', 'covered'], ['q3', 'background', 'background'], ['q4', 'request', 'covered'],
  ]);
  expect(result.question_contract.parts.map(p => questionFragment(question, p)).join('')).toBe(question);
  expect(plannerMaterialIds(input().question_analysis, question)).toEqual(['q2', 'q4']);
});

test('legacy, missing, duplicated, reordered, foreign and unknown-reference rows are rejected intact', () => {
  const changes: ((p: any) => void)[] = [
    p => p.question_contract.parts.unshift({ id: 'q1', resolution: 'background', facet_ids: [], context_ids: [] }),
    p => { p.question_contract.parts[0].resolution = 'background'; },
    p => p.question_contract.parts.pop(),
    p => { p.question_contract.parts[1] = structuredClone(p.question_contract.parts[0]); },
    p => p.question_contract.parts.reverse(),
    p => { p.question_contract.parts[0].id = 'q9'; },
    p => { p.question_contract.parts[0].facet_ids = ['f99']; },
    p => { p.question_contract.parts[0].context_ids = ['secret']; },
  ];
  for (const change of changes) { const p = proposal(); change(p); const before = structuredClone(p); expect(() => parse(p)).toThrow('selection_invalid'); expect(p).toEqual(before); }
});

test('a sealed material condition cannot become background or disappear', () => {
  const a = rawAnalysis(); a.parts[0]!.kind = 'condition'; a.parts[0]!.requirements = [{ kind: 'conditional_rule', subject: 'agreement_period_alignment' }];
  const d = initialDemand(parseQuestionAnalysis(a, question));
  expect(() => parseDemandSelection(proposal(), question, catalog, d)).toThrow('selection_invalid');
  const p = proposal(); p.question_contract.parts.unshift({ id: 'q1', resolution: 'background', facet_ids: [], context_ids: [] });
  expect(() => parseDemandSelection(p, question, catalog, d)).toThrow('selection_invalid');
});

test('normal and alternative schemas have only exact material IDs and fresh independent nested objects', () => {
  const originalBase = structuredClone(composedSchemas), first: any = planSchemaForInput(input(), false);
  expect(schemaIds(first)).toEqual(['q2', 'q4']);
  expect(first.properties.question_contract.properties.parts.items.properties.resolution.enum).not.toContain('background');
  const size: any = planSchemaForInput(input(), true);
  expect(schemaIds(size.properties.alternative_selection.items)).toEqual(['q2', 'q4']);
  first.properties.question_contract.properties.parts.items.properties.id.enum.push('q99');
  first.properties.question_contract.properties.parts.items.properties.resolution.enum.push('background');
  first.properties.question_contract.properties.parts.items.properties.facet_ids.items.type = 'number';
  expect(schemaIds(planSchemaForInput(input(), false))).toEqual(['q2', 'q4']);
  expect(composedSchemas).toEqual(originalBase);
  const a = rawAnalysis(); a.parts[0]!.kind = 'request'; a.parts[0]!.requirements = [{ kind: 'definition', subject: 'accounting_methods' }];
  a.parts[1]!.kind = 'background'; a.parts[1]!.requirements = [];
  const other = { original_question: question, question_analysis: demandInput(initialDemand(parseQuestionAnalysis(a, question)), question) };
  expect(schemaIds(planSchemaForInput(other, false))).toEqual(['q1', 'q4']);
  expect(schemaIds(planSchemaForInput(input(), false))).toEqual(['q2', 'q4']);
});

test('tampered initial meaning, fragments, ranges, seals and all-background input fail before reservation', async () => {
  const mutations: ((v: any) => void)[] = [
    v => { v.question_analysis.parts[0].kind = 'condition'; },
    v => { v.question_analysis.parts[1].question_fragment += ' hidden'; },
    v => { v.question_analysis.parts[1].end_token--; },
    v => { v.question_analysis.initial_seal_sha256 = '0'.repeat(64); },
    v => { v.question_analysis.parts[1].requirements[0].subject = 'supplier_factor_inquiry'; },
    v => { v.question_analysis.parts.forEach((p: any) => { p.kind = 'background'; p.requirements = []; }); },
  ];
  let reservations = 0, fetches = 0;
  const provider = createComposedProvider({ apiKey: 'synthetic', budget: { maxCalls: 5, remaining: () => 5, reserve: () => ++reservations }, fetch: async () => { fetches++; throw Error('must not call'); } });
  for (const mutate of mutations) { const v = structuredClone(input()); mutate(v); await expect(provider.invoke('plan', v, new AbortController().signal)).rejects.toThrow('question_analysis_invalid'); }
  expect(reservations).toBe(0); expect(fetches).toBe(0);
});

test('legitimate cumulative addition insertion order is not inferred from part order', () => {
  const d = demand();
  const additions = [
    { part_id: 'q4', requirements: [{ id: 'q4-a1', kind: 'limitation' as const, subject: 'reporting_methods' as const }] },
    { part_id: 'q2', requirements: [{ id: 'q2-a1', kind: 'explanation' as const, subject: 'accounting_methods' as const }] },
  ];
  const next = { analysis: d.analysis, additions, seal_sha256: hash(JSON.stringify({ initial_seal_sha256: d.analysis.seal_sha256, additions })) };
  expect(plannerMaterialIds(demandInput(next, question), question)).toEqual(['q2', 'q4']);
  const bad: any = structuredClone(demandInput(next, question)); bad.parts[1]!.requirements[1]!.id = 'q4-a1';
  expect(() => plannerMaterialIds(bad, question)).toThrow('question_analysis_invalid');
});

test('a derived background can still fail independent fidelity; server derivation is not approval', () => {
  const p = parse();
  const review: any = { decision: 'revise', decomposition_complete: true, relevant: true, scope_appropriate: true, context_appropriate: true, premise_handled: true, task_fit: true, proportionate: true,
    facets: [{ id: 'f1', covered: true, unit_ids: ['U01'] }, { id: 'f2', covered: true, unit_ids: ['U02'] }],
    question_parts: [
      { id: 'q1', faithful: false, appropriately_resolved: true, requirements: [], additional_requirements: [] },
      { id: 'q2', faithful: true, appropriately_resolved: true, requirements: [{ id: 'q2-r1', capability_ids: ['U01-C01'], blocking_limit_ids: [] }], additional_requirements: [] },
      { id: 'q3', faithful: true, appropriately_resolved: true, requirements: [], additional_requirements: [] },
      { id: 'q4', faithful: true, appropriately_resolved: true, requirements: [{ id: 'q4-r1', capability_ids: ['U02-C01'], blocking_limit_ids: [] }], additional_requirements: [] },
    ], issues: [{ code: 'question_part', target_id: 'q1', explanation: 'The sealed background hides a material condition.' }] };
  expect(() => parseDemandReview(review, p, catalog.units.filter(u => ['U01', 'U02'].includes(u.id)), catalog, caps, demand())).toThrow('question_analysis_not_verified');
  const body = JSON.parse(composedRequestBody('plan', input()));
  expect(schemaIds(body.output_config.format.schema)).toEqual(['q2', 'q4']);
});

test('five cumulative additions and independent size schema trees remain valid',()=>{
 const d=demand();const additions=[{part_id:'q2',requirements:[
 {id:'q2-a1',kind:'explanation' as const,subject:'accounting_methods' as const},
 {id:'q2-a2',kind:'limitation' as const,subject:'generation_boundary' as const},
 {id:'q2-a3',kind:'source_route' as const,subject:'grid_factor_source' as const},
 {id:'q2-a4',kind:'conditional_rule' as const,subject:'agreement_period_alignment' as const},
 {id:'q2-a5',kind:'inquiry_step' as const,subject:'supplier_factor_inquiry' as const},
 ]}];
 const next={analysis:d.analysis,additions,seal_sha256:hash(JSON.stringify({initial_seal_sha256:d.analysis.seal_sha256,additions}))};
 expect(plannerMaterialIds(demandInput(next,question),question)).toEqual(['q2','q4']);
 const a:any=planSchemaForInput(input(),true),base=structuredClone(composedSchemas);a.properties.alternative_selection.items.properties.question_contract.properties.parts.items.properties.resolution.enum.push('background');
 a.properties.alternative_selection.items.properties.facets.items.properties.unit_ids.items.type='number';
 expect(composedSchemas).toEqual(base);const fresh:any=planSchemaForInput(input(),true);expect(fresh.properties.alternative_selection.items.properties.question_contract.properties.parts.items.properties.resolution.enum).not.toContain('background');
 expect(fresh.properties.alternative_selection.items.properties.facets.items.properties.unit_ids.items.type).toBe('string');
});
