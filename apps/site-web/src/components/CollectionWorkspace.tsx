import { useEffect, useRef, useState, type RefObject } from "react"
import { deriveCollectionQuantity, type CollectionActivity, type CollectionActivityKind, type CollectionInstrument, type CollectionPayload } from "../../../../packages/neuvetra-database/src/collection-contract"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import { CollectionApiError, downloadCollectionEvidence, listCollectionActivities, listCollectionEvidence, listGridLossLineages, loadCollectionContext, loadCollectionVersion, lookupCollectionZip, saveCollectionActivity, saveGridLossLineage, uploadCollectionEvidence, type CollectionActivityRecord, type CollectionActivitySaveInput, type CollectionActivityVersion, type CollectionContext, type CollectionEvidenceMetadata, type CollectionZipLookup, type GridLossLineage } from "@/lib/collection-api"

const kinds: readonly [CollectionActivityKind, string][] = [
  ["natural_gas", "Natural gas"], ["distillate_no2", "Diesel or fuel-oil generator"],
  ["vehicle", "Road vehicle or vehicle group"], ["fugitive", "Refrigerants and fire suppression"],
  ["electricity", "Purchased electricity"],
]
const gases = ["HFC-134a", "HFC-227ea", "R-404A", "R-407C", "R-410A", "R-507A", "R-22", "R-12", "R-502"] as const
const technologies = ["wind", "solar_photovoltaic", "hydro", "nuclear", "geothermal", "natural_gas", "coal", "oil", "biomass", "biogas", "landfill_gas", "mixed", "unknown"] as const
const instrumentTypes: readonly [CollectionInstrument["type"], string][] = [["energy_attribute_certificate", "Energy attribute certificate"], ["power_purchase_agreement", "Power purchase agreement"], ["green_tariff", "Green tariff"], ["supplier_specific_rate", "Supplier-specific rate"]]
const vehicleFuels = ["gasoline", "diesel"] as const
const vehicleTypesByFuel = {
  gasoline: ["gasoline_passenger_car", "gasoline_light_duty_truck", "gasoline_heavy_duty", "gasoline_motorcycle"],
  diesel: ["diesel_passenger_car", "diesel_light_duty_truck", "diesel_medium_heavy_duty"],
} as const
const vehicleTypes = [...vehicleTypesByFuel.gasoline, ...vehicleTypesByFuel.diesel] as const
const supportedUnits: Record<CollectionActivityKind, readonly string[]> = {
  natural_gas: ["therm", "MMBtu", "scf", "ccf", "mcf"],
  distillate_no2: ["US_gallon"], vehicle: ["US_gallon"], fugitive: ["kg", "lb"], electricity: ["kWh", "MWh"],
}
const DECIMAL = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
const THOUSANDS_DECIMAL = /^(?:[1-9][0-9]{0,2})(?:,[0-9]{3})+(?:\.[0-9]{1,3})?$/
const VOLUMETRIC_GAS_UNITS = new Set(["scf", "ccf", "mcf"])
const ZERO_TECHNOLOGIES = new Set<CollectionInstrument["generationTechnology"]>(["wind", "solar_photovoltaic", "hydro", "nuclear"])
type CollectionDraft = CollectionActivity

function shiftDate(value: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ""
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return ""
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export const inclusivePeriodEnd = (endExclusive: string) => shiftDate(endExclusive, -1)
export const exclusivePeriodEnd = (lastDayCovered: string) => shiftDate(lastDayCovered, 1)
type CollectionSaveResult = Awaited<ReturnType<typeof saveCollectionActivity>>

function verifiedSavedRecord(companyId: string, recordId: string, result: CollectionSaveResult): CollectionActivityRecord {
  const { record, version } = result
  const versionSummary = record.history.find(item => item.id === version.id)
  if (record.id !== recordId || record.companyId !== companyId || record.currentVersion.recordId !== record.id || record.currentVersion.companyId !== companyId || version.recordId !== record.id || version.companyId !== companyId || !versionSummary || versionSummary.revision !== version.revision || (!result.replayed && record.currentVersion.id !== version.id)) {
    throw new Error("Saved activity could not be verified.")
  }
  return record
}

export function replaceSavedCollectionRecord(records: CollectionActivityRecord[], saved: CollectionActivityRecord): CollectionActivityRecord[] {
  const retained = records.filter(item => item.id !== saved.id)
  retained.push(saved)
  return retained.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
}

export async function saveAndVerifyCollectionActivity(companyId: string, recordId: string, input: CollectionActivitySaveInput, actor: HostedWorkspaceActor): Promise<CollectionSaveResult> {
  const result = await saveCollectionActivity(companyId, recordId, input, actor)
  verifiedSavedRecord(companyId, recordId, result)
  return result
}

export function requiresCurrentLocationReselection(activity: CollectionActivity, context: CollectionContext): boolean {
  return activity.setupVersionId !== context.setupVersionId || !context.locations.some(location => location.id === activity.locationId)
}

export function thousandsSeparatorSuggestion(value: string): string | null {
  if (!THOUSANDS_DECIMAL.test(value)) return null
  const suggestion = value.split(",").join("")
  return DECIMAL.test(suggestion) ? suggestion : null
}

function decimalReason(value: string, label: string): string | null {
  if (!value || value.toLowerCase() === "unknown") return `${label} is missing.`
  if (thousandsSeparatorSuggestion(value)) return `${label} uses thousands separators. Confirm the plain-decimal suggestion before calculation.`
  if (!DECIMAL.test(value)) return `${label} must be a plain decimal with no more than 12 digits before the point and 3 after it.`
  return null
}
function scaledDecimal(value: string): bigint | null {
  if (!DECIMAL.test(value)) return null
  const [whole, fraction = ""] = value.split(".")
  return BigInt(whole!) * 1000n + BigInt(fraction.padEnd(3, "0"))
}

export type CollectionReadinessFinding = { status: "input_needed" | "partial" | "review_required" | "excluded" | "memo_only" | "withdrawn"; reason: string }
export function locationReadinessFindings(activity: CollectionActivity, context: CollectionContext | null): CollectionReadinessFinding[] {
  if (!context || !activity.locationId) return []
  const location = context.locations.find(item => item.id === activity.locationId)
  if (!location) return [{ status: "input_needed", reason: "Held: the saved location is no longer present in the current company setup." }]
  if (location.inclusion === "excluded") return [{ status: "excluded", reason: "Held: location excluded by company setup (location_excluded_by_company_setup)." }]
  if (location.inclusion === "unknown") return [{ status: "input_needed", reason: "Held: location inclusion is undecided (location_inclusion_unknown)." }]
  return []
}
export function collectionReadinessFindings(activity: CollectionActivity, evidence: CollectionEvidenceMetadata[] = []): CollectionReadinessFinding[] {
  const draft = activity as CollectionDraft
  if (draft.state === "withdrawn") return [{ status: "withdrawn", reason: `Withdrawn: ${draft.withdrawalReason || "reason unavailable"}` }]
  const findings: CollectionReadinessFinding[] = []
  const add = (status: CollectionReadinessFinding["status"], reason: string) => findings.push({ status, reason })
  if (!draft.locationId) add("input_needed", "A company-setup location is required.")
  if (!draft.setupVersionId) add("input_needed", "The current company setup must be linked.")
  if (!draft.sourceId?.trim()) add("input_needed", "A source identifier is required.")
  for (const evidenceId of activity.evidenceIds) {
    const file = evidence.find(item => item.id === evidenceId)
    if (file?.quarantineStatus === "rejected") add("input_needed", `Linked evidence “${file.originalName}” was rejected and must be unlinked before saving another version.`)
  }
  const quantityReason = decimalReason(activity.quantity.originalValue, "Quantity")
  if (activity.kind !== "fugitive" && quantityReason) add("input_needed", quantityReason)
  if (activity.kind !== "fugitive" && !supportedUnits[activity.kind].includes(activity.quantity.originalUnit)) add("input_needed", `Unit “${activity.quantity.originalUnit || "blank"}” is not supported for this activity.`)
  const p = activity.payload
  if (activity.kind === "natural_gas" && "heatContent" in p && VOLUMETRIC_GAS_UNITS.has(activity.quantity.originalUnit)) {
    const heatReason = decimalReason(p.heatContent?.value ?? "", "Bill heat content")
    if (heatReason) add("input_needed", heatReason)
  }
  if (activity.kind === "distillate_no2" && "consumption" in p) {
    if (p.consumption.basis === "purchases_only") add("input_needed", "Opening and closing tank levels are needed to calculate purchases-only generator fuel.")
    if (p.consumption.basis === "purchases_with_tank_levels") {
      for (const [label, value] of [["Purchased gallons", p.consumption.purchasedGallons], ["Opening tank level", p.consumption.openingGallons], ["Closing tank level", p.consumption.closingGallons]] as const) {
        const issue = decimalReason(value, label)
        if (issue) add("input_needed", issue)
      }
    }
  }
  if (activity.kind === "vehicle" && "fuelEconomy" in p) {
    if (!vehicleFuels.includes(p.fuel as typeof vehicleFuels[number])) add("input_needed", `Vehicle fuel “${p.fuel || "blank"}” is a legacy or unsupported value. Choose gasoline or diesel before calculation.`)
    const allowedVehicleTypes = vehicleFuels.includes(p.fuel as typeof vehicleFuels[number]) ? vehicleTypesByFuel[p.fuel as typeof vehicleFuels[number]] : []
    if (!allowedVehicleTypes.includes(p.vehicleType as never)) add("input_needed", `Vehicle type “${p.vehicleType || "blank"}” is a legacy, unsupported, or incompatible value. Choose a vehicle type for the selected fuel before calculation.`)
    if (!Number.isInteger(p.modelYear) || p.modelYear < 1960 || p.modelYear > 2030) add("input_needed", "Model year must be covered by the released vehicle method (1960–2030).")
    if (p.miles && p.fuelEconomy) add("input_needed", "Use recorded miles or fuel economy, not both.")
    else if (p.miles) {
      const issue = decimalReason(p.miles.value, "Miles driven")
      if (issue) add("input_needed", issue)
      if (!["odometer", "trip_log"].includes(p.miles.basis)) add("input_needed", "Miles source must be odometer or trip_log.")
    } else if (p.fuelEconomy) {
      const issue = decimalReason(p.fuelEconomy.mpg, "Fuel economy")
      if (issue || p.fuelEconomy.mpg === "0") add("input_needed", issue ?? "Fuel economy must be greater than zero.")
      if (!["vehicle_record", "fleet_record", "fueleconomy_gov"].includes(p.fuelEconomy.source)) add("input_needed", "Fuel-economy source must be vehicle_record, fleet_record or fueleconomy_gov.")
    } else add("partial", "CO2 can calculate from gallons, but miles or fuel economy is needed to calculate CH4 and N2O.")
  }
  if (activity.kind === "fugitive" && "terms" in p) {
    if (p.insideBoundary === false) add("excluded", "Equipment is outside the declared reporting boundary.")
    else if (p.insideBoundary === null) add("input_needed", "Reporting-boundary answer is unknown.")
    else if (p.maintainsRefrigerantStock === true || p.retrofitInPeriod === true) add("review_required", "The simplified method is not applicable when refrigerant stock is maintained or equipment was retrofitted.")
    else if (p.maintainsRefrigerantStock === null || p.retrofitInPeriod === null) add("input_needed", "Refrigerant-stock and retrofit applicability answers must both be known.")
    else if (!p.contractorRecordsComplete || !p.eventChronologyComplete) add("input_needed", "Contractor records and event chronology must both be complete.")
    else {
      const termValues = (["PN", "CN", "PS", "CD", "RD"] as const).map(term => [term, scaledDecimal(p.terms[term])] as const)
      for (const [term, value] of termValues) {
        const issue = value === null ? decimalReason(p.terms[term], `${term} amount`) : null
        if (issue) add("input_needed", issue)
      }
      if (termValues.every((entry): entry is readonly [typeof entry[0], bigint] => entry[1] !== null)) {
        const values = Object.fromEntries(termValues) as Record<"PN" | "CN" | "PS" | "CD" | "RD", bigint>
        const net = values.PN - values.CN + values.PS + values.CD - values.RD
        if (net < 0n) add("review_required", "The derived refrigerant material balance is negative and requires review.")
        else if (["R-22", "R-12", "R-502"].includes(p.gas)) add("memo_only", `${p.gas} is reported separately outside the Scope 1 total.`)
      }
    }
  }
  if (activity.kind === "electricity" && "instruments" in p) {
    if (!/^\d{5}$/.test(p.zip)) add("input_needed", "A five-digit ZIP is required.")
    if (!p.subregion) add("input_needed", "A verified eGRID subregion is required.")
    if (!p.utilityName.trim()) add("input_needed", "Choose the verified utility serving this meter.")
    p.instruments.forEach((instrument, index) => {
      const prefix = `Market-based instrument ${index + 1}`
      const mwhReason = decimalReason(instrument.mwh, `${prefix} covered MWh`)
      if (mwhReason) add("input_needed", mwhReason)
      if (!instrument.qualityCriteriaMet) add("input_needed", `${prefix} quality criteria are not confirmed.`)
      if (instrument.vintageYear < 2024 || instrument.vintageYear > 2026) add("review_required", `${prefix} vintage is outside the admissible 2024–2026 range.`)
      if (!instrument.evidenceReference) add("input_needed", `${prefix} supporting evidence is missing.`)
      else {
        const file = evidence.find(item => item.id === instrument.evidenceReference)
        if (file?.quarantineStatus === "pending") add("input_needed", `${prefix} evidence scan is pending.`)
        if (file?.quarantineStatus === "rejected") add("input_needed", `${prefix} evidence was rejected and must be removed.`)
        if (file?.quarantineStatus === "error") add("input_needed", `${prefix} evidence scan has an error.`)
      }
      if (["biomass", "biogas", "landfill_gas", "unknown"].includes(instrument.generationTechnology)) add("input_needed", `${prefix} generation technology needs more input.`)
      if (!ZERO_TECHNOLOGIES.has(instrument.generationTechnology) && !instrument.rateLbPerMwh) add("input_needed", `${prefix} needs a stated rate for this technology.`)
      if (instrument.rateLbPerMwh) {
        for (const [gas, value] of [["CO2", instrument.rateLbPerMwh.co2], ["CH4", instrument.rateLbPerMwh.ch4], ["N2O", instrument.rateLbPerMwh.n2o]] as const) {
          if (value !== null) {
            const issue = decimalReason(value, `${prefix} ${gas} rate`)
            if (issue) add("input_needed", issue)
          }
        }
      }
    })
  }
  return findings.filter((finding, index) => findings.findIndex(candidate => candidate.status === finding.status && candidate.reason === finding.reason) === index)
}

export function notCalculableReasons(activity: CollectionActivity, evidence: CollectionEvidenceMetadata[] = []): string[] {
  return collectionReadinessFindings(activity, evidence).map(finding => finding.reason)
}

export function periodsOverlap(left: CollectionActivity["period"], right: CollectionActivity["period"]): boolean {
  return left.start < right.endExclusive && right.start < left.endExclusive
}

export function automaticZipSelection(lookup: CollectionZipLookup): { subregion: string; utilityName: string; utilityEiaId: string | null } | null {
  if (!lookup.found || lookup.subregions.length !== 1) return null
  const utility = lookup.utilities.length === 1 ? lookup.utilities[0]! : null
  return { subregion: lookup.subregions[0]!, utilityName: utility?.utility ?? "", utilityEiaId: utility?.eiaId || null }
}

export function isDefiniteUploadFailure(cause: unknown): cause is CollectionApiError {
  return cause instanceof CollectionApiError && ([401, 403, 413, 415].includes(cause.status) || cause.status === 422 && cause.code === "file_type_mismatch")
}

function initial(kind: CollectionActivityKind): CollectionDraft {
  const unit = supportedUnits[kind][0]!
  const payload: CollectionPayload = kind === "natural_gas" ? { heatContent: null }
    : kind === "distillate_no2" ? { consumption: { basis: "measured", gallons: "" }, statedHhvMmbtuPerGallon: null }
    : kind === "vehicle" ? { vehicleGroupId: "", fuel: "", vehicleType: "", modelYear: 2025, gallons: "", vehicleCount: null, miles: null, fuelEconomy: null }
    : kind === "fugitive" ? { gas: "HFC-134a", unit: "kg", terms: { PN: "", CN: "", PS: "", CD: "", RD: "" }, insideBoundary: null, maintainsRefrigerantStock: null, retrofitInPeriod: null, contractorRecordsComplete: false, eventChronologyComplete: false }
    : { meterOrAccountNumber: "", utilityName: "", site: "", zip: "", subregion: "", utilityEiaId: null, instruments: [] }
  return { kind, locationId: "", setupVersionId: "", sourceId: "", state: "active", withdrawalReason: null, quantity: { originalValue: "", originalUnit: unit, normalizedValue: null, normalizedUnit: null }, quality: "unknown", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "", notes: "", evidenceIds: [], payload } as CollectionDraft
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
const readinessLabels: Record<CollectionReadinessFinding["status"], string> = { input_needed: "Input needed", partial: "Partial calculation", review_required: "Review required", excluded: "Excluded", memo_only: "Reported separately", withdrawn: "Withdrawn" }
function ReadinessPanel({ findings }: { findings: CollectionReadinessFinding[] }) {
  if (!findings.length) return null
  const statuses = [...new Set(findings.map(finding => finding.status))]
  return <div className="collection-readiness" role="status">{statuses.map(status => <div key={status}><strong>{readinessLabels[status]}</strong><ul>{findings.filter(finding => finding.status === status).map(finding => <li key={finding.reason}>{finding.reason}</li>)}</ul></div>)}</div>
}
function HistoricalActivityDetail({ version, evidence }: { version: CollectionActivityVersion; evidence: CollectionEvidenceMetadata[] }) {
  const activity = version.activity as CollectionDraft
  const p = activity.payload
  const findings = collectionReadinessFindings(activity, evidence)
  return <div className="setup-history-detail">
    <h4>Saved version {version.revision}</h4>
    <p>Saved {new Date(version.createdAt).toLocaleString()}. Read only. {version.correctionReason || "Initial entry"}</p>
    <dl className="collection-history-fields">
      <dt>Activity</dt><dd>{kinds.find(([kind]) => kind === activity.kind)?.[1]}</dd>
      <dt>Status</dt><dd>{activity.state === "withdrawn" ? `Withdrawn · ${activity.withdrawalReason || "reason unavailable"}` : "Active"}</dd>
      <dt>Period</dt><dd>{activity.period.start} to {inclusivePeriodEnd(activity.period.endExclusive)} (last day covered)</dd>
      <dt>{activity.kind === "fugitive" ? "Derived net refrigerant release" : "Original quantity"}</dt><dd>{activity.quantity.originalValue || "Unknown"} {activity.quantity.originalUnit}</dd>
      <dt>Normalized quantity</dt><dd>{activity.quantity.normalizedValue === null ? "Not calculable yet" : `${activity.quantity.normalizedValue} ${activity.quantity.normalizedUnit}`}</dd>
      <dt>Quality</dt><dd>{activity.quality}{activity.estimateBasis ? ` · ${activity.estimateBasis}` : ""}</dd>
      <dt>Reference</dt><dd>{activity.reference || "None entered"}</dd>
      <dt>Notes</dt><dd>{activity.notes || "None entered"}</dd>
      <dt>Evidence</dt><dd>{activity.evidenceIds.length ? activity.evidenceIds.map(id => evidence.find(item => item.id === id)?.originalName ?? id).join("; ") : "None linked"}</dd>
      {findings.length > 0 && <><dt>Calculation readiness</dt><dd>{findings.map(finding => `${readinessLabels[finding.status]}: ${finding.reason}`).join(" ")}</dd></>}
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
  const [context, setContext] = useState<CollectionContext | null>(null)
  const [zipLookup, setZipLookup] = useState<CollectionZipLookup | null>(null)
  const [recordId, setRecordId] = useState<string>(() => crypto.randomUUID())
  const [draft, setDraft] = useState<CollectionDraft>(() => initial("natural_gas"))
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
    void Promise.all([listCollectionActivities(workspaceId, requestActor), listCollectionEvidence(workspaceId, requestActor), listGridLossLineages(workspaceId, requestActor), loadCollectionContext(workspaceId, requestActor)]).then(([items, files, grid, loadedContext]) => {
      if (controller.signal.aborted) return
      setRecords(items); setEvidence(files); setLineages(grid); setContext(loadedContext)
      setDraft(current => current.setupVersionId ? current : { ...current, setupVersionId: loadedContext.setupVersionId ?? "" })
      setMessage("Activity and evidence are collected as drafts. No emissions are counted until a reviewed method is released.")
    }).catch(cause => { if (!controller.signal.aborted) { setError(true); setMessage(cause instanceof Error ? cause.message : "Collection is unavailable.") } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [actor.userId, workspaceId])

  function edit(change: (next: CollectionDraft) => void) {
    if (!canManage || busy) return
    const next = structuredClone(draft); change(next); setDraft(next); setDirty(true); setHistorical(null); pending.current = null; setError(false)
    setMessage("Changes are not saved yet. Unknown or unsupported values will remain visible, never counted as zero.")
  }
  function switchKind(kind: CollectionActivityKind) {
    if (selected || kind === draft.kind) return
    if (dirty && !window.confirm("Discard unsaved activity changes?")) return
    setDraft({ ...initial(kind), setupVersionId: context?.setupVersionId ?? "" }); setRecordId(crypto.randomUUID()); setReason(""); setDirty(false); setHistorical(null); setZipLookup(null); pending.current = null
  }
  function startNewRecord() {
    if (dirty && !window.confirm("Discard unsaved activity changes?")) return
    setDraft({ ...initial(draft.kind), setupVersionId: context?.setupVersionId ?? "" }); setRecordId(crypto.randomUUID()); setReason(""); setDirty(false); setHistorical(null); setZipLookup(null); pending.current = null
  }
  function openRecord(row: CollectionActivityRecord) {
    if (dirty && !window.confirm("Discard unsaved activity changes?")) return
    setRecordId(row.id); setDraft(structuredClone(row.currentVersion.activity) as CollectionDraft); setReason(""); setDirty(false); setHistorical(null); setZipLookup(null); pending.current = null
  }
  async function refresh() {
    if (!workspaceId || busy) return
    if (dirty && !window.confirm("Discard unsaved activity changes and reload saved records?")) return
    setBusy(true); setError(false)
    try {
      const [items, files, grid, loadedContext] = await Promise.all([listCollectionActivities(workspaceId, actorRef.current), listCollectionEvidence(workspaceId, actorRef.current), listGridLossLineages(workspaceId, actorRef.current), loadCollectionContext(workspaceId, actorRef.current)])
      setRecords(items); setEvidence(files); setLineages(grid); setContext(loadedContext)
      const current = items.find(item => item.id === recordId)
      if (current) setDraft(structuredClone(current.currentVersion.activity) as CollectionDraft)
      else setDraft(previous => ({ ...previous, setupVersionId: loadedContext.setupVersionId ?? "" }))
      setDirty(false); setHistorical(null); pending.current = null; setReason(""); setMessage("Latest saved records loaded.")
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Collection is unavailable.") }
    finally { setBusy(false) }
  }
  async function save() {
    if (!workspaceId || !canManage || busy) return
    if (!draft.locationId || !draft.setupVersionId || !draft.sourceId.trim()) { setError(true); setMessage("Choose a company-setup location and enter the source identifier before saving."); return }
    if (selected && draft.state === "active" && reason.trim().length < 3) { setError(true); setMessage("Explain this correction before saving a new version."); return }
    if (draft.state === "withdrawn" && (!selected || !draft.withdrawalReason || draft.withdrawalReason.trim().length < 3)) { setError(true); setMessage("Explain why this saved record is being withdrawn."); return }
    if (draft.kind === "electricity" && !/^\d{5}$/.test((draft.payload as Extract<CollectionPayload, {zip: string}>).zip)) { setError(true); setMessage("A five-digit ZIP is required for every electricity record."); return }
    if (draft.kind === "electricity" && !draft.payload.utilityName.trim()) { setError(true); setMessage("Choose the verified utility serving this electricity meter before saving."); return }
    const rejectedEvidence = new Set(evidence.filter(file => file.quarantineStatus === "rejected").map(file => file.id))
    if (draft.evidenceIds.some(id => rejectedEvidence.has(id)) || draft.kind === "electricity" && draft.payload.instruments.some(instrument => instrument.evidenceReference !== null && rejectedEvidence.has(instrument.evidenceReference))) { setError(true); setMessage("Remove rejected evidence before saving this version."); return }
    const copy = structuredClone(draft)
    copy.sourceId = copy.sourceId.trim()
    copy.withdrawalReason = copy.state === "withdrawn" ? copy.withdrawalReason?.trim() ?? null : null
    if (copy.kind === "vehicle" && !copy.quantity.originalValue) copy.quantity.originalValue = copy.payload.gallons
    if (copy.kind === "distillate_no2" && !copy.quantity.originalValue) copy.quantity.originalValue = copy.payload.consumption.basis === "measured" ? copy.payload.consumption.gallons : copy.payload.consumption.purchasedGallons
    if (copy.kind === "natural_gas" && !VOLUMETRIC_GAS_UNITS.has(copy.quantity.originalUnit)) copy.payload.heatContent = null
    const quantity = copy.quantity
    if (DECIMAL.test(quantity.originalValue) && supportedUnits[copy.kind].includes(quantity.originalUnit)) {
      quantity.normalizedValue = quantity.originalValue; quantity.normalizedUnit = quantity.originalUnit
    } else { quantity.normalizedValue = null; quantity.normalizedUnit = null }
    copy.quantity = deriveCollectionQuantity(copy.kind, copy.payload, copy.quantity)
    const correctionReason = selected ? copy.state === "withdrawn" ? `Withdrawn: ${copy.withdrawalReason}` : reason.trim() : null
    const input = pending.current ?? { idempotencyKey: crypto.randomUUID(), expectedRevision: selected?.currentVersion.revision ?? 0, expectedVersionId: selected?.currentVersion.id ?? null, correctionReason, activity: copy }
    pending.current = input; setBusy(true); setError(false); setMessage("Saving and verifying this activity…")
    try {
      const result = await saveAndVerifyCollectionActivity(workspaceId, recordId, input, actorRef.current)
      const current = result.record
      setRecords(items => replaceSavedCollectionRecord(items, current)); setRecordId(current.id); setDraft(structuredClone(current.currentVersion.activity) as CollectionDraft); setDirty(false); setReason(""); pending.current = null
      setMessage(result.replayed ? "The earlier save was confirmed. The latest saved version is shown." : "Saved. Previous versions remain in correction history.")
    } catch (cause) {
      setError(true)
      if (cause instanceof CollectionApiError && cause.conflict) { pending.current = null; setMessage("This record changed elsewhere. Reload before correcting it.") }
      else if (cause instanceof CollectionApiError && cause.status === 422) {
        let staleContext: CollectionContext | null = null
        try {
          const latestContext = await loadCollectionContext(workspaceId, actorRef.current)
          if (requiresCurrentLocationReselection(input.activity, latestContext)) staleContext = latestContext
        } catch { /* Preserve the original save refusal when current setup cannot be checked. */ }
        if (staleContext) {
          setContext(staleContext)
          setDraft(current => ({ ...current, setupVersionId: staleContext!.setupVersionId ?? "", locationId: "" }))
          pending.current = null
          setMessage("Company setup changed. Select a current location before retrying this save.")
        } else setMessage(`${cause.message} Retry keeps the same save request.`)
      } else setMessage(`${cause instanceof Error ? cause.message : "Activity could not be saved."} Retry keeps the same save request.`)
    } finally { setBusy(false) }
  }
  async function runZipLookup() {
    if (!workspaceId || draft.kind !== "electricity" || busy) return
    const zip = draft.payload.zip
    if (!/^\d{5}$/.test(zip)) { setError(true); setMessage("Enter a five-digit ZIP before lookup."); return }
    setBusy(true); setError(false); setMessage("Checking the pinned ZIP, utility and eGRID lookup…")
    try {
      const lookup = await lookupCollectionZip(workspaceId, zip, actorRef.current)
      setZipLookup(lookup)
      if (!lookup.found) { setError(true); setMessage("No verified eGRID lookup was found for this ZIP. Keep the unresolved ZIP visible and do not save it as validated."); return }
      const automatic = automaticZipSelection(lookup)
      if (automatic) {
        setDraft(current => {
          const next = structuredClone(current)
          if (next.kind !== "electricity") return current
          next.payload.subregion = automatic.subregion
          next.payload.utilityName = automatic.utilityName
          next.payload.utilityEiaId = automatic.utilityEiaId
          return next
        })
        setDirty(true); setHistorical(null); pending.current = null
        setMessage(automatic.utilityName ? `Verified ${automatic.utilityName} in eGRID subregion ${automatic.subregion}.` : `Verified eGRID subregion ${automatic.subregion}. Choose the utility serving this meter.`)
      } else setMessage("Choose the matching utility to verify the eGRID subregion.")
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "ZIP lookup is unavailable.") }
    finally { setBusy(false) }
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
      if (isDefiniteUploadFailure(cause)) {
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
  const draftFindings = [...collectionReadinessFindings(draft, evidence), ...locationReadinessFindings(draft, context)]
  const separatorSuggestion = thousandsSeparatorSuggestion(draft.quantity.originalValue)
  const duplicateRows = records.filter(row => {
    if (row.id === selected?.id || row.kind !== draft.kind) return false
    const other = row.currentVersion.activity as CollectionDraft
    return other.state !== "withdrawn" && Boolean(draft.sourceId.trim()) && other.sourceId.trim().toLocaleLowerCase() === draft.sourceId.trim().toLocaleLowerCase() && periodsOverlap(other.period, draft.period)
  })
  const sourceLabel = draft.kind === "natural_gas" ? "Gas account or meter ID"
    : draft.kind === "distillate_no2" ? "Generator or equipment ID"
    : draft.kind === "vehicle" ? "Vehicle or group ID"
    : draft.kind === "fugitive" ? "Equipment or group ID"
    : "Electricity meter or account ID"
  const evidenceLabel = (file: CollectionEvidenceMetadata) => file.quarantineStatus === "clean" ? `${file.originalName} · cleared`
    : file.quarantineStatus === "pending" ? `${file.originalName} · scan pending (not cleared)`
    : file.quarantineStatus === "rejected" ? `${file.originalName} · rejected (remove before saving)`
    : `${file.originalName} · scan error (not cleared)`
  return <section className="worksheet collection-workspace" aria-busy={busy}>
    <p className="worksheet-eyebrow">Activity collection · Synthetic staging</p>
    <h1 ref={headingRef} tabIndex={-1}>Collect Scope 1 and 2 activity</h1>
    <p>Save source details and private evidence for each activity. Missing answers remain unresolved. Calculations and reports come only from reviewed, released methods.</p>
    <p role={error ? "alert" : "status"} className={error ? "worksheet-error" : "worksheet-status"}>{message}</p>
    {!canManage && <p>Owner or admin access is needed to save activity or upload evidence.</p>}

    <div className="worksheet-card"><h2>Saved activities</h2>
      <div className="collection-record-list">{records.length ? records.map(row => {
        const activity = row.currentVersion.activity as CollectionDraft
        const readiness = [...collectionReadinessFindings(activity, evidence), ...locationReadinessFindings(activity, context)]
        return <div key={row.id} className="setup-subcard">
          <strong>{kinds.find(([id]) => id === row.kind)?.[1] ?? row.kind}</strong> · version {row.currentVersion.revision} {activity.state === "withdrawn" && <span className="collection-status-badge">Withdrawn</span>}
          <p>{activity.period.start} to {inclusivePeriodEnd(activity.period.endExclusive)} (last day covered) · {activity.kind === "fugitive" ? "Derived net release" : "Quantity"}: {activity.quantity.originalValue || "unknown"} {activity.quantity.originalUnit}</p>
          <p>Source {activity.sourceId} · {context?.locations.find(location => location.id === activity.locationId)?.name ?? "Saved location"}</p>
          <ReadinessPanel findings={readiness} />
          <button type="button" disabled={busy} onClick={() => openRecord(row)}>Review or correct</button>
          {row.kind === "electricity" && activity.state === "active" && <button type="button" disabled={busy || !canManage || lineages.some(item => item.electricityRecordId === row.id)} onClick={() => void addGridLoss(row)}>{lineages.some(item => item.electricityRecordId === row.id) ? "Grid-loss source linked" : "Link grid-loss source"}</button>}
        </div>
      }) : <p>No activity records saved yet.</p>}</div>
      <button type="button" disabled={busy} onClick={() => void refresh()}>Reload saved records</button>
    </div>

    <div className="worksheet-card worksheet-form"><h2>{selected ? `Correct saved ${kinds.find(([id]) => id === selected.kind)?.[1]}` : "New activity record"}</h2>
      {selected && <button type="button" disabled={busy || !canManage} onClick={startNewRecord}>Start a new record</button>}
      <div className="worksheet-nav" aria-label="Activity types">{kinds.map(([kind, label]) => <button type="button" key={kind} aria-pressed={draft.kind === kind} disabled={busy || Boolean(selected)} onClick={() => switchKind(kind)}>{label}</button>)}</div>
      {selected && <p>Activity type is fixed while correcting this record. Use “Start a new record” to collect another activity.</p>}
      <fieldset className="setup-inputs" disabled={busy || !canManage}>
        <div className="setup-grid">
          <Select label="Company-setup location" value={draft.locationId} options={[["", context?.setupVersionId ? "Choose a saved location" : "Save company setup locations first"], ...(context?.locations ?? []).map(location => [location.id, `${location.name || "Unnamed location"} · ${location.inclusion} · ${location.control}`] as const)]} onChange={value => edit(next => { next.locationId = value; next.setupVersionId = context?.setupVersionId ?? ""; if (next.kind === "electricity") next.payload.site = context?.locations.find(location => location.id === value)?.name ?? "" })} hint={context?.setupRevision ? `Linked to company setup version ${context.setupRevision}. Excluded and unknown locations remain visible.` : "A saved company setup version is required."} />
          <Field label={sourceLabel} value={draft.sourceId} onChange={value => edit(next => { next.sourceId = value; if (next.kind === "vehicle") next.payload.vehicleGroupId = value; if (next.kind === "electricity") next.payload.meterOrAccountNumber = value })} hint="Use the same stable identifier on every record from this source." />
          <Field label="Period start" type="date" value={draft.period.start} onChange={value => edit(next => { next.period.start = value })} />
          <Field label="Last day covered" type="date" value={inclusivePeriodEnd(draft.period.endExclusive)} onChange={value => edit(next => { next.period.endExclusive = exclusivePeriodEnd(value) })} hint="Enter the inclusive last day shown on the source. Neuvetra stores the following day as the calculation boundary." />
          {(draft.kind === "natural_gas" || draft.kind === "electricity") && <Field label="Original quantity from source" value={draft.quantity.originalValue} onChange={value => edit(next => { next.quantity.originalValue = value })} hint="Keep the source text. Unknown or more than 3 decimals is saved but not calculated." />}
          {draft.kind !== "fugitive" && <Field label="Original unit as printed" value={draft.quantity.originalUnit} onChange={value => edit(next => { next.quantity.originalUnit = value; if (next.kind === "natural_gas" && !VOLUMETRIC_GAS_UNITS.has(value)) next.payload.heatContent = null })} hint={`Engine tokens for this kind: ${supportedUnits[draft.kind].join(", ")}. Other units stay saved but uncalculated.`} />}
          <Select label="Data quality" value={draft.quality} options={[["unknown", "Unknown"], ["actual", "Actual"], ["estimated", "Estimated"]]} onChange={value => edit(next => { next.quality = value as CollectionActivity["quality"]; next.estimateBasis = value === "estimated" ? "" : null })} />
          {draft.quality === "estimated" && <Field label="How was this estimate made?" value={draft.estimateBasis ?? ""} onChange={value => edit(next => { next.estimateBasis = value })} />}
          <Field label="Source reference" value={draft.reference} onChange={value => edit(next => { next.reference = value })} hint="Bill number, log, contractor record or other locator." />
          <label className="setup-field"><span>Notes and unresolved questions</span><textarea value={draft.notes} onChange={event => edit(next => { next.notes = event.target.value })} /></label>
        </div>
        {separatorSuggestion && <div className="collection-suggestion"><p>The quantity includes thousands separators. It remains uncalculated unless you explicitly accept the plain-decimal form.</p><button type="button" onClick={() => edit(next => { next.quantity.originalValue = separatorSuggestion; if (next.kind === "vehicle") next.payload.gallons = separatorSuggestion; if (next.kind === "distillate_no2" && next.payload.consumption.basis === "measured") next.payload.consumption.gallons = separatorSuggestion; if (next.kind === "distillate_no2" && next.payload.consumption.basis !== "measured") next.payload.consumption.purchasedGallons = separatorSuggestion })}>Use {separatorSuggestion}</button></div>}
        {duplicateRows.length > 0 && <div className="collection-duplicate-warning" role="alert"><strong>Probable duplicate</strong><p>{duplicateRows.length} active record{duplicateRows.length === 1 ? "" : "s"} use this activity type and source ID during an overlapping period. Review the saved record before adding another.</p></div>}
        <ReadinessPanel findings={draftFindings} />
        {draft.kind === "natural_gas" && "heatContent" in p && VOLUMETRIC_GAS_UNITS.has(draft.quantity.originalUnit) && <div className="setup-subcard"><h3>Natural gas</h3><p>Use the heat content printed on the bill. Do not assume a conversion.</p><div className="setup-grid">
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
          <Select label="Fuel" value={vehicleFuels.includes(p.fuel as typeof vehicleFuels[number]) ? p.fuel : ""} options={[["", "Choose fuel"] as const, ...vehicleFuels.map(value => [value, value] as const)]} onChange={value => edit(next => { if (next.kind !== "vehicle") return; next.payload.fuel = value; next.payload.vehicleType = "" })} />
          <Select label="Vehicle type" value={vehicleTypes.includes(p.vehicleType as typeof vehicleTypes[number]) && vehicleTypesByFuel[p.fuel as keyof typeof vehicleTypesByFuel]?.includes(p.vehicleType as never) ? p.vehicleType : ""} options={[["", p.fuel ? "Choose vehicle type" : "Choose fuel first"] as const, ...(vehicleTypesByFuel[p.fuel as keyof typeof vehicleTypesByFuel] ?? []).map(value => [value, value.replace(/_/g, " ")] as const)]} onChange={value => edit(next => { if (next.kind === "vehicle") next.payload.vehicleType = value })} />
          <Field label="Model year" type="number" value={String(p.modelYear)} onChange={value => edit(next => { (next.payload as typeof p).modelYear = Number(value) })} />
          <Field label="Fuel used (US gallons)" value={p.gallons} onChange={value => edit(next => { (next.payload as typeof p).gallons = value; next.quantity.originalValue = value })} />
          <Field label="Vehicle count (optional)" type="number" value={p.vehicleCount === null ? "" : String(p.vehicleCount)} onChange={value => edit(next => { (next.payload as typeof p).vehicleCount = value ? Number(value) : null })} />
          <Field label="Miles driven" value={p.miles?.value ?? ""} onChange={value => edit(next => { (next.payload as typeof p).miles = value ? { value, basis: p.miles?.basis ?? "" } : null; if (value) (next.payload as typeof p).fuelEconomy = null })} />
          <Select label="Miles source / basis" value={p.miles?.basis ?? ""} options={[["", "Choose a miles source"], ["odometer", "Odometer"], ["trip_log", "Trip log"]]} onChange={value => edit(next => { (next.payload as typeof p).miles = value ? { value: p.miles?.value ?? "", basis: value } : null })} />
          <Field label="Fuel economy (mpg), if miles unavailable" value={p.fuelEconomy?.mpg ?? ""} onChange={value => edit(next => { (next.payload as typeof p).fuelEconomy = value ? { mpg: value, source: p.fuelEconomy?.source ?? "" } : null; if (value) (next.payload as typeof p).miles = null })} />
          <Select label="MPG source" value={p.fuelEconomy?.source ?? ""} options={[["", "Choose an MPG source"], ["vehicle_record", "Vehicle record"], ["fleet_record", "Fleet record"], ["fueleconomy_gov", "fueleconomy.gov"]]} onChange={value => edit(next => { (next.payload as typeof p).fuelEconomy = value ? { mpg: p.fuelEconomy?.mpg ?? "", source: value } : null })} />
        </div>{(!vehicleFuels.includes(p.fuel as typeof vehicleFuels[number]) || !vehicleTypes.includes(p.vehicleType as typeof vehicleTypes[number]) || !vehicleTypesByFuel[p.fuel as keyof typeof vehicleTypesByFuel]?.includes(p.vehicleType as never)) && <p className="collection-legacy-hold">Held pending correction: saved fuel “{p.fuel || "blank"}” and vehicle type “{p.vehicleType || "blank"}” are preserved. Choose the matching FIELDS v6 tokens before saving a correction.</p>}</div>}
        {draft.kind === "fugitive" && "terms" in p && <div className="setup-subcard"><h3>One refrigerant per equipment or group</h3><p>The saved quantity is the derived net refrigerant release: (PN − CN) + PS + (CD − RD). The five entered terms remain unchanged.</p><div className="setup-grid">
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
          <Field label="ZIP code" value={p.zip} onChange={value => edit(next => { (next.payload as typeof p).zip = value; (next.payload as typeof p).subregion = ""; (next.payload as typeof p).utilityEiaId = null; (next.payload as typeof p).utilityName = ""; setZipLookup(null) })} hint="Required. Run the pinned lookup; unresolved values stay visible but cannot be saved as validated." />
        </div><button type="button" disabled={busy || !/^\d{5}$/.test(p.zip)} onClick={() => void runZipLookup()}>Look up ZIP and utility</button>
          {zipLookup?.found && (zipLookup.needsUtilityChoice || zipLookup.utilities.length > 1) && <Select label="Verified utility and eGRID subregion" value={p.utilityName ? `${p.subregion}|${p.utilityEiaId ?? ""}|${p.utilityName}` : ""} options={[["", "Choose the utility serving this meter"] as const, ...zipLookup.utilities.map(utility => [`${utility.subregion}|${utility.eiaId}|${utility.utility}`, `${utility.utility} · ${utility.subregion}${utility.predominantUtility ? " · predominant" : ""}`] as const)]} onChange={value => edit(next => { if (next.kind !== "electricity") return; const utility = zipLookup.utilities.find(item => `${item.subregion}|${item.eiaId}|${item.utility}` === value); next.payload.subregion = utility?.subregion ?? ""; next.payload.utilityEiaId = utility?.eiaId || null; next.payload.utilityName = utility?.utility ?? "" })} hint={zipLookup.needsUtilityChoice ? "A utility selection is required because this ZIP maps to more than one subregion." : "Choose the utility named on the source document."} />}
          {zipLookup?.found && p.subregion && p.utilityName && <p>Verified utility: <strong>{p.utilityName}</strong> · eGRID subregion <strong>{p.subregion}</strong>. Source: {zipLookup.source}</p>}
          {zipLookup && !zipLookup.found && <p className="worksheet-error">No verified eGRID match was found for ZIP {zipLookup.zip}.</p>}
          <p>Location-based and market-based results have separate statuses. Uncovered consumption uses the reviewed Green-e residual mix. “Provisional” appears only if a subregion has no residual-mix rate.</p>
          <h4>Certificates and other contractual instruments</h4>
          {p.instruments.map((item, index) => <div className="setup-subcard" key={`${index}-${item.type}`}><h4>Instrument {index + 1}</h4><div className="setup-grid">
            <Select label="Instrument type" value={item.type} options={instrumentTypes} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.type = value as CollectionInstrument["type"] })} />
            <Field label="Covered MWh" value={item.mwh} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.mwh = value })} />
            <Select label="Quality criteria confirmed?" value={item.qualityCriteriaMet ? "yes" : "no"} options={[["no", "No — market input needed"], ["yes", "Yes"]]} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.qualityCriteriaMet = value === "yes" })} />
            <Field label="Vintage year" type="number" value={String(item.vintageYear)} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.vintageYear = Number(value) })} />
            <Select label="Generation technology" value={item.generationTechnology} options={technologies.map(value => [value, value.replace(/_/g, " ")])} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.generationTechnology = value as CollectionInstrument["generationTechnology"] })} />
            <Select label="Supporting evidence" value={item.evidenceReference ?? ""} options={[["", "Choose an uploaded document"] as const, ...evidence.filter(file => file.quarantineStatus !== "rejected" || file.id === item.evidenceReference).map(file => [file.id, evidenceLabel(file)] as const)]} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.evidenceReference = value || null; if (value && !next.evidenceIds.includes(value)) next.evidenceIds.push(value) })} />
            <Field label="CO2 rate (lb/MWh)" value={item.rateLbPerMwh?.co2 ?? ""} onChange={value => edit(next => { const ch4 = item.rateLbPerMwh?.ch4 ?? null; const n2o = item.rateLbPerMwh?.n2o ?? null; (next.payload as typeof p).instruments[index]!.rateLbPerMwh = value || ch4 || n2o ? { co2: value, ch4, n2o } : null })} hint="Required for emitting technologies for every instrument type. Leave the rate blank for wind, solar PV, hydro or nuclear to use the zero rule." />
            <Field label="CH4 rate (lb/MWh, if supplied)" value={item.rateLbPerMwh?.ch4 ?? ""} onChange={value => edit(next => { const current = (next.payload as typeof p).instruments[index]!; current.rateLbPerMwh = { co2: current.rateLbPerMwh?.co2 ?? "", ch4: value || null, n2o: current.rateLbPerMwh?.n2o ?? null } })} />
            <Field label="N2O rate (lb/MWh, if supplied)" value={item.rateLbPerMwh?.n2o ?? ""} onChange={value => edit(next => { const current = (next.payload as typeof p).instruments[index]!; current.rateLbPerMwh = { co2: current.rateLbPerMwh?.co2 ?? "", ch4: current.rateLbPerMwh?.ch4 ?? null, n2o: value || null } })} />
          </div><button type="button" onClick={() => edit(next => { (next.payload as typeof p).instruments.splice(index, 1) })}>Remove instrument</button></div>)}
          <button type="button" onClick={() => edit(next => { (next.payload as typeof p).instruments.push({ type: "energy_attribute_certificate", mwh: "", qualityCriteriaMet: false, vintageYear: 2025, evidenceReference: null, generationTechnology: "unknown", rateLbPerMwh: null }) })}>+ Add instrument</button>
          <p>A stated rate always takes precedence, including for wind, solar PV, hydro and nuclear. If a stated rate gives CO2 only, CH4 and N2O come from eGRID and the result is flagged as an estimate. Leave the rate blank for those four technologies, or state all three gases as 0, to claim zero for all gases.</p>
          <p>Biomass, biogas and landfill gas are collected but remain input needed in this beta. No instrument is silently counted at zero.</p>
        </div>}
        <div className="setup-subcard"><h3>Evidence linked to this version</h3>{evidence.some(file => file.quarantineStatus !== "rejected" || draft.evidenceIds.includes(file.id)) ? evidence.filter(file => file.quarantineStatus !== "rejected" || draft.evidenceIds.includes(file.id)).map(file => <label className="collection-evidence-choice" key={file.id}><input type="checkbox" checked={draft.evidenceIds.includes(file.id)} disabled={file.quarantineStatus === "rejected" && !draft.evidenceIds.includes(file.id)} onChange={event => edit(next => { next.evidenceIds = event.target.checked ? [...next.evidenceIds, file.id] : next.evidenceIds.filter(id => id !== file.id); if (!event.target.checked && next.kind === "electricity") next.payload.instruments.forEach(instrument => { if (instrument.evidenceReference === file.id) instrument.evidenceReference = null }) })} /> {evidenceLabel(file)}</label>) : <p>No linkable evidence uploaded yet.</p>}</div>
        {selected && draft.state === "active" && <Field label="Reason for this correction" value={reason} onChange={setReason} hint="Required for a new version. Earlier versions remain available." />}
        {selected && draft.state === "active" && <button type="button" className="collection-withdraw" onClick={() => edit(next => { next.state = "withdrawn"; next.withdrawalReason = "" })}>Withdraw this record</button>}
        {selected && draft.state === "withdrawn" && <><Field label="Reason for withdrawal" value={draft.withdrawalReason ?? ""} onChange={value => edit(next => { next.withdrawalReason = value })} hint="Required. The withdrawn version remains in history and is excluded from calculation." /><button type="button" onClick={() => edit(next => { next.state = "active"; next.withdrawalReason = null })}>Restore as active record</button></>}
        <button type="button" disabled={busy || !canManage || !dirty} onClick={() => void save()}>{selected ? draft.state === "withdrawn" ? "Save withdrawal" : "Save correction" : "Save activity"}</button>
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
