import { useCallback, useEffect, useRef, useState } from "react"
import { Icon } from "../Icon"
import { Scope3ReportSection } from "../Scope3Results"
import { groupDigits, periodLabel } from "@/lib/plain-language"
import { approveScope3Report, loadScope3ReportVersion, loadScope3Reports, prepareScope3Report, Scope3ReportApiError, scope3ReportCsvName, scope3ReportExportCsv, scope3StoredStatementLines, SCOPE3_REPORT_PROFILE_V1, type Scope3ApprovalConfirmations, type Scope3ApprovalR2, type Scope3FrozenReport, type Scope3ReportsView, type Scope3ReportVersionSummary } from "@/lib/scope3-report-api"
import { SCOPE3_STATUS_TEXT, type Scope3ResultsResponse } from "@/lib/scope3-results-api"
import { scope3FrozenOpenIssues, scope3IssueOf, scope3LiveOpenIssues, scope3Tonnes } from "@/lib/scope3-checklist"
import { scope3Sentence } from "@/lib/scope3-display-r3d"
import { SCOPE3_FROZEN_TEXT_R3D, SCOPE3_STATUS_TEXT_R3D } from "@/lib/scope3-text-r3d"
import { SCOPE3_READINESS_TEXT } from "@/lib/scope3-results-text"
import { scope3ChangeLogLines } from "@/lib/scope3-change-log"
import { formatTimeR2E } from "../../../../../packages/neuvetra-database/src/scope3-text-r2e"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"

/**
 * Frozen Scope 3 report versions on the Results screen (Scope 3 completion I-10; Claude, 30 October 2026; DESIGN 7.4, 3.7;
 * assurance-ux M8). Lists the reporting year's versions (revision, who prepared it and when, why, approval, self-approval,
 * report SHA-256), prepares the next version from the live results (a reason is required after the first), and opens a
 * stored version read-only: its assertion, base-year statement and change log, and the frozen Scope 3 section rendered
 * from the stored report text. The CSV download and print of an opened version serve the stored bytes. Approve sends the
 * report SHA-256 shown on the opened version.
 */
/** WO-11: approval here is internal to the company, not external assurance. */
export const APPROVAL_HEADING = "Internal approval (by your company — not external assurance)"
const who = (id: string, actorId: string) => id === actorId ? "you" : `user ${id.slice(0, 8)}`
// Round 2 polish (lane D): one time format with the Activity and setup screens, `YYYY-MM-DD HH:MM UTC` (lane E's helper).
const when = (iso: string) => formatTimeR2E(iso)
const approvalOf = (version: Scope3ReportVersionSummary) => version.approval as Scope3ApprovalR2 | null

/** The version history table: who prepared each version, when and why, and who approved it when. */
export function Scope3ReportHistory({ versions, actorId, onOpen }: { versions: Scope3ReportVersionSummary[]; actorId: string; onOpen: (id: string) => void }) {
  if (versions.length === 0) return <p className="nv-muted">No report version has been prepared for this reporting year yet.</p>
  return <div className="nv-report__scroll" role="region" aria-label="Report versions table" tabIndex={0}><table><thead><tr><th>Revision</th><th>Prepared</th><th>Why</th><th>{APPROVAL_HEADING}</th><th>Report SHA-256</th><th /></tr></thead><tbody>
    {[...versions].reverse().map(v => <tr key={v.id}>
      <td>{v.revision}</td>
      <td title={v.createdBy}>by {who(v.createdBy, actorId)} · {when(v.createdAt)}</td>
      <td>{v.reason ?? "First version"}</td>
      <td title={v.approval?.approvedBy}>{v.approval ? <>Approved by {who(v.approval.approvedBy, actorId)} · {when(v.approval.approvedAt)}{v.approval.selfApproved ? <span className="nv-chip nv-chip--warn" style={{ marginLeft: 6 }} title={SCOPE3_READINESS_TEXT.controlException}>{SCOPE3_READINESS_TEXT.controlExceptionChip}</span> : null}{(approvalOf(v)?.acknowledgedOpenIssues?.length ?? 0) > 0 ? <span className="nv-chip nv-chip--warn" style={{ marginLeft: 6 }}>{SCOPE3_READINESS_TEXT.acknowledged(approvalOf(v)!.acknowledgedOpenIssues!.length).replace(/:$/, "")}</span> : null}</> : "Not approved"}</td>
      <td className="worksheet-fingerprint" title={v.reportSha256}>{v.reportSha256.slice(0, 12)}…</td>
      <td><button type="button" className="nv-btn nv-btn--sm" onClick={() => onOpen(v.id)} aria-label={`Open revision ${v.revision}`}>Open</button></td>
    </tr>)}
  </tbody></table></div>
}

/** Preserve the stored CSV prefix and append the separately recorded approval and control exceptions. */
function downloadFrozenCsv(report: Scope3FrozenReport) {
  const url = URL.createObjectURL(new Blob([scope3ReportExportCsv(report.csvText, report.version)], { type: "text/csv" }))
  const link = document.createElement("a"); link.href = url; link.download = scope3ReportCsvName(report.version); link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
/** Prints only the opened frozen version (journey.css hides the live draft report while `data-print` is set). */
function printFrozenReport() {
  document.body.dataset.print = "scope3-frozen"
  window.addEventListener("afterprint", () => { delete document.body.dataset.print }, { once: true })
  window.print()
}

/** One stored version, read-only, rendered from its stored report text. */
export function Scope3FrozenReportView({ report, previous, newestRevision, actorId, canManage, busy, onApprove, onClose }: { report: Scope3FrozenReport; previous?: Scope3FrozenReport["document"] | null; newestRevision?: number; actorId: string; canManage: boolean; busy: boolean; onApprove: (confirmations: Scope3ApprovalConfirmations) => void; onClose: () => void }) {
  const { version, document: d } = report, a = d.assertion
  // Round 2 lane D (decision 7): approving needs the frozen open issues acknowledged and a self-approval confirmed.
  const confirmationKey = `${version.id}:${version.reportSha256}:${actorId}`
  const [confirmed, setConfirmed] = useState({ key: confirmationKey, acknowledged: false, selfConfirmed: false })
  const acknowledged = confirmed.key === confirmationKey && confirmed.acknowledged
  const selfConfirmed = confirmed.key === confirmationKey && confirmed.selfConfirmed
  if (confirmed.key !== confirmationKey) setConfirmed({ key: confirmationKey, acknowledged: false, selfConfirmed: false })
  const confirm = (field: "acknowledged" | "selfConfirmed", value: boolean) => setConfirmed(previous => ({
    ...(previous.key === confirmationKey ? previous : { key: confirmationKey, acknowledged: false, selfConfirmed: false }), [field]: value,
  }))
  const issues = scope3FrozenOpenIssues(report), self = version.createdBy === actorId, approval = approvalOf(version)
  // Bug hunt D: a v1 document predates the readiness gate (its stored open issues are empty, not "ready").
  const readinessRecorded = d.profile !== SCOPE3_REPORT_PROFILE_V1
  // BF-05: only the year's newest revision can be approved (the server refuses a superseded one). Without the year's
  // newest revision the version is treated as the newest, so a caller that does not know it changes nothing.
  const newest = newestRevision ?? version.revision
  const superseded = version.revision < newest
  const canApprove = canManage && !version.approval && version.revision === newest
  const approveReady = (!issues.length || acknowledged) && (!self || selfConfirmed)
  const approveLabel = self ? SCOPE3_READINESS_TEXT.approveSelf : issues.length ? SCOPE3_READINESS_TEXT.approveWithIssues : SCOPE3_READINESS_TEXT.approve
  // Round 2 polish (lane D, UX-7): the change log names records by activity, source ID and description, and methods by
  // title (from this version's and the previous approved version's stored results); never a raw id. Display only.
  const changes = scope3ChangeLogLines(d, previous ?? null)
  return <div className="nv-card nv-card--flat" style={{ marginTop: 12 }}>
    <div className="nv-notice nv-notice--info" role="status"><Icon name="info" /><p><strong>Frozen report version {version.revision} ({version.reportingYear}), read-only.</strong> Prepared by {who(version.createdBy, actorId)} on {when(version.createdAt)}{version.reason ? ` — ${version.reason}` : ""}. Later record changes never alter it. Report SHA-256 <span className="worksheet-fingerprint">{version.reportSha256}</span>.
      {" "}{version.approval ? `Approved by ${who(version.approval.approvedBy, actorId)} on ${when(version.approval.approvedAt)}${version.approval.selfApproved ? " (self-approved: the preparer approved their own version)" : ""}.` : "Not approved yet."}{superseded ? ` Superseded by revision ${newest}${version.approval ? "; this approval was recorded before the newer revision existed and stays on record." : ", so it can no longer be approved. Review and approve the newest version."}` : ""}</p></div>
    <div className="nv-actions" style={{ margin: "10px 0" }}>
      <button type="button" className="nv-btn nv-btn--sm" onClick={() => downloadFrozenCsv(report)}><Icon name="download" size={16} />Download this version’s CSV</button>
      <button type="button" className="nv-btn nv-btn--sm" onClick={printFrozenReport}><Icon name="print" size={16} />Print this version</button>
      {canApprove && <button type="button" className="nv-btn nv-btn--sm nv-btn--primary" disabled={busy || !approveReady} aria-describedby="scope3-approval-gate" onClick={() => onApprove({ acknowledgeOpenIssues: issues.length > 0 && acknowledged, confirmSelfApproval: self && selfConfirmed })}>{approveLabel}</button>}
      <button type="button" className="nv-btn nv-btn--sm nv-btn--ghost" onClick={onClose}>Close</button>
    </div>
    {canApprove && <div className="s3-readiness" id="scope3-approval-gate">
      {issues.length > 0 && <label className="s3-confirm"><input type="checkbox" checked={acknowledged} onChange={event => confirm("acknowledged", event.target.checked)} /><span>{SCOPE3_READINESS_TEXT.acknowledge(issues.length)}</span></label>}
      {self && <label className="s3-confirm"><input type="checkbox" checked={selfConfirmed} onChange={event => confirm("selfConfirmed", event.target.checked)} /><span>{SCOPE3_READINESS_TEXT.selfConfirm}</span></label>}
      {!approveReady && <p className="nv-muted" role="status">{issues.length && !acknowledged ? SCOPE3_READINESS_TEXT.acknowledgeRequired : SCOPE3_READINESS_TEXT.selfConfirmRequired}</p>}
    </div>}
    <article className="nv-report nv-report--frozen" aria-label={`Frozen Scope 3 report version ${version.revision}`}>
      <h3>Scope 3 report · reporting year {d.reportingYear} · revision {d.revision} (frozen)</h3>
      <p className="nv-report__small">Report SHA-256 {version.reportSha256} · CSV SHA-256 {version.csvSha256}. {version.approval ? `Approved by ${who(version.approval.approvedBy, actorId)} on ${when(version.approval.approvedAt)}${version.approval.selfApproved ? " (self-approved)" : ""}.` : "Not approved."}</p>
      <h4>Assertion</h4>
      {/* Round 3 lane D (PR-9): each stored part ends with one period ("… Inc." never "… Inc.."); the stored values are shown as stored. */}
      <p className="nv-report__small">{[scope3Sentence(a.statement), scope3Sentence(`Criteria: ${a.criteria}`), scope3Sentence(`Company: ${a.legalName || "not set"}`), scope3Sentence(`Consolidation approach: ${a.consolidationApproach?.replace(/_/g, " ") ?? "not set"}`), `Reporting period: ${periodLabel(a.reportingPeriod.start, a.reportingPeriod.endExclusive)} (reporting year ${a.reportingYear}).`, `Prepared by ${who(a.preparedBy, actorId)} at ${when(a.preparedAt)}.`].join(" ")}</p>
      {/* Round 3 lane D (PR-9, EN-4): t to 2 decimals as on the live screen, from the stored exact kg (shown beside it). */}
      <div className="nv-report__scroll" role="region" aria-label={`Version ${version.revision}: Scope 3 totals by category table`} tabIndex={0}><table><thead><tr><th>Category</th><th>Status</th><th className="nv-right">{SCOPE3_FROZEN_TEXT_R3D.tonnesHeading}</th><th className="nv-right">{SCOPE3_FROZEN_TEXT_R3D.kgHeading}</th></tr></thead><tbody>
        {a.totals.map(row => <tr key={row.category}><td>{row.category}. {row.title}</td><td>{SCOPE3_STATUS_TEXT_R3D[row.status] ?? (SCOPE3_STATUS_TEXT as Readonly<Record<string, string>>)[row.status] ?? row.status.replace(/_/g, " ")}</td><td className="nv-right">{row.subtotalKg ? scope3Tonnes(row.subtotalKg) : "—"}</td><td className="nv-right">{row.subtotalKg ? groupDigits(row.subtotalKg) : "—"}</td></tr>)}
      </tbody></table></div>
      <p className="nv-report__small">Known-source subtotal ({a.totalLabel}): {a.knownSourceSubtotal ? `${scope3Tonnes(a.knownSourceSubtotal.kg)} t CO2e (${groupDigits(a.knownSourceSubtotal.kg)} kg CO2e)` : "nothing calculated"}.</p>
      <p className="nv-report__small">{d.baseYear.statement}</p>
      {/* Round 2 lane D (decision 7; ACC-10): the readiness frozen with this version and how it was approved, printed with it. */}
      <h4>{SCOPE3_READINESS_TEXT.frozenHeading}</h4>
      {issues.length ? <ul>{issues.map(issue => <li key={issue.key} className="nv-report__small">{issue.text}</li>)}</ul> : <p className="nv-report__small">{readinessRecorded ? SCOPE3_READINESS_TEXT.ready : SCOPE3_READINESS_TEXT.notRecorded}</p>}
      {approval && <p className="nv-report__small">{approval.acknowledgedOpenIssues?.length ? `${SCOPE3_READINESS_TEXT.acknowledged(approval.acknowledgedOpenIssues.length)} ${approval.acknowledgedOpenIssues.map(issue => scope3IssueOf(issue).text).join(" ")}` : issues.length ? "" : readinessRecorded ? SCOPE3_READINESS_TEXT.approvedReady : SCOPE3_READINESS_TEXT.approvedNotRecorded}{approval.selfApproved ? ` ${SCOPE3_READINESS_TEXT.controlException}.` : ""}</p>}
      <h4>Changes since the previous approved version</h4>
      <ul>{changes.map((line, i) => <li key={i} className="nv-report__small">{line}</li>)}</ul>
      <Scope3ReportSection results={d.results} frozen statements={scope3StoredStatementLines(report.csvText)} />
    </article>
  </div>
}

/** The report-version panel under the Scope 3 results. */
export function Scope3ReportVersions({ companyId, actor, results }: { companyId: string; actor: HostedWorkspaceActor; results?: Scope3ResultsResponse | null }) {
  const [view, setView] = useState<Scope3ReportsView | null>(null)
  const [open, setOpenReport] = useState<Scope3FrozenReport | null>(null)
  // Round 2 polish (lane D, UX-7): the previous approved version's stored document names removed records and methods.
  const [previous, setPrevious] = useState<Scope3FrozenReport["document"] | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  // Bug hunt C (C-04): a failed list read says so with a way to read it again (it used to need leaving the screen).
  const [listFailed, setListFailed] = useState(false)
  const key = useRef<string | null>(null)
  // Bug hunt C (C-05): only the version asked for last is shown (a slower earlier answer, or its previous version, is dropped).
  const openRequest = useRef(0)
  const actorRef = useRef(actor)
  useEffect(() => { actorRef.current = actor }, [actor])
  const load = useCallback(async () => {
    try { setView(await loadScope3Reports(companyId, actorRef.current)); setUnavailable(false); setListFailed(false) }
    catch (cause) { if (cause instanceof Scope3ReportApiError && cause.unavailable) setUnavailable(true); else { setListFailed(true); setMessage(cause instanceof Error ? cause.message : "Scope 3 report versions are unavailable right now.") } }
  }, [companyId])
  useEffect(() => { void load() }, [load])
  const run = async (step: () => Promise<void>) => { setBusy(true); setMessage(null); try { await step() } catch (cause) { setMessage(cause instanceof Error ? cause.message : "That didn’t work. Try again.") } finally { setBusy(false) } }
  if (unavailable) return null
  const versions = view?.versions ?? [], next = versions.length, needsReason = next > 0
  // Shown only where a version can be prepared and something is screened ("ready" would mislead an empty company).
  const live = results && view?.reportingYear != null && results.coverage.categories.some(row => row.status !== "not_screened") ? scope3LiveOpenIssues(results) : null
  /** Shows the version `read` returns (null closes it), unless another version was asked for in the meantime. */
  const setOpen = async (read: () => Promise<Scope3FrozenReport | null>, request = ++openRequest.current) => {
    if (request !== openRequest.current) return
    const report = await read()
    if (request !== openRequest.current) return
    setOpenReport(report); setPrevious(null)
    const before = report?.document.changeLog.previous
    if (!report || !before) return
    try { const loaded = await loadScope3ReportVersion(companyId, before.versionId, actorRef.current); if (request === openRequest.current) setPrevious(loaded.document) } catch { /* the log still names what this version holds */ }
  }
  const prepare = () => run(async () => {
    const request = ++openRequest.current
    if (needsReason && reason.trim().length < 3) throw new Error("Say why this version replaces the earlier one (at least 3 characters).")
    key.current ??= crypto.randomUUID()
    const saved = await prepareScope3Report(companyId, { idempotencyKey: key.current, expectedRevision: next, reason: needsReason ? reason : null }, actorRef.current)
    key.current = null; setReason("")
    await load()
    await setOpen(() => loadScope3ReportVersion(companyId, saved.version.id, actorRef.current), request)
  })
  const openVersion = (id: string) => run(async () => { await setOpen(() => loadScope3ReportVersion(companyId, id, actorRef.current)) })
  const approve = (confirmations: Scope3ApprovalConfirmations) => run(async () => {
    if (!open) return
    const request = ++openRequest.current
    await approveScope3Report(companyId, open.version.id, open.version.reportSha256, actorRef.current, confirmations)
    await load()
    await setOpen(() => loadScope3ReportVersion(companyId, open.version.id, actorRef.current), request)
  })
  return <section aria-labelledby="scope3-report-versions" style={{ marginTop: 18 }}>
    <h3 className="nv-h3" id="scope3-report-versions">Report versions{view?.reportingYear ? ` · reporting year ${view.reportingYear}` : ""}</h3>
    <p className="nv-muted">A report version freezes these Scope 3 results, with an assertion and a change log, as exact bytes with a SHA-256. Approving binds the approval to that hash. Later record changes never alter a stored version.</p>
    {message && <div className="nv-notice nv-notice--error" role="alert"><Icon name="alert" /><div><p>{message}</p>
      {listFailed && <div className="nv-actions" style={{ marginTop: 10 }}><button type="button" className="nv-btn nv-btn--sm" onClick={() => { setMessage(null); void load() }}>Try again</button></div>}</div></div>}
    {view && view.reportingYear === null && <p className="nv-muted">Save company setup with a reporting period before preparing a report version.</p>}
    {/* Round 2 lane D (UX-10): the live readiness before preparing; preparing a draft is always allowed. */}
    {live && <div className={`nv-notice ${live.length ? "nv-notice--warn" : "nv-notice--info"} s3-readiness`} role="status"><Icon name={live.length ? "alert" : "info"} /><div>
      <p><strong>{SCOPE3_READINESS_TEXT.heading}.</strong> {live.length ? SCOPE3_READINESS_TEXT.notReady(live.length) : SCOPE3_READINESS_TEXT.ready}</p>
      {live.length > 0 && <ul>{live.map(issue => <li key={issue.key}>{issue.text}</li>)}</ul>}
      <p className="nv-muted">{SCOPE3_READINESS_TEXT.liveNote}</p></div></div>}
    {view && view.canManage && view.reportingYear !== null && <div className="nv-actions" style={{ alignItems: "flex-end", margin: "8px 0" }}>
      {needsReason && <label style={{ flex: 1 }}>Why a new version?<textarea aria-label="Why a new version?" value={reason} maxLength={2000} rows={2} onChange={event => setReason(event.target.value)} /></label>}
      <button type="button" className="nv-btn nv-btn--sm nv-btn--primary" disabled={busy} onClick={() => void prepare()}>{busy ? "Working…" : "Prepare report version"}</button>
    </div>}
    {view && <Scope3ReportHistory versions={versions} actorId={view.actorId} onOpen={id => void openVersion(id)} />}
    {open && view && <Scope3FrozenReportView report={open} previous={previous} actorId={view.actorId} canManage={view.canManage} busy={busy} newestRevision={Math.max(0, ...versions.map(item => item.revision))} onApprove={confirmations => void approve(confirmations)} onClose={() => void setOpen(async () => null)} />}
  </section>
}
