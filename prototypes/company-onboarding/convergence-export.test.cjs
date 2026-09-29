'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createHandoff, validateHandoff, sha256 } = require('./convergence-export.cjs');

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const EVIDENCE_ID = 'ev_' + 'a'.repeat(32);
const evidence = { id: EVIDENCE_ID, name: 'meter.csv', mime: 'text/csv', size: 18, sha256: 'b'.repeat(64), createdAt: '2026-09-25T12:00:00+00:00' };

function workspace() {
  return {
    id: 'local-workspace', revision: 7, updatedAt: '2026-09-25T12:00:00+00:00',
    onboarding: {
      company: { legal: 'Synthetic Foods, Inc.', country: 'United States', region: 'California', role: 'Controller' },
      period: { start: '2025-01-01', end: '2025-12-31' },
      boundary: { approach: 'Operational control' },
      entities: [{ name: 'Synthetic Subsidiary LLC', included: 'Not sure' }],
      locations: [{ id: 'loc-' + '2'.repeat(36), name: 'Fresno plant', country: 'United States', region: 'California' }],
      sources: [{}, {}, {}, {}, {}], changes: [{}, {}, {}, {}, {}], review: {},
    },
    plan: {
      schemaVersion: 1, catalogVersion: 'synthetic-catalog-v1',
      items: { boiler: { status: 'in-progress', evidenceIds: [EVIDENCE_ID], evidence: [evidence], records: [{ id: 'r1', quantity: '0', unit: 'therm', quality: 'actual' }] } },
      custom: [], screening: {},
    },
  };
}

test('builds a deterministic candidate-only handoff with exact hosted dispositions', () => {
  const input = workspace();
  const handoff = createHandoff({ targetCompanyId: COMPANY_ID, workspace: input, generatedAt: '2026-09-25T13:00:00Z' });
  assert.equal(handoff.source.snapshotSha256, sha256({ onboarding: input.onboarding, plan: input.plan }));
  assert.equal(handoff.target.schemaVersion, 22);
  assert.equal(handoff.candidateMapping.membership.status, 'never_derived_from_local_preparer_fields');
  assert.equal(handoff.candidateMapping.betaFoundation.status, 'blocked_fixed_fixture_only');
  assert.equal(handoff.cutover.eligible, false);
  assert.deepEqual(validateHandoff(handoff), handoff);
});

test('preserves null, explicit zero and unmapped source data in the embedded snapshot', () => {
  const input = workspace();
  input.onboarding.entities[0].share = null;
  const handoff = createHandoff({ targetCompanyId: COMPANY_ID, workspace: input, generatedAt: '2026-09-25T13:00:00Z' });
  assert.equal(handoff.source.snapshot.onboarding.entities[0].share, null);
  assert.equal(handoff.source.snapshot.plan.items.boiler.records[0].quantity, '0');
  assert.equal(handoff.preservation.sourceRemainsAuthoritativeUntilCutover, true);
});

test('deduplicates identical evidence metadata and rejects conflicting metadata', () => {
  const input = workspace();
  input.plan.items.second = { evidence: [{ ...evidence }] };
  const handoff = createHandoff({ targetCompanyId: COMPANY_ID, workspace: input, generatedAt: '2026-09-25T13:00:00Z' });
  assert.equal(handoff.source.evidenceManifest.length, 1);
  input.plan.items.second.evidence[0].size = 19;
  assert.throws(() => createHandoff({ targetCompanyId: COMPANY_ID, workspace: input, generatedAt: '2026-09-25T13:00:00Z' }), /Conflicting metadata/);
});

test('fails closed on a changed snapshot or tampered target-company field', () => {
  const handoff = createHandoff({ targetCompanyId: COMPANY_ID, workspace: workspace(), generatedAt: '2026-09-25T13:00:00Z' });
  const changed = structuredClone(handoff);
  changed.source.snapshot.onboarding.company.legal = 'Changed after export';
  assert.throws(() => validateHandoff(changed), /does not match/);
  const spoofed = structuredClone(handoff);
  spoofed.target.companyId = '22222222-2222-4222-8222-222222222222';
  assert.throws(() => validateHandoff(spoofed), /does not match/);
});

test('keeps evidence without metadata explicitly unresolved', () => {
  const input = workspace();
  const missing = 'ev_' + 'c'.repeat(32);
  input.plan.items.boiler.evidenceIds.push(missing);
  const handoff = createHandoff({ targetCompanyId: COMPANY_ID, workspace: input, generatedAt: '2026-09-25T13:00:00Z' });
  assert.deepEqual(handoff.source.unresolvedEvidenceIds, [missing]);
  assert.equal(handoff.cutover.eligible, false);
});
