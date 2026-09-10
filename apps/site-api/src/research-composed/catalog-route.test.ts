import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { hash, parsePassageRelease } from '../research-passages/release';
import { parseUnitCatalog, SOURCE_SHA } from './catalog';
import { createCatalogAbsenceCertificate } from './catalog-absence';
import { parseQuestionAnalysis } from './question-analysis';
import { initialDemand, parseDemandSelection } from './demand-selection';
import { PRIOR_ROUTE_CAPABILITY_SHA as CAPABILITY_SHA, CAPABILITY_UNIT_SHA, PRIOR_ACQUISITION_CAPABILITY_SHA, parseCapabilities, capabilityMatchesRequirement, validateSupportRequirements } from './capabilities';
const now = Date.parse('2026-09-12T12:00:00Z');
const read = (name: string) => readFileSync(new URL(`../../../../data/research/${name}`, import.meta.url));
const release = parsePassageRelease(JSON.parse(read('releases/scope2-website.v1.json').toString()), now);
const unitBytes = read('answer-units/scope2-website.epa-acquisition.v1.json');
const units = parseUnitCatalog(unitBytes, CAPABILITY_UNIT_SHA, { release, passages: release.passages, sha256: SOURCE_SHA }, now).catalog;
const oldBytes = read('capabilities/scope2-website.epa-acquisition.v1.json');
const newBytes = read('capabilities/scope2-website.epa-route.v1.json');
const old = parseCapabilities(oldBytes, PRIOR_ACQUISITION_CAPABILITY_SHA, units, CAPABILITY_UNIT_SHA, now);
const current = parseCapabilities(newBytes, CAPABILITY_SHA, units, CAPABILITY_UNIT_SHA, now);

test('the new sidecar adds only one role and retains all old capability and limit objects', () => {
  expect(hash(unitBytes)).toBe(CAPABILITY_UNIT_SHA);
  expect(hash(newBytes)).toBe(CAPABILITY_SHA);
  expect(current.version).toBe('3-epa-route');
  expect(old.version).toBe('2-epa-acquisition');
  expect(current.units).toHaveLength(24);
  const before = old.units.find(unit => unit.unit_id === 'U13')!;
  const after = current.units.find(unit => unit.unit_id === 'U13')!;
  expect(after.capabilities.slice(0, before.capabilities.length)).toEqual(before.capabilities);
  expect(after.limits).toEqual(before.limits);
  expect(current.units.filter(unit => unit.unit_id !== 'U13')).toEqual(old.units.filter(unit => unit.unit_id !== 'U13'));
  expect(current.units.flatMap(unit => unit.capabilities)).toHaveLength(34);
  expect(current.units.flatMap(unit => unit.limits)).toHaveLength(27);
  for (const key of ['unit_catalog_sha256', 'source_release_sha256', 'condition_catalog_sha256', 'kinds', 'subjects', 'absence_policy'] as const) expect(current[key]).toEqual(old[key]);
  expect(current.review.expires_at).toBe(old.review.expires_at);
});

test('the added route annotation is exact supplier acquisition support, not supplier eligibility', () => {
  const unit = units.units.find(unit => unit.id === 'U13')!;
  const entry = current.units.find(unit => unit.unit_id === 'U13')!;
  const added = entry.capabilities[2]!;
  expect(added).toEqual({ id: 'U13-C03', kind: 'source_route', subject: 'supplier_factor_inquiry', anchor: [0, 170] });
  expect(unit.text.slice(...added.anchor)).toBe(unit.text.split('. ')[0] + '.');
  const request = { kind: 'source_route' as const, subject: 'supplier_factor_inquiry' as const };
  expect(capabilityMatchesRequirement(request, added)).toBe(true);
  expect(capabilityMatchesRequirement(request, entry.capabilities[1]!)).toBe(false);
  expect(capabilityMatchesRequirement({ kind: 'conditional_rule', subject: 'supplier_factor_inquiry' }, added)).toBe(false);
  expect(() => validateSupportRequirements([{ ...request, capability_ids: [added.id], blocking_limit_ids: [] }], { background: false, covered: true, appropriatelyResolved: true, ownUnitIds: ['U07', 'U13', 'U16'], capabilities: current })).not.toThrow();
});

test('old and new exact version/hash pairs stay loadable and cannot be crossed', () => {
  expect(() => parseCapabilities(oldBytes, PRIOR_ACQUISITION_CAPABILITY_SHA, units, CAPABILITY_UNIT_SHA, now)).not.toThrow();
  expect(() => parseCapabilities(newBytes, CAPABILITY_SHA, units, CAPABILITY_UNIT_SHA, now)).not.toThrow();
  expect(() => parseCapabilities(oldBytes, CAPABILITY_SHA, units, CAPABILITY_UNIT_SHA, now)).toThrow('unit_catalog_invalid');
  expect(() => parseCapabilities(newBytes, PRIOR_ACQUISITION_CAPABILITY_SHA, units, CAPABILITY_UNIT_SHA, now)).toThrow('unit_catalog_invalid');
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
