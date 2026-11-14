// The Activity screen's save checks (WO-10, round 2 lane E UX-4), moved out of CollectionWorkspace.tsx (WO-12 QA) so the
// field-label derivation test calls the screen's real checks instead of a copy. CollectionWorkspace uses exactly these:
// the problems listed next to Save, the activity as save() sends it, and the units the screen accepts and normalizes.
import { CollectionTextLimitError, deriveCollectionQuantity, validateCollectionActivityForSave, WITHDRAWN_REASON_PREFIX, withCurrentSetupVersion, type CollectionActivity, type CollectionActivityKind, type CollectionContext, type CollectionEvidenceMetadata, type CollectionPayload } from "../../../../packages/neuvetra-database/src/collection-contract"
import { isScope3CollectionKind, isScope3CompletionKind, SCOPE3_COLLECTION_UNITS, type Scope3CollectionKind } from "../../../../packages/neuvetra-database/src/scope3-collection"
import type { CollectionZipLookup } from "./collection-api"
import { ACTIVITY_FORM_TEXT_WO10 } from "./activity-form-text-wo10"
import { scope3PreSaveProblems } from "./scope3-display-r3d"
import { scope3DataQualityProblem, scope3PayloadProblem } from "./scope3-forms"
import { SAVE_TEXT_R2C } from "./scope3-text-r2c"

/** The units each kind's quantity may be saved in. */
export const SUPPORTED_UNITS: Record<CollectionActivityKind, readonly string[]> = {
  natural_gas: ["therm", "MMBtu", "scf", "ccf", "mcf"],
  distillate_no2: ["US_gallon"], vehicle: ["US_gallon"], fugitive: ["kg", "lb"], electricity: ["kWh", "MWh"],
  ...SCOPE3_COLLECTION_UNITS,
  // I-02: 0030 lets business travel normalize room-night (the hotel form of I-08 sends it to a schema-30 server). This
  // form keeps 0029's units, so a hotel written under "Something else" is saved as written at any schema, never refused.
  business_travel: SCOPE3_COLLECTION_UNITS.business_travel.filter(unit => unit !== "room-night"),
}
export const normalizableUnits = (kind: CollectionActivityKind, completion: boolean): readonly string[] => kind === "business_travel" && completion ? SCOPE3_COLLECTION_UNITS.business_travel : SUPPORTED_UNITS[kind]
export const DECIMAL = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
export const VOLUMETRIC_GAS_UNITS: ReadonlySet<string> = new Set(["scf", "ccf", "mcf"])

/** WO-10: a problem that stops a save, with the fields it names (the first is where its summary link goes). */
export type FormProblem = { text: string; fields?: readonly string[] }

/** WO-10: a real calendar date (YYYY-MM-DD), as the shared contract requires. */
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
/** WO-10: the shared contract's refusals that name a field of this form, and the fields they name. */
export const CONTRACT_FIELDS: readonly [RegExp, readonly string[]][] = [
  [/^Only estimated records carry an estimate basis\.$/, ["estimateBasis"]],
  [/^(A real calendar date is required|Collection periods must fall inside calendar 2025|Scope 3 periods must fall between)/, ["periodStart", "periodEnd"]],
  [/^Stated HHV allows/, ["statedHhv"]],
  [/^Source identifier must match/, ["source"]],
  [/^Withdrawal requires a reason/, ["withdrawalReason"]],
]
/** WO-10: the pre-save problems of the Scope 3 forms on this screen, by the field label they name. */
const PRESAVE_FIELDS: Readonly<Record<string, string>> = { "Vehicle": "transportVehicle", "How do you know the haul length?": "haulBasis", "Treatment": "treatment" }

/** The activity exactly as save() sends it: trimmed identifiers, derived quantities, identity normalization. */
export function prepareActivityForSave(draft: CollectionActivity, completion = false): CollectionActivity {
  const copy = structuredClone(draft)
  copy.sourceId = copy.sourceId.trim()
  // BF1: the meter or vehicle-group ID is the source ID. Keep them identical after trimming, or the contract refuses the
  // save ("Source identifier must match…") and retrying can never succeed.
  if (copy.kind === "vehicle") copy.payload.vehicleGroupId = copy.sourceId
  if (copy.kind === "electricity") copy.payload.meterOrAccountNumber = copy.sourceId
  copy.withdrawalReason = copy.state === "withdrawn" ? copy.withdrawalReason?.trim() ?? null : null
  if (copy.kind === "vehicle" && !copy.quantity.originalValue) copy.quantity.originalValue = copy.payload.gallons
  if (copy.kind === "distillate_no2" && !copy.quantity.originalValue) copy.quantity.originalValue = copy.payload.consumption.basis === "measured" ? copy.payload.consumption.gallons : copy.payload.consumption.purchasedGallons
  if (copy.kind === "natural_gas" && !VOLUMETRIC_GAS_UNITS.has(copy.quantity.originalUnit)) copy.payload.heatContent = null
  const quantity = copy.quantity
  if (DECIMAL.test(quantity.originalValue) && normalizableUnits(copy.kind, completion).includes(quantity.originalUnit)) {
    quantity.normalizedValue = quantity.originalValue; quantity.normalizedUnit = quantity.originalUnit
  } else { quantity.normalizedValue = null; quantity.normalizedUnit = null }
  copy.quantity = deriveCollectionQuantity(copy.kind, copy.payload, copy.quantity)
  return copy
}

/** BF-32: the form fields the server's text-limit refusals name (the save rule's field table, by path). */
const TEXT_LIMIT_FIELDS: Readonly<Record<string, string>> = { sourceId: "source", reference: "reference", notes: "notes", estimateBasis: "estimateBasis", withdrawalReason: "withdrawalReason", correctionReason: "reason" }

/** What save() sends as the correction reason: the typed reason, or "Withdrawn: " and the withdrawal reason; none on a first save. */
export function correctionReasonFor(copy: CollectionActivity, correcting: boolean, reason: string): string | null {
  return correcting ? copy.state === "withdrawn" ? `${WITHDRAWN_REASON_PREFIX}${copy.withdrawalReason}` : reason.trim() : null
}

/**
 * BF-32 (F1): the shared save rule (NFC first, then count, named field, limit and excess; text the save leaves as the corrected
 * version stored it is not re-checked), then the contract: exactly what the server applies, so a save the server accepts is never
 * blocked here and text it refuses is refused with its words.
 */
export function contractProblem(copy: CollectionActivity, previous: CollectionActivity | null, correctionReason: string | null): { text: string; fields: string[] } | null {
  try { validateCollectionActivityForSave(copy, previous, correctionReason); return null }
  catch (cause) {
    const text = cause instanceof Error ? cause.message : "This record can’t be saved."
    const fields = cause instanceof CollectionTextLimitError ? (TEXT_LIMIT_FIELDS[cause.path] ? [TEXT_LIMIT_FIELDS[cause.path]!] : []) : [...(CONTRACT_FIELDS.find(([pattern]) => pattern.test(text))?.[1] ?? [])]
    return { text, fields }
  }
}

/** The Scope 3 forms' own pre-save problems (shown before any edit on a record opened by Fix). */
export function activityPresaveProblems(draft: CollectionActivity): FormProblem[] {
  if (!isScope3CollectionKind(draft.kind) || draft.state !== "active") return []
  return scope3PreSaveProblems(draft).map(problem => ({ text: problem.text, fields: PRESAVE_FIELDS[problem.field] ? [PRESAVE_FIELDS[problem.field]!] : [] }))
}

export interface ActivitySaveState {
  context: CollectionContext | null
  evidence: readonly CollectionEvidenceMetadata[]
  /** A saved record is being corrected (a reason is required). */
  correcting: boolean
  reason: string
  zipLookup: CollectionZipLookup | null
  /** Schema 30 (0030's payload additions). */
  scope3Completion: boolean
  /** BF-32: the version being corrected: text a save leaves as that version stored it is not re-checked (the server's rule). */
  previous?: CollectionActivity | null
}

/**
 * Round 2 lane E (UX-4), WO-10: every problem that would stop a save, listed next to Save. The same checks as save() and
 * the shared contract (validateCollectionActivity), so nothing the server refuses is sent; each problem names its field.
 * (Owners and admins only: a member is never shown the form.)
 */
export function activitySaveProblems(draft: CollectionActivity, state: ActivitySaveState): FormProblem[] {
  const { context, evidence, zipLookup, scope3Completion } = state
  const problems: FormProblem[] = [...activityPresaveProblems(draft)]
  const add = (text: string, ...fields: string[]) => { problems.push({ text, fields }) }
  const p = draft.payload as CollectionPayload
  const scope3 = isScope3CollectionKind(draft.kind)
  const periodShown = !(isScope3CompletionKind(draft.kind) && draft.kind === "purchase_spend")
  const utilityChoiceShown = draft.kind === "electricity" && !!zipLookup?.found && (zipLookup.needsUtilityChoice || zipLookup.utilities.length > 1)
  if (!draft.locationId) add("Choose a company-setup location.", "location")
  if (!draft.setupVersionId && !context?.setupVersionId) add("Save company setup first: every record is linked to a saved setup version.")
  if (!draft.sourceId.trim()) add("Enter the source identifier.", "source")
  if (periodShown && !isRealDate(draft.period.start)) add("Enter the period start as a real date (YYYY-MM-DD).", "periodStart")
  if (periodShown && !isRealDate(draft.period.endExclusive)) add("Enter the last day covered as a real date (YYYY-MM-DD).", "periodEnd")
  if (state.correcting && draft.state === "active" && state.reason.trim().length < 3) add("Explain this correction (at least 3 characters).", "reason")
  if (draft.state === "withdrawn" && (!draft.withdrawalReason || draft.withdrawalReason.trim().length < 3)) add("Explain why this record is being withdrawn (at least 3 characters).", "withdrawalReason")
  if (draft.kind === "electricity" && "instruments" in p) {
    if (!/^\d{5}$/.test(p.zip)) add("Enter the meter’s five-digit ZIP code.", "zip")
    if (!p.utilityName.trim()) add("Choose the verified utility serving this meter.", utilityChoiceShown ? "utility" : "zipLookup")
    p.instruments.forEach((instrument, index) => { if (!Number.isInteger(instrument.vintageYear) || instrument.vintageYear < 1000 || instrument.vintageYear > 9999) add(ACTIVITY_FORM_TEXT_WO10.vintageYear(index + 1), `vintage-${index}`) })
  }
  // The shared contract refuses a blank fuel or vehicle type, a model year outside 1900–2026 and a vehicle count below one
  // (as "Invalid collection record."); each is named here, at its field.
  if (draft.kind === "vehicle" && "fuelEconomy" in p) {
    if (!p.fuel.trim()) add(ACTIVITY_FORM_TEXT_WO10.vehicleFuel, "vehicleFuel")
    if (!p.vehicleType.trim()) add(ACTIVITY_FORM_TEXT_WO10.vehicleType, "vehicleType")
    if (!Number.isInteger(p.modelYear) || p.modelYear < 1900 || p.modelYear > 2026) add(ACTIVITY_FORM_TEXT_WO10.modelYear, "modelYear")
    if (p.vehicleCount !== null && !(Number.isSafeInteger(p.vehicleCount) && p.vehicleCount > 0)) add(ACTIVITY_FORM_TEXT_WO10.vehicleCount, "vehicleCount")
  }
  const rejected = new Set(evidence.filter(file => file.quarantineStatus === "rejected").map(file => file.id))
  if (draft.evidenceIds.some(id => rejected.has(id)) || draft.kind === "electricity" && "instruments" in p && p.instruments.some(instrument => instrument.evidenceReference !== null && rejected.has(instrument.evidenceReference))) add("Remove rejected evidence.", "evidence")
  if (scope3) {
    const prepared = prepareActivityForSave(withCurrentSetupVersion(draft, context), scope3Completion)
    const problem = scope3PayloadProblem(draft.kind as Scope3CollectionKind, prepared.payload) ?? scope3DataQualityProblem(prepared.payload)
    if (problem) add(problem)
  }
  // Round 2c integration (walk item 2): an estimated Scope 3 record without its basis is told what to fill in; the shared
  // contract's message ("Only estimated records carry an estimate basis.") is shipped and stays the server's, and Scope 1's.
  if (draft.quality === "estimated" && !draft.estimateBasis?.trim()) add(scope3 ? SAVE_TEXT_R2C.estimateBasisMissing : "Only estimated records carry an estimate basis.", "estimateBasis")
  if (problems.length === 0) {
    const prepared = prepareActivityForSave(withCurrentSetupVersion(draft, context), scope3Completion)
    const refusal = contractProblem(prepared, state.previous ?? null, correctionReasonFor(prepared, state.correcting, state.reason))
    if (refusal) add(refusal.text, ...refusal.fields)
  }
  return problems
}
