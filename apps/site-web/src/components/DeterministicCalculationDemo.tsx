import { useState, type RefObject } from "react"
import { calculateSyntheticActivity, replayCalculationRecord, type CalculationError, type CalculationRecord, type SyntheticActivity } from "@/lib/calculation-api"

const SYNTHETIC_ACTIVITY: SyntheticActivity = {
  asset_id: "Synthetic boiler 001",
  boundary: "Owned stationary combustion source",
  geography: "United States",
  reporting_period: { start: "2025-01-01", end: "2025-12-31" },
  fuel: "Natural Gas",
  quantity: "1",
  unit: "MMBtu",
}

const NEGATIVE_EXAMPLES = [
  { label: "Wrong unit", activity: { ...SYNTHETIC_ACTIVITY, unit: "therm" }, expected: "unit_conversion_unapproved" },
  { label: "Missing geography", activity: { ...SYNTHETIC_ACTIVITY, geography: "" }, expected: "geography_required" },
  { label: "Wrong period", activity: { ...SYNTHETIC_ACTIVITY, reporting_period: { start: "2024-01-01", end: "2024-12-31" } }, expected: "reporting_period_mismatch" },
] as const

function ShortHash({ value }: { value: string }) {
  return <code title={value}>{value.slice(0, 12)}…{value.slice(-8)}</code>
}

export function DeterministicCalculationDemo({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  const [record, setRecord] = useState<CalculationRecord | null>(null)
  const [error, setError] = useState<CalculationError | null>(null)
  const [busy, setBusy] = useState(false)
  const [replayed, setReplayed] = useState(false)

  async function calculate(activity: SyntheticActivity = SYNTHETIC_ACTIVITY) {
    setBusy(true)
    setError(null)
    setRecord(null)
    setReplayed(false)
    try {
      const response = await calculateSyntheticActivity(activity)
      if (response.status === "error") setError(response.error)
      else setRecord(response.record)
    } catch {
      setError({ code: "calculation_unavailable", field: "system", message: "Start the local deterministic calculation service, then try again." })
    } finally {
      setBusy(false)
    }
  }

  async function replay() {
    if (!record) return
    setBusy(true)
    setError(null)
    try {
      const response = await replayCalculationRecord(record)
      if (response.status === "error") {
        setRecord(null)
        setError(response.error)
      } else {
        setRecord(response.record)
        setReplayed(response.hash_match === true)
      }
    } catch {
      setRecord(null)
      setError({ code: "calculation_unavailable", field: "system", message: "The local replay could not be completed." })
    } finally {
      setBusy(false)
    }
  }

  function download() {
    if (!record) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "neuvetra-m42-synthetic-calculation.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="calculation-demo" aria-labelledby="calculation-heading">
      <div className="calculation-banner" role="status"><strong>Development calculation</strong><span>Synthetic data</span><span>Factor candidate not released</span></div>
      <header className="calculation-intro">
        <p className="research-eyebrow">Milestone 42 · deterministic accounting</p>
        <h1 id="calculation-heading" ref={headingRef} tabIndex={-1}>Follow the number.</h1>
        <p className="research-intro">One bounded Scope 1 example shows how synthetic natural-gas activity becomes a gas-resolved result with pinned units, factors, policy, and replay evidence.</p>
      </header>

      <div className="calculation-layout">
        <article className="calculation-card">
          <div className="calculation-card-heading"><span>01</span><div><p>Activity</p><h2>Synthetic boiler input</h2></div></div>
          <dl className="calculation-inputs">
            <div><dt>Asset</dt><dd>{SYNTHETIC_ACTIVITY.asset_id}</dd></div>
            <div><dt>Boundary</dt><dd>{SYNTHETIC_ACTIVITY.boundary}</dd></div>
            <div><dt>Geography</dt><dd>{SYNTHETIC_ACTIVITY.geography}</dd></div>
            <div><dt>Period</dt><dd>{SYNTHETIC_ACTIVITY.reporting_period.start} → {SYNTHETIC_ACTIVITY.reporting_period.end}</dd></div>
            <div><dt>Fuel</dt><dd>{SYNTHETIC_ACTIVITY.fuel}</dd></div>
            <div className="calculation-quantity"><dt>Measured activity</dt><dd><strong>{SYNTHETIC_ACTIVITY.quantity}</strong> {SYNTHETIC_ACTIVITY.unit}</dd></div>
          </dl>
          <button className="research-primary-button" type="button" disabled={busy} onClick={() => calculate()}>{busy ? "Calculating…" : "Calculate locally"}<span aria-hidden="true">→</span></button>
          <p className="calculation-local-note">No model, credentials, upload, or external service is used.</p>
        </article>

        <article className="calculation-card calculation-result-card" aria-live="polite">
          <div className="calculation-card-heading"><span>02</span><div><p>Result</p><h2>Deterministic preview</h2></div></div>
          {!record && !error && <div className="calculation-empty"><span>—</span><p>Run the fixed synthetic activity to create a calculation record.</p></div>}
          {error && <div className="calculation-error" role="alert"><span>{error.code}</span><h3>No result produced</h3><p>{error.message}</p><small>Field: {error.field} · prior results cleared</small></div>}
          {record && (
            <>
              <div className="calculation-total"><span>Scope 1 total</span><strong>{record.total.display}</strong><em>{record.total.unit}</em><p>Development preview — cannot be added to an inventory or report.</p></div>
              <div className="calculation-gases">
                {(["co2", "ch4", "n2o"] as const).map((gas) => <div key={gas}><span>{gas.toUpperCase()}</span><strong>{record.gas_results[gas].co2e}</strong><small>kg CO2e</small></div>)}
              </div>
              <div className="calculation-actions">
                <button type="button" onClick={replay} disabled={busy}>Replay calculation record</button>
                <button type="button" onClick={download}>Download record</button>
              </div>
              {replayed && <p className="calculation-replay-ok" role="status">Replay matched the canonical payload and hash.</p>}
            </>
          )}
        </article>
      </div>

      <section className="calculation-validation" aria-labelledby="validation-heading">
        <div><p className="research-eyebrow">Fail-closed checks</p><h2 id="validation-heading">Challenge the contract.</h2><p>Each fixed example must stop before a total is shown. No unit, geography, or reporting period is silently substituted.</p></div>
        <div className="calculation-validation-buttons">
          {NEGATIVE_EXAMPLES.map((example) => <button type="button" key={example.label} disabled={busy} onClick={() => calculate(example.activity)}><span>{example.label}</span><code>{example.expected}</code></button>)}
        </div>
      </section>

      {record && (
        <details className="calculation-trace">
          <summary><span>03</span><div><strong>How this was calculated</strong><small>Exact values, lineage, and hashes</small></div><b aria-hidden="true">+</b></summary>
          <div className="calculation-trace-body">
            <section><h3>Arithmetic trace</h3><ol>{record.trace.map((step) => <li key={step.step}><code>{step.expression}</code><span>=</span><strong>{step.result} {step.unit}</strong></li>)}</ol><p>Display: {record.total.rounding}</p></section>
            <section><h3>Pinned factor candidate</h3><dl><div><dt>ID</dt><dd>{record.factor.id}</dd></div><div><dt>Version</dt><dd>{record.factor.version}</dd></div><div><dt>Source</dt><dd>{record.factor.source.title}</dd></div><div><dt>Locator</dt><dd>{record.factor.source.table}; cells {record.factor.source.row_cells.join(", ")}</dd></div><div><dt>Method notes</dt><dd>HHV {record.factor.source.method_note_cells.hhv}; combustion boundary {record.factor.source.method_note_cells.combustion_only_upstream_excluded}</dd></div><div><dt>Heat basis</dt><dd>{record.factor.heat_basis}</dd></div><div><dt>Candidate hash</dt><dd><ShortHash value={record.factor.candidate_sha256} /></dd></div><div><dt>Workbook hash</dt><dd><ShortHash value={record.factor.source.workbook_sha256} /></dd></div></dl></section>
            <section><h3>Method and GWP policy</h3><dl><div><dt>Method</dt><dd>{record.method.id} · {record.method.version}</dd></div><div><dt>Implementation</dt><dd><ShortHash value={record.method.implementation_sha256} /></dd></div><div><dt>GWP</dt><dd>{record.gwp_policy.assessment}, {record.gwp_policy.time_horizon_years}-year · CH4 {record.gwp_policy.values.ch4} · N2O {record.gwp_policy.values.n2o}</dd></div><div><dt>GWP source</dt><dd>{record.gwp_policy.source.table}; horizon {record.gwp_policy.source.horizon_cell}; CO2/CH4/N2O values {record.gwp_policy.source_cells.co2}, {record.gwp_policy.source_cells.ch4}, {record.gwp_policy.source_cells.n2o}; notes {record.gwp_policy.source.assessment_note_cells.join(", ")}</dd></div><div><dt>GWP source hash</dt><dd><ShortHash value={record.gwp_policy.source.workbook_sha256} /></dd></div><div><dt>Conversion</dt><dd>{record.conversion.ratio}</dd></div></dl></section>
            <section><h3>Replay identity</h3><dl><div><dt>Input snapshot</dt><dd><ShortHash value={record.input_snapshot_sha256} /></dd></div><div><dt>Result payload</dt><dd><ShortHash value={record.result_payload_sha256} /></dd></div><div><dt>Runtime</dt><dd>{String(record.classification.runtime).replace(/_/g, " ")}</dd></div><div><dt>Release eligible</dt><dd>{String(record.classification.release_eligible)}</dd></div></dl></section>
          </div>
        </details>
      )}

      <div className="calculation-limits"><p>This local synthetic example demonstrates calculation mechanics only. The factor and method are development candidates, not a released factor set or compliance determination.</p><p>No customer data, source expansion, provider request, deployment, merge, inventory release or filing occurs in this demo.</p></div>
    </section>
  )
}
