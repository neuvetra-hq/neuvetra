import type { HostedWorkspaceActor } from './workspace-api'
import { coverageSha256, decodeCorporateVersion } from './m71-api'
import { decodeMobileVersion } from './m74-api'
import { m71HashString, m71Keys, m71Uuid, parseM71Json } from '../../../../packages/neuvetra-database/src/m71-validation'
import { M75_PROFILE, M75_LIMITATIONS, M75_MAX_RESPONSE_BYTES, M75_MAX_VERSIONS, M75_MAX_REPORTS, type M75Dependencies, type M75Version, type M75Review, type M75Register, type M75ReportMetadata, type M75Report, type M75SaveInput, type M75ReviewInput, type M75ReportInput, type M75Finding } from '../../../../packages/neuvetra-database/src/m75-contract'
import { m75CanonicalJson, m75Activity, validateM75Save, validateM75Review, m75DependencyPayload, m75InputPayload, m75ContentPayload, m75VersionHashPayload, m75ReviewHashPayload, m75ReportHashPayload, m75Export, m75StatementText, deriveM75RosterFindings, deriveM75ReconciliationFromProof } from '../../../../packages/neuvetra-database/src/m75-validation'
import { m75RenderReport } from '../../../../packages/neuvetra-database/src/m75-report'

const fail = (): never => { throw new Error('The fleet record could not be verified. Refresh before continuing.') }
const requireValue = (value: unknown) => { if (!value) fail() }
const equal = (a: unknown, b: unknown) => m75CanonicalJson(a) === m75CanonicalJson(b)
const hash = (value: unknown) => coverageSha256(m75CanonicalJson(value))
const instant = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v
const flags = (v: M75Version | M75Register['reconciliation']) => v.synthetic === true && v.scope1Completeness === 'incomplete' && v.corporateCompleteness === 'incomplete' && v.releaseEligible === false && v.assurance === 'none' && v.emissionsTotals === null
const bounded = (v: unknown, max = 2000): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && v === v.trim()
const versionKeys = ['id','companyId','rosterId','version','previousVersionId','previousVersionSha256','createdBy','createdAt','contributorIds','correctionReason','activity','dependencies','statement','findings','inputSha256','contentSha256','versionSha256','synthetic','scope1Completeness','corporateCompleteness','releaseEligible','assurance','emissionsTotals']
const reportKeys = ['id','companyId','rosterId','rosterVersionId','createdBy','createdAt','rendererVersion','snapshotSha256','htmlSha256','htmlByteLength','reportSha256']

function pin(v: unknown) { if (v === null) return; m71Keys(v, ['id','sha256']); requireValue(m71Uuid(v.id) && m71HashString(v.sha256)) }
function findings(v: unknown): asserts v is M75Finding[] {
  requireValue(Array.isArray(v))
  for (const item of v as M75Finding[]) { m71Keys(item, ['code','rowKey','message','blocking']); requireValue(bounded(item.code, 120) && bounded(item.message) && (item.rowKey === null || bounded(item.rowKey, 120)) && typeof item.blocking === 'boolean') }
}
async function dependencies(v: M75Dependencies) {
  m71Keys(v, ['coveragePin','coverageReviewPin','workpaperPins','dependencySha256']); pin(v.coveragePin); pin(v.coverageReviewPin)
  requireValue(Array.isArray(v.workpaperPins) && v.workpaperPins.length <= 3 && (v.coveragePin !== null || v.coverageReviewPin === null))
  const ids = new Set<string>()
  for (const row of v.workpaperPins) {
    m71Keys(row, ['worksheetId','sourceId','assetId','version','decision']); pin(row.version); pin(row.decision)
    requireValue(row.version !== null && m71Uuid(row.worksheetId) && m71Uuid(row.sourceId) && typeof row.assetId === 'string' && /^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(row.assetId) && !ids.has(row.worksheetId)); ids.add(row.worksheetId)
  }
  requireValue(equal(v.workpaperPins.map(p => p.worksheetId), [...ids].sort()) && await hash(m75DependencyPayload(v)) === v.dependencySha256)
}

/** Shared derivation is pure and synchronous. Resolve its bounded hash inputs
 * with Web Crypto, then replay it; no browser-only accounting implementation. */
async function deriveWithHashes<T>(derive: (hasher: (value: unknown) => string) => T): Promise<T> {
  const cache = new Map<string, string>()
  class MissingDigest { constructor(readonly text: string) {} }
  for (let i = 0; i < 16; i++) {
    try { return derive(value => { const text = m75CanonicalJson(value), digest = cache.get(text); if (digest === undefined) throw new MissingDigest(text); return digest }) }
    catch (error) { if (!(error instanceof MissingDigest)) throw error; cache.set(error.text, await coverageSha256(error.text)) }
  }
  return fail()
}

export async function decodeFleetVersion(raw: unknown, companyId: string, previous?: M75Version): Promise<M75Version> {
  try {
    m71Keys(raw, versionKeys); const v = raw as unknown as M75Version
    requireValue(m71Uuid(companyId) && v.companyId === companyId && [v.id,v.rosterId,v.createdBy].every(m71Uuid) && instant(v.createdAt) && flags(v) && Number.isInteger(v.version) && v.version >= 1 && v.version <= M75_MAX_VERSIONS)
    requireValue(Array.isArray(v.contributorIds) && v.contributorIds.every(m71Uuid) && equal(v.contributorIds,[...new Set(v.contributorIds)].sort()) && v.contributorIds.includes(v.createdBy))
    if (previous) requireValue(v.rosterId === previous.rosterId && v.version === previous.version + 1 && v.previousVersionId === previous.id && v.previousVersionSha256 === previous.versionSha256 && v.createdAt >= previous.createdAt && previous.contributorIds.every(id => v.contributorIds.includes(id)))
    if (v.version === 1) requireValue(v.previousVersionId === null && v.previousVersionSha256 === null && v.correctionReason === null)
    else requireValue(m71Uuid(v.previousVersionId) && m71HashString(v.previousVersionSha256) && bounded(v.correctionReason, 500))
    await dependencies(v.dependencies)
    const normalized = validateM75Save({ ...v.activity, expectedDependencySha256: v.dependencies.dependencySha256, expectedVersionId: v.previousVersionId, expectedVersionSha256: v.previousVersionSha256, correctionReason: v.correctionReason, idempotencyKey: v.id })
    requireValue(equal(m75Activity(normalized), v.activity) && v.dependencies.coveragePin?.id === v.activity.coverageVersionId && v.dependencies.coveragePin.sha256 === v.activity.coverageVersionSha256)
    if (previous?.activity.rosterStatement) requireValue(v.activity.rosterStatement !== null && previous.activity.rosterStatement.assets.every(old => v.activity.rosterStatement!.assets.some(row => row.rowId === old.rowId)))
    findings(v.findings)
    if (v.statement === null) requireValue(v.activity.rosterStatement === null)
    else {
      const s = v.statement; m71Keys(s, ['id','profile','input','locator','text','sha256','byteLength'])
      requireValue(m71Uuid(s.id) && s.profile === 'm75-synthetic-roster-statement-v1' && equal(s.input, v.activity.rosterStatement) && s.locator === `m75-roster-statement:${s.id}:declared-fleet` && typeof s.text === 'string' && s.byteLength === new TextEncoder().encode(s.text).length && s.sha256 === await coverageSha256(s.text))
      const prefix = 'SYNTHETIC — NOT AN ORIGINAL COMPANY RECORD OR INDEPENDENT MEASUREMENT\n'
      requireValue(s.text.startsWith(prefix) && s.text.endsWith('\n'))
      const parsed = parseM71Json(s.text.slice(prefix.length).trim(), 100000)
      m71Keys(parsed, ['profile','companyLabel','coverageVersionId','coverageVersionSha256','period','statement'])
      requireValue(parsed.profile === s.profile && bounded(parsed.companyLabel) && parsed.coverageVersionId === v.activity.coverageVersionId && parsed.coverageVersionSha256 === v.activity.coverageVersionSha256 && equal(parsed.period,v.activity.period) && equal(parsed.statement,s.input) && s.text === prefix + m75CanonicalJson(parsed) + '\n')
    }
    requireValue(await hash(m75InputPayload(v)) === v.inputSha256 && await hash(m75ContentPayload(v)) === v.contentSha256 && await hash(m75VersionHashPayload(v)) === v.versionSha256)
    return v
  } catch { return fail() }
}

export async function decodeFleetReview(raw: unknown, companyId: string, version?: M75Version): Promise<M75Review> {
  try {
    m71Keys(raw, ['id','versionId','versionSha256','dependencies','decision','note','acknowledgedLimitations','reviewerId','reviewedAt','decisionSha256']); const r = raw as unknown as M75Review
    requireValue(m71Uuid(r.id) && m71Uuid(r.reviewerId) && instant(r.reviewedAt)); await dependencies(r.dependencies)
    validateM75Review({ versionId:r.versionId, expectedVersionSha256:r.versionSha256, expectedDependencySha256:r.dependencies.dependencySha256, decision:r.decision, note:r.note, acknowledgedLimitations:r.acknowledgedLimitations, idempotencyKey:r.id })
    if (version) requireValue(r.versionId === version.id && r.versionSha256 === version.versionSha256 && equal(r.dependencies,version.dependencies) && !version.contributorIds.includes(r.reviewerId) && r.reviewedAt >= version.createdAt)
    requireValue(await hash(m75ReviewHashPayload(companyId,r)) === r.decisionSha256); return r
  } catch { return fail() }
}

function reportMetadata(raw: unknown, companyId: string): M75ReportMetadata {
  m71Keys(raw, reportKeys); const r = raw as unknown as M75ReportMetadata
  requireValue(r.companyId === companyId && [r.id,r.rosterId,r.rosterVersionId,r.createdBy].every(m71Uuid) && instant(r.createdAt) && r.rendererVersion === 'm75-fleet-reconciliation-report-v1' && [r.snapshotSha256,r.htmlSha256,r.reportSha256].every(m71HashString) && Number.isInteger(r.htmlByteLength) && r.htmlByteLength > 0 && r.htmlByteLength <= 131072)
  return r
}

export async function decodeFleetRegister(raw: unknown, companyId: string): Promise<M75Register> {
  try {
    m71Keys(raw, ['profile','companyId','rosterId','headVersionId','versions','reviews','reports','proof','reconciliation','limitations']); const r = raw as unknown as M75Register
    requireValue(r.profile === M75_PROFILE && r.companyId === companyId && m71Uuid(companyId) && equal(r.limitations,M75_LIMITATIONS) && Array.isArray(r.versions) && r.versions.length <= M75_MAX_VERSIONS && Array.isArray(r.reviews) && r.reviews.length <= r.versions.length && Array.isArray(r.reports) && r.reports.length <= M75_MAX_REPORTS)
    const ids = new Set<string>(); let prior: M75Version | undefined
    for (const v of r.versions) { requireValue(!ids.has(v.id) && v.version === (prior?.version ?? 0) + 1 && v.rosterId === r.rosterId); await decodeFleetVersion(v,companyId,prior); ids.add(v.id); prior = v }
    requireValue(r.headVersionId === (prior?.id ?? null) && (prior ? m71Uuid(r.rosterId) : r.rosterId === null))
    const reviewed = new Set<string>(), reviewIds = new Set<string>()
    for (const review of r.reviews) { const version = r.versions.find(v => v.id === review.versionId); requireValue(version && !reviewed.has(review.versionId) && !reviewIds.has(review.id)); await decodeFleetReview(review,companyId,version); reviewed.add(review.versionId); reviewIds.add(review.id) }
    const reportIds = new Set<string>()
    for (const report of r.reports) { reportMetadata(report,companyId); const version = r.versions.find(v => v.id === report.rosterVersionId); requireValue(version && report.rosterId === r.rosterId && !reportIds.has(report.id) && report.createdAt >= version!.createdAt && await hash(m75ReportHashPayload({...report,snapshotJson:'',html:''})) === report.reportSha256); reportIds.add(report.id) }
    m71Keys(r.proof, ['coverageVersion','boundCoverageVersion','workpaperVersions']); requireValue(Array.isArray(r.proof.workpaperVersions) && r.proof.workpaperVersions.length <= 3)
    if (r.proof.coverageVersion) await decodeCorporateVersion(r.proof.coverageVersion,companyId)
    const streams = new Set<string>(), sources = new Set<string>(), assets = new Set<string>()
    for (const v of r.proof.workpaperVersions) { await decodeMobileVersion(v,companyId); requireValue(!streams.has(v.worksheetId) && !sources.has(v.activity.binding.sourceId) && !assets.has(v.activity.vehicle.assetId)); streams.add(v.worksheetId); sources.add(v.activity.binding.sourceId); assets.add(v.activity.vehicle.assetId) }
    await verifyBoundCoverage(r.proof, prior ?? null, companyId)
    const expected = await deriveWithHashes(hasher => deriveM75ReconciliationFromProof(companyId,r.proof,prior ?? null,r.reviews,hasher))
    if (prior && prior.dependencies.dependencySha256 === expected.dependencySha256) {
      const contributors = [...new Set([...(r.versions[r.versions.length - 2]?.contributorIds ?? []),prior.createdBy,...(r.proof.coverageVersion?.contributorIds ?? []),...r.proof.workpaperVersions.flatMap(v => v.contributorIds)])].sort()
      requireValue(equal(prior.contributorIds,contributors))
    }
    requireValue(equal(expected,r.reconciliation)); return r
  } catch { return fail() }
}

async function request(actor: HostedWorkspaceActor, companyId: string, suffix: string, payload?: unknown): Promise<string> {
  actor.signal?.throwIfAborted(); requireValue(m71Uuid(companyId) && actor.accessToken && !/[\r\n]/.test(actor.accessToken))
  const response = await fetch(`/workspace-api/workspace/${companyId}/controlled-fleet${suffix}`, { method:payload === undefined ? 'GET' : 'POST', headers:{authorization:`Bearer ${actor.accessToken}`, ...(payload === undefined ? {} : {'content-type':'application/json'})}, body:payload === undefined ? undefined : JSON.stringify(payload), signal:actor.signal, cache:'no-store' })
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) { actor.onUnauthorized?.(); throw new Error('Your access changed. Sign in again to continue.') }
  if (!response.ok) throw new Error(response.status === 409 ? 'The roster, corporate boundary or a workpaper changed. Refresh before retrying.' : response.status === 422 ? 'Check the roster facts, evidence, confirmations and correction reason. Nothing was saved.' : 'Fleet records are unavailable. Retry the same action or refresh.')
  const text = await response.text(); actor.signal?.throwIfAborted(); requireValue(new TextEncoder().encode(text).length <= M75_MAX_RESPONSE_BYTES); return text
}
const pathId = (id: string) => { requireValue(m71Uuid(id)); return id }
export const fleetRegisterRequest = async (a:HostedWorkspaceActor,c:string) => decodeFleetRegister(parseM71Json(await request(a,c,''),M75_MAX_RESPONSE_BYTES),c)
export const fleetSaveRequest = async (a:HostedWorkspaceActor,c:string,id:string|null,input:M75SaveInput) => decodeFleetVersion(parseM71Json(await request(a,c,id ? `/${pathId(id)}/versions` : '',input),M75_MAX_RESPONSE_BYTES),c)
export const fleetReviewRequest = async (a:HostedWorkspaceActor,c:string,id:string,input:M75ReviewInput) => decodeFleetReview(parseM71Json(await request(a,c,`/${pathId(id)}/reviews`,input),M75_MAX_RESPONSE_BYTES),c)
export async function fleetReportRequest(a:HostedWorkspaceActor,c:string,id:string,input:M75ReportInput): Promise<M75Report> {
  const raw = parseM71Json(await request(a,c,`/${pathId(id)}/reports`,input),M75_MAX_RESPONSE_BYTES)
  m71Keys(raw,[...reportKeys,'snapshotJson','html']); const r = raw as unknown as M75Report, {snapshotJson,html,...metadata} = r
  reportMetadata(metadata,c); requireValue(typeof html === 'string' && typeof snapshotJson === 'string' && await coverageSha256(html) === r.htmlSha256 && new TextEncoder().encode(html).length === r.htmlByteLength && await coverageSha256(snapshotJson) === r.snapshotSha256 && await hash(m75ReportHashPayload(r)) === r.reportSha256)
  const snapshot = await decodeReportSnapshot(snapshotJson,r)
  await verifyReportProof(await request(a,c,`/${pathId(r.rosterId)}/reports/${pathId(r.id)}/proof`),r,snapshot)
  requireValue(snapshot.reconciliation.contentSha256 === input.expectedReconciliationSha256 && html === m75RenderReport(snapshot)); return r
}
export async function fleetStatementDownload(a:HostedWorkspaceActor,c:string,v:M75Version) { requireValue(v.companyId === c && v.statement); const s = v.statement!; const text = await request(a,c,`/${pathId(v.rosterId)}/statements/${pathId(s.id)}/download`); requireValue(text === s.text && await coverageSha256(text) === s.sha256); return text }
export async function fleetVersionDownload(a:HostedWorkspaceActor,c:string,v:M75Version) { requireValue(v.companyId === c); const text = await request(a,c,`/${pathId(v.rosterId)}/versions/${pathId(v.id)}/roster-export`); requireValue(text === m75Export(v)); await decodeFleetVersion(parseM71Json(text,M75_MAX_RESPONSE_BYTES),c); return text }
async function decodeReportSnapshot(text:string,r:M75ReportMetadata) {
  const raw = parseM71Json(text,M75_MAX_RESPONSE_BYTES); m71Keys(raw,['profile','version','review','reconciliation'])
  const snapshot = raw as unknown as Parameters<typeof m75RenderReport>[0]
  requireValue(snapshot.profile === 'm75-fleet-reconciliation-report-v1' && text === m75CanonicalJson(snapshot))
  await decodeFleetVersion(snapshot.version,r.companyId)
  requireValue(snapshot.version.id === r.rosterVersionId && snapshot.version.rosterId === r.rosterId && snapshot.version.createdAt <= r.createdAt)
  if (snapshot.review) { await decodeFleetReview(snapshot.review,r.companyId,snapshot.version); requireValue(snapshot.review.reviewedAt <= r.createdAt) }
  const {contentSha256,...body} = snapshot.reconciliation
  requireValue(flags(snapshot.reconciliation) && equal(snapshot.reconciliation.limitations,M75_LIMITATIONS) && snapshot.reconciliation.companyId === r.companyId && snapshot.reconciliation.rosterPin?.id === snapshot.version.id && snapshot.reconciliation.rosterPin.sha256 === snapshot.version.versionSha256 && await hash(body) === contentSha256)
  return snapshot
}
async function verifyBoundCoverage(proof:M75Register['proof'],version:M75Version|null,companyId:string) {
  const coverage = proof.boundCoverageVersion
  if (!version) { requireValue(coverage === null); return }
  requireValue(coverage !== null)
  await decodeCorporateVersion(coverage,companyId)
  requireValue(coverage!.id === version.activity.coverageVersionId && coverage!.versionSha256 === version.activity.coverageVersionSha256)
  requireValue(equal(version.findings,deriveM75RosterFindings(version.activity,coverage!)))
  if (version.statement) requireValue(version.statement.text === m75StatementText(version.activity,coverage!))
}
async function verifyReportProof(text:string,r:M75ReportMetadata,snapshot:Parameters<typeof m75RenderReport>[0]) {
  const raw = parseM71Json(text,M75_MAX_RESPONSE_BYTES); m71Keys(raw,['reportId','proof']); requireValue(raw.reportId === r.id)
  const proof = raw.proof as M75Register['proof']; m71Keys(proof,['coverageVersion','boundCoverageVersion','workpaperVersions'])
  requireValue(Array.isArray(proof.workpaperVersions) && proof.workpaperVersions.length <= 3)
  if (proof.coverageVersion) await decodeCorporateVersion(proof.coverageVersion,r.companyId)
  const streams = new Set<string>(), sources = new Set<string>(), assets = new Set<string>()
  for (const v of proof.workpaperVersions) { await decodeMobileVersion(v,r.companyId); requireValue(!streams.has(v.worksheetId) && !sources.has(v.activity.binding.sourceId) && !assets.has(v.activity.vehicle.assetId)); streams.add(v.worksheetId); sources.add(v.activity.binding.sourceId); assets.add(v.activity.vehicle.assetId) }
  await verifyBoundCoverage(proof,snapshot.version,r.companyId)
  const expected = await deriveWithHashes(hasher => deriveM75ReconciliationFromProof(r.companyId,proof,snapshot.version,snapshot.review ? [snapshot.review] : [],hasher))
  requireValue(equal(expected,snapshot.reconciliation))
}
export async function fleetReportDownload(a:HostedWorkspaceActor,c:string,r:M75ReportMetadata) { reportMetadata(r,c); const snapshotText = await fleetReportSnapshotDownload(a,c,r), snapshot = await decodeReportSnapshot(snapshotText,r); const text = await request(a,c,`/${pathId(r.rosterId)}/reports/${pathId(r.id)}/download`); requireValue(await coverageSha256(text) === r.htmlSha256 && new TextEncoder().encode(text).length === r.htmlByteLength && text === m75RenderReport(snapshot)); return text }
export async function fleetReportSnapshotDownload(a:HostedWorkspaceActor,c:string,r:M75ReportMetadata) { reportMetadata(r,c); const text = await request(a,c,`/${pathId(r.rosterId)}/reports/${pathId(r.id)}/snapshot`); requireValue(await coverageSha256(text) === r.snapshotSha256); const snapshot=await decodeReportSnapshot(text,r); await verifyReportProof(await request(a,c,`/${pathId(r.rosterId)}/reports/${pathId(r.id)}/proof`),r,snapshot); return text }
