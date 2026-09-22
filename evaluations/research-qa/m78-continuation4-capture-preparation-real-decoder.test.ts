import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
  buildM78Continuation4RevisitObservation,
  type M78CapturedObservation,
  type M78RevisitCaptureSet,
} from '../../tools/staging/m78-continuation4-revisit-capture';
import { M71_LIMITATIONS, M71_PROFILE } from '../../packages/neuvetra-database/src/m71-contract';
import { M73_LIMITATIONS, M73_PROFILE } from '../../packages/neuvetra-database/src/m73-contract';
import { M74_LIMITATIONS, M74_PROFILE } from '../../packages/neuvetra-database/src/m74-contract';
import { M75_LIMITATIONS, M75_PROFILE } from '../../packages/neuvetra-database/src/m75-contract';
import { M76_DIESEL_LIMITATIONS, M76_DIESEL_PROFILE } from '../../packages/neuvetra-database/src/m76-diesel-contract';
import { M76_LIMITATIONS, M76_PROFILE } from '../../packages/neuvetra-database/src/m76-contract';
import { M77_LIMITATIONS } from '../../packages/neuvetra-database/src/m77-contract';
import { deriveM75ReconciliationFromProof, m75CanonicalJson } from '../../packages/neuvetra-database/src/m75-validation';
import { deriveM76ReconciliationFromProof, m76CanonicalJson } from '../../packages/neuvetra-database/src/m76-validation';
import { deriveM77Reconciliation, m77CanonicalJson, m77SourceChoices } from '../../packages/neuvetra-database/src/m77-validation';

const company = '8b90c706-1710-494d-b12d-02eef88eacb7';
const root = `/workspace-api/workspace/${company}`;
const sha = (value: string | Uint8Array) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
const invariant = {
  synthetic: true,
  scope1Completeness: 'incomplete',
  corporateCompleteness: 'incomplete',
  releaseEligible: false,
  assurance: 'none',
};

function addJson(observations: Map<string, M78CapturedObservation>, route: string, value: unknown) {
  const text = JSON.stringify(value);
  observations.set(route, { route, sha256: sha(text), byteLength: Buffer.byteLength(text), json: value });
}
function addBytes(observations: Map<string, M78CapturedObservation>, route: string, text: string) {
  observations.set(route, { route, sha256: sha(text), byteLength: Buffer.byteLength(text) });
}

/** Local native fixture only: no hosted journal, network, credentials, or database. */
test('default async decoders accept response-shaped state and reconstruct nonempty dynamic maps', async () => {
  const firstLine = (await readFile('.superpowers/m78-continuation-native-20260922-run.jsonl', 'utf8')).split('\n', 1)[0]!;
  const scope1 = JSON.parse(firstLine).data.baseline;
  const observations = new Map<string, M78CapturedObservation>();
  addJson(observations, `${root}/scope1-inventory`, scope1);

  addJson(observations, `${root}/corporate-inventories`, {
    profile: M71_PROFILE, companyId: company, inventoryId: null, headVersionId: null,
    versions: [], limitations: M71_LIMITATIONS,
  });
  for (const [route, profile, limitations] of [
    ['stationary-natural-gas', M73_PROFILE, M73_LIMITATIONS],
    ['mobile-diesel', M74_PROFILE, M74_LIMITATIONS],
    ['stationary-diesel', M76_DIESEL_PROFILE, M76_DIESEL_LIMITATIONS],
  ] as const) {
    addJson(observations, `${root}/${route}`, {
      profile, companyId: company, coverageHeadVersionId: null, worksheets: [], sources: [],
      coverageFindings: [], limitations, ...invariant,
    });
  }

  const fleetProof = { coverageVersion: null, boundCoverageVersion: null, workpaperVersions: [] };
  addJson(observations, `${root}/controlled-fleet`, {
    profile: M75_PROFILE, companyId: company, rosterId: null, headVersionId: null,
    versions: [], reviews: [], reports: [], proof: fleetProof,
    reconciliation: deriveM75ReconciliationFromProof(company, fleetProof as any, null, [],
      (value) => sha(m75CanonicalJson(value))),
    limitations: M75_LIMITATIONS,
  });
  const equipmentProof = {
    coverageVersion: null, boundCoverageVersion: null, gasWorkpaperVersions: [], dieselWorkpaperVersions: [],
  };
  addJson(observations, `${root}/stationary-equipment`, {
    profile: M76_PROFILE, companyId: company, rosterId: null, headVersionId: null,
    versions: [], reviews: [], reports: [], proof: equipmentProof,
    reconciliation: deriveM76ReconciliationFromProof(company, equipmentProof as any, null, [],
      (value) => sha(m76CanonicalJson(value))),
    limitations: M76_LIMITATIONS,
  });

  const fugitiveVersions = scope1.proof.sourceVersions
    .filter((item: any) => item.family === 'fugitive' && item.version.version === 1)
    .map((item: any) => item.version);
  const fugitive = {
    profile: 'synthetic-fugitive-register-v1',
    companyId: company,
    coverageHeadVersionId: scope1.coverageVersion.id,
    coverageVersion: scope1.coverageVersion,
    sources: m77SourceChoices(scope1.coverageVersion),
    worksheets: fugitiveVersions.map((version: any) => ({
      worksheetId: version.streamId,
      sourceId: version.activity.binding.sourceId,
      assetId: version.activity.assetId,
      headVersionId: version.id,
      versions: [version],
      reports: [],
    })),
    population: { rosterId: null, headVersionId: null, versions: [], reports: [] },
    reconciliation: deriveM77Reconciliation(
      company, scope1.coverageVersion, fugitiveVersions, null, [],
      (value) => sha(m77CanonicalJson(value)),
    ),
    limitations: M77_LIMITATIONS,
  };
  addJson(observations, `${root}/fugitive-sources`, fugitive);

  for (const version of fugitiveVersions) {
    addBytes(observations, `${root}/fugitive-sources/${version.streamId}/versions/${version.id}/calculation-export`, `export-${version.id}`);
    for (const statement of version.statements) {
      addBytes(observations, `${root}/fugitive-sources/${version.streamId}/statements/${statement.id}/download`, statement.text);
    }
  }
  for (const [family, stream] of [['process-screen', scope1.process], ['scope1-inventory', scope1.inventory]] as const) {
    for (const version of stream.versions) {
      addBytes(observations, `${root}/${family}/${version.streamId}/versions/${version.id}/inventory-export`, `export-${version.id}`);
      for (const statement of version.statements) {
        addBytes(observations, `${root}/${family}/${version.streamId}/statements/${statement.id}/download`, statement.text);
      }
    }
    for (const report of stream.reports) {
      const reportRoot = `${root}/${family}/${report.streamId}/reports/${report.id}`;
      addBytes(observations, `${reportRoot}/download`, `html-${report.id}`);
      addBytes(observations, `${reportRoot}/snapshot`, `snapshot-${report.id}`);
    }
  }

  const annualId = '10000000-0000-4000-8000-000000000001';
  const packId = '10000000-0000-4000-8000-000000000002';
  const reportId = '10000000-0000-4000-8000-000000000003';
  const billId = '10000000-0000-4000-8000-000000000004';
  addJson(observations, root, { companyName: 'Synthetic' });
  addJson(observations, `${root}/bills/${billId}`, { id: billId });
  addJson(observations, `${root}/inventories/2023/scope2`, { inventory: true });
  addJson(observations, `${root}/annual-registers/2023`, { register: true });
  addJson(observations, `${root}/annual-inventories/2023/scope2`, { id: annualId });
  const annualRoot = `${root}/annual-inventories/${annualId}`;
  addJson(observations, `${annualRoot}/evidence-packs/current`, { id: packId });
  addJson(observations, `${annualRoot}/draft-reports/current`, { id: reportId });
  addJson(observations, `${annualRoot}/draft-reports/${reportId}/decisions/current`, { accepted: true });
  addJson(observations, `${root}/electricity-worksheet`, { worksheet: 64 });
  addJson(observations, `${root}/source-electricity-worksheet`, { worksheet: 66 });
  addJson(observations, `${root}/annual-electricity-worksheet`, { worksheet: 67 });
  addJson(observations, `${root}/annual-electricity-evidence`, { evidence: 68 });
  addJson(observations, `${root}/source-electricity-worksheet/sources`, { sources: [] });
  for (const base of ['electricity-worksheet', 'source-electricity-worksheet', 'annual-electricity-worksheet', 'annual-electricity-evidence']) {
    addJson(observations, `${root}/${base}/reports`, { reports: [] });
  }
  addBytes(observations, `${annualRoot}/evidence-packs/${packId}/download`, 'pack-bytes');
  addBytes(observations, `${annualRoot}/draft-reports/${reportId}/download`, 'report-bytes');

  const captures: M78RevisitCaptureSet = {
    requests: observations.size,
    aggregateBytes: [...observations.values()].reduce((sum, item) => sum + item.byteLength, 0),
    observations,
  };
  const result = await buildM78Continuation4RevisitObservation(captures, {
    workspaceId: company,
    journal: { path: 'synthetic://journal', sha256: 'a'.repeat(64), head: 'b'.repeat(64), events: 1 },
    gate: { path: 'synthetic://gate', sha256: 'c'.repeat(64) },
    journeyGate: { reviewedApplicationCommit: 'd'.repeat(40) },
    sourcePins: Array.from({ length: 173 }, (_, index) => ({
      path: `source/${index}.ts`, sha256: index.toString(16).padStart(64, '0'),
    })),
    captureStartedAt: '2026-01-01T00:00:00.000Z',
    captureCompletedAt: '2026-01-01T00:01:00.000Z',
    observedAt: '2026-01-01T00:01:01.000Z',
  });
  expect(result.scope1).toEqual(scope1);
  expect(result.registers.fugitive.worksheets.length).toBeGreaterThan(0);
  expect(Object.keys(result.downloads.fugitive).length).toBeGreaterThan(0);
  expect(Object.keys(result.m78bytes).length).toBeGreaterThan(0);
});
