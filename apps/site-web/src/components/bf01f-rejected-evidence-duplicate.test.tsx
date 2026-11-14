/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real component without a DOM. */
// BF-01f (QA round 2 of PR #65, finding G1): a record whose only finding is a rejected record-level evidence file is counted by
// Results (neither the adapter nor the engines read record-level files; they are only listed), so the screens treat it as
// counted for the duplicate rule: a clean/rejected pair is listed as a counted possible duplicate on every screen, and the
// rejected-evidence record never gets the "Completing this record would repeat …, which is already counted" caution, which
// would be false for a record already in the subtotal. A rejected file next to any other hold still leaves the record not
// counted (the caution stays). The fuzz compares the screen's counted value with Results' real engines, as QA's script does.
// QA of PR #69: B1, the Overview's readiness items (and so the sidebar, the Menu sheet and Ask) list the pair as well as B's
// review item; F2, a record its readiness excludes (refrigerant outside the boundary) gets no caution in the record view,
// as in Results and the Overview.
//
// The unit run fuzzes one batch of 200 records (about 20 s). Set BF01F_FULL_FUZZ=1 for QA's full four offsets of 400
// records (about 140 s): `BF01F_FULL_FUZZ=1 bun test src/components/bf01f-rejected-evidence-duplicate.test.tsx`.
import { describe, expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionActivity, validateCollectionSaveInput, withCurrentSetupVersion, type CollectionActivity, type CollectionContext, type CollectionEvidenceMetadata } from "../../../../packages/neuvetra-database/src/collection-contract"
import { instrumentEvidenceClaims, planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { possibleDuplicateOf, possibleDuplicatePairs } from "../../../../packages/neuvetra-database/src/collection-duplicates"
import { CollectionApiError } from "@/lib/collection-api"
import { reasonText } from "@/lib/plain-language"
import { computeJourneyStatus } from "@/lib/journey-status"
import { computeReadiness, progressAnswer } from "@/lib/readiness"
import { countedDuplicatesIn } from "@/lib/results-api"
import { attentionCounts } from "@/lib/results-view"
import { recordDuplicateState } from "@/lib/record-duplicates-bf01c"
import { recordReadiness } from "./CollectionWorkspace"
import { harness, loadComponent } from "./component-harness"

const C = "b1f00000-0000-4000-8000-000000000001", SETUP = "b1f00000-0000-4000-8000-0000000000aa", HQ = "b1f00000-0000-4000-8000-0000000000b1"
const CLEAN = "b1f00000-0000-4000-8000-0000000000c1", PENDING = "b1f00000-0000-4000-8000-0000000000c2", REJECTED = "b1f00000-0000-4000-8000-0000000000c3"
const YEAR = { start: "2025-01-01", endExclusive: "2026-01-01" }
const context: any = { companyId: C, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], boundaryApproach: "operational_control", reportingPeriod: YEAR, locations: [
  { id: HQ, name: "HQ", inclusion: "included", control: "reporting_company", entityId: null, entity: null, start: null, endExclusive: null, startMode: "period_start", endMode: "period_end" }] }
const setupView: any = { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: SETUP, companyId: C, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: C, createdAt: "2025-06-01T00:00:00.000Z",
  setup: { company: { legalName: "B1f Co", tradingName: "", countryCode: "US", regionCode: "CA", industry: "", naics: "", preparerRole: "", additionalBusinessActivities: "", otherIndustry: "" }, reportingPeriod: { ...YEAR, firstInventory: "yes", priorInventoryReference: "" },
    boundary: { approach: "operational_control", notes: "", hasParent: "no", parentName: "", includedOperations: "" }, entities: [], relationships: [], locations: [{ id: HQ, name: "HQ", inclusion: "included", countryCode: "US" }],
    screening: [], changes: [], changeNotes: "", review: { acknowledged: true, notes: "" } } } }
const file = (id: string, quarantineStatus: CollectionEvidenceMetadata["quarantineStatus"], companyId = C): CollectionEvidenceMetadata => ({ id, companyId, bucket: "neuvetra-private-company-evidence",
  objectKey: `${companyId}/original/${id}`, originalName: "bill.pdf", mediaType: "application/pdf", byteLength: 100, sha256: "a".repeat(64), quarantineStatus, uploadedBy: companyId, createdAt: "2025-06-01T00:00:00.000Z" })
const evidence = [file(CLEAN, "clean"), file(PENDING, "pending"), file(REJECTED, "rejected")]

let n = 0
function saved(activity: any) {
  const recordId = `b1f00000-0000-4000-8000-${String(++n).padStart(12, "0")}`, parsed = validateCollectionActivity(activity)
  const version = { id: recordId.replace("b1f0", "b1f1"), recordId, companyId: C, revision: 1, previousVersionId: null, correctionReason: null, activity: parsed, payloadSha256: "b".repeat(64), createdBy: C, createdAt: `2025-06-01T00:00:${String(n).padStart(2, "0")}.000Z` }
  return { id: recordId, companyId: C, kind: parsed.kind, currentVersion: version, history: [{ ...version, activity: undefined }] } as any
}
const base = { setupVersionId: SETUP, locationId: HQ, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: YEAR, reference: "B1f", notes: "", evidenceIds: [] as string[] }
const meter = (sourceId: string, evidenceIds: string[], kwh = "10000") => ({ ...base, kind: "electricity", sourceId, evidenceIds, quantity: { originalValue: kwh, originalUnit: "kWh", normalizedValue: kwh || null, normalizedUnit: kwh ? "kWh" : null }, ...(kwh ? {} : { quality: "unknown" }),
  payload: { meterOrAccountNumber: sourceId, utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } })

// G1: A clean, B rejected (QA's pair). Guard: A clean, B rejected AND missing its quantity (a real hold): not counted.
const g1 = [saved(meter("M-REJ", [CLEAN])), saved(meter("M-REJ", [REJECTED]))]
const guard = [saved(meter("M-HELD", [CLEAN])), saved(meter("M-HELD", [REJECTED], ""))]
// F2 (QA of PR #69): a counted refrigerant record and a matching one outside the declared boundary (the engine excludes it).
const refrigerant = (sourceId: string, insideBoundary: boolean) => ({ ...base, kind: "fugitive", sourceId, quantity: { originalValue: "12.5", originalUnit: "kg", normalizedValue: "12.5", normalizedUnit: "kg" },
  payload: { gas: "HFC-134a", unit: "kg", terms: { PN: "12.5", CN: "0", PS: "0", CD: "0", RD: "0" }, insideBoundary, maintainsRefrigerantStock: false, retrofitInPeriod: false, contractorRecordsComplete: true, eventChronologyComplete: true } })
const refOut = [saved(refrigerant("REF-OUT", true)), saved(refrigerant("REF-OUT", false))]
const records: any[] = [...g1, ...guard, ...refOut]
const CAUTION = (sourceId: string, recordId: string) => `Completing this record would repeat ${sourceId} at HQ, Jan 1 – Dec 31, 2025 (record ${recordId}), which is already counted; withdraw it if it is the same activity.`

const api = new URL("../../../site-api/src/", import.meta.url).pathname
async function engines() {
  const s12 = await import(`${api}workspace/collection-results-routes.ts`)
  const e1 = await import(`${api}calculation/scope1-authority.ts`), e2 = await import(`${api}calculation/scope2-authority.ts`)
  const python = process.env.NEUVETRA_PYTHON ?? "python3"
  return { s12, engines: { scope1: e1.createScope1Engine({ python, expectedEngineSha256: s12.REVIEWED_SCOPE1_ENGINE_SHA256 }), scope2: e2.createScope2Engine({ python, expectedEngineSha256: s12.REVIEWED_SCOPE2_ENGINE_SHA256 }) } }
}
const built = (async () => { const { s12, engines: e } = await engines(); return JSON.parse(JSON.stringify(await s12.buildCollectionResults({ companyId: C, context, records, evidence, setup: setupView, engines: e }))) })()

const screenCounted = (record: any, ctx: CollectionContext = context, files = evidence, all: any[] = records) => {
  const out: { counted?: boolean } = {}
  const findings = recordReadiness(record.currentVersion.activity, ctx, files, instrumentEvidenceClaims(all.map(item => item.currentVersion.activity), ctx, files), undefined, out)
  return { counted: out.counted === true, findings }
}

async function workspace(openRecordId: string) {
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion, validateCollectionSaveInput,
    listCollectionActivities: async () => records, listCollectionEvidence: async () => evidence, listGridLossLineages: async () => [], loadCollectionContext: async () => context,
    loadCollectionOverview: async () => ({ context, scope3: false, scope3Kinds: [], scope3Completion: false }),
    loadCompanySetup: async () => setupView,
    saveCollectionActivity: async () => { throw new CollectionApiError("stop", 500) }, uploadCollectionEvidence: async () => { throw new CollectionApiError("stop", 500) },
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0,
  })
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: C, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId, intro: null }))
  await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
  return app
}

describe("BF-01f: a record whose only finding is rejected evidence is counted for the duplicate rule, as Results counts it", () => {
  test("Results counts both records of the clean/rejected pair and warns of one counted possible duplicate; the guard's held record carries the caution", async () => {
    const r12 = await built
    const row = (id: string) => r12.records.find((item: any) => item.recordId === id)
    expect([row(g1[0].id).inSubtotal.scope2LocationBased, row(g1[1].id).inSubtotal.scope2LocationBased]).toEqual([true, true])
    expect(possibleDuplicateOf(row(g1[1].id).plan.notes)).toBe(g1[0].id)
    expect(row(guard[1].id).inSubtotal.scope2LocationBased).toBe(false)
    expect(row(guard[1].id).plan.notes).toContain(`would_repeat_counted:${guard[0].id}`)
    expect(r12.warnings.filter((text: string) => text.startsWith("These totals include 1 possible duplicate:")).length).toBe(1)
  }, 120_000)

  test("the screens count the rejected-evidence record (still shown for review) and list the pair, with no caution; a second hold keeps it out", () => {
    const b = screenCounted(g1[1])
    expect(b.counted).toBe(true)
    expect(b.findings.map(finding => finding.status)).toEqual(["review_required"])
    expect(b.findings[0]!.reason).toStartWith("Linked evidence “bill.pdf” was rejected")
    expect(screenCounted(guard[1]).counted).toBe(false)
    const counted = (id: string) => screenCounted(records.find(item => item.id === id)).counted
    const pairs = possibleDuplicatePairs([...g1, ...guard], counted)
    expect([...pairs.counted]).toEqual([[g1[1].id, g1[0].id]])
    expect([...pairs.cautions]).toEqual([[guard[1].id, guard[0].id]])
    // The record view's state: B is a counted possible duplicate of A, never the caution.
    const state = recordDuplicateState(records, g1[1].id, context, counted)
    expect([state?.of?.id, state?.caution]).toEqual([g1[0].id, null])
  })

  test("the Overview (journey status) lists the pair and gives the caution only to the guard's held record", () => {
    const status = computeJourneyStatus({ setup: setupView, context, records, evidence, canManage: true, scope3: false }) as any
    const row = (id: string) => status.collection.records.find((item: any) => item.id === id)
    expect([row(g1[1].id).possibleDuplicateOther?.id, row(g1[1].id).wouldRepeatCounted]).toEqual([g1[0].id, undefined])
    expect(row(g1[0].id).wouldRepeatCounted).toBeUndefined()
    expect(row(guard[1].id).wouldRepeatCounted).toBe(CAUTION("M-HELD", guard[0].id))
  })

  test("B1 (QA of PR #69): the Overview's items, the sidebar and Menu sheet line and Ask list the pair, as Results counts it", async () => {
    const r12 = await built
    const status = computeJourneyStatus({ setup: setupView, context, records, evidence, canManage: true, scope3: false })
    const readiness = computeReadiness({ status, statusFailed: false, scope3: { state: "off" } }) as any
    // To confirm: exactly the G1 pair (named on its later record, B); B's rejected-file review item stays open too.
    expect(readiness.duplicates.map((item: any) => item.target.recordId)).toEqual([g1[1].id])
    expect(readiness.duplicates[0].detail).toContain("Both records are counted.")
    const input = (id: string) => readiness.items.find((item: any) => item.key === `record:${id}`)
    expect(input(g1[1].id)?.detail).toStartWith("Linked evidence “bill.pdf” was rejected")
    expect(input(g1[1].id)?.detail).not.toContain("Completing this record would repeat")
    // The guard stays an open item with its caution and is never "to confirm".
    expect(input(guard[1].id)?.detail).toContain(CAUTION("M-HELD", guard[0].id))
    expect(readiness.duplicates.some((item: any) => item.target.recordId === guard[1].id || item.target.recordId === guard[0].id)).toBe(false)
    // The counts agree with Results: one counted possible duplicate (not counted as open).
    expect([readiness.open.duplicates, attentionCounts(r12.records).duplicates, countedDuplicatesIn(r12, "scope2LocationBased")]).toEqual([1, 1, 1])
    // Sidebar and Menu sheet (the Activity step's line) and Ask read the same readiness.
    expect(readiness.steps?.[1]?.text ?? JSON.stringify(readiness)).toContain("1 possible duplicate to confirm")
    const ask = progressAnswer(readiness)
    expect(ask.find(line => line.startsWith("To confirm: possible duplicates (both are counted) — "))).toContain("1 possible duplicate to confirm")
    expect(ask.filter(line => line.startsWith("• ")).some(line => line.includes("M-REJ"))).toBe(true)
  }, 120_000)

  test("F2 (QA of PR #69): a record outside the declared boundary gets no caution in the record view, as in Results and the Overview", async () => {
    const r12 = await built
    const row = r12.records.find((item: any) => item.recordId === refOut[1].id)
    expect([row.inSubtotal.scope1, row.plan.notes.some((note: string) => note.startsWith("would_repeat_counted:"))]).toEqual([false, false])
    const status = computeJourneyStatus({ setup: setupView, context, records, evidence, canManage: true, scope3: false }) as any
    expect(status.collection.records.find((item: any) => item.id === refOut[1].id).wouldRepeatCounted).toBeUndefined()
    for (const record of refOut) expect([record.id, (await workspace(record.id)).text().includes("Completing this record would repeat")]).toEqual([record.id, false])
  }, 120_000)

  test("the record view: both G1 records show the both-counted notice and B never shows the caution; the guard keeps it", async () => {
    for (const record of g1) {
      const text = (await workspace(record.id)).text()
      expect([record.id, text.includes("To confirm: possible duplicate (both are counted)"), text.includes("Completing this record would repeat")]).toEqual([record.id, true, false])
    }
    expect((await workspace(guard[1].id)).text()).toContain(CAUTION("M-HELD", guard[0].id))
  }, 120_000)
})

// QA's fuzz (scratch/qa65b/fuzz.ts): the contract-valid generator, four offsets of 400 records, screen counted vs Results'
// engines. Here Scope 1 records may also carry a rejected file. Electricity grid facts the save route refuses (422:
// `validateElectricityLookup`) are a separate, engine-only gap the screens cannot see without the eGRID ZIP table, so the
// equality is asserted over records the save route accepts, and every disagreement outside them is pinned to that gap.
const FULL_FUZZ = process.env.BF01F_FULL_FUZZ === "1"
describe("BF-01f fuzz: the screen's counted value equals Results' on every record the save route accepts", () => {
  const company = "71000000-0000-4000-8000-000000000001", setup = "71000000-0000-4000-8000-000000000002", office = "71000000-0000-4000-8000-000000000003"
  const clean = "71000000-0000-4000-8000-0000000000c1", pending = "71000000-0000-4000-8000-0000000000c2", rejected = "71000000-0000-4000-8000-0000000000c3", E = "71000000-0000-4000-8000-0000000000e1"
  const fctx: CollectionContext = { boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, companyId: company, setupVersionId: setup, setupRevision: 1, locations: [
    { id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: E, entity: { id: E, inclusion: "included", control: "operational_control" } as any, start: null, endExclusive: null, startMode: "period_start", endMode: "period_end" },
    { id: "71000000-0000-4000-8000-000000000004", name: "Warehouse", inclusion: "excluded", control: "landlord" },
    { id: "71000000-0000-4000-8000-000000000005", name: "Depot", inclusion: "unknown", control: "unknown" }] }
  const fevidence = [file(clean, "clean", company), file(pending, "pending", company), file(rejected, "rejected", company)]
  const fsetup: any = { currentVersion: { id: setup, companyId: company, revision: 1, setup: { reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [], screening: [], boundary: { approach: "operational_control" }, company: { legalName: "Fuzz" } } } }
  const common = { locationId: office, setupVersionId: setup, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic source", notes: "" }
  const normalizes = (value: string, unit: string) => /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value) && ["therm", "MMBtu", "scf", "ccf", "mcf", "US_gallon", "kg", "lb", "kWh", "MWh"].includes(unit)
  const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: normalizes(value, unit) ? value : null, normalizedUnit: normalizes(value, unit) ? unit : null })
  const year = { start: "2025-01-01", endExclusive: "2026-01-01" }
  const version = (activity: Record<string, unknown>) => validateCollectionActivity({ ...common, evidenceIds: [], period: year, ...activity })
  const texts = ["", "unknown", "1,234.5", "12.3456", "-1", "0", "7", "100.125", " 5", "n/a"]
  const mix = (i: number, k: number) => { let x = (Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0; return (x ^ (x >>> 16)) >>> 0 }
  const pick = <T,>(xs: readonly T[], i: number, k: number) => xs[mix(i, k) % xs.length]!
  function activityAt(i: number): CollectionActivity {
    const t = (k: number) => pick(texts, i, k), kind = i % 5
    // Scope 1 records: a rejected record-level file on about a third of them (QA's generator links none).
    const files = pick([[], [clean], [rejected], [clean, rejected]], i, 12)
    if (kind === 0) return version({ kind: "natural_gas", sourceId: "GAS-1", evidenceIds: files, quantity: q(t(1), pick(["therm", "MMBtu", "scf", "ccf", "mcf", "m3"], i, 2)), payload: { heatContent: i % 3 ? null : { value: t(3), unit: pick(["MMBtu per scf", "MMBtu per ccf", "MMBtu per mcf", "therm per ccf"], i, 4) } } })
    if (kind === 1) return version({ kind: "distillate_no2", sourceId: "GEN-1", evidenceIds: files, quantity: q("", "US_gallon"), payload: { consumption: pick<Record<string, string>>([{ basis: "measured", gallons: t(1) }, { basis: "purchases_only", purchasedGallons: t(2) }, { basis: "purchases_with_tank_levels", purchasedGallons: t(3), openingGallons: t(4), closingGallons: t(5) }], i, 1), statedHhvMmbtuPerGallon: i % 4 ? null : pick(["0.138", "0", "0.137", "1"], i, 6) } })
    if (kind === 2) return version({ kind: "vehicle", sourceId: "VANS", evidenceIds: files, quantity: q("", "US_gallon"), payload: { vehicleGroupId: "VANS", fuel: pick(["diesel", "gasoline", "Diesel", "propane"], i, 1), vehicleType: pick(["diesel_light_duty_truck", "gasoline_passenger_car", "gasoline_light_duty_truck", "gasoline_heavy_duty", "Van"], i, 2), modelYear: pick([1950, 1960, 1965, 1972, 1973, 1999, 2020, 2026], i, 3), gallons: t(4),
      vehicleCount: pick([null, 1, 20000], i, 5), miles: i % 3 === 0 ? { value: t(6), basis: pick(["odometer", "trip_log", "guess"], i, 7) } : null, fuelEconomy: i % 3 === 1 ? { mpg: t(8), source: pick(["vehicle_record", "fleet_record", "fueleconomy_gov", "memory"], i, 9) } : null } })
    if (kind === 3) { const unit = pick(["kg", "lb"] as const, i, 2); return version({ kind: "fugitive", sourceId: "RTU-1", evidenceIds: files, quantity: q("", unit), payload: { gas: pick(["R-410A", "R-22", "HFC-134a"], i, 1), unit, terms: { PN: t(3), CN: t(4), PS: t(5), CD: t(6), RD: t(7) },
      insideBoundary: pick([true, false, null], i, 8), maintainsRefrigerantStock: pick([false, true, null], i, 9), retrofitInPeriod: pick([false, null, true], i, 10), contractorRecordsComplete: i % 2 === 0, eventChronologyComplete: i % 3 !== 0 } }) }
    const instrument = { type: "energy_attribute_certificate", mwh: t(1), qualityCriteriaMet: i % 2 === 0, vintageYear: pick([2023, 2025, 2027], i, 4), evidenceReference: pick([clean, pending, rejected, null], i, 2), generationTechnology: pick(["wind", "natural_gas", "biogas", "unknown"], i, 3), rateLbPerMwh: i % 3 === 0 ? null : { co2: t(5), ch4: i % 2 ? null : t(6), n2o: null } }
    return version({ kind: "electricity", sourceId: "M-1", quantity: q("10000", "kWh"), evidenceIds: [clean, pending, rejected], period: { start: "2025-01-01", endExclusive: "2025-02-01" },
      payload: { meterOrAccountNumber: "M-1", utilityName: "Synthetic", site: "Office", zip: pick(["94105", "07401", "00000"], i, 8), subregion: pick(["CAMX", "NYUP", "RFCE"], i, 7), utilityEiaId: pick([null, "15477", "1"], i, 9), instruments: [instrument] } })
  }

  test(`0 claims more and 0 counts fewer (${FULL_FUZZ ? "four offsets of 400 records" : "one batch of 200 records"}); the rest is only the refused grid-facts gap`, async () => {
    const { s12, engines: e } = await engines()
    const { validateElectricityLookup } = await import(`${api}workspace/collection-routes.ts`)
    const lookups = new Map<string, unknown>()
    for (const zip of ["94105", "07401", "00000"]) lookups.set(zip, await e.scope2.lookupZip(zip))
    const accepted = (activity: CollectionActivity) => { try { validateElectricityLookup(activity, lookups.get((activity.payload as { zip: string }).zip)); return true } catch { return false } }
    const tally = { more: 0, fewer: 0, agree: 0, rejectedCountedBoth: 0, refusedDisagree: 0, refusedOtherReason: 0 }
    for (const offset of FULL_FUZZ ? [0, 400, 800, 1200] : [0]) {
      const activities = Array.from({ length: FULL_FUZZ ? 400 : 200 }, (_, j) => activityAt(j + offset))
      const recs = activities.map((activity, j) => { const id = crypto.randomUUID(); return { id, companyId: company, kind: activity.kind, currentVersion: { id: crypto.randomUUID(), recordId: id, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, activity: { ...activity, sourceId: `FZ-${j}` }, payloadSha256: "b".repeat(64), createdBy: company, createdAt: `2025-06-01T00:${String(Math.floor(j / 60) % 60).padStart(2, "0")}:${String(j % 60).padStart(2, "0")}.000Z` }, history: [] } })
      const res = await s12.buildCollectionResults({ companyId: company, context: fctx, records: recs, evidence: fevidence, setup: fsetup, engines: e })
      for (const r of recs) {
        const screen = screenCounted(r, fctx, fevidence, recs).counted
        const row = res.records.find((x: any) => x.recordId === r.id)
        const engine = !!row && (row.inSubtotal.scope1 || row.inSubtotal.scope2LocationBased || row.inSubtotal.scope2MarketBased)
        if (r.kind === "electricity" && !accepted(r.currentVersion.activity)) {
          if (screen !== engine) { tally.refusedDisagree++; if (!["zip_not_in_lookup", "subregion_not_listed_for_zip", "utility_not_listed_for_zip_and_subregion", "utility_required_for_multi_subregion_zip"].some(code => row?.scope2?.locationBased?.findings?.includes(code))) tally.refusedOtherReason++ }
          continue
        }
        if (screen && !engine) tally.more++; else if (!screen && engine) tally.fewer++; else tally.agree++
        if (screen && engine && r.currentVersion.activity.evidenceIds.includes(rejected)) tally.rejectedCountedBoth++
      }
    }
    expect({ more: tally.more, fewer: tally.fewer }).toEqual({ more: 0, fewer: 0 })
    // The fix is exercised: records with a rejected file are counted by both sides.
    expect(tally.rejectedCountedBoth).toBeGreaterThan(0)
    // Records the save route refuses disagree only through the engine's grid checks the screen cannot see.
    expect(tally.refusedOtherReason).toBe(0)
  }, 600_000)
})
