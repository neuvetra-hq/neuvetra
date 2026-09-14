import { useState, type RefObject } from "react"
import { calculateSyntheticElectricity, replayCalculationRecord, type CalculationError, type CalculationRecord, type SyntheticElectricityActivity } from "@/lib/calculation-api"

const ACTIVITY: SyntheticElectricityActivity = {
  asset_id: "Synthetic California office 001",
  boundary: "Purchased electricity consumed by the reporting company",
  geography: { country: "United States", state: "California", egrid_subregion: "CAMX" },
  reporting_period: { start: "2023-01-01", end: "2023-12-31" },
  electricity: "Grid-delivered purchased electricity",
  quantity: "1",
  unit: "MWh",
}

const NEGATIVE_EXAMPLES = [
  { label: "Wrong unit", activity: { ...ACTIVITY, unit: "kWh" }, expected: "unit_conversion_unapproved" },
  { label: "Missing geography", activity: { ...ACTIVITY, geography: {} as SyntheticElectricityActivity["geography"] }, expected: "geography_required" },
  { label: "Wrong period", activity: { ...ACTIVITY, reporting_period: { start: "2024-01-01", end: "2024-12-31" } }, expected: "reporting_period_mismatch" },
] as const

function ShortHash({ value }: { value: string }) {
  return <code title={value}>{value.slice(0, 12)}…{value.slice(-8)}</code>
}

export function LocationBasedElectricityDemo({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  const [record, setRecord] = useState<CalculationRecord | null>(null)
  const [error, setError] = useState<CalculationError | null>(null)
  const [busy, setBusy] = useState(false)
  const [replayed, setReplayed] = useState(false)

  async function calculate(activity: SyntheticElectricityActivity = ACTIVITY) {
    setBusy(true); setError(null); setRecord(null); setReplayed(false)
    try {
      const response = await calculateSyntheticElectricity(activity)
      if (response.status === "error") setError(response.error)
      else setRecord(response.record)
    } catch {
      setError({ code: "calculation_unavailable", field: "system", message: "Start the local deterministic calculation service, then try again." })
    } finally { setBusy(false) }
  }

  async function replay() {
    if (!record) return
    setBusy(true); setError(null)
    try {
      const response = await replayCalculationRecord(record)
      if (response.status === "error") { setRecord(null); setError(response.error) }
      else { setRecord(response.record); setReplayed(response.hash_match === true) }
    } catch {
      setRecord(null); setError({ code: "calculation_unavailable", field: "system", message: "The local replay could not be completed." })
    } finally { setBusy(false) }
  }

  function download() {
    if (!record) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }))
    const link = document.createElement("a"); link.href = url; link.download = "neuvetra-m53-synthetic-electricity.json"; link.click(); URL.revokeObjectURL(url)
  }

  const factor = record?.factor as unknown as undefined | {
    id: string; version: string; data_year: string; candidate_sha256: string
    total_output_co2e: { value: string; unit: string; cell: string }
    source: { title: string; sheet: string; table: string; row_cells: string[]; workbook_sha256: string }
  }

  return (
    <section className="calculation-demo" aria-labelledby="calculation-heading">
      <div className="calculation-banner" role="status"><strong>Development calculation</strong><span>Synthetic data</span><span>EPA factor candidate not released</span></div>
      <header className="calculation-intro">
        <p className="research-eyebrow">Milestone 53 · deterministic accounting</p>
        <h1 id="calculation-heading" ref={headingRef} tabIndex={-1}>Trace purchased electricity.</h1>
        <p className="research-intro">One fixed California facility turns one megawatt-hour into a location-based Scope 2 result using the EPA eGRID2023 CAMX total-output rate.</p>
      </header>

      <div className="calculation-layout">
        <article className="calculation-card">
          <div className="calculation-card-heading"><span>01</span><div><p>Activity</p><h2>Synthetic office input</h2></div></div>
          <dl className="calculation-inputs">
            <div><dt>Facility</dt><dd>{ACTIVITY.asset_id}</dd></div>
            <div><dt>Boundary</dt><dd>{ACTIVITY.boundary}</dd></div>
            <div><dt>Geography</dt><dd>{ACTIVITY.geography.state}, {ACTIVITY.geography.country}</dd></div>
            <div><dt>Reviewed subregion</dt><dd>{ACTIVITY.geography.egrid_subregion}</dd></div>
            <div><dt>Period</dt><dd>{ACTIVITY.reporting_period.start} → {ACTIVITY.reporting_period.end}</dd></div>
            <div className="calculation-quantity"><dt>Purchased electricity</dt><dd><strong>{ACTIVITY.quantity}</strong> {ACTIVITY.unit}</dd></div>
          </dl>
          <button className="research-primary-button" type="button" disabled={busy} onClick={() => calculate()}>{busy ? "Calculating…" : "Calculate locally"}<span aria-hidden="true">→</span></button>
          <p className="calculation-local-note">No model, credentials, upload, or external service is used.</p>
        </article>

        <article className="calculation-card calculation-result-card" aria-live="polite">
          <div className="calculation-card-heading"><span>02</span><div><p>Result</p><h2>Location-based preview</h2></div></div>
          {!record && !error && <div className="calculation-empty"><span>—</span><p>Run the fixed synthetic activity to create a calculation record.</p></div>}
          {error && <div className="calculation-error" role="alert"><span>{error.code}</span><h3>No result produced</h3><p>{error.message}</p><small>Field: {error.field} · prior results cleared</small></div>}
          {record && <>
            <div className="calculation-total"><span>Scope 2 location-based total</span><strong>{record.total.display}</strong><em>{record.total.unit}</em><p>Development preview — cannot be added to an inventory or report.</p></div>
            <div className="calculation-gases">{(["co2", "ch4", "n2o"] as const).map((gas) => <div key={gas}><span>{gas.toUpperCase()}</span><strong>{record.gas_results[gas].co2e}</strong><small>kg CO2e reference</small></div>)}</div>
            <div className="calculation-actions"><button type="button" onClick={replay} disabled={busy}>Replay calculation record</button><button type="button" onClick={download}>Download record</button></div>
            {replayed && <p className="calculation-replay-ok" role="status">Replay matched the canonical payload and hash.</p>}
          </>}
        </article>
      </div>

      <section className="calculation-validation" aria-labelledby="electricity-validation-heading">
        <div><p className="research-eyebrow">Fail-closed checks</p><h2 id="electricity-validation-heading">Challenge the electricity contract.</h2><p>No unit, subregion, or reporting period is inferred or silently replaced.</p></div>
        <div className="calculation-validation-buttons">{NEGATIVE_EXAMPLES.map((example) => <button type="button" key={example.label} disabled={busy} onClick={() => calculate(example.activity)}><span>{example.label}</span><code>{example.expected}</code></button>)}</div>
      </section>

      {record && factor && <details className="calculation-trace">
        <summary><span>03</span><div><strong>How this was calculated</strong><small>Published total, rounded gas columns, lineage, and hashes</small></div><b aria-hidden="true">+</b></summary>
        <div className="calculation-trace-body">
          <section><h3>Arithmetic trace</h3><ol>{record.trace.map((step) => <li key={step.step}><code>{step.expression}</code><span>=</span><strong>{step.result} {step.unit}</strong></li>)}</ol><p>{record.reconciliation?.explanation}</p></section>
          <section><h3>Pinned eGRID candidate</h3><dl><div><dt>ID</dt><dd>{factor.id}</dd></div><div><dt>Version / data year</dt><dd>{factor.version} / {factor.data_year}</dd></div><div><dt>Published total</dt><dd>{factor.total_output_co2e.value} {factor.total_output_co2e.unit} · {factor.total_output_co2e.cell}</dd></div><div><dt>Source</dt><dd>{factor.source.title}</dd></div><div><dt>Locator</dt><dd>{factor.source.sheet}; {factor.source.row_cells.join(", ")}</dd></div><div><dt>Candidate hash</dt><dd><ShortHash value={factor.candidate_sha256} /></dd></div><div><dt>Workbook hash</dt><dd><ShortHash value={factor.source.workbook_sha256} /></dd></div></dl></section>
          <section><h3>Method and GWP policy</h3><dl><div><dt>Method</dt><dd>{record.method.id} · {record.method.version}</dd></div><div><dt>Scope</dt><dd>{record.method.scope} · {record.method.category}</dd></div><div><dt>GWP</dt><dd>{record.gwp_policy.assessment}, {record.gwp_policy.time_horizon_years}-year · CH4 {record.gwp_policy.values.ch4} · N2O {record.gwp_policy.values.n2o}</dd></div><div><dt>Implementation</dt><dd><ShortHash value={record.method.implementation_sha256} /></dd></div></dl></section>
          <section><h3>Replay identity</h3><dl><div><dt>Input snapshot</dt><dd><ShortHash value={record.input_snapshot_sha256} /></dd></div><div><dt>Result payload</dt><dd><ShortHash value={record.result_payload_sha256} /></dd></div><div><dt>Release eligible</dt><dd>{String(record.classification.release_eligible)}</dd></div></dl></section>
        </div>
      </details>}

      <div className="calculation-limits"><p>This synthetic example demonstrates one location-based calculation only. The CAMX subregion is declared in the fixture and is never inferred from “California.”</p><p>The factor and method remain development candidates. No customer data, provider request, inventory release, filing, merge, or deployment occurs.</p></div>
    </section>
  )
}
