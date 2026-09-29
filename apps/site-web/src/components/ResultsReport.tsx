import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { Icon } from "./Icon"
import type { JourneyView } from "./JourneyNav"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import { DRAFT_LABEL, loadResults, ResultsApiError, resultsCsv, type EngineGas, type ResultRow, type ResultsResponse } from "@/lib/results-api"
import { ACTIVITY_KINDS, BOUNDARY_LABELS, groupDigits, kgToTonnes, kindIcon, kindLabel, periodLabel, reasonText, shortUnit } from "@/lib/plain-language"
import { GAS_LABELS, KIND_COLORS, rowReasons, rowStatus } from "@/lib/results-view"

const rowKg = (row: ResultRow) => row.scope1?.total?.display ?? row.scope2?.locationBased.total?.display ?? null
const needsWork = (row: ResultRow) => { const tone = rowStatus(row).tone; return tone === "warn" || tone === "danger" || (row.scope1?.status === "partial") }

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
      <dt>Market-based</dt><dd>{s2.marketBased.total ? <Gases gases={s2.marketBased.gases} /> : "Held — see the notes"}</dd></>}
    {factors.length > 0 && <><dt>Factors used</dt><dd>{factors.map(factor => <span key={factor.key} style={{ display: "block" }}>{factor.label}: {factor.value} {factor.unit} <span className="nv-subtle">({factor.cell})</span></span>)}</dd></>}
    <dt>GWP set</dt><dd>{s1?.gwpSetId ?? s2?.gwpSetId ?? "—"} (IPCC AR5, 100-year)</dd>
    <dt>Record</dt><dd>Version {row.revision} · {row.evidenceCount} evidence file{row.evidenceCount === 1 ? "" : "s"} linked · data quality {row.quality}{row.estimateBasis ? ` (${row.estimateBasis})` : ""}</dd>
    {(s1?.resultSha256 || s2?.resultSha256) && <><dt>Result fingerprint</dt><dd className="nv-subtle" style={{ fontFamily: "monospace", fontSize: ".8rem" }}>{s1?.resultSha256 ?? s2?.resultSha256}</dd></>}
  </dl></details>
}

function Report({ results }: { results: ResultsResponse }) {
  const setup = results.setup
  const heldCount = (scope: 1 | 2) => results.records.filter(row => row.scope === scope && row.outcome !== "calculated" && row.plan.status !== "withdrawn" && row.plan.status !== "excluded").length
  const held1 = heldCount(1), held2 = heldCount(2)
  const note = (complete: boolean, held: number) => held ? `Incomplete — ${held} record${held === 1 ? "" : "s"} not yet counted` : complete ? "Complete for the records listed" : "Known sources only — incomplete"
  const scope1Rows = results.records.filter(row => row.scope === 1)
  const scope2Rows = results.records.filter(row => row.scope === 2)
  const held = results.records.filter(row => row.outcome !== "calculated")
  const estimates = results.records.filter(row => row.quality === "estimated" || (row.scope1?.estimates.length ?? 0) > 0 || (row.scope2?.estimates.length ?? 0) > 0)
  const factorRows = new Map<string, { label: string; value: string; unit: string; cell: string }>()
  for (const row of results.records) for (const factor of row.scope1?.factorsUsed ?? row.scope2?.factorsUsed ?? []) factorRows.set(factor.key, factor)
  const methods = [...new Set(results.records.map(row => row.scope1?.methodVersionId ?? row.scope2?.methodVersionId).filter(Boolean))] as string[]
  const line = (row: ResultRow) => <tr key={row.recordId}><td>{kindLabel(row.kind)}</td><td>{row.locationName ?? "—"}</td><td>{row.sourceId}</td><td>{periodLabel(row.period.start, row.period.endExclusive)}</td><td className="nv-right">{row.quantity.value ? `${groupDigits(row.quantity.value)} ${shortUnit(row.quantity.unit)}` : "—"}</td><td>{rowStatus(row).label}</td><td className="nv-right">{rowKg(row) ? groupDigits(rowKg(row)!) : "—"}</td>{row.scope === 2 && <td className="nv-right">{row.scope2?.marketBased.total ? groupDigits(row.scope2.marketBased.total.display) : "—"}</td>}</tr>
  return <article className="nv-report" aria-label="Draft greenhouse-gas report">
    <div className="nv-report__head">
      <div><p className="nv-report__small" style={{ margin: 0 }}>Greenhouse-gas inventory · Scope 1 and Scope 2</p><h1>{setup?.legalName || "Company"}{setup?.tradingName ? ` (${setup.tradingName})` : ""}</h1></div>
      <span className="nv-report__stamp">DRAFT</span>
    </div>
    <p style={{ fontWeight: 600, marginTop: 12 }}>{DRAFT_LABEL}. Synthetic data — private beta.</p>
    <div className="nv-report__meta">
      <div><small>Reporting period</small>{periodLabel(setup?.period.start, setup?.period.endExclusive)}</div>
      <div><small>Boundary approach</small>{BOUNDARY_LABELS[setup?.boundaryApproach ?? "unknown"] ?? setup?.boundaryApproach}</div>
      <div><small>Prepared</small>{new Date(results.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
    </div>
    <h2>Summary</h2>
    <div className="nv-report__scroll"><table><thead><tr><th>Scope</th><th>Basis</th><th className="nv-right">kg CO2e</th><th className="nv-right">t CO2e</th><th>Completeness</th></tr></thead><tbody>
      <tr><td>Scope 1</td><td>Direct emissions</td><td className="nv-right">{results.scope1 ? groupDigits(results.scope1.knownSourceSubtotal.display) : "—"}</td><td className="nv-right">{results.scope1 ? kgToTonnes(results.scope1.knownSourceSubtotal.display) : "—"}</td><td>{results.scope1 ? note(results.scope1.complete, held1) : "No calculated sources"}</td></tr>
      <tr><td>Scope 2</td><td>Location-based</td><td className="nv-right">{results.scope2 ? groupDigits(results.scope2.locationBasedSubtotal.display) : "—"}</td><td className="nv-right">{results.scope2 ? kgToTonnes(results.scope2.locationBasedSubtotal.display) : "—"}</td><td>{results.scope2 ? note(results.scope2.locationBasedComplete, held2) : "No calculated meters"}</td></tr>
      <tr><td>Scope 2</td><td>Market-based</td><td className="nv-right">{results.scope2 ? groupDigits(results.scope2.marketBasedSubtotal.display) : "—"}</td><td className="nv-right">{results.scope2 ? kgToTonnes(results.scope2.marketBasedSubtotal.display) : "—"}</td><td>{results.scope2 ? note(results.scope2.marketBasedComplete, held2) : "No calculated meters"}</td></tr>
    </tbody></table></div>
    <p className="nv-report__small">Scope 1 and Scope 2 are reported separately. Each subtotal is the calculation engine’s own aggregate of the records listed below; records that are held or not calculated are listed separately and are not included.</p>
    {results.scope1?.reportedOutsideScopes.length ? <p className="nv-report__small">Reported outside Scope 1: {results.scope1.reportedOutsideScopes.map(item => `${item.gas} ${groupDigits(item.massKg)} kg`).join("; ")}.</p> : null}
    <h2>Scope 1 sources</h2>
    {scope1Rows.length ? <div className="nv-report__scroll"><table><thead><tr><th>Activity</th><th>Site</th><th>Source</th><th>Period</th><th className="nv-right">Quantity</th><th>Status</th><th className="nv-right">kg CO2e</th></tr></thead><tbody>{scope1Rows.map(line)}</tbody></table></div> : <p>No Scope 1 records.</p>}
    <h2>Scope 2 purchased electricity</h2>
    {scope2Rows.length ? <div className="nv-report__scroll"><table><thead><tr><th>Activity</th><th>Site</th><th>Meter</th><th>Period</th><th className="nv-right">Quantity</th><th>Status</th><th className="nv-right">Location-based kg</th><th className="nv-right">Market-based kg</th></tr></thead><tbody>{scope2Rows.map(line)}</tbody></table></div> : <p>No Scope 2 records.</p>}
    <h2>Held, excluded and incomplete items</h2>
    {held.length || results.records.some(row => row.scope1?.status === "partial") ? <ul>{results.records.filter(row => row.outcome !== "calculated" || row.scope1?.status === "partial" || row.scope2?.marketBased.status === "input_needed").map(row => <li key={row.recordId}><strong>{kindLabel(row.kind)} · {row.sourceId}</strong> — {rowStatus(row).label}: {rowReasons(row).join(" ")}</li>)}</ul> : <p>None.</p>}
    <h2>Estimates</h2>
    {estimates.length ? <ul>{estimates.map(row => <li key={row.recordId}><strong>{kindLabel(row.kind)} · {row.sourceId}</strong> — {[row.quality === "estimated" ? `Estimated activity data${row.estimateBasis ? ` (${row.estimateBasis})` : ""}.` : "", ...(row.scope1?.estimates ?? []).map(reasonText), ...(row.scope2?.estimates ?? []).map(reasonText)].filter(Boolean).join(" ")}</li>)}</ul> : <p>No estimates were used.</p>}
    <h2>Methods and emission factors</h2>
    <p>Methods: {methods.join(", ") || "none calculated"}. Global warming potentials: IPCC AR5, 100-year (CH4 28, N2O 265). Emission factors: EPA GHG Emission Factors Hub (2025); EPA eGRID2023; Green-e 2025 residual mix. Figures are rounded once, half-even, to 4 decimal places of kg CO2e.</p>
    {factorRows.size > 0 && <div className="nv-report__scroll"><table><thead><tr><th>Factor</th><th className="nv-right">Value</th><th>Unit</th><th>Source cell</th></tr></thead><tbody>{[...factorRows.entries()].map(([key, factor]) => <tr key={key}><td>{factor.label}</td><td className="nv-right">{factor.value}</td><td>{factor.unit}</td><td>{factor.cell}</td></tr>)}</tbody></table></div>}
    <p className="nv-report__small" style={{ marginTop: 24 }}>This draft was prepared with Neuvetra beta methods from synthetic company data. It has not been reviewed by an independent assurance provider and must not be filed or published as a final inventory.</p>
  </article>
}

export function ResultsReport({ actor, workspaceId, headingRef, onNavigate, onFix }: { actor: HostedWorkspaceActor; workspaceId: string | null; headingRef: RefObject<HTMLHeadingElement | null>; onNavigate: (view: JourneyView) => void; onFix: (recordId: string) => void }) {
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
    catch (cause) { if (!signal?.aborted) { const message = cause instanceof Error ? cause.message : "Results are unavailable right now."; setError({ message, missingRoute: cause instanceof ResultsApiError && cause.status === 404 }) } }
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
    const blob = new Blob([resultsCsv(results, { kind: kindLabel, reason: reasonText })], { type: "text/csv" })
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
    <div className="nv-empty" style={{ marginTop: 16 }}><Icon name="records" size={28} /><p className="nv-h3" style={{ marginTop: 10 }}>No activity records yet</p><p>Add a gas bill, an electricity bill or fleet fuel, and your draft results appear here.</p><button type="button" className="nv-btn nv-btn--primary" onClick={() => onNavigate("collection")}>Add activity</button></div>
  </section>
  const attentionRows = results.records.filter(needsWork)
  const heldInScope = (scope: 1 | 2) => results.records.filter(row => row.scope === scope && row.outcome !== "calculated" && row.plan.status !== "withdrawn" && row.plan.status !== "excluded").length
  const held1 = heldInScope(1), held2 = heldInScope(2)
  const ordered = [...results.records].sort((a, b) => Number(needsWork(b)) - Number(needsWork(a)) || a.scope - b.scope)
  const visible = filter === "attention" ? attentionRows : ordered
  const s1 = results.scope1, s2 = results.scope2
  const scope1Count = results.records.filter(row => row.scope === 1 && row.outcome === "calculated").length
  const scope2Count = results.records.filter(row => row.scope === 2 && row.outcome === "calculated").length
  return <section aria-busy={busy}>
    {header}
    <p className="nv-lead">{results.setup?.legalName || "Your company"} · {periodLabel(results.setup?.period.start, results.setup?.period.endExclusive)} · calculated {new Date(results.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
    <div className="nv-notice nv-notice--warn"><Icon name="info" /><p><strong>{DRAFT_LABEL}.</strong> Use it to review your data, not to file.</p></div>
    {results.warnings.map(warning => <div key={warning} className="nv-notice nv-notice--error" role="alert"><Icon name="alert" /><p>{warning}</p></div>)}

    <div className="nv-grid-3" style={{ marginTop: 18 }}>
      <div className="nv-stat">
        <span className="nv-stat__label">Scope 1 · direct</span>
        <span className="nv-stat__value">{s1 ? kgToTonnes(s1.knownSourceSubtotal.display) : "—"}<span className="nv-stat__unit">t CO2e</span></span>
        <div className="nv-stat__foot">{s1 ? `${groupDigits(s1.knownSourceSubtotal.display)} kg · ${scope1Count} source${scope1Count === 1 ? "" : "s"}${s1.complete && !held1 ? "" : " · incomplete"}` : "No Scope 1 source calculated yet"}{held1 ? <span className="nv-stat__warn">{held1} Scope 1 record{held1 === 1 ? "" : "s"} not counted yet</span> : null}</div>
      </div>
      <div className="nv-stat">
        <span className="nv-stat__label">Scope 2 · location-based</span>
        <span className="nv-stat__value">{s2 ? kgToTonnes(s2.locationBasedSubtotal.display) : "—"}<span className="nv-stat__unit">t CO2e</span></span>
        <div className="nv-stat__foot">{s2 ? `${groupDigits(s2.locationBasedSubtotal.display)} kg · ${scope2Count} meter${scope2Count === 1 ? "" : "s"}${s2.locationBasedComplete && !held2 ? "" : " · incomplete"}` : "No electricity calculated yet"}{held2 ? <span className="nv-stat__warn">{held2} meter{held2 === 1 ? "" : "s"} not counted yet</span> : null}</div>
      </div>
      <div className="nv-stat">
        <span className="nv-stat__label">Scope 2 · market-based</span>
        <span className="nv-stat__value">{s2 ? kgToTonnes(s2.marketBasedSubtotal.display) : "—"}<span className="nv-stat__unit">t CO2e</span></span>
        <div className="nv-stat__foot">{s2 ? `${groupDigits(s2.marketBasedSubtotal.display)} kg${s2.marketBasedComplete && !held2 ? "" : " · incomplete"}${s2.marketBasedProvisional.length ? " · provisional" : ""}` : "No electricity calculated yet"}</div>
      </div>
    </div>
    <p className="nv-subtle">Headline figures are metric tonnes (1 t = 1,000 kg), rounded to 2 decimals for reading. The kilogram figures are exact engine output.</p>

    {composition.length > 0 && <div className="nv-card nv-card--flat">
      <h2 className="nv-h3">Where Scope 1 comes from</h2>
      <div className="nv-bar" role="img" aria-label={composition.map(item => `${kindLabel(item.kind)} ${Math.round(item.share * 100)}%`).join(", ")}>{composition.map(item => <span key={item.kind} style={{ width: `${item.share * 100}%`, background: KIND_COLORS[item.kind] ?? "#999" }} />)}</div>
      <div className="nv-legend">{composition.map(item => <span key={item.kind}><i style={{ background: KIND_COLORS[item.kind] ?? "#999" }} />{kindLabel(item.kind)} {Math.round(item.share * 100)}%</span>)}</div>
    </div>}

    <div className="nv-card">
      <div className="nv-card__head">
        <div><h2 className="nv-h2">Records</h2><p className="nv-muted">{counts.calculated} calculated · {counts.inputNeeded} input needed · {counts.excluded} excluded · {counts.withdrawn} withdrawn</p></div>
        <div className="nv-segmented" role="group" aria-label="Filter records"><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All ({results.records.length})</button><button type="button" aria-pressed={filter === "attention"} onClick={() => setFilter("attention")}>Needs attention ({attentionRows.length})</button></div>
      </div>
      {attentionRows.length > 0 && filter === "all" && <div className="nv-notice nv-notice--warn"><Icon name="alert" /><p>{attentionRows.length} record{attentionRows.length === 1 ? " is" : "s are"} not fully counted yet. Fix {attentionRows.length === 1 ? "it" : "them"} to complete your totals.</p></div>}
      {visible.length === 0 ? <p className="nv-muted">Nothing needs attention. </p> : visible.map(row => {
        const status = rowStatus(row), reasons = rowReasons(row), kg = rowKg(row)
        return <div className="nv-record-card" key={row.recordId}>
          <span className="nv-record-card__icon" aria-hidden="true"><Icon name={kindIcon(row.kind)} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="nv-record-card__title">{kindLabel(row.kind)} · {row.sourceId}</div>
            <div className="nv-record-card__meta">{row.locationName ?? "Unknown site"} · {periodLabel(row.period.start, row.period.endExclusive)} · {row.quantity.value ? `${groupDigits(row.quantity.value)} ${shortUnit(row.quantity.unit)}` : "amount missing"}</div>
            {reasons.slice(0, 3).map(reason => <div key={reason} className="nv-record-card__reason" style={{ color: status.tone === "warn" || status.tone === "danger" ? undefined : "var(--muted)" }}>{reason}</div>)}
            {row.outcome === "calculated" && <RowDetail row={row} />}
          </div>
          <div className="nv-record-card__side">
            <span className={`nv-chip nv-chip--${status.tone}`}>{status.label}</span>
            {kg && <span className="nv-num" style={{ fontWeight: 600 }}>{groupDigits(kg)} kg{row.scope === 2 ? " (location)" : ""}</span>}
            {row.scope === 2 && row.scope2?.marketBased.total && <span className="nv-num nv-subtle">{groupDigits(row.scope2.marketBased.total.display)} kg (market)</span>}
            {needsWork(row) && row.plan.status !== "withdrawn" && <button type="button" className="nv-btn nv-btn--sm" onClick={() => onFix(row.recordId)}>Fix</button>}
          </div>
        </div>
      })}
    </div>

    <div className="nv-card nv-card--accent">
      <div className="nv-card__head"><div><h2 className="nv-h2">Draft report</h2><p className="nv-muted">A print-ready summary with every source, what’s held, estimates, and the factors used.</p></div></div>
      <div className="nv-actions">
        <button type="button" className="nv-btn nv-btn--primary" onClick={() => setShowReport(value => !value)} aria-expanded={showReport} aria-controls="draft-report"><Icon name="file" size={18} />{showReport ? "Hide draft report" : "View draft report"}</button>
        <button type="button" className="nv-btn" onClick={printReport}><Icon name="print" size={18} />Print or save as PDF</button>
        <button type="button" className="nv-btn" onClick={downloadCsv}><Icon name="download" size={18} />Download CSV</button>
        <button type="button" className="nv-btn nv-btn--ghost" disabled={busy} onClick={() => void load()}>{busy ? "Recalculating…" : "Recalculate"}</button>
      </div>
    </div>
    <div id="draft-report">{showReport && <Report results={results} />}</div>
    <p className="nv-subtle">Kinds covered: {ACTIVITY_KINDS.map(kind => kind.label).join(", ")}. Scope 3 is not calculated in this beta.</p>
  </section>
}
