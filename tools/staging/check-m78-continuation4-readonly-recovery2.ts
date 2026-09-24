/** Corrected graph-first recovery. Imports are inert; root owns credentials, locks and execution. */
import { decodeScope1Register, decodeScope1Report } from '../../apps/site-web/src/lib/m78-api';
import { decodeCorporateRegister, decodeCorporateVersion } from '../../apps/site-web/src/lib/m71-api';
import { decodeGasRegister, decodeGasVersion } from '../../apps/site-web/src/lib/m73-api';
import { decodeMobileRegister, decodeMobileVersion } from '../../apps/site-web/src/lib/m74-api';
import { decodeFleetRegister, decodeFleetReview, decodeFleetVersion } from '../../apps/site-web/src/lib/m75-api';
import { decodeGeneratorRegister, decodeGeneratorVersion } from '../../apps/site-web/src/lib/m76-diesel-api';
import { decodeStationaryRegister, decodeStationaryReview, decodeStationaryVersion } from '../../apps/site-web/src/lib/m76-api';
import { decodeFugitiveRegister } from '../../apps/site-web/src/lib/m77-api';
import { m71Export } from '../../packages/neuvetra-database/src/m71';
import { m73Export } from '../../packages/neuvetra-database/src/m73-validation';
import { m74Export } from '../../packages/neuvetra-database/src/m74-validation';
import { deriveM75ReconciliationFromProof, m75CanonicalJson, m75Export, m75ReportHashPayload } from '../../packages/neuvetra-database/src/m75-validation';
import { m75RenderReport } from '../../packages/neuvetra-database/src/m75-report';
import { m76DieselExport } from '../../packages/neuvetra-database/src/m76-diesel-validation';
import { deriveM76ReconciliationFromProof, m76CanonicalJson, m76Export, m76ReportHashPayload } from '../../packages/neuvetra-database/src/m76-validation';
import { m76RenderReport } from '../../packages/neuvetra-database/src/m76-report';
import { m77Export } from '../../packages/neuvetra-database/src/m77-validation';
import { m78CanonicalJson as canonical, parseM78Json } from '../../packages/neuvetra-database/src/m78-validation';
import { readM78ContinuationJournal, m78VerifiedIdentity } from './check-m78-continuation';
import { verifyExerciseFailure } from '../../evaluations/research-qa/m78-continuation4-exercise-failure-qa-check';
import type { RecoveryAuth, RecoveryDecoders, RecoveryIO, RecoverySession } from './check-m78-continuation4-readonly-recovery';

export const M78_READONLY_RECOVERY2_PATHS = {
  journal: '.superpowers/m78-continuation4-readonly-recovery2.jsonl',
  diagnostics: '.superpowers/m78-continuation4-readonly-recovery2-diagnostics.jsonl',
  rawCapture: '.superpowers/m78-continuation4-readonly-recovery2-raw-capture.jsonl',
  observation: '.superpowers/m78-continuation4-readonly-recovery2-observation.json',
} as const;
export const M78_READONLY_RECOVERY2_LOCK = M78_READONLY_RECOVERY2_PATHS.journal + '.lock';
export const M78_READONLY_RECOVERY2_LIMITS = { responseBytes: 10_000_000, retainedResponseBytes: 128_000_000, rawCaptureBytes: 192_000_000, journalBytes: 16_000_000, timeoutMs: 30_000 } as const;
export const M78_READONLY_RECOVERY2_HOST = 'https://www.neuvetra.ai';
export const M78_READONLY_RECOVERY2_AUTH = 'https://icockcoguyadhryzydvl.supabase.co';
export type Recovery2Role = 'manager1' | 'manager2' | 'member' | 'outsider';
type Pin = { path: string; sha256: string };
type FailureInputs = { mainText: string; diagnosticText: string; baselineResultText: string; exerciseGateText: string; providerObservationText: string; browserObservationText: string; failureReviewText: string };
export type Recovery2Admission = FailureInputs & {
  failedRecoveryJournalText: string;
  failedRecoveryDiagnosticText: string;
  failedRecoveryReviewText: string;
  currentSourceGateText: string;
  currentSourcePins: Pin[];
  load: (path: string) => Promise<string | Uint8Array>;
};
export type Recovery2Decoders = RecoveryDecoders;
export type Recovery2RunInput = {
  admission: Recovery2Admission;
  io: RecoveryIO;
  fetch: typeof fetch;
  auth: RecoveryAuth;
  expectedSubjects: Record<Recovery2Role, string>;
  readLegacy: (request: (url: string, init: RequestInit) => Promise<Response>, expected: unknown) => Promise<{ value: unknown; applicationPostRequests: 0; allCreatedAuthSessionsClosed: true }>;
  decoders?: Recovery2Decoders;
  now?: () => string;
};

const FAILED_MAIN_SHA = '44e7bec2d2e6a4a554de6ba23775150bfdf29582fd69ff12bc6cfbc73770ba8b';
const FAILED_DIAGNOSTICS_SHA = 'd77a8f58ec92a0642a5b0b4a91113920ccd4013b9bcfee9a9c7e5de90d93e651';
const FAILED_RECOVERY_SHA = '0c2062c12db60f0e65c21f0fcc17122a95a11ba689d04f18c51c0652f887aca8';
const FAILED_RECOVERY_HEAD = 'ed2b807afebed57ad31cf580bb8212933a6527ff820d01a8c9484d6dcd417dfb';
const FAILED_RECOVERY_DIAGNOSTICS_SHA = 'e2e56cc5b3220b1d138023e945e38c9d2dfeca26a15bcd4a35b2cd71d33ff57c';
const FAILED_RECOVERY_DIAGNOSTICS_HEAD = 'a72b4fe58a4e65f61b7f80ffd14ffc5a5a59b3e8ee960f6b7b41ea9b17c3ba9e';
const FAILED_RECOVERY_REVIEW_SHA = '7e46ba485e77c132113ac78d8dd4d0ef3ffb440f3a790afcdaa7874532923cac';
const sha = (value: string | Uint8Array) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
const check: (value: unknown, message: string) => asserts value = (value, message) => { if (!value) throw Error(message); };
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const exactKeys = (value: unknown, keys: string[], label: string) => { check(value && typeof value === 'object' && !Array.isArray(value), label); check(same(Object.keys(value as object).sort(), [...keys].sort()), label + ' keys'); };
const validPin = (pin: Pin) => pin && pin.path.length > 0 && /^[a-f0-9]{64}$/.test(pin.sha256);
const productionDecoders: Recovery2Decoders = { scope1: decodeScope1Register, corporate: decodeCorporateRegister, gas: decodeGasRegister, mobile: decodeMobileRegister, fleet: decodeFleetRegister, diesel: decodeGeneratorRegister, equipment: decodeStationaryRegister, fugitive: decodeFugitiveRegister, scope1Report: decodeScope1Report };
const bytes = (text: string) => new TextEncoder().encode(text);
const encoded = (text: string) => ({ sha256: sha(text), byteLength: bytes(text).byteLength });

function chained(text: string, profile: string) {
  check(text.endsWith('\n'), profile + ' newline');
  const events = text.trimEnd().split('\n').map(line => JSON.parse(line));
  let prior: string | null = null;
  for (let index = 0; index < events.length; index++) {
    const event = events[index], { sha256: eventSha256, ...body } = event;
    check(event.profile === profile && event.sequence === index + 1 && event.previousSha256 === prior && eventSha256 === shaText(body), profile + ' chain');
    prior = eventSha256;
  }
  return events;
}
function shaText(value: unknown) { return sha(canonical(value)); }

export async function verifyM78ReadonlyRecovery2PreAuth(input: Recovery2Admission) {
  const reconciled = await verifyExerciseFailure(input);
  check(sha(input.failureReviewText) === 'a97a84ca66ed696a348c8c8a5ecaf65e36ca4eb311803b6f2ecccebf9d16c573', 'exercise failure review bytes');
  check(sha(input.failedRecoveryJournalText) === FAILED_RECOVERY_SHA && sha(input.failedRecoveryDiagnosticText) === FAILED_RECOVERY_DIAGNOSTICS_SHA, 'preserved failed recovery bytes');
  const failed = chained(input.failedRecoveryJournalText, 'm78-continuation4-readonly-recovery-v1'), diagnostics = chained(input.failedRecoveryDiagnosticText, 'm78-continuation4-readonly-recovery-diagnostic-v1');
  check(failed.length === 18 && failed.at(-1)?.sha256 === FAILED_RECOVERY_HEAD && failed.at(-1)?.kind === 'attempt_finished' && failed.at(-1)?.data.status === 'failed' && failed.at(-1)?.data.applicationPostRequests === 0 && failed.at(-1)?.data.unknownAuthSessions === 0, 'closed failed recovery');
  check(diagnostics.length === 49 && diagnostics.at(-1)?.sha256 === FAILED_RECOVERY_DIAGNOSTICS_HEAD && diagnostics.at(-1)?.kind === 'phase_finished' && diagnostics.at(-1)?.data.status === 'failed' && diagnostics.at(-1)?.data.applicationPostRequests === 0, 'closed failed recovery diagnostics');
  check(['manager1', 'manager2', 'member', 'outsider'].every(role => failed.some(event => event.kind === 'logout_outcome' && event.data.role === role && event.data.status === 204)), 'failed recovery main sessions closed');
  const historicalGate = JSON.parse(input.exerciseGateText), currentGate = JSON.parse(input.currentSourceGateText), review = JSON.parse(input.failedRecoveryReviewText);
  check(Array.isArray(historicalGate.sourcePins) && historicalGate.sourcePins.length === 173 && historicalGate.sourcePins.every(validPin), 'historical 173 source pins');
  check(currentGate.status === 'm78_continuation4_readonly_recovery2_source_admitted' && currentGate.historicalExerciseGateSha256 === '9fe233c964b8c40f6c7a9871eecf75a318e7a800f2ec14570c6803288ff9dce7', 'fresh recovery2 source gate');
  check(sha(input.failedRecoveryReviewText) === FAILED_RECOVERY_REVIEW_SHA && currentGate.failedRecoverySha256 === FAILED_RECOVERY_SHA && currentGate.failedRecoveryDiagnosticsSha256 === FAILED_RECOVERY_DIAGNOSTICS_SHA && currentGate.failedRecoveryReviewSha256 === FAILED_RECOVERY_REVIEW_SHA, 'failed recovery gate pins');
  check(review.status === 'm78_readonly_recovery_failure2_independently_reconciled' && review.failedRecoveryAccepted === false && review.actualRecoveryAccepted === false && review.restartAuthorized === false && review.revisitAuthorized === false && review.materialFindingsOpen === 0 && review.failure?.main?.sha256 === FAILED_RECOVERY_SHA && review.failure?.diagnostics?.sha256 === FAILED_RECOVERY_DIAGNOSTICS_SHA && review.failure?.applicationPostRequests === 0 && review.failure?.localLogout204 === 4 && review.failure?.unknownAuthSessions === 0, 'independent failed recovery review');
  check(input.currentSourcePins.length >= 173 && input.currentSourcePins.every(validPin) && new Set(input.currentSourcePins.map(pin => pin.path)).size === input.currentSourcePins.length, 'fresh recovery2 source pins');
  check(same(currentGate.sourcePins, input.currentSourcePins) && currentGate.sourcePinsSha256 === sha(canonical(input.currentSourcePins)), 'fresh recovery2 gate pins');
  check(currentGate.runtime && /^[a-f0-9]{40}$/.test(currentGate.runtime.commit) && typeof currentGate.runtime.deploymentId === 'string' && currentGate.runtime.deploymentId.length > 0 && /^sha256:[a-f0-9]{64}$/.test(currentGate.runtime.imageDigest), 'fresh recovery2 runtime');
  check(input.currentSourcePins.some(pin => pin.path === 'tools/staging/check-m78-continuation4-readonly-recovery2.ts'), 'recovery2 source inventoried');
  for (const pin of input.currentSourcePins) check(sha(await input.load(pin.path)) === pin.sha256, 'fresh recovery2 source changed ' + pin.path);
  return { reconciled, historicalSourcePins: historicalGate.sourcePins, currentSourceGate: currentGate, failedReview: review };
}

type Captured = { sequence: number; previousSha256: string | null; profile: 'm78-continuation4-readonly-recovery2-raw-capture-v1'; status: 'captured_unreviewed'; requestOrdinal: number; route: string; responseStatus: number; headers: Record<string, string>; encoding: 'utf8' | 'base64'; body: string; bodySha256: string; byteLength: number; createdAt: string; sha256: string };
function capturedBytes(event: Captured) { return event.encoding === 'utf8' ? bytes(event.body) : Uint8Array.from(Buffer.from(event.body, 'base64')); }
export function evaluateM78ReadonlyRecovery2Capture(text: string) {
  const events = chained(text, 'm78-continuation4-readonly-recovery2-raw-capture-v1') as Captured[];
  for (const event of events) {
    check(event.status === 'captured_unreviewed' && event.route.startsWith('application:') && Number.isInteger(event.requestOrdinal) && event.requestOrdinal > 0, 'raw capture boundary');
    check(!Object.keys(event.headers).some(key => ['authorization', 'cookie', 'set-cookie'].includes(key.toLowerCase())), 'raw capture secret header');
    const body = capturedBytes(event); check(body.byteLength === event.byteLength && sha(body) === event.bodySha256 && event.byteLength <= M78_READONLY_RECOVERY2_LIMITS.responseBytes, 'raw capture body');
  }
  return events;
}

type RosterArtifacts = { html: string; snapshotJson: string; proofEnvelope: unknown; htmlCapture: number; snapshotCapture: number; proofCapture: number };
async function verifyRosterReport(family: 'fleet' | 'equipment', metadata: any, artifact: RosterArtifacts) {
  check(sha(artifact.html) === metadata.htmlSha256 && bytes(artifact.html).byteLength === metadata.htmlByteLength && sha(artifact.snapshotJson) === metadata.snapshotSha256, family + ' report byte hashes');
  const snapshot = parseM78Json(artifact.snapshotJson, M78_READONLY_RECOVERY2_LIMITS.responseBytes) as any;
  check(artifact.snapshotJson === (family === 'fleet' ? m75CanonicalJson(snapshot) : m76CanonicalJson(snapshot)), family + ' canonical snapshot');
  exactKeys(artifact.proofEnvelope, ['reportId', 'proof'], family + ' proof envelope');
  const envelope = artifact.proofEnvelope as any; check(envelope.reportId === metadata.id, family + ' proof report id');
  if (family === 'fleet') {
    exactKeys(snapshot, ['profile', 'version', 'review', 'reconciliation'], 'fleet snapshot');
    await decodeFleetVersion(snapshot.version, metadata.companyId); if (snapshot.review) await decodeFleetReview(snapshot.review, metadata.companyId, snapshot.version);
    const proof = envelope.proof; exactKeys(proof, ['coverageVersion', 'boundCoverageVersion', 'workpaperVersions'], 'fleet proof');
    if (proof.coverageVersion) await decodeCorporateVersion(proof.coverageVersion, metadata.companyId); if (proof.boundCoverageVersion) await decodeCorporateVersion(proof.boundCoverageVersion, metadata.companyId);
    for (const workpaper of proof.workpaperVersions) await decodeMobileVersion(workpaper, metadata.companyId);
    check(proof.boundCoverageVersion?.id === snapshot.version.activity.coverageVersionId && proof.boundCoverageVersion?.versionSha256 === snapshot.version.activity.coverageVersionSha256, 'fleet bound coverage');
    check(same(deriveM75ReconciliationFromProof(metadata.companyId, proof, snapshot.version, snapshot.review ? [snapshot.review] : [], shaText), snapshot.reconciliation), 'fleet report reconciliation');
    check(metadata.rosterVersionId === snapshot.version.id && metadata.rosterId === snapshot.version.rosterId && artifact.html === m75RenderReport(snapshot), 'fleet report rendering');
    check(shaText(m75ReportHashPayload({ ...metadata, snapshotJson: artifact.snapshotJson, html: artifact.html })) === metadata.reportSha256, 'fleet report identity');
  } else {
    exactKeys(snapshot, ['profile', 'version', 'review', 'reconciliation'], 'equipment snapshot');
    await decodeStationaryVersion(snapshot.version, metadata.companyId); if (snapshot.review) await decodeStationaryReview(snapshot.review, metadata.companyId, snapshot.version);
    const proof = envelope.proof; exactKeys(proof, ['coverageVersion', 'boundCoverageVersion', 'gasWorkpaperVersions', 'dieselWorkpaperVersions'], 'equipment proof');
    if (proof.coverageVersion) await decodeCorporateVersion(proof.coverageVersion, metadata.companyId); if (proof.boundCoverageVersion) await decodeCorporateVersion(proof.boundCoverageVersion, metadata.companyId);
    check(Array.isArray(proof.gasWorkpaperVersions) && proof.gasWorkpaperVersions.length <= 3 && Array.isArray(proof.dieselWorkpaperVersions) && proof.dieselWorkpaperVersions.length <= 1, 'equipment proof workpapers');
    const workpaperStreams = new Set<string>(); for (const version of proof.gasWorkpaperVersions) { await decodeGasVersion(version, metadata.companyId); check(!workpaperStreams.has(version.worksheetId), 'equipment unique gas workpaper'); workpaperStreams.add(version.worksheetId); } for (const version of proof.dieselWorkpaperVersions) { await decodeGeneratorVersion(version, metadata.companyId); check(!workpaperStreams.has(version.worksheetId), 'equipment unique diesel workpaper'); workpaperStreams.add(version.worksheetId); }
    check(same(deriveM76ReconciliationFromProof(metadata.companyId, proof, snapshot.version, snapshot.review ? [snapshot.review] : [], shaText), snapshot.reconciliation), 'equipment report reconciliation');
    check(metadata.rosterVersionId === snapshot.version.id && metadata.rosterId === snapshot.version.rosterId && artifact.html === m76RenderReport(snapshot), 'equipment report rendering');
    check(shaText(m76ReportHashPayload({ ...metadata, snapshotJson: artifact.snapshotJson, html: artifact.html })) === metadata.reportSha256, 'equipment report identity');
  }
  return { html: encoded(artifact.html), snapshot: encoded(artifact.snapshotJson), proofSha256: sha(canonical(artifact.proofEnvelope)) };
}

export async function reconstructM78ReadonlyRecovery2Artifacts(scope1: any, registers: any, fullReports: Record<string, any>, rosterArtifacts: { fleet: Record<string, RosterArtifacts>; equipment: Record<string, RosterArtifacts> }) {
  const downloads: Record<string, Record<string, unknown>> = {}, put = (family: string, key: string, value: unknown) => ((downloads[family] ??= {})[key] = value);
  for (const version of registers.corporate.versions) put('corporate', version.id, encoded(m71Export(version)));
  for (const [family, exporter] of [['gas', m73Export], ['mobile', m74Export], ['diesel', m76DieselExport]] as const) for (const worksheet of registers[family].worksheets) {
    for (const version of worksheet.versions) {
      put(family, 'version_' + version.id, encoded(exporter(version as never)));
      if (family === 'mobile') { if (version.fuelStatement) put(family, 'fuel_' + version.fuelStatement.id, encoded(version.fuelStatement.text)); if (version.mileageStatement) put(family, 'mileage_' + version.mileageStatement.id, encoded(version.mileageStatement.text)); }
      else if (version.statement) put(family, 'statement_' + version.statement.id, encoded(version.statement.text));
    }
    for (const report of worksheet.reports) { put(family, 'report_' + report.id, encoded(report.html)); if (family === 'diesel') put(family, 'snapshot_' + report.id, encoded(report.snapshotJson)); }
  }
  for (const [family, exporter] of [['fleet', m75Export], ['equipment', m76Export]] as const) {
    for (const version of registers[family].versions) { put(family, 'version_' + version.id, encoded(exporter(version as never))); if (version.statement) put(family, 'statement_' + version.statement.id, encoded(version.statement.text)); }
    for (const report of registers[family].reports) {
      const artifact = rosterArtifacts[family][report.id]; check(artifact, family + ' retained report capture ' + report.id);
      const verified = await verifyRosterReport(family, report, artifact);
      put(family, 'report_' + report.id, verified.html); put(family, 'snapshot_' + report.id, verified.snapshot); put(family, 'proof_' + report.id, verified.proofSha256);
    }
  }
  for (const worksheet of [...registers.fugitive.worksheets, registers.fugitive.population]) {
    for (const version of worksheet.versions) { put('fugitive', 'version_' + version.id, encoded(m77Export(version))); for (const statement of version.statements) put('fugitive', 'statement_' + statement.id, encoded(statement.text)); }
    for (const report of worksheet.reports) { put('fugitive', 'report_' + report.id, encoded(report.html)); put('fugitive', 'snapshot_' + report.id, encoded(report.snapshotJson)); }
  }
  const m78bytes: Record<string, { sha256: string; byteLength: number }> = {};
  for (const stream of [scope1.process, scope1.inventory]) {
    for (const version of stream.versions) { m78bytes['version_' + version.id] = encoded(canonical({ ...version, review: null })); for (const statement of version.statements) m78bytes['statement_' + statement.id] = encoded(statement.text); }
    for (const metadata of stream.reports) { const report = fullReports[metadata.id]; check(report, 'full retained scope1 report ' + metadata.id); m78bytes['html_' + metadata.id] = encoded(report.html); m78bytes['snapshot_' + metadata.id] = encoded(report.snapshotJson); }
  }
  return { downloads, m78bytes };
}

function graphObjects(value: unknown, result: any[] = []) { if (!value || typeof value !== 'object') return result; if (Array.isArray(value)) { for (const item of value) graphObjects(item, result); return result; } const object = value as Record<string, unknown>; result.push(object); for (const item of Object.values(object)) graphObjects(item, result); return result; }
function verifiedRecipe(mainText: string) { const company = JSON.parse(mainText.split('\n')[0]!).workspaceId, events = readM78ContinuationJournal(mainText, company), triples = events.filter(event => event.mode === 'exercise' && ['post_intent', 'post_outcome', 'post_verified'].includes(event.kind)); check(triples.length === 111, 'exact37 recipe'); return { company, events, operations: Array.from({ length: 37 }, (_, index) => ({ intent: triples[index * 3]!, outcome: triples[index * 3 + 1]!, verified: triples[index * 3 + 2]! })) }; }
type FailureCategory = 'admission' | 'auth' | 'transport' | 'response_bound' | 'capture' | 'status' | 'decode' | 'artifact' | 'legacy' | 'diagnostic' | 'cleanup' | 'unknown';
function category(error: unknown, stage: string): FailureCategory { const message = error instanceof Error ? error.message : ''; if (stage.startsWith('auth')) return 'auth'; if (stage.startsWith('legacy')) return 'legacy'; if (stage.startsWith('artifact')) return 'artifact'; if (stage.startsWith('decode')) return 'decode'; if (stage.startsWith('capture')) return 'capture'; if (stage.startsWith('status')) return 'status'; if (stage.startsWith('cleanup')) return 'cleanup'; if (message.includes('byte bound')) return 'response_bound'; if (message.includes('diagnostic')) return 'diagnostic'; if (stage.startsWith('transport') || message.includes('transport') || error instanceof DOMException) return 'transport'; return 'unknown'; }

export async function runM78Continuation4ReadonlyRecovery2(input: Recovery2RunInput) {
  const now = input.now ?? (() => new Date().toISOString()), decoders = input.decoders ?? productionDecoders;
  for (const path of Object.values(M78_READONLY_RECOVERY2_PATHS)) check(await input.io.read(path) === null, 'exclusive recovery2 path exists');
  const admission = await verifyM78ReadonlyRecovery2PreAuth(input.admission), recipe = verifiedRecipe(input.admission.mainText), company = recipe.company, root = `/workspace-api/workspace/${company}`;
  const events: any[] = [], diagnostics: any[] = [], captures: Captured[] = []; let journalBytes = 0, rawCaptureBytes = 0, retainedResponseBytes = 0, applicationPosts = 0, requests = 0, unknownSessions = 0, legacyClosed = false, mainClosed = false, diagnosticsHealthy = true, diagnosticFailure: unknown = null, stage = 'admission', failureStage: string | null = null, failureCategory: FailureCategory | null = null;
  const appendChain = async (path: string, profile: string, list: any[], kind: string, data: any) => { const body = { sequence: list.length + 1, previousSha256: list.at(-1)?.sha256 ?? null, profile, workspaceId: company, kind, data, createdAt: now() }, event = { ...body, sha256: shaText(body) }, line = JSON.stringify(event) + '\n'; if (path === M78_READONLY_RECOVERY2_PATHS.journal) { journalBytes += bytes(line).byteLength; check(journalBytes <= M78_READONLY_RECOVERY2_LIMITS.journalBytes, 'journal byte bound'); } await input.io.append(path, line, list.length === 0); list.push(event); return event; };
  const emit = (kind: string, data: any) => appendChain(M78_READONLY_RECOVERY2_PATHS.journal, 'm78-continuation4-readonly-recovery2-v1', events, kind, data);
  const diagnostic = (kind: string, data: any) => appendChain(M78_READONLY_RECOVERY2_PATHS.diagnostics, 'm78-continuation4-readonly-recovery2-diagnostic-v1', diagnostics, kind, data);
  const recordDiagnostic = async (kind: string, data: any) => { try { await diagnostic(kind, data); return true; } catch (error) { diagnosticsHealthy = false; diagnosticFailure ??= error; return false; } };
  const safeRoute = (url: URL, auth: boolean) => (auth ? 'auth:' : 'application:') + url.pathname.replaceAll(company, ':id').replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id');
  const request = async (url: string, init: RequestInit = {}) => {
    const parsed = new URL(url), method = (init.method ?? 'GET').toUpperCase(), auth = parsed.origin === M78_READONLY_RECOVERY2_AUTH, app = parsed.origin === M78_READONLY_RECOVERY2_HOST, localLogout = auth && parsed.pathname === '/auth/v1/logout' && parsed.searchParams.size === 1 && parsed.searchParams.get('scope') === 'local';
    check(app || auth, 'fixed transport host'); if (app) check(method === 'GET' && init.body === undefined, 'application GET only'); if (auth) { check(method === 'POST' && ['/auth/v1/token', '/auth/v1/logout'].includes(parsed.pathname), 'fixed auth POST only'); if (parsed.pathname === '/auth/v1/logout') check(localLogout, 'local logout only'); } if (app && method === 'POST') applicationPosts++;
    if (!diagnosticsHealthy && !localLogout) throw diagnosticFailure ?? Error('diagnostics unhealthy'); const ordinal = requests + 1, route = safeRoute(parsed, auth), intentRecorded = await recordDiagnostic('request_intent', { ordinal, method, route, ...(localLogout ? { logoutScope: 'local' } : {}) }); if (!intentRecorded && !localLogout) throw diagnosticFailure ?? Error('diagnostics unhealthy'); requests = ordinal;
    try { stage = 'transport:' + route; const response = await input.fetch(url, { ...init, keepalive: false, redirect: 'error', signal: AbortSignal.timeout(M78_READONLY_RECOVERY2_LIMITS.timeoutMs) }); await recordDiagnostic('response_headers', { ordinal, status: response.status }); return { response, ordinal, route, app }; } catch (error) { await recordDiagnostic('request_error', { ordinal, category: error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'transport' }); throw error; }
  };
  const sessions = new Map<Recovery2Role, RecoverySession>();
  const responseBytes = async (response: Response) => { check(response.body, 'response body'); const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0; try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; check(length <= M78_READONLY_RECOVERY2_LIMITS.responseBytes, 'response byte bound'); chunks.push(value.slice()); } } catch (error) { await reader.cancel(error).catch(() => undefined); throw error; } finally { reader.releaseLock(); } const output = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; } return output; };
  const capture = async (ordinal: number, route: string, response: Response, bodyBytes: Uint8Array) => {
    stage = 'capture:' + route; const encoding = 'base64' as const, body = Buffer.from(bodyBytes).toString('base64');
    const headers: Record<string, string> = {}; for (const name of ['cache-control', 'content-type', 'content-disposition', 'content-security-policy', 'x-content-type-options', 'referrer-policy']) { const value = response.headers.get(name); if (value !== null) headers[name] = value; }
    const base = { sequence: captures.length + 1, previousSha256: captures.at(-1)?.sha256 ?? null, profile: 'm78-continuation4-readonly-recovery2-raw-capture-v1' as const, status: 'captured_unreviewed' as const, requestOrdinal: ordinal, route, responseStatus: response.status, headers, encoding, body, bodySha256: sha(bodyBytes), byteLength: bodyBytes.byteLength, createdAt: now() }, event = { ...base, sha256: shaText(base) }, line = JSON.stringify(event) + '\n'; rawCaptureBytes += bytes(line).byteLength; check(rawCaptureBytes <= M78_READONLY_RECOVERY2_LIMITS.rawCaptureBytes, 'raw capture byte bound'); await input.io.append(M78_READONLY_RECOVERY2_PATHS.rawCapture, line, captures.length === 0); captures.push(event); return event;
  };
  const getBytes = async (route: string, role: Recovery2Role | 'signed_out' = 'manager1', expected = 200) => {
    const session = role === 'signed_out' ? undefined : sessions.get(role), { response, ordinal, route: safe, app } = await request(M78_READONLY_RECOVERY2_HOST + route, { headers: { origin: M78_READONLY_RECOVERY2_HOST, ...(session ? { authorization: session.authorization } : {}) } }); check(app, 'application response'); const body = await responseBytes(response); retainedResponseBytes += body.byteLength; check(retainedResponseBytes <= M78_READONLY_RECOVERY2_LIMITS.retainedResponseBytes, 'retained response byte bound'); const event = await capture(ordinal, safe, response, body); stage = 'status:' + safe; check(response.status === expected, 'GET status ' + route); if (expected === 200) check(response.headers.get('cache-control')?.includes('no-store'), 'no-store GET ' + route); return { body, capture: event };
  };
  const getJson = async (route: string, role: Recovery2Role | 'signed_out' = 'manager1', expected = 200) => { const value = await getBytes(route, role, expected); if (expected !== 200) return { value: null, capture: value.capture }; stage = 'decode:' + value.capture.route; return { value: parseM78Json(new TextDecoder('utf-8', { fatal: true }).decode(value.body), M78_READONLY_RECOVERY2_LIMITS.responseBytes), capture: value.capture }; };
  const getText = async (route: string, role: Recovery2Role = 'manager1') => { const value = await getBytes(route, role, 200); stage = 'decode:' + value.capture.route; return { value: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(value.body), capture: value.capture }; };
  let observation: any = null, failure: unknown = null;
  await emit('attempt_started', { failedMainSha256: FAILED_MAIN_SHA, failedDiagnosticsSha256: FAILED_DIAGNOSTICS_SHA, failedRecoverySha256: FAILED_RECOVERY_SHA, failedRecoveryDiagnosticsSha256: FAILED_RECOVERY_DIAGNOSTICS_SHA, failedRecoveryReviewSha256: sha(input.admission.failedRecoveryReviewText), historicalSourcePins: admission.historicalSourcePins.length, currentSourceGateSha256: sha(input.admission.currentSourceGateText), transport: { runtime: 'bun-fetch', pooling: 'disabled', keepalive: false, retries: 0, timeoutMs: 30000 }, applicationMethods: ['GET'], rawCaptureStatus: 'captured_unreviewed' });
  try {
    stage = 'auth'; for (const role of ['manager1', 'manager2', 'member', 'outsider'] as Recovery2Role[]) { await emit('auth_intent', { role }); let opened: RecoverySession | undefined; try { const result = await input.auth.open(role, async (url, init) => (await request(url, init)).response); opened = result; sessions.set(role, opened); check(opened.role === role && opened.status === 200 && opened.subject === input.expectedSubjects[role] && opened.authorization.length > 0, 'auth session ' + role); await emit('auth_outcome', { role, status: 200, subjectMatched: true, sessionCreationUncertain: false }); } catch (error) { if (!opened) unknownSessions++; await emit('auth_outcome', { role, status: opened?.status ?? null, subjectMatched: false, sessionCreationUncertain: !opened }); throw error; } }
    await getJson(root + '/scope1-inventory', 'outsider', 403); await getJson(root + '/scope1-inventory', 'signed_out', 401);
    const managerScope1 = await decoders.scope1((await getJson(root + '/scope1-inventory', 'manager1')).value, company), memberScope1 = await decoders.scope1((await getJson(root + '/scope1-inventory', 'member')).value, company); check(same(managerScope1, memberScope1), 'manager/member graph equality');
    const registers: any = {}; for (const [family, base, decode] of [['corporate', 'corporate-inventories', decoders.corporate], ['gas', 'stationary-natural-gas', decoders.gas], ['mobile', 'mobile-diesel', decoders.mobile], ['fleet', 'controlled-fleet', decoders.fleet], ['diesel', 'stationary-diesel', decoders.diesel], ['equipment', 'stationary-equipment', decoders.equipment], ['fugitive', 'fugitive-sources', decoders.fugitive]] as const) registers[family] = await decode((await getJson(root + '/' + base, 'manager1')).value, company);
    const graph = graphObjects({ scope1: managerScope1, registers }), fullReports: Record<string, any> = {}, fetched = new Set<string>(); for (const operation of recipe.operations) { const identity = operation.verified.data.verifiedIdentity as Record<string, string>; check(graph.some(record => Object.entries(identity).every(([key, value]) => record[key] === value)), 'verified identity in fresh graph ' + operation.intent.data.name); if (identity.reportSha256) { const route = operation.intent.data.route + '/' + identity.id; check(!fetched.has(route), 'one full scope1 report read'); fetched.add(route); const report = await decoders.scope1Report((await getJson(route, 'manager1')).value, company); check(same(m78VerifiedIdentity(report), identity), 'full scope1 report identity'); fullReports[identity.id] = report; } }
    check(Object.keys(fullReports).length === 5, 'five full retained scope1 reports');
    const rosterArtifacts: { fleet: Record<string, RosterArtifacts>; equipment: Record<string, RosterArtifacts> } = { fleet: {}, equipment: {} };
    stage = 'artifact:roster-reports'; for (const [family, base] of [['fleet', 'controlled-fleet'], ['equipment', 'stationary-equipment']] as const) for (const metadata of registers[family].reports) { const prefix = `${root}/${base}/${metadata.rosterId}/reports/${metadata.id}`, html = await getText(prefix + '/download'), snapshot = await getText(prefix + '/snapshot'), proof = await getJson(prefix + '/proof'); rosterArtifacts[family][metadata.id] = { html: html.value, snapshotJson: snapshot.value, proofEnvelope: proof.value, htmlCapture: html.capture.sequence, snapshotCapture: snapshot.capture.sequence, proofCapture: proof.capture.sequence }; }
    stage = 'artifact:reconstruct'; const artifacts = await reconstructM78ReadonlyRecovery2Artifacts(managerScope1, registers, fullReports, rosterArtifacts), baselineEvent = recipe.events.find(event => event.kind === 'baseline')!;
    stage = 'legacy'; const legacy = await input.readLegacy(async (url, init) => { const requested = await request(url, init); if (!requested.app) return requested.response; const body = await responseBytes(requested.response); retainedResponseBytes += body.byteLength; check(retainedResponseBytes <= M78_READONLY_RECOVERY2_LIMITS.retainedResponseBytes, 'retained response byte bound'); await capture(requested.ordinal, requested.route, requested.response, body); return new Response(body.slice(), { status: requested.response.status, statusText: requested.response.statusText, headers: requested.response.headers }); }, baselineEvent.data.legacy); check(legacy.applicationPostRequests === 0 && legacy.allCreatedAuthSessionsClosed && same(legacy.value, baselineEvent.data.legacy), 'unchanged legacy'); legacyClosed = true;
    const rawCaptureText = await input.io.read(M78_READONLY_RECOVERY2_PATHS.rawCapture); check(rawCaptureText, 'raw capture durable'); const closedCapture = evaluateM78ReadonlyRecovery2Capture(rawCaptureText);
    observation = { status: 'm78_continuation4_readonly_recovery2_observed', profile: 'm78-continuation4-readonly-recovery2-observation-v1', workspaceId: company, failedMainSha256: FAILED_MAIN_SHA, failedDiagnosticsSha256: FAILED_DIAGNOSTICS_SHA, failedRecoverySha256: FAILED_RECOVERY_SHA, failedRecoveryDiagnosticsSha256: FAILED_RECOVERY_DIAGNOSTICS_SHA, failedRecoveryReviewSha256: sha(input.admission.failedRecoveryReviewText), historicalSourcePins: admission.historicalSourcePins, currentSourcePins: input.admission.currentSourcePins, currentSourceGateSha256: sha(input.admission.currentSourceGateText), scope1: managerScope1, registers, ...artifacts, fullReports, rosterArtifacts: Object.fromEntries(Object.entries(rosterArtifacts).map(([family, values]) => [family, Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { htmlCapture: value.htmlCapture, snapshotCapture: value.snapshotCapture, proofCapture: value.proofCapture }]))])), legacy: legacy.value, applicationPostRequests: 0, retainedResponseBytes, retainedResponseByteLimit: M78_READONLY_RECOVERY2_LIMITS.retainedResponseBytes, rawCaptureSha256: sha(rawCaptureText), rawCaptureHead: closedCapture.at(-1)?.sha256 ?? null, rawCaptureEvents: closedCapture.length, scope1FullReportReads: fetched.size, rosterArtifactReads: Object.values(registers.fleet.reports).length * 3 + Object.values(registers.equipment.reports).length * 3, observedAt: now() };
  } catch (error) { failure = error; failureStage = stage; failureCategory = category(error, stage); } finally {
    stage = 'cleanup'; let closed = 0; for (const role of ['manager1', 'manager2', 'member', 'outsider'] as Recovery2Role[]) { const session = sessions.get(role); if (!session) continue; try { await emit('logout_intent', { role }); } catch (error) { failure ??= error; failureStage ??= 'cleanup:journal'; failureCategory ??= 'cleanup'; } try { const status = await input.auth.close(session, async (url, init) => (await request(url, init)).response); try { await emit('logout_outcome', { role, status }); } catch (error) { failure ??= error; failureStage ??= 'cleanup:journal'; failureCategory ??= 'cleanup'; } if (status === 204) closed++; } catch (error) { try { await emit('logout_outcome', { role, status: null }); } catch { /* cleanup continues */ } failure ??= error; failureStage ??= 'cleanup:logout'; failureCategory ??= 'cleanup'; } } mainClosed = closed === sessions.size && sessions.size === 4;
  }
  failure ??= diagnosticFailure; if (diagnosticFailure) { failureStage ??= 'diagnostic'; failureCategory ??= 'diagnostic'; }
  const passed = !failure && observation && mainClosed && legacyClosed && unknownSessions === 0 && applicationPosts === 0 && diagnosticsHealthy;
  if (passed) { const observationText = JSON.stringify(observation, null, 2) + '\n'; await recordDiagnostic('phase_finished', { status: 'passed', requests, applicationPostRequests: 0, allCreatedAuthSessionsClosed: true, unknownAuthSessions: 0, diagnosticsHealthy: true, rawCaptureStatus: 'captured_unreviewed' }); if (!diagnosticsHealthy) { failure = diagnosticFailure; failureStage = 'diagnostic:phase_finished'; failureCategory = 'diagnostic'; } else { await emit('recovery2_observed', { observationSha256: sha(observationText), rawCaptureSha256: observation.rawCaptureSha256, applicationPostRequests: 0, allMainSessionsClosed: true, allLegacySessionsClosed: true }); await emit('attempt_finished', { status: 'passed', requests, applicationPostRequests: 0, allCreatedAuthSessionsClosed: true, unknownAuthSessions: 0, diagnosticsHealthy: true }); await input.io.append(M78_READONLY_RECOVERY2_PATHS.observation, observationText, true); return { status: 'passed' as const, observation, requests, applicationPostRequests: 0, allCreatedAuthSessionsClosed: true, unknownAuthSessions: 0, failureStage: null, failureCategory: null }; } }
  await recordDiagnostic('phase_finished', { status: 'failed', requests, applicationPostRequests: applicationPosts, allCreatedAuthSessionsClosed: mainClosed && legacyClosed, unknownAuthSessions: unknownSessions, diagnosticsHealthy, rawCaptureStatus: captures.length ? 'captured_unreviewed' : 'absent' }); try { await emit('attempt_finished', { status: 'failed', requests, applicationPostRequests: applicationPosts, allCreatedAuthSessionsClosed: mainClosed && legacyClosed, unknownAuthSessions: unknownSessions, diagnosticsHealthy, failureStage: failureStage ?? 'unknown', failureCategory: failureCategory ?? 'unknown', rawCaptureStatus: captures.length ? 'captured_unreviewed' : 'absent' }); } catch { /* preserve cleanup result */ }
  return { status: 'failed' as const, requests, applicationPostRequests: applicationPosts, allCreatedAuthSessionsClosed: mainClosed && legacyClosed, unknownAuthSessions: unknownSessions, failureStage: failureStage ?? 'unknown', failureCategory: failureCategory ?? 'unknown', rawCaptureStatus: captures.length ? 'captured_unreviewed' as const : 'absent' as const };
}
