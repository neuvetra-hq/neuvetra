import type { HostedWorkspaceActor } from './workspace-api'
import { coverageSha256, decodeCorporateVersion } from './m71-api'
import { decodeGasVersion } from './m73-api'
import { decodeGeneratorVersion } from './m76-diesel-api'
import { m71HashString, m71Keys, m71Uuid, parseM71Json } from '../../../../packages/neuvetra-database/src/m71-validation'
import { M76_PROFILE, M76_LIMITATIONS, M76_MAX_RESPONSE_BYTES, M76_MAX_VERSIONS, M76_MAX_REPORTS, type M76Dependencies, type M76Version, type M76Review, type M76Register, type M76ReportMetadata, type M76Report, type M76SaveInput, type M76ReviewInput, type M76ReportInput, type M76Finding } from '../../../../packages/neuvetra-database/src/m76-contract'
import { m76CanonicalJson, m76Activity, validateM76Save, validateM76Review, m76DependencyPayload, m76InputPayload, m76ContentPayload, m76VersionHashPayload, m76ReviewHashPayload, m76ReportHashPayload, m76Export, m76StatementText, deriveM76RosterFindings, deriveM76ReconciliationFromProof } from '../../../../packages/neuvetra-database/src/m76-validation'
import { m76RenderReport } from '../../../../packages/neuvetra-database/src/m76-report'

const fail = (): never => { throw new Error('The stationary record could not be verified. Refresh before continuing.') }
const requireValue = (value: unknown) => { if (!value) fail() }
const equal = (a: unknown, b: unknown) => m76CanonicalJson(a) === m76CanonicalJson(b)
const hash = (value: unknown) => coverageSha256(m76CanonicalJson(value))
const instant = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v
const flags = (v: M76Version | M76Register['reconciliation']) => v.synthetic === true && v.scope1Completeness === 'incomplete' && v.corporateCompleteness === 'incomplete' && v.releaseEligible === false && v.assurance === 'none' && v.emissionsTotals === null
const bounded = (v: unknown, max = 2000): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && v === v.trim()
const versionKeys = ['id','companyId','rosterId','version','previousVersionId','previousVersionSha256','createdBy','createdAt','contributorIds','correctionReason','activity','dependencies','statement','findings','inputSha256','contentSha256','versionSha256','synthetic','scope1Completeness','corporateCompleteness','releaseEligible','assurance','emissionsTotals']
const reportKeys = ['id','companyId','rosterId','rosterVersionId','createdBy','createdAt','rendererVersion','snapshotSha256','htmlSha256','htmlByteLength','reportSha256']

function pin(v: unknown) { if (v === null) return; m71Keys(v, ['id','sha256']); requireValue(m71Uuid(v.id) && m71HashString(v.sha256)) }
function findings(v: unknown): asserts v is M76Finding[] {
  requireValue(Array.isArray(v))
  for (const item of v as M76Finding[]) { m71Keys(item, ['code','rowKey','message','blocking']); requireValue(bounded(item.code, 120) && bounded(item.message) && (item.rowKey === null || bounded(item.rowKey, 120)) && typeof item.blocking === 'boolean') }
}
async function dependencies(v: M76Dependencies) {
  m71Keys(v, ['coveragePin','coverageReviewPin','workpaperPins','dependencySha256']); pin(v.coveragePin); pin(v.coverageReviewPin)
  requireValue(Array.isArray(v.workpaperPins) && v.workpaperPins.length <= 4 && (v.coveragePin !== null || v.coverageReviewPin === null))
  const ids = new Set<string>()
  for (const row of v.workpaperPins) {
    m71Keys(row, ['family','worksheetId','sourceId','equipmentId','version','decision']); pin(row.version); pin(row.decision)
    requireValue(row.version !== null && m71Uuid(row.worksheetId) && m71Uuid(row.sourceId) && ['natural_gas','stationary_diesel'].includes(row.family) && (row.equipmentId === null ? row.family === 'natural_gas' : /^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(row.equipmentId)) && !ids.has(row.worksheetId)); ids.add(row.worksheetId)
  }
  requireValue(v.workpaperPins.filter(p=>p.family==='natural_gas').length <= 3 && v.workpaperPins.filter(p=>p.family==='stationary_diesel').length <= 1)
  requireValue(equal(v.workpaperPins, [...v.workpaperPins].sort((a,b)=>a.family.localeCompare(b.family)||a.worksheetId.localeCompare(b.worksheetId))) && await hash(m76DependencyPayload(v)) === v.dependencySha256)
}

/** Shared derivation is pure and synchronous. Resolve its bounded hash inputs
 * with Web Crypto, then replay it; no browser-only accounting implementation. */
async function deriveWithHashes<T>(derive: (hasher: (value: unknown) => string) => T): Promise<T> {
  const cache = new Map<string, string>()
  class MissingDigest { constructor(readonly text: string) {} }
  for (let i = 0; i < 16; i++) {
    try { return derive(value => { const text = m76CanonicalJson(value), digest = cache.get(text); if (digest === undefined) throw new MissingDigest(text); return digest }) }
    catch (error) { if (!(error instanceof MissingDigest)) throw error; cache.set(error.text, await coverageSha256(error.text)) }
  }
  return fail()
}

export async function decodeStationaryVersion(raw: unknown, companyId: string, previous?: M76Version): Promise<M76Version> {
  try {
    m71Keys(raw, versionKeys); const v = raw as unknown as M76Version
    requireValue(m71Uuid(companyId) && v.companyId === companyId && [v.id,v.rosterId,v.createdBy].every(m71Uuid) && instant(v.createdAt) && flags(v) && Number.isInteger(v.version) && v.version >= 1 && v.version <= M76_MAX_VERSIONS)
    requireValue(Array.isArray(v.contributorIds) && v.contributorIds.every(m71Uuid) && equal(v.contributorIds,[...new Set(v.contributorIds)].sort()) && v.contributorIds.includes(v.createdBy))
    if (previous) requireValue(v.rosterId === previous.rosterId && v.version === previous.version + 1 && v.previousVersionId === previous.id && v.previousVersionSha256 === previous.versionSha256 && v.createdAt >= previous.createdAt && previous.contributorIds.every(id => v.contributorIds.includes(id)))
    if (v.version === 1) requireValue(v.previousVersionId === null && v.previousVersionSha256 === null && v.correctionReason === null)
    else requireValue(m71Uuid(v.previousVersionId) && m71HashString(v.previousVersionSha256) && bounded(v.correctionReason, 500))
    await dependencies(v.dependencies)
    const normalized = validateM76Save({ ...v.activity, expectedDependencySha256: v.dependencies.dependencySha256, expectedVersionId: v.previousVersionId, expectedVersionSha256: v.previousVersionSha256, correctionReason: v.correctionReason, idempotencyKey: v.id })
    requireValue(equal(m76Activity(normalized), v.activity) && v.dependencies.coveragePin?.id === v.activity.coverageVersionId && v.dependencies.coveragePin.sha256 === v.activity.coverageVersionSha256)
    if (previous?.activity.rosterStatement) requireValue(v.activity.rosterStatement !== null && previous.activity.rosterStatement.assets.every(old => v.activity.rosterStatement!.assets.some(row => row.rowId === old.rowId)))
    findings(v.findings)
    if (v.statement === null) requireValue(v.activity.rosterStatement === null)
    else {
      const s = v.statement; m71Keys(s, ['id','profile','input','locator','text','sha256','byteLength'])
      requireValue(m71Uuid(s.id) && s.profile === 'm76-synthetic-equipment-statement-v1' && equal(s.input, v.activity.rosterStatement) && s.locator === `m76-equipment-statement:${s.id}:declared-equipment` && typeof s.text === 'string' && s.byteLength === new TextEncoder().encode(s.text).length && s.sha256 === await coverageSha256(s.text))
      const prefix = 'SYNTHETIC — NOT AN ORIGINAL COMPANY EQUIPMENT REGISTER OR INDEPENDENT MEASUREMENT\n'
      requireValue(s.text.startsWith(prefix) && s.text.endsWith('\n'))
      const parsed = parseM71Json(s.text.slice(prefix.length).trim(), 100000)
      m71Keys(parsed, ['profile','companyLabel','coverageVersionId','coverageVersionSha256','period','statement'])
      requireValue(parsed.profile === s.profile && bounded(parsed.companyLabel) && parsed.coverageVersionId === v.activity.coverageVersionId && parsed.coverageVersionSha256 === v.activity.coverageVersionSha256 && equal(parsed.period,v.activity.period) && equal(parsed.statement,s.input) && s.text === prefix + m76CanonicalJson(parsed) + '\n')
    }
    requireValue(await hash(m76InputPayload(v)) === v.inputSha256 && await hash(m76ContentPayload(v)) === v.contentSha256 && await hash(m76VersionHashPayload(v)) === v.versionSha256)
    return v
  } catch { return fail() }
}

export async function decodeStationaryReview(raw: unknown, companyId: string, version?: M76Version): Promise<M76Review> {
  try {
    m71Keys(raw, ['id','versionId','versionSha256','dependencies','decision','note','acknowledgedLimitations','reviewerId','reviewedAt','decisionSha256']); const r = raw as unknown as M76Review
    requireValue(m71Uuid(r.id) && m71Uuid(r.reviewerId) && instant(r.reviewedAt)); await dependencies(r.dependencies)
    validateM76Review({ versionId:r.versionId, expectedVersionSha256:r.versionSha256, expectedDependencySha256:r.dependencies.dependencySha256, decision:r.decision, note:r.note, acknowledgedLimitations:r.acknowledgedLimitations, idempotencyKey:r.id })
    if (version) requireValue(r.versionId === version.id && r.versionSha256 === version.versionSha256 && equal(r.dependencies,version.dependencies) && !version.contributorIds.includes(r.reviewerId) && r.reviewedAt >= version.createdAt)
    requireValue(await hash(m76ReviewHashPayload(companyId,r)) === r.decisionSha256); return r
  } catch { return fail() }
}

function reportMetadata(raw: unknown, companyId: string): M76ReportMetadata {
  m71Keys(raw, reportKeys); const r = raw as unknown as M76ReportMetadata
  requireValue(r.companyId === companyId && [r.id,r.rosterId,r.rosterVersionId,r.createdBy].every(m71Uuid) && instant(r.createdAt) && r.rendererVersion === 'm76-stationary-reconciliation-report-v1' && [r.snapshotSha256,r.htmlSha256,r.reportSha256].every(m71HashString) && Number.isInteger(r.htmlByteLength) && r.htmlByteLength > 0 && r.htmlByteLength <= 131072)
  return r
}

export async function decodeStationaryRegister(raw: unknown, companyId: string): Promise<M76Register> {
  try {
    m71Keys(raw, ['profile','companyId','rosterId','headVersionId','versions','reviews','reports','proof','reconciliation','limitations']); const r = raw as unknown as M76Register
    requireValue(r.profile === M76_PROFILE && r.companyId === companyId && m71Uuid(companyId) && equal(r.limitations,M76_LIMITATIONS) && Array.isArray(r.versions) && r.versions.length <= M76_MAX_VERSIONS && Array.isArray(r.reviews) && r.reviews.length <= r.versions.length && Array.isArray(r.reports) && r.reports.length <= M76_MAX_REPORTS)
    const ids = new Set<string>(); let prior: M76Version | undefined
    for (const v of r.versions) { requireValue(!ids.has(v.id) && v.version === (prior?.version ?? 0) + 1 && v.rosterId === r.rosterId); await decodeStationaryVersion(v,companyId,prior); ids.add(v.id); prior = v }
    requireValue(r.headVersionId === (prior?.id ?? null) && (prior ? m71Uuid(r.rosterId) : r.rosterId === null))
    const reviewed = new Set<string>(), reviewIds = new Set<string>()
    for (const review of r.reviews) { const version = r.versions.find(v => v.id === review.versionId); requireValue(version && !reviewed.has(review.versionId) && !reviewIds.has(review.id)); await decodeStationaryReview(review,companyId,version); reviewed.add(review.versionId); reviewIds.add(review.id) }
    const reportIds = new Set<string>()
    for (const report of r.reports) { reportMetadata(report,companyId); const version = r.versions.find(v => v.id === report.rosterVersionId); requireValue(version && report.rosterId === r.rosterId && !reportIds.has(report.id) && report.createdAt >= version!.createdAt && await hash(m76ReportHashPayload({...report,snapshotJson:'',html:''})) === report.reportSha256); reportIds.add(report.id) }
    await verifyWorkpapers(r.proof,companyId)
    await verifyBoundCoverage(r.proof, prior ?? null, companyId)
    const expected = await deriveWithHashes(hasher => deriveM76ReconciliationFromProof(companyId,r.proof,prior ?? null,r.reviews,hasher))
    if (prior && prior.dependencies.dependencySha256 === expected.dependencySha256) {
      const contributors = [...new Set([...(r.versions[r.versions.length - 2]?.contributorIds ?? []),prior.createdBy,...(r.proof.coverageVersion?.contributorIds ?? []),...[...r.proof.gasWorkpaperVersions,...r.proof.dieselWorkpaperVersions].flatMap(v => v.contributorIds)])].sort()
      requireValue(equal(prior.contributorIds,contributors))
    }
    requireValue(equal(expected,r.reconciliation)); return r
  } catch { return fail() }
}

async function request(actor: HostedWorkspaceActor, companyId: string, suffix: string, payload?: unknown): Promise<string> {
  actor.signal?.throwIfAborted(); requireValue(m71Uuid(companyId) && actor.accessToken && !/[\r\n]/.test(actor.accessToken))
  const response = await fetch(`/workspace-api/workspace/${companyId}/stationary-equipment${suffix}`, { method:payload === undefined ? 'GET' : 'POST', headers:{authorization:`Bearer ${actor.accessToken}`, ...(payload === undefined ? {} : {'content-type':'application/json'})}, body:payload === undefined ? undefined : JSON.stringify(payload), signal:actor.signal, cache:'no-store' })
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) { actor.onUnauthorized?.(); throw new Error('Your access changed. Sign in again to continue.') }
  if (!response.ok) throw new Error(response.status === 409 ? 'The roster, corporate boundary or a workpaper changed. Refresh before retrying.' : response.status === 422 ? 'Check the roster facts, evidence, confirmations and correction reason. Nothing was saved.' : 'Stationary records are unavailable. Retry the same action or refresh.')
  const text = await response.text(); actor.signal?.throwIfAborted(); requireValue(new TextEncoder().encode(text).length <= M76_MAX_RESPONSE_BYTES); return text
}
const pathId = (id: string) => { requireValue(m71Uuid(id)); return id }
export const stationaryRegisterRequest = async (a:HostedWorkspaceActor,c:string) => decodeStationaryRegister(parseM71Json(await request(a,c,''),M76_MAX_RESPONSE_BYTES),c)
export const stationarySaveRequest = async (a:HostedWorkspaceActor,c:string,id:string|null,input:M76SaveInput) => decodeStationaryVersion(parseM71Json(await request(a,c,id ? `/${pathId(id)}/versions` : '',input),M76_MAX_RESPONSE_BYTES),c)
export const stationaryReviewRequest = async (a:HostedWorkspaceActor,c:string,id:string,input:M76ReviewInput) => decodeStationaryReview(parseM71Json(await request(a,c,`/${pathId(id)}/reviews`,input),M76_MAX_RESPONSE_BYTES),c)
export async function stationaryReportRequest(a:HostedWorkspaceActor,c:string,id:string,input:M76ReportInput): Promise<M76Report> {
  const raw = parseM71Json(await request(a,c,`/${pathId(id)}/reports`,input),M76_MAX_RESPONSE_BYTES)
  m71Keys(raw,[...reportKeys,'snapshotJson','html']); const r = raw as unknown as M76Report, {snapshotJson,html,...metadata} = r
  reportMetadata(metadata,c); requireValue(typeof html === 'string' && typeof snapshotJson === 'string' && await coverageSha256(html) === r.htmlSha256 && new TextEncoder().encode(html).length === r.htmlByteLength && await coverageSha256(snapshotJson) === r.snapshotSha256 && await hash(m76ReportHashPayload(r)) === r.reportSha256)
  const snapshot = await decodeReportSnapshot(snapshotJson,r)
  await verifyReportProof(await request(a,c,`/${pathId(r.rosterId)}/reports/${pathId(r.id)}/proof`),r,snapshot)
  requireValue(snapshot.reconciliation.contentSha256 === input.expectedReconciliationSha256 && html === m76RenderReport(snapshot)); return r
}
export async function stationaryStatementDownload(a:HostedWorkspaceActor,c:string,v:M76Version) { requireValue(v.companyId === c && v.statement); const s = v.statement!; const text = await request(a,c,`/${pathId(v.rosterId)}/statements/${pathId(s.id)}/download`); requireValue(text === s.text && await coverageSha256(text) === s.sha256); return text }
export async function stationaryVersionDownload(a:HostedWorkspaceActor,c:string,v:M76Version) { requireValue(v.companyId === c); const text = await request(a,c,`/${pathId(v.rosterId)}/versions/${pathId(v.id)}/roster-export`); requireValue(text === m76Export(v)); await decodeStationaryVersion(parseM71Json(text,M76_MAX_RESPONSE_BYTES),c); return text }
async function decodeReportSnapshot(text:string,r:M76ReportMetadata) {
  const raw = parseM71Json(text,M76_MAX_RESPONSE_BYTES); m71Keys(raw,['profile','version','review','reconciliation'])
  const snapshot = raw as unknown as Parameters<typeof m76RenderReport>[0]
  requireValue(snapshot.profile === 'm76-stationary-reconciliation-report-v1' && text === m76CanonicalJson(snapshot))
  await decodeStationaryVersion(snapshot.version,r.companyId)
  requireValue(snapshot.version.id === r.rosterVersionId && snapshot.version.rosterId === r.rosterId && snapshot.version.createdAt <= r.createdAt)
  if (snapshot.review) { await decodeStationaryReview(snapshot.review,r.companyId,snapshot.version); requireValue(snapshot.review.reviewedAt <= r.createdAt) }
  const {contentSha256,...body} = snapshot.reconciliation
  requireValue(flags(snapshot.reconciliation) && equal(snapshot.reconciliation.limitations,M76_LIMITATIONS) && snapshot.reconciliation.companyId === r.companyId && snapshot.reconciliation.rosterPin?.id === snapshot.version.id && snapshot.reconciliation.rosterPin.sha256 === snapshot.version.versionSha256 && await hash(body) === contentSha256)
  return snapshot
}
async function verifyWorkpapers(proof:M76Register['proof'], companyId:string) {
  m71Keys(proof,['coverageVersion','boundCoverageVersion','gasWorkpaperVersions','dieselWorkpaperVersions'])
  requireValue(Array.isArray(proof.gasWorkpaperVersions) && proof.gasWorkpaperVersions.length <= 3 && Array.isArray(proof.dieselWorkpaperVersions) && proof.dieselWorkpaperVersions.length <= 1)
  if (proof.coverageVersion) await decodeCorporateVersion(proof.coverageVersion,companyId)
  const streams = new Set<string>(), gasSources = new Set<string>(), dieselSources = new Set<string>()
  for (const v of proof.gasWorkpaperVersions) { await decodeGasVersion(v,companyId); requireValue(!streams.has(v.worksheetId) && !gasSources.has(v.activity.binding.sourceId)); streams.add(v.worksheetId); gasSources.add(v.activity.binding.sourceId) }
  for (const v of proof.dieselWorkpaperVersions) { await decodeGeneratorVersion(v,companyId); requireValue(!streams.has(v.worksheetId) && !dieselSources.has(v.activity.binding.sourceId)); streams.add(v.worksheetId); dieselSources.add(v.activity.binding.sourceId) }
}

async function verifyBoundCoverage(proof:M76Register['proof'],version:M76Version|null,companyId:string) {
  const coverage = proof.boundCoverageVersion
  if (!version) { requireValue(coverage === null); return }
  requireValue(coverage !== null)
  await decodeCorporateVersion(coverage,companyId)
  requireValue(coverage!.id === version.activity.coverageVersionId && coverage!.versionSha256 === version.activity.coverageVersionSha256)
  requireValue(equal(version.findings,deriveM76RosterFindings(version.activity,coverage!)))
  if (version.statement) requireValue(version.statement.text === m76StatementText(version.activity,coverage!))
}
async function verifyReportProof(text:string,r:M76ReportMetadata,snapshot:Parameters<typeof m76RenderReport>[0]) {
  const raw = parseM71Json(text,M76_MAX_RESPONSE_BYTES); m71Keys(raw,['reportId','proof']); requireValue(raw.reportId === r.id)
  const proof = raw.proof as M76Register['proof']; await verifyWorkpapers(proof,r.companyId)
  await verifyBoundCoverage(proof,snapshot.version,r.companyId)
  const expected = await deriveWithHashes(hasher => deriveM76ReconciliationFromProof(r.companyId,proof,snapshot.version,snapshot.review ? [snapshot.review] : [],hasher))
  requireValue(equal(expected,snapshot.reconciliation))
}
export async function stationaryReportDownload(a:HostedWorkspaceActor,c:string,r:M76ReportMetadata) { reportMetadata(r,c); const snapshotText = await stationaryReportSnapshotDownload(a,c,r), snapshot = await decodeReportSnapshot(snapshotText,r); const text = await request(a,c,`/${pathId(r.rosterId)}/reports/${pathId(r.id)}/download`); requireValue(await coverageSha256(text) === r.htmlSha256 && new TextEncoder().encode(text).length === r.htmlByteLength && text === m76RenderReport(snapshot)); return text }
export async function stationaryReportSnapshotDownload(a:HostedWorkspaceActor,c:string,r:M76ReportMetadata) { reportMetadata(r,c); const text = await request(a,c,`/${pathId(r.rosterId)}/reports/${pathId(r.id)}/snapshot`); requireValue(await coverageSha256(text) === r.snapshotSha256); const snapshot=await decodeReportSnapshot(text,r); await verifyReportProof(await request(a,c,`/${pathId(r.rosterId)}/reports/${pathId(r.id)}/proof`),r,snapshot); return text }
