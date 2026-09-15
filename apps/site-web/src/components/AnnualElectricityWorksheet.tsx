import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react"
import { ANNUAL_LIMITATION_LABELS, ANNUAL_LIMITATIONS, MONTH_LABELS, annualWorksheetRequest, type AnnualElectricityWorksheet as Worksheet, type AnnualWorksheetVersion } from "@/lib/m67-api"
import { AnnualWorksheetReports } from "./AnnualWorksheetReports"
import { M67_MONTHS } from "../../../../packages/neuvetra-database/src/m67-contract"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"

export function AnnualElectricityWorksheet({ actor, workspaceId, headingRef }: { actor: HostedWorkspaceActor; workspaceId: string | null; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const [saved, setSaved] = useState<Worksheet | null>(null)
  const [company, setCompany] = useState("Synthetic Acme, Inc.")
  const [facility, setFacility] = useState("Synthetic California office")
  const [quantities, setQuantities] = useState<string[]>(Array(12).fill(""))
  const [reason, setReason] = useState("")
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(Boolean(workspaceId))
  const [message, setMessage] = useState(workspaceId ? "Loading your worksheet…" : "No company workspace is assigned. Contact the staging owner.")
  const [error, setError] = useState(false)
  const [choice, setChoice] = useState<"accept_bounded_internal_draft" | "changes_requested">("accept_bounded_internal_draft")
  const [note, setNote] = useState("")
  const [acknowledged, setAcknowledged] = useState<string[]>([])
  const requestLock = useRef(false)
  const pending = useRef<{ signature: string; key: string } | null>(null)
  const actorRef = useRef(actor)
  const current = saved?.versions[saved.versions.length - 1]
  const manager = actor.role !== "member"
  const canReview = manager && current && current.createdBy !== actor.userId && !current.review
  const statusRef = useRef<HTMLParagraphElement>(null)

  function accept(data: Worksheet, fill = true) {
    setSaved(data)
    const latest = data.versions[data.versions.length - 1]
    if (latest && fill) { setCompany(latest.companyLabel); setFacility(latest.facilityLabel); setQuantities(latest.months.map(m => m.quantityKwh ?? "")) }
    setEditing(false); setReason(""); setAcknowledged([]); setNote("")
  }
  useEffect(() => {
    let alive = true
    if (!workspaceId) return
    annualWorksheetRequest(actorRef.current, workspaceId).then(data => { if (alive) { accept(data); setMessage(data.versions.length ? "Your saved worksheet is ready." : "Enter at least one fictional monthly quantity to create your first annual draft.") } }).catch(e => { if (alive && !actorRef.current.signal?.aborted) { setError(true); setMessage(e instanceof Error ? e.message : "Could not load the worksheet.") } }).finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [workspaceId])

  async function run(action: "read" | "create" | "corrections" | "reviews", payload?: Record<string, unknown>) {
    if (!workspaceId || requestLock.current || actor.signal?.aborted) return
    requestLock.current = true; setBusy(true); setError(false)
    const signature = JSON.stringify({ action, payload })
    if (action !== "read" && pending.current?.signature !== signature) pending.current = { signature, key: crypto.randomUUID() }
    try {
      const data = await annualWorksheetRequest(actor, workspaceId, action, payload ? { ...payload, idempotencyKey: pending.current!.key } as Parameters<typeof annualWorksheetRequest>[3] : undefined)
      actor.signal?.throwIfAborted(); accept(data); pending.current = null
      setMessage(action === "read" ? "Your saved worksheet is up to date." : action === "reviews" ? "The decision is saved for this exact version. The worksheet remains an incomplete, unreleased draft." : "The draft is saved. A different manager can now review this exact version.")
    } catch (e) { if (!actor.signal?.aborted) { setError(true); setMessage(e instanceof Error ? e.message : "Could not save the worksheet.") } }
    finally { requestLock.current = false; if (!actor.signal?.aborted) { setBusy(false); statusRef.current?.focus() } }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    const payload = { companyLabel: company, facilityLabel: facility, months: M67_MONTHS.map((month,i)=>({month,quantityKwh:quantities[i] === "" ? null : quantities[i]})), year: 2023, geography: "CAMX", unit: "kWh" }
    void run(current ? "corrections" : "create", current ? { ...payload, expectedVersionId: current.id, expectedResultSha256: current.resultSha256, correctionReason: reason } : payload)
  }
  function review(event: FormEvent) { event.preventDefault(); if (current) void run("reviews", { versionId: current.id, expectedResultSha256: current.resultSha256, decision: choice, note: choice === "changes_requested" ? note : null, acknowledgedLimitations: choice === "accept_bounded_internal_draft" ? ANNUAL_LIMITATIONS.filter(item => acknowledged.includes(item)) : [] }) }

  return <section className="worksheet">
    <p className="worksheet-eyebrow">Private · synthetic · deterministic</p>
    <h1 ref={headingRef} tabIndex={-1}>Full-year electricity worksheet</h1>
    <p>Enter fictional monthly electricity use, see the coverage and saved subtotal, and ask another manager to review the exact annual draft.</p>
    <div className="worksheet-context"><span>January–December 2023</span><span>United States · California · CAMX</span><span>Operational control · Location-based Scope 2</span></div>
    <p>One fictional facility only. Annual entries are manual and have no linked bill evidence. The separate January bill-linked worksheet does not provide evidence or approval for this annual worksheet.</p>
    <p ref={statusRef} tabIndex={-1} role={error ? "alert" : "status"} className={error ? "worksheet-error" : "worksheet-status"}>{message}</p>
    <button type="button" disabled={busy || !workspaceId} onClick={() => void run("read")}>Refresh saved worksheet</button>
    {saved && manager && (!current || editing) && <form className="worksheet-card worksheet-form" onSubmit={submit}>
      <h2>{current ? `Correct version ${current.version}` : "Create a synthetic draft"}</h2>
      <p>{current ? "Saving creates a new version. Earlier quantities and reviews remain in history. Change a monthly entry or label and explain the correction." : "Use invented labels and quantities only. Do not enter customer data."}</p>
      <fieldset disabled={busy}>
        <label>Fictional company<input required maxLength={100} value={company} onChange={e => setCompany(e.target.value)} /></label>
        <label>Fictional facility<input required maxLength={100} value={facility} onChange={e => setFacility(e.target.value)} /></label>
        <p id="annual-quantity-help">For each month, enter 0 to 1,000,000 kWh with up to three decimal places, without commas. Leave unknown months blank. Enter zero only when you intend to record zero use.</p>
        <div className="annual-month-grid">{M67_MONTHS.map((month,i)=><label key={month}>{MONTH_LABELS[i]} (kWh)<input inputMode="decimal" maxLength={11} aria-describedby="annual-quantity-help" value={quantities[i]} onChange={e=>setQuantities(values=>values.map((v,j)=>j===i?e.target.value:v))} /><span>{quantities[i] === "" ? "Not entered" : "Entered — calculated after saving"}</span></label>)}</div>
        <p role="status">{quantities.filter(q=>q!=="").length} of 12 months entered. {quantities.every(q=>q==="") ? "No subtotal. Enter at least one month to save." : "The saved subtotal will exclude months not entered."}</p>
        {current && <label>Reason for correction<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>}
        <button type="submit" disabled={quantities.every(q=>q==="")}>{busy ? "Saving…" : current ? "Save corrected version" : "Save and calculate draft"}</button>
        {current && <button type="button" onClick={() => { accept(saved); setMessage("Correction discarded. The saved version is unchanged.") }}>Cancel correction</button>}
      </fieldset>
    </form>}
    {saved && !manager && !current && <p>A manager has not saved a worksheet yet. Your access is read-only.</p>}
    {current && <>
      <VersionCard version={current} label={editing ? "Previously saved result — unsaved edits are not calculated" : "Current saved draft"} />
      {saved && !editing && <AnnualWorksheetReports key={current.id + (current.review?.id ?? "none")} actor={actor} worksheet={saved} version={current} />}
      {manager && !editing && <button type="button" disabled={busy} onClick={() => { setEditing(true); setMessage("Change monthly entries or labels and enter a reason. The saved result below will remain unchanged until you save.") }}>Correct annual entries</button>}
      {!manager && <p>Your access is read-only. A manager can correct or review this worksheet.</p>}
      {manager && current.createdBy === actor.userId && !current.review && <p>A different authorized manager must review this version. You cannot review your own entry.</p>}
      {canReview && !editing && <form className="worksheet-card worksheet-form" onSubmit={review}>
        <h2>Review version {current.version}</h2><p>Check the fictional labels, every monthly entry, missing months and saved subtotal above. Your decision applies only to this saved version.</p>
        <fieldset disabled={busy}><legend>Decision</legend>
          <label className="worksheet-check"><input type="radio" name="annual-review-decision" checked={choice === "accept_bounded_internal_draft"} onChange={() => setChoice("accept_bounded_internal_draft")} />Accept for bounded internal use</label>
          <label className="worksheet-check"><input type="radio" name="annual-review-decision" checked={choice === "changes_requested"} onChange={() => setChoice("changes_requested")} />Request a correction</label>
          {choice === "accept_bounded_internal_draft" ? ANNUAL_LIMITATIONS.map(item => <label className="worksheet-check" key={item}><input type="checkbox" required checked={acknowledged.includes(item)} onChange={e => setAcknowledged(values => e.target.checked ? [...values, item] : values.filter(v => v !== item))} />{ANNUAL_LIMITATION_LABELS[item]}</label>) : <label>What should be corrected?<textarea required maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>}
          <button type="submit">Save review decision</button>
        </fieldset>
      </form>}
      {saved && saved.versions.length > 1 && <details className="worksheet-history"><summary>Previous versions ({saved.versions.length - 1})</summary>{saved.versions.slice(0, -1).reverse().map(v => <div key={v.id}><VersionCard version={v} label="Historical saved draft" /><AnnualWorksheetReports actor={actor} worksheet={saved} version={v} /></div>)}</details>}
    </>}
    <p className="worksheet-footnote">Synthetic manual entries only, without linked bills. Twelve entered months establish electricity period coverage only. The company inventory remains incomplete and unreleased, with no assurance.</p>
  </section>
}

function VersionCard({ version: v, label }: { version: AnnualWorksheetVersion; label: string }) {
  return <article className="worksheet-card"><p className="worksheet-eyebrow">{label} · Version {v.version}</p><h2>{v.companyLabel}</h2><p>{v.facilityLabel}</p>
    <dl className="worksheet-result"><div><dt>Electricity in entered months</dt><dd>{v.quantityKwh} kWh</dd></div><div><dt>{v.coverage.electricityComplete ? "Full-year electricity subtotal" : "Entered-month electricity subtotal"}</dt><dd>{v.total.display} <small>kg CO2e</small></dd></div></dl>
    <p>{v.coverage.knownMonths} of 12 months entered. {v.coverage.electricityComplete ? "Full-year electricity coverage; the company inventory is still incomplete." : "This subtotal excludes months not entered."}</p>
    <div className="annual-table-wrap"><table className="annual-month-table"><caption>Saved monthly entries — manual, with no linked bills</caption><thead><tr><th scope="col">Month</th><th scope="col">Electricity (kWh)</th><th scope="col">Subtotal (kg CO2e)</th></tr></thead><tbody>{v.months.map((m,i)=><tr key={m.month}><th scope="row">{MONTH_LABELS[i]}</th><td>{m.quantityKwh ?? "Not entered"}</td><td>{m.total?.display ?? "Not entered"}</td></tr>)}</tbody></table></div>
    <p>The subtotal is rounded after summing exact monthly values. Displayed monthly amounts may not sum to the displayed subtotal.</p>
    <p>{v.review ? v.review.decision === "accept_bounded_internal_draft" ? "Accepted for bounded internal use — still incomplete and unreleased." : "Correction requested by another manager." : "Awaiting a different manager’s review."}</p>
    {v.correctionReason && <p>Correction reason: {v.correctionReason}</p>}{v.review?.note && <p>Reviewer’s note: {v.review.note}</p>}
    <details><summary>Calculation and saved-version details</summary><dl className="worksheet-details"><dt>Converted electricity</dt><dd>{v.quantityMwh} MWh</dd><dt>Candidate factor</dt><dd>{v.method.factorValue} {v.method.factorUnit} · eGRID2023 revision 2 · SRL23, AI6</dd><dt>Exact subtotal before display rounding</dt><dd>{v.total.unrounded} kg CO2e</dd><dt>Display rounding</dt><dd>Four decimal places, half to even. Decimal precision does not establish measurement certainty.</dd><dt>Saved input fingerprint</dt><dd>{v.inputSha256}</dd><dt>Saved result fingerprint</dt><dd>{v.resultSha256}</dd>{v.review && <><dt>Review fingerprint</dt><dd>{v.review.decisionSha256}</dd></>}</dl></details>
  </article>
}
