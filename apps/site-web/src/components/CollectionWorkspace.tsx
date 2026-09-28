import { useEffect, useRef, useState, type RefObject } from "react"
import type { CollectionActivity, CollectionActivityKind, CollectionInstrument, CollectionPayload } from "../../../../packages/neuvetra-database/src/collection-contract"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import { CollectionApiError, downloadCollectionEvidence, listCollectionActivities, listCollectionEvidence, listGridLossLineages, loadCollectionVersion, saveCollectionActivity, saveGridLossLineage, uploadCollectionEvidence, type CollectionActivityRecord, type CollectionActivitySaveInput, type CollectionActivityVersion, type CollectionEvidenceMetadata, type GridLossLineage } from "@/lib/collection-api"

const kinds: readonly [CollectionActivityKind, string][] = [
  ["natural_gas", "Natural gas"], ["distillate_no2", "Diesel or fuel-oil generator"],
  ["vehicle", "Road vehicle or vehicle group"], ["fugitive", "Refrigerants and fire suppression"],
  ["electricity", "Purchased electricity"],
]
const gases = ["HFC-134a", "HFC-227ea", "R-404A", "R-407C", "R-410A", "R-507A", "R-22", "R-12", "R-502"] as const
const technologies = ["wind", "solar_photovoltaic", "hydro", "nuclear", "geothermal", "natural_gas", "coal", "oil", "biomass", "biogas", "landfill_gas", "mixed", "unknown"] as const
const instrumentTypes: readonly [CollectionInstrument["type"], string][] = [["energy_attribute_certificate", "Energy attribute certificate"], ["power_purchase_agreement", "Power purchase agreement"], ["green_tariff", "Green tariff"], ["supplier_specific_rate", "Supplier-specific rate"]]
const supportedUnits: Record<CollectionActivityKind, readonly string[]> = {
  natural_gas: ["therm", "MMBtu", "scf", "ccf", "mcf"],
  distillate_no2: ["US_gallon"], vehicle: ["US_gallon"], fugitive: ["kg", "lb"], electricity: ["kWh", "MWh"],
}
const DECIMAL = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/

function initial(kind: CollectionActivityKind): CollectionActivity {
  const unit = supportedUnits[kind][0]!
  const payload: CollectionPayload = kind === "natural_gas" ? { heatContent: null }
    : kind === "distillate_no2" ? { consumption: { basis: "measured", gallons: "" }, statedHhvMmbtuPerGallon: null }
    : kind === "vehicle" ? { vehicleGroupId: "", fuel: "diesel", vehicleType: "", modelYear: 2025, gallons: "", vehicleCount: null, miles: null, fuelEconomy: null }
    : kind === "fugitive" ? { gas: "HFC-134a", unit: "kg", terms: { PN: "", CN: "", PS: "", CD: "", RD: "" }, insideBoundary: null, maintainsRefrigerantStock: null, retrofitInPeriod: null, contractorRecordsComplete: false, eventChronologyComplete: false }
    : { meterOrAccountNumber: "", utilityName: "", site: "", zip: "", subregion: "", utilityEiaId: null, instruments: [] }
  return { kind, quantity: { originalValue: "", originalUnit: unit, normalizedValue: null, normalizedUnit: null }, quality: "unknown", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "", notes: "", evidenceIds: [], payload } as CollectionActivity
}

function Field({ label, value, onChange, hint, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; hint?: string; type?: string; required?: boolean }) {
  return <label className="setup-field"><span>{label}</span><input type={type} required={required} value={value} onChange={event => onChange(event.target.value)} />{hint && <small>{hint}</small>}</label>
}
function Select({ label, value, options, onChange, hint }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void; hint?: string }) {
  return <label className="setup-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>{hint && <small>{hint}</small>}</label>
}
function Tri({ label, value, onChange }: { label: string; value: boolean | null; onChange: (value: boolean | null) => void }) {
  return <Select label={label} value={value === null ? "unknown" : value ? "yes" : "no"} options={[["unknown", "I don't know yet"], ["yes", "Yes"], ["no", "No"]]} onChange={item => onChange(item === "unknown" ? null : item === "yes")} />
}
const answer = (value: boolean | null) => value === null ? "Unknown" : value ? "Yes" : "No"
function HistoricalActivityDetail({ version, evidence }: { version: CollectionActivityVersion; evidence: CollectionEvidenceMetadata[] }) {
  const activity = version.activity
  const p = activity.payload
  return <div className="setup-history-detail">
    <h4>Saved version {version.revision}</h4>
    <p>Saved {new Date(version.createdAt).toLocaleString()}. Read only. {version.correctionReason || "Initial entry"}</p>
    <dl className="collection-history-fields">
      <dt>Activity</dt><dd>{kinds.find(([kind]) => kind === activity.kind)?.[1]}</dd>
      <dt>Period</dt><dd>{activity.period.start} to {activity.period.endExclusive} (end exclusive)</dd>
      <dt>Original quantity</dt><dd>{activity.quantity.originalValue || "Unknown"} {activity.quantity.originalUnit}</dd>
      <dt>Normalized quantity</dt><dd>{activity.quantity.normalizedValue === null ? "Not calculable yet" : `${activity.quantity.normalizedValue} ${activity.quantity.normalizedUnit}`}</dd>
      <dt>Quality</dt><dd>{activity.quality}{activity.estimateBasis ? ` · ${activity.estimateBasis}` : ""}</dd>
      <dt>Reference</dt><dd>{activity.reference || "None entered"}</dd>
      <dt>Notes</dt><dd>{activity.notes || "None entered"}</dd>
      <dt>Evidence</dt><dd>{activity.evidenceIds.length ? activity.evidenceIds.map(id => evidence.find(item => item.id === id)?.originalName ?? id).join("; ") : "None linked"}</dd>
      {activity.kind === "natural_gas" && "heatContent" in p && <><dt>Bill heat content</dt><dd>{p.heatContent ? `${p.heatContent.value} ${p.heatContent.unit}` : "Unknown or not required"}</dd></>}
      {activity.kind === "distillate_no2" && "consumption" in p && <><dt>Generator basis</dt><dd>{p.consumption.basis.replace(/_/g, " ")}</dd><dt>Fuel amounts</dt><dd>{p.consumption.basis === "measured" ? `${p.consumption.gallons || "unknown"} gallons used` : `${p.consumption.purchasedGallons || "unknown"} gallons purchased${p.consumption.basis === "purchases_with_tank_levels" ? `; opening ${p.consumption.openingGallons || "unknown"}; closing ${p.consumption.closingGallons || "unknown"}` : ""}`}</dd><dt>Stated heating value</dt><dd>{p.statedHhvMmbtuPerGallon || "None"}</dd></>}
      {activity.kind === "vehicle" && "vehicleGroupId" in p && <><dt>Vehicle or group ID</dt><dd>{p.vehicleGroupId}</dd><dt>Fuel and vehicle</dt><dd>{p.fuel}; {p.vehicleType}; model year {p.modelYear}; {p.gallons || "unknown"} US gallons; {p.vehicleCount ?? "unknown"} vehicles</dd><dt>Distance</dt><dd>{p.miles ? `${p.miles.value || "unknown"} miles (${p.miles.basis})` : "No miles recorded"}</dd><dt>Fuel economy</dt><dd>{p.fuelEconomy ? `${p.fuelEconomy.mpg || "unknown"} mpg (${p.fuelEconomy.source})` : "No MPG recorded"}</dd></>}
      {activity.kind === "fugitive" && "terms" in p && <><dt>Gas and unit</dt><dd>{p.gas}, {p.unit}</dd><dt>Five material-balance terms</dt><dd>PN {p.terms.PN || "unknown"}; CN {p.terms.CN || "unknown"}; PS {p.terms.PS || "unknown"}; CD {p.terms.CD || "unknown"}; RD {p.terms.RD || "unknown"}</dd><dt>Boundary</dt><dd>{answer(p.insideBoundary)}</dd><dt>Refrigerant stock tracked</dt><dd>{answer(p.maintainsRefrigerantStock)}</dd><dt>Retrofit during period</dt><dd>{answer(p.retrofitInPeriod)}</dd><dt>Contractor records complete</dt><dd>{answer(p.contractorRecordsComplete)}</dd><dt>Event chronology complete</dt><dd>{answer(p.eventChronologyComplete)}</dd></>}
      {activity.kind === "electricity" && "instruments" in p && <><dt>Site and meter</dt><dd>{p.site}; {p.meterOrAccountNumber}; utility {p.utilityName}</dd><dt>Grid location</dt><dd>ZIP {p.zip}; subregion {p.subregion || "unresolved"}; utility EIA ID {p.utilityEiaId || "unresolved"}</dd><dt>Instruments</dt><dd>{p.instruments.length ? <ol>{p.instruments.map((instrument, index) => <li key={index}>{instrument.type.replace(/_/g, " ")}; {instrument.mwh || "unknown"} MWh; vintage {instrument.vintageYear}; {instrument.generationTechnology.replace(/_/g, " ")}; quality criteria {answer(instrument.qualityCriteriaMet)}; evidence {instrument.evidenceReference ? evidence.find(item => item.id === instrument.evidenceReference)?.originalName ?? instrument.evidenceReference : "missing"}; rate {instrument.rateLbPerMwh ? `CO2 ${instrument.rateLbPerMwh.co2 || "unknown"}, CH4 ${instrument.rateLbPerMwh.ch4 ?? "unknown"}, N2O ${instrument.rateLbPerMwh.n2o ?? "unknown"} lb/MWh` : "missing"}</li>)}</ol> : "None"}</dd></>}
    </dl>
  </div>
}

export function CollectionWorkspace({ actor, workspaceId, headingRef, onDirtyChange }: { actor: HostedWorkspaceActor; workspaceId: string | null; headingRef: RefObject<HTMLHeadingElement | null>; onDirtyChange: (dirty: boolean) => void }) {
  const [records, setRecords] = useState<CollectionActivityRecord[]>([])
  const [evidence, setEvidence] = useState<CollectionEvidenceMetadata[]>([])
  const [lineages, setLineages] = useState<GridLossLineage[]>([])
  const [recordId, setRecordId] = useState<string>(() => crypto.randomUUID())
  const [draft, setDraft] = useState<CollectionActivity>(() => initial("natural_gas"))
  const [historical, setHistorical] = useState<CollectionActivityVersion | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("Loading collection records…")
  const [error, setError] = useState(false)
  const [dirty, setDirty] = useState(false)
  const pending = useRef<CollectionActivitySaveInput | null>(null)
  const pendingUpload = useRef<{ fingerprint: string; id: string } | null>(null)
  const actorRef = useRef(actor)
  useEffect(() => { actorRef.current = actor }, [actor])
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  const selected = records.find(item => item.id === recordId) ?? null
  const canManage = actor.role === "owner" || actor.role === "admin"

  useEffect(() => {
    if (!workspaceId) { queueMicrotask(() => { setError(true); setMessage("Choose an admitted synthetic company to continue.") }); return }
    const controller = new AbortController()
    const requestActor = { ...actorRef.current, signal: controller.signal }
    queueMicrotask(() => { setBusy(true); setMessage("Loading collection records…"); setError(false) })
    void Promise.all([listCollectionActivities(workspaceId, requestActor), listCollectionEvidence(workspaceId, requestActor), listGridLossLineages(workspaceId, requestActor)]).then(([items, files, grid]) => {
      if (controller.signal.aborted) return
      setRecords(items); setEvidence(files); setLineages(grid)
      setMessage("Activity and evidence are collected as drafts. No emissions are counted until a reviewed method is released.")
    }).catch(cause => { if (!controller.signal.aborted) { setError(true); setMessage(cause instanceof Error ? cause.message : "Collection is unavailable.") } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [actor.userId, workspaceId])

  function edit(change: (next: CollectionActivity) => void) {
    if (!canManage || busy) return
    const next = structuredClone(draft); change(next); setDraft(next); setDirty(true); setHistorical(null); pending.current = null; setError(false)
    setMessage("Changes are not saved yet. Unknown or unsupported values will remain visible, never counted as zero.")
  }
  function switchKind(kind: CollectionActivityKind) {
    if (dirty && !window.confirm("Discard unsaved activity changes?")) return
    setDraft(initial(kind)); setRecordId(crypto.randomUUID()); setReason(""); setDirty(false); setHistorical(null); pending.current = null
  }
  function openRecord(row: CollectionActivityRecord) {
    if (dirty && !window.confirm("Discard unsaved activity changes?")) return
    setRecordId(row.id); setDraft(structuredClone(row.currentVersion.activity)); setReason(""); setDirty(false); setHistorical(null); pending.current = null
  }
  async function refresh() {
    if (!workspaceId || busy) return
    if (dirty && !window.confirm("Discard unsaved activity changes and reload saved records?")) return
    setBusy(true); setError(false)
    try {
      const [items, files, grid] = await Promise.all([listCollectionActivities(workspaceId, actorRef.current), listCollectionEvidence(workspaceId, actorRef.current), listGridLossLineages(workspaceId, actorRef.current)])
      setRecords(items); setEvidence(files); setLineages(grid)
      const current = items.find(item => item.id === recordId)
      if (current) setDraft(structuredClone(current.currentVersion.activity))
      setDirty(false); setHistorical(null); pending.current = null; setReason(""); setMessage("Latest saved records loaded.")
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Collection is unavailable.") }
    finally { setBusy(false) }
  }
  async function save() {
    if (!workspaceId || !canManage || busy) return
    if (selected && reason.trim().length < 3) { setError(true); setMessage("Explain this correction before saving a new version."); return }
    if (draft.kind === "electricity" && !/^\d{5}$/.test((draft.payload as Extract<CollectionPayload, {zip: string}>).zip)) { setError(true); setMessage("A five-digit ZIP is required for every electricity record."); return }
    const copy = structuredClone(draft)
    if (copy.kind === "vehicle" && !copy.quantity.originalValue) copy.quantity.originalValue = copy.payload.gallons
    if (copy.kind === "distillate_no2" && !copy.quantity.originalValue) copy.quantity.originalValue = copy.payload.consumption.basis === "measured" ? copy.payload.consumption.gallons : copy.payload.consumption.purchasedGallons
    const quantity = copy.quantity
    if (DECIMAL.test(quantity.originalValue) && supportedUnits[copy.kind].includes(quantity.originalUnit)) {
      quantity.normalizedValue = quantity.originalValue; quantity.normalizedUnit = quantity.originalUnit
    } else { quantity.normalizedValue = null; quantity.normalizedUnit = null }
    const input = pending.current ?? { idempotencyKey: crypto.randomUUID(), expectedRevision: selected?.currentVersion.revision ?? 0, expectedVersionId: selected?.currentVersion.id ?? null, correctionReason: selected ? reason.trim() : null, activity: copy }
    pending.current = input; setBusy(true); setError(false); setMessage("Saving and verifying this activity…")
    try {
      const result = await saveCollectionActivity(workspaceId, recordId, input, actorRef.current)
      const items = await listCollectionActivities(workspaceId, actorRef.current)
      const current = items.find(item => item.id === result.record.id)
      if (!current) throw new Error("Saved activity could not be read back.")
      setRecords(items); setRecordId(current.id); setDraft(structuredClone(current.currentVersion.activity)); setDirty(false); setReason(""); pending.current = null
      setMessage(result.replayed ? "The earlier save was confirmed. The latest saved version is shown." : "Saved. Previous versions remain in correction history.")
    } catch (cause) {
      setError(true)
      if (cause instanceof CollectionApiError && cause.conflict) { pending.current = null; setMessage("This record changed elsewhere. Reload before correcting it.") }
      else setMessage(`${cause instanceof Error ? cause.message : "Activity could not be saved."} Retry keeps the same save request.`)
    } finally { setBusy(false) }
  }
  async function showVersion(versionId: string) {
    if (!workspaceId || !selected) return
    setBusy(true); setError(false)
    try { setHistorical(await loadCollectionVersion(workspaceId, selected.id, versionId, actorRef.current)); setMessage("Showing an earlier saved version. It cannot be changed.") }
    catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Earlier version unavailable.") }
    finally { setBusy(false) }
  }
  async function upload(file: File) {
    if (!workspaceId || !canManage) return
    const fingerprint = `${file.name}\u0000${file.size}\u0000${file.lastModified}`
    const uploadId = pendingUpload.current?.fingerprint === fingerprint ? pendingUpload.current.id : crypto.randomUUID()
    pendingUpload.current = { fingerprint, id: uploadId }
    setBusy(true); setError(false); setMessage("Uploading private evidence…")
    try {
      const result = await uploadCollectionEvidence(workspaceId, file, uploadId, actorRef.current)
      setEvidence(await listCollectionEvidence(workspaceId, actorRef.current))
      pendingUpload.current = null
      setMessage(`Evidence received (${result.receipt.reused ? "existing original reused" : "new original"}). It remains quarantined until independently cleared.`)
    } catch (cause) {
      setError(true)
      if (cause instanceof CollectionApiError && [401, 403, 413, 415].includes(cause.status)) {
        pendingUpload.current = null
        setMessage(cause.message)
      } else {
        setMessage(`Upload was not confirmed. Reference ${uploadId}. Ask the operator to reconcile this attempt before retrying; an original may be waiting in quarantine. Reload this page after the operator confirms recovery.`)
      }
    }
    finally { setBusy(false) }
  }
  async function download(item: CollectionEvidenceMetadata) {
    if (!workspaceId) return
    setBusy(true); setError(false)
    try {
      const response = await downloadCollectionEvidence(workspaceId, item.id, actorRef.current)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a"); link.href = url; link.download = item.originalName; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setMessage("Original evidence downloaded.")
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Original evidence is unavailable.") }
    finally { setBusy(false) }
  }
  async function addGridLoss(row: CollectionActivityRecord) {
    if (!workspaceId || !canManage || row.kind !== "electricity") return
    setBusy(true); setError(false)
    try { await saveGridLossLineage(workspaceId, row.id, row.currentVersion.activity.reference, "Linked to the purchased-electricity original; category 3 calculation awaits a reviewed release.", actorRef.current); setLineages(await listGridLossLineages(workspaceId, actorRef.current)); setMessage("Grid-loss source linked to this electricity record. No Scope 3 amount was calculated.") }
    catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Grid-loss link could not be saved.") }
    finally { setBusy(false) }
  }

  const p = draft.payload
  return <section className="worksheet collection-workspace" aria-busy={busy}>
    <p className="worksheet-eyebrow">Activity collection · Synthetic staging</p>
    <h1 ref={headingRef} tabIndex={-1}>Collect Scope 1 and 2 activity</h1>
    <p>Save source details and private evidence for each activity. Missing answers remain unresolved. Calculations and reports come only from reviewed, released methods.</p>
    <p role={error ? "alert" : "status"} className={error ? "worksheet-error" : "worksheet-status"}>{message}</p>
    {!canManage && <p>Owner or admin access is needed to save activity or upload evidence.</p>}

    <div className="worksheet-card"><h2>Saved activities</h2>
      <div className="collection-record-list">{records.length ? records.map(row => <div key={row.id} className="setup-subcard">
        <strong>{kinds.find(([id]) => id === row.kind)?.[1] ?? row.kind}</strong> · version {row.currentVersion.revision}
        <p>{row.currentVersion.activity.period.start} to {row.currentVersion.activity.period.endExclusive} (end exclusive) · {row.currentVersion.activity.quantity.originalValue || "Quantity unknown"} {row.currentVersion.activity.quantity.originalUnit}</p>
        <button type="button" disabled={busy} onClick={() => openRecord(row)}>Review or correct</button>
        {row.kind === "electricity" && <button type="button" disabled={busy || !canManage || lineages.some(item => item.electricityRecordId === row.id)} onClick={() => void addGridLoss(row)}>{lineages.some(item => item.electricityRecordId === row.id) ? "Grid-loss source linked" : "Link grid-loss source"}</button>}
      </div>) : <p>No activity records saved yet.</p>}</div>
      <button type="button" disabled={busy} onClick={() => void refresh()}>Reload saved records</button>
    </div>

    <div className="worksheet-card worksheet-form"><h2>{selected ? `Correct saved ${kinds.find(([id]) => id === selected.kind)?.[1]}` : "New activity record"}</h2>
      <div className="worksheet-nav" aria-label="Activity types">{kinds.map(([kind, label]) => <button type="button" key={kind} aria-pressed={draft.kind === kind} disabled={busy} onClick={() => switchKind(kind)}>{label}</button>)}</div>
      <fieldset className="setup-inputs" disabled={busy || !canManage}>
        <div className="setup-grid">
          <Field label="Period start" type="date" value={draft.period.start} onChange={value => edit(next => { next.period.start = value })} />
          <Field label="Period end (exclusive)" type="date" value={draft.period.endExclusive} onChange={value => edit(next => { next.period.endExclusive = value })} hint="For a bill ending December 31, enter January 1 of the next year." />
          {(draft.kind === "natural_gas" || draft.kind === "electricity") && <Field label="Original quantity from source" value={draft.quantity.originalValue} onChange={value => edit(next => { next.quantity.originalValue = value })} hint="Keep the source text. Unknown or more than 3 decimals is saved but not calculated." />}
          <Field label="Original unit as printed" value={draft.quantity.originalUnit} onChange={value => edit(next => { next.quantity.originalUnit = value })} hint={`Engine tokens for this kind: ${supportedUnits[draft.kind].join(", ")}. Other units stay saved but uncalculated.`} />
          <Select label="Data quality" value={draft.quality} options={[["unknown", "Unknown"], ["actual", "Actual"], ["estimated", "Estimated"]]} onChange={value => edit(next => { next.quality = value as CollectionActivity["quality"]; next.estimateBasis = value === "estimated" ? "" : null })} />
          {draft.quality === "estimated" && <Field label="How was this estimate made?" value={draft.estimateBasis ?? ""} onChange={value => edit(next => { next.estimateBasis = value })} />}
          <Field label="Source reference" value={draft.reference} onChange={value => edit(next => { next.reference = value })} hint="Bill number, log, contractor record or other locator." />
          <label className="setup-field"><span>Notes and unresolved questions</span><textarea value={draft.notes} onChange={event => edit(next => { next.notes = event.target.value })} /></label>
        </div>
        {draft.kind === "natural_gas" && "heatContent" in p && <div className="setup-subcard"><h3>Natural gas</h3><p>For scf, ccf or mcf, use the heat content printed on the bill. Do not assume a conversion.</p><div className="setup-grid">
          <Field label="Bill heat content" value={p.heatContent?.value ?? ""} onChange={value => edit(next => { (next.payload as typeof p).heatContent = value ? { value, unit: p.heatContent?.unit ?? "MMBtu per ccf" } : null })} />
          <Select label="Heat-content unit" value={p.heatContent?.unit ?? "MMBtu per ccf"} options={[["MMBtu per scf", "MMBtu per scf"], ["MMBtu per ccf", "MMBtu per ccf"], ["MMBtu per mcf", "MMBtu per mcf"], ["therm per ccf", "therm per ccf"]]} onChange={value => edit(next => { (next.payload as typeof p).heatContent = { value: p.heatContent?.value ?? "", unit: value as NonNullable<typeof p.heatContent>["unit"] } })} />
        </div></div>}
        {draft.kind === "distillate_no2" && "consumption" in p && <div className="setup-subcard"><h3>Generator fuel</h3><div className="setup-grid">
          <Select label="How was fuel use determined?" value={p.consumption.basis} options={[["measured", "Measured gallons used"], ["purchases_with_tank_levels", "Purchases with opening and closing tank levels"], ["purchases_only", "Purchases only — input needed"]]} onChange={value => edit(next => { (next.payload as typeof p).consumption = value === "measured" ? { basis: "measured", gallons: "" } : value === "purchases_with_tank_levels" ? { basis: "purchases_with_tank_levels", purchasedGallons: "", openingGallons: "", closingGallons: "" } : { basis: "purchases_only", purchasedGallons: "" }; next.quantity.originalValue = ""; next.quantity.normalizedValue = null; next.quantity.normalizedUnit = null })} />
          {p.consumption.basis === "measured" ? <Field label="Gallons used" value={p.consumption.gallons} onChange={value => edit(next => { (next.payload as typeof p & {consumption:{gallons:string}}).consumption.gallons = value; next.quantity.originalValue = value })} /> : <>
            <Field label="Purchased gallons" value={p.consumption.purchasedGallons} onChange={value => edit(next => { (next.payload as typeof p & {consumption:{purchasedGallons:string}}).consumption.purchasedGallons = value; next.quantity.originalValue = value })} />
            {p.consumption.basis === "purchases_with_tank_levels" && <><Field label="Opening tank level (gallons)" value={p.consumption.openingGallons} onChange={value => edit(next => { (next.payload as typeof p & {consumption:{openingGallons:string}}).consumption.openingGallons = value })} /><Field label="Closing tank level (gallons)" value={p.consumption.closingGallons} onChange={value => edit(next => { (next.payload as typeof p & {consumption:{closingGallons:string}}).consumption.closingGallons = value })} /></>}
          </>}
          <Field label="Stated heating value (MMBtu per gallon, optional)" value={p.statedHhvMmbtuPerGallon ?? ""} onChange={value => edit(next => { (next.payload as typeof p).statedHhvMmbtuPerGallon = value || null })} />
        </div></div>}
        {draft.kind === "vehicle" && "fuelEconomy" in p && <div className="setup-subcard"><h3>Vehicle or linked group</h3><div className="setup-grid">
          <Field label="Vehicle or group ID" value={p.vehicleGroupId} onChange={value => edit(next => { (next.payload as typeof p).vehicleGroupId = value })} hint="Use the same ID for fuel and miles from this vehicle/group." />
          <Field label="Fuel" value={p.fuel} onChange={value => edit(next => { (next.payload as typeof p).fuel = value })} />
          <Field label="Vehicle type" value={p.vehicleType} onChange={value => edit(next => { (next.payload as typeof p).vehicleType = value })} />
          <Field label="Model year" type="number" value={String(p.modelYear)} onChange={value => edit(next => { (next.payload as typeof p).modelYear = Number(value) })} />
          <Field label="Fuel used (US gallons)" value={p.gallons} onChange={value => edit(next => { (next.payload as typeof p).gallons = value; next.quantity.originalValue = value })} />
          <Field label="Vehicle count (optional)" type="number" value={p.vehicleCount === null ? "" : String(p.vehicleCount)} onChange={value => edit(next => { (next.payload as typeof p).vehicleCount = value ? Number(value) : null })} />
          <Field label="Miles driven" value={p.miles?.value ?? ""} onChange={value => edit(next => { (next.payload as typeof p).miles = value ? { value, basis: p.miles?.basis ?? "" } : null })} />
          <Field label="Miles source / basis" value={p.miles?.basis ?? ""} onChange={value => edit(next => { (next.payload as typeof p).miles = value ? { value: p.miles?.value ?? "", basis: value } : null })} />
          <Field label="Fuel economy (mpg), if miles unavailable" value={p.fuelEconomy?.mpg ?? ""} onChange={value => edit(next => { (next.payload as typeof p).fuelEconomy = value ? { mpg: value, source: p.fuelEconomy?.source ?? "" } : null })} />
          <Field label="MPG source" value={p.fuelEconomy?.source ?? ""} onChange={value => edit(next => { (next.payload as typeof p).fuelEconomy = value ? { mpg: p.fuelEconomy?.mpg ?? "", source: value } : null })} />
        </div></div>}
        {draft.kind === "fugitive" && "terms" in p && <div className="setup-subcard"><h3>One refrigerant per equipment or group</h3><div className="setup-grid">
          <Select label="Refrigerant or fire-suppression gas" value={p.gas} options={gases.map(gas => [gas, gas])} onChange={value => edit(next => { (next.payload as typeof p).gas = value as typeof p.gas })} />
          <Select label="Unit for all five terms" value={p.unit} options={[["kg", "kg"], ["lb", "lb"]]} onChange={value => edit(next => { (next.payload as typeof p).unit = value as typeof p.unit; next.quantity.originalUnit = value })} />
          {(["PN", "CN", "PS", "CD", "RD"] as const).map(term => <Field key={term} label={`${term} (${p.unit})`} value={p.terms[term]} onChange={value => edit(next => { (next.payload as typeof p).terms[term] = value })} hint="Enter 0 only when this event did not happen; do not use 0 for unknown." />)}
          <Tri label="Is the equipment inside your reporting boundary?" value={p.insideBoundary} onChange={value => edit(next => { (next.payload as typeof p).insideBoundary = value })} />
          <Tri label="Do you maintain and track a stock of refrigerant?" value={p.maintainsRefrigerantStock} onChange={value => edit(next => { (next.payload as typeof p).maintainsRefrigerantStock = value })} />
          <Tri label="Was any equipment converted to a different refrigerant during the year?" value={p.retrofitInPeriod} onChange={value => edit(next => { (next.payload as typeof p).retrofitInPeriod = value })} />
          <Select label="Contractor records complete?" value={p.contractorRecordsComplete ? "yes" : "no"} options={[["no", "No / unresolved"], ["yes", "Yes"]]} onChange={value => edit(next => { (next.payload as typeof p).contractorRecordsComplete = value === "yes" })} />
          <Select label="Event chronology complete?" value={p.eventChronologyComplete ? "yes" : "no"} options={[["no", "No / unresolved"], ["yes", "Yes"]]} onChange={value => edit(next => { (next.payload as typeof p).eventChronologyComplete = value === "yes" })} />
        </div><p>A yes to stock or retrofit needs method review; an unknown answer needs input. Only an explicit outside-boundary answer excludes.</p></div>}
        {draft.kind === "electricity" && "instruments" in p && <div className="setup-subcard"><h3>Electricity, site and grid region</h3><div className="setup-grid">
          <Field label="Site" value={p.site} onChange={value => edit(next => { (next.payload as typeof p).site = value })} />
          <Field label="Meter or account number" value={p.meterOrAccountNumber} onChange={value => edit(next => { (next.payload as typeof p).meterOrAccountNumber = value })} />
          <Field label="Utility name" value={p.utilityName} onChange={value => edit(next => { (next.payload as typeof p).utilityName = value })} />
          <Field label="ZIP code" value={p.zip} onChange={value => edit(next => { (next.payload as typeof p).zip = value })} hint="Required. A verified ZIP lookup and utility choice are needed before calculation." />
          <Field label="eGRID subregion (from verified lookup)" value={p.subregion} onChange={value => edit(next => { (next.payload as typeof p).subregion = value.toUpperCase() })} hint="Do not guess. For ZIPs in more than one subregion, identify the utility below." />
          <Field label="Utility EIA ID (if lookup lists multiple subregions)" value={p.utilityEiaId ?? ""} onChange={value => edit(next => { (next.payload as typeof p).utilityEiaId = value || null })} />
        </div><p>Location-based and market-based results will have separate statuses. Market-based remains provisional until the reviewed residual mix is released.</p>
          <h4>Certificates and other contractual instruments</h4>
          {p.instruments.map((item, index) => <div className="setup-subcard" key={`${index}-${item.type}`}><h4>Instrument {index + 1}</h4><div className="setup-grid">
            <Select label="Instrument type" value={item.type} options={instrumentTypes} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.type = value as CollectionInstrument["type"] })} />
            <Field label="Covered MWh" value={item.mwh} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.mwh = value })} />
            <Select label="Quality criteria confirmed?" value={item.qualityCriteriaMet ? "yes" : "no"} options={[["no", "No — market input needed"], ["yes", "Yes"]]} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.qualityCriteriaMet = value === "yes" })} />
            <Field label="Vintage year" type="number" value={String(item.vintageYear)} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.vintageYear = Number(value) })} />
            <Select label="Generation technology" value={item.generationTechnology} options={technologies.map(value => [value, value.replace(/_/g, " ")])} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.generationTechnology = value as CollectionInstrument["generationTechnology"] })} />
            <Select label="Supporting evidence" value={item.evidenceReference ?? ""} options={[["", "Choose an uploaded document"], ...evidence.map(file => [file.id, `${file.originalName} · ${file.quarantineStatus}`] as const)]} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.evidenceReference = value || null; if (value && !next.evidenceIds.includes(value)) next.evidenceIds.push(value) })} />
            <Field label="CO2 rate (lb/MWh)" value={item.rateLbPerMwh?.co2 ?? ""} onChange={value => edit(next => { const ch4 = item.rateLbPerMwh?.ch4 ?? null; const n2o = item.rateLbPerMwh?.n2o ?? null; (next.payload as typeof p).instruments[index]!.rateLbPerMwh = value || ch4 || n2o ? { co2: value, ch4, n2o } : null })} hint="Required for every technology except wind, solar PV, hydro and nuclear; also required for supplier-specific rates." />
            <Field label="CH4 rate (lb/MWh, if supplied)" value={item.rateLbPerMwh?.ch4 ?? ""} onChange={value => edit(next => { const current = (next.payload as typeof p).instruments[index]!; current.rateLbPerMwh = { co2: current.rateLbPerMwh?.co2 ?? "", ch4: value || null, n2o: current.rateLbPerMwh?.n2o ?? null } })} />
            <Field label="N2O rate (lb/MWh, if supplied)" value={item.rateLbPerMwh?.n2o ?? ""} onChange={value => edit(next => { const current = (next.payload as typeof p).instruments[index]!; current.rateLbPerMwh = { co2: current.rateLbPerMwh?.co2 ?? "", ch4: current.rateLbPerMwh?.ch4 ?? null, n2o: value || null } })} />
          </div><button type="button" onClick={() => edit(next => { (next.payload as typeof p).instruments.splice(index, 1) })}>Remove instrument</button></div>)}
          <button type="button" onClick={() => edit(next => { (next.payload as typeof p).instruments.push({ type: "energy_attribute_certificate", mwh: "", qualityCriteriaMet: false, vintageYear: 2025, evidenceReference: null, generationTechnology: "unknown", rateLbPerMwh: null }) })}>+ Add instrument</button>
          <p>Biomass, biogas and landfill gas are collected but remain input needed in this beta. No instrument is silently counted at zero.</p>
        </div>}
        <div className="setup-subcard"><h3>Evidence linked to this version</h3>{evidence.length ? evidence.map(file => <label className="collection-evidence-choice" key={file.id}><input type="checkbox" checked={draft.evidenceIds.includes(file.id)} onChange={event => edit(next => { next.evidenceIds = event.target.checked ? [...next.evidenceIds, file.id] : next.evidenceIds.filter(id => id !== file.id) })} /> {file.originalName} · {file.quarantineStatus}</label>) : <p>No evidence uploaded yet.</p>}</div>
        {selected && <Field label="Reason for this correction" value={reason} onChange={setReason} hint="Required for a new version. Earlier versions remain available." />}
        <button type="button" disabled={busy || !canManage || !dirty} onClick={() => void save()}>{selected ? "Save correction" : "Save activity"}</button>
      </fieldset>
      {selected && <><h3>Correction history</h3><ol className="setup-history">{selected.history.map(item => <li key={item.id}><button type="button" disabled={busy} onClick={() => void showVersion(item.id)}>Version {item.revision} · {new Date(item.createdAt).toLocaleString()}</button><span>{item.correctionReason || "Initial entry"}</span></li>)}</ol>{historical && <HistoricalActivityDetail version={historical} evidence={evidence} />}</>}
    </div>

    <div className="worksheet-card"><h2>Private evidence</h2><p>Originals are hashed, company-scoped and quarantined on upload. A pending or rejected file cannot be downloaded as cleared evidence.</p>
      {canManage && <label className="setup-field"><span>Upload PDF, image, CSV or XLSX (up to 10 MiB)</span><input type="file" accept="application/pdf,image/jpeg,image/png,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = "" }} /></label>}
      <ul>{evidence.map(file => <li key={file.id}>{file.originalName} · {file.byteLength.toLocaleString()} bytes · {file.quarantineStatus} · SHA-256 {file.sha256.slice(0, 12)}… {file.quarantineStatus === "clean" && <button type="button" disabled={busy} onClick={() => void download(file)}>Download original</button>}</li>)}</ul>
    </div>
    <p className="worksheet-footnote">This collection is a draft input set. A saved record, linked grid-loss source or uploaded file does not establish complete Scope 1, 2 or 3 coverage, a final market-based result, or external assurance.</p>
  </section>
}
