import { scope3GroupDecimal } from "../../../../packages/neuvetra-database/src/scope3-text-v3"
// Scope 3 completion I-07 (DESIGN §5.1, §5.2, §4.4, §4.6, §6, B5(d); Claude, 30 October 2026): fuels sold, energy-using
// products and greenhouse-gas products (category 11), end of life by treatment split (12) and investments (15) through the draft
// Scope 3 results route, the real Scope 3 engine and the trusted boundary; biogenic CO2 per category and memo items reported
// separately and never in a total; the category 11/12 product overlap disclosed on both categories. Expected figures are exact
// rational arithmetic on the register cells they cite (read from the register files, never from the engine): Hub 2025 Table 1
// rows 72 (propane) and 80 (biodiesel), Table 12 D575 (R-410A), Table 9 row 449 (corrugated containers), eGRID2023 rev2 US23
// U3:W3 and SRL23 CAMX, EPA SC v1.3 row 798 (541511 without margins) and the FRED transcription. The run also writes the
// web's second Scope 3 fixture (`scope3-results-downstream.fixture.json`), which the web decoder, CSV and screen tests read.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { validateCollectionActivity, type CollectionActivityRecord, type CollectionContext, type CollectionEvidenceMetadata, type CompanySetupView } from "@neuvetra/database"
import { createScope3Engine } from "../calculation/scope3-authority"
import { SCOPE3_SETUP_CATEGORY_TOKENS } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { buildScope3Results, REVIEWED_SCOPE3_ENGINE_SHA256, type Scope3ResultsEngine } from "./scope3-results-routes"

const python = process.env.NEUVETRA_PYTHON ?? "python3"
const engine: Scope3ResultsEngine = createScope3Engine({ python, expectedEngineSha256: REVIEWED_SCOPE3_ENGINE_SHA256 })
const company = "93900000-0000-4000-8000-000000000001", setup = "93900000-0000-4000-8000-000000000002", office = "93900000-0000-4000-8000-000000000003"
const owner = "93900000-0000-4000-8000-0000000000a1"
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [{ id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }] }
const year = { start: "2025-01-01", endExclusive: "2026-01-01" }
const common = { locationId: office, setupVersionId: setup, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic", notes: "", evidenceIds: [] as string[], period: year }
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
let n = 0
function record(activity: Record<string, unknown>): CollectionActivityRecord {
  const id = `93900000-0000-4000-8000-${String(1000 + ++n).padStart(12, "0")}`
  const parsed = validateCollectionActivity({ ...common, sourceId: `D-${n}`, ...activity })
  const version = { id: `94900000-0000-4000-8000-${String(1000 + n).padStart(12, "0")}`, recordId: id, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, activity: parsed, payloadSha256: "b".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z" }
  return { id, companyId: company, kind: parsed.kind, currentVersion: version, history: [{ ...version, activity: undefined } as never] }
}
type Screen = "unknown" | "yes" | "no" | "not_applicable"
function setupView(screen: Partial<Record<number, Screen>>): CompanySetupView {
  const screening = Object.entries(screen).map(([category, state]) => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[Number(category) - 1]!, state, reason: state === "no" || state === "not_applicable" ? "Synthetic screening reason." : "", details: "", locationId: null }))
  return { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: setup, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z",
    setup: { company: { legalName: "Synthetic Products and Holdings Co", tradingName: "", countryCode: "US", regionCode: "CA", industry: "", naics: "", preparerRole: "", additionalBusinessActivities: "", otherIndustry: "" }, reportingPeriod: { start: year.start, endExclusive: year.endExclusive, firstInventory: "yes", priorInventoryReference: "" },
      boundary: { approach: "operational_control", notes: "", hasParent: "no", parentName: "", includedOperations: "" }, entities: [], relationships: [], locations: [{ id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }], screening, changes: [], changeNotes: "", review: { acknowledged: true, notes: "" } } } } as unknown as CompanySetupView
}
const evidence: CollectionEvidenceMetadata[] = []
const downstream: Partial<Record<number, Screen>> = { 11: "yes", 12: "yes", 15: "yes" }
const build = (records: CollectionActivityRecord[], screen = downstream) =>
  buildScope3Results({ companyId: company, context, records, evidence, setup: setupView(screen), engine, now: () => new Date("2026-10-30T00:00:00Z") })
const TIMEOUT = 120_000
const FIXTURE = new URL("../../../site-web/src/lib/scope3-results-downstream.fixture.json", import.meta.url)

// Register cells and constants, read from the register files (never from the engine).
const file = (name: string) => JSON.parse(readFileSync(new URL(`../../../../packages/neuvetra-database/src/method-reference/${name}`, import.meta.url), "utf8")) as { entries: Array<{ id: string; value: string }>; constants: Array<{ id: string; value: string }> }
const registers = ["verified-scope3-register-2025.json", "verified-scope3-spend-register-epa-scghg-v1.3.json", "verified-scope3-supplement-register-2025.json"].map(file)
const cell = (key: string) => registers.flatMap(r => [...r.entries, ...r.constants]).find(e => e.id === key)!.value
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
const same = (a: Q, text: string) => { const b = dec(text); return a.n * b.d === b.n * a.d }
const LB = dec("0.45359237"), GWP = { co2: dec("1"), ch4: dec("28"), n2o: dec("265") }, G = dec("0.001")
const fuelGases = (mmbtu: Q, fuel: string) => ({ co2: mul(mmbtu, dec(cell(`hub2025_t1.${fuel}.co2`))), ch4n2o: add(...(["ch4", "n2o"] as const).map(g => mul(mmbtu, dec(cell(`hub2025_t1.${fuel}.${g}`)), G, GWP[g]))) })
const grid = (mwh: Q, prefix: string) => add(...(["co2", "ch4", "n2o"] as const).map(g => mul(mwh, dec(cell(`${prefix}.${g}`)), LB, GWP[g])))

const GHG = { productLabel: "Synthetic aerosol duster", gas: "HFC-134a", chargePerUnit: "0.3", chargeUnit: "kg", useReleasePercent: "100", releaseBasis: "Aerosol: the whole charge is released in use" }
const PRODUCT = { productLabel: "Synthetic 2 kW space heater", lifetimeBasis: "years", lifetimeQuantity: "10", energyPerBasis: "1250.5", energyCarrier: "electricity", energyUnit: "kWh", useRegion: "US", lifetimeSource: "Manufacturer test standard" }
const SPLIT = { recycled: "75", landfilled: "20", combusted: "5", composted: "0", anaerobic_digestion_dry: "0", anaerobic_digestion_wet: "0" }
const EOL = { material: "corrugated_containers", basis: "packaging", split: SPLIT, splitBasis: "EPA Facts and Figures 2018, containers and packaging", productLabel: "Synthetic shipping box" }
const INVEST = { investeeName: "Synthetic Solar Holdings", holdingType: "equity_unlisted", path: "investee_reported", attribution: { basis: "equity_share_percent", percent: "12.5" }, investeeEmissions: "4930",
  emissionsVerified: true, revenue: null, revenueYear: null, naicsCode: null, initialSponsor: false, projectedAnnual: null, lifetimeYears: null, snapshotDate: "2025-12-31", gwpBasis: "AR5" }

/** The downstream records of the web fixture: every I-07 kind, calculated and held, with biogenic CO2, a memo item and the overlap. */
function downstreamRecords() {
  n = 0
  return {
    propane: record({ kind: "sold_fuel", quantity: q("120000", "US_gallon"), payload: { fuel: "propane", combustedInUse: "yes" } }),
    biodiesel: record({ kind: "sold_fuel", quantity: q("1000", "US_gallon"), payload: { fuel: "biodiesel_100", combustedInUse: "yes" } }),
    feedstock: record({ kind: "sold_fuel", quantity: q("5000", "US_gallon"), payload: { fuel: "propane", combustedInUse: "no_feedstock" } }),
    heater: record({ kind: "sold_energy_product", quantity: q("5000", "unit"), payload: PRODUCT }),
    heaterCamx: record({ kind: "sold_energy_product", quantity: q("200", "unit"), payload: { ...PRODUCT, useRegion: "CAMX", energyUnit: "MWh", energyPerBasis: "1.25" } }),
    heaterAbroad: record({ kind: "sold_energy_product", quantity: q("300", "unit"), payload: { ...PRODUCT, useRegion: "non_US" } }),
    duster: record({ kind: "sold_ghg_product", quantity: q("40000", "unit"), payload: GHG }),
    boxes: record({ kind: "end_of_life_split", quantity: q("85.5", "short_ton"), payload: EOL }),
    dusterEnd: record({ kind: "end_of_life_split", quantity: q("12", "metric_ton"), payload: { ...EOL, material: "mixed_plastics", basis: "sold_products", productLabel: "Synthetic aerosol duster", split: { ...SPLIT, recycled: "30", landfilled: "60", combusted: "10" } } }),
    unknownSplit: record({ kind: "end_of_life_split", quantity: q("3", "short_ton"), payload: { ...EOL, split: null, splitBasis: null } }),
    stake: record({ kind: "investment", quantity: q("2500000", "USD"), payload: INVEST }),
    project: record({ kind: "investment", quantity: q("20000000", "USD"), payload: { ...INVEST, holdingType: "project_finance", path: "project_reported", emissionsVerified: false, investeeEmissions: "1200000",
      attribution: { basis: "outstanding_over_denominator", denominatorType: "total_project_cost", denominator: "80000000" }, initialSponsor: true, projectedAnnual: "1200000", lifetimeYears: 25 } }),
    proxy: record({ kind: "investment", quantity: q("1000000", "USD"), payload: { ...INVEST, path: "revenue_eeio", investeeEmissions: null, emissionsVerified: null, revenue: "35000000", revenueYear: 2024, naicsCode: "541511",
      attribution: { basis: "outstanding_over_denominator", denominatorType: "evic", denominator: "125000000" } } }),
    patioHeater: record({ kind: "sold_energy_product", quantity: q("150", "unit"), payload: { ...PRODUCT, productLabel: "Synthetic patio heater", energyCarrier: "propane", energyUnit: "US_gallon", energyPerBasis: "45", lifetimeQuantity: "8", useRegion: "non_US" } }),
    acUnit: record({ kind: "sold_ghg_product", quantity: q("1200", "unit"), payload: { ...GHG, productLabel: "Synthetic split AC unit", gas: "R-410A", chargePerUnit: "6.06", chargeUnit: "lb", useReleasePercent: "4", releaseBasis: "Annual operating leak rate, EPA Vintaging Model" } }),
  }
}

describe("I-07: categories 11, 12 and 15 through the results route and the real engine", () => {
  test("every new kind: exact figures from the register cells, biogenic CO2 per category and memo items outside every total, holds, the overlap disclosure", async () => {
    const r = downstreamRecords()
    const result = await build(Object.values(r))
    const row = (rec: CollectionActivityRecord) => result.records.find(x => x.recordId === rec.id)!
    const propane = fuelGases(mul(dec("120000"), dec(cell("hub2025_t1.propane.heat_content"))), "propane")
    const biodiesel = fuelGases(mul(dec("1000"), dec(cell("hub2025_t1.biodiesel_100.heat_content"))), "biodiesel_100")
    // A fuel-using product is counted wherever it is used (Hub Table 1 is not a grid factor): 150 x 8 years x 45 gallons of propane.
    const patio = fuelGases(mul(dec("150"), dec("8"), dec("45"), dec(cell("hub2025_t1.propane.heat_content"))), "propane")
    const expected: Array<[CollectionActivityRecord, Q]> = [
      [r.propane, add(propane.co2, propane.ch4n2o)],
      [r.biodiesel, biodiesel.ch4n2o],  // biogenic CO2 outside the total (DESIGN D6); CH4 and N2O inside (N-7)
      [r.feedstock, dec("0")],
      [r.heater, grid(mul(dec("5000"), dec("10"), dec("1250.5"), dec("0.001")), "egrid2023_us")],
      [r.heaterCamx, grid(mul(dec("200"), dec("10"), dec("1.25")), "egrid2023.CAMX")],
      [r.duster, mul(dec("40000"), dec("0.3"), dec(cell("hub2025_gwp.HFC-134a")))],
      [r.patioHeater, add(patio.co2, patio.ch4n2o)],
      [r.acUnit, mul(dec("1200"), dec("6.06"), LB, div(dec("4"), dec("100")), dec(cell("hub2025_gwp.R-410A")))],
      [r.boxes, add(...([["recycled", "75"], ["landfilled", "20"], ["combusted", "5"]] as const).map(([t, s]) => mul(dec("85.5"), div(dec(s), dec("100")), dec(cell(`waste.corrugated_containers.${t}`)), dec("1000"))))],
      [r.dusterEnd, add(...([["recycled", "30"], ["landfilled", "60"], ["combusted", "10"]] as const).map(([t, s]) => mul(r12(div(dec("12000"), mul(LB, dec("2000")))), div(dec(s), dec("100")), dec(cell(`waste.mixed_plastics.${t}`)), dec("1000"))))],
      [r.stake, mul(dec("4930"), dec("1000"), dec("0.125"))],
      [r.project, mul(dec("1200000"), dec("1000"), r12(div(dec("20000000"), dec("80000000"))))],
      [r.proxy, mul(dec("35000000"), dec(cell("epa_scghg_v130.541511.without_margins")), r12(div(dec(cell("price_index.gdp_deflator.2022")), dec(cell("price_index.gdp_deflator.2024")))), r12(div(dec("1000000"), dec("125000000"))))],
    ]
    for (const [rec, value] of expected) {
      const line = row(rec)
      expect([rec.kind, line.outcome, line.result?.status, line.result?.total?.display, same(value, line.result!.total!.unrounded)]).toEqual([rec.kind, "calculated", "complete", display(value), true])
    }
    // Biogenic CO2: the biodiesel line's CO2, alone in category 11's profile and in no total.
    expect(same(biodiesel.co2, row(r.biodiesel).result!.biogenicCo2!.mass)).toBe(true)
    const eleven = result.coverage.categories[10]!, twelve = result.coverage.categories[11]!, fifteen = result.coverage.categories[14]!
    expect(eleven.profile!.biogenicCo2!.unrounded).toBe(row(r.biodiesel).result!.biogenicCo2!.mass)
    const sumOf = (recs: CollectionActivityRecord[]) => add(...recs.map(rec => dec(row(rec).result!.total!.unrounded)))
    expect(same(sumOf([r.propane, r.biodiesel, r.feedstock, r.heater, r.heaterCamx, r.duster, r.patioHeater, r.acUnit]), eleven.subtotal!.unrounded)).toBe(true)
    // Memo item: the project's projected lifetime emissions, 1,200,000 t a year x 25 years x 25%, reported separately.
    const memo = mul(dec("1200000"), dec("1000"), dec("25"), r12(div(dec("20000000"), dec("80000000"))))
    expect(same(memo, row(r.project).result!.memoItems![0]!.kg)).toBe(true)
    expect(same(memo, fifteen.profile!.memoItems.projected_lifetime_emissions!.unrounded)).toBe(true)
    expect(same(sumOf([r.stake, r.project, r.proxy]), fifteen.subtotal!.unrounded)).toBe(true)
    expect(same(add(...expected.map(([, v]) => v)), result.coverage.knownSourceSubtotal!.unrounded)).toBe(true)
    // Holds: electricity used outside the U.S. and an unknown split need input; their categories say so.
    expect([row(r.heaterAbroad).result!.findings, row(r.unknownSplit).result!.findings]).toEqual([["use_region_outside_us"], ["treatment_split_unknown"]])
    expect([eleven.status, twelve.status, fifteen.status]).toEqual(["input_needed", "input_needed", "calculated"])
    expect([eleven.counts.inputNeeded, twelve.counts.inputNeeded, eleven.subtotalBasis]).toEqual([1, 1, "known_sources_only"])
    // PCAF-style scores by path, the upper-bound proxy, the unverified investee default, and the overlap on both categories.
    expect([row(r.stake), row(r.project), row(r.proxy)].map(x => x.result!.activity.pcafScore)).toEqual([1, 2, 4])
    expect(row(r.proxy).methodType).toBe("proxy")
    expect(row(r.project).effectiveDataQuality!.indicators.reliability).toEqual({ rating: "fair", setBy: "method_default" })
    expect(fifteen.disclosures).toEqual(expect.arrayContaining(["eeio_upper_bound_proxy_includes_investee_upstream", "investee_data_unverified", "pcaf_style_score_1", "pcaf_style_score_2", "pcaf_style_score_4",
      "projected_lifetime_emissions_reported_separately", "revenue_economy_wide_price_index"]))
    expect(eleven.disclosures).toEqual(expect.arrayContaining(["biogenic_co2_reported_separately", "feedstock_not_combusted", "same_product_in_cat11_ghg_release", "use_phase_release_only", "reporting_year_grid_factor"]))
    expect(twelve.disclosures).toContain("same_product_in_cat11_ghg_release")
    expect([row(r.duster).plan.notes, row(r.dusterEnd).plan.notes, row(r.boxes).plan.notes, row(r.acUnit).plan.notes]).toEqual([["same_product_in_cat11_ghg_release"], ["same_product_in_cat11_ghg_release"], [], []])
    // The methodology: biogenic CO2 quantified, the lifetime boundary of 11, the memo item and the time boundary of 15, the proxy's uncertainty.
    const sentences = (row: typeof eleven) => result.coverage.categories[row.category - 1]!.methodology.map(s => s.text)
    expect(sentences(eleven)).toEqual(expect.arrayContaining([`Biogenic CO2 of ${scope3GroupDecimal(eleven.profile!.biogenicCo2!.display)} kg CO2 is reported separately, outside every total.`,
      "Use of sold products counts the expected lifetime use-phase emissions of the products sold in the reporting year."]))
    expect(sentences(fifteen).some(s => s.startsWith("Reported separately and not in any total: projected lifetime emissions"))).toBe(true)
    expect(sentences(fifteen)).toContain("Projected lifetime emissions of project finance are reported separately as memo items, never in the total.")
    expect(sentences(fifteen).some(s => s.startsWith("Factor source: Investee- or project-reported scope 1 and 2"))).toBe(true)
  }, TIMEOUT)

  test("the web's downstream fixture is this route's output on those records", async () => {
    const built = await build(Object.values(downstreamRecords()))
    const text = `${JSON.stringify(built, null, 2)}\n`
    if (process.env.NEUVETRA_UPDATE_SCOPE3_FIXTURE === "1") await Bun.write(FIXTURE, text)
    expect(await Bun.file(FIXTURE).text()).toBe(text)
  }, TIMEOUT)
})
