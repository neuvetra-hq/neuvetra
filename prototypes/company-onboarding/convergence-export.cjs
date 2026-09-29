'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const PROFILE = 'neuvetra.local-planning-handoff.v1';
const TARGET_SCHEMA_VERSION = 22;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const EVIDENCE_ID = /^ev_[0-9a-f]{32}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

class ContractError extends Error {}

function fail(message) { throw new ContractError(message); }
function plain(value) { return value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exact(value, keys, label) {
  if (!plain(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail(`${label} has an unsupported shape.`);
}
function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) fail('Only finite JSON numbers in the local workspace range are supported.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (plain(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  fail('Only plain JSON values are supported by the handoff contract.');
}
function sha256(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value), 'utf8').digest('hex'); }

function walkJson(value, state = { count: 0 }, depth = 0) {
  state.count += 1;
  if (state.count > 30000 || depth > 12) fail('Workspace payload exceeds the local complexity limit.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) fail('Workspace number is outside the local range.'); return; }
  if (typeof value === 'string') { if (value.length > 10000) fail('Workspace text exceeds the local length limit.'); return; }
  if (Array.isArray(value)) { if (value.length > 2000) fail('Workspace array exceeds the local length limit.'); value.forEach(item => walkJson(item, state, depth + 1)); return; }
  if (!plain(value) || Object.keys(value).length > 2000) fail('Workspace contains an unsupported object.');
  for (const [key, child] of Object.entries(value)) {
    if (key.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(key)) fail('Workspace contains an unsupported field name.');
    walkJson(child, state, depth + 1);
  }
}

function validateWorkspace(workspace) {
  exact(workspace, ['id', 'revision', 'onboarding', 'plan', 'updatedAt'], 'Workspace');
  if (workspace.id !== 'local-workspace' || !Number.isSafeInteger(workspace.revision) || workspace.revision < 0) fail('Workspace identity or revision is invalid.');
  if (typeof workspace.updatedAt !== 'string' || !ISO_INSTANT.test(workspace.updatedAt) || Number.isNaN(Date.parse(workspace.updatedAt))) fail('Workspace update time is invalid.');
  if (workspace.onboarding !== null && !plain(workspace.onboarding)) fail('Onboarding must be an object or null.');
  if (!plain(workspace.plan) || workspace.plan.schemaVersion !== 1 || typeof workspace.plan.catalogVersion !== 'string' || !workspace.plan.catalogVersion.trim()) fail('Plan schema or catalog version is invalid.');
  if (!plain(workspace.plan.items) || !Array.isArray(workspace.plan.custom) || !plain(workspace.plan.screening)) fail('Plan collections are invalid.');
  walkJson({ onboarding: workspace.onboarding, plan: workspace.plan });
}

function collectEvidence(node, byId = new Map(), referenced = new Set()) {
  if (Array.isArray(node)) { node.forEach(value => collectEvidence(value, byId, referenced)); return { byId, referenced }; }
  if (!plain(node)) return { byId, referenced };
  if (Array.isArray(node.evidenceIds)) {
    for (const id of node.evidenceIds) { if (typeof id !== 'string' || !EVIDENCE_ID.test(id)) fail('An evidence reference has an invalid local ID.'); referenced.add(id); }
  }
  if (Array.isArray(node.evidence)) {
    for (const row of node.evidence) {
      if (!plain(row) || typeof row.id !== 'string' || !EVIDENCE_ID.test(row.id) || typeof row.name !== 'string' || typeof row.mime !== 'string' || !Number.isSafeInteger(row.size) || row.size <= 0 || typeof row.sha256 !== 'string' || !SHA256.test(row.sha256)) fail('Evidence metadata is invalid.');
      const normalized = { id: row.id, name: row.name, mime: row.mime, size: row.size, sha256: row.sha256, createdAt: typeof row.createdAt === 'string' ? row.createdAt : null };
      const prior = byId.get(row.id);
      if (prior && canonicalJson(prior) !== canonicalJson(normalized)) fail('Conflicting metadata was supplied for one evidence ID.');
      byId.set(row.id, normalized);
    }
  }
  Object.values(node).forEach(value => collectEvidence(value, byId, referenced));
  return { byId, referenced };
}

function boundaryCandidate(onboarding) {
  const period = plain(onboarding?.period) ? onboarding.period : {};
  const boundary = plain(onboarding?.boundary) ? onboarding.boundary : {};
  const year = typeof period.start === 'string' && typeof period.end === 'string' && /^(\d{4})-01-01$/.test(period.start) && period.end === `${period.start.slice(0, 4)}-12-31` ? Number(period.start.slice(0, 4)) : null;
  const approaches = { 'Operational control': 'operational_control', 'Financial control': 'financial_control', 'Equity share': 'equity_share' };
  return { reportingYear: year, approach: approaches[boundary.approach] || null, status: 'draft' };
}

function createHandoff({ targetCompanyId, workspace, generatedAt }) {
  if (typeof targetCompanyId !== 'string' || !UUID.test(targetCompanyId)) fail('A valid target company UUID is required.');
  if (typeof generatedAt !== 'string' || !ISO_INSTANT.test(generatedAt) || Number.isNaN(Date.parse(generatedAt))) fail('A valid generatedAt instant is required.');
  validateWorkspace(workspace);
  const snapshot = { onboarding: workspace.onboarding, plan: workspace.plan };
  const evidence = collectEvidence(workspace.plan);
  const metadata = [...evidence.byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  const unresolvedEvidenceIds = [...evidence.referenced].filter(id => !evidence.byId.has(id)).sort();
  const onboarding = workspace.onboarding || {};
  const company = plain(onboarding.company) ? onboarding.company : {};
  const locations = Array.isArray(onboarding.locations) ? onboarding.locations : [];
  const document = {
    profile: PROFILE,
    contractVersion: 1,
    generatedAt,
    source: {
      system: 'company-onboarding-local-sqlite-v1',
      workspaceId: workspace.id,
      revision: workspace.revision,
      updatedAt: workspace.updatedAt,
      snapshotSha256: sha256(snapshot),
      snapshot,
      evidenceManifest: metadata,
      unresolvedEvidenceIds,
    },
    target: {
      system: 'packages/neuvetra-database',
      schemaVersion: TARGET_SCHEMA_VERSION,
      companyId: targetCompanyId,
      authorizationState: 'must_verify_server_side',
      importState: 'candidate_only',
    },
    candidateMapping: {
      company: { relation: 'neuvetra.companies', sourcePointer: '/source/snapshot/onboarding/company', name: typeof company.legal === 'string' ? company.legal : null, status: 'requires_member_authorization_and_field_review' },
      facilities: locations.map((row, index) => ({ relation: 'neuvetra.facilities', sourcePointer: `/source/snapshot/onboarding/locations/${index}`, sourceId: plain(row) && typeof row.id === 'string' ? row.id : null, targetId: null, status: 'requires_new_uuid_geography_and_entity_review' })),
      reportingBoundary: { relation: 'neuvetra.reporting_boundaries', sourcePointer: '/source/snapshot/onboarding/boundary', ...boundaryCandidate(onboarding), importStatus: 'requires_member_authorization_and_field_review' },
      corporateCoverage: { relation: 'neuvetra.corporate_inventory_versions', status: 'blocked_synthetic_contract_incompatible' },
      scope1Inventory: { relation: 'neuvetra.scope1_versions', status: 'blocked_synthetic_contract_incompatible' },
      betaFoundation: { relation: 'neuvetra.scope1_beta_setup_versions', status: 'blocked_fixed_fixture_only' },
      evidence: { relation: null, status: 'blocked_no_hosted_general_evidence_relation_or_bytes_in_handoff' },
      membership: { relation: 'neuvetra.company_members', status: 'never_derived_from_local_preparer_fields' },
    },
    preservation: {
      embeddedSnapshot: true,
      evidenceBytesEmbedded: false,
      localHistoryEmbedded: false,
      sourceRemainsAuthoritativeUntilCutover: true,
    },
    cutover: {
      eligible: false,
      trigger: 'all_server_side_import_gates_pass_for_exact_snapshot_sha256',
      blockers: ['hosted_import_schema_not_implemented', 'server_membership_not_verified', 'evidence_bytes_not_transferred_or_rehashed', 'normalized_mapping_not_reviewed', 'cross_tenant_tests_not_run', 'import_readback_not_reconciled'],
    },
  };
  return { ...document, handoffSha256: sha256(document) };
}

function validateHandoff(value) {
  exact(value, ['profile', 'contractVersion', 'generatedAt', 'source', 'target', 'candidateMapping', 'preservation', 'cutover', 'handoffSha256'], 'Handoff');
  if (value.profile !== PROFILE || value.contractVersion !== 1) fail('Unsupported handoff profile.');
  const rebuilt = createHandoff({ targetCompanyId: value.target?.companyId, workspace: { id: value.source?.workspaceId, revision: value.source?.revision, onboarding: value.source?.snapshot?.onboarding, plan: value.source?.snapshot?.plan, updatedAt: value.source?.updatedAt }, generatedAt: value.generatedAt });
  if (canonicalJson(rebuilt) !== canonicalJson(value)) fail('Handoff content or digest does not match the derived contract.');
  return rebuilt;
}

function main(argv) {
  if (argv.length !== 1) fail('Usage: node convergence-export.cjs HANDOFF.json');
  const value = JSON.parse(fs.readFileSync(argv[0], 'utf8'));
  const checked = validateHandoff(value);
  process.stdout.write(JSON.stringify({ valid: true, profile: checked.profile, handoffSha256: checked.handoffSha256, cutoverEligible: false }) + '\n');
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.name}: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { PROFILE, TARGET_SCHEMA_VERSION, ContractError, canonicalJson, sha256, createHandoff, validateHandoff };
