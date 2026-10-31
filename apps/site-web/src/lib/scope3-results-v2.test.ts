import { decodeScope3Results } from "@/lib/scope3-results-decode"
/* eslint-disable @typescript-eslint/no-explicit-any -- the mutation cases tamper with decoded responses field by field. */
// Scope 3 completion I-06 (DESIGN 4.6, 5.2, 6.2-6.4; assurance-ux M4, M6, M9): results v2 on the route's own output
// (scope3-results.fixture.json). The strict decoder refuses every tampered trace, profile, flag and methodology field; the
// CSV v2 sections document every column; and every calculated line is recomputed to 4 dp from the CSV text alone with exact
// rationals and the method's published formula (an assurer's re-performance), never from the engine's own figure.
import { describe, expect, test } from "bun:test"
import { SCOPE3_REPORT_TEXT_V3 } from "../../../../packages/neuvetra-database/src/scope3-text-v3"
import { readdirSync, readFileSync } from "node:fs"
import { kindLabel, periodLabel, QUALITY_LABELS, reasonText, shortUnit } from "./plain-language"
import { EVIDENCE_STATUS_TEXT, lastDayCovered } from "./results-api"
import * as web from "./scope3-results-api"
import { scope3Csv, type Scope3ResultsResponse } from "./scope3-results-api"
import * as shared from "../../../../packages/neuvetra-database/src/scope3-report-csv"
import { SCOPE3_CSV_SECTIONS, scope3CsvHeader, scope3LastDayCovered } from "../../../../packages/neuvetra-database/src/scope3-report-csv"
import { scope3MethodologyStatement } from "../../../../packages/neuvetra-database/src/scope3-methodology"
import { scope3RestampResults } from "../../../../packages/neuvetra-database/test-support/scope3-results-restamp"
import { scope3ReviewFlags } from "../../../../packages/neuvetra-database/src/scope3-trace"
import { SCOPE3_EVIDENCE_STATUS_TEXT, SCOPE3_METHODOLOGY_TOPICS } from "../../../../packages/neuvetra-database/src/scope3-text"

const fixture: Scope3ResultsResponse = await Bun.file(new URL("./scope3-results.fixture.json", import.meta.url)).json()
const company = fixture.companyId
const copy = (): any => structuredClone(fixture)
const labels = { kind: kindLabel, reason: reasonText, period: periodLabel, quality: (code: string) => QUALITY_LABELS[code] ?? code, unit: (code: string) => shortUnit(code) }
const decodes = (r: unknown) => { try { decodeScope3Results(r, company); return true } catch { return false } }
/** RFC 4180 reader (as scope3-results.test.ts). */
function parse(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') quoted = false; else cell += c; continue }
    if (c === '"' && cell === "") quoted = true
    else if (c === ",") { row.push(cell); cell = "" }
    else if (c === "\r" || c === "\n") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = "" }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}
const complete = (r: any) => r.records.filter((row: any) => row.outcome === "calculated" && row.result.status === "complete")
const lineOf = (r: any, kind: string) => r.records.find((row: any) => row.kind === kind && row.outcome === "calculated")
const profiled = (r: any) => r.coverage.categories.find((row: any) => row.category === 2)

describe("I-06: the fixture is the route's results v2", () => {
  test("every line carries its trace fields; every calculated category its profile; every category its methodology", () => {
    expect(decodes(fixture)).toBe(true)
    for (const row of fixture.records) {
      expect(typeof row.reference).toBe("string")
      expect("payload" in row).toBe(true)
      expect(row.derivedFrom === null).toBe(!["td_losses", "td_losses_upstream", "electricity_upstream", "fuel_upstream", "energy_resold_upstream", "hotel_stay"].includes(row.kind))
      expect(row.methodType === null).toBe(row.result === null)
      expect(row.effectiveDataQuality === null).toBe(row.result === null)
    }
    for (const row of fixture.coverage.categories) {
      expect(row.profile === null).toBe(row.subtotal === null)
      expect(row.methodology.length).toBeGreaterThan(0)
      expect(row.methodology.every(sentence => (SCOPE3_METHODOLOGY_TOPICS as readonly string[]).includes(sentence.topic))).toBe(true)
    }
    expect(fixture.registerSha256s).toEqual({ main: fixture.methods[0]!.registerSha256, spend: expect.stringMatching(/^[0-9a-f]{64}$/), supplement: expect.stringMatching(/^[0-9a-f]{64}$/), us_upstream: expect.stringMatching(/^[0-9a-f]{64}$/), building_hotel: expect.stringMatching(/^[0-9a-f]{64}$/) })
    expect(fixture.methods.every(method => typeof method.formula === "string" && method.title.length > 0)).toBe(true)
    // A19: the spend line's origin override is ignored (fixed by the method type); its temporal rating is the company's.
    const spend = lineOf(fixture, "purchase_spend")
    expect(spend.effectiveDataQuality.activityDataOrigin).toEqual({ origin: "company_records", setBy: "method_type" })
    expect(spend.effectiveDataQuality.indicators.temporal).toEqual({ rating: "very_good", setBy: "user" })
    expect(spend.effectiveDataQuality.indicators.technological).toEqual({ rating: "poor", setBy: "method_default" })
    // A20: the unverified supplier figure takes the unverified default for reliability.
    expect(lineOf(fixture, "purchase_supplier").effectiveDataQuality.indicators.reliability).toEqual({ rating: "fair", setBy: "method_default" })
    expect(lineOf(fixture, "td_losses").derivedFrom).toEqual({ recordId: lineOf(fixture, "td_losses").recordId, kind: "electricity" })
  })

  test("the web re-exports the one shared CSV module, so the API and this screen write the same bytes", () => {
    expect(web.scope3Csv).toBe(shared.scope3Csv)
    expect(web.scope3StatementLines).toBe(shared.scope3StatementLines)
    expect(scope3Csv(fixture, labels)).toBe(shared.scope3Csv(JSON.parse(JSON.stringify(fixture)), labels))
    // The shared module's evidence and date words are the Results screen's own.
    expect(SCOPE3_EVIDENCE_STATUS_TEXT).toEqual(EVIDENCE_STATUS_TEXT)
    for (const date of ["2026-01-01", "2025-03-01", "2024-03-01", "2025-07-15", "not a date"]) expect(scope3LastDayCovered(date)).toBe(lastDayCovered(date))
  })
})

describe("I-06: the decoder refuses a tampered trace, profile, flag or statement", () => {
  test("mutation cases", () => {
    const cases: Array<[string, (r: any) => void]> = [
      ["a line without its source reference", r => { delete r.records[0].reference }],
      ["a line without its payload", r => { delete r.records[0].payload }],
      ["a derived line that names no record", r => { lineOf(r, "td_losses").derivedFrom = null }],
      ["a derived line that names another record", r => { lineOf(r, "td_losses").derivedFrom.recordId = r.records[0].recordId }],
      ["a saved record that claims to be derived", r => { r.records[0].derivedFrom = { recordId: r.records[0].recordId, kind: "electricity" } }],
      ["a method type that isn't the catalog's", r => { lineOf(r, "transport").methodType = "supplier_specific" }],
      ["a method type on a line without a result", r => { r.records.find((row: any) => row.result === null).methodType = "spend_based" }],
      ["a data-quality rating the method doesn't default to", r => { lineOf(r, "transport").effectiveDataQuality.indicators.temporal.rating = "poor" }],
      ["a default shown as set by the user", r => { lineOf(r, "transport").effectiveDataQuality.indicators.temporal.setBy = "user" }],
      ["an origin override shown on a spend line (A19)", r => { lineOf(r, "purchase_spend").effectiveDataQuality.activityDataOrigin = { origin: "value_chain_partner", setBy: "user" } }],
      ["a verified default on an unverified supplier figure (A20)", r => { lineOf(r, "purchase_supplier").effectiveDataQuality.indicators.reliability.rating = "very_good" }],
      ["a payload rating that the effective data quality doesn't show", r => { lineOf(r, "purchase_spend").payload.dataQuality.indicators.geographical = "poor" }],
      ["data quality on a line without a result", r => { r.records.find((row: any) => row.result === null).effectiveDataQuality = lineOf(r, "transport").effectiveDataQuality }],
      ["a factor without its cell", r => { delete lineOf(r, "transport").result.factorsUsed[0].cell }],
      ["a constant that isn't one", r => { lineOf(r, "transport").result.constantsUsed[0] = null }],
      ["a conversion without its denominator", r => { delete lineOf(r, "waste").result.conversions[0].denominator }],
      ["a gas without its mass", r => { delete lineOf(r, "transport").result.gases.co2.mass }],
      ["a result naming another register", r => { lineOf(r, "transport").result.registerSha256 = "f".repeat(64) }],
      ["a result naming an unlisted additional register", r => { lineOf(r, "purchase_spend").result.additionalRegisters = [{ name: "spend", sha256: "e".repeat(64) }] }],
      ["no register list", r => { delete r.registerSha256s }],
      ["a register list without main", r => { delete r.registerSha256s.main }],
      ["a register list whose main isn't the methods'", r => { r.registerSha256s.main = "d".repeat(64) }],
      ["a method title that isn't the catalog's", r => { r.methods[0].title = "Something else" }],
      ["a method type that isn't the catalog's (method list)", r => { r.methods[0].methodType = "proxy" }],
      ["a formula that isn't text", r => { r.methods[0].formula = 7 }],
      ["a category without its profile key", r => { delete profiled(r).profile }],
      ["a profile where nothing is calculated", r => { r.coverage.categories[12].profile = profiled(r).profile }],
      ["no profile where something is calculated", r => { profiled(r).profile = null }],
      ["a profile with another tonnes figure", r => { profiled(r).profile.subtotalTonnes.display = "15.901" }],
      ["a profile method-type subtotal that isn't its lines' sum", r => { profiled(r).profile.methodTypes.spend_based.unrounded = "1"; profiled(r).profile.methodTypes.spend_based.display = "1.0000" }],
      ["a profile missing a method type", r => { delete profiled(r).profile.methodTypes.supplier_specific }],
      ["another dominant method type", r => { profiled(r).profile.dominantMethodType = "supplier_specific" }],
      ["a value-chain numerator that counts spend (A19)", r => { const n = profiled(r).profile.valueChain.numerator; n.unrounded = "15901.55962467977746"; n.display = "15901.5596" }],
      ["a value-chain share where the form is wrong", r => { profiled(r).profile.valueChain.percent.display = "22.79" }],
      ["a value-chain share over 100%", r => { profiled(r).profile.valueChain.percent.value = "122.8" }],
      ["a data-quality rating subtotal that isn't its lines' sum", r => { profiled(r).profile.dataQuality.indicators.reliability.ratingKg.fair.unrounded = "15901" }],
      ["a data-quality rating no line has", r => { const kg = profiled(r).profile.dataQuality.indicators.reliability.ratingKg; kg.good = kg.fair; delete kg.fair }],
      ["another override count", r => { profiled(r).profile.dataQuality.overrides = 2 }],
      ["an overall label that isn't a rating", r => { profiled(r).profile.dataQuality.overall.label = "excellent" }],
      ["a biogenic figure no line has", r => { profiled(r).profile.biogenicCo2 = { unrounded: "1", display: "1.0000", unit: "kg CO2", rounding: "half_even_4dp_once" } }],
      ["a memo item no line has", r => { profiled(r).profile.memoItems.projected = { unrounded: "1", display: "1.0000", unit: "kg CO2e", rounding: "half_even_4dp_once" } }],
      ["a profile with an unknown key", r => { profiled(r).profile.extra = 1 }],
      ["a profile with only some of the I-05 keys", r => { profiled(r).profile.deflationEffect = null }],
      ["review flags the profile does not give", r => { profiled(r).reviewFlags = ["category_over_half_of_known_total"] }],
      ["no review flags key", r => { delete profiled(r).reviewFlags }],
      ["a changed methodology sentence", r => { profiled(r).methodology[0].text = "Activities included: everything." }],
      ["a methodology sentence removed", r => { profiled(r).methodology.pop() }],
      ["a methodology sentence added", r => { profiled(r).methodology.push({ topic: "assumption", text: "Assumption or limitation: none." }) }],
      ["a methodology sentence under another topic", r => { profiled(r).methodology[0].topic = "method" }],
      ["no methodology", r => { delete r.coverage.categories[0].methodology }],
    ]
    expect(decodes(copy())).toBe(true)
    for (const [name, tamper] of cases) { const r = copy(); tamper(r); expect([name, decodes(r)]).toEqual([name, false]) }
  })

  test("the I-05 profile keys decode when all three are the engine's (sum and forms), and flags follow them", () => {
    // The engine adds the keys in I-05 (DESIGN 4.6). Built here by independent arithmetic on the fixture's category 2 lines:
    // deflation = nominal - deflated of the spend line; shares as percents of the known-source and category subtotals.
    const r = copy(), two = profiled(r), spend = lineOf(r, "purchase_spend")
    const deflation = sub(dec(spend.result.activity.nominalCo2e), dec(spend.result.total.unrounded))
    const share = (n: Q, d: Q, places: number) => ({ value: plain(roundHalfEven(div(mul(n, dec("100")), d), 12), 12), display: fixedText(roundHalfEven(div(mul(n, dec("100")), d), places), places) })
    const subtotal = dec(two.subtotal.unrounded), known = dec(r.coverage.knownSourceSubtotal.unrounded)
    Object.assign(two.profile, {
      deflationEffect: { unrounded: plain(deflation.n * 10n ** 20n / deflation.d, 20), display: fixedText(roundHalfEven(deflation, 4), 4), unit: "kg CO2e", rounding: "half_even_4dp_once" },
      shareOfKnownTotal: share(subtotal, known, 1), largestResultShare: share(dec(spend.result.total.unrounded), subtotal, 1),
    })
    // The flags follow the shares (I-12u: category 3's upstream lines bring category 2 under half of the known-source total).
    two.reviewFlags = scope3ReviewFlags(two.profile)
    scope3RestampResults(r) // round 2: every field the decoder re-derives from the lines
    expect(two.profile.deflationEffect.display).toBe("786.4629") // 13,063.0225 - 12,276.5596247 (nominal minus the line deflated with 0.939794723976)
    expect(decodes(r)).toBe(true)
    expect(two.methodology.find((s: any) => s.topic === "price_year" && s.text.startsWith("Price conversion effect")).text).toContain("786.4629 kg CO2e")
    const tampered: Array<[string, (x: any) => void]> = [
      ["deflation that isn't nominal minus deflated", x => { profiled(x).profile.deflationEffect.unrounded = "786"; profiled(x).profile.deflationEffect.display = "786.0000" }],
      ["a share over 100%", x => { profiled(x).profile.shareOfKnownTotal.value = "100.5" }],
      ["a share with a 2-decimal display", x => { profiled(x).profile.largestResultShare.display = "77.20" }],
      ["a flag the shares do not give", x => { profiled(x).reviewFlags = ["category_over_half_of_known_total", "largest_record_over_tenth_of_category"] }],
    ]
    for (const [name, tamper] of tampered) { const x = structuredClone(r); tamper(x); expect([name, decodes(x)]).toEqual([name, false]) }
  })

  test("integration wave 3: a response whose profiles lack all three I-05 keys is refused (the merged engine always sends them)", () => {
    // Otherwise consistent: no flags and the methodology regenerated without the keys, so only the missing keys can refuse it.
    const r = copy()
    for (const row of r.coverage.categories) {
      if (row.profile) for (const key of ["deflationEffect", "shareOfKnownTotal", "largestResultShare"]) delete row.profile[key]
      row.reviewFlags = []
    }
    scope3RestampResults(r) // round 2: every field the decoder re-derives from the lines
    expect(r.coverage.categories.filter((row: any) => row.profile).length).toBeGreaterThan(0)
    expect(decodes(r)).toBe(false)
  })
})

// --- Exact rationals for the recomputation (no floating point) ---
type Q = { n: bigint; d: bigint }
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a }
const norm = (q: Q): Q => { const g = gcd(q.n, q.d) || 1n; return { n: q.n / g, d: q.d / g } }
const dec = (text: string): Q => { const negative = text.startsWith("-"), [i, f = ""] = (negative ? text.slice(1) : text).split("."); return norm({ n: (negative ? -1n : 1n) * BigInt(i! + f), d: 10n ** BigInt(f.length) }) }
const mul = (a: Q, b: Q): Q => norm({ n: a.n * b.n, d: a.d * b.d })
const add = (a: Q, b: Q): Q => norm({ n: a.n * b.d + b.n * a.d, d: a.d * b.d })
const sub = (a: Q, b: Q): Q => add(a, { n: -b.n, d: b.d })
const div = (a: Q, b: Q): Q => norm({ n: a.n * b.d, d: a.d * b.n })
const same = (a: Q, b: Q) => a.n * b.d === b.n * a.d
function roundHalfEven(q: Q, places: number): bigint {
  const scaled = q.n * 10n ** BigInt(places), negative = scaled < 0n, magnitude = negative ? -scaled : scaled
  let units = magnitude / q.d
  const twice = 2n * (magnitude % q.d)
  if (twice > q.d || (twice === q.d && units % 2n === 1n)) units += 1n
  return negative ? -units : units
}
const fixedText = (units: bigint, places: number) => { const negative = units < 0n, digits = (negative ? -units : units).toString().padStart(places + 1, "0"); return `${negative ? "-" : ""}${digits.slice(0, -places)}.${digits.slice(-places)}` }
const plain = (units: bigint, places: number) => fixedText(units, places).replace(/\.?0+$/, "")

describe("I-06: CSV v2 (DESIGN 6.3) recomputes every calculated line from its own text", () => {
  const csv = scope3Csv(fixture, labels), rows = parse(csv)
  const meta = rows.filter(row => row[0]!.startsWith("#")).map(row => row[0]!)
  const headers = rows.filter(row => row[0] === "Section")
  /** A section's rows as objects keyed by its own header row (the sections come in SCOPE3_CSV_SECTIONS order). */
  const section = (name: typeof SCOPE3_CSV_SECTIONS[number]) => { const header = headers[SCOPE3_CSV_SECTIONS.indexOf(name)]!; return rows.filter(row => row[0] === name).map(row => Object.fromEntries(header.map((key, i) => [key, row[i]!]))) }
  /** kg to t by moving the point three places (no rounding), written independently of the CSV module. */
  const shift3 = (kg: string) => { const [whole, fraction = ""] = kg.split("."), digits = whole!.padStart(4, "0"); return `${digits.slice(0, -3).replace(/^0+(?=\d)/, "")}.${digits.slice(-3)}${fraction}` }

  test("every section and every column is documented in the # lines; the registers and each method's formula are named", () => {
    for (const name of SCOPE3_CSV_SECTIONS) {
      expect(meta.some(line => line.startsWith(`# Section ${name}: `))).toBe(true)
      for (const column of scope3CsvHeader(name)) expect([name, column, meta.some(line => line.startsWith(`# Column ${name}.${column}: `))]).toEqual([name, column, true])
    }
    for (const [name, sha] of Object.entries(fixture.registerSha256s)) expect(meta).toContain(`# Register ${name}: sha256 ${sha}`)
    for (const method of fixture.methods) expect(meta.some(line => line.startsWith(`# Method ${method.methodVersionId}: `) && line.includes(`Formula: ${method.formula}`))).toBe(true)
  })

  test("category rows: t CO2e is the engine's own figure, '—' where no share exists, the profile's DQ and method mix", () => {
    const categories = section("Category")
    expect(categories).toHaveLength(15)
    for (const [i, row] of fixture.coverage.categories.entries()) {
      const line = categories[i]!
      expect(line["Subtotal t CO2e"]).toBe(row.profile?.subtotalTonnes.display ?? "")
      expect(line["% from supplier/value-chain data"]).toBe(row.profile?.valueChain.percent ? `${row.profile.valueChain.percent.display}%` : "—")
      expect(line["Awaiting factor source"]).toBe(String(row.counts.methodPending))
    }
    const two = categories[1]!
    expect([two["Subtotal t CO2e"], two["% from supplier/value-chain data"], two["Dominant method type"]]).toEqual(["15.902", "22.8%", "spend-based"])
    expect(two["Method types"]).toBe("spend-based 12276.5596 kg; supplier-specific 3625.0000 kg")
    expect(two["Data quality (T/Ti/G/C/R/overall)"]).toBe("T 3.32 / Ti 1.23 / G 1.77 / C 2.77 / R 3.00 / overall good (2.42)")
    expect(categories[12]!["% from supplier/value-chain data"]).toBe("—")
    expect(categories[0]!["Reason code"]).toBe(fixture.coverage.categories[0]!.assessment!.reasonCode ?? "")
  })

  test("every calculated line is recomputed from the Record, Factor and Conversion sections to the engine's exact total and 4-dp display", () => {
    const records = section("Record"), factors = section("Factor"), conversions = section("Conversion")
    const unitOf = (key: string, type = "factor") => factors.find(row => row.Key === key && row.Type === type)!
    let recomputed = 0
    for (const row of records.filter(line => line["kg CO2e"] !== "")) {
      const keys = row["Factor keys"]!.split("; ").filter(Boolean), values = row["Factor values"]!.split("; ").filter(Boolean)
      expect(keys.length).toBe(values.length)
      const f = (suffix: string) => { const i = keys.findIndex(key => key.endsWith(suffix)); expect([row["Record ID"], suffix, i >= 0]).toEqual([row["Record ID"], suffix, true]); return dec(values[i]!) }
      const constant = (id: string) => { const m = new RegExp(`(?:^|; )${id.replace(/\./g, "\\.")} = ([0-9.]+) `).exec(row.Constants!); expect([id, !!m]).toEqual([id, true]); return dec(m![1]!) }
      const steps = conversions.filter(c => c["Record ID"] === row["Record ID"] && c.Kind === row.Kind)
      // Every division is re-performed: the result is the exact quotient rounded once, half-even, to 12 dp.
      for (const c of steps) expect(same(dec(c.Result!), { n: roundHalfEven(div(dec(c.Numerator!), dec(c.Denominator!)), 12), d: 10n ** 12n })).toBe(true)
      const input = JSON.parse(row["Engine input"]!), activity = JSON.parse(row["Engine activity"]!)
      const gwp = (gas: "CO2" | "CH4" | "N2O") => f(`gwp_ar5.${gas}`)
      const perGas = (amount: Q, base: string) => {
        // Hub Tables 8 and 10: CO2 in kg per unit; CH4 and N2O in g per unit (x 0.001 kg per g); CO2e with AR5 GWPs.
        expect(unitOf(keys.find(key => key.endsWith(".co2") && key.startsWith(base))!).Unit!.startsWith("kg CO2 per")).toBe(true)
        const g = constant("g_to_kg")
        return [mul(mul(amount, f(".co2")), gwp("CO2")), mul(mul(mul(amount, f(".ch4")), g), gwp("CH4")), mul(mul(mul(amount, f(".n2o")), g), gwp("N2O"))].reduce(add)
      }
      let kg: Q
      switch (row.Kind) {
        case "business_travel": case "employee_commuting":
          // activity = passenger-miles: segments x one-way miles for air by distance (input), else the quantity.
          if (input.segmentDistance) expect(same(dec(activity.amount), mul(dec(input.segmentDistance.value), { n: BigInt(input.passengerSegments), d: 1n }))).toBe(true)
          else expect(activity.amount).toBe(input.activity.value)
          kg = perGas(dec(activity.amount), "travel."); break
        case "transport":
          expect(activity.amount).toBe(input.activity.value) // short ton-miles as entered
          kg = perGas(dec(activity.amount), "transport."); break
        case "waste": {
          // short tons = metric tons x 1000 / (0.45359237 x 2000); kg CO2e = short tons x factor (t CO2e per short ton) x 1000.
          expect(same(dec(steps[0]!.Numerator!), mul(dec(input.quantity), constant("metric_ton_to_kg")))).toBe(true)
          expect(same(dec(steps[0]!.Denominator!), mul(constant("lb_to_kg"), constant("lb_per_short_ton")))).toBe(true)
          kg = mul(mul(dec(steps[0]!.Result!), f(`waste.${input.material}.${input.treatment}`)), constant("metric_ton_to_kg")); break
        }
        case "td_losses": {
          // loss MWh = MWh x GGL / (1 - GGL) (12 dp); kg gas = loss MWh x subregion rate (lb/MWh) x 0.45359237; CO2e with AR5 GWPs.
          const mwh = mul(dec(input.quantity), constant("kwh_to_mwh")), ggl = f(`egrid2023_ggl.${activity.interconnect}`)
          expect(same(dec(steps[0]!.Numerator!), mul(mwh, ggl))).toBe(true)
          expect(same(dec(steps[0]!.Denominator!), sub(dec("1"), ggl))).toBe(true)
          const loss = dec(steps[0]!.Result!), lb = constant("lb_to_kg")
          kg = [mul(mul(mul(loss, f(`egrid2023.${input.subregion}.co2`)), lb), gwp("CO2")), mul(mul(mul(loss, f(`egrid2023.${input.subregion}.ch4`)), lb), gwp("CH4")),
            mul(mul(mul(loss, f(`egrid2023.${input.subregion}.n2o`)), lb), gwp("N2O"))].reduce(add); break
        }
        case "purchase_spend": {
          // kg CO2e = amount (USD) x factor (kg CO2e per 2022 USD) x r; r = I2022 / I(dollar year), 12 dp (none for 2022 dollars).
          const factor = f(`epa_scghg_v130.${input.naicsCode}.${input.marginChoice}`)
          if (input.dollarYear === 2022) { expect(steps).toHaveLength(0); kg = mul(dec(input.amount), factor) } else {
            expect(same(dec(steps[0]!.Numerator!), constant("price_index.gdp_deflator.2022"))).toBe(true)
            expect(same(dec(steps[0]!.Denominator!), constant(`price_index.gdp_deflator.${input.dollarYear}`))).toBe(true)
            kg = mul(mul(dec(input.amount), factor), dec(steps[0]!.Result!))
          }
          break
        }
        case "purchase_supplier": {
          // Allocated total: supplier kg CO2e (metric tons x 1000) x numerator / denominator (12 dp), or x 1.
          expect(input.basis).toBe("allocated_total")
          const total = input.unit === "metric_ton CO2e" ? mul(dec(input.quantity), dec("1000")) : dec(input.quantity)
          expect(same(dec(steps[0]!.Numerator!), dec(input.allocationNumerator))).toBe(true)
          expect(same(dec(steps[0]!.Denominator!), dec(input.allocationDenominator))).toBe(true)
          kg = mul(total, dec(steps[0]!.Result!)); break
        }
        // I-12u: category 3 upstream. NETL kg per MMBtu = g/MJ x 1055.05585262 MJ/MMBtu x 0.001 (the CSV lists all three).
        case "electricity_upstream": case "td_losses_upstream": {
          // MWh (consumed, or lost exactly as 3C: the first division) x round12(gas heat input / net generation) x NETL transmission.
          const netl = constant("us_upstream_const.ng_upstream_transmission_kg_per_mmbtu_hhv")
          expect(same(netl, mul(mul(f("netl2024_4862.ng_upstream.prod_through_transmission"), constant("us_upstream_const.mj_per_mmbtu")), dec("0.001")))).toBe(true)
          const losses = row.Kind === "td_losses_upstream"
          const mwh = losses ? dec(steps[0]!.Result!) : mul(dec(input.quantity), constant("kwh_to_mwh"))
          // Round 2 (owner decision 2): + round12(oil heat input / net generation) x the oil factor, itself listed as a division:
          // CA-GREET3.0 ULSD upstream x LCFS diesel energy density x 0.001 / Hub distillate No. 2 heat content (12 dp).
          // Round 2, lane F (DESIGN 13.6): coal comes first (fuels in code order): + round12(coal heat input / net generation) x the coal
          // factor, itself listed as a division: GHGI coal mining CH4 (MMT CO2e) x 10^9 / (EIA production (thousand st) x 1000 x heat content).
          const at = losses ? 1 : 0
          const coalRatio = steps[at]!, coalFactor = steps[at + 1]!, ratio = steps[at + 2]!, oilRatio = steps[at + 3]!, oilFactor = steps[at + 4]!
          expect(same(dec(coalRatio.Numerator!), f(`egrid2023_hi.${input.subregion}.COAL`))).toBe(true)
          expect(same(dec(coalRatio.Denominator!), f(`egrid2023_gen.${input.subregion}`))).toBe(true)
          expect(same(dec(coalFactor.Numerator!), mul(f("epa_ghgi.2022.coal_mining_ch4_total"), constant("us_upstream_const.kg_per_million_metric_tons")))).toBe(true)
          expect(same(dec(coalFactor.Denominator!), mul(mul(f("eia.2022.coal_production_short_tons"), constant("us_upstream_const.short_tons_per_thousand_short_tons")), f("eia.2022.coal_heat_content_production")))).toBe(true)
          expect(same(dec(coalFactor.Result!), constant("us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv"))).toBe(true)
          expect(same(dec(ratio.Numerator!), f(`egrid2023_hi.${input.subregion}.GAS`))).toBe(true)
          expect(same(dec(ratio.Denominator!), f(`egrid2023_gen.${input.subregion}`))).toBe(true)
          expect(same(dec(oilRatio.Numerator!), f(`egrid2023_hi.${input.subregion}.OIL`))).toBe(true)
          expect(same(dec(oilRatio.Denominator!), f(`egrid2023_gen.${input.subregion}`))).toBe(true)
          expect(same(dec(oilFactor.Numerator!), mul(mul(f("cagreet3_lut2018.ulsd.upstream"), f("carb_lcfs.energy_density.ulsd")), constant("g_to_kg")))).toBe(true)
          expect(same(dec(oilFactor.Denominator!), f("hub2025_t1.distillate_fuel_oil_no_2.heat_content"))).toBe(true)
          kg = add(add(mul(mul(mwh, dec(ratio.Result!)), netl), mul(mul(mwh, dec(oilRatio.Result!)), dec(oilFactor.Result!))), mul(mul(mwh, dec(coalRatio.Result!)), dec(coalFactor.Result!))); break
        }
        case "fuel_upstream": {
          // Natural gas in therms: MMBtu = therms x 0.1 (as Scope 1) x NETL production through distribution.
          expect([input.source, input.unit]).toEqual(["natural_gas", "therm"])
          const netl = constant("us_upstream_const.ng_upstream_distribution_kg_per_mmbtu_hhv")
          expect(same(netl, mul(mul(f("netl2024_4862.ng_upstream.prod_through_distribution"), constant("us_upstream_const.mj_per_mmbtu")), dec("0.001")))).toBe(true)
          kg = mul(mul(dec(input.quantity), constant("supplement_const.therm_to_mmbtu")), netl); break
        }
        default: throw new Error(`No recomputation for ${row.Kind}`)
      }
      expect([row["Record ID"], row.Kind, same(kg, dec(row["kg CO2e unrounded"]!))]).toEqual([row["Record ID"], row.Kind, true])
      expect([row["Record ID"], fixedText(roundHalfEven(kg, 4), 4)]).toEqual([row["Record ID"], row["kg CO2e"]])
      recomputed++
    }
    expect(recomputed).toBe(complete(fixture).length)
    expect(new Set(records.filter(line => line["kg CO2e"] !== "").map(line => line.Kind))).toEqual(new Set(["business_travel", "employee_commuting", "transport", "waste", "td_losses", "purchase_spend", "purchase_supplier",
      "td_losses_upstream", "electricity_upstream", "fuel_upstream"]))
  })

  test("every factor and constant in the CSV resolves to its verified register entry with the same value", () => {
    // Every Scope 3 register file (R1, R2, and any later one such as I-05's supplement register).
    const directory = new URL("../../../../packages/neuvetra-database/src/method-reference/", import.meta.url)
    const names = readdirSync(directory).filter(name => /^verified-scope3-.*\.json$/.test(name) && !name.endsWith('.provenance.json'))  // round 2: R6's provenance sidecar is not a register
    expect(names).toEqual(expect.arrayContaining(["verified-scope3-register-2025.json", "verified-scope3-spend-register-epa-scghg-v1.3.json"]))
    const registers = names.map(name => JSON.parse(readFileSync(new URL(name, directory), "utf8")))
    const factors = section("Factor")
    expect(factors.length).toBeGreaterThan(10)
    for (const row of factors) {
      const pool = registers.flatMap(register => row.Type === "factor" ? register.entries : register.constants)
      const entry = pool.find((item: any) => item.id === row.Key)
      expect([row.Key, entry?.value, entry?.unit, row.Type === "factor" ? entry?.valueCell : ""]).toEqual([row.Key, row.Value, row.Unit, row.Cell])
    }
  })

  test("methodology, exclusion, mapping and total sections", () => {
    const methodology = section("Methodology")
    expect(methodology.map(row => [Number(row.Category), row.Topic, row.Sentence])).toEqual(fixture.coverage.categories.flatMap(row => row.methodology.map(sentence => [row.category, sentence.topic, sentence.text])))
    const exclusions = section("Exclusion")
    expect(exclusions.map(row => [row.Category, row.Level, row.Decision])).toEqual([["1", "category", "Excluded"], ["12", "category", "Excluded"]])
    expect(exclusions[0]!["Estimated magnitude t CO2e"]).toBe(fixture.coverage.categories[0]!.assessment!.magnitudeTCo2e ?? "")
    expect(section("Mapping")).toEqual([{ Section: "Mapping", Category: "2", "NAICS code": "325211", "NAICS title": "Plastics Material and Resin Manufacturing", "Margin choice": "with_margins", "Mapping source": "user", Lines: "1",
      "Record IDs": lineOf(fixture, "purchase_spend").recordId, "Superseded rows": "",
      // I-09: the line's amount (activity data) per currency; an entered line has no import row and no duplicate reference.
      "Amount by currency": `USD ${lineOf(fixture, "purchase_spend").quantity.value}`, "Import rows": "", "Possible duplicates held": "" }])
    const [total] = section("Total")
    expect(total).toEqual({ Section: "Total", Label: "Known-source Scope 3 subtotal (known sources only)", "kg CO2e": fixture.coverage.knownSourceSubtotal!.display,
      "t CO2e": shift3(fixture.coverage.knownSourceSubtotal!.display),
      "Includes categories": fixture.coverage.categories.filter(row => row.subtotal).map(row => row.category).join("; "),
      "Does not include": fixture.coverage.categories.filter(row => !row.subtotal).map(row => `${row.category} (${(SCOPE3_REPORT_TEXT_V3.status[row.status] ?? web.SCOPE3_STATUS_TEXT[row.status]).toLowerCase()})`).join("; "), Basis: "known sources only" })
  })

  test("a documented exclusion within a category is listed in the register and the CSV, never in a total", () => {
    const r = copy(), four = r.coverage.categories[3]
    four.assessment.withinCategoryExclusions = [{ noteCode: "third_party_facilities_not_included", justification: "One shared cross-dock.", magnitudeKind: "estimated", magnitudeTCo2e: "0.4", basis: "Throughput share." }]
    four.disclosures = [...four.disclosures, "within_category_exclusion_documented"].sort()
    expect(decodes(structuredClone(r))).toBe(false) // the statement must mention the documented exclusion
    four.methodology = scope3MethodologyStatement(four, r.records, r.coverage.categories)
    const decoded = decodeScope3Results(r, company)
    const rows = parse(scope3Csv(decoded, labels)).filter(row => row[0] === "Exclusion")
    expect(rows.find(row => row[3] === "within_category")!.slice(0, 13)).toEqual(["Exclusion", "4", decoded.coverage.categories[3]!.title, "within_category", "Included", "", "third_party_facilities_not_included", "", "One shared cross-dock.", "estimated", "0.4", "Throughput share.", ""])
    expect(decoded.coverage.categories[3]!.methodology.some(sentence => sentence.topic === "exclusion" && sentence.text.includes("0.4 t CO2e") && sentence.text.includes("never added to any total"))).toBe(true)
    expect(decoded.coverage.knownSourceSubtotal).toEqual(fixture.coverage.knownSourceSubtotal)
  })
})
/* eslint-enable @typescript-eslint/no-explicit-any */

test('v3 currency provenance is accepted only when bound to the saved USD amount', () => {
  const r=copy(), line=lineOf(r,'purchase_spend')
  line.currencyConversion={currency:'EUR',amount:'10000.4',rate:'1.25',usd:'12500.5',rateSource:'ECB reference',rateDate:'2025-02-03'}
  expect(decodeScope3Results(r,company).records.find(row=>row.kind==='purchase_spend')!.currencyConversion).toEqual(line.currencyConversion)
  for(const change of [{rate:'2'}, {usd:'12500.6'}, {rateDate:'2025-02-30'}, {currency:'USD'}, {rateSource:''}, {amount:'1e4'}, {extra:'unrecognized'}]) {
    const bad=structuredClone(r);Object.assign(lineOf(bad,'purchase_spend').currencyConversion!,change)
    expect(()=>decodeScope3Results(bad,company)).toThrow()
  }
})
