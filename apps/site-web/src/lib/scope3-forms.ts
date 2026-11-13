/**
 * Scope 3 record forms: checks and choices (Scope 3 completion I-08; Claude, 30 October 2026; DESIGN 7.2). Browser-safe,
 * no React. Nothing here calculates emissions (DESIGN invariant 1): a share total is only summed to say whether the shares
 * a user typed reach 100%, and every hold is the calculation adapter's own (planScope3Calculation).
 *
 * - `scope3PayloadProblem`: the shared contract (`validateScope3Payload`, the same rule 0030 applies) decides; its refusal
 *   is named in the screen's words, so nothing the database would refuse is sent.
 * - `scope3DataQualityProblem`: a rating or origin set by the company needs the reason it differs from the method default.
 * - `scope3NaicsChoices` (now in `scope3-naics.ts`): the 2017 NAICS codes a spend line of the category may map to.
 * - `scope3ReadinessOptions`: the plan options the results route uses (reporting period, consolidation approach, distance
 *   commuting periods, supersession), so the Activity screen shows the same holds as Results.
 */
import type { CollectionActivity, CollectionActivityRecord, CollectionContext, CollectionEvidenceMetadata } from "../../../../packages/neuvetra-database/src/collection-contract"
import type { CompanySetupView } from "../../../../packages/neuvetra-database/src/company-setup-contract"
import {
  SCOPE3_SPEND_NAICS_SETS, isScope3CollectionKind, planScope3Calculation, planScope3SupersessionClaimants, scope3DistanceCommutingPeriods, scope3SpendMappingKeyInput, validateScope3Payload,
  type Scope3CollectionKind, type Scope3CollectionVersion, type Scope3ConsolidationApproach, type Scope3DataQuality, type Scope3PlanOptions, type Scope3ReportingPeriod,
} from "../../../../packages/neuvetra-database/src/scope3-collection"
import { SCOPE3_FORM_TOKEN_TEXT_I08 } from "../../../../packages/neuvetra-database/src/scope3-text"
import { M71_CATEGORIES } from "../../../../packages/neuvetra-database/src/m71-contract"
import type { Scope3SpendLineChoice } from "./scope3-form-defaults"
import { SCOPE3_PRESAVE_TEXT_R3D } from "./scope3-text-r3d"

/** A token's words (`SCOPE3_FORM_TOKEN_TEXT_I08`), or the token itself with underscores as spaces. */
export function scope3TokenLabel(field: string, token: string): string {
  return SCOPE3_FORM_TOKEN_TEXT_I08[field]?.[token] ?? (token ? token.charAt(0).toUpperCase() + token.slice(1).replace(/_/g, " ") : token)
}
/** `[token, words]` options for a select, in the given order. */
export const scope3TokenOptions = (field: string, tokens: readonly string[]): Array<readonly [string, string]> => tokens.map(token => [token, scope3TokenLabel(field, token)] as const)

// --- The contract's refusal, in the screen's words ---

/** Messages for the contract's field labels (`Invalid Scope 3 activity details: <label>.`), by `<kind>:<label>` first, then `<label>`. */
const MESSAGES: Readonly<Record<string, string>> = {
  // purchase_spend
  "spend category": "Choose the category this purchase belongs in.",
  "NAICS code": "Choose a 2017 NAICS code from the list, or leave it empty (the line is then held until it has one).",
  "dollar year": "The dollar year must be a year from 2012 to 2035, or leave it empty to use the year in which the line’s period ends.",
  "margin choice": "Say whether the price includes the distributor’s and retailer’s margins.",
  "tax treatment": "Say whether the amount includes sales tax.",
  "purchase_spend:supplier name": "The supplier name can be up to 200 characters.",
  "GL account": "The GL account can be up to 120 characters.",
  "description": "Describe the purchase (1 to 200 characters).",
  "spend estimate basis": "Say how the category 9 amount was estimated (3 to 300 characters).",
  "category 9 spend has an attestation and an estimate basis, and only category 9": "Category 9 needs the attestation that the company did not pay for this transport, and how the amount was estimated.",
  "category 9 spend is entered by hand, never imported": "Category 9 can’t come from an imported ledger line: transport the company paid for is category 4.",
  "line date": "The line date must be a real date (YYYY-MM-DD), or leave it empty.",
  "activity overlap": "Say whether another record already covers the same activity.",
  // purchase_supplier
  "supplier category": "Choose category 1 (purchased goods and services) or 2 (capital goods).",
  "purchase_supplier:supplier name": "Enter the supplier’s name (1 to 200 characters).",
  "product": "Name the product or service (1 to 200 characters).",
  "factor value": "Enter the supplier’s factor as a plain number with up to 6 decimals (no commas or units).",
  "factor unit": "The factor’s unit is missing.",
  "allocation basis": "Choose how the figure is shared with the company.",
  "allocation numerator": "Enter our part of the allocation basis as a plain number with up to 3 decimals.",
  "allocation denominator": "Enter the total of the allocation basis as a plain number with up to 3 decimals.",
  "boundary": "Choose the boundary the supplier’s figure covers.",
  "only the hybrid boundary says how upstream is covered": "For the supplier’s own scope 1 and 2 only (hybrid), say how its upstream inputs are covered.",
  "hybrid upstream coverage": "Say how the supplier’s upstream inputs are covered.",
  "GWP basis": "Choose the GWP basis of the figure (or Not stated).",
  "verification": "Say whether the figure was verified by a third party.",
  "data year": "Enter the year the supplier’s data is for (2012 to 2035).",
  "factor origin": "Say where the factor comes from: the supplier’s own figure, or a secondary database.",
  "superseded spend mapping keys": "Choose up to 50 different spend lines this record replaces.",
  "superseded supplier": "Name the supplier whose spend lines this record replaces (1 to 200 characters).",
  // grid locations
  "grid basis": "Choose where the electricity’s grid rates come from.",
  "ZIP": "Enter the site’s five-digit ZIP code, or choose the U.S. average where the basis allows it.",
  "subregion": "The eGRID subregion can be up to 20 characters.",
  "utility EIA ID": "The utility EIA ID can be up to 40 characters.",
  "resold energy kept out of Scope 2": "Answer whether the resold electricity is kept out of the company’s Scope 2 records.",
  // commuting_average
  "one to ten commuting modes": "List one to ten commuting modes.",
  "occupancy": "Occupancy is a plain number of people per vehicle, or leave it empty.",
  "occupancy is at least 1": "Occupancy is at least 1 person per vehicle.",
  "mode share": "Each mode’s share is a percent with up to 3 decimals (no % sign).",
  "one-way distance": "Each mode’s one-way distance is a plain number with up to 3 decimals.",
  "distance unit": "Choose miles or kilometres for each mode.",
  "working days": "Working days on site must be a whole number from 1 to 366.",
  "shares basis": "Say where the mode shares come from (3 to 300 characters).",
  "distance basis": "Say where the distances come from (3 to 300 characters).",
  // teleworking
  "teleworking carrier": "Choose electricity or natural gas.",
  "baseline basis": "Say how the household baseline was taken off (3 to 300 characters).",
  // asset_energy, partner_reported, building_average
  "asset category": "Choose the category this asset belongs in.",
  "asset carrier": "Choose electricity, natural gas or refrigerant.",
  "asset label": "Name the asset (1 to 200 characters).",
  "asset_energy:counterparty": "The landlord, tenant, processor or franchisee name can be up to 200 characters.",
  "partner_reported:counterparty": "Name the partner whose figure this is (1 to 200 characters).",
  "lease type": "Choose operating lease, finance lease, or not a lease.",
  "operational control basis": "The explanation can be up to 500 characters.",
  "reporting area": "Enter the area the company uses as a plain number.",
  "building area": "Enter the building’s total area as a plain number.",
  "occupancy percent": "Enter the building’s occupancy as a percent with up to 3 decimals.",
  "area unit": "Choose square feet or square metres.",
  "partner category": "Choose the category this partner’s figure belongs in.",
  "Scope 2 basis": "Say whether the partner’s scope 2 is location- or market-based (or Not stated).",
  "no share for an exclusive asset": "The whole figure takes no share: leave the numerator and denominator empty.",
  "period matches": "Answer whether the partner’s figure covers the reporting period.",
  "building category": "Choose category 8, 13 or 14.",
  "uses natural gas": "Say whether the building uses natural gas.",
  "covered days": "Days covered must be a whole number from 1 to 366.",
  // category 11
  "combusted in use": "Say whether the fuel is burned by its users.",
  "energy-using product:product": "Name the product (1 to 200 characters).",
  "lifetime basis": "Choose years or uses.",
  "lifetime": "Enter the expected lifetime (years or uses) as a plain number.",
  "energy per year or use": "Enter the energy used per year or per use as a plain number.",
  "lifetime source": "Say where the lifetime and energy use come from (3 to 300 characters).",
  "use-phase release percent": "Enter the share of the charge released during use, from 0 to 100% with up to 3 decimals. There is no default.",
  "use-phase release percent is at most 100": "The share released during use can’t be more than 100%.",
  "charge per unit": "Enter the charge per unit as a plain number.",
  "charge unit": "Choose kilograms or pounds.",
  "release basis": "Say where the share released during use comes from (3 to 300 characters).",
  // category 12
  "end-of-life basis": "Choose products sold or packaging.",
  "split basis": "Say where the treatment split comes from (3 to 300 characters).",
  "end_of_life_split:product": "The product label can be up to 200 characters.",
  // category 15
  "investee": "Name the investee (1 to 200 characters).",
  "holding type": "Choose the type of holding.",
  "investment path": "Choose what the figure is based on.",
  "attribution denominator": "Choose the attribution denominator and enter its amount as a plain number (USD).",
  "equity share": "Enter the equity share as a percent with up to 3 decimals.",
  "attribution basis": "Choose how the company’s share is attributed.",
  "investee emissions": "Enter the investee’s scope 1 and 2 emissions as a plain number (metric tons CO2e), or leave it empty.",
  "emissions verified": "Say whether the investee’s emissions are verified.",
  "revenue": "Enter the investee’s revenue as a plain number (USD), or leave it empty.",
  "revenue year": "The revenue year must be from 2012 to 2035, or leave it empty.",
  "projected annual emissions": "Enter the projected annual emissions as a plain number (metric tons CO2e), or leave it empty.",
  "lifetime years": "The project lifetime must be a whole number of years from 1 to 100, or leave it empty.",
  "snapshot date": "Enter the date the holding is measured at (YYYY-MM-DD).",
  // data quality
  "data quality basis": "The reason for the data-quality ratings can be up to 500 characters.",
}
/** The token fields of the new kinds (any text up to 80 characters is kept, so only an over-long one is refused). */
const TOKEN_LABELS = new Set(["Commuting mode", "Refrigerant", "Building activity", "Fuel", "Energy carrier", "Energy unit", "Use region", "Gas", "Material"])
/** Generic contract labels (the object shape): never reached from the forms, named plainly if they are. */
const SHAPE = /^(spend line|supplier figure|energy resold|average commuting|teleworking|asset energy|partner figure|building average|fuel sold|energy-using product|greenhouse-gas product|end-of-life split|investment|attribution|treatment split|area allocation|possible duplicate|superseded spend|data quality|data quality indicators|commuting mode \d+)$/

/** Why the contract refuses this payload, in the screen's words; null when it accepts it. */
export function scope3PayloadProblem(kind: Scope3CollectionKind, payload: unknown): string | null {
  try { validateScope3Payload(kind, payload); return null } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    const label = /^Invalid Scope 3 activity details: (.*)\.$/.exec(message)?.[1]
    if (label === undefined) return message === "Invalid Scope 3 activity details." ? "Some details of this record are missing or not in the expected form." : message
    const shapeKind = kind === "sold_energy_product" ? "energy-using product" : kind
    const direct = MESSAGES[`${kind}:${label}`] ?? MESSAGES[`${shapeKind}:${label}`] ?? MESSAGES[label]
    if (direct) return direct
    // Round 3 lane D (PR-12): the message names the field ("Landfilled (%): …"), not only the rule.
    if (/ share$/.test(label)) { const treatment = label.replace(/ share$/, ""); return SCOPE3_PRESAVE_TEXT_R3D.share(`${scope3TokenLabel("treatment", treatment)} (%)`) }
    if (/^data quality /.test(label) || label === "activity data origin") return "Choose a listed data-quality rating or origin, or use the method default."
    if (TOKEN_LABELS.has(label)) return `${label} can be up to 80 characters.`
    if (SHAPE.test(label)) return "Some details of this record are missing or not in the expected form."
    return `Check this answer before saving: ${label}.`
  }
}
/** A data-quality rating or origin the company set needs its reason (the form's rule; the contract allows a blank basis). */
export function scope3DataQualityProblem(payload: unknown): string | null {
  const dq = payload && typeof payload === "object" ? (payload as { dataQuality?: Scope3DataQuality | null }).dataQuality : null
  if (!dq) return null
  const overridden = Object.values(dq.indicators ?? {}).some(rating => rating !== null) || dq.activityDataOrigin !== null
  return overridden && (dq.basis ?? "").trim().length < 3 ? "Say why the data-quality ratings differ from the method defaults (at least 3 characters)." : null
}

// --- NAICS codes for spend lines ---

export interface Scope3NaicsChoice { code: string; title: string; guard: "energy" | "overlap" | "trade" | null }
const set = (name: keyof typeof SCOPE3_SPEND_NAICS_SETS) => new Set<string>(SCOPE3_SPEND_NAICS_SETS[name])
const GUARDS = { energy: set("energy_confirm"), overlap: set("overlap_confirm"), trade: set("trade_sector") }
/** For categories 1 and 2: whether the code is held unless the category is confirmed (energy, other-category or trade-margin codes). */
export function scope3NaicsGuard(category: number, code: string | null): Scope3NaicsChoice["guard"] {
  if ((category !== 1 && category !== 2) || code === null) return null
  return GUARDS.energy.has(code) ? "energy" : GUARDS.overlap.has(code) ? "overlap" : GUARDS.trade.has(code) ? "trade" : null
}
export const SCOPE3_NAICS_GUARD_TEXT: Readonly<Record<"energy" | "overlap" | "trade", string>> = {
  energy: "a fuel or energy code: held unless you confirm the category",
  overlap: "a transport, travel or waste code: held unless you confirm the category",
  trade: "a wholesale or retail (trade margin) code: held unless you confirm the category",
}
// Round 2 polish (lane D): `scope3NaicsChoices` and `scope3NaicsTitle` are in `scope3-naics.ts`, loaded with the spend chunks only.

// --- Shares a user typed (display only) ---

const SHARE = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
/** The exact sum of percent shares written as plain decimals (up to 3 places), or null when one isn't a plain decimal. */
export function scope3SharesTotal(values: readonly string[]): string | null {
  if (!values.every(value => SHARE.test(value))) return null
  const thousandths = values.reduce((sum, value) => { const [whole, fraction = ""] = value.split("."); return sum + BigInt(whole!) * 1000n + BigInt(fraction.padEnd(3, "0")) }, 0n)
  const fraction = (thousandths % 1000n).toString().padStart(3, "0").replace(/0+$/, "")
  return `${thousandths / 1000n}${fraction ? `.${fraction}` : ""}`
}
/** "Shares total 100%" or what is wrong with them (never a block: the adapter or engine holds a profile that doesn't add up). */
export function scope3SharesTotalText(values: readonly string[]): { text: string; ok: boolean } {
  const total = scope3SharesTotal(values)
  if (total === null) return { text: "Shares total: enter every share as a plain percent to see the total.", ok: false }
  return total === "100" ? { text: "Shares total 100%.", ok: true } : { text: `Shares total ${total}%. They must total 100%, or the record isn’t counted.`, ok: false }
}

// --- Investments: the PCAF data-quality score the method assigns (preview text only; DESIGN 7.2) ---

export function scope3PcafPreview(payload: { path?: unknown; emissionsVerified?: unknown }): string {
  if (payload.path === "revenue_eeio") return "PCAF data-quality score 4 (preview): estimated from the investee’s revenue with an economic factor. The method sets the score when the record is calculated."
  return payload.emissionsVerified === true
    ? "PCAF data-quality score 1 (preview): reported emissions, verified by a third party. The method sets the score when the record is calculated."
    : "PCAF data-quality score 2 (preview): reported emissions, not verified. The method sets the score when the record is calculated."
}

// --- Spend lines a supplier or partner record can replace (DESIGN A22) and the plan options Results use ---

const isActive = (record: CollectionActivityRecord) => record.currentVersion.activity.state === "active"
/** Lowercase hex SHA-256 of UTF-8 text (Web Crypto, as browsers and Bun provide it). */
export async function scope3Sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("")
}
/** The company's active spend lines with their mapping keys (`scope3SpendMappingKeyInput`, hashed as the results route does). */
export async function scope3SpendLineChoices(records: readonly CollectionActivityRecord[]): Promise<Scope3SpendLineChoice[]> {
  const lines = records.filter(record => record.kind === "purchase_spend" && isActive(record))
  return Promise.all(lines.map(async record => {
    const activity = record.currentVersion.activity
    const p = activity.payload as unknown as { category: number; supplierName: string; description: string; glAccount: string }
    const mappingKeyInput = scope3SpendMappingKeyInput(p)
    return { recordId: record.id, category: p.category, supplierName: p.supplierName, description: p.description, glAccount: p.glAccount, amount: activity.quantity.originalValue, currency: activity.quantity.originalUnit,
      mappingKeyInput, mappingKey: await scope3Sha256(mappingKeyInput) }
  }))
}
/** The spend categories a record can replace lines of (supplier figures: 1 and 2; partner figures: also their own 4, 5 or 9). */
export function scope3SupersedableCategories(kind: string, category: unknown): number[] {
  return kind === "partner_reported" && [4, 5, 9].includes(category as number) ? [1, 2, category as number] : [1, 2]
}

/** Company setup facts the Scope 3 plan uses (the results route reads the same from setup). */
export interface Scope3SetupFacts { reportingPeriod: Scope3ReportingPeriod | null; consolidationApproach: Scope3ConsolidationApproach | null
  /** I-12h (A14): each setup location's country code, as the results route passes it (a hotel stay without its own country). */
  locationCountries?: ReadonlyMap<string, string | null> }
/** The facts from the current saved company setup, as the results route takes them (no saved setup: neither). */
export function scope3SetupFacts(view: Pick<CompanySetupView, "currentVersion">): Scope3SetupFacts {
  const setup = view.currentVersion?.setup
  if (!setup) return { reportingPeriod: null, consolidationApproach: null }
  const { start, endExclusive } = setup.reportingPeriod
  return { reportingPeriod: start && endExclusive ? { start, endExclusive } : null, consolidationApproach: setup.boundary.approach,
    locationCountries: new Map((setup.locations ?? []).map(location => [location.id, location.countryCode])) }
}
const DRAFT_VERSION = "00000000-0000-4000-8000-000000000000"
const asVersion = (recordId: string, companyId: string, activity: CollectionActivity): Scope3CollectionVersion => ({ id: DRAFT_VERSION, recordId, companyId, revision: 0, previousVersionId: null, correctionReason: null,
  activity, payloadSha256: "0".repeat(64), createdBy: DRAFT_VERSION, createdAt: "1970-01-01T00:00:00.000Z" } as unknown as Scope3CollectionVersion)
/**
 * The plan options the results route passes to `planScope3Calculation` (DESIGN 5.1, 5.2), built from what the Activity
 * screen has: company setup (reporting period and consolidation approach; `undefined` when setup could not be read, so
 * no approach-dependent hold is guessed), the saved records with the draft in place of the record it edits (distance
 * commuting periods, supersession), and the mapping keys already hashed (`scope3SpendLineChoices`). Supersession is keyed
 * by record ID, as the route keys it.
 */
/**
 * BF-02b (b): the plan options with `replacementHeld`: spend line record ID -> the record that claims it, for a line every
 * claimant of which the adapter itself holds (so Results holds the line with `replacing_record_not_counted`; display only).
 * Those lines are not in `supersession`, which keeps, for every other line, the first claimant that can calculate.
 */
export type Scope3ReadinessPlanOptions = Scope3PlanOptions & { replacementHeld?: ReadonlyMap<string, string> }
const NO_EVIDENCE: CollectionEvidenceMetadata[] = []
type ReadinessOptionsInput = { setup: Scope3SetupFacts | undefined; context: CollectionContext; records: readonly CollectionActivityRecord[]; draft?: { recordId: string; activity: CollectionActivity } | null; mappingKeys: ReadonlyMap<string, string>; evidence?: CollectionEvidenceMetadata[] }
/** F2 (QA of PR #63): the last saved-records (no draft) answer, reused while every input is the same object. */
let lastSaved: { input: ReadinessOptionsInput; setupKey: string; output: Scope3ReadinessPlanOptions } | null = null
const setupKey = (setup: Scope3SetupFacts | undefined) => setup ? JSON.stringify([setup.reportingPeriod, setup.consolidationApproach, [...(setup.locationCountries ?? new Map()).entries()]]) : ""
export function scope3ReadinessOptions(input: ReadinessOptionsInput): Scope3ReadinessPlanOptions {
  if (input.draft) return readinessOptions(input)
  const key = setupKey(input.setup), last = lastSaved
  if (last && last.setupKey === key && last.input.context === input.context && last.input.records === input.records && last.input.mappingKeys === input.mappingKeys && last.input.evidence === input.evidence) return last.output
  const output = readinessOptions(input)
  lastSaved = { input, setupKey: key, output }
  return output
}
function readinessOptions(input: ReadinessOptionsInput): Scope3ReadinessPlanOptions {
  const reportingPeriod = input.setup?.reportingPeriod ?? null
  const versions = [
    ...input.records.filter(record => record.id !== input.draft?.recordId && isScope3CollectionKind(record.kind)).map(record => asVersion(record.id, input.context.companyId, record.currentVersion.activity)),
    ...(input.draft && isScope3CollectionKind(input.draft.activity.kind) ? [asVersion(input.draft.recordId, input.context.companyId, input.draft.activity)] : []),
  ]
  return {
    reportingPeriod,
    ...(input.setup ? { consolidationApproach: input.setup.consolidationApproach } : {}),
    ...(input.setup?.locationCountries ? { locationCountries: input.setup.locationCountries } : {}),
    distanceCommutingPeriods: scope3DistanceCommutingPeriods(versions, input.context, { reportingPeriod }),
    ...replacements(versions, input.context, input.evidence ?? NO_EVIDENCE, reportingPeriod, text => input.mappingKeys.get(text) ?? ""),
  }
}

/**
 * F2 (QA of PR #63): whether the adapter holds a replacing record, remembered per saved activity object (saved records keep
 * their objects between renders, so each keystroke plans only a draft that is itself a replacing record).
 */
const heldCache = new WeakMap<object, { context: CollectionContext; evidence: CollectionEvidenceMetadata[]; period: string; held: boolean }>()
function adapterHolds(v: Scope3CollectionVersion, context: CollectionContext, evidence: CollectionEvidenceMetadata[], reportingPeriod: Scope3SetupFacts["reportingPeriod"]): boolean {
  const period = JSON.stringify(reportingPeriod), cached = heldCache.get(v.activity)
  if (cached && cached.context === context && cached.evidence === evidence && cached.period === period) return cached.held
  const held = planScope3Calculation(v, context, evidence, { reportingPeriod }).action === "hold"
  heldCache.set(v.activity, { context, evidence, period, held })
  return held
}
function replacements(versions: Scope3CollectionVersion[], context: CollectionContext, evidence: CollectionEvidenceMetadata[], reportingPeriod: Scope3SetupFacts["reportingPeriod"], sha256: (text: string) => string) {
  const held = new Set(versions.filter(v => (v.activity.kind === "purchase_supplier" || v.activity.kind === "partner_reported") && adapterHolds(v, context, evidence, reportingPeriod)).map(v => v.recordId))
  const supersession = new Map<string, string>(), replacementHeld = new Map<string, string>()
  for (const [line, ids] of planScope3SupersessionClaimants(versions, context, { reportingPeriod, sha256 })) {
    const counted = ids.find(id => !held.has(id))
    if (counted !== undefined) supersession.set(line, counted)
    else replacementHeld.set(line, ids[0]!)
  }
  return { supersession, ...(replacementHeld.size ? { replacementHeld } : {}) }
}

// --- A saved record's Scope 3 details, for the read-only version view ---

const FIELD_WORDS: Readonly<Record<string, string>> = {
  category: "Category", naicsCode: "NAICS code", dollarYear: "Dollar year", marginChoice: "Margins", boughtAtFactoryGate: "Bought at the factory gate", capitalFullCost: "Full acquisition cost", taxTreatment: "Sales tax",
  supplierName: "Supplier", glAccount: "GL account", description: "Description", categoryConfirmed: "Category confirmed", activityOverlap: "Overlap with other records", importId: "Import", importRow: "Import row",
  mappingSource: "NAICS mapping", paidByReportingCompany: "Paid by the company", spendEstimateBasis: "Estimate basis", lineDate: "Line date", possibleDuplicateOf: "Possible duplicate of", duplicateConfirmedDistinct: "Confirmed not a duplicate",
  product: "Product", basis: "Basis", factorValue: "Factor", factorUnit: "Factor unit", allocationBasis: "Allocation", allocationNumerator: "Our part", allocationDenominator: "Total", boundary: "Boundary", gwpBasis: "GWP basis",
  verification: "Verification", dataYear: "Data year", factorOrigin: "Factor origin", hybridUpstreamCoveredBy: "Upstream inputs", supersedesSpend: "Replaces spend lines", gridBasis: "Grid rates", zip: "ZIP", subregion: "eGRID subregion",
  utilityEiaId: "Utility EIA ID", resoldEnergyNotInScope2: "Kept out of Scope 2", workingDays: "Working days", modes: "Modes", sharesBasis: "Shares from", distanceBasis: "Distances from", carrier: "Energy", baselineBasis: "Baseline",
  assetLabel: "Asset", counterpartyName: "Counterparty", leaseType: "Lease", noOperationalControlBasis: "No operational control because", refrigerantGas: "Refrigerant", allocation: "Area allocation", scope2Basis: "Partner scope 2 basis",
  periodMatches: "Covers the reporting period", cbecsActivity: "Building type", usesNaturalGas: "Uses natural gas", coveredDays: "Days covered", fuel: "Fuel", combustedInUse: "Use", productLabel: "Product", lifetimeBasis: "Lifetime in",
  lifetimeQuantity: "Lifetime", energyPerBasis: "Energy per year or use", energyCarrier: "Energy carrier", energyUnit: "Energy unit", useRegion: "Region of use", lifetimeSource: "Lifetime source", gas: "Gas", chargePerUnit: "Charge per unit",
  chargeUnit: "Charge unit", useReleasePercent: "Released during use (%)", releaseBasis: "Release basis", material: "Material", split: "Treatment split (%)", splitBasis: "Split from", investeeName: "Investee", holdingType: "Holding",
  path: "Based on", attribution: "Attribution", investeeEmissions: "Investee scope 1 and 2 (metric tons CO2e)", emissionsVerified: "Emissions verified", revenue: "Revenue (USD)", revenueYear: "Revenue year", initialSponsor: "Initial sponsor",
  projectedAnnual: "Projected annual (metric tons CO2e)", lifetimeYears: "Project lifetime (years)", snapshotDate: "Snapshot date", mode: "Mode", passengerSegments: "Passenger segments", haulBasis: "Haul basis", cabinClass: "Cabin class",
  hotelCountry: "Hotel country", vehicle: "Vehicle", loadBasis: "Load basis", thirdPartyFacilities: "Third-party facilities", treatment: "Treatment", dataQuality: "Data quality",
}
/** The token fields whose words may name a payload key's values (`SCOPE3_FORM_TOKEN_TEXT_I08`), first match wins. */
const TOKEN_FIELDS: Readonly<Record<string, readonly string[]>> = {
  allocationBasis: ["supplierAllocation", "partnerAllocation"], basis: ["supplierBasis", "endOfLifeBasis"], path: ["investmentPath"], mode: ["commutingMode"], material: [], fuel: [],
}
const valueText = (key: string, value: unknown): string => {
  if (value === null) return "Not given"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return key === "category" && M71_CATEGORIES[value - 1] ? `${value} · ${M71_CATEGORIES[value - 1]}` : String(value)
  if (typeof value === "string") {
    if (value === "") return "Not given"
    const field = (TOKEN_FIELDS[key] ?? [key]).find(name => SCOPE3_FORM_TOKEN_TEXT_I08[name]?.[value] !== undefined)
    return field ? SCOPE3_FORM_TOKEN_TEXT_I08[field]![value]! : value
  }
  return JSON.stringify(value)
}
/** `[label, value]` lines for a saved Scope 3 payload, in the payload's key order (read-only history view). */
export function scope3PayloadLines(payload: unknown): Array<readonly [string, string]> {
  if (!payload || typeof payload !== "object") return []
  return Object.entries(payload as Record<string, unknown>).map(([key, value]) => [FIELD_WORDS[key] ?? key, valueText(key, value)] as const)
}

// --- Leases (DESIGN A15; Scope 3 Standard Tables A.1 and A.2): what the company's consolidation approach means for this record ---

const APPROACH_WORDS: Readonly<Record<string, string>> = { operational_control: "operational control", financial_control: "financial control", equity_share: "the equity share approach" }
/**
 * The boundary hint for a leased asset in category 8 (leased in) or 13 (leased out), worded from the adapter's own lease
 * rule (`planScope3Calculation`'s lease guard): which scope the asset belongs in under the company's consolidation
 * approach, and whether the record is held. Null for categories without a lease rule.
 */
export function scope3LeaseHint(category: number, leaseType: string | null, approach: string | null | undefined): string | null {
  if (category !== 8 && category !== 13) return null
  if (leaseType === null) return "Say whether this is an operating or a finance lease: which scope the asset belongs in depends on it (the record is held until then)."
  if (category === 8 && leaseType === "finance") return "An asset leased in under a finance lease is in the company’s own Scope 1 and 2 (Scope 3 Standard Table A.1): record its energy there. This record is held."
  if (leaseType === "finance") return "An asset leased out under a finance lease is reported here, in category 13 (Table A.2)."
  if (approach === undefined) return "Company setup couldn’t be read here, so Results check the lease against the consolidation approach."
  if (approach === null || approach === "unknown") return "Company setup has no consolidation approach yet, so the lease can’t be placed in a scope: the record is held until setup has one."
  const words = APPROACH_WORDS[approach] ?? approach
  if (category === 8) return approach === "operational_control"
    ? "Under operational control, an asset leased in under an operating lease is in the company’s own Scope 1 and 2 (Table A.1) unless the company has no operational control over it: explain why below, or the record is held."
    : `Under ${words}, an asset leased in under an operating lease is reported here, in category 8 (Table A.1).`
  return approach === "operational_control" ? "Under operational control, an asset leased out under an operating lease is reported here, in category 13 (Table A.2)."
    : `Under ${words}, an asset leased out under an operating lease stays in the company’s own Scope 1 and 2 (Table A.2): record its energy there. This record is held.`
}
/** `[value, words]` options for a category select: the categories the kind takes, with their GHG Protocol names. */
export const scope3CategoryOptions = (categories: readonly number[], placeholder: string | null): Array<readonly [string, string]> =>
  [...(placeholder === null ? [] : [["0", placeholder] as const]), ...categories.map(category => [String(category), `${category} · ${M71_CATEGORIES[category - 1]}`] as const)]
