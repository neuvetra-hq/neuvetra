'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const PlanCore = require('./plan-core.js');

const catalogPath = path.join(__dirname, 'data', 'collection-catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

function onboarding(overrides = {}) {
  return {
    company: { legal: 'Example Co', country: 'United States', industry: 'Bakery', ...(overrides.company || {}) },
    period: { start: '2025-01-01', end: '2025-12-31', first: 'Yes', ...(overrides.period || {}) },
    boundary: { approach: 'Operational control' },
    entities: [],
    locations: [{ id: 'loc-1', name: 'Main site', included: 'Include' }, { id: 'loc-2', name: 'Warehouse', included: 'Include' }],
    changes: Array.from({ length: 5 }, () => ({ answer: 'No' })),
    sources: Array.from({ length: 5 }, () => ({ answer: 'No' })),
    review: {},
    ...overrides,
    company: { legal: 'Example Co', country: 'United States', industry: 'Bakery', ...(overrides.company || {}) },
    period: { start: '2025-01-01', end: '2025-12-31', first: 'Yes', ...(overrides.period || {}) }
  };
}

test('exports the same pure API for CommonJS', () => {
  assert.equal(PlanCore.SCHEMA_VERSION, 1);
  assert.deepEqual(PlanCore.SOURCE_FAMILY_IDS, ['stationary', 'generator', 'mobile', 'fugitive', 'process']);
  for (const name of ['createPlan', 'onboardingFingerprint', 'reconcilePlan', 'derive', 'validateRecord', 'escapeHtml']) assert.equal(typeof PlanCore[name], 'function');
});

test('publishes PlanCore as a browser global when CommonJS is absent', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'plan-core.js'), 'utf8'), context);
  assert.equal(typeof context.PlanCore.derive, 'function');
  assert.equal(typeof context.PlanCore.reconcilePlan, 'function');
});

test('accepts the delivered collection catalog contract', () => {
  assert.equal(catalog.version, '2026-09-25.1');
  assert.deepEqual(catalog.families.map((entry) => entry.id), PlanCore.SOURCE_FAMILY_IDS);
  assert.equal(catalog.scope2.length, 4);
  assert.equal(catalog.scope3.length, 15);
  const input = onboarding();
  const result = PlanCore.derive(input, PlanCore.createPlan(input, catalog), catalog);
  assert.equal(result.catalogVersion, catalog.version);
  assert.equal(result.screening.length, 19);
});

test('plumbing company derives only answered and open fixed families without industry inference', () => {
  const input = onboarding({
    company: { industry: 'Plumbing contractor' },
    sources: [
      { answer: 'Yes', names: 'Water heater', location: 'loc-1', notes: 'Natural gas' },
      { answer: 'No' },
      { answer: 'Not sure', names: 'Service vans', location: 'Not sure', notes: 'Check leases' },
      { answer: 'No' },
      { answer: '' }
    ]
  });
  const result = PlanCore.derive(input, PlanCore.createPlan(input, catalog), catalog);
  assert.deepEqual(result.items.filter((item) => item.scope === '1').map((item) => item.id), ['scope1:stationary', 'scope1:mobile', 'scope1:process']);
  assert.equal(result.items[0].source.names, 'Water heater');
  assert.deepEqual(result.items[0].locationIds, ['loc-1']);
  assert.equal(result.items.find((item) => item.id === 'scope1:mobile').kind, 'clarification');
  assert.equal(result.exclusions.some((item) => item.id === 'scope1:generator'), true);
});

test('welding and bakery labels do not create stereotyped source answers', () => {
  for (const industry of ['Welding', 'Bakery']) {
    const input = onboarding({ company: { industry }, sources: Array.from({ length: 5 }, () => ({ answer: 'No' })) });
    const result = PlanCore.derive(input, PlanCore.createPlan(input, catalog), catalog);
    assert.equal(result.items.some((item) => item.scope === '1'), false);
    assert.equal(result.exclusions.filter((item) => item.scope === '1').length, 5);
  }
});

test('unknown source answers and all Scope 2 and 3 screenings stay visible without creating inventory items', () => {
  const input = onboarding({ sources: Array.from({ length: 5 }, () => ({})) });
  const result = PlanCore.derive(input, PlanCore.createPlan(input, catalog), catalog);
  assert.equal(result.items.filter((item) => item.scope === '1').length, 5);
  assert.equal(result.items.filter((item) => item.kind === 'clarification').length, 5);
  assert.equal(result.screening.length, 19);
  assert.equal(result.screening.every((entry) => entry.answer === ''), true);
});

test('Scope 2 and 3 Yes and Not sure answers create inventory and clarification items', () => {
  const input = onboarding();
  const plan = PlanCore.createPlan(input, catalog);
  plan.screening.electricity.answer = 'Yes';
  plan.screening.electricity.locationIds = ['loc-1'];
  plan.screening['category-1'].answer = 'Not sure';
  const result = PlanCore.derive(input, plan, catalog);
  assert.equal(result.items.find((item) => item.id === 'scope2:electricity').kind, 'inventory');
  assert.equal(result.items.find((item) => item.id === 'scope3:category-1').kind, 'clarification');
  assert.equal(result.items.some((item) => item.id === 'scope2:steam'), false);
});

test('all No answers remain explicit and a Scope 2 or 3 No requires rationale', () => {
  const input = onboarding({ sources: Array.from({ length: 5 }, () => ({ answer: 'No' })) });
  const plan = PlanCore.createPlan(input, catalog);
  for (const key of Object.keys(plan.screening)) plan.screening[key].answer = 'No';
  const result = PlanCore.derive(input, plan, catalog);
  assert.equal(result.items.length, 0);
  assert.equal(result.exclusions.length, 24);
  assert.equal(result.issues.filter((issue) => issue.includes('has no rationale')).length, 24);
  assert.equal(result.issues.some((issue) => issue.includes('Fuel burned in fixed equipment') && issue.includes('rationale')), true);
});

test('No rationale can be supplied without changing the authoritative onboarding answer', () => {
  const input = onboarding({ sources: [{ answer: 'No' }, ...Array.from({ length: 4 }, () => ({ answer: 'No' }))] });
  const plan = PlanCore.createPlan(input, catalog);
  plan.screening['scope1:stationary'].reason = 'No fuel-burning equipment after site register review.';
  const result = PlanCore.derive(input, plan, catalog);
  const exclusion = result.exclusions.find((entry) => entry.id === 'scope1:stationary');
  assert.equal(exclusion.reason, 'No fuel-burning equipment after site register review.');
  assert.equal(result.issues.some((issue) => issue.includes('Fuel burned in fixed equipment') && issue.includes('no rationale')), false);
});

test('reconciliation preserves work, invalidates completion and clears obsolete checks', () => {
  const first = onboarding({ sources: [{ answer: 'Yes', names: 'Boiler A', location: 'loc-1' }, ...Array.from({ length: 4 }, () => ({ answer: 'No' }))] });
  let plan = PlanCore.createPlan(first, catalog);
  plan.items['scope1:stationary'] = {
    ...plan.items['scope1:stationary'],
    status: 'complete',
    needsReview: false,
    subtypeId: 'boiler',
    checks: { 'stationary-1': true, 'boiler-1': true, obsolete: true },
    notes: 'Keep this note',
    records: [{ id: 'r1', quantity: '0' }]
  };
  plan = PlanCore.reconcilePlan(first, plan, catalog);
  assert.equal(plan.items['scope1:stationary'].needsReview, true);
  assert.deepEqual(plan.items['scope1:stationary'].checks, { 'stationary-1': true, 'boiler-1': true });
  plan.items['scope1:stationary'].needsReview = false;
  plan.items['scope1:stationary'].status = 'complete';

  const changed = onboarding({ sources: [{ answer: 'Yes', names: 'Boiler B', location: 'loc-1' }, ...Array.from({ length: 4 }, () => ({ answer: 'No' }))] });
  const reconciled = PlanCore.reconcilePlan(changed, plan, catalog);
  assert.equal(reconciled.items['scope1:stationary'].status, 'in-progress');
  assert.equal(reconciled.items['scope1:stationary'].needsReview, true);
  assert.equal(reconciled.items['scope1:stationary'].notes, 'Keep this note');
  assert.deepEqual(reconciled.items['scope1:stationary'].records, [{ id: 'r1', quantity: '0' }]);
});

test('removed locations remain orphaned and multiple-location notes are never guessed', () => {
  const initial = onboarding({ sources: [{ answer: 'Yes', names: 'Ovens', location: 'loc-1' }, ...Array.from({ length: 4 }, () => ({ answer: 'No' }))] });
  let plan = PlanCore.createPlan(initial, catalog);
  const removed = { ...initial, locations: initial.locations.filter((location) => location.id !== 'loc-1') };
  let result = PlanCore.derive(removed, plan, catalog);
  const stationary = result.items.find((item) => item.id === 'scope1:stationary');
  assert.deepEqual(stationary.locationIds, ['loc-1']);
  assert.deepEqual(stationary.orphanLocationIds, ['loc-1']);
  assert.equal(stationary.unassigned, true);
  assert.equal(stationary.needsReview, true);

  const multiple = onboarding({ sources: [{ answer: 'Yes', names: 'Ovens', location: 'Multiple locations — describe below', notes: 'Main site and Warehouse' }, ...Array.from({ length: 4 }, () => ({ answer: 'No' }))] });
  plan = PlanCore.createPlan(multiple, catalog);
  result = PlanCore.derive(multiple, plan, catalog);
  assert.deepEqual(result.items.find((item) => item.id === 'scope1:stationary').locationIds, []);
});

test('an explicit empty location selection stays empty instead of restoring onboarding defaults', () => {
  const input = onboarding({ sources: [{ answer: 'Yes', names: 'Ovens', location: 'loc-1' }, ...Array.from({ length: 4 }, () => ({ answer: 'No' }))] });
  const plan = PlanCore.createPlan(input, catalog);
  plan.items['scope1:stationary'].locationIds = [];
  const reconciled = PlanCore.reconcilePlan(input, plan, catalog);
  assert.deepEqual(reconciled.items['scope1:stationary'].locationIds, []);
  const item = PlanCore.derive(input, reconciled, catalog).items.find((entry) => entry.id === 'scope1:stationary');
  assert.deepEqual(item.locationIds, []);
  assert.equal(item.unassigned, true);
});

test('explicit company-wide location coverage is complete without fabricating a site link', () => {
  const input = onboarding();
  const plan = PlanCore.createPlan(input, catalog);
  plan.screening.electricity.answer = 'Yes';
  plan.screening.electricity.locationIds = ['loc-1'];
  let reconciled = PlanCore.reconcilePlan(input, plan, catalog);
  reconciled.items['scope2:electricity'].locationMode = 'company-wide';
  const result = PlanCore.derive(input, reconciled, catalog);
  const item = result.items.find((entry) => entry.id === 'scope2:electricity');
  assert.equal(item.locationMode, 'company-wide');
  assert.equal(item.unassigned, false);
  assert.deepEqual(item.locationIds, []);
  assert.deepEqual(item.retainedLocationIds, ['loc-1']);
  assert.deepEqual(item.locations, []);
  assert.deepEqual(result.plan.items['scope2:electricity'].locationIds, ['loc-1']);
});

test('location-mode changes invalidate a completed item while preserving entered records', () => {
  const input = onboarding({ sources: [{ answer: 'Yes', names: 'Ovens', location: 'loc-1' }, ...Array.from({ length: 4 }, () => ({ answer: 'No' }))] });
  let plan = PlanCore.createPlan(input, catalog);
  plan.items['scope1:stationary'].status = 'complete';
  plan.items['scope1:stationary'].records = [{ id: 'r1', quantity: '1' }];
  plan.items['scope1:stationary'].locationMode = 'company-wide';
  plan = PlanCore.reconcilePlan(input, plan, catalog);
  assert.equal(plan.items['scope1:stationary'].status, 'in-progress');
  assert.equal(plan.items['scope1:stationary'].needsReview, true);
  assert.deepEqual(plan.items['scope1:stationary'].records, [{ id: 'r1', quantity: '1' }]);
});

test('custom items preserve an explicit unclassified path', () => {
  const input = onboarding();
  let plan = PlanCore.createPlan(input, catalog);
  plan.custom.push({ id: 'odd-activity', title: 'Needs classification', familyId: '', scope: 'unknown', locationIds: ['loc-2'], notes: 'Do not force a scope' });
  plan = PlanCore.reconcilePlan(input, plan, catalog);
  const item = PlanCore.derive(input, plan, catalog).items.find((entry) => entry.id === 'custom:odd-activity');
  assert.equal(item.scope, 'unknown');
  assert.equal(item.title, 'Needs classification');
  assert.deepEqual(item.locationIds, ['loc-2']);
  assert.equal(item.notes, 'Do not force a scope');
});

test('context keys are deterministic and cross-context reconciliation starts fresh', () => {
  const first = onboarding();
  const equivalent = onboarding({ company: { legal: '  EXAMPLE CO  ', country: 'united states' } });
  assert.equal(PlanCore.createPlan(first, catalog).contextKey, PlanCore.createPlan(equivalent, catalog).contextKey);
  const plan = PlanCore.createPlan(first, catalog);
  plan.custom.push({ id: 'old', title: 'Old company data', scope: '1' });
  const next = onboarding({ company: { legal: 'Other Co' } });
  const reconciled = PlanCore.reconcilePlan(next, plan, catalog);
  assert.equal(reconciled.custom.length, 0);
  assert.notEqual(reconciled.contextKey, plan.contextKey);
});

test('record validation accepts string zero and missing quantity but rejects unsafe numeric forms and dates', () => {
  const input = onboarding();
  const base = { id: 'r', quantity: '0', unit: 'kWh', periodStart: '2025-01-01', periodEnd: '2025-12-31', reference: '', quality: 'actual', notes: '', recordType: 'activity' };
  assert.deepEqual(PlanCore.validateRecord(base, input), []);
  assert.deepEqual(PlanCore.validateRecord({ ...base, quantity: null }, input), []);
  for (const quantity of ['-1', '1e3', 'NaN', 'Infinity']) assert.equal(PlanCore.validateRecord({ ...base, quantity }, input).some((error) => error.startsWith('Quantity')), true);
  assert.equal(PlanCore.validateRecord({ ...base, quantity: 0 }, input).some((error) => error.startsWith('Quantity')), true);
  assert.equal(PlanCore.validateRecord({ ...base, recordType: '', unit: '' }, input).length >= 2, true);
  assert.equal(PlanCore.validateRecord({ ...base, periodStart: '2025-02-30' }, input).some((error) => error.includes('valid YYYY-MM-DD')), true);
  assert.equal(PlanCore.validateRecord({ ...base, periodStart: '2025-03-01', periodEnd: '2025-02-01' }, input).some((error) => error.includes('on or after')), true);
  assert.equal(PlanCore.validateRecord({ ...base, periodStart: '2024-12-31' }, input).some((error) => error.includes('within the reporting period')), true);
});

test('derive issues retain unanswered screening, method, record, boundary and review gaps', () => {
  const input = onboarding({
    boundary: { approach: 'Not sure', operations: '' },
    review: {},
    locations: [{ id: 'loc-1', name: 'Leased site', included: 'Not sure', occupancy: 'Leased', control: 'Landlord' }],
    sources: [{ answer: 'Yes', names: '', location: 'loc-1' }, ...Array.from({ length: 4 }, () => ({}))]
  });
  let plan = PlanCore.createPlan(input, catalog);
  const item = plan.items['scope1:stationary'];
  item.records.push({ id: 'r1', quantity: null, unit: '', periodStart: '', periodEnd: '', reference: '', quality: 'unknown', notes: '', recordType: '' });
  plan = PlanCore.reconcilePlan(input, plan, catalog);
  const issues = PlanCore.derive(input, plan, catalog).issues;
  assert.equal(issues.some((issue) => issue.includes('Scope 2 screening') && issue.includes('unanswered')), true);
  assert.equal(issues.some((issue) => issue.includes('Scope 1 screening') && issue.includes('unanswered')), true);
  assert.equal(issues.some((issue) => issue.includes('needs equipment or activity names')), true);
  assert.equal(issues.some((issue) => issue.includes('method and collection review')), true);
  assert.equal(issues.some((issue) => issue.includes('has no quantity')), true);
  assert.equal(issues.some((issue) => issue.includes('has no evidence reference')), true);
  assert.equal(issues.some((issue) => issue.includes('lease or control details')), true);
  assert.equal(issues.some((issue) => issue.includes('Onboarding review acknowledgement')), true);
});

test('inputs are not mutated and malicious display text has an explicit escape boundary', () => {
  const input = onboarding({ company: { legal: '<img src=x onerror=alert(1)>' }, sources: [{ answer: 'Yes', names: '<script>bad()</script>', location: 'loc-1' }, ...Array.from({ length: 4 }, () => ({ answer: 'No' }))] });
  const before = JSON.stringify(input);
  const plan = PlanCore.createPlan(input, catalog);
  const planBefore = JSON.stringify(plan);
  const result = PlanCore.derive(input, plan, catalog);
  assert.equal(JSON.stringify(input), before);
  assert.equal(JSON.stringify(plan), planBefore);
  assert.equal(result.company.legal, '<img src=x onerror=alert(1)>');
  assert.equal(PlanCore.escapeHtml(result.company.legal), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(PlanCore.escapeHtml(result.items[0].source.names), '&lt;script&gt;bad()&lt;/script&gt;');
});
