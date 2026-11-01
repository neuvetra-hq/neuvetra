// Scope 3 completion I-05 (DESIGN §5.1, §5.2, §4.6, A6, A14, A15, A27, A28; Claude, 30 October 2026): energy resold (3D),
// average commuting, teleworking, asset energy and partner figures through the draft Scope 3 results route, the real Scope 3
// engine and the trusted boundary; the late-source lines (3D upstream, buildings by floor area, hotel stays) held as
// method_pending; the lease boundary from setup's consolidation approach; partner supersession; the commuting overlap
// attestation. Expected figures are exact rational arithmetic on the register cells they cite (read from the register
// files, never from the engine): eGRID2023 rev2 SRL23 CAMX W6:Y6 and US23 U3:W3, Hub 2025 Table 1 row 38, Table 10 and
// Table 12 (R-410A, D575).
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { validateCollectionActivity, type CollectionActivityRecord, type CollectionContext, type CollectionEvidenceMetadata, type CompanySetupView } from "@neuvetra/database"
import { createScope3Engine } from "../calculation/scope3-authority"
import { SCOPE3_SETUP_CATEGORY_TOKENS } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { buildScope3Results, REVIEWED_SCOPE3_ENGINE_SHA256, type Scope3ResultsEngine } from "./scope3-results-routes"
import { decodeScope3Results } from "../../../site-web/src/lib/scope3-results-decode"

const python = process.env.NEUVETRA_PYTHON ?? "python3"
const engine: Scope3ResultsEngine = createScope3Engine({ python, expectedEngineSha256: REVIEWED_SCOPE3_ENGINE_SHA256 })
const company = "93800000-0000-4000-8000-000000000001", setup = "93800000-0000-4000-8000-000000000002"
const office = "93800000-0000-4000-8000-000000000003", warehouse = "93800000-0000-4000-8000-000000000004"
const owner = "93800000-0000-4000-8000-0000000000a1"
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [
  { id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" },
  { id: warehouse, name: "Warehouse", inclusion: "excluded", control: "landlord", entityId: null, startMode: "period_start", endMode: "period_end" }] }
const year = { start: "2025-01-01", endExclusive: "2026-01-01" }
const common = { locationId: office, setupVersionId: setup, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic", notes: "", evidenceIds: [] as string[], period: year }
const plainAmount = (value: string) => /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value)
const q = (value: string, unit: string, normalized = plainAmount(value)) => ({ originalValue: value, originalUnit: unit, normalizedValue: normalized ? value : null, normalizedUnit: normalized ? unit : null })
let n = 0
function record(activity: Record<string, unknown>): CollectionActivityRecord {
  const id = `93800000-0000-4000-8000-${String(1000 + ++n).padStart(12, "0")}`
  const parsed = validateCollectionActivity({ ...common, sourceId: `E-${n}`, ...activity })
  const version = { id: `94800000-0000-4000-8000-${String(1000 + n).padStart(12, "0")}`, recordId: id, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, activity: parsed, payloadSha256: "b".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z" }
  return { id, companyId: company, kind: parsed.kind, currentVersion: version, history: [{ ...version, activity: undefined } as never] }
}
type Screen = "unknown" | "yes" | "no" | "not_applicable"
type Approach = "operational_control" | "financial_control" | "equity_share" | "unknown"
function setupView(screen: Partial<Record<number, Screen>>, approach: Approach): CompanySetupView {
  const screening = Object.entries(screen).map(([category, state]) => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[Number(category) - 1]!, state, reason: state === "no" || state === "not_applicable" ? "Synthetic screening reason." : "", details: "", locationId: null }))
  return { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: setup, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z",
    setup: { company: { legalName: "Synthetic Energy Partners Co", tradingName: "", countryCode: "US", regionCode: "CA", industry: "", naics: "", preparerRole: "", additionalBusinessActivities: "", otherIndustry: "" }, reportingPeriod: { start: year.start, endExclusive: year.endExclusive, firstInventory: "yes", priorInventoryReference: "" },
      boundary: { approach, notes: "", hasParent: "no", parentName: "", includedOperations: "" }, entities: [], relationships: [], locations: [{ id: office, name: "Office", inclusion: "included", countryCode: "US", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }, { id: warehouse, name: "Warehouse", inclusion: "excluded", countryCode: "US", control: "landlord", entityId: null, startMode: "period_start", endMode: "period_end" }], screening, changes: [], changeNotes: "", review: { acknowledged: true, notes: "" } } } } as unknown as CompanySetupView
}
const evidence: CollectionEvidenceMetadata[] = []
const all: Partial<Record<number, Screen>> = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 1, "yes" as Screen]))
const build = (records: CollectionActivityRecord[], screen = all, approach: Approach = "financial_control") =>
  buildScope3Results({ companyId: company, context: { ...context, boundaryApproach: approach }, records, evidence, setup: setupView(screen, approach), engine, now: () => new Date("2026-10-30T00:00:00Z") })
const TIMEOUT = 120_000

// Register cells, read from the register files (never from the engine).
const reg = (file: string) => Object.fromEntries((JSON.parse(readFileSync(new URL(`../../../../packages/neuvetra-database/src/method-reference/${file}`, import.meta.url), "utf8")) as { entries: Array<{ id: string; value: string; valueCell: string }> }).entries.map(e => [e.id, e]))
const R1 = reg("verified-scope3-register-2025.json"), R3 = reg("verified-scope3-supplement-register-2025.json")
const cell = (key: string) => (R1[key] ?? R3[key])!.value
// Exact rationals in BigInt, rounded half-even once to 4 dp for display.
type Q = { n: bigint; d: bigint }
const dec = (text: string): Q => { const [i, f = ""] = text.split("."); return { n: BigInt(i! + f), d: 10n ** BigInt(f.length) } }
const mul = (...xs: Q[]): Q => xs.reduce((a, b) => ({ n: a.n * b.n, d: a.d * b.d }), { n: 1n, d: 1n })
const add = (...xs: Q[]): Q => xs.reduce((a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }), { n: 0n, d: 1n })
const div = (a: Q, b: Q): Q => ({ n: a.n * b.d, d: a.d * b.n })
const halfEven = (a: Q, places: number): bigint => {
  const scaled = a.n * 10n ** BigInt(places)
  let units = scaled / a.d
  const twice = 2n * (scaled % a.d)
  if (twice > a.d || (twice === a.d && units % 2n === 1n)) units += 1n
  return units
}
const r12 = (a: Q): Q => ({ n: halfEven(a, 12), d: 10n ** 12n })
const display = (a: Q) => { const digits = halfEven(a, 4).toString().padStart(5, "0"); return `${digits.slice(0, -4)}.${digits.slice(-4)}` }
const LB = dec("0.45359237"), GWP = { co2: dec("1"), ch4: dec("28"), n2o: dec("265") }, G = dec("0.001")
const grid = (mwh: Q, prefix: string) => add(...(["co2", "ch4", "n2o"] as const).map(g => mul(mwh, dec(cell(`${prefix}.${g}`)), LB, GWP[g])))
const gas = (mmbtu: Q) => add(mul(mmbtu, dec(cell("hub2025_t1.natural_gas.co2"))), ...(["ch4", "n2o"] as const).map(g => mul(mmbtu, dec(cell(`hub2025_t1.natural_gas.${g}`)), G, GWP[g])))
const travel = (amount: Q, base: string) => add(mul(amount, dec(cell(`${base}.co2`))), ...(["ch4", "n2o"] as const).map(g => mul(amount, dec(cell(`${base}.${g}`)), G, GWP[g])))

const none = { zip: null, subregion: null, utilityEiaId: null }
const RESOLD = { gridBasis: "subregion", zip: "94105", subregion: "CAMX", utilityEiaId: null, resoldEnergyNotInScope2: true }
const mode = (m: string, share: string, distance: string, occupancy: string | null = null) => ({ mode: m, sharePercent: share, oneWayDistance: distance, distanceUnit: "mile", occupancy })
const COMMUTE = { workingDays: 220, modes: [mode("passenger_car", "60", "12", "1.2"), mode("bus", "30", "8"), mode("non_motorized", "10", "2")], sharesBasis: "2025 staff survey", distanceBasis: "Survey medians", activityOverlap: "none_confirmed" }
const TELE = { carrier: "electricity", zip: "94105", subregion: "CAMX", utilityEiaId: null, baselineBasis: "Incremental above the office baseline" }
const ASSET = { category: 4, carrier: "electricity", assetLabel: "Third-party DC, Stockton", counterpartyName: "Synthetic 3PL LLC", leaseType: null, noOperationalControlBasis: null, zip: "93721", subregion: "CAMX", utilityEiaId: null, refrigerantGas: null, allocation: null }
const PARTNER = { category: 13, counterpartyName: "Synthetic Tenant Inc", scope2Basis: "location", allocationBasis: "area", allocationNumerator: "12000", allocationDenominator: "48000", leaseType: "finance",
  noOperationalControlBasis: null, gwpBasis: "AR5", verification: "unverified", periodMatches: true, supersedesSpend: null }
const SPEND = { category: 1, naicsCode: "541511", dollarYear: 2024, marginChoice: "with_margins", boughtAtFactoryGate: false, capitalFullCost: null, taxTreatment: "excludes_sales_tax",
  supplierName: "Synthetic Software LLC", glAccount: "6100", description: "Software consulting", categoryConfirmed: false, activityOverlap: "unknown", importId: null, importRow: null,
  mappingSource: "user", paidByReportingCompany: null, spendEstimateBasis: null, lineDate: null, possibleDuplicateOf: null, duplicateConfirmedDistinct: false }
const BUILDING = { category: 8, cbecsActivity: "office", usesNaturalGas: "yes", gridBasis: "subregion", zip: "94105", subregion: "CAMX", utilityEiaId: null, coveredDays: 365, leaseType: "operating", noOperationalControlBasis: null }

describe("I-05: every new kind through the results route and the real engine", () => {
  test("3D, average commuting, teleworking, asset energy (4, 8, 10, 13, 14) and partner figures (4, 5, 8, 9, 10, 12, 13, 14): exact figures, statuses and the boundary's profile checks", async () => {
    const share = (num: string, den: string) => r12(div(dec(num), dec(den)))
    const lines: Array<[CollectionActivityRecord, Q]> = [
      [record({ kind: "energy_resold", quantity: q("1200.5", "MWh"), payload: RESOLD }), grid(dec("1200.5"), "egrid2023.CAMX")],
      [record({ kind: "energy_resold", quantity: q("250", "kWh"), payload: { ...RESOLD, gridBasis: "us_average", ...none } }), grid(dec("0.25"), "egrid2023_us")],
      // 180 x 60% x 12 mi x 2 x 220 days / 1.2 occupancy (rounded to 12 dp) per vehicle-mile; 180 x 30% x 8 x 2 x 220 per passenger-mile; walking a known zero.
      [record({ kind: "commuting_average", quantity: q("180", "employee"), payload: COMMUTE }),
        add(travel(r12(div(mul(dec("180"), dec("0.6"), dec("12"), dec("2"), dec("220")), dec("1.2"))), "travel.passenger_car.vehicle_mile"), travel(mul(dec("180"), dec("0.3"), dec("8"), dec("2"), dec("220")), "travel.bus.passenger_mile"))],
      [record({ kind: "teleworking", quantity: q("3200", "kWh"), payload: TELE }), grid(dec("3.2"), "egrid2023.CAMX")],
      [record({ kind: "teleworking", quantity: q("85", "therm"), payload: { ...TELE, carrier: "natural_gas", ...none } }), gas(dec("8.5"))],
      [record({ kind: "asset_energy", quantity: q("64000", "kWh"), payload: ASSET }), grid(dec("64"), "egrid2023.CAMX")],
      [record({ kind: "asset_energy", quantity: q("48000", "kWh"), payload: { ...ASSET, category: 8, leaseType: "operating" } }), grid(dec("48"), "egrid2023.CAMX")],
      [record({ kind: "asset_energy", quantity: q("120", "mcf"), payload: { ...ASSET, category: 10, carrier: "natural_gas", ...none } }), gas(mul(dec("120000"), dec(cell("hub2025_t1.natural_gas.heat_content"))))],
      [record({ kind: "asset_energy", quantity: q("5200", "therm"), payload: { ...ASSET, category: 13, leaseType: "finance", carrier: "natural_gas", ...none, allocation: { reportingArea: "12000", buildingArea: "48000", occupancyPercent: "95", areaUnit: "sqft" } } }),
        gas(mul(dec("520"), r12(div(dec("12000"), mul(dec("48000"), dec("0.95"))))))],
      [record({ kind: "asset_energy", quantity: q("3.5", "lb"), payload: { ...ASSET, category: 14, carrier: "refrigerant", ...none, refrigerantGas: "R-410A" } }), mul(dec("3.5"), LB, dec(cell("hub2025_gwp.R-410A")))],
      ...([4, 5, 8, 9, 10, 12, 13, 14] as const).map((category): [CollectionActivityRecord, Q] => [record({ kind: "partner_reported", quantity: q("9000", "kg CO2e"),
        payload: { ...PARTNER, category, leaseType: category === 8 ? "operating" : category === 13 ? "finance" : null } }), mul(dec("9000"), share("12000", "48000"))]),
      [record({ kind: "partner_reported", quantity: q("12.5", "metric_ton CO2e"), payload: { ...PARTNER, category: 14, allocationBasis: "exclusive", allocationNumerator: null, allocationDenominator: null, leaseType: null } }), dec("12500")],
    ]
    // A deflated spend line in the same run: the boundary verifies the deflation effect of its category profile.
    const deflated = record({ kind: "purchase_spend", quantity: q("100000", "USD"), payload: SPEND })
    const result = await build([...lines.map(([r]) => r), deflated])
    for (const [r, expected] of lines) {
      const row = result.records.find(x => x.recordId === r.id && x.kind === r.kind)!
      expect([r.kind, row.outcome, row.result?.status, row.result?.total?.display]).toEqual([r.kind, "calculated", "complete", display(expected)])
    }
    expect(result.records.find(x => x.recordId === deflated.id)!.result!.total!.display).toBe("7894.2757")
    // Category 3: each 3D line carries its 3D upstream line (I-12u): resold MWh x round12(gas heat input / net generation) x NETL
    // production through transmission (7.8 g/MJ x 1055.05585262 MJ/MMBtu / 1000), from the register cells. The upstream lines close
    // the 3D lines (now calculated) and stay partial themselves (coal, oil and other fossil fuels have no verified factor).
    const R5 = (JSON.parse(readFileSync(new URL("../../../../packages/neuvetra-database/src/method-reference/verified-scope3-us-upstream-register-2025.json", import.meta.url), "utf8")) as { entries: Array<{ id: string; value: string }> }).entries
    const netl = dec(R5.find(e => e.id === "netl2024_4862.ng_upstream.prod_through_transmission")!.value)
    // Round 2 (owner decision 2): oil-fired generation is mapped too, with the CA-GREET3.0 ULSD upstream (R5) x the LCFS diesel energy
    // density (R5) x 0.001 / the Hub 2025 distillate No. 2 heat content (R3 D55), rounded 12 dp: gas term + oil term per MWh.
    const r5 = (id: string) => dec(R5.find(e => e.id === id)!.value)
    const fOil = r12(div(mul(r5("cagreet3_lut2018.ulsd.upstream"), r5("carb_lcfs.energy_density.ulsd"), G), dec(cell("hub2025_t1.distillate_fuel_oil_no_2.heat_content"))))
    const term = (region: string, fuel: string, f: Q) => mul(r12(div(dec(cell(`egrid2023_hi.${region}.${fuel}`)), dec(cell(`egrid2023_gen.${region}`)))), f)
    // Round 2, lane F (DESIGN 13.6): coal mine methane only, round12(43.6 MMT x 10^9 / (594,155 thousand st x 1000 x 20.100 MMBtu/st)) from R5's three inputs.
    const fCoal = r12(div(mul(r5("epa_ghgi.2022.coal_mining_ch4_total"), dec("1000000000")), mul(r5("eia.2022.coal_production_short_tons"), dec("1000"), r5("eia.2022.coal_heat_content_production"))))
    const upstreamOf = (mwh: Q, region: string) => mul(mwh, add(add(term(region, "GAS", mul(netl, dec("1055.05585262"), G)), term(region, "OIL", fOil)), term(region, "COAL", fCoal)))
    const upstream = result.records.filter(x => x.kind === "energy_resold_upstream")
    expect(upstream.map(x => [x.outcome, x.plan.status, x.result?.boundary.minimumBoundary, x.result?.total?.display])).toEqual([
      ["calculated", null, "partial", display(upstreamOf(dec("1200.5"), "CAMX"))], ["calculated", null, "partial", display(upstreamOf(dec("0.25"), "US"))]])
    const status = (c: number) => result.coverage.categories[c - 1]!
    expect([status(3).status, status(3).counts.calculated, status(3).counts.partialBoundary, status(3).counts.methodPending]).toEqual(["partial_boundary", 2, 2, 0])
    for (const c of [1, 4, 5, 7, 8, 9, 10, 12, 13, 14]) expect([c, status(c).status]).toEqual([c, "calculated"])
    expect(status(13).disclosures).toEqual(expect.arrayContaining(["partner_data_unverified", "partner_gwp_basis_ar5", "partner_scope2_location", "area_allocated_not_submetered"]))
    expect(status(7).disclosures).toEqual(expect.arrayContaining(["average_data_commuting_profile", "non_motorized_known_zero", "optional_activity_included", "incremental_above_baseline", "location_based_grid_rates"]))
    expect(result.coverage.knownSourceSubtotal!.unrounded).not.toBe("0")
  }, TIMEOUT)

  test("3D upstream lines exist only when category 3 is included (as 3C); a held record holds its line with the same reasons", async () => {
    const ok = record({ kind: "energy_resold", quantity: q("10", "MWh"), payload: RESOLD })
    const unconfirmed = record({ kind: "energy_resold", quantity: q("10", "MWh"), payload: { ...RESOLD, resoldEnergyNotInScope2: false } })
    const notScreened = await build([ok, unconfirmed], { 1: "yes" })
    expect(notScreened.records.map(r => r.kind)).toEqual(["energy_resold", "energy_resold"])
    const included = await build([ok, unconfirmed])
    const lines = included.records.map(r => [r.kind, r.recordId === ok.id ? "ok" : "unconfirmed", r.plan.status, r.plan.reasons])
    expect(lines).toEqual([["energy_resold", "ok", null, []], ["energy_resold", "unconfirmed", "input_needed", ["resold_energy_in_scope2_not_confirmed"]],
      ["energy_resold_upstream", "ok", null, []], ["energy_resold_upstream", "unconfirmed", "input_needed", ["energy_resold_record_held", "resold_energy_in_scope2_not_confirmed"]]])
    // I-12u: the calculated 3D line is closed by its upstream line (calculated); the upstream line is partial (unmapped fossil fuels).
    expect([included.coverage.categories[2]!.status, included.coverage.categories[2]!.counts]).toEqual(["input_needed",
      { records: 4, calculated: 1, partialBoundary: 1, inputNeeded: 2, outsidePeriod: 0, excluded: 0, withdrawn: 0, unavailable: 0, methodPending: 0, optionalPending: 0 }])
  }, TIMEOUT)

  test("A14, A27: a hotel record saved before 0030 calculates without a re-save (I-12h: R6 loaded; its U.S. reporting location gives the country)", async () => {
    const hotel = record({ kind: "business_travel", quantity: q("10", "room-night", false), payload: { mode: "hotel", passengerSegments: null, haulBasis: null } })
    const flight = record({ kind: "business_travel", quantity: q("2475", "mile"), payload: { mode: "air", passengerSegments: 2, haulBasis: null } })
    const alone = await build([hotel])
    const row = alone.records[0]!
    expect([row.kind, row.category, row.outcome, row.plan, row.result?.methodVersionId, row.result?.estimates]).toEqual(["hotel_stay", 6, "calculated", { action: "calculate", status: null, reasons: [], notes: [] },
      "scope3.cat6.hotel_stay.epa2018_events.v1", ["hotel_country_from_reporting_location"]])
    expect([alone.coverage.categories[5]!.status, alone.coverage.categories[5]!.counts.optionalPending, alone.coverage.categories[5]!.disclosures.includes("optional_activity_not_yet_quantified")]).toEqual(["calculated", 0, false])
    const both = await build([hotel, flight])
    expect([both.coverage.categories[5]!.status, both.coverage.categories[5]!.counts.calculated]).toEqual(["calculated", 2])
    expect(both.coverage.proposedMandatory.gaps.map(g => g.category)).not.toContain(6)
  }, TIMEOUT)

  test("round 2b (A27 over decision 9): an optional hotel stay abroad never caps category 6's data-quality label; a held line does; the web decoder agrees", async () => {
    const veryGood = { indicators: { technological: "very_good", temporal: "very_good", geographical: "very_good", completeness: "very_good", reliability: "very_good" }, activityDataOrigin: null, basis: "Booking-system export, checked against invoices." }
    const flight = record({ kind: "business_travel", quantity: q("2475", "mile"), payload: { mode: "air", passengerSegments: 2, haulBasis: null, dataQuality: veryGood } })
    const abroad = record({ kind: "business_travel", quantity: q("3", "room-night"), payload: { mode: "hotel_stay", passengerSegments: null, haulBasis: null, cabinClass: null, hotelCountry: "GB" } })
    const held = record({ kind: "business_travel", quantity: q("2475", "mile"), payload: { mode: "air", passengerSegments: null, haulBasis: null } })
    const optional = await build([flight, abroad])
    const six = optional.coverage.categories[5]!
    expect([six.status, six.counts.calculated, six.counts.optionalPending, six.profile!.dataQuality.overall.label]).toEqual(["calculated", 1, 1, "very_good"])
    expect([six.dataQualityLabel, six.disclosures.includes("data_quality_label_capped"), six.disclosures.includes("optional_activity_not_yet_quantified")])
      .toEqual([{ label: "very_good", engineLabel: "very_good", capped: false, reasons: [] }, false, true])
    expect(decodeScope3Results(JSON.parse(JSON.stringify(optional)), company).coverage.categories[5]!.dataQualityLabel.label).toBe("very_good")
    const withHeld = await build([flight, abroad, held])
    const capped = withHeld.coverage.categories[5]!
    expect([capped.status, capped.counts.inputNeeded, capped.dataQualityLabel]).toEqual(["input_needed", 1, { label: "fair", engineLabel: "very_good", capped: true, reasons: ["lines_not_quantified"] }])
    expect(decodeScope3Results(JSON.parse(JSON.stringify(withHeld)), company).coverage.categories[5]!.dataQualityLabel.label).toBe("fair")
  }, TIMEOUT)

  test("A15: the lease boundary follows setup's consolidation approach; buildings by floor area calculate (I-12h)", async () => {
    const lessee = record({ kind: "asset_energy", quantity: q("48000", "kWh"), payload: { ...ASSET, category: 8, leaseType: "operating" } })
    const lessor = record({ kind: "partner_reported", quantity: q("9000", "kg CO2e"), payload: { ...PARTNER, leaseType: "operating" } })
    const finance = record({ kind: "asset_energy", quantity: q("48000", "kWh"), payload: { ...ASSET, category: 8, leaseType: "finance" } })
    const reasons = async (approach: Approach) => (await build([lessee, lessor, finance], all, approach)).records.map(r => r.plan.reasons)
    expect(await reasons("operational_control")).toEqual([["lease_in_scope1_2_under_boundary"], ["finance_lease_in_scope1_2"], []])
    expect(await reasons("financial_control")).toEqual([[], ["finance_lease_in_scope1_2"], ["lessor_operating_lease_in_scope1_2"]])
    expect(await reasons("unknown")).toEqual(Array.from({ length: 3 }, () => ["scope3_consolidation_approach_required"]))
    const buildingLine = await build([record({ kind: "building_average", quantity: q("12000", "sqft"), payload: BUILDING })], all, "financial_control")
    // I-12h: R6 is loaded, so a building by floor area calculates. Round 2 (owner decision 4): it is partial (other energy sources
    // not counted), so category 8 is partial_boundary until the company documents that within-category exclusion.
    expect([buildingLine.records[0]!.plan.status, buildingLine.records[0]!.outcome, buildingLine.coverage.categories[7]!.status]).toEqual([null, "calculated", "partial_boundary"])
  }, TIMEOUT)

  test("B5: a partner record supersedes the spend it replaces; a survey commuting profile overlapping distance records needs the attestation", async () => {
    const freight = record({ kind: "purchase_spend", quantity: q("20000", "USD"), payload: { ...SPEND, category: 4, naicsCode: "484121", dollarYear: 2022, activityOverlap: "none_confirmed", supplierName: "Synthetic Freight Co" } })
    const carrier = record({ kind: "partner_reported", quantity: q("8200", "kg CO2e"), payload: { ...PARTNER, category: 4, leaseType: null, allocationBasis: "exclusive", allocationNumerator: null, allocationDenominator: null,
      supersedesSpend: { supplierName: "Synthetic Freight Co", mappingKeys: [] } } })
    const out = await build([freight, carrier])
    const line = out.records.find(r => r.recordId === freight.id)!
    expect([line.plan.status, line.plan.reasons, line.plan.notes]).toEqual(["excluded", ["superseded_by_supplier_record"], ["spend_tax_treatment_excludes_sales_tax", `superseded_by:${carrier.id}`]])
    expect([out.coverage.categories[3]!.counts.excluded, out.coverage.categories[3]!.subtotal!.unrounded]).toEqual([1, "8200"])
    const distance = record({ kind: "employee_commuting", quantity: q("1000", "vehicle-mile"), payload: { mode: "passenger_car" } })
    const survey = record({ kind: "commuting_average", quantity: q("180", "employee"), payload: { ...COMMUTE, activityOverlap: "unknown" } })
    const commuting = await build([distance, survey])
    expect(commuting.records.find(r => r.recordId === survey.id)!.plan.reasons).toEqual(["commuting_overlap_not_confirmed"])
    expect(commuting.coverage.categories[6]!.status).toBe("input_needed")
    expect((await build([survey])).records[0]!.outcome).toBe("calculated")
  }, TIMEOUT)
})
