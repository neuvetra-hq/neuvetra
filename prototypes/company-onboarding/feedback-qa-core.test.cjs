'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const PlanCore = require('./plan-core.js');
const ReadinessCore = require('./readiness-core.js');

const ROOT = __dirname;
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'collection-catalog.json'), 'utf8'));
const methods = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'readiness-methods.json'), 'utf8'));

function onboarding() {
  return {
    company: { legal: 'Northwind Bakery, Inc.', country: 'United States', region: 'California', industry: 'Manufacturing' },
    period: { start: '2025-01-01', end: '2025-12-31', first: 'Yes' },
    boundary: { hasParent: 'No', approach: 'Operational control', operations: 'Northwind Bakery operations' },
    entities: [],
    locations: [{ id: 'loc-main', name: 'Main bakery', included: 'Include', entity: 'Reporting company', occupancy: 'Owned', control: 'Reporting company' }],
    changes: Array.from({ length: 5 }, () => ({ answer: 'No' })),
    sources: [{ answer: 'Yes', names: 'Oven one', location: 'loc-main' }, ...Array.from({ length: 4 }, () => ({ answer: 'No' }))],
    review: { complete: true, needed: true, role: 'Controller' },
  };
}

function completeStationaryPlan(input = onboarding()) {
  let plan = PlanCore.createPlan(input, catalog);
  const state = plan.items['scope1:stationary'];
  state.subtypeId = 'oven';
  state.status = 'complete';
  state.locationIds = ['loc-main'];
  state.records = [{ id: 'record-1', recordType: 'Natural gas', quantity: '1,234.50', unit: 'therms', periodStart: '2025-01-01', periodEnd: '2025-12-31', reference: 'invoice-gas', quality: 'actual', notes: '', evidenceIds: [] }];
  state.readinessDetails = { 'fuel-type': 'natural-gas', 'activity-source': 'supplier-invoice', 'source-identifier': 'meter-7' };
  return PlanCore.reconcilePlan(input, plan, catalog);
}

test('accepted-unit aliases normalize while retaining the exact original entry', () => {
  const normalized = PlanCore.normalizeRecord({ quantity: '1,234.50', unit: 'therms' });
  assert.deepEqual(normalized, { quantity: '1234.50', unit: 'therm', quantityOriginal: '1,234.50', unitOriginal: 'therms' });
  const method = methods.methods.find(row => row.catalogId === 'oven');
  assert.ok(method.acceptedUnits.includes(normalized.unit));
  const ui = fs.readFileSync(path.join(ROOT, 'plan-ui.js'), 'utf8');
  assert.match(ui, /canonical&&!units\.includes\(canonical\)/);
  assert.match(ui, /Original entry:/);
});

test('local subtype and location edits do not self-invalidate, but upstream facts do', () => {
  const input = onboarding();
  let plan = PlanCore.createPlan(input, catalog);
  const item = plan.items['scope1:stationary'];
  item.status = 'complete'; item.needsReview = false; item.subtypeId = 'oven'; item.locationMode = 'company-wide'; item.locationIds = [];
  plan = PlanCore.reconcilePlan(input, plan, catalog);
  assert.equal(plan.items['scope1:stationary'].needsReview, false);
  const changed = structuredClone(input);
  changed.sources[0].names = 'Oven one and oven two';
  const after = PlanCore.reconcilePlan(changed, plan, catalog);
  assert.equal(after.items['scope1:stationary'].needsReview, true);
  assert.equal(after.items['scope1:stationary'].status, 'in-progress');
});

test('overlapping distinct source records are review-only while exact duplicates block', () => {
  const input = onboarding();
  let plan = completeStationaryPlan(input);
  const first = PlanCore.normalizeRecord(plan.items['scope1:stationary'].records[0]);
  plan.items['scope1:stationary'].records = [first, { ...first, id: 'record-2', recordType: 'Propane', reference: 'invoice-propane' }];
  let item = ReadinessCore.evaluate(input, plan, catalog, methods).items.find(row => row.id === 'scope1:stationary');
  assert.equal(item.findings.some(row => row.code === 'period-overlap-review' && row.severity === 'review'), true);
  assert.equal(item.findings.some(row => row.code === 'duplicate-record'), false);
  plan.items['scope1:stationary'].records[1] = { ...first, id: 'record-2' };
  item = ReadinessCore.evaluate(input, plan, catalog, methods).items.find(row => row.id === 'scope1:stationary');
  assert.equal(item.findings.some(row => row.code === 'duplicate-record' && row.severity === 'blocking'), true);
});

test('customer factual fields reject placeholders and never release a method', () => {
  const input = onboarding();
  let plan = completeStationaryPlan(input);
  plan.items['scope1:stationary'].records = plan.items['scope1:stationary'].records.map(PlanCore.normalizeRecord);
  let result = ReadinessCore.evaluate(input, plan, catalog, methods);
  let item = result.items.find(row => row.id === 'scope1:stationary');
  assert.equal(item.status, 'facts-collected');
  assert.deepEqual(item.factualFields.map(row => row.id), ['fuel-type', 'activity-source', 'source-identifier']);
  assert.equal(item.factualFields.some(row => /method|factor/i.test(row.label)), false);
  assert.equal(item.findings.some(row => row.code === 'method-approval-required' && row.severity === 'review'), true);
  assert.equal(result.readyForCalculation, false);
  assert.equal(result.summary.methodReviewsComplete, 0);
  plan.items['scope1:stationary'].readinessDetails['source-identifier'] = 'N/A';
  item = ReadinessCore.evaluate(input, plan, catalog, methods).items.find(row => row.id === 'scope1:stationary');
  assert.equal(item.status, 'needs-input');
  assert.equal(item.findings.some(row => row.code === 'fact-missing'), true);
});

test('company-wide Scope 3 categories have no false site-allocation finding', () => {
  const input = onboarding();
  let plan = PlanCore.createPlan(input, catalog);
  plan.screening['category-1'].answer = 'Yes';
  plan = PlanCore.reconcilePlan(input, plan, catalog);
  const view = PlanCore.derive(input, plan, catalog).items.find(row => row.id === 'scope3:category-1');
  assert.equal(view.locationMode, 'company-wide');
  assert.equal(view.unassigned, false);
  const item = ReadinessCore.evaluate(input, plan, catalog, methods).items.find(row => row.id === 'scope3:category-1');
  assert.equal(item.findings.some(row => ['location-unresolved', 'multi-site-allocation'].includes(row.code)), false);
});

test('justified exclusions remain separate from active activity counts', () => {
  const input = onboarding();
  input.sources = Array.from({ length: 5 }, () => ({ answer: 'No' }));
  let plan = PlanCore.createPlan(input, catalog);
  plan.screening['scope1:stationary'].reason = 'Equipment register confirms no stationary combustion assets.';
  const result = ReadinessCore.evaluate(input, plan, catalog, methods);
  assert.equal(result.summary.activityCount, 0);
  assert.equal(result.summary.excluded, 5);
  const excluded = result.items.find(row => row.id === 'scope1:stationary');
  assert.equal(excluded.status, 'excluded-pending-review');
  assert.match(excluded.findings[0].message, /Equipment register/);
});

test('next-action presentation caps five findings, groups them, and collapses full findings', () => {
  const ui = fs.readFileSync(path.join(ROOT, 'readiness-ui.js'), 'utf8');
  const start = ui.indexOf('const actionPriority');
  const end = ui.indexOf('function renderNextActions');
  assert.ok(start >= 0 && end > start);
  const source = ui.slice(start, end) + '\nglobalThis.answer=nextActions(globalThis.fixture);';
  const fixture = [{ id: 'a', findings: Array.from({ length: 7 }, (_, index) => ({ severity: 'blocking', code: 'gap-' + index, message: 'Gap ' + index })) }];
  const context = { fixture }; vm.createContext(context); vm.runInContext(source, context);
  assert.equal(context.answer.length, 5);
  assert.equal(new Set(context.answer.map(row => row.item.id)).size, 1);
  assert.match(ui, /<details class="activity-findings">/);
  assert.doesNotMatch(ui, /item\.findings\.slice\(0,5\)/);
});

test('company punctuation is sentence-safe and user-facing readiness copy avoids revision jargon', () => {
  const ui = fs.readFileSync(path.join(ROOT, 'readiness-ui.js'), 'utf8');
  const end = ui.indexOf('async function request');
  const context = { input: 'Northwind Bakery, Inc.' }; vm.createContext(context);
  vm.runInContext(ui.slice(0, end) + '\nglobalThis.answer=sentence(input);', context);
  assert.equal(context.answer, 'Northwind Bakery, Inc.');
  assert.doesNotMatch(ui, /neuvetra-readiness-revision-/i);
  assert.doesNotMatch(ui, />Revision\s/i);
});

test('legacy reporting-company values converge to one canonical option without data loss', () => {
  const source = fs.readFileSync(path.join(ROOT, 'locations.js'), 'utf8');
  const end = source.indexOf('function locationChoiceLabel');
  const data = { entities: [{ name: 'Northwind Bakery, Inc.' }, { name: 'Subsidiary LLC' }], locations: [{ entity: 'Northwind Bakery, Inc.', id: 'loc-legacy' }], sources: [] };
  const context = { data, get: key => key === 'company.legal' ? 'Northwind Bakery, Inc.' : '', crypto: { randomUUID: () => 'unused' } };
  vm.createContext(context);
  vm.runInContext(source.slice(0, end) + '\nglobalThis.options=locationEntities();globalThis.changed=ensureLocationIds();', context);
  assert.deepEqual(Array.from(context.options), ['Reporting company', 'Subsidiary LLC']);
  assert.equal(context.changed, true);
  assert.equal(data.locations[0].entity, 'Reporting company');
  assert.equal(data.locations[0].originalEntity, 'Northwind Bakery, Inc.');
});

test('file selection, in-flight upload and orphan recovery have explicit UI guards', () => {
  const ui = fs.readFileSync(path.join(ROOT, 'plan-ui.js'), 'utf8');
  assert.match(ui, /if\(uploading\|\|\$\('#evidenceFile'\)\.files\.length\)/);
  assert.match(ui, /if\(uploading\).*Wait for the document upload to finish/);
  assert.match(ui, /Use a document already stored in this workspace/);
  assert.match(ui, /Removed location links:/);
  assert.match(ui, /request\('\/api\/evidence'\)/);
});
