/* eslint-disable @typescript-eslint/no-explicit-any -- the derivation edits records of every kind by path. */
// WO-12 follow-up, the three field labels (CEO ruling, 12 Nov 2026; QA round 1 of PR #57): every field of the Activity record
// form and the Scope 3 record forms is "Required" (the record can't be saved without it), "Needed for results" (it saves,
// and the record shows as needing input until it is filled) or "Optional", in every state the person can be in. This test
// derives each field's label from the real rules rather than trusting the table. Starting from a record that saves, the
// field is left as a person who doesn't answer it leaves it, in each company it is checked in (a U.S. site under
// operational control, a non-U.S. site under financial control or equity share, setup without an approach, with and
// without distance-based commuting records), and then
// - the screen's own save checks (lib/activity-save-checks.ts, which CollectionWorkspace calls; they end with the shared
//   contract the server applies) refuse it → "Required";
// - else the readiness the screen shows (`recordReadiness`, the calculation adapters with the plan options the screen and
//   the results route build) gains a hold, or, where the adapter would calculate, the Python Scope 3 engine
//   (scope3_engine.py, run as the package's engine tests run it) gains a finding → "Needed for results";
// - else → "Optional".
// The label compared is the one the screen shows in that state: `fieldLabel` with the facts `activityFieldFacts` gives.
// Scope 1 and 2 records are judged by the screen's findings and the Scope 1 and 2 adapter (their engines are not run here).
import { describe, expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import type { CollectionActivity, CollectionActivityRecord, CollectionContext, CollectionEvidenceMetadata } from "../../../../packages/neuvetra-database/src/collection-contract"
import { collectionBoundaryHold, planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { planScope3Calculation, scope3SpendMappingKeyInput, SCOPE3_COMPLETION_KINDS, SCOPE3_LEGACY_KINDS, type Scope3CollectionVersion } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { SCOPE3_PAYLOAD_FIXTURES } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import { recordReadiness } from "../components/CollectionWorkspace"
import { scope3BlankPayload } from "./scope3-form-defaults"
import { scope3ReadinessOptions, type Scope3SetupFacts } from "./scope3-forms"
import { activitySaveProblems, prepareActivityForSave } from "./activity-save-checks"
import { ACTIVITY_FIELD_NEEDS, activityFieldFacts, activityFieldNeed, fieldLabel, FIELD_NEED_KINDS } from "./field-needs-wo12"
import { FIELD_NEED_NOTES, FIELD_NEED_TEXT, type FieldNeed } from "./wo12-text"
import { RECORD_HOLD_CODES, recordHold } from "./record-holds-wo12b"
import { RECORD_HOLD_TEXT } from "./wo12b-text"
import { reasonText } from "./plain-language"

const C = "94120000-0000-4000-8000-000000000001", SETUP = "94120000-0000-4000-8000-0000000000aa", SITE = "94120000-0000-4000-8000-0000000000bb", FILE = "94120000-0000-4000-8000-0000000000e1"
const DRAFT = "94120000-0000-4000-8000-0000000000d1", COMMUTER = "94120000-0000-4000-8000-0000000000c7"
const EXCLUDED_SITE = "94120000-0000-4000-8000-0000000000b2", ENTITY_SITE = "94120000-0000-4000-8000-0000000000b3", ENTITY = "94120000-0000-4000-8000-0000000000e7"
const CONTROL_SITE = "94120000-0000-4000-8000-0000000000b4", NO_CONTROL_SITE = "94120000-0000-4000-8000-0000000000b5", LANDLORD_SITE = "94120000-0000-4000-8000-0000000000b6", UNDECIDED_SITE = "94120000-0000-4000-8000-0000000000b7"
const ENTITY_UNDECIDED_SITE = "94120000-0000-4000-8000-0000000000b8", COVERAGE_SITE = "94120000-0000-4000-8000-0000000000b9", ORPHAN_SITE = "94120000-0000-4000-8000-0000000000ba", UNREAD_SITE = "94120000-0000-4000-8000-0000000000bd"
const GONE_SITE = "94120000-0000-4000-8000-0000000000bc", ENTITY_GONE = "94120000-0000-4000-8000-0000000000eb"
const ENTITY_OC = "94120000-0000-4000-8000-0000000000e8", ENTITY_NONE = "94120000-0000-4000-8000-0000000000e9", ENTITY_UNDECIDED = "94120000-0000-4000-8000-0000000000ea", SUPPLIER = "94120000-0000-4000-8000-0000000000f1"
const PERIOD = { start: "2025-01-01", endExclusive: "2026-01-01" }
const context: CollectionContext = { companyId: C, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], boundaryApproach: "operational_control", reportingPeriod: PERIOD,
  locations: [{ id: SITE, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" },
    // WO-12b: a site company setup excludes, and an included site whose entity it excludes.
    { id: EXCLUDED_SITE, name: "Closed depot", inclusion: "excluded", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" },
    { id: ENTITY_SITE, name: "Joint venture plant", inclusion: "included", control: "related_entity", entityId: ENTITY, entity: { id: ENTITY, inclusion: "excluded", control: "operational_control", ownershipPercent: "40" }, startMode: "period_start", endMode: "period_end" },
    // WO-12b QA round 1: the other holds company setup places on every record at a site.
    { id: CONTROL_SITE, name: "Subsidiary plant", inclusion: "included", control: "related_entity", entityId: ENTITY_OC, entity: { id: ENTITY_OC, inclusion: "included", control: "operational_control", ownershipPercent: "60" }, startMode: "period_start", endMode: "period_end" },
    { id: NO_CONTROL_SITE, name: "Minority plant", inclusion: "included", control: "related_entity", entityId: ENTITY_NONE, entity: { id: ENTITY_NONE, inclusion: "included", control: "none", ownershipPercent: "10" }, startMode: "period_start", endMode: "period_end" },
    { id: LANDLORD_SITE, name: "Leased floor", inclusion: "included", control: "landlord", entityId: null, startMode: "period_start", endMode: "period_end" },
    { id: UNDECIDED_SITE, name: "New depot", inclusion: "unknown", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" },
    { id: ENTITY_UNDECIDED_SITE, name: "Partner yard", inclusion: "included", control: "related_entity", entityId: ENTITY_UNDECIDED, entity: { id: ENTITY_UNDECIDED, inclusion: "unknown", control: "operational_control", ownershipPercent: "50" }, startMode: "period_start", endMode: "period_end" },
    { id: COVERAGE_SITE, name: "Pop-up store", inclusion: "included", control: "reporting_company", entityId: null, startMode: "unknown", endMode: "period_end" },
    { id: ORPHAN_SITE, name: "Spun-off plant", inclusion: "included", control: "related_entity", entityId: ENTITY_GONE, entity: null, startMode: "period_start", endMode: "period_end" },
    { id: UNREAD_SITE, name: "Old record site", inclusion: "included", control: "reporting_company", startMode: "period_start", endMode: "period_end" }] } as CollectionContext
const evidence: CollectionEvidenceMetadata[] = [{ id: FILE, companyId: C, bucket: "neuvetra-private-company-evidence", objectKey: `${C}/original/${FILE}`, originalName: "rec.pdf", mediaType: "application/pdf", byteLength: 10, sha256: "a".repeat(64), quarantineStatus: "clean", uploadedBy: C, createdAt: "2025-06-01T00:00:00.000Z" }]
const isScope3 = (kind: string) => (SCOPE3_LEGACY_KINDS as readonly string[]).includes(kind) || (SCOPE3_COMPLETION_KINDS as readonly string[]).includes(kind)

type A = CollectionActivity & { payload: any }
const record = (kind: string, quantity: [string, string], payload: unknown, extra: Partial<A> = {}): A => ({ kind, locationId: SITE, setupVersionId: SETUP, sourceId: "SRC-1", state: "active", withdrawalReason: null,
  quantity: { originalValue: quantity[0], originalUnit: quantity[1], normalizedValue: null, normalizedUnit: null }, quality: "actual", estimateBasis: null, period: { ...PERIOD },
  reference: "Bill 1", notes: "", evidenceIds: [], payload: structuredClone(payload), ...extra }) as A
const fixture = (label: string): A => {
  const found = SCOPE3_PAYLOAD_FIXTURES.find(item => item.label === label)
  if (!found) throw new Error(`no fixture ${label}`)
  return record(found.kind, [found.quantity.originalValue, found.quantity.originalUnit], found.payload)
}
const savedRecord = (id: string, activity: A): CollectionActivityRecord => ({ id, companyId: C, kind: activity.kind, history: [],
  currentVersion: { id, recordId: id, companyId: C, revision: 1, previousVersionId: null, correctionReason: null, activity, payloadSha256: "a".repeat(64), createdBy: C, createdAt: "2025-06-01T00:00:00.000Z" } }) as unknown as CollectionActivityRecord

/** A company the field is checked in: the site's country, setup's consolidation approach and the saved records. */
type World = { name: string; country: string | null; approach: Scope3SetupFacts["consolidationApproach"]; records: CollectionActivityRecord[]; noPeriod?: true
  /** WO-12b QA round 2: the spend lines' mapping keys the screen holds (text → key), as CollectionWorkspace builds them. */
  mappingKeys?: ReadonlyMap<string, string> }
const distanceCommuting = savedRecord(COMMUTER, fixture("employee_commuting: 0029 payload"))
const laterCommuting = savedRecord(COMMUTER, { ...fixture("employee_commuting: 0029 payload"), period: { start: "2026-01-01", endExclusive: "2026-02-01" } })
const WORLDS = {
  usOperational: { name: "U.S. site, operational control", country: "US", approach: "operational_control", records: [] },
  foreignFinancial: { name: "non-U.S. site, financial control", country: "CA", approach: "financial_control", records: [] },
  foreignEquity: { name: "non-U.S. site, equity share", country: "GB", approach: "equity_share", records: [] },
  noApproach: { name: "setup without an approach, no site country", country: null, approach: "unknown", records: [] },
  commutingOverlap: { name: "U.S., operational control, distance-based commuting records for the same period", country: "US", approach: "operational_control", records: [distanceCommuting] },
} satisfies Record<string, World>
const EVERY_COMPANY: World[] = [WORLDS.usOperational, WORLDS.foreignFinancial, WORLDS.foreignEquity]
const setupOf = (world: World): Scope3SetupFacts => ({ reportingPeriod: world.noPeriod ? null : PERIOD, consolidationApproach: world.approach, locationCountries: new Map([[SITE, world.country]]) })

/** Why the screen refuses to save the draft (its own checks, ending with the shared contract), or null. */
const saveRefusal = (draft: A): string | null => activitySaveProblems(draft, { context, evidence, correcting: false, reason: "", zipLookup: null, scope3Completion: true })[0]?.text ?? null
/** WO-12b QA round 1: the company's own context: its consolidation approach is the world's (Scope 1 and 2 read it from here). */
const contextOf = (world: World): CollectionContext => ({ ...context, boundaryApproach: world.approach, ...(world.noPeriod ? { reportingPeriod: { start: null, endExclusive: null } } : {}) }) as CollectionContext
const optionsFor = (draft: A, world: World) => isScope3(draft.kind) ? scope3ReadinessOptions({ setup: setupOf(world), context: contextOf(world), records: world.records, draft: { recordId: DRAFT, activity: prepareActivityForSave(draft, true) }, mappingKeys: world.mappingKeys ?? new Map() }) : null
const HOLDS = new Set(["input_needed", "review_required", "partial", "method_pending", "excluded"])
/** What the record's readiness shows as still needed (the Activity list and record view use the same findings). */
function readiness(draft: A, world: World): string[] {
  const a = prepareActivityForSave(draft, true), options = optionsFor(draft, world)
  return recordReadiness(a, contextOf(world), evidence, undefined, options ? { options, recordId: DRAFT } : undefined).filter(finding => HOLDS.has(finding.status)).map(finding => `${finding.status}: ${finding.reason}`)
}
/** The Scope 3 adapter's plan as the results route makes it (the engine request, when it calculates). */
function plan(draft: A, world: World) {
  const a = prepareActivityForSave(draft, true)
  return planScope3Calculation({ id: DRAFT, recordId: DRAFT, companyId: C, revision: 1, previousVersionId: null, correctionReason: null, activity: a, payloadSha256: "0".repeat(64), createdBy: C, createdAt: "2025-06-01T00:00:00.000Z" } as unknown as Scope3CollectionVersion, contextOf(world), evidence, optionsFor(draft, world)!)
}
/** The Scope 1 and 2 adapter's plan as the results route makes it (the engine call, when it calculates). */
function planScope12(draft: A, world: World = WORLDS.usOperational) {
  return planCollectionCalculation({ id: DRAFT, recordId: DRAFT, companyId: C, revision: 1, previousVersionId: null, correctionReason: null, activity: prepareActivityForSave(draft, true), payloadSha256: "0".repeat(64), createdBy: C, createdAt: "2025-06-01T00:00:00.000Z" }, contextOf(world), evidence)
}
/** The label the screen shows for the field on this draft in this company. */
const factsFor = (draft: A, world: World) => activityFieldFacts({ setup: setupOf(world), activity: prepareActivityForSave(draft, true), options: optionsFor(draft, world), context: contextOf(world), recordId: DRAFT, records: world.records, mappingKeys: world.mappingKeys })
const shown = (draft: A, field: string, world: World) => fieldLabel(draft, field, factsFor(draft, world))

/**
 * QA round 2: the real Scope 1 and 2 engines (scope1_engine.py, scope2_engine.py), each request through the engine's own
 * `handle`, as the engine bridges send it (`{action: "calculate", request}` and `{action: "calculate", input}`), in one
 * Python process for every request. An outcome is "<status>: <findings>" (Scope 2: overall, location- and market-based
 * findings together) or "refused: <code>".
 */
const CALCULATION_DIR = fileURLToPath(new URL("../../../site-api/src/calculation/", import.meta.url))
const SCOPE12_DRIVER = `import json, sys
sys.path.insert(0, sys.argv[1])
import scope1_engine as s1, scope2_engine as s2
out = []
for item in json.load(sys.stdin):
    engine = s1 if item["engine"] == "scope1" else s2
    payload = {"action": "calculate", "request": item["request"]} if item["engine"] == "scope1" else {"action": "calculate", "input": item["input"]}
    try:
        r = engine.handle(payload)["result"]
        findings = list(r.get("findings", [])) + list((r.get("locationBased") or {}).get("findings", [])) + list((r.get("marketBased") or {}).get("findings", []))
        status = r["status"]
        if item["engine"] == "scope2" and status == "complete" and (r.get("marketBased") or {}).get("status") not in (None, "complete"): status = "partial"
        out.append({"status": status, "findings": sorted(set(findings))})
    except engine.Refused as e:
        out.append({"status": "refused", "findings": [e.code]})
    except Exception as e:
        out.append({"status": "error", "findings": [type(e).__name__]})
print(json.dumps(out))
`
function runScope12(calls: Array<{ engine: string }>): Array<{ status: string; findings: string[] }> {
  if (!calls.length) return []
  const out = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? "python3", "-c", SCOPE12_DRIVER, CALCULATION_DIR], { stdin: new TextEncoder().encode(JSON.stringify(calls)), env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", PYTHONDONTWRITEBYTECODE: "1" } })
  if (out.exitCode !== 0) throw new Error(`Scope 1 and 2 engines failed: ${out.stderr.toString().slice(0, 400)}`)
  return JSON.parse(out.stdout.toString())
}
const outcome = (result: { status: string; findings: string[] }) => `${result.status}: ${result.findings.join(", ")}`

// The real Scope 3 engine, run as the package's engine tests run it (one process for every request).
const ENGINE_PATH = fileURLToPath(new URL("../../../site-api/src/calculation/scope3_engine.py", import.meta.url))
function runEngine(requests: unknown[]): Array<{ status: string; findings: string[] }> {
  if (!requests.length) return []
  const out = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? "python3", ENGINE_PATH], { stdin: new TextEncoder().encode(JSON.stringify({ action: "calculate_many", requests })), env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" } })
  const parsed = JSON.parse(out.stdout.toString()) as { status: string; results: Array<{ status: string; result?: { status: string; findings?: string[] } }> }
  if (parsed.status !== "ok") throw new Error(`engine refused: ${out.stdout.toString().slice(0, 300)}`)
  return parsed.results.map(item => ({ status: item.result?.status ?? item.status, findings: item.result?.findings ?? [] }))
}

/**
 * One field: the record it is checked on, how a person leaves it unanswered, and the companies it is checked in (every
 * field in the three companies; a field whose need depends on the company in the companies that tell its states apart).
 * A field always answered (a choice with no empty option the contract requires) is checked by giving it no value at all.
 */
type Case = { kind: string; field: string; base: () => A; leave: (a: A) => void; worlds: World[]; heldBase?: boolean }
const cases: Case[] = []
/** `heldBase`: the starting record is held on purpose (the state under test holds it whatever this field says). */
const add = (kind: string, base: () => A, fields: Record<string, (a: A) => void>, worlds: World[] = EVERY_COMPANY, heldBase = false) => {
  for (const [field, leave] of Object.entries(fields)) cases.push({ kind, field, base, leave, worlds, heldBase })
}
const blank = (kind: string, key: string) => (a: A) => { a.payload[key] = structuredClone((scope3BlankPayload(kind as never) as any)[key]) }
const set = (path: string, value: unknown) => (a: A) => { const keys = path.split("."); let target: any = a; for (const key of keys.slice(0, -1)) target = target[key]; target[keys.at(-1)!] = value }

// ---- Fields every record has (CollectionWorkspace).
const gasBill = () => record("natural_gas", ["1200", "therm"], { heatContent: null })
add("common", gasBill, {
  location: set("locationId", ""), source: set("sourceId", ""), periodStart: set("period.start", ""), periodEnd: set("period.endExclusive", ""),
  quality: set("quality", "unknown"), reference: set("reference", ""), notes: set("notes", ""), evidence: set("evidenceIds", []),
})
add("common", () => record("natural_gas", ["1200", "therm"], { heatContent: null }, { quality: "estimated", estimateBasis: "Pro-rated from 11 bills" }), { estimateBasis: set("estimateBasis", "") })

// ---- Scope 1 and 2.
add("natural_gas", gasBill, { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", "") })
const volumetric = () => record("natural_gas", ["100", "ccf"], { heatContent: { value: "0.1037", unit: "MMBtu per ccf" } })
add("natural_gas", volumetric, { heatContent: set("payload.heatContent", null), heatContentUnit: set("payload.heatContent.unit", "") })
const generator = () => record("distillate_no2", ["", "US_gallon"], { consumption: { basis: "measured", gallons: "100" }, statedHhvMmbtuPerGallon: null })
add("distillate_no2", generator, { unit: set("quantity.originalUnit", ""), fuelBasis: set("payload.consumption.basis", ""), gallons: set("payload.consumption.gallons", ""), statedHhv: set("payload.statedHhvMmbtuPerGallon", null) })
const tanks = () => record("distillate_no2", ["", "US_gallon"], { consumption: { basis: "purchases_with_tank_levels", purchasedGallons: "100", openingGallons: "20", closingGallons: "10" }, statedHhvMmbtuPerGallon: null })
add("distillate_no2", tanks, { purchasedGallons: set("payload.consumption.purchasedGallons", ""), openingGallons: set("payload.consumption.openingGallons", ""), closingGallons: set("payload.consumption.closingGallons", "") })
const van = (extra: Record<string, unknown> = {}) => () => record("vehicle", ["", "US_gallon"], { vehicleGroupId: "SRC-1", fuel: "diesel", vehicleType: "diesel_light_duty_truck", modelYear: 2020, gallons: "100", vehicleCount: null, miles: { value: "1000", basis: "odometer" }, fuelEconomy: null, ...extra })
add("vehicle", van(), {
  unit: set("quantity.originalUnit", ""), vehicleFuel: set("payload.fuel", ""), vehicleType: set("payload.vehicleType", ""), modelYear: set("payload.modelYear", Number("")), vehicleGallons: set("payload.gallons", ""), vehicleCount: set("payload.vehicleCount", null),
  // Miles or fuel economy: without either, CO2 calculates and CH4 and N2O don't (shown as a partial calculation).
  miles: set("payload.miles", null), milesBasis: set("payload.miles.basis", ""),
})
add("vehicle", van({ miles: null, fuelEconomy: { mpg: "22", source: "fleet_record" } }), { mpg: set("payload.fuelEconomy", null), mpgSource: set("payload.fuelEconomy.source", "") })
const refrigerant = () => record("fugitive", ["", "kg"], { gas: "R-410A", unit: "kg", terms: { PN: "0", CN: "0", PS: "2.5", CD: "0", RD: "0" }, insideBoundary: true, maintainsRefrigerantStock: false, retrofitInPeriod: false, contractorRecordsComplete: true, eventChronologyComplete: true })
add("fugitive", refrigerant, {
  gas: set("payload.gas", ""), termsUnit: set("payload.unit", ""),
  ...Object.fromEntries(["PN", "CN", "PS", "CD", "RD"].map(term => [`term-${term}`, set(`payload.terms.${term}`, "")])),
  insideBoundary: set("payload.insideBoundary", null), maintainsRefrigerantStock: set("payload.maintainsRefrigerantStock", null), retrofitInPeriod: set("payload.retrofitInPeriod", null),
  contractorRecords: set("payload.contractorRecordsComplete", false), eventChronology: set("payload.eventChronologyComplete", false),
})
const instrument = (extra: Record<string, unknown> = {}) => ({ type: "energy_attribute_certificate", mwh: "1", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: FILE, generationTechnology: "wind", rateLbPerMwh: null, ...extra })
const meter = (instruments: unknown[] = []) => () => record("electricity", ["10000", "kWh"], { meterOrAccountNumber: "SRC-1", utilityName: "Synthetic", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: null, instruments }, { evidenceIds: [FILE] })
add("electricity", meter(), { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), zip: set("payload.zip", ""), utility: set("payload.utilityName", "") })
add("electricity", meter([instrument()]), {
  instrumentType: set("payload.instruments.0.type", ""), mwh: set("payload.instruments.0.mwh", ""), instrumentQuality: set("payload.instruments.0.qualityCriteriaMet", false), vintage: set("payload.instruments.0.vintageYear", Number("")),
  technology: set("payload.instruments.0.generationTechnology", "unknown"), instrumentEvidence: set("payload.instruments.0.evidenceReference", null),
})
const coal = () => meter([instrument({ generationTechnology: "natural_gas", rateLbPerMwh: { co2: "900", ch4: "0.02", n2o: "0.003" } })])()
// A zero-emission technology (wind, solar, hydro, nuclear) may leave its rates blank: the zero rule applies.
add("electricity", () => meter([instrument({ rateLbPerMwh: { co2: "0", ch4: "0", n2o: "0" } })])(), { "co2-zero": set("payload.instruments.0.rateLbPerMwh", null) })
add("electricity", coal, { co2: set("payload.instruments.0.rateLbPerMwh", null), ch4: set("payload.instruments.0.rateLbPerMwh.ch4", null), n2o: set("payload.instruments.0.rateLbPerMwh.n2o", null) })

// ---- The four Scope 3 kinds of 0029 (their forms are on the Activity screen).
add("transport", () => fixture("transport: 0029 payload"), { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), transportCategory: set("payload.category", 0), transportVehicle: set("payload.vehicle", ""), loadBasis: set("payload.loadBasis", null), thirdPartyFacilities: set("payload.thirdPartyFacilities", "unknown") })
add("waste", () => fixture("waste: 0029 payload"), { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), wasteCategory: set("payload.category", 0), material: set("payload.material", ""), treatment: set("payload.treatment", "") })
add("business_travel", () => fixture("business_travel: 0029 payload"), { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), travelMode: set("payload.mode", ""), passengerSegments: set("payload.passengerSegments", null) })
add("business_travel", () => fixture("business_travel: v2 with cabin class"), { cabinClass: set("payload.cabinClass", null) })
add("business_travel", () => fixture("business_travel: v2 with data quality"), { haulBasis: set("payload.haulBasis", null) })
add("business_travel", () => fixture("business_travel: v2 hotel stay in room-nights (normalized from 0030)"), { hotelCountry: set("payload.hotelCountry", null) })
add("employee_commuting", () => fixture("employee_commuting: 0029 payload"), { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), commutingMode: set("payload.mode", "") })

// ---- Data quality (every Scope 3 record at schema 30).
add("dataQuality", () => fixture("transport: with data quality"), {
  ...Object.fromEntries(["technological", "temporal", "geographical", "completeness", "reliability"].map(name => [`dq-${name}`, set(`payload.dataQuality.indicators.${name}`, null)])),
  "dq-origin": set("payload.dataQuality.activityDataOrigin", null), "dq-basis": set("payload.dataQuality.basis", null),
})
// The basis is asked for only when the company sets a rating or an origin; with the method's defaults it is optional.
add("dataQuality", () => { const a = fixture("transport: 0029 payload"); a.payload.dataQuality = { indicators: { technological: null, temporal: null, geographical: null, completeness: null, reliability: null }, activityDataOrigin: null, basis: "Method defaults kept." }; return a }, { "dq-basis-default": set("payload.dataQuality.basis", null) })

// ---- The 0030 kinds (components/scope3).
const S = (kind: string, key: string) => blank(kind, key)
add("purchase_spend", () => fixture("purchase_spend: manual line"), {
  category: set("payload.category", 0), quantity: set("quantity.originalValue", ""), currency: set("quantity.originalUnit", ""), description: S("purchase_spend", "description"), supplier: S("purchase_spend", "supplierName"),
  glAccount: S("purchase_spend", "glAccount"), naicsSearch: () => {}, naicsCode: S("purchase_spend", "naicsCode"), dollarYear: S("purchase_spend", "dollarYear"), lineCovers: () => {}, priceBasis: set("payload.marginChoice", ""),
  taxTreatment: S("purchase_spend", "taxTreatment"), activityOverlap: S("purchase_spend", "activityOverlap"), firstDay: set("period.start", ""), lastDay: set("period.endExclusive", ""),
})
add("purchase_spend", () => fixture("purchase_spend: line date 31 March 2025"), { lineDate: S("purchase_spend", "lineDate") })
add("purchase_spend", () => fixture("purchase_spend: imported capital good, without margins"), { capitalFullCost: S("purchase_spend", "capitalFullCost") })
add("purchase_spend", () => fixture("purchase_spend: longest texts; category 9 with overlap confirmed"), {
  paidByReportingCompany: S("purchase_spend", "paidByReportingCompany"), spendEstimateBasis: set("payload.spendEstimateBasis", ""), "activityOverlap-fallback": S("purchase_spend", "activityOverlap"),
})
// A code usually recorded elsewhere (energy, here) counts in category 1 only once the category is confirmed.
add("purchase_spend", () => { const a = fixture("purchase_spend: manual line"); a.payload.naicsCode = "324110"; a.payload.categoryConfirmed = true; return a }, { categoryConfirmed: S("purchase_spend", "categoryConfirmed") })
add("purchase_spend", () => fixture("purchase_spend: possible duplicate confirmed distinct"), { duplicateConfirmedDistinct: S("purchase_spend", "duplicateConfirmedDistinct") })
add("purchase_supplier", () => fixture("purchase_supplier: product factor"), {
  category: set("payload.category", 0), supplier: S("purchase_supplier", "supplierName"), product: S("purchase_supplier", "product"), factorOrigin: S("purchase_supplier", "factorOrigin"), basis: set("payload.basis", ""),
  quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), factor: S("purchase_supplier", "factorValue"), boundary: S("purchase_supplier", "boundary"), gwpBasis: S("purchase_supplier", "gwpBasis"),
  verification: S("purchase_supplier", "verification"), dataYear: S("purchase_supplier", "dataYear"), supersedes: S("purchase_supplier", "supersedesSpend"),
})
add("purchase_supplier", () => fixture("purchase_supplier: allocated total by revenue, with data quality"), { allocationBasis: set("payload.allocationBasis", ""), allocationNumerator: set("payload.allocationNumerator", ""), allocationDenominator: set("payload.allocationDenominator", "") })
add("purchase_supplier", () => fixture("purchase_supplier: hybrid, upstream in other records"), { hybridUpstreamCoveredBy: set("payload.hybridUpstreamCoveredBy", "") })
add("purchase_supplier", () => fixture("purchase_supplier: supersedes fifty mapping keys"), { supersedesSupplier: set("payload.supersedesSpend.supplierName", ""), supersedesLines: set("payload.supersedesSpend.mappingKeys", []) })
const grid = (kind: string) => ({ zip: S(kind, "zip"), subregion: S(kind, "subregion"), utilityEiaId: set("payload.utilityEiaId", null), utilityChoice: S(kind, "subregion") })
add("energy_resold", () => fixture("energy_resold: subregion"), { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), gridBasis: set("payload.gridBasis", ""), ...grid("energy_resold"), resoldEnergyNotInScope2: S("energy_resold", "resoldEnergyNotInScope2") })
add("commuting_average", () => fixture("commuting_average: three modes"), {
  quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), workingDays: S("commuting_average", "workingDays"), sharesBasis: S("commuting_average", "sharesBasis"), distanceBasis: S("commuting_average", "distanceBasis"),
  mode: set("payload.modes.0.mode", ""), share: set("payload.modes.0.sharePercent", ""), distance: set("payload.modes.0.oneWayDistance", ""),
  distanceUnit: set("payload.modes.0.distanceUnit", ""), occupancy: set("payload.modes.0.occupancy", null),
})
add("teleworking", () => fixture("teleworking: electricity"), { carrier: set("payload.carrier", ""), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), baselineBasis: S("teleworking", "baselineBasis"), ...grid("teleworking") })
add("asset_energy", () => fixture("asset_energy: electricity, sub-metered"), {
  category: S("asset_energy", "category"), asset: S("asset_energy", "assetLabel"), counterparty: S("asset_energy", "counterpartyName"), carrier: set("payload.carrier", ""), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""),
  leaseType: S("asset_energy", "leaseType"), noOperationalControlBasis: S("asset_energy", "noOperationalControlBasis"), ...grid("asset_energy"), allocation: S("asset_energy", "allocation"),
})
add("asset_energy", () => fixture("asset_energy: refrigerant, category 14, no lease type"), { refrigerant: set("payload.refrigerantGas", "") })
add("asset_energy", () => fixture("asset_energy: natural gas with area allocation, category 13 finance lease"), {
  reportingArea: set("payload.allocation.reportingArea", ""), buildingArea: set("payload.allocation.buildingArea", ""), occupancyPercent: set("payload.allocation.occupancyPercent", ""), areaUnit: set("payload.allocation.areaUnit", ""),
})
add("partner_reported", () => fixture("partner_reported: tenant share by area"), {
  category: S("partner_reported", "category"), partner: S("partner_reported", "counterpartyName"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), allocationBasis: S("partner_reported", "allocationBasis"),
  allocationNumerator: set("payload.allocationNumerator", ""), allocationDenominator: set("payload.allocationDenominator", ""), scope2Basis: S("partner_reported", "scope2Basis"), gwpBasis: S("partner_reported", "gwpBasis"),
  verification: set("payload.verification", "unverified"), leaseType: S("partner_reported", "leaseType"), periodMatches: S("partner_reported", "periodMatches"), supersedes: S("partner_reported", "supersedesSpend"),
})
add("partner_reported", () => { const a = fixture("partner_reported: tenant share by area"); a.payload.category = 8; a.payload.noOperationalControlBasis = "Partner operates the site."; return a }, { noOperationalControlBasis: S("partner_reported", "noOperationalControlBasis") })
add("building_average", () => fixture("building_average: office"), {
  category: S("building_average", "category"), cbecsActivity: S("building_average", "cbecsActivity"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), coveredDays: S("building_average", "coveredDays"),
  usesNaturalGas: S("building_average", "usesNaturalGas"), gridBasis: set("payload.gridBasis", ""), leaseType: S("building_average", "leaseType"), noOperationalControlBasis: S("building_average", "noOperationalControlBasis"), ...grid("building_average"),
})
add("sold_fuel", () => fixture("sold_fuel: propane in gallons"), { fuel: S("sold_fuel", "fuel"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), combustedInUse: set("payload.combustedInUse", "") })
add("sold_energy_product", () => fixture("sold_energy_product: electricity over ten years"), {
  product: S("sold_energy_product", "productLabel"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), lifetimeBasis: set("payload.lifetimeBasis", ""), lifetime: S("sold_energy_product", "lifetimeQuantity"),
  energyCarrier: set("payload.energyCarrier", ""), energyPer: S("sold_energy_product", "energyPerBasis"), energyUnit: set("payload.energyUnit", ""), useRegion: S("sold_energy_product", "useRegion"), lifetimeSource: S("sold_energy_product", "lifetimeSource"),
})
add("sold_ghg_product", () => fixture("sold_ghg_product: annual leak rate"), {
  product: S("sold_ghg_product", "productLabel"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), gas: S("sold_ghg_product", "gas"), charge: S("sold_ghg_product", "chargePerUnit"), chargeUnit: set("payload.chargeUnit", ""),
  release: S("sold_ghg_product", "useReleasePercent"), releaseBasis: S("sold_ghg_product", "releaseBasis"),
})
add("end_of_life_split", () => fixture("end_of_life_split: packaging with a known split"), {
  basis: set("payload.basis", ""), product: S("end_of_life_split", "productLabel"), material: S("end_of_life_split", "material"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""),
  splitKnown: (a: A) => { a.payload.split = null; a.payload.splitBasis = null }, share: set("payload.split.recycled", ""), splitBasis: set("payload.splitBasis", ""),
})
add("investment", () => fixture("investment: equity share, investee reported"), {
  investee: S("investment", "investeeName"), holding: S("investment", "holdingType"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), snapshotDate: S("investment", "snapshotDate"),
  attribution: set("payload.attribution.basis", ""), equityShare: set("payload.attribution.percent", ""), path: set("payload.path", ""), investeeEmissions: S("investment", "investeeEmissions"),
  emissionsVerified: S("investment", "emissionsVerified"), gwpBasis: S("investment", "gwpBasis"),
})
add("investment", () => fixture("investment: listed equity over EVIC"), { denominatorType: set("payload.attribution.denominatorType", ""), denominator: set("payload.attribution.denominator", "") })
add("investment", () => fixture("investment: revenue EEIO proxy"), {
  revenue: S("investment", "revenue"), revenueYear: S("investment", "revenueYear"), investeeNaics: S("investment", "naicsCode"), naicsSearch: () => {},
})
add("investment", () => fixture("investment: project finance as initial sponsor"), { initialSponsor: (a: A) => { a.payload.initialSponsor = false; a.payload.projectedAnnual = null; a.payload.lifetimeYears = null }, projectedAnnual: S("investment", "projectedAnnual"), lifetimeYears: S("investment", "lifetimeYears") })

// ---- The fields whose need depends on another answer, the site or company setup (QA round 1 of PR #57), in each state.
const hotelStay = () => fixture("business_travel: v2 hotel stay in room-nights (normalized from 0030)")
add("business_travel", hotelStay, { hotelCountry: set("payload.hotelCountry", null) }, [WORLDS.usOperational, WORLDS.foreignFinancial, WORLDS.noApproach])
add("commuting_average", () => fixture("commuting_average: overlap ruled out"), { activityOverlap: S("commuting_average", "activityOverlap") }, [WORLDS.usOperational, WORLDS.commutingOverlap, { ...WORLDS.commutingOverlap, name: "distance-based commuting records for another period", records: [laterCommuting] }])
const leaseIn = (base: () => A) => () => { const a = base(); a.payload.category = 8; a.payload.leaseType = "operating"; a.payload.noOperationalControlBasis = "The landlord operates the site."; return a }
for (const [kind, base] of [["asset_energy", () => fixture("asset_energy: electricity, sub-metered")], ["building_average", () => fixture("building_average: office")], ["partner_reported", () => fixture("partner_reported: tenant share by area")]] as const)
  add(kind, leaseIn(base), { noOperationalControlBasis: S(kind, "noOperationalControlBasis") }, [WORLDS.usOperational, WORLDS.foreignFinancial, WORLDS.foreignEquity, WORLDS.noApproach], true)
// Vehicle miles and fuel economy are alternatives: the one in use is needed, the other is not (the pair: below).
add("vehicle", van(), { mpg: set("payload.fuelEconomy", null), mpgSource: set("payload.fuelEconomy", null) })
add("vehicle", van({ miles: null, fuelEconomy: { mpg: "22", source: "fleet_record" } }), { miles: set("payload.miles", null), milesBasis: set("payload.miles", null) })
// A refrigerant record outside the boundary is excluded, and one that keeps a stock is held for review, whatever else is answered.
const outside = () => { const a = refrigerant(); a.payload.insideBoundary = false; return a }
const stocked = () => { const a = refrigerant(); a.payload.maintainsRefrigerantStock = true; return a }
add("fugitive", outside, { ...Object.fromEntries(["PN", "CN", "PS", "CD", "RD"].map(term => [`term-${term}`, set(`payload.terms.${term}`, "")])), maintainsRefrigerantStock: set("payload.maintainsRefrigerantStock", null),
  retrofitInPeriod: set("payload.retrofitInPeriod", null), contractorRecords: set("payload.contractorRecordsComplete", false), eventChronology: set("payload.eventChronologyComplete", false) }, EVERY_COMPANY, true)
// QA round 2: either applicability question answered Yes makes the other moot (held for method review either way).
const retrofitted = () => { const a = refrigerant(); a.payload.retrofitInPeriod = true; return a }
add("fugitive", stocked, { retrofitInPeriod: set("payload.retrofitInPeriod", null) }, EVERY_COMPANY, true)
add("fugitive", retrofitted, { maintainsRefrigerantStock: set("payload.maintainsRefrigerantStock", null) }, EVERY_COMPANY, true)
add("fugitive", stocked, { ...Object.fromEntries(["PN", "CN", "PS", "CD", "RD"].map(term => [`term-${term}`, set(`payload.terms.${term}`, "")])), contractorRecords: set("payload.contractorRecordsComplete", false), eventChronology: set("payload.eventChronologyComplete", false) }, EVERY_COMPANY, true)

// ---- WO-12b: record holds. One answer holds the record whatever else is filled in (record-holds-wo12b.ts), so while it
// stands no other result field can make the record count: each such field is Optional, the answer that holds it keeps its
// own label, and fields the save needs stay Required. Every state is checked in every company world (the category 13
// operating lease is held only under financial control or equity share, so its U.S. operational-control rows check that the
// usual labels come back there).
const withPayload = (base: () => A, change: Record<string, unknown>, extra: Partial<A> = {}) => () => { const a = base(); Object.assign(a.payload, change); Object.assign(a, extra); return a }
const assetLease = (category: number, leaseType: string) => withPayload(() => fixture("asset_energy: electricity, sub-metered"), { category, leaseType, noOperationalControlBasis: category === 8 && leaseType === "operating" ? "Landlord operates HVAC and metering." : null })
const buildingLease = (category: number, leaseType: string) => withPayload(() => fixture("building_average: office"), { category, leaseType, noOperationalControlBasis: category === 8 && leaseType === "operating" ? "Shared building; landlord meters." : null })
const partnerLease = (category: number, leaseType: string) => withPayload(() => fixture("partner_reported: tenant share by area"), { category, leaseType, noOperationalControlBasis: null })
const assetHeldFields = { counterparty: S("asset_energy", "counterpartyName"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), leaseType: S("asset_energy", "leaseType"), ...grid("asset_energy"), allocation: S("asset_energy", "allocation") }
const buildingHeldFields = { cbecsActivity: S("building_average", "cbecsActivity"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), coveredDays: S("building_average", "coveredDays"), usesNaturalGas: S("building_average", "usesNaturalGas"), leaseType: S("building_average", "leaseType"), ...grid("building_average") }
const partnerHeldFields = { partner: S("partner_reported", "counterpartyName"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), allocationBasis: S("partner_reported", "allocationBasis"), scope2Basis: S("partner_reported", "scope2Basis"),
  verification: set("payload.verification", "unverified"), leaseType: S("partner_reported", "leaseType"), periodMatches: S("partner_reported", "periodMatches") }
/** The states of the ruling and of the WO-12b search, each with the fields checked in it. */
const HOLD_STATES: Array<{ name: string; code: string | null; kind: string; base: () => A; fields: Record<string, (a: A) => void> }> = [
  { name: "category 8 finance lease (asset energy)", code: "finance_lease_in_scope1_2", kind: "asset_energy", base: assetLease(8, "finance"), fields: assetHeldFields },
  { name: "category 8 finance lease (building average)", code: "finance_lease_in_scope1_2", kind: "building_average", base: buildingLease(8, "finance"), fields: buildingHeldFields },
  { name: "category 8 finance lease (partner reported)", code: "finance_lease_in_scope1_2", kind: "partner_reported", base: partnerLease(8, "finance"), fields: partnerHeldFields },
  { name: "category 13 operating lease (asset energy)", code: "lessor_operating_lease_in_scope1_2", kind: "asset_energy", base: assetLease(13, "operating"), fields: assetHeldFields },
  { name: "category 13 operating lease (building average)", code: "lessor_operating_lease_in_scope1_2", kind: "building_average", base: buildingLease(13, "operating"), fields: buildingHeldFields },
  { name: "category 13 operating lease (partner reported)", code: "lessor_operating_lease_in_scope1_2", kind: "partner_reported", base: partnerLease(13, "operating"), fields: partnerHeldFields },
  { name: "category 9 spend the company paid for", code: "category_9_spend_paid_by_company", kind: "purchase_spend", base: withPayload(() => fixture("purchase_spend: longest texts; category 9 with overlap confirmed"), { paidByReportingCompany: true }),
    fields: { quantity: set("quantity.originalValue", ""), currency: set("quantity.originalUnit", ""), naicsCode: S("purchase_spend", "naicsCode"), dollarYear: S("purchase_spend", "dollarYear"), "activityOverlap-fallback": S("purchase_spend", "activityOverlap"), paidByReportingCompany: S("purchase_spend", "paidByReportingCompany"), spendEstimateBasis: set("payload.spendEstimateBasis", "") } },
  { name: "category 3 spend", code: "spend_proxy_for_category_3_not_enabled", kind: "purchase_spend", base: withPayload(() => fixture("purchase_spend: manual line"), { category: 3, naicsCode: "324110", activityOverlap: "none_confirmed" }),
    fields: { category: set("payload.category", 0), quantity: set("quantity.originalValue", ""), currency: set("quantity.originalUnit", ""), naicsCode: S("purchase_spend", "naicsCode"), dollarYear: S("purchase_spend", "dollarYear"), "activityOverlap-fallback": S("purchase_spend", "activityOverlap") } },
  { name: "refrigerant equipment retrofitted and with a stock", code: "simplified_method_not_applicable", kind: "fugitive", base: withPayload(refrigerant, { maintainsRefrigerantStock: true, retrofitInPeriod: true }),
    fields: { insideBoundary: set("payload.insideBoundary", null), maintainsRefrigerantStock: set("payload.maintainsRefrigerantStock", null), retrofitInPeriod: set("payload.retrofitInPeriod", null), contractorRecords: set("payload.contractorRecordsComplete", false), "term-PS": set("payload.terms.PS", "") } },
]
// A site company setup excludes, or whose entity it excludes: a record of every kind there is never counted.
const SITE_HELD_FIELDS: Array<[string, () => A, Record<string, (a: A) => void>]> = [
  ["natural_gas", gasBill, { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), location: set("locationId", "") }],
  ["natural_gas", volumetric, { heatContent: set("payload.heatContent", null) }],
  ["electricity", meter([instrument()]), { quantity: set("quantity.originalValue", ""), mwh: set("payload.instruments.0.mwh", ""), instrumentQuality: set("payload.instruments.0.qualityCriteriaMet", false), instrumentEvidence: set("payload.instruments.0.evidenceReference", null) }],
  ["vehicle", van(), { vehicleGallons: set("payload.gallons", ""), miles: set("payload.miles", null) }],
  ["fugitive", refrigerant, { "term-PN": set("payload.terms.PN", ""), insideBoundary: set("payload.insideBoundary", null), contractorRecords: set("payload.contractorRecordsComplete", false) }],
  ["transport", () => fixture("transport: 0029 payload"), { quantity: set("quantity.originalValue", ""), loadBasis: set("payload.loadBasis", null) }],
  ["purchase_spend", () => fixture("purchase_spend: manual line"), { quantity: set("quantity.originalValue", ""), naicsCode: S("purchase_spend", "naicsCode") }],
  ["asset_energy", () => fixture("asset_energy: electricity, sub-metered"), { quantity: set("quantity.originalValue", ""), ...grid("asset_energy") }],
  ["investment", () => fixture("investment: equity share, investee reported"), { quantity: set("quantity.originalValue", ""), investeeEmissions: S("investment", "investeeEmissions") }],
]
const atSite = (base: () => A, site: string) => () => { const a = base(); a.locationId = site; return a }
const SCOPE12_HELD = SITE_HELD_FIELDS.filter(([kind]) => !isScope3(kind)), SCOPE3_HELD = SITE_HELD_FIELDS.filter(([kind]) => isScope3(kind))
/** What holds a state's record in a world (null: nothing, and the usual labels apply). */
type Expect = (world: World, kind: string) => string | null
const SITES: Array<[string, string, Expect]> = [
  [EXCLUDED_SITE, "a site excluded in company setup", () => "location_excluded_by_company_setup"],
  [ENTITY_SITE, "a site whose entity company setup excludes", () => "entity_excluded_by_company_setup"],
  // QA round 1 (B1, B3): an entity's control. Scope 1 and 2 check it after the approach (equity share holds first).
  [CONTROL_SITE, "a site whose entity is under operational control", (world, kind) => isScope3(kind) ? null : world.approach === "equity_share" ? "equity_share_not_supported" : world.approach === "financial_control" ? "entity_control_unresolved" : null],
  [NO_CONTROL_SITE, "a site whose entity has no control identified", (world, kind) => isScope3(kind) ? null : world.approach === "equity_share" ? "equity_share_not_supported" : "entity_outside_control_boundary"],
  [LANDLORD_SITE, "a site whose equipment the landlord controls", (world, kind) => isScope3(kind) ? null : world.approach === "equity_share" ? "equity_share_not_supported" : "location_control_unresolved"],
  [UNDECIDED_SITE, "a site not yet included or excluded", () => "location_inclusion_unknown"],
  [ENTITY_UNDECIDED_SITE, "a site whose entity is not yet included or excluded", () => "entity_inclusion_unknown"],
  [ORPHAN_SITE, "a site linked to an entity setup no longer has", () => "location_entity_unresolved"],
  [UNREAD_SITE, "a site whose boundary details weren't read", () => "boundary_metadata_unavailable"],
  [GONE_SITE, "a site no longer in company setup", () => "location_not_in_current_setup"],
  [COVERAGE_SITE, "a site without a coverage start", (world, kind) => !isScope3(kind) && world.approach === "equity_share" ? "equity_share_not_supported" : "location_coverage_unknown"],
]
const EXPECT: Map<() => A, Expect> = new Map()
for (const state of HOLD_STATES) EXPECT.set(state.base, (world, kind) => !isScope3(kind) && world.approach === "equity_share" ? "equity_share_not_supported" : state.code === "lessor_operating_lease_in_scope1_2" && world.approach === "operational_control" ? null : state.code)
for (const [site, siteName, expect] of SITES) for (const [kind, base, fields] of SITE_HELD_FIELDS) {
  const state = { name: `${kind} at ${siteName}`, code: null, kind, base: atSite(base, site), fields }
  HOLD_STATES.push(state); EXPECT.set(state.base, expect)
}
// QA round 1 (B1): company setup that holds every record of a scope: equity share and no approach (Scope 1 and 2), no
// approach (Scope 3), no reporting period (Scope 1 and 2).
const COMPANY_WORLDS: Array<[World, Expect]> = [
  [WORLDS.foreignEquity, (_world, kind) => isScope3(kind) ? null : "equity_share_not_supported"],
  [WORLDS.noApproach, (_world, kind) => isScope3(kind) ? "scope3_consolidation_approach_required" : "boundary_approach_unknown"],
  [{ ...WORLDS.usOperational, name: "U.S. site, operational control, setup without a reporting period", noPeriod: true }, (_world, kind) => isScope3(kind) ? null : "reporting_period_unknown"],
]
const COMPANY_STATES: Array<{ name: string; kind: string; base: () => A; fields: Record<string, (a: A) => void>; world: World; expect: Expect }> = []
for (const [world, expect] of COMPANY_WORLDS) for (const [kind, base, fields] of [...SCOPE12_HELD, ...SCOPE3_HELD]) {
  const state = { name: `${kind} (${world.name})`, kind, base: () => base(), fields, world, expect }
  COMPANY_STATES.push(state); EXPECT.set(state.base, expect)
}
// QA round 1 (B2): a spend line a supplier record replaces (the supersession pre-pass, by the supplier name).
// QA round 2: by each match kind the server's rule has (planScope3Supersession): the line's supplier name, its mapping key
// (GL account, supplier and description together), or both. The fields the match is made on keep their labels.
const replacedLine = () => fixture("purchase_spend: manual line")
const LINE_KEY_TEXT = scope3SpendMappingKeyInput(replacedLine().payload), LINE_KEY = "b".repeat(64)
// BF-02b: saved, as a real save stores it (its quantity normalized), so the adapter can calculate it and it replaces the line.
const supplierRecordBy = (supplierName: string, mappingKeys: string[]) => savedRecord(SUPPLIER, (() => { const a = fixture("purchase_supplier: product factor"); a.payload.category = 1; a.payload.supersedesSpend = { supplierName, mappingKeys }; a.quantity = { ...a.quantity, normalizedValue: a.quantity.originalValue, normalizedUnit: a.quantity.originalUnit }; return a })())
const MATCHES = [["name", supplierRecordBy("Synthetic Software LLC", [])], ["key", supplierRecordBy("A different supplier", [LINE_KEY])], ["both", supplierRecordBy("synthetic  software llc", [LINE_KEY])]] as const
const REPLACED_WORLDS: World[] = MATCHES.flatMap(([match, record]) => EVERY_COMPANY.map(world => ({ ...world, name: `${world.name}, a supplier record replacing the line by ${match}`, records: [record], mappingKeys: new Map([[LINE_KEY_TEXT, LINE_KEY]]) })))
const replacedFields = { quantity: set("quantity.originalValue", ""), currency: set("quantity.originalUnit", ""), naicsCode: S("purchase_spend", "naicsCode"), dollarYear: S("purchase_spend", "dollarYear"),
  supplier: S("purchase_spend", "supplierName"), glAccount: S("purchase_spend", "glAccount"), description: S("purchase_spend", "description") }
EXPECT.set(replacedLine, () => "superseded_by_supplier_record")
for (const state of HOLD_STATES) add(state.kind, state.base, state.fields, EVERY_COMPANY, true)
for (const state of COMPANY_STATES) add(state.kind, state.base, state.fields, [state.world], true)
add("purchase_spend", replacedLine, replacedFields, REPLACED_WORLDS, true)

type Outcome = { need: FieldNeed; why: string }
/**
 * Every case in every company it is checked in: the label the rules give and the label the screen shows. The engine runs
 * once, over every plan the adapter would calculate (the starting records and the records with the field left blank).
 */
function evaluate() {
  const rows = cases.flatMap(item => item.worlds.map(world => {
    const before = item.base(), after = structuredClone(before)
    item.leave(after)
    const refusedBefore = saveRefusal(before)
    if (refusedBefore) throw new Error(`${item.kind}.${item.field} (${world.name}): the starting record doesn't save (${refusedBefore})`)
    const scope3 = isScope3(item.base().kind)
    const plans = scope3 ? [plan(before, world), plan(after, world)] : [planScope12(before, world), planScope12(after, world)]
    return { item, world, before, after, refused: saveRefusal(after), held: readiness(after, world).filter(reason => !readiness(before, world).includes(reason)), plans, label: shown(before, item.field, world) }
  }))
  const requests: unknown[] = [], scope12: Array<{ engine: string }> = []
  // Scope 3 requests run in one engine process, Scope 1 and 2 calls in another; an index below 0 is a Scope 1/2 call.
  const index = rows.map(row => row.plans.map(p => p.action !== "calculate" || !p.call ? null : "request" in p.call && isScope3(row.before.kind) ? requests.push(p.call.request) - 1 : -scope12.push(p.call as { engine: string })))
  const results = runEngine(requests), results12 = runScope12(scope12)
  return rows.map((row, i) => {
    const [before = null, after = null] = index[i]!.map(at => at === null ? null : at >= 0 ? results[at]! : results12[-at - 1]!)
    const baseHeld = readiness(row.before, row.world).length > 0 || (row.plans[0] !== undefined && row.plans[0].action !== "calculate") || (before !== null && before.status !== "complete" && before.status !== "partial")
    const engineNew = after && after.status !== "complete" && after.status !== "partial" ? after.findings.filter(finding => !(before?.findings ?? []).includes(finding)) : []
    // WO-12b: the record holds the adapters and engines report, before and after the field is left blank. A hold present
    // both times holds the record with the field answered too: no answer to it can make the record count.
    const holdsOf = (plan: { reasons?: readonly string[] } | undefined, result: { findings: string[] } | null) => [...plan?.reasons ?? [], ...result?.findings ?? []].filter(code => (RECORD_HOLD_CODES as readonly string[]).includes(code))
    const holdsBefore = holdsOf(row.plans[0], before), holdsAfter = holdsOf(row.plans[1], after)
    const persists = holdsBefore.filter(code => holdsAfter.includes(code))
    const derived: Outcome = row.refused ? { need: "required", why: row.refused } : persists.length ? { need: "optional", why: `held whatever this field says: ${persists.join(", ")}` }
      : row.held.length ? { need: "results", why: row.held.join(" | ") }
      : engineNew.length ? { need: "results", why: `engine ${after!.status}: ${engineNew.join(", ")}` } : { need: "optional", why: "saves and calculates" }
    return { ...row, derived, engine: after, baseHeld, holdsBefore }
  })
}
/**
 * A starting record held for another reason says nothing about this field (it stays held either way), so such a row is
 * left out, unless the state under test is the one that holds it (`heldBase`). Every field is still checked somewhere.
 */
const all = evaluate()
const evaluated = all.filter(row => !row.baseHeld || row.item.heldBase)

describe("WO-12 field labels: derived from the screen's save checks, the readiness rules and the Scope 3 engine", () => {
  test("each label has its words", () => {
    expect(FIELD_NEED_TEXT).toEqual({ required: "Required", results: "Needed for results", optional: "Optional" })
  })

  test("every field's label, in every company it is checked in, is the one the rules give it", () => {
    const wrong = evaluated.filter(row => row.label.need !== row.derived.need)
      .map(row => `${row.item.kind}.${row.item.field} (${row.world.name}): shown ${row.label.need}, rules say ${row.derived.need} (${row.derived.why})`)
    expect(wrong).toEqual([])
  })

  test("the four QA findings, state by state", () => {
    const label = (kind: string, field: string, world: World, base?: () => A) => evaluated.find(row => row.item.kind === kind && row.item.field === field && row.world === world && (!base || row.item.base === base))!
    // 1. Hotel country: optional at a U.S. site (its country is used), needed elsewhere.
    expect([label("business_travel", "hotelCountry", WORLDS.usOperational).label.need, label("business_travel", "hotelCountry", WORLDS.foreignFinancial).label.need]).toEqual(["optional", "results"])
    // 3. The survey profile's overlap answer: needed only with distance-based commuting records for the same period.
    const overlap = evaluated.filter(row => row.item.kind === "commuting_average" && row.item.field === "activityOverlap").map(row => [row.world.name, row.label.need])
    expect(overlap).toEqual([[WORLDS.usOperational.name, "optional"], [WORLDS.commutingOverlap.name, "results"], ["distance-based commuting records for another period", "optional"]])
    // 4. Why no operational control: needed only under operational control.
    for (const kind of ["asset_energy", "building_average", "partner_reported"]) {
      const rows = evaluated.filter(row => row.item.kind === kind && row.item.field === "noOperationalControlBasis" && row.item.heldBase).map(row => row.label.need)
      expect([kind, ...rows]).toEqual([kind, "results", "optional", "optional", "optional"])
    }
    // The engine was run, and holds what only it holds.
    expect(evaluated.find(row => row.item.kind === "building_average" && row.item.field === "usesNaturalGas")!.derived.why).toContain("natural_gas_use_unknown")
    expect(evaluated.find(row => row.item.kind === "investment" && row.item.field === "investeeEmissions")!.derived.why).toContain("investee_emissions_required")
  })

  test("2. vehicle miles and fuel economy: the one in use is needed, the other optional; with neither, either one completes the record", () => {
    const complete = van()()
    expect(["miles", "milesBasis", "mpg", "mpgSource"].map(field => fieldLabel(complete, field).need)).toEqual(["results", "results", "optional", "optional"])
    const byMpg = van({ miles: null, fuelEconomy: { mpg: "22", source: "fleet_record" } })()
    expect(["miles", "milesBasis", "mpg", "mpgSource"].map(field => fieldLabel(byMpg, field).need)).toEqual(["optional", "optional", "results", "results"])
    // A complete record never shows an empty field as needed.
    for (const draft of [complete, byMpg]) for (const field of ["miles", "milesBasis", "mpg", "mpgSource"]) {
      const empty = field.startsWith("miles") ? draft.payload.miles === null : draft.payload.fuelEconomy === null
      if (empty) expect([field, fieldLabel(draft, field).need]).toEqual([field, "optional"])
    }
    // Neither: the record shows as partly calculated; each alternative alone completes it, so both say "one of".
    const neither = van({ miles: null })()
    expect(readiness(neither, WORLDS.usOperational).length).toBeGreaterThan(0)
    for (const field of ["miles", "milesBasis", "mpg", "mpgSource"]) expect(fieldLabel(neither, field)).toEqual({ need: "results", needNote: FIELD_NEED_NOTES.vehicleEither })
    expect(readiness(van()(), WORLDS.usOperational)).toEqual([])
    expect(readiness(byMpg, WORLDS.usOperational)).toEqual([])
    expect(`${FIELD_NEED_TEXT.results} ${FIELD_NEED_NOTES.vehicleEither}`).toBe("Needed for results (one of: miles driven, or fuel economy)")
  })

  test("what the form can't know is said in the label, not guessed", () => {
    const stay = hotelStay()
    expect(fieldLabel(stay, "hotelCountry", {})).toEqual({ need: "results", needNote: FIELD_NEED_NOTES.hotelCountryUnknown })
    expect(fieldLabel(fixture("commuting_average: three modes"), "activityOverlap", {})).toEqual({ need: "results", needNote: FIELD_NEED_NOTES.commutingOverlapUnknown })
    expect(fieldLabel(leaseIn(() => fixture("asset_energy: electricity, sub-metered"))(), "noOperationalControlBasis", {})).toEqual({ need: "results", needNote: FIELD_NEED_NOTES.leaseApproachUnknown })
    expect(fieldLabel(leaseIn(() => fixture("asset_energy: electricity, sub-metered"))(), "noOperationalControlBasis", { consolidationApproach: "unknown" })).toEqual({ need: "optional", needNote: FIELD_NEED_NOTES.leaseApproachNotChosen })
  })

  test("every declared label is checked against the rules (in at least one company where its record isn't held otherwise); every kind has a table", () => {
    const checked = new Set(evaluated.map(row => `${row.item.kind}.${row.item.field}`))
    const unchecked = Object.entries(ACTIVITY_FIELD_NEEDS).flatMap(([kind, fields]) => Object.keys(fields).map(field => `${kind}.${field}`)).filter(key => !checked.has(key) && !NOT_A_RECORD_VALUE.has(key))
    expect(unchecked).toEqual([])
    expect(activityFieldNeed("natural_gas", "location")).toBe("required")
    for (const kind of ["natural_gas", "distillate_no2", "vehicle", "fugitive", "electricity", ...SCOPE3_LEGACY_KINDS, ...SCOPE3_COMPLETION_KINDS]) expect(FIELD_NEED_KINDS).toContain(kind)
  })
})

describe("WO-12b: record holds (one answer holds the record whatever else is filled in)", () => {
  const holdRows = evaluated.filter(row => HOLD_STATES.some(state => state.base === row.item.base))
  test("the screen's rule finds exactly the holds the adapters and engines report, on every row of every company world", () => {
    const wrong = all.map(row => ({ row, screen: recordHold(row.before, factsFor(row.before, row.world))?.code ?? null, rules: row.holdsBefore[0] ?? null }))
      .filter(item => item.screen !== item.rules).map(item => `${item.row.item.kind}.${item.row.item.field} (${item.row.world.name}): screen ${item.screen}, rules ${item.rules}`)
    expect(wrong).toEqual([])
  })
  test("each state holds the record in every company world it should, with the code expected there (and nothing elsewhere)", () => {
    const wrong = all.filter(row => EXPECT.has(row.item.base)).map(row => ({ row, expected: EXPECT.get(row.item.base)!(row.world, row.item.kind) }))
      .filter(({ row, expected }) => (row.holdsBefore[0] ?? null) !== expected).map(({ row, expected }) => `${row.item.kind}.${row.item.field} (${row.world.name}): rules ${row.holdsBefore[0] ?? null}, expected ${expected}`)
    expect(wrong).toEqual([])
    // Every code the screen treats as a record hold is reached by some row.
    const reached = new Set(all.flatMap(row => row.holdsBefore))
    expect(RECORD_HOLD_CODES.filter(code => !reached.has(code))).toEqual([])
  })
  test("QA round 1: company setup's holds, a replaced spend line and the entity holds say what holds the record, plainly, and where it is decided", () => {
    const at = (base: () => A, world: World) => { const draft = base(); return recordHold(draft, factsFor(draft, world))! }
    const gas = at(gasBill, WORLDS.foreignEquity)
    expect([gas.code, gas.level, gas.fields, gas.question, gas.setupStep]).toEqual(["equity_share_not_supported", "company", [], null, "03 Entities & boundary"])
    expect(gas.text).toBe("These draft calculations don’t support equity-share allocation yet, so Scope 1 and 2 records are saved but not counted.")
    expect([at(gasBill, WORLDS.noApproach).code, at(() => fixture("transport: 0029 payload"), WORLDS.noApproach).code]).toEqual(["boundary_approach_unknown", "scope3_consolidation_approach_required"])
    for (const hold of [gas, at(gasBill, WORLDS.noApproach)]) expect(`${hold.cause} ${hold.text} ${hold.instead ?? ""}`).not.toMatch(/\byour\b|wrong|mistake/i)
    // B3: an excluded entity is the entity's inclusion; no control identified is the entity's control; neither is the site's.
    const excluded = at(atSite(gasBill, ENTITY_SITE), WORLDS.usOperational), outside = at(atSite(gasBill, NO_CONTROL_SITE), WORLDS.usOperational), control = at(atSite(gasBill, CONTROL_SITE), WORLDS.foreignFinancial)
    expect(excluded.instead).toContain("change the entity’s inclusion in company setup (03 Entities & boundary)")
    expect(outside.instead).toBe("If the company does control that entity, change the entity’s control in company setup (03 Entities & boundary) to operational control; otherwise choose another site.")
    expect(outside.cause).toBe("The site chosen (Minority plant) belongs to an entity that company setup marks as outside the control boundary (no control identified), which holds this record, whatever else is filled in.")
    expect(control.cause).toContain("(operational control) isn’t the consolidation approach (financial control)")
    expect(control.instead).toContain("change the entity’s control to it in company setup")
    for (const hold of [excluded, outside, control]) expect(hold.instead).not.toContain("site’s inclusion")
    // Following the words literally leads to a counted record: under financial control, including the excluded entity
    // isn't enough (its control is operational control), so the notice says the next step too; doing both clears the hold.
    expect(excluded.instead).not.toContain("After that change")
    const twoSteps = at(atSite(gasBill, ENTITY_SITE), WORLDS.foreignFinancial)
    expect(twoSteps.instead).toBe("Choose a site of an included entity if the activity belongs to one, or change the entity’s inclusion in company setup (03 Entities & boundary). After that change, the record would still be held: The site chosen (Joint venture plant) belongs to an entity whose control in company setup (operational control) isn’t the consolidation approach (financial control). If financial control is right for that entity, change the entity’s control to it in company setup (03 Entities & boundary); otherwise choose another site.")
    const followed = (world: World, change: (location: any) => void) => { const ctx = structuredClone(contextOf(world)); change(ctx.locations.find(item => item.id === ENTITY_SITE)); return collectionBoundaryHold({ ...gasBill(), locationId: ENTITY_SITE } as CollectionActivity, ctx) }
    expect(followed(WORLDS.foreignFinancial, location => { location.entity.inclusion = "included" })?.reasons).toEqual(["entity_control_unresolved"])
    expect(followed(WORLDS.foreignFinancial, location => { location.entity.inclusion = "included"; location.entity.control = "financial_control" })).toBeNull()
    expect(followed(WORLDS.usOperational, location => { location.entity.inclusion = "included" })).toBeNull()
    // Under equity share the next hold is the company's: the notice says so in the company notice's own words.
    expect(at(atSite(gasBill, ENTITY_SITE), WORLDS.foreignEquity).instead).toContain("After that change, the record would still be held: Company setup’s consolidation approach is equity share, which holds every Scope 1 and 2 record, whatever is filled in here. These draft calculations don’t support equity-share allocation yet, so Scope 1 and 2 records are saved but not counted.")
    const noControl = (world: World) => { const ctx = structuredClone(contextOf(world)); ctx.locations.find(item => item.id === NO_CONTROL_SITE)!.entity!.control = world.approach as "operational_control"; return collectionBoundaryHold({ ...gasBill(), locationId: NO_CONTROL_SITE } as CollectionActivity, ctx) }
    expect([noControl(WORLDS.usOperational), noControl(WORLDS.foreignFinancial)]).toEqual([null, null])
    // B2: the replaced spend line names the replacing record and links to it.
    const replaced = at(replacedLine, REPLACED_WORLDS[0]!)
    expect([replaced.code, replaced.cause, replaced.link]).toEqual(["superseded_by_supplier_record", "Another record replaces this spend line: Supplier-specific purchases · SRC-1.", { href: `#/activity/${SUPPLIER}`, label: "Open Supplier-specific purchases · SRC-1" }])
    // Follow-up: category 3 spend says what to do instead.
    expect(at(withPayload(() => fixture("purchase_spend: manual line"), { category: 3 }), WORLDS.usOperational).instead).toBe("Withdraw the line rather than completing it: nothing on this form makes a category 3 spend line count.")
  })
  test("QA round 2: a field whose answer, left blank or changed, makes a held record count is one the notice names (it keeps its label, with the note), in every match kind", () => {
    const freeing = all.filter(row => row.holdsBefore.length > 0 && row.derived.why === "saves and calculates" && row.engine?.status !== "excluded")
      .map(row => ({ row, hold: recordHold(row.before, factsFor(row.before, row.world))! }))
    expect(freeing.filter(({ row, hold }) => !hold.fields.includes(row.item.field) && !hold.upstream.includes(row.item.field)).map(({ row }) => `${row.item.kind}.${row.item.field} (${row.world.name})`)).toEqual([])
    // The replaced line: by name only Supplier frees it; by key, GL account and Supplier (Description is Required); by both, Supplier.
    const freedBy = (match: string) => [...new Set(freeing.filter(({ row }) => row.world.name.endsWith(`by ${match}`)).map(({ row }) => row.item.field))].sort()
    expect([freedBy("name"), freedBy("key"), freedBy("both")]).toEqual([["supplier"], ["glAccount", "supplier"], ["supplier"]])
    const at = (world: World) => { const draft = replacedLine(); return recordHold(draft, factsFor(draft, world))! }
    const [byName, byKey, byBoth] = ["name", "key", "both"].map(match => at(REPLACED_WORLDS.find(world => world.name.endsWith(`by ${match}`))!))
    expect([byName!.fields, byKey!.fields, byBoth!.fields]).toEqual([["supplier", "category"], ["glAccount", "supplier", "description", "category"], ["supplier", "category"]])
    expect(byName!.instead).toContain("If this line isn’t one of Supplier-specific purchases · SRC-1’s purchases, correct its Supplier; if it isn’t a category 1 or 2 purchase, correct its Category. Any of these stops the replacement")
    expect(byKey!.instead).toContain("correct its GL account, Supplier or Description (the replacement matches those three together); if it isn’t a category 1 or 2 purchase, correct its Category.")
    // QA round 3: complete, not absolute: what frees the line is listed; nothing says "nothing else".
    for (const hold of [byName!, byKey!, byBoth!]) {
      expect(hold.instead).toContain("Otherwise each purchase is counted once: to count this line instead, open Supplier-specific purchases · SRC-1 and change “Spend lines this record replaces” there, or withdraw Supplier-specific purchases · SRC-1.")
      expect(hold.instead).not.toContain("nothing else")
    }
    const label = (world: World, field: string) => { const draft = replacedLine(); return fieldLabel(draft, field, factsFor(draft, world)) }
    const keyWorld = REPLACED_WORLDS.find(world => world.name.endsWith("by key"))!, bothWorld = REPLACED_WORLDS.find(world => world.name.endsWith("by both"))!
    expect(["supplier", "glAccount", "description", "category", "naicsCode", "quantity"].map(field => label(keyWorld, field))).toEqual([
      { need: "optional", needNote: RECORD_HOLD_TEXT.matchNote }, { need: "optional", needNote: RECORD_HOLD_TEXT.matchNote }, { need: "required", needNote: RECORD_HOLD_TEXT.matchNote }, { need: "required", needNote: RECORD_HOLD_TEXT.matchNote }, { need: "optional" }, { need: "optional" }])
    // By both, GL account or Description alone leaves the name match, so they carry no note (their own labels stay).
    expect(["supplier", "glAccount", "description", "category"].map(field => label(bothWorld, field))).toEqual([
      { need: "optional", needNote: RECORD_HOLD_TEXT.matchNote }, { need: "optional" }, { need: "required" }, { need: "required", needNote: RECORD_HOLD_TEXT.matchNote }])
  })

  test("QA round 3: changing a replaced line's Category to one the record doesn't replace makes it count, in every match kind and company; 1 or 2 doesn't", () => {
    const moved = (category: number) => () => { const a = replacedLine(); a.payload.category = category; if (category === 4) { a.payload.naicsCode = "484121"; a.payload.activityOverlap = "none_confirmed" } return a }
    const rows = REPLACED_WORLDS.flatMap(world => [moved(4), moved(2)].map((base, i) => {
      const draft = base(), p = plan(draft, world)
      expect([world.name, saveRefusal(draft)]).toEqual([world.name, null])
      return { world, category: i === 0 ? 4 : 2, plan: p, hold: recordHold(draft, factsFor(draft, world)) }
    }))
    const results = runEngine(rows.filter(row => row.plan.action === "calculate").map(row => row.plan.call!.request))
    let next = 0
    const outcome = rows.map(row => `${row.world.name} → category ${row.category}: ${row.plan.action === "calculate" ? `engine ${results[next++]!.status}` : row.plan.reasons.join(",")}${row.hold ? ` [notice ${row.hold.code}]` : ""}`)
    expect(outcome).toEqual(REPLACED_WORLDS.flatMap(world => [`${world.name} → category 4: engine complete`, `${world.name} → category 2: superseded_by_supplier_record [notice superseded_by_supplier_record]`]))
  })

  // BF-12 (B-2): the screen uses the server's supplier-name rule (scope3SupersessionNameMatch), so a record naming another
  // spelling of the same vendor ("SYNTHETIC SOFTWARE, L.L.C." for "Synthetic Software LLC") replaces the line by name, as
  // Results does; "Synthetic Softwares" (another name) does not.
  test("BF-12: a record naming another spelling of the line's supplier replaces it by name, as on the server", () => {
    const world = (name: string) => ({ ...EVERY_COMPANY[0]!, name: `BF-12 ${name}`, records: [supplierRecordBy(name, [])], mappingKeys: new Map([[LINE_KEY_TEXT, LINE_KEY]]) })
    const at = (name: string) => { const draft = replacedLine(); return recordHold(draft, factsFor(draft, world(name))) }
    expect(replacedLine().payload.supplierName).toBe("Synthetic Software LLC")
    const variant = at("SYNTHETIC SOFTWARE, L.L.C.")!
    expect([variant.code, variant.fields]).toEqual(["superseded_by_supplier_record", ["supplier", "category"]])
    expect(plan(replacedLine(), world("SYNTHETIC SOFTWARE, L.L.C.")).reasons).toEqual(["superseded_by_supplier_record"])
    // Named and keyed: matched by both, so only Supplier (and Category) frees it, as for an exact spelling (QA round 2).
    const keyed = { ...world("SYNTHETIC SOFTWARE, L.L.C."), records: [supplierRecordBy("SYNTHETIC SOFTWARE, L.L.C.", [LINE_KEY])] }
    const both = (() => { const draft = replacedLine(); return recordHold(draft, factsFor(draft, keyed))! })()
    expect([both.code, both.fields]).toEqual(["superseded_by_supplier_record", ["supplier", "category"]])
    expect(at("Synthetic Softwares")?.code ?? null).not.toBe("superseded_by_supplier_record")
    expect(plan(replacedLine(), world("Synthetic Softwares")).reasons).not.toContain("superseded_by_supplier_record")
  })

  test("while it holds: every other result field is Optional, the answer that holds it says so, and the save still needs what it needs", () => {
    const held = holdRows.filter(row => row.holdsBefore.length > 0)
    expect(held.length).toBeGreaterThan(150)
    const optionalNow = held.filter(row => activityFieldNeed(row.item.kind, row.item.field) === "results" && row.label.need === "optional")
    expect(optionalNow.length).toBeGreaterThan(80)
    for (const row of held) {
      const hold = recordHold(row.before, factsFor(row.before, row.world))!
      if (hold.fields.includes(row.item.field)) expect([row.item.kind, row.item.field, row.label.needNote?.endsWith(RECORD_HOLD_TEXT.fieldNote)]).toEqual([row.item.kind, row.item.field, true])
      else expect([row.item.kind, row.item.field, row.label.needNote ?? null]).toEqual([row.item.kind, row.item.field, null])
    }
    // Away from the hold (category 13 under operational control) the usual labels are back.
    const usual = holdRows.filter(row => row.holdsBefore.length === 0 && row.item.field === "subregion" && row.item.base().payload.category === 13)
    expect(usual.map(row => row.label.need)).toEqual(["results", "results"])
  })
})

/** Declared fields that are not a value of the record: checked by the component tests, not by a mutation here. */
const NOT_A_RECORD_VALUE = new Set(["common.reason", "common.withdrawalReason"])

/**
 * QA round 2: the Scope 1 and 2 engines' own holds, pinned. Where the adapter already holds a blank field, the engine
 * never sees it, so the label can't show a removed engine hold; these send the engine a complete record's call with the
 * field left blank (at the engine's input) and pin what it answers. Removing or changing any of these holds in
 * scope1_engine.py or scope2_engine.py fails here, which sends whoever changes it back to the labels.
 */
type Pin = { kind: string; field: string; base: () => A; leave: (call: any) => void; expect: string }
const input = (call: any) => call.engine === "scope1" ? call.request.input : call.input
const pins: Pin[] = [
  { kind: "natural_gas", field: "heatContent", base: volumetric, leave: call => { delete input(call).heatContent }, expect: "input_needed: heat_content_required_for_volume" },
  { kind: "distillate_no2", field: "openingGallons", base: tanks, leave: call => { input(call).consumption = { basis: "purchases_only", purchasedGallons: "100" } }, expect: "input_needed: tank_levels_required_for_purchases" },
  { kind: "vehicle", field: "miles", base: van(), leave: call => { delete input(call).miles }, expect: "partial: " },
  { kind: "fugitive", field: "insideBoundary", base: refrigerant, leave: call => { input(call).insideBoundary = null }, expect: "input_needed: boundary_membership_unknown" },
  { kind: "fugitive", field: "maintainsRefrigerantStock", base: refrigerant, leave: call => { input(call).maintainsRefrigerantStock = null }, expect: "input_needed: simplified_method_applicability_unknown" },
  { kind: "fugitive", field: "retrofitInPeriod", base: refrigerant, leave: call => { input(call).retrofitInPeriod = null }, expect: "input_needed: simplified_method_applicability_unknown" },
  { kind: "fugitive", field: "retrofitInPeriod (stock Yes)", base: stocked, leave: call => { input(call).retrofitInPeriod = null }, expect: "review_required: simplified_method_not_applicable" },
  { kind: "fugitive", field: "maintainsRefrigerantStock (retrofit Yes)", base: retrofitted, leave: call => { input(call).maintainsRefrigerantStock = null }, expect: "review_required: simplified_method_not_applicable" },
  { kind: "fugitive", field: "contractorRecords", base: refrigerant, leave: call => { input(call).contractorRecordsComplete = false }, expect: "input_needed: contractor_records_and_chronology_required" },
  { kind: "fugitive", field: "eventChronology", base: refrigerant, leave: call => { input(call).eventChronologyComplete = false }, expect: "input_needed: contractor_records_and_chronology_required" },
  { kind: "electricity", field: "mwh", base: meter([instrument()]), leave: call => { input(call).instruments[0].mwh = "" }, expect: "input_needed: instrument_mwh_required" },
  { kind: "electricity", field: "instrumentQuality", base: meter([instrument()]), leave: call => { input(call).instruments[0].qualityCriteriaMet = false }, expect: "review_required: instrument_quality_criteria_not_met" },
  { kind: "electricity", field: "instrumentEvidence", base: meter([instrument()]), leave: call => { input(call).instruments[0].evidenceReference = null }, expect: "refused: invalid_instrument" },
  { kind: "electricity", field: "technology", base: meter([instrument()]), leave: call => { input(call).instruments[0].generationTechnology = "unknown" }, expect: "input_needed: instrument_rate_required" },
  { kind: "electricity", field: "co2", base: coal, leave: call => { delete input(call).instruments[0].rateLbPerMwh }, expect: "input_needed: instrument_rate_required" },
  { kind: "electricity", field: "subregion", base: meter(), leave: call => { input(call).subregion = "" }, expect: "refused: unknown_subregion" },
  { kind: "natural_gas", field: "quantity", base: gasBill, leave: call => { input(call).quantity = null }, expect: "refused: invalid_quantity" },
  { kind: "natural_gas", field: "unit", base: gasBill, leave: call => { input(call).unit = null }, expect: "refused: unsupported_unit" },
  { kind: "distillate_no2", field: "gallons", base: generator, leave: call => { input(call).consumption.gallons = "" }, expect: "refused: invalid_quantity" },
  { kind: "distillate_no2", field: "purchasedGallons", base: tanks, leave: call => { input(call).consumption.purchasedGallons = "" }, expect: "refused: invalid_quantity" },
  { kind: "distillate_no2", field: "closingGallons", base: tanks, leave: call => { input(call).consumption.closingGallons = "" }, expect: "refused: invalid_quantity" },
  { kind: "vehicle", field: "vehicleGallons", base: van(), leave: call => { input(call).gallons = "" }, expect: "refused: invalid_quantity" },
  { kind: "vehicle", field: "milesBasis", base: van(), leave: call => { input(call).miles.basis = "" }, expect: "refused: invalid_miles_basis" },
  { kind: "vehicle", field: "mpg", base: van({ miles: null, fuelEconomy: { mpg: "22", source: "fleet_record" } }), leave: call => { delete input(call).fuelEconomy }, expect: "partial: " },
  { kind: "vehicle", field: "mpgSource", base: van({ miles: null, fuelEconomy: { mpg: "22", source: "fleet_record" } }), leave: call => { input(call).fuelEconomy.source = "" }, expect: "refused: invalid_fuel_economy_source" },
  ...["PN", "CN", "PS", "CD", "RD"].map((term): Pin => ({ kind: "fugitive", field: `term-${term}`, base: refrigerant, leave: call => { input(call).terms[term] = "" }, expect: "refused: invalid_quantity" })),
  { kind: "electricity", field: "quantity", base: meter(), leave: call => { input(call).quantity = null }, expect: "refused: invalid_quantity" },
  { kind: "electricity", field: "unit", base: meter(), leave: call => { input(call).unit = null }, expect: "refused: unsupported_unit" },
]
describe("QA round 2: the Scope 1 and 2 engines' holds behind the labels", () => {
  test("each Needed-for-results field of a Scope 1 or 2 record, left blank at the engine's input, is held or refused by the engine as pinned", () => {
    const calls = pins.map(pin => { const plan = planScope12(pin.base()); expect([pin.kind, pin.field, plan.action]).toEqual([pin.kind, pin.field, "calculate"]); const call = structuredClone(plan.call!) as any; pin.leave(call); return call })
    const answers = runScope12(calls).map((result, i) => `${pins[i]!.kind}.${pins[i]!.field}: ${outcome(result)}`)
    expect(answers).toEqual(pins.map(pin => `${pin.kind}.${pin.field}: ${pin.expect}`))
  })
  test("every Scope 1 and 2 field labelled Needed for results is pinned; the engines see the complete records as complete", () => {
    const pinned = new Set(pins.map(pin => `${pin.kind}.${pin.field}`))
    const results = ["natural_gas", "distillate_no2", "vehicle", "fugitive", "electricity"].flatMap(kind => Object.entries(ACTIVITY_FIELD_NEEDS[kind]!).filter(([, need]) => need === "results").map(([field]) => `${kind}.${field}`))
    expect(results.filter(key => !pinned.has(key))).toEqual([])
    const bases = [gasBill(), volumetric(), generator(), tanks(), van()(), refrigerant(), meter()(), meter([instrument()])(), coal()].map(base => planScope12(base).call!)
    expect(runScope12(bases).map(outcome)).toEqual(["complete: ", "complete: ", "complete: ", "complete: ", "complete: ", "complete: ", "complete: ", "complete: ", "complete: "])
  })
})

// BF-02b (b, QA follow-up 2 of PR #45): a spend line whose every replacing record the adapter holds is shown on the record
// form as Results holds it (replacing_record_not_counted, needing input), never as replaced, and gets no replacement notice.
describe("BF-02b: the record form shows a replaced line as held while its replacing record can't be counted", () => {
  const heldSupplier = () => savedRecord(SUPPLIER, (() => { const a = fixture("purchase_supplier: product factor"); a.payload.category = 1; a.payload.supersedesSpend = { supplierName: "Synthetic Software LLC", mappingKeys: [] }; return a })())
  test("an unsaved-quantity supplier record (held by the adapter) leaves the line held, not excluded; a calculable one still replaces it", () => {
    const world = { ...WORLDS.usOperational, name: "a held supplier record", records: [heldSupplier()] }
    expect(readiness(replacedLine(), world)).toEqual([`input_needed: ${reasonText("replacing_record_not_counted")}`])
    const draft = replacedLine()
    expect(recordHold(draft, factsFor(draft, world))).toBeNull()
    const counted = { ...WORLDS.usOperational, name: "a calculable supplier record", records: [MATCHES[0][1]] }
    expect(readiness(replacedLine(), counted)).toEqual([`excluded: ${reasonText("superseded_by_supplier_record")}`])
  })
})
