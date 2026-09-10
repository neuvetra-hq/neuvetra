import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { hash, parsePassageRelease } from '../research-passages/release';
import { parseUnitCatalog, SOURCE_SHA } from './catalog';
import { createCatalogAbsenceCertificate } from './catalog-absence';
import { parseQuestionAnalysis } from './question-analysis';
import { initialDemand, parseDemandSelection } from './demand-selection';
import { CAPABILITY_SHA, CAPABILITY_UNIT_SHA, PRIOR_ROUTE_CAPABILITY_SHA, parseCapabilities, capabilityMatchesRequirement, validateSupportRequirements } from './capabilities';
const now = Date.parse('2026-09-12T12:00:00Z');
const read = (name: string) => readFileSync(new URL(`../../../../data/research/${name}`, import.meta.url));
const release = parsePassageRelease(JSON.parse(read('releases/scope2-website.v1.json').toString()), now);
const unitBytes = read('answer-units/scope2-website.epa-acquisition.v1.json');
const units = parseUnitCatalog(unitBytes, CAPABILITY_UNIT_SHA, { release, passages: release.passages, sha256: SOURCE_SHA }, now).catalog;
const oldBytes = read('capabilities/scope2-website.epa-route.v1.json');
const newBytes = read('capabilities/scope2-website.epa-limitations.v1.json');
const old = parseCapabilities(oldBytes, PRIOR_ROUTE_CAPABILITY_SHA, units, CAPABILITY_UNIT_SHA, now);
const current = parseCapabilities(newBytes, CAPABILITY_SHA, units, CAPABILITY_UNIT_SHA, now);

test('all 21 bounded limitation roles preserve all old caps, limits and unit wording', () => {
 expect(current.version).toBe('4-epa-limitations'); expect(old.version).toBe('3-epa-route');
 expect(hash(unitBytes)).toBe(CAPABILITY_UNIT_SHA); expect(current.units).toHaveLength(24);
 for(const before of old.units) { const after=current.units.find(u=>u.unit_id===before.unit_id)!; expect(after.capabilities.slice(0,before.capabilities.length)).toEqual(before.capabilities); expect(after.limits).toEqual(before.limits); }
 expect(current.units.flatMap(u=>u.capabilities)).toHaveLength(55); expect(current.units.flatMap(u=>u.limits)).toHaveLength(27);
 expect(current.units.find(u=>u.unit_id==='U24')!.capabilities).toHaveLength(10);
 expect(current.review.expires_at).toBe(old.review.expires_at);
});
test('new limitations support exact caveat subjects without becoming conditional permission', () => {
 for(const [id,subject] of [['U13-C04','supplier_delivered_boundary'],['U14-C02','certificate_quality_prerequisite'],['U16-C02','agreement_period_alignment']] as const) {
  const cap=current.units.flatMap(u=>u.capabilities).find(c=>c.id===id)!;
  expect(capabilityMatchesRequirement({kind:'limitation',subject},cap)).toBe(true);
  expect(capabilityMatchesRequirement({kind:'conditional_rule',subject},cap)).toBe(false);
  const owner=id.slice(0,3); expect(()=>validateSupportRequirements([{kind:'limitation',subject,capability_ids:[id],blocking_limit_ids:[]}],{background:false,covered:true,appropriatelyResolved:true,ownUnitIds:[owner],capabilities:current})).not.toThrow();
 }
});
test('old and new exact version/hash pairs stay loadable and cannot be crossed', () => {
  expect(() => parseCapabilities(oldBytes, PRIOR_ROUTE_CAPABILITY_SHA, units, CAPABILITY_UNIT_SHA, now)).not.toThrow();
  expect(() => parseCapabilities(newBytes, CAPABILITY_SHA, units, CAPABILITY_UNIT_SHA, now)).not.toThrow();
  expect(() => parseCapabilities(oldBytes, CAPABILITY_SHA, units, CAPABILITY_UNIT_SHA, now)).toThrow('unit_catalog_invalid');
  expect(() => parseCapabilities(newBytes, PRIOR_ROUTE_CAPABILITY_SHA, units, CAPABILITY_UNIT_SHA, now)).toThrow('unit_catalog_invalid');
});


test('the new exact capability pair supports ordinary plans and only eligible non-route absence', () => {
  const question = 'Explain the unfamiliar violet subject.';
  const binding = { catalog_sha256: CAPABILITY_UNIT_SHA, capability_sha256: CAPABILITY_SHA, profile_sha256: 'f'.repeat(64) };
  for (const kind of ['conditional_rule', 'source_route'] as const) {
    const demand = initialDemand(parseQuestionAnalysis({ operation: 'explain', parts: [{ id: 'q1', start_token: 0, kind: 'request', requirements: [{ kind, subject: 'unrepresented_subject' }], ambiguity_context_ids: [] }] }, question));
    const plan = parseDemandSelection({ facets: [], question_contract: { parts: [{ id: 'q1', resolution: 'coverage_missing', facet_ids: [], context_ids: [] }] } }, question, units, demand);
    const certificate = createCatalogAbsenceCertificate(question, plan, demand, units, current, binding, now);
    if (kind === 'conditional_rule') expect(certificate).not.toBeNull();
    else expect(certificate).toBeNull();
  }
  const demand = initialDemand(parseQuestionAnalysis({ operation: 'explain', parts: [{ id: 'q1', start_token: 0, kind: 'request', requirements: [{ kind: 'definition', subject: 'accounting_methods' }], ambiguity_context_ids: [] }] }, question));
  const answer = parseDemandSelection({ facets: [{ id: 'f1', unit_ids: ['U01'] }], question_contract: { parts: [{ id: 'q1', resolution: 'source_available', facet_ids: ['f1'], context_ids: [] }] } }, question, units, demand);
  expect(createCatalogAbsenceCertificate(question, answer, demand, units, current, binding, now)).toBeNull();
});
