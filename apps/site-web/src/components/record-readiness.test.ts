// N8/N7: the readiness the Activity screen, Overview and Ask show agrees with the calculation adapter that decides what
// the engines receive. Claude, 2026-09-30.
import { describe, expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { validateCollectionActivity, type CollectionActivity, type CollectionContext, type CollectionEvidenceMetadata } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { reasonText } from "../lib/plain-language"
import { collectionReadinessFindings, legacyVehicleValues, locationReadinessFindings, recordReadiness, type CollectionReadinessFinding } from "./CollectionWorkspace"

const company = "73000000-0000-4000-8000-000000000001", setup = "73000000-0000-4000-8000-000000000002"
const office = "73000000-0000-4000-8000-000000000003", warehouse = "73000000-0000-4000-8000-000000000004", undecided = "73000000-0000-4000-8000-000000000005", removed = "73000000-0000-4000-8000-000000000006"
const clean = "73000000-0000-4000-8000-0000000000c1", pending = "73000000-0000-4000-8000-0000000000c2", rejected = "73000000-0000-4000-8000-0000000000c3"
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, locations: [
  { id: office, name: "Office", inclusion: "included", control: "reporting_company" },
  { id: warehouse, name: "Warehouse", inclusion: "excluded", control: "landlord" },
  { id: undecided, name: "Depot", inclusion: "unknown", control: "unknown" }] }
const file = (id: string, quarantineStatus: CollectionEvidenceMetadata["quarantineStatus"]): CollectionEvidenceMetadata => ({ id, companyId: company, bucket: "neuvetra-private-company-evidence",
  objectKey: `${company}/original/${id}`, originalName: "bill.pdf", mediaType: "application/pdf", byteLength: 100, sha256: "a".repeat(64), quarantineStatus, uploadedBy: company, createdAt: "2025-06-01T00:00:00.000Z" })
const evidence = [file(clean, "clean"), file(pending, "pending"), file(rejected, "rejected")]
const year = { start: "2025-01-01", endExclusive: "2026-01-01" }
const common = { locationId: office, setupVersionId: setup, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic source", notes: "", evidenceIds: [] as string[], period: year }
const normalizes = (value: string, unit: string) => /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value) && ["therm", "MMBtu", "scf", "ccf", "mcf", "US_gallon", "kg", "lb", "kWh", "MWh"].includes(unit)
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: normalizes(value, unit) ? value : null, normalizedUnit: normalizes(value, unit) ? unit : null })
// Records are validated as saved; a record the contract refuses is still a draft the screen shows while it is edited.
let drafts = false
const saved = (activity: Record<string, unknown>): CollectionActivity => drafts ? ({ ...common, ...activity }) as CollectionActivity : validateCollectionActivity({ ...common, ...activity })
const asDraft = <T>(build: () => T): T => { drafts = true; try { return build() } finally { drafts = false } }
const gas = (value: string, unit: string, heatContent: unknown = null, extra = {}) => saved({ kind: "natural_gas", sourceId: "GAS-1", quantity: q(value, unit), payload: { heatContent }, ...extra })
const generator = (consumption: Record<string, string>, hhv: string | null = null, extra = {}) => saved({ kind: "distillate_no2", sourceId: "GEN-1", quantity: q((consumption.gallons ?? consumption.purchasedGallons)!, "US_gallon"), payload: { consumption, statedHhvMmbtuPerGallon: hhv }, ...extra })
const vehicle = (p: Record<string, unknown>, extra = {}) => { const payload = { vehicleGroupId: "VANS", fuel: "diesel", vehicleType: "diesel_light_duty_truck", modelYear: 2020, gallons: "100", vehicleCount: null, miles: null, fuelEconomy: null, ...p }
  return saved({ kind: "vehicle", sourceId: "VANS", quantity: q(payload.gallons as string, "US_gallon"), payload, ...extra }) }
const refrigerant = (p: Record<string, unknown>, extra = {}) => saved({ kind: "fugitive", sourceId: "RTU-1", quantity: q("", "kg"), payload: { gas: "R-410A", unit: "kg", terms: { PN: "0", CN: "0", PS: "2.5", CD: "0", RD: "0" },
  insideBoundary: true, maintainsRefrigerantStock: false, retrofitInPeriod: false, contractorRecordsComplete: true, eventChronologyComplete: true, ...p }, ...extra })
const instrument = (extra: Record<string, unknown> = {}) => ({ type: "energy_attribute_certificate", mwh: "1", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: clean, generationTechnology: "wind", rateLbPerMwh: null, ...extra })
const electricity = (instruments: Record<string, unknown>[] = [], p: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => saved({ kind: "electricity", sourceId: "M-1", quantity: q("10000", "kWh"), evidenceIds: [clean],
  period: { start: "2025-01-01", endExclusive: "2025-02-01" }, payload: { meterOrAccountNumber: "M-1", utilityName: "Synthetic", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: null, instruments, ...p }, ...extra })

const BLOCKING = new Set<CollectionReadinessFinding["status"]>(["input_needed", "excluded", "withdrawn"])
const plan = (activity: CollectionActivity) => planCollectionCalculation({ id: company, recordId: company, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, activity, payloadSha256: "b".repeat(64), createdBy: company, createdAt: "2025-06-01T00:00:00.000Z" }, context, evidence)
const reasons = (activity: CollectionActivity) => recordReadiness(activity, context, evidence).map(finding => finding.reason)

describe("N8: the screen's readiness agrees with the calculation adapter", () => {
  test("adapter holds the screen didn't catch are shown in plain language", () => {
    expect(reasons(generator({ basis: "measured", gallons: "100" }, "0"))).toContain(reasonText("stated_hhv_not_numeric"))
    expect(reasons(vehicle({ vehicleCount: 20000 }))).toContain(reasonText("vehicle_count_out_of_range"))
    expect(reasons(vehicle({ fuel: "gasoline", vehicleType: "gasoline_passenger_car", modelYear: 1965, miles: { value: "1000", basis: "odometer" } }))).toContain(reasonText("model_year_before_first_factor_band"))
    expect(reasons(electricity([], { subregion: "XXXX" }))).toContain(reasonText("subregion_not_an_egrid_subregion"))
    expect(reasons(electricity([], { utilityEiaId: "12345678" }))).toContain(reasonText("utility_eia_id_not_numeric"))
    expect(reasons(gas("100", "ccf", { value: "0", unit: "MMBtu per ccf" }))).toEqual(["Bill heat content must be greater than zero."])
    expect(reasons(gas("100", "ccf", { value: "0.1037", unit: "MMBtu per ccf" }))).toEqual([]) // a bill's four-decimal heat content isn't refused
    for (const activity of [generator({ basis: "measured", gallons: "100" }, "0"), vehicle({ vehicleCount: 20000 }), electricity([], { subregion: "XXXX" })]) {
      expect(plan(activity).action).toBe("hold")
      expect(collectionReadinessFindings(activity, evidence).some(finding => BLOCKING.has(finding.status))).toBe(false) // the screen alone said ready
      expect(recordReadiness(activity, context, evidence).some(finding => BLOCKING.has(finding.status))).toBe(true)
    }
  })
  test("an adapter reason the screen already explains isn't repeated", () => {
    const findings = recordReadiness(asDraft(() => electricity([], { zip: "", subregion: "" })), context, evidence).map(finding => finding.reason)
    expect(findings).toContain("A five-digit ZIP is required."); expect(findings).toContain("A verified eGRID subregion is required.")
    expect(findings).not.toContain(reasonText("zip_not_valid")); expect(findings).not.toContain(reasonText("subregion_not_an_egrid_subregion"))
  })
  test("a held record is never called partly calculated (N7)", () => {
    const legacy = vehicle({ fuel: "propane" })
    expect(collectionReadinessFindings(legacy, evidence).map(finding => finding.status)).toContain("partial")
    expect(recordReadiness(legacy, context, evidence).map(finding => finding.status)).not.toContain("partial")
    expect(recordReadiness(vehicle({}), context, evidence)).toEqual([{ status: "partial", reason: "CO2 can calculate from gallons, but miles or fuel economy is needed to calculate CH4 and N2O." }])
  })
  test("an instrument problem holds only the market-based result when the meter calculates", () => {
    const meter = electricity([instrument({ mwh: "", qualityCriteriaMet: false })])
    expect(plan(meter).action).toBe("calculate")
    const findings = recordReadiness(meter, context, evidence)
    expect(findings.map(finding => finding.status)).toEqual(["partial", "partial"])
    expect(findings[0]!.reason).toBe("Market-based result held — Market-based instrument 1 covered MWh is missing.")
    // …but on a meter the adapter holds, the instrument findings stay as they were next to the hold.
    const held = recordReadiness(electricity([instrument({ mwh: "" })], { subregion: "XXXX" }), context, evidence)
    expect(held).toContainEqual({ status: "input_needed", reason: "Market-based instrument 1 covered MWh is missing." })
  })
  test("location and withdrawal holds keep the adapter's status", () => {
    expect(recordReadiness(gas("100", "therm", null, { locationId: warehouse }), context, evidence).map(finding => finding.status)).toEqual(["excluded"])
    expect(recordReadiness(gas("100", "therm", null, { locationId: undecided }), context, evidence).map(finding => finding.status)).toEqual(["input_needed"])
    expect(recordReadiness(gas("100", "therm", null, { locationId: removed }), context, evidence).map(finding => finding.status)).toEqual(["input_needed"])
    expect(recordReadiness(gas("100", "therm", null, { state: "withdrawn", withdrawalReason: "Duplicate bill" }), context, evidence)).toEqual([{ status: "withdrawn", reason: "Withdrawn: Duplicate bill" }])
  })
  test("without a company context the screen's own rules are used unchanged", () => {
    const activity = vehicle({ vehicleCount: 20000 })
    expect(recordReadiness(activity, null, evidence)).toEqual([...collectionReadinessFindings(activity, evidence), ...locationReadinessFindings(activity, null)])
  })
})

describe("N7: blank choices on a new record aren't called legacy values", () => {
  test("a new record without a site asks for one; it isn't told its site was removed", () => {
    const draft = asDraft(() => gas("", "therm", null, { locationId: "" }))
    const findings = recordReadiness(draft, context, evidence).map(finding => finding.reason)
    expect(findings).toContain("A company-setup location is required.")
    expect(findings).not.toContain(reasonText("location_not_in_current_setup"))
  })
  test("a blank fuel and vehicle type ask for a choice", () => {
    const draft = { ...vehicle({}), payload: { vehicleGroupId: "", fuel: "", vehicleType: "", modelYear: 2025, gallons: "", vehicleCount: null, miles: null, fuelEconomy: null } } as CollectionActivity
    const findings = recordReadiness(draft, context, evidence).map(finding => finding.reason)
    expect(findings).toContain("Choose the vehicle fuel (gasoline or diesel)."); expect(findings).toContain("Choose a vehicle type for the selected fuel.")
    expect(findings.some(reason => /legacy/.test(reason))).toBe(false)
    expect(reasons(vehicle({ fuel: "propane" }))).toContain("Vehicle fuel “propane” is a legacy or unsupported value. Choose gasoline or diesel before calculation.")
  })
  test("the 'held pending correction' note is only for saved legacy values", () => {
    expect(legacyVehicleValues(null)).toBeNull() // a new record
    expect(legacyVehicleValues(vehicle({}))).toBeNull()
    expect(legacyVehicleValues(asDraft(() => vehicle({ fuel: "", vehicleType: "" })))).toBeNull()
    expect(legacyVehicleValues(vehicle({ fuel: "Diesel" }))).toEqual({ fuel: "Diesel", vehicleType: "diesel_light_duty_truck" })
    expect(legacyVehicleValues(vehicle({ vehicleType: "Van" }))).toEqual({ fuel: "diesel", vehicleType: "Van" })
    expect(legacyVehicleValues(vehicle({ vehicleType: "gasoline_passenger_car" }))).toEqual({ fuel: "diesel", vehicleType: "gasoline_passenger_car" }) // not a pair
    expect(legacyVehicleValues(gas("100", "therm"))).toBeNull()
  })
})

describe("fuzz: 1,000 saved records and drafts", () => {
  test("every adapter hold is blocking and explained; a calculated record's instrument problems are market-based only", () => {
    const texts = ["", "unknown", "1,234.5", "12.3456", "-1", "0", "7", "100.125", " 5", "n/a"]
    const mix = (i: number, k: number) => { let x = (Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0; return (x ^ (x >>> 16)) >>> 0 }
    const pick = <T>(xs: readonly T[], i: number, k: number) => xs[mix(i, k) % xs.length]!
    let held = 0, calculated = 0, addedByAdapter = 0, downgraded = 0, draftCount = 0, adapterThrew = 0
    for (let i = 0; i < 1000; i++) {
      const t = (k: number) => pick(texts, i, k)
      const extra = { locationId: pick([office, office, office, warehouse, undecided, removed], i, 20), ...(i % 23 === 0 ? { state: "withdrawn", withdrawalReason: "Synthetic" } : {}) }
      const kind = i % 5
      const build = (): CollectionActivity => kind === 0 ? gas(t(1), pick(["therm", "MMBtu", "scf", "ccf", "mcf", "m3"], i, 2), i % 3 ? null : { value: t(3), unit: pick(["MMBtu per scf", "MMBtu per ccf", "MMBtu per mcf", "therm per ccf"] as const, i, 4) }, extra)
          : kind === 1 ? generator(pick<Record<string, string>>([{ basis: "measured", gallons: t(1) }, { basis: "purchases_only", purchasedGallons: t(2) }, { basis: "purchases_with_tank_levels", purchasedGallons: t(3), openingGallons: t(4), closingGallons: t(5) }], i, 1), i % 4 ? null : pick(["0.138", "0", "0.137", "1"], i, 6), extra)
          : kind === 2 ? vehicle({ fuel: pick(["diesel", "gasoline", "Diesel", "propane", ""], i, 1), vehicleType: pick(["diesel_light_duty_truck", "gasoline_passenger_car", "gasoline_light_duty_truck", "gasoline_heavy_duty", "Van", ""], i, 2), modelYear: pick([1950, 1960, 1965, 1972, 1973, 1999, 2020, 2026], i, 3), gallons: t(4),
              vehicleCount: pick([null, 1, 20000], i, 5), miles: i % 3 === 0 ? { value: t(6), basis: pick(["odometer", "trip_log", "guess"], i, 7) } : null, fuelEconomy: i % 3 === 1 ? { mpg: t(8), source: pick(["vehicle_record", "fleet_record", "fueleconomy_gov", "memory"], i, 9) } : null }, extra)
          : kind === 3 ? refrigerant({ gas: pick(["R-410A", "R-22", "HFC-134a"] as const, i, 1), unit: pick(["kg", "lb"] as const, i, 2), terms: { PN: t(3), CN: t(4), PS: t(5), CD: t(6), RD: t(7) },
              insideBoundary: pick([true, false, null], i, 8), maintainsRefrigerantStock: pick([false, true, null], i, 9), retrofitInPeriod: pick([false, null, true], i, 10), contractorRecordsComplete: i % 2 === 0, eventChronologyComplete: i % 3 !== 0 }, extra)
          : electricity([instrument({ mwh: t(1), evidenceReference: pick([clean, pending, rejected, null], i, 2), generationTechnology: pick(["wind", "natural_gas", "biogas", "unknown"], i, 3), vintageYear: pick([2023, 2025, 2027], i, 4),
              qualityCriteriaMet: i % 2 === 0, rateLbPerMwh: i % 3 === 0 ? null : { co2: t(5), ch4: i % 2 ? null : t(6), n2o: null } })], { subregion: pick(["CAMX", "NYUP", "RFCE", "", "XXXX"], i, 7), zip: pick(["94105", "07401", "00000", "", "9410"], i, 8), utilityEiaId: pick([null, "15477", "1", "12345678"], i, 9), utilityName: pick(["Synthetic", ""], i, 10) }, extra)
      let activity: CollectionActivity
      try { activity = build() } catch { activity = asDraft(build); draftCount++ }
      let adapter: ReturnType<typeof plan>
      try { adapter = plan(activity) } catch { adapterThrew++; expect(recordReadiness(activity, context, evidence)).toEqual([...collectionReadinessFindings(activity, evidence), ...locationReadinessFindings(activity, context)]); continue }
      const screen = [...collectionReadinessFindings(activity, evidence), ...locationReadinessFindings(activity, context)]
      const shown = recordReadiness(activity, context, evidence)
      if (adapter.action === "hold") {
        held++
        expect(shown.some(finding => BLOCKING.has(finding.status))).toBe(true)
        expect(shown.map(finding => finding.status)).not.toContain("partial")
        if (adapter.status !== "input_needed") expect(shown.map(finding => finding.status)).toContain(adapter.status!)
        // Each adapter reason is shown in plain language, or a blocking screen finding already says it.
        const plain = new Set(shown.map(finding => finding.reason))
        for (const code of adapter.reasons) if (plain.has(reasonText(code))) addedByAdapter++
        const unexplained = adapter.reasons.filter(code => !plain.has(reasonText(code)))
        if (unexplained.length) expect(shown.some(finding => BLOCKING.has(finding.status) && screen.some(own => own.status === finding.status && own.reason === finding.reason))).toBe(true)
      } else {
        calculated++
        expect(shown.filter(finding => finding.reason.startsWith("Market-based instrument") && finding.status !== "review_required")).toEqual([])
        expect(shown.filter(finding => finding.reason.startsWith("Market-based instrument")).every(finding => finding.reason.includes("evidence scan is pending; the market-based figure uses this file"))).toBe(true)
        downgraded += shown.filter(finding => finding.reason.startsWith("Market-based result held — ")).length
      }
    }
    expect(held).toBeGreaterThan(200); expect(calculated).toBeGreaterThan(150); expect(addedByAdapter).toBeGreaterThan(0); expect(downgraded).toBeGreaterThan(0)
    expect(draftCount).toBeGreaterThan(0)
    console.log(`readiness fuzz: ${held} held, ${calculated} calculated (${draftCount} drafts the contract would refuse, ${adapterThrew} the adapter can't read); ${addedByAdapter} adapter reasons shown in plain language, ${downgraded} instrument findings shown as market-based only`)
  })
})

// With the real engines (the adapter test's rule: NEUVETRA_PYTHON or python3). What the screen says a record will get is
// what the engines give it: a figure or not, and for a meter, a market-based figure or not.
const PYTHON = Bun.which(process.env.NEUVETRA_PYTHON ?? "python3")
// Each engine call is a fresh Python process, so these tests take longer on a loaded or Windows machine; a timeout is not a finding.
const ENGINE_TEST_TIMEOUT_MS = 300_000
if (!PYTHON) console.warn("SKIPPED: readiness vs engines needs Python (set NEUVETRA_PYTHON); required before any method release.")
describe.skipIf(!PYTHON)("the screen agrees with the engines", () => {
  const CALC = (name: string) => fileURLToPath(new URL(`../../../site-api/src/calculation/${name}`, import.meta.url))
  const engine = (call: NonNullable<ReturnType<typeof plan>["call"]>) => {
    const payload = call.engine === "scope1" ? { action: "calculate", request: call.request } : { action: "calculate", input: call.input }
    const out = Bun.spawnSync([PYTHON!, CALC(`${call.engine}_engine.py`)], { stdin: new TextEncoder().encode(JSON.stringify(payload)), env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" } })
    return JSON.parse(out.stdout.toString()) as { status: string; code?: string; result?: { status?: string; marketBased?: { status: string }; locationBased?: { status: string } } }
  }
  test("meters: a market-based figure exactly when the screen shows no market-based hold", () => {
    const mix = (i: number, k: number) => { let x = (Math.imul(i + 1, 0x2545f491) ^ Math.imul(k + 7, 0x9e3779b1)) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0; return (x ^ (x >>> 13)) >>> 0 }
    const pick = <T>(xs: readonly T[], i: number, k: number) => xs[mix(i, k) % xs.length]!
    const tally: Record<string, number> = {}
    for (let i = 0; i < 70; i++) {
      const count = 1 + (mix(i, 0) % 2)
      const good = i % 5 === 0 // every fifth meter has only admissible claims, so a complete market-based result is reached
      const instruments = Array.from({ length: count }, (_, n) => instrument({ mwh: pick(["1", "2.5", "", "12", "0", "1,000", "4.1234"], i, 10 * n + 1), qualityCriteriaMet: pick([true, true, false], i, 10 * n + 2), vintageYear: pick([2025, 2024, 2023, 2027], i, 10 * n + 3),
        evidenceReference: pick([clean, clean, pending, rejected, null, "73000000-0000-4000-8000-0000000000ff"], i, 10 * n + 4), generationTechnology: pick(["wind", "solar_photovoltaic", "natural_gas", "unknown", "mixed", "biogas", "geothermal"], i, 10 * n + 5),
        rateLbPerMwh: pick([null, { co2: "0", ch4: null, n2o: null }, { co2: "850.5", ch4: "0.01", n2o: null }, { co2: "1234567", ch4: null, n2o: null }, { co2: "1.234567", ch4: "x", n2o: null }], i, 10 * n + 6) }))
      if (good) instruments.splice(0, instruments.length, instrument({ mwh: pick(["1", "2.5"], i, 40) }), ...(count > 1 ? [instrument({ generationTechnology: "natural_gas", rateLbPerMwh: { co2: "850.5", ch4: null, n2o: null }, evidenceReference: pending })] : []))
      const meter = asDraft(() => electricity(instruments, {}, { quantity: q(pick(["10000", "2000", "12"], i, 30), pick(["kWh", "MWh"], i, 31)), evidenceIds: [clean, pending, rejected] }))
      const adapter = plan(meter)
      expect(adapter.action).toBe("calculate")
      const out = engine(adapter.call!)
      expect(out.status).toBe("ok")
      const market = out.result!.marketBased!.status
      const shown = recordReadiness(meter, context, evidence)
      const marketHeld = shown.some(finding => finding.reason.startsWith("Market-based result held — "))
      expect([out.result!.locationBased!.status, shown.filter(finding => BLOCKING.has(finding.status))]).toEqual(["complete", []])
      expect([market, marketHeld]).toEqual([market, market !== "complete"])
      tally[market] = (tally[market] ?? 0) + 1
    }
    expect(Object.keys(tally).sort()).toEqual(["complete", "input_needed", "review_required"])
    console.log(`readiness vs scope 2 engine: market-based ${JSON.stringify(tally)}`)
  }, ENGINE_TEST_TIMEOUT_MS)
  test("fuel, vehicles and refrigerants: a figure exactly when the screen shows nothing blocking", () => {
    const tally: Record<string, number> = {}
    const cases: CollectionActivity[] = [gas("100", "therm"), gas("100", "ccf"), gas("100", "ccf", { value: "0.1037", unit: "MMBtu per ccf" }), gas("100", "ccf", { value: "0", unit: "MMBtu per ccf" }), gas("100", "mcf", { value: "1.037", unit: "MMBtu per mcf" }), gas("100", "scf", { value: "0.001037", unit: "MMBtu per scf" }),
      generator({ basis: "measured", gallons: "100" }), generator({ basis: "measured", gallons: "100" }, "0.139"), generator({ basis: "purchases_only", purchasedGallons: "100" }), generator({ basis: "purchases_with_tank_levels", purchasedGallons: "100", openingGallons: "10", closingGallons: "20" }),
      generator({ basis: "purchases_with_tank_levels", purchasedGallons: "10", openingGallons: "0", closingGallons: "20" }),
      vehicle({}), vehicle({ miles: { value: "1000", basis: "odometer" } }), vehicle({ fuel: "gasoline", vehicleType: "gasoline_passenger_car", modelYear: 1965 }), vehicle({ fuel: "gasoline", vehicleType: "gasoline_passenger_car", modelYear: 1965, miles: { value: "10", basis: "trip_log" } }),
      vehicle({ fuelEconomy: { mpg: "20", source: "fleet_record" }, vehicleCount: 3 }), refrigerant({}), refrigerant({ insideBoundary: null }), refrigerant({ insideBoundary: false }), refrigerant({ maintainsRefrigerantStock: true }), refrigerant({ contractorRecordsComplete: false }),
      refrigerant({ terms: { PN: "0", CN: "5", PS: "1", CD: "0", RD: "0" } }), refrigerant({ gas: "R-22" }), refrigerant({ unit: "lb", terms: { PN: "", CN: "0", PS: "2", CD: "0", RD: "0" }, insideBoundary: false }, { quantity: q("", "lb") })]
    for (const activity of cases) {
      const adapter = plan(activity)
      const shown = recordReadiness(activity, context, evidence)
      const blocks = shown.some(finding => BLOCKING.has(finding.status))
      if (adapter.action === "hold") { expect(blocks).toBe(true); tally.adapter_hold = (tally.adapter_hold ?? 0) + 1; continue }
      const out = engine(adapter.call!)
      expect(out.status).toBe("ok")
      const status = out.result!.status as string
      tally[status] = (tally[status] ?? 0) + 1
      const figure = status === "complete" || status === "partial"
      expect([status, blocks]).toEqual([status, !figure && status !== "review_required" && status !== "memo_only"])
      if (status === "review_required") expect(shown.map(finding => finding.status)).toContain("review_required")
      if (status === "memo_only") expect(shown.map(finding => finding.status)).toContain("memo_only")
      if (status === "partial") expect(shown.map(finding => finding.status)).toContain("partial")
    }
    console.log(`readiness vs scope 1 engine: ${JSON.stringify(tally)}`)
  }, ENGINE_TEST_TIMEOUT_MS)
})
