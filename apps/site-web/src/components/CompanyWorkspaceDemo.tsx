import { useRef, useState, type RefObject } from "react"
import {
  calculateSyntheticBill, correctSyntheticBill, createSyntheticWorkspace, decideSyntheticInventory, INVENTORY_WARNINGS, linkSyntheticBill, prepareSyntheticInventory, replaySyntheticBillCalculation, revisitSyntheticBill, revisitSyntheticInventory,
  revisitSyntheticWorkspace, uploadSyntheticBill, type CompanyWorkspace, type SyntheticBill, type SyntheticInventory, type WorkspaceActor,
} from "@/lib/workspace-api"
import syntheticBillUrl from "@m55-bill"

const WORKSPACE_KEY = "neuvetra:m54:synthetic-workspace-id"
const BILL_KEY = "neuvetra:m55:synthetic-bill-id"
const ACTOR_IDS = { owner: "11111111-1111-4111-8111-111111111111", admin: "33333333-3333-4333-8333-333333333333" } as const
export function CompanyWorkspaceDemo({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  const [actor, setActor] = useState<WorkspaceActor>("owner")
  const [workspace, setWorkspace] = useState<CompanyWorkspace | null>(null)
  const [bill, setBill] = useState<SyntheticBill | null>(null)
  const [inventory, setInventory] = useState<SyntheticInventory | null>(null)
  const [acknowledged, setAcknowledged] = useState<string[]>([])
  const [savedId, setSavedId] = useState(() => window.localStorage.getItem(WORKSPACE_KEY) ?? "")
  const [savedBillId, setSavedBillId] = useState(() => window.localStorage.getItem(BILL_KEY) ?? "")
  const [facilityConfirmed, setFacilityConfirmed] = useState(false)
  const [message, setMessage] = useState("Ready to create the fixed synthetic workspace.")
  const [isError, setIsError] = useState(false)
  const [busy, setBusy] = useState(false)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const facilityRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLHeadingElement>(null)
  const inventoryRef = useRef<HTMLHeadingElement>(null)

  function showError(error: unknown, fallback: string) {
    setIsError(true)
    setMessage(error instanceof Error ? error.message : fallback)
    requestAnimationFrame(() => statusRef.current?.focus())
  }

  async function runWorkspace(action: "create" | "revisit") {
    setBusy(true); setIsError(false); setWorkspace(null); setBill(null); setInventory(null)
    try {
      const result = action === "create" ? await createSyntheticWorkspace(actor) : await revisitSyntheticWorkspace(savedId, actor)
      setWorkspace(result); setSavedId(result.id); window.localStorage.setItem(WORKSPACE_KEY, result.id)
      if (savedBillId) {
        setBill(await revisitSyntheticBill(result.id, savedBillId, actor))
        try { setInventory(await revisitSyntheticInventory(result.id, actor)) } catch (error) { if (!(error instanceof Error) || error.message !== "Inventory not found.") throw error }
      }
      setMessage(action === "create" ? "Workspace created in one transaction." : "The saved workspace and its evidence were revisited.")
    } catch (error) { showError(error, "The workspace is unavailable.") }
    finally { setBusy(false) }
  }

  async function addBill() {
    if (!workspace) return
    setBusy(true); setIsError(false); setMessage("Uploading and extracting the fixed synthetic statement…")
    try {
      const response = await fetch(syntheticBillUrl)
      if (!response.ok) throw new Error("The synthetic statement is unavailable.")
      const file = new File([await response.arrayBuffer()], "neuvetra-m55-synthetic-electricity-bill.pdf", { type: "application/pdf" })
      const result = await uploadSyntheticBill(workspace.id, actor, file)
      setBill(result); setSavedBillId(result.id); window.localStorage.setItem(BILL_KEY, result.id)
      setMessage("Extraction complete. The facility and proposed correction need review.")
    } catch (error) { showError(error, "The bill evidence is unavailable.") }
    finally { setBusy(false) }
  }

  async function updateBill(action: "correct" | "link") {
    if (!workspace || !bill) return
    setBusy(true); setIsError(false)
    try {
      const result = action === "correct" ? await correctSyntheticBill(workspace, bill.id, actor) : await linkSyntheticBill(workspace, bill.id, actor)
      setBill(result)
      setMessage(action === "correct" ? "Reviewed correction saved as immutable version 2." : "Version 2 is linked to the 2023 draft boundary. No emissions were calculated.")
    } catch (error) { showError(error, "The bill evidence is unavailable.") }
    finally { setBusy(false) }
  }

  async function calculateBill() {
    if (!workspace || !bill) return
    setBusy(true); setIsError(false); setMessage("Calculating from the reviewed linked version…")
    try {
      const result = await calculateSyntheticBill(workspace.id, bill.id, actor)
      setBill(result)
      setMessage("Draft calculation saved with its activity, bill, factor, method, and source lineage.")
      requestAnimationFrame(() => resultRef.current?.focus())
    } catch (error) { setBill((current) => current ? { ...current, draftCalculation: null } : current); showError(error, "The draft calculation is unavailable.") }
    finally { setBusy(false) }
  }

  async function replayCalculation() {
    if (!workspace || !bill?.draftCalculation) return
    setBusy(true); setIsError(false); setMessage("Reauthorizing the lineage and replaying the stored calculation…")
    try {
      const result = await replaySyntheticBillCalculation(workspace.id, bill.id, bill.draftCalculation.record, actor)
      setBill(result); setMessage("Replay matched the same authorized lineage and exact deterministic result.")
    } catch (error) { showError(error, "Replay could not be verified.") }
    finally { setBusy(false) }
  }

  function downloadCalculation() {
    if (!bill?.draftCalculation) return
    const blob = new Blob([JSON.stringify(bill.draftCalculation.record, null, 2) + "\n"], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `neuvetra-m56-${bill.draftCalculation.id}.json`; anchor.click()
    URL.revokeObjectURL(url)
  }

  async function prepareInventory() {
    if (!workspace || !bill?.draftCalculation) return
    setBusy(true); setIsError(false); setMessage("Sealing the exact calculation and completeness warnings into inventory version 1…")
    try { const result = await prepareSyntheticInventory(workspace.id, bill.draftCalculation.id, actor); setInventory(result); setMessage("Inventory version 1 is sealed and awaiting the other manager's review."); requestAnimationFrame(() => inventoryRef.current?.focus()) }
    catch (error) { showError(error, "The inventory could not be prepared.") } finally { setBusy(false) }
  }

  async function decideInventory(decision: "approve_bounded_draft" | "changes_requested") {
    if (!inventory) return
    if (decision === "approve_bounded_draft" && acknowledged.length !== INVENTORY_WARNINGS.length) { setIsError(true); setMessage("Acknowledge every visible limitation before approving this bounded draft."); requestAnimationFrame(() => statusRef.current?.focus()); return }
    setBusy(true); setIsError(false)
    try { const result = await decideSyntheticInventory(inventory, decision, actor); setInventory(result); setMessage(decision === "approve_bounded_draft" ? "Independent decision recorded. The bounded draft is approved for internal development and remains incomplete and unreleased." : "Changes requested in immutable review history."); requestAnimationFrame(() => inventoryRef.current?.focus()) }
    catch (error) { showError(error, "The inventory decision could not be recorded.") } finally { setBusy(false) }
  }

  function reviewBill() {
    if (!facilityConfirmed) {
      setIsError(true); setMessage("Facility required. Choose the authorized facility before saving the review.")
      requestAnimationFrame(() => facilityRef.current?.focus())
      return
    }
    void updateBill("correct")
  }

  function changeActor(next: WorkspaceActor) {
    setActor(next); setIsError(false); setWorkspace(null); setBill(null); setInventory(null); setAcknowledged([]); setFacilityConfirmed(false)
    setMessage(next === "owner" ? "Synthetic owner selected." : next === "admin" ? "Synthetic administrator selected." : next === "member" ? "Synthetic read-only member selected." : next === "outsider" ? "Synthetic outsider selected." : "Signed out.")
  }

  return (
    <section className="workspace-demo" aria-labelledby="workspace-heading">
      <div className="workspace-demo-heading"><div>
        <p className="research-eyebrow">M57 local development demonstration</p>
        <h1 id="workspace-heading" ref={headingRef} tabIndex={-1}>One exact calculation enters an honest inventory review.</h1>
        <p className="research-intro">Seal the accepted fictional January result into a versioned 2023 Scope 2 draft, show what is missing, and require the other manager's immutable decision.</p>
      </div><span className="research-outline-label">Local · synthetic · deterministic</span></div>
      <div className="workspace-identity" role="group" aria-label="Synthetic identity">
        {(["owner", "admin", "member", "outsider", "signed_out"] as const).map((item) => <button type="button" key={item} disabled={busy} aria-pressed={actor === item} onClick={() => changeActor(item)}>{item === "owner" ? "Signed-in owner" : item === "admin" ? "Administrator" : item === "member" ? "Read-only member" : item === "outsider" ? "Other tenant" : "Signed out"}</button>)}
      </div>
      <div className="workspace-actions">
        <button className="research-primary-button" type="button" disabled={busy || actor !== "owner" || Boolean(savedId)} onClick={() => runWorkspace("create")}>Create synthetic workspace</button>
        <button className="research-secondary-button" type="button" disabled={busy || !savedId} onClick={() => runWorkspace("revisit")}>Revisit saved workspace</button>
        <button className="research-text-link" type="button" disabled={busy || !savedId} onClick={() => { window.localStorage.removeItem(WORKSPACE_KEY); window.localStorage.removeItem(BILL_KEY); setSavedId(""); setSavedBillId(""); setWorkspace(null); setBill(null); setMessage("Saved browser pointers cleared; database rows were not changed.") }}>Clear browser pointers</button>
      </div>
      <p className="workspace-message" ref={statusRef} tabIndex={-1} role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"}>{busy ? "Checking the tenant boundary…" : message}</p>
      {workspace && <>
        <div className="workspace-record">
          <div><span>Company</span><strong>{workspace.companyName}</strong><small>{workspace.countryCode} / {workspace.stateCode}</small></div>
          <div><span>Facility</span><strong>{workspace.facility.name}</strong><small>eGRID subregion {workspace.facility.egridSubregion}</small></div>
          <div><span>Boundary</span><strong>{workspace.boundary.reportingYear} · Operational control</strong><small>Draft · version {workspace.boundary.version}</small></div>
        </div>
        <div className="bill-panel">
          <div className="bill-panel-heading"><div><p className="research-eyebrow">Electricity evidence</p><h2>January 2023 synthetic statement</h2></div><a href={syntheticBillUrl} target="_blank" rel="noreferrer">View fixed PDF</a></div>
          {!bill ? <button className="research-primary-button" type="button" disabled={busy || (actor !== "owner" && actor !== "admin")} onClick={addBill}>Add synthetic electricity bill</button> : <>
            <div className="bill-facts"><div><span>Status</span><strong>{bill.state === "needs_review" ? "Needs review" : bill.state === "reviewed" ? "Reviewed" : "Linked to draft"}</strong></div><div><span>Original</span><strong>12,345 kWh</strong><small>Jan 1–31, 2023 · version 1</small></div><div><span>Facility</span><strong>{bill.versions[bill.versions.length - 1]?.facilityId ? workspace.facility.name : "Not assigned"}</strong><small>Never inferred from the document</small></div></div>
            <p className="bill-source">{bill.supplierName} · account {bill.accountLabel} · bill {bill.billNumber} · source bytes {bill.sourceLocators.electricityKwh.startByte}–{bill.sourceLocators.electricityKwh.endByte}</p>
            {bill.state === "needs_review" && <div className="bill-review"><label><input ref={facilityRef} type="checkbox" checked={facilityConfirmed} aria-describedby={!facilityConfirmed && isError ? "facility-error" : undefined} onChange={(event) => { setFacilityConfirmed(event.target.checked); setIsError(false) }} /> Assign to {workspace.facility.name}</label>{!facilityConfirmed && isError && <p id="facility-error" className="bill-field-error">Facility required.</p>}<p>Reviewer override: 12,345 → <strong>12,346 kWh</strong></p><p>Reason: Synthetic review exercise</p><button className="research-primary-button" type="button" disabled={busy || (actor !== "owner" && actor !== "admin")} onClick={reviewBill}>Save reviewed correction</button></div>}
            {bill.state === "reviewed" && <button className="research-primary-button" type="button" disabled={busy || (actor !== "owner" && actor !== "admin")} onClick={() => updateBill("link")}>Link version 2 to 2023 draft</button>}
            <div className="bill-history"><h3>Immutable history</h3>{bill.versions.map((version) => <p key={version.id}><strong>Version {version.version}</strong> · {Number(version.electricityKwh).toLocaleString()} kWh{version.correctionReason ? ` · ${version.correctionReason}` : " · deterministic extraction"}</p>)}</div>
            {bill.draftActivity && !bill.draftCalculation && <div className="bill-draft"><strong>Draft evidence — ready to calculate</strong><span>{bill.draftActivity.quantityMwh} MWh · pinned to version 2</span><button className="research-primary-button" type="button" disabled={busy || (actor !== "owner" && actor !== "admin")} onClick={calculateBill}>Calculate location-based draft</button>{actor === "member" && <small>Read-only members can inspect results but cannot create them.</small>}</div>}
            {bill.draftCalculation && <div className="bill-calculation">
              <p className="research-eyebrow">Draft calculation · development factor · not released</p>
              <h3 ref={resultRef} tabIndex={-1}>Draft location-based result</h3>
              <div className="bill-calculation-total"><strong>{Number(bill.draftCalculation.total.display).toLocaleString(undefined, { minimumFractionDigits: 4 })}</strong><span aria-label="kilograms of carbon dioxide equivalent">kg CO2e</span></div>
              <dl><div><dt>Reviewed activity</dt><dd>{bill.draftCalculation.normalizedQuantityMwh} MWh</dd></div><div><dt>Factor</dt><dd>{bill.draftCalculation.factor.value} kg CO2e/MWh</dd></div><div><dt>Geography and year</dt><dd>CAMX · 2023 factor data</dd></div><div><dt>Evidence</dt><dd>Bill version {bill.draftCalculation.billVersion} · January 2023</dd></div><div><dt>Created</dt><dd>{new Date(bill.draftCalculation.createdAt).toLocaleString()} · actor {bill.draftCalculation.createdBy}</dd></div></dl>
              <details><summary>Inspect exact calculation and lineage</summary><p>Unrounded: {bill.draftCalculation.total.unrounded} kg CO2e</p><p>Published AI6 total is authoritative. Component sum: {bill.draftCalculation.reconciliation.componentSum}; delta: {bill.draftCalculation.reconciliation.componentRoundingDelta} kg CO2e.</p><p>Source: EPA eGRID2023 revision 2 · {bill.draftCalculation.factor.sheet}!{bill.draftCalculation.factor.totalOutputCell}</p><p>Method: {bill.draftCalculation.method.id} · {bill.draftCalculation.method.version}</p><p className="bill-hash">Bill version {bill.draftCalculation.billVersionPayloadSha256}</p><p className="bill-hash">Input {bill.draftCalculation.inputSnapshotSha256}</p><p className="bill-hash">Result {bill.draftCalculation.resultPayloadSha256}</p></details>
              <div className="calculation-actions"><button className="research-secondary-button" type="button" onClick={downloadCalculation}>Download exact record</button><button className="research-secondary-button" type="button" disabled={busy || (actor !== "owner" && actor !== "admin")} onClick={replayCalculation}>Replay and verify</button></div>
              {!inventory && <button className="research-primary-button inventory-prepare" type="button" disabled={busy || (actor !== "owner" && actor !== "admin")} onClick={prepareInventory}>Prepare 2023 Scope 2 review</button>}
            </div>}
            {inventory && <section className="inventory-review" aria-labelledby="inventory-review-heading">
              <p className="research-eyebrow">Inventory version {inventory.version} · immutable snapshot</p>
              <h3 id="inventory-review-heading" ref={inventoryRef} tabIndex={-1}>{inventory.reviewState === "awaiting_review" ? "Awaiting independent review" : inventory.reviewState === "approved_bounded_draft" ? "Approved bounded draft" : "Changes requested"}</h3>
              <div className="inventory-state"><strong>Incomplete synthetic draft</strong><span>1 of 12 monthly periods · reporting boundary remains draft</span></div>
              <div className="inventory-table-wrap"><table><caption>Current draft subtotal; this is not a complete company emissions total.</caption><thead><tr><th>Facility</th><th>Period</th><th>Activity</th><th>Location-based subtotal</th></tr></thead><tbody><tr><td>{workspace.facility.name}</td><td>Jan 1–31, 2023</td><td>{inventory.line.quantityMwh} MWh</td><td>{Number(inventory.line.subtotalKgCo2e).toLocaleString(undefined, { minimumFractionDigits: 4 })} kg CO2e</td></tr></tbody></table></div>
              <div className="inventory-warnings"><h4>Limitations that remain after review</h4><ul>
                <li>Only January is covered; February–December have no represented evidence. Missing months are not treated as zero.</li>
                <li>Market-based Scope 2 is not included.</li><li>The factor and method are development candidates and are not released.</li><li>This local synthetic review is not assurance; Scope 1 and Scope 3 are not assessed.</li>
              </ul></div>
              <details><summary>Inspect sealed inventory lineage</summary><p>Calculation {inventory.calculationId}</p><p className="bill-hash">Result {inventory.line.calculationResultSha256}</p><p className="bill-hash">Inventory {inventory.snapshotSha256}</p><p>Submitted by {inventory.submittedBy} at {new Date(inventory.submittedAt).toLocaleString()}.</p></details>
              {!inventory.decision && <div className="inventory-decision">
                <p><strong>The submitter cannot review this version.</strong> Switch to the other authorized manager, revisit the workspace, and acknowledge each limitation.</p>
                {INVENTORY_WARNINGS.map((warning, index) => <label key={warning}><input type="checkbox" checked={acknowledged.includes(warning)} onChange={(event) => setAcknowledged((current) => event.target.checked ? [...current, warning] : current.filter((item) => item !== warning))} /> {index === 0 ? "Annual coverage is only 1 of 12 months" : index === 1 ? "Market-based Scope 2 is absent" : index === 2 ? "Factor and method are unreleased" : "Synthetic local work is not assurance"}</label>)}
                <div className="calculation-actions"><button type="button" disabled={busy || (actor !== "owner" && actor !== "admin") || ACTOR_IDS[actor as "owner" | "admin"] === inventory.submittedBy || acknowledged.length !== INVENTORY_WARNINGS.length} onClick={() => decideInventory("approve_bounded_draft")}>Approve bounded draft</button><button type="button" disabled={busy || (actor !== "owner" && actor !== "admin") || ACTOR_IDS[actor as "owner" | "admin"] === inventory.submittedBy} onClick={() => decideInventory("changes_requested")}>Request changes</button></div>
              </div>}
              {inventory.decision && <div className="inventory-history"><h4>Immutable decision history</h4><p><strong>{inventory.decision.outcome === "approved_bounded_draft" ? "Approved bounded draft" : "Changes requested"}</strong> · {new Date(inventory.decision.decidedAt).toLocaleString()} · reviewer {inventory.decision.decidedBy}</p><p>Completeness remains incomplete. Release eligibility remains false.</p></div>}
            </section>}
          </>}
        </div>
      </>}
      <p className="workspace-boundary-note">Local synthetic evidence and bounded draft review only. The bill is fictional and contains no customer data. The factor and method are not released. No filing, assurance, production database, deployment or release is involved.</p>
    </section>
  )
}
