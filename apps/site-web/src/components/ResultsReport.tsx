import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { Icon } from "./Icon"
import type { JourneyView } from "./JourneyNav"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import { coverageIssues, coverageLines, noteLabel, type Coverage } from "@/lib/journey-status"
import { DRAFT_LABEL, loadResults, ResultsApiError, resultsCsv, type EngineGas, type ResultRow, type ResultsResponse } from "@/lib/results-api"
import { ACTIVITY_KINDS, BOUNDARY_LABELS, groupDigits, kgToTonnes, kindIcon, kindLabel, periodLabel, QUALITY_LABELS, reasonText, shortUnit } from "@/lib/plain-language"
import { factorSource, GAS_LABELS, KIND_COLORS, needsWork, rowReasons, rowStatus } from "@/lib/results-view"

const rowKg = (row: ResultRow) => row.scope1?.total?.display ?? row.scope2?.locationBased.total?.display ?? null
const QUALITY = QUALITY_LABELS
const evidenceText = (row: ResultRow) => row.evidence.length ? row.evidence.map(file => `${file.name ?? "Unnamed file"}${file.sha256 ? ` · ${file.sha256.slice(0, 10)}` : ""}${file.status === "clean" ? "" : ` (${file.status === "pending" ? "scan pending" : file.status})`}`).join("; ") : "None linked"
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

function Gases({ gases }: { gases: Record<string, EngineGas> | null }) {
  if (!gases) return <>Not calculated</>
  return <>{Object.entries(gases).map(([gas, value]) => <span key={gas} style={{ display: "block" }}>{GAS_LABELS[gas] ?? gas}: {groupDigits(value.mass)} {value.massUnit} → {groupDigits(value.co2e)} kg CO2e</span>)}</>
}

function RowDetail({ row }: { row: ResultRow }) {
  const s1 = row.scope1, s2 = row.scope2
  const factors = s1?.factorsUsed ?? s2?.factorsUsed ?? []
  return <details className="nv-detail"><summary>How this was calculated</summary><dl>
    <dt>Method</dt><dd>{s1?.methodVersionId ?? s2?.methodVersionId ?? "Not calculated"}</dd>
    {s1 && <><dt>Gases</dt><dd><Gases gases={s1.gases} />{s1.missingGases.length > 0 && <span style={{ display: "block" }}>Missing: {s1.missingGases.map(gas => GAS_LABELS[gas] ?? gas).join(", ")}</span>}</dd></>}
    {s2 && <><dt>Electricity</dt><dd>{groupDigits(s2.activity.mwh)} MWh · eGRID subregion {s2.activity.subregion}</dd>
      <dt>Location-based</dt><dd><Gases gases={s2.locationBased.gases} /></dd>
      <dt>Market-based</dt><dd>{s2.marketBased.total ? <Gases gases={s2.marketBased.gases} /> : "Not calculated — see the notes"}{s2.marketBased.residualMix && <span className="nv-subtle" style={{ display: "block" }}>Uncovered {groupDigits(s2.marketBased.residualMix.mwh)} MWh at the residual mix: {s2.marketBased.residualMix.method}.</span>}</dd></>}
    {factors.length > 0 && <><dt>Factors used</dt><dd>{factors.map(factor => <span key={factor.key} style={{ display: "block" }}>{factor.label}: {groupDigits(factor.value)} {factor.unit} <span className="nv-subtle">({factorSource(factor.key)}, cell {factor.cell})</span></span>)}</dd></>}
    <dt>GWP set</dt><dd>{s1?.gwpSetId ?? s2?.gwpSetId ?? "—"} (IPCC AR5, 100-year)</dd>
    <dt>Evidence</dt><dd>{evidenceText(row)}</dd>
    <dt>Record</dt><dd>Version {row.revision} · data quality {QUALITY[row.quality] ?? row.quality}{row.estimateBasis ? ` (${row.estimateBasis})` : ""}</dd>
    {(s1?.resultSha256 || s2?.resultSha256) && <><dt>Result fingerprint</dt><dd className="nv-subtle" style={{ fontFamily: "monospace", fontSize: ".8rem" }}>{s1?.resultSha256 ?? s2?.resultSha256}</dd></>}
  </dl></details>
}

/** The completeness wording used by the report and the CSV. Never says "complete" while anything is held, open or unchecked. */
function completeness(results: ResultsResponse, coverage: Coverage) {
  const held = (scope: 1 | 2) => results.records.filter(row => row.scope === scope && row.outcome !== "calculated" && row.plan.status !== "withdrawn" && row.plan.status !== "excluded").length
  const note = (complete: boolean, scope: 1 | 2) => {
    const count = held(scope), issues = coverageIssues(coverage, scope)
    const parts = [count ? `${plural(count, "record")} not yet counted` : "", issues.open ? `${plural(issues.open, "setup answer")} still open` : "", issues.gaps ? `${plural(issues.gaps, "expected source")} with no records` : "", !complete ? "some results only partly calculated" : "", issues.unchecked ? "coverage not checked against company setup" : ""].filter(Boolean)
    return parts.length ? `Incomplete — ${parts.join("; ")}` : "No known gaps — each source type and included site in company setup has at least one record"
  }
  const none = (scope: 1 | 2) => { const text = note(true, scope); return text.startsWith("Incomplete — ") ? `Not calculated — ${text.slice("Incomplete — ".length)}` : scope === 1 ? "No Scope 1 records" : "No electricity records" }
  return {
    scope1: results.scope1 ? note(results.scope1.complete, 1) : none(1),
    scope2Location: results.scope2 ? note(results.scope2.locationBasedComplete, 2) : none(2),
    scope2Market: results.scope2 ? note(results.scope2.marketBasedComplete, 2) : none(2),
  }
}

/** Escapes text for a CSS string: anything but plain letters, digits and simple punctuation becomes a CSS escape. */
const cssString = (text: string) => text.replace(/[^A-Za-z0-9 .,&()_-]/gu, char => `\\${char.codePointAt(0)!.toString(16)} `)

function Report({ results, coverage }: { results: ResultsResponse; coverage: Coverage }) {
  const setup = results.setup
  const company = (setup?.legalName || "Company").slice(0, 60)
  const notes = completeness(results, coverage)
  const scope1Rows = results.records.filter(row => row.scope === 1)
  const scope2Rows = results.records.filter(row => row.scope === 2)
  const incomplete = results.records.filter(row => row.outcome !== "calculated" || row.scope1?.status === "partial" || row.scope2?.marketBased.status === "input_needed" || row.scope2?.marketBased.status === "review_required")
  const estimated = results.records.filter(row => row.quality === "estimated" || (row.scope1?.estimates.length ?? 0) > 0 || (row.scope2?.estimates.length ?? 0) > 0)
  const unstated = results.records.filter(row => row.outcome === "calculated" && row.quality === "unknown").length
  const factorRows = new Map<string, { label: string; value: string; unit: string; cell: string }>()
  for (const row of results.records) for (const factor of row.scope1?.factorsUsed ?? row.scope2?.factorsUsed ?? []) factorRows.set(factor.key, factor)
  const methods = [...new Set(results.records.map(row => row.scope1?.methodVersionId ?? row.scope2?.methodVersionId).filter(Boolean))] as string[]
  const residual = results.records.find(row => row.scope2?.marketBased.residualMix)?.scope2?.marketBased.residualMix
  const line = (row: ResultRow) => <tr key={row.recordId}><td>{kindLabel(row.kind)}</td><td>{row.locationName ?? "—"}</td><td>{row.sourceId}</td><td>{periodLabel(row.period.start, row.period.endExclusive)}</td><td className="nv-right">{row.quantity.value ? `${groupDigits(row.quantity.value)} ${shortUnit(row.quantity.unit)}` : "—"}</td><td>{QUALITY[row.quality] ?? row.quality}</td><td>{evidenceText(row)}</td><td>{rowStatus(row).label}</td><td className="nv-right">{rowKg(row) ? groupDigits(rowKg(row)!) : "—"}</td>{row.scope === 2 && <td className="nv-right">{row.scope2?.marketBased.total ? groupDigits(row.scope2.marketBased.total.display) : "—"}</td>}</tr>
  return <article className="nv-report" aria-labelledby="report-title">
    {/* Running footer on every printed page names the company as well as the draft status. */}
    <style>{`@media print { @page { @bottom-left { content: "DRAFT \\2014  ${cssString(company)} \\2014  Neuvetra beta methods; not externally assured"; } } }`}</style>
    <div className="nv-report__head">
      <div><p className="nv-report__small" style={{ margin: 0 }}>Greenhouse-gas inventory · Scope 1 and Scope 2</p><h2 id="report-title" className="nv-report__title">{setup?.legalName || "Company"}{setup?.tradingName ? ` (${setup.tradingName})` : ""}</h2></div>
      <span className="nv-report__stamp">DRAFT</span>
    </div>
    <p style={{ fontWeight: 600, marginTop: 12 }}>{DRAFT_LABEL}. Synthetic data — private beta.</p>
    <div className="nv-report__meta">
      <div><small>Reporting period</small>{periodLabel(setup?.period.start, setup?.period.endExclusive)}</div>
      <div><small>Boundary approach</small>{BOUNDARY_LABELS[setup?.boundaryApproach ?? "unknown"] ?? setup?.boundaryApproach}</div>
      <div><small>Prepared</small>{new Date(results.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
    </div>
    <h3>Summary</h3>
    <div className="nv-report__scroll"><table><thead><tr><th>Scope</th><th>Basis</th><th className="nv-right">kg CO2e</th><th className="nv-right">t CO2e</th><th>Completeness</th></tr></thead><tbody>
      <tr><td>Scope 1</td><td>Direct emissions</td><td className="nv-right">{results.scope1 ? groupDigits(results.scope1.knownSourceSubtotal.display) : "—"}</td><td className="nv-right">{results.scope1 ? kgToTonnes(results.scope1.knownSourceSubtotal.display) : "—"}</td><td>{notes.scope1}</td></tr>
      <tr><td>Scope 2</td><td>Location-based</td><td className="nv-right">{results.scope2 ? groupDigits(results.scope2.locationBasedSubtotal.display) : "—"}</td><td className="nv-right">{results.scope2 ? kgToTonnes(results.scope2.locationBasedSubtotal.display) : "—"}</td><td>{notes.scope2Location}</td></tr>
      <tr><td>Scope 2</td><td>Market-based</td><td className="nv-right">{results.scope2 ? groupDigits(results.scope2.marketBasedSubtotal.display) : "—"}</td><td className="nv-right">{results.scope2 ? kgToTonnes(results.scope2.marketBasedSubtotal.display) : "—"}</td><td>{notes.scope2Market}</td></tr>
    </tbody></table></div>
    <p className="nv-report__small">Scope 1 and Scope 2 are reported separately. Each subtotal is the calculation engine’s own aggregate of the calculated records below. Records that are held, excluded or withdrawn, and sources with no records, are listed separately and are not included.</p>
    {results.scope1?.reportedOutsideScopes.length ? <p className="nv-report__small">Reported outside the Scope 1 total: {results.scope1.reportedOutsideScopes.map(item => `${item.gas} ${groupDigits(item.massKg)} kg`).join("; ")}.</p> : null}
    <h3>Scope 1 sources</h3>
    {scope1Rows.length ? <div className="nv-report__scroll"><table><thead><tr><th>Activity</th><th>Site</th><th>Source</th><th>Period</th><th className="nv-right">Quantity</th><th>Data quality</th><th>Evidence</th><th>Status</th><th className="nv-right">kg CO2e</th></tr></thead><tbody>{scope1Rows.map(line)}</tbody></table></div> : <p>No Scope 1 records.</p>}
    <h3>Scope 2 purchased electricity</h3>
    {scope2Rows.length ? <div className="nv-report__scroll"><table><thead><tr><th>Activity</th><th>Site</th><th>Meter</th><th>Period</th><th className="nv-right">Quantity</th><th>Data quality</th><th>Evidence</th><th>Status</th><th className="nv-right">Location-based kg</th><th className="nv-right">Market-based kg</th></tr></thead><tbody>{scope2Rows.map(line)}</tbody></table></div> : <p>No Scope 2 records.</p>}
    <h3>Not counted, incomplete and possible gaps</h3>
    {incomplete.length || coverage.state !== "ready" || coverage.setupOpen.length || coverage.gaps.length ? <ul>
      {incomplete.map(row => <li key={row.recordId}><strong>{kindLabel(row.kind)} · {row.sourceId}</strong> — {rowStatus(row).label}: {rowReasons(row).join(" ")}</li>)}
      {coverage.state !== "ready" && <li><strong>Coverage not checked</strong> — these records could not be compared with company setup when this draft was prepared, so expected sources may be missing.</li>}
      {coverage.state === "ready" && coverage.setupOpen.map(item => <li key={item.id}><strong>Open in company setup</strong> — {item.title}. {item.detail}</li>)}
      {coverage.state === "ready" && coverage.gaps.map(gap => <li key={gap.id}><strong>Possible gap (Scope {gap.scope})</strong> — {gap.title}.{gap.note ? <> {noteLabel(gap)}: “{gap.note}”</> : null}</li>)}
    </ul> : <p>None found: every record is counted, company setup has no open answers, and each source type and included site it lists has at least one record. This checks coverage by type and site, not that each bill covers the whole year.</p>}
    <h3>Estimates, partial calculations and data quality</h3>
    {estimated.length ? <ul>{estimated.map(row => <li key={row.recordId}><strong>{kindLabel(row.kind)} · {row.sourceId}</strong> — {[row.quality === "estimated" ? `Activity data marked Estimated${row.estimateBasis ? ` (${row.estimateBasis})` : ""}.` : "", ...(row.scope1?.estimates ?? []).map(reasonText), ...(row.scope2?.estimates ?? []).map(reasonText)].filter(Boolean).join(" ")}</li>)}</ul> : <p>No records are marked Estimated and no method estimates were applied.</p>}
    {unstated > 0 && <p>{plural(unstated, "calculated record has", "calculated records have")} data quality “Unknown”.</p>}
    <h3>Methods and emission factors</h3>
    <p>Methods: {methods.join(", ") || "none calculated"}. Global warming potentials: IPCC AR5, 100-year (CH4 28, N2O 265). Emission factors: EPA GHG Emission Factors Hub (2025); EPA eGRID2023 rev2; Green-e 2025 residual mix. Figures are rounded once, half-even, to 4 decimal places of kg CO2e.</p>
    {residual && <p>Market-based electricity not covered by certificates or contracts uses the residual mix: {residual.method}. Sources: {residual.sources.join("; ")}.</p>}
    {factorRows.size > 0 && <div className="nv-report__scroll"><table><thead><tr><th>Factor</th><th className="nv-right">Value</th><th>Unit</th><th>Source (cell)</th></tr></thead><tbody>{[...factorRows.entries()].map(([key, factor]) => <tr key={key}><td>{factor.label}</td><td className="nv-right">{groupDigits(factor.value)}</td><td>{factor.unit}</td><td>{factorSource(key)} ({factor.cell})</td></tr>)}</tbody></table></div>}
    <p className="nv-report__small" style={{ marginTop: 24 }}>This draft was prepared with Neuvetra beta methods from synthetic company data. It has not been reviewed by an independent assurance provider and must not be filed or published as a final inventory.</p>
  </article>
}

export function ResultsReport({ actor, workspaceId, headingRef, coverage, onRetryCoverage, canManage, onNavigate, onFix }: { actor: HostedWorkspaceActor; workspaceId: string | null; headingRef: RefObject<HTMLHeadingElement | null>; coverage: Coverage; onRetryCoverage: () => void; canManage: boolean; onNavigate: (view: JourneyView) => void; onFix: (recordId: string) => void }) {
  const [results, setResults] = useState<ResultsResponse | null>(null)
  const [error, setError] = useState<{ message: string; missingRoute: boolean } | null>(null)
  const [busy, setBusy] = useState(true)
  const [showReport, setShowReport] = useState(false)
  const [filter, setFilter] = useState<"all" | "attention">("all")
  const actorRef = useRef(actor)
  useEffect(() => { actorRef.current = actor }, [actor])
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!workspaceId) { setError({ message: "Choose an admitted synthetic company to continue.", missingRoute: false }); setBusy(false); return }
    setBusy(true); setError(null)
    try { const value = await loadResults(workspaceId, { ...actorRef.current, signal }); if (!signal?.aborted) setResults(value) }
    catch (cause) { if (!signal?.aborted) { const message = cause instanceof Error ? cause.message : "Results are unavailable right now."; setError({ message, missingRoute: cause instanceof ResultsApiError && cause.status === 404 && !/^Results not found/.test(message) }) } }
    finally { if (!signal?.aborted) setBusy(false) }
  }, [workspaceId])
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { void load(controller.signal) }); return () => controller.abort() }, [load])
  useEffect(() => { if (!showReport) return; document.getElementById("draft-report")?.scrollIntoView({ behavior: "smooth", block: "start" }) }, [showReport])

  const composition = useMemo(() => {
    if (!results?.scope1) return []
    const totals = new Map<string, number>()
    for (const row of results.records) if (row.scope1?.total && results.scope1.includedResults.includes(row.scope1.resultSha256)) totals.set(row.kind, (totals.get(row.kind) ?? 0) + Number(row.scope1.total.display))
    const sum = [...totals.values()].reduce((a, b) => a + b, 0)
    return sum > 0 ? [...totals.entries()].map(([kind, value]) => ({ kind, share: value / sum })).sort((a, b) => b.share - a.share) : []
  }, [results])

  function downloadCsv() {
    if (!results) return
    const blob = new Blob([resultsCsv(results, { kind: kindLabel, reason: reasonText, status: row => rowStatus(row).label, boundary: code => BOUNDARY_LABELS[code] ?? code, period: periodLabel, quality: code => QUALITY[code] ?? code, unit: code => shortUnit(code), coverage: coverageLines(coverage), completeness: completeness(results, coverage) })], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a"); link.href = url; link.download = `neuvetra-draft-results-${results.generatedAt.slice(0, 10)}.csv`; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
  function printReport() { setShowReport(true); window.setTimeout(() => window.print(), 250) }

  const header = <>
    <p className="nv-eyebrow">Step 3 of 3 · Results & report</p>
    <h1 ref={headingRef} tabIndex={-1}>Draft results</h1>
  </>
  if (busy && !results) return <section aria-busy="true">{header}<p className="nv-lead" role="status">Calculating each record with the reviewed methods…</p><div className="nv-grid-3">{[0, 1, 2].map(i => <div key={i} className="nv-stat" style={{ height: 120, opacity: .5 }} />)}</div></section>
  if (error && !results) return <section>{header}
    {error.missingRoute ? <div className="nv-notice nv-notice--info" role="status"><Icon name="info" /><div><p><strong>Draft results aren’t switched on in this environment yet.</strong></p><p>Your records are saved. Results appear here once the results service is deployed.</p></div></div>
      : <div className="nv-notice nv-notice--error" role="alert"><Icon name="alert" /><div><p>{error.message}</p><div className="nv-actions" style={{ marginTop: 10 }}><button type="button" className="nv-btn nv-btn--sm" onClick={() => void load()}>Try again</button></div></div></div>}
  </section>
  if (!results) return null
  const { counts } = results
  if (!counts.records) return <section>{header}
    <div className="nv-empty" style={{ marginTop: 16 }}><Icon name="records" size={28} /><p className="nv-h3" style={{ marginTop: 10 }}>No activity records yet</p><p>{canManage ? "Add a gas bill, an electricity bill or fleet fuel, and your draft results appear here." : "Draft results appear here once an owner or admin adds activity records."}</p>{canManage && <button type="button" className="nv-btn nv-btn--primary" onClick={() => onNavigate("collection")}>Add activity</button>}</div>
  </section>
  const attentionRows = results.records.filter(needsWork)
  const heldInScope = (scope: 1 | 2) => results.records.filter(row => row.scope === scope && row.outcome !== "calculated" && row.plan.status !== "withdrawn" && row.plan.status !== "excluded").length
  const issues1 = coverageIssues(coverage, 1), issues2 = coverageIssues(coverage, 2)
  const held1 = heldInScope(1), held2 = heldInScope(2)
  const open1 = issues1.open + issues1.gaps + (issues1.unchecked ? 1 : 0), open2 = issues2.open + issues2.gaps + (issues2.unchecked ? 1 : 0)
  const ordered = [...results.records].sort((a, b) => Number(needsWork(b)) - Number(needsWork(a)) || a.scope - b.scope)
  const visible = filter === "attention" ? attentionRows : ordered
  const s1 = results.scope1, s2 = results.scope2
  const scope1Count = s1?.includedResults.length ?? 0
  const scope2Count = s2?.locationBasedIncluded.length ?? 0
  const warnLine = (held: number, issues: ReturnType<typeof coverageIssues>, noun: string, complete = true) => [held ? `${plural(held, noun)} not counted yet` : "", !complete ? "some results partly calculated" : "", issues.open ? `${plural(issues.open, "setup answer")} open` : "", issues.gaps ? plural(issues.gaps, "possible gap") : "", issues.unchecked ? "coverage not checked" : ""].filter(Boolean).join(" · ")
  const incompleteText = (complete: boolean, held: number, open: number) => complete && !held && !open ? "" : " · incomplete"
  return <section aria-busy={busy}>
    {header}
    <p className="nv-lead">{results.setup?.legalName || "Your company"} · {periodLabel(results.setup?.period.start, results.setup?.period.endExclusive)} · calculated {new Date(results.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
    <div className="nv-notice nv-notice--warn"><Icon name="info" /><p><strong>{DRAFT_LABEL}.</strong> Use it to review your data, not to file.</p></div>
    {results.warnings.map(warning => <div key={warning} className="nv-notice nv-notice--error" role="alert"><Icon name="alert" /><p>{warning}</p></div>)}

    <div className="nv-grid-3" style={{ marginTop: 18 }}>
      <div className="nv-stat">
        <span className="nv-stat__label">Scope 1 · direct</span>
        <span className="nv-stat__value">{s1 ? kgToTonnes(s1.knownSourceSubtotal.display) : "—"}<span className="nv-stat__unit">t CO2e</span></span>
        <div className="nv-stat__foot">{s1 ? `${groupDigits(s1.knownSourceSubtotal.display)} kg · ${plural(scope1Count, "source")} counted${incompleteText(s1.complete, held1, open1)}` : "No Scope 1 source calculated yet"}{held1 || open1 || (s1 && !s1.complete) ? <span className="nv-stat__warn">{warnLine(held1, issues1, "record", s1?.complete ?? true)}</span> : null}</div>
      </div>
      <div className="nv-stat">
        <span className="nv-stat__label">Scope 2 · location-based</span>
        <span className="nv-stat__value">{s2 ? kgToTonnes(s2.locationBasedSubtotal.display) : "—"}<span className="nv-stat__unit">t CO2e</span></span>
        <div className="nv-stat__foot">{s2 ? `${groupDigits(s2.locationBasedSubtotal.display)} kg · ${plural(scope2Count, "meter")} counted${incompleteText(s2.locationBasedComplete, held2, open2)}` : "No electricity calculated yet"}{held2 || open2 || (s2 && !s2.locationBasedComplete) ? <span className="nv-stat__warn">{warnLine(held2, issues2, "meter", s2?.locationBasedComplete ?? true)}</span> : null}</div>
      </div>
      <div className="nv-stat">
        <span className="nv-stat__label">Scope 2 · market-based</span>
        <span className="nv-stat__value">{s2 ? kgToTonnes(s2.marketBasedSubtotal.display) : "—"}<span className="nv-stat__unit">t CO2e</span></span>
        <div className="nv-stat__foot">{s2 ? `${groupDigits(s2.marketBasedSubtotal.display)} kg${incompleteText(s2.marketBasedComplete, held2, open2)}${s2.marketBasedProvisional.length ? " · provisional" : ""}` : "No electricity calculated yet"}{held2 || open2 || (s2 && !s2.marketBasedComplete) ? <span className="nv-stat__warn">{warnLine(held2, issues2, "meter", s2?.marketBasedComplete ?? true)}</span> : null}</div>
      </div>
    </div>
    <p className="nv-subtle nv-stats-note">Headline figures are metric tonnes (1 t = 1,000 kg), rounded to 2 decimals for reading. The kilogram figures are exact engine output.</p>

    {coverage.state === "loading" && <p className="nv-subtle" role="status">Checking these records against your company setup…</p>}
    {coverage.state === "unavailable" && <div className="nv-notice nv-notice--warn" role="alert"><Icon name="alert" /><div><p><strong>Coverage check unavailable.</strong> These records couldn’t be compared with your company setup, so the totals may be incomplete. The report and CSV say so too.</p><div className="nv-actions" style={{ marginTop: 10 }}><button type="button" className="nv-btn nv-btn--sm" onClick={onRetryCoverage}>Check again</button></div></div></div>}
    {coverage.state === "ready" && (coverage.setupOpen.length > 0 || coverage.gaps.length > 0) && <div className="nv-notice nv-notice--info"><Icon name="info" /><div>
      <p><strong>{[coverage.setupOpen.length ? plural(coverage.setupOpen.length, "open setup answer") : "", coverage.gaps.length ? plural(coverage.gaps.length, "possible gap") : ""].filter(Boolean).join(" and ")}.</strong> Sources may be missing, so these totals are marked incomplete.</p>
      <ul>{coverage.setupOpen.map(item => <li key={item.id}>{item.title}.</li>)}{coverage.gaps.map(gap => <li key={gap.id}>{gap.title}.{gap.note ? ` ${noteLabel(gap)}: “${gap.note}”` : ""}</li>)}</ul>
      {canManage && <p>{coverage.setupOpen.length > 0 && <><button type="button" className="nv-link" onClick={() => onNavigate("setup")}>Answer in company setup</button>{coverage.gaps.length > 0 ? " or " : "."}</>}{coverage.gaps.length > 0 && <><button type="button" className="nv-link" onClick={() => onNavigate("collection")}>{coverage.setupOpen.length ? "add records" : "Add records"}</button>.</>}</p>}
    </div></div>}

    {composition.length > 0 && <div className="nv-card nv-card--flat">
      <h2 className="nv-h3">Where counted Scope 1 comes from</h2>
      <div className="nv-bar" role="img" aria-label={composition.map(item => `${kindLabel(item.kind)} ${Math.round(item.share * 100)}%`).join(", ")}>{composition.map(item => <span key={item.kind} style={{ width: `${item.share * 100}%`, background: KIND_COLORS[item.kind] ?? "#999" }} />)}</div>
      <div className="nv-legend">{composition.map(item => <span key={item.kind}><i style={{ background: KIND_COLORS[item.kind] ?? "#999" }} />{kindLabel(item.kind)} {Math.round(item.share * 100)}%</span>)}</div>
    </div>}

    <div className="nv-card">
      <div className="nv-card__head">
        <div><h2 className="nv-h2">Records</h2><p className="nv-muted">{counts.calculated} calculated · {counts.inputNeeded} input needed{counts.outsidePeriod ? ` · ${counts.outsidePeriod} outside the reporting period` : ""} · {counts.excluded} excluded · {counts.withdrawn} withdrawn</p></div>
        <div className="nv-segmented" role="group" aria-label="Filter records"><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All ({results.records.length})</button><button type="button" aria-pressed={filter === "attention"} onClick={() => setFilter("attention")}>Needs attention ({attentionRows.length})</button></div>
      </div>
      {attentionRows.length > 0 && filter === "all" && <div className="nv-notice nv-notice--warn"><Icon name="alert" /><p>{plural(attentionRows.length, "record is", "records are")} not fully counted yet.{canManage ? ` Fix ${attentionRows.length === 1 ? "it" : "them"} to complete your totals.` : ""}</p></div>}
      {visible.length === 0 ? <p className="nv-muted">No record needs attention.</p> : visible.map(row => {
        const status = rowStatus(row), reasons = rowReasons(row), kg = rowKg(row)
        return <div className="nv-record-card" key={row.recordId}>
          <span className="nv-record-card__icon" aria-hidden="true"><Icon name={kindIcon(row.kind)} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="nv-record-card__title">{kindLabel(row.kind)} · {row.sourceId}</div>
            <div className="nv-record-card__meta">{row.locationName ?? "Unknown site"} · {periodLabel(row.period.start, row.period.endExclusive)} · {row.quantity.value ? `${groupDigits(row.quantity.value)} ${shortUnit(row.quantity.unit)}` : "amount missing"}{row.outcome === "calculated" && !row.evidence.length ? " · no evidence linked" : ""}</div>
            {reasons.slice(0, 3).map(reason => <div key={reason} className="nv-record-card__reason" style={{ color: status.tone === "warn" || status.tone === "danger" ? undefined : "var(--muted)" }}>{reason}</div>)}
            {row.outcome === "calculated" && <RowDetail row={row} />}
          </div>
          <div className="nv-record-card__side">
            <span className={`nv-chip nv-chip--${status.tone}`}>{status.label}</span>
            {kg && <span className="nv-num" style={{ fontWeight: 600 }}>{groupDigits(kg)} kg{row.scope === 2 ? " (location)" : ""}</span>}
            {row.scope === 2 && row.scope2?.marketBased.total && <span className="nv-num nv-subtle">{groupDigits(row.scope2.marketBased.total.display)} kg (market)</span>}
            {needsWork(row) && row.plan.status !== "withdrawn" && <button type="button" className="nv-btn nv-btn--sm" aria-label={`${canManage ? "Fix" : "View"} ${kindLabel(row.kind)} · ${row.sourceId}`} onClick={() => onFix(row.recordId)}>{canManage ? "Fix" : "View"}</button>}
          </div>
        </div>
      })}
    </div>

    <div className="nv-card nv-card--accent">
      <div className="nv-card__head"><div><h2 className="nv-h2">Draft report</h2><p className="nv-muted">A print-ready summary: totals, every source with its evidence, what isn’t counted, estimates, and the factors used.</p></div></div>
      <div className="nv-actions">
        <button type="button" className="nv-btn nv-btn--primary" onClick={() => setShowReport(value => !value)} aria-expanded={showReport} aria-controls="draft-report"><Icon name="file" size={18} />{showReport ? "Hide draft report" : "View draft report"}</button>
        <button type="button" className="nv-btn" onClick={printReport}><Icon name="print" size={18} />Print or save as PDF</button>
        <button type="button" className="nv-btn" onClick={downloadCsv}><Icon name="download" size={18} />Download CSV</button>
        <button type="button" className="nv-btn nv-btn--ghost" disabled={busy} onClick={() => void load()}>{busy ? "Recalculating…" : "Recalculate"}</button>
      </div>
    </div>
    {/* Always rendered so printing from the browser menu prints the report; shown on screen only when opened. */}
    <div id="draft-report" className={showReport ? undefined : "nv-print-only"}><Report results={results} coverage={coverage} /></div>
    <p className="nv-subtle">Activity types covered: {ACTIVITY_KINDS.map(kind => kind.label).join(", ")}. Scope 3 is not calculated in this beta.</p>
  </section>
}
