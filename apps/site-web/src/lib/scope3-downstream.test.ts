import { decodeScope3Results } from "@/lib/scope3-results-decode"
import { scope3GroupDecimal } from "../../../../packages/neuvetra-database/src/scope3-text-v3"
/* eslint-disable @typescript-eslint/no-explicit-any -- the mutation cases tamper with decoded responses field by field. */
// Scope 3 completion I-07 (DESIGN 4.4, 4.6, 5.2, 6.2-6.4; assurance-ux M4, M6, M9): categories 11, 12 and 15 on the web, on the
// route's own output (scope3-results-downstream.fixture.json, written by the site-api downstream route test). Every calculated
// line is recomputed to 4 dp from the CSV text alone with exact rationals and the method's published formula: fuels sold
// (Hub Table 1), energy-using products (eGRID2023 rev2 or Table 1), greenhouse-gas products (Tables 11 and 12), end of life by
// treatment split (Table 9) and investments (investee-reported, or EPA SC v1.3 x the price ratio). Biogenic CO2 and memo items
// are reported beside the totals, never in them, and the decoder refuses a response that folds them in or bends their shapes.
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { kindLabel, periodLabel, QUALITY_LABELS, reasonText, shortUnit } from "./plain-language"
import { scope3Csv, type Scope3ResultsResponse } from "./scope3-results-api"
import { SCOPE3_CSV_SECTIONS } from "../../../../packages/neuvetra-database/src/scope3-report-csv"
import { scope3MethodologyStatement } from "../../../../packages/neuvetra-database/src/scope3-methodology"

const fixture: Scope3ResultsResponse = await Bun.file(new URL("./scope3-results-downstream.fixture.json", import.meta.url)).json()
const company = fixture.companyId
const copy = (): any => structuredClone(fixture)
const labels = { kind: kindLabel, reason: reasonText, period: periodLabel, quality: (code: string) => QUALITY_LABELS[code] ?? code, unit: (code: string) => shortUnit(code) }
const decodes = (r: unknown) => { try { decodeScope3Results(r, company); return true } catch { return false } }
const I07_KINDS = ["sold_fuel", "sold_energy_product", "sold_ghg_product", "end_of_life_split", "investment"]
const lineOf = (r: any, kind: string, test: (row: any) => boolean = () => true) => r.records.find((row: any) => row.kind === kind && row.outcome === "calculated" && row.result.status === "complete" && test(row))
const biogenicLine = (r: any) => lineOf(r, "sold_fuel", (row: any) => !!row.result.biogenicCo2)
const memoLine = (r: any) => lineOf(r, "investment", (row: any) => !!row.result.memoItems)
const category = (r: any, n: number) => r.coverage.categories[n - 1]

// The register files, read here (never through the engine or the CSV module), for the classification and the constant bases.
const directory = new URL("../../../../packages/neuvetra-database/src/method-reference/", import.meta.url)
const registers = readdirSync(directory).filter(name => /^verified-scope3-.*\.json$/.test(name) && !name.endsWith('.provenance.json')).map(name => JSON.parse(readFileSync(new URL(name, directory), "utf8")))
const registerEntry = (key: string, type: "factor" | "constant") => registers.flatMap(register => type === "factor" ? register.entries : register.constants).find((item: any) => item.id === key)

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

// --- Exact rationals (no floating point) ---
type Q = { n: bigint; d: bigint }
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a }
const norm = (q: Q): Q => { const g = gcd(q.n, q.d) || 1n; return { n: q.n / g, d: q.d / g } }
const dec = (text: string): Q => { const negative = text.startsWith("-"), [i, f = ""] = (negative ? text.slice(1) : text).split("."); return norm({ n: (negative ? -1n : 1n) * BigInt(i! + f), d: 10n ** BigInt(f.length) }) }
const mul = (...xs: Q[]): Q => xs.reduce((a, b) => norm({ n: a.n * b.n, d: a.d * b.d }), { n: 1n, d: 1n })
const add = (...xs: Q[]): Q => xs.reduce((a, b) => norm({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }), { n: 0n, d: 1n })
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
const r12 = (q: Q): Q => ({ n: roundHalfEven(q, 12), d: 10n ** 12n })

describe("I-07: the downstream fixture is the route's output for every new kind", () => {
  test("it decodes; every I-07 kind is calculated and held; categories 11, 12 and 15 carry their profiles, biogenic CO2 and memo items", () => {
    expect(decodes(fixture)).toBe(true)
    for (const kind of I07_KINDS) expect([kind, !!lineOf(fixture, kind)]).toEqual([kind, true])
    expect(fixture.records.filter(row => row.result?.status === "input_needed").map(row => [row.kind, row.result!.findings])).toEqual([["end_of_life_split", ["treatment_split_unknown"]], ["sold_energy_product", ["use_region_outside_us"]]])
    expect([category(fixture, 11).status, category(fixture, 12).status, category(fixture, 15).status]).toEqual(["input_needed", "input_needed", "calculated"])
    expect(category(fixture, 11).profile.biogenicCo2.unrounded).toBe(biogenicLine(fixture).result.biogenicCo2.mass)
    expect(category(fixture, 15).profile.memoItems).toEqual({ projected_lifetime_emissions: expect.objectContaining({ unrounded: memoLine(fixture).result.memoItems[0].kg, unit: "kg CO2e" }) })
    expect(memoLine(fixture).result.memoItems[0].reportedSeparately).toBe(true)
    for (const row of fixture.coverage.categories) expect(row.methodology).toEqual(scope3MethodologyStatement(row, fixture.records, fixture.coverage.categories))
  })
})

describe("I-07: CSV v2 recomputes every downstream line from its own text; biogenic CO2 and memo items stay outside every total", () => {
  const csv = scope3Csv(fixture, labels), rows = parse(csv)
  const headers = rows.filter(row => row[0] === "Section")
  const section = (name: typeof SCOPE3_CSV_SECTIONS[number]) => { const header = headers[SCOPE3_CSV_SECTIONS.indexOf(name)]!; return rows.filter(row => row[0] === name).map(row => Object.fromEntries(header.map((key, i) => [key, row[i]!]))) }
  const records = section("Record"), conversions = section("Conversion"), categories = section("Category")

  test("every calculated line: the published formula on the Record, Factor and Conversion text gives the engine's exact total and 4-dp display", () => {
    let recomputed = 0
    const memo = new Map<string, Q>(), biogenicByCategory = new Map<string, Q>()
    for (const row of records.filter(line => line["kg CO2e"] !== "")) {
      const keys = row["Factor keys"]!.split("; ").filter(Boolean), values = row["Factor values"]!.split("; ").filter(Boolean)
      expect(keys.length).toBe(values.length)
      const f = (key: string) => { const i = keys.indexOf(key); expect([row["Record ID"], key, i >= 0]).toEqual([row["Record ID"], key, true]); return dec(values[i]!) }
      const constant = (id: string) => { const m = new RegExp(`(?:^|; )${id.replace(/\./g, "\\.")} = ([0-9.]+) `).exec(row.Constants!); expect([id, !!m]).toEqual([id, true]); return dec(m![1]!) }
      const steps = conversions.filter(c => c["Record ID"] === row["Record ID"] && c.Kind === row.Kind)
      // Every division is re-performed: the exact quotient rounded once, half-even, to 12 dp.
      for (const c of steps) expect(same(dec(c.Result!), r12(div(dec(c.Numerator!), dec(c.Denominator!))))).toBe(true)
      const input = JSON.parse(row["Engine input"]!)
      /** Hub Table 1: CO2 in kg per MMBtu, CH4 and N2O in g per MMBtu (x 0.001), AR5 GWPs. A biomass fuel's CO2 (Hub section "Biomass Fuels") is biogenic. */
      const combustion = (mmbtu: Q, fuel: string) => {
        const base = `hub2025_t1.${fuel}`
        const co2 = mul(mmbtu, f(`${base}.co2`), f("gwp_ar5.CO2"))
        const others = add(...(["ch4", "n2o"] as const).map(g => mul(mmbtu, f(`${base}.${g}`), constant("g_to_kg"), f(`gwp_ar5.${g.toUpperCase()}`))))
        const biomass = String(registerEntry(`${base}.co2`, "factor").table).includes("Biomass")
        if (biomass) {
          expect([row["Record ID"], same(mul(mmbtu, f(`${base}.co2`)), dec(row["Biogenic CO2 kg"]!))]).toEqual([row["Record ID"], true])
          biogenicByCategory.set(row.Category!, add(biogenicByCategory.get(row.Category!) ?? dec("0"), dec(row["Biogenic CO2 kg"]!)))
          expect(row.Gases!.split("; ").some(text => text.startsWith("CO2 "))).toBe(false)
          return others
        }
        expect(row["Biogenic CO2 kg"]).toBe("")
        return add(co2, others)
      }
      const energy = (amount: Q, unit: string, fuel: string) => unit === "MMBtu" ? amount : mul(amount, f(`hub2025_t1.${fuel}.heat_content`))
      let kg: Q
      switch (row.Kind) {
        case "sold_fuel":
          // Calculation guidance [11.2]: fuel sold x its combustion factors; a feedstock not combusted in use is a known zero.
          if (input.combustedInUse === "no_feedstock") { expect(keys).toEqual([]); kg = dec("0"); break }
          kg = combustion(energy(dec(input.quantity), input.unit, input.fuel), input.fuel); break
        case "sold_energy_product": {
          // [11.1]: units sold x lifetime (years or uses) x energy per year or use; electricity x the U.S. or subregion eGRID rate (lb/MWh x 0.45359237).
          const lifetime = mul(dec(input.quantity), dec(input.lifetimeQuantity), dec(input.energyPerBasis))
          if (input.energyCarrier === "electricity") {
            const mwh = input.energyUnit === "kWh" ? mul(lifetime, constant("kwh_to_mwh")) : lifetime
            const prefix = input.useRegion === "US" ? "egrid2023_us" : `egrid2023.${input.useRegion}`
            kg = add(...(["co2", "ch4", "n2o"] as const).map(g => mul(mwh, f(`${prefix}.${g}`), constant("lb_to_kg"), f(`gwp_ar5.${g.toUpperCase()}`))))
          } else kg = combustion(energy(lifetime, input.energyUnit, input.energyCarrier), input.energyCarrier)
          break
        }
        case "sold_ghg_product": {
          // [11.3]: units sold x charge per unit (kg, or lb x 0.45359237) x share released in use x AR5 GWP (Hub Table 11 or 12).
          const perUnit = input.chargeUnit === "kg" ? dec(input.chargePerUnit) : mul(dec(input.chargePerUnit), constant("lb_to_kg"))
          kg = mul(dec(input.quantity), perUnit, div(dec(input.useReleasePercent), dec("100")), f(`hub2025_gwp.${input.gas}`)); break
        }
        case "end_of_life_split": {
          // [12.1]: short tons x each treatment's share x the Hub Table 9 factor (t CO2e per short ton) x 1000.
          let tons: Q
          if (input.unit === "short_ton") { expect(steps).toHaveLength(0); tons = dec(input.quantity) } else {
            const numerator = input.unit === "metric_ton" ? mul(dec(input.quantity), constant("metric_ton_to_kg")) : dec(input.quantity)
            expect(same(dec(steps[0]!.Numerator!), numerator)).toBe(true)
            expect(same(dec(steps[0]!.Denominator!), input.unit === "lb" ? constant("lb_per_short_ton") : mul(constant("lb_to_kg"), constant("lb_per_short_ton")))).toBe(true)
            tons = dec(steps[0]!.Result!)
          }
          const shares = Object.entries(input.split as Record<string, string>).filter(([, share]) => !same(dec(share), dec("0")))
          expect(same(add(...Object.values(input.split as Record<string, string>).map(dec)), dec("100"))).toBe(true)
          kg = add(...shares.map(([treatment, share]) => mul(tons, div(dec(share), dec("100")), f(`waste.${input.material}.${treatment}`), constant("metric_ton_to_kg")))); break
        }
        case "investment": {
          // [15.1]/[15.3]: the attribution share (outstanding / denominator, or equity % / 100, 12 dp) x investee scope 1+2 (t x 1000);
          // [15.2]-style proxy: investee revenue x EPA SC v1.3 (without margins, 2022 USD) x I2022 / I(revenue year) x the share.
          const a = input.attribution
          expect(same(dec(steps[0]!.Numerator!), dec(a.basis === "equity_share_percent" ? a.percent : input.outstandingAmount))).toBe(true)
          expect(same(dec(steps[0]!.Denominator!), dec(a.basis === "equity_share_percent" ? "100" : a.denominator))).toBe(true)
          const share = dec(steps[0]!.Result!)
          if (input.path === "revenue_eeio") {
            const factor = f(`epa_scghg_v130.${input.naicsCode}.without_margins`)
            if (input.revenueYear === 2022) { expect(steps).toHaveLength(1); kg = mul(dec(input.revenue), factor, share) } else {
              expect(same(dec(steps[1]!.Numerator!), constant("price_index.gdp_deflator.2022"))).toBe(true)
              expect(same(dec(steps[1]!.Denominator!), constant(`price_index.gdp_deflator.${input.revenueYear}`))).toBe(true)
              kg = mul(dec(input.revenue), factor, dec(steps[1]!.Result!), share)
            }
          } else { expect(keys).toEqual([]); kg = mul(dec(input.investeeEmissions), constant("metric_ton_to_kg"), share) }
          // Calculation guidance p.151-152: projected lifetime emissions x the share, a memo item reported separately.
          if (input.projectedAnnual !== null) memo.set(row.Category!, add(memo.get(row.Category!) ?? dec("0"), mul(dec(input.projectedAnnual), constant("metric_ton_to_kg"), dec(String(input.lifetimeYears)), share)))
          break
        }
        default: throw new Error(`No recomputation for ${row.Kind}`)
      }
      expect([row["Record ID"], row.Kind, same(kg, dec(row["kg CO2e unrounded"]!))]).toEqual([row["Record ID"], row.Kind, true])
      expect([row["Record ID"], fixedText(roundHalfEven(kg, 4), 4)]).toEqual([row["Record ID"], row["kg CO2e"]])
      recomputed++
    }
    expect(recomputed).toBe(fixture.records.filter(row => row.result?.status === "complete").length)
    expect(new Set(records.filter(line => line["kg CO2e"] !== "").map(line => line.Kind))).toEqual(new Set(I07_KINDS))
    // Biogenic CO2: the category column is the sum of the lines' column; the memo item is the projection x the share; neither is in a total.
    expect([...biogenicByCategory.keys()]).toEqual(["11"])
    expect(categories[10]!["Biogenic CO2 kg (outside totals)"]).toBe(fixedText(roundHalfEven(biogenicByCategory.get("11")!, 4), 4))
    expect([...memo.keys()]).toEqual(["15"])
    expect(categories[14]!["Memo items"]).toBe(`projected_lifetime_emissions ${fixedText(roundHalfEven(memo.get("15")!, 4), 4)} kg`)
    for (const n of [12]) expect([categories[n - 1]!["Biogenic CO2 kg (outside totals)"], categories[n - 1]!["Memo items"]]).toEqual(["", ""])
    const counted = add(...records.filter(line => line["kg CO2e unrounded"] !== "").map(line => dec(line["kg CO2e unrounded"]!)))
    const [total] = section("Total")
    expect(total!["kg CO2e"]).toBe(fixedText(roundHalfEven(counted, 4), 4))
    for (const n of ["11", "12", "15"]) expect([n, categories[Number(n) - 1]!["Subtotal kg CO2e"]]).toEqual([n, fixedText(roundHalfEven(add(...records.filter(line => line.Category === n && line["kg CO2e unrounded"] !== "").map(line => dec(line["kg CO2e unrounded"]!))), 4), 4)])
  })

  test("Factor section: every factor and constant is its register entry and names its source; unit constants name their definition and basis", () => {
    const factors = section("Factor")
    expect(factors.length).toBeGreaterThan(20)
    for (const row of factors) {
      const entry = registerEntry(row.Key!, row.Type as "factor" | "constant")
      expect([row.Key, entry?.value, entry?.unit, row.Type === "factor" ? entry?.valueCell : ""]).toEqual([row.Key, row.Value, row.Unit, row.Cell])
      expect([row.Key, row.Source !== "" && row["Source document"] !== ""]).toEqual([row.Key, true])
      if (row.Type === "constant" && !row.Key!.startsWith("price_index.")) expect([row.Key, row.Source, row["Source document"]]).toEqual([row.Key, "unit_definition", `Unit definition (not an emission factor): ${entry.basis}`])
    }
    const sourceOf = (prefix: string) => [...new Set(factors.filter(row => row.Key!.startsWith(prefix)).map(row => row.Source))]
    expect(sourceOf("gwp_ar5.")).toEqual(["epa_ghg_hub_2025"])
    expect(sourceOf("price_index.")).toEqual(["fred_gdp_deflator"])
    expect(sourceOf("epa_scghg_v130.")).toEqual(["epa_scghg_v1_3"])
    for (const prefix of ["hub2025_t1.", "hub2025_gwp.", "egrid2023_us.", "egrid2023.", "waste."]) expect([prefix, sourceOf(prefix).length]).toEqual([prefix, 1])
  })

  test("the methodology states biogenic CO2, the use-phase time boundary, the memo item and the overlap, on screen text and in the CSV", () => {
    const methodology = section("Methodology")
    const sentences = (n: number) => methodology.filter(row => row.Category === String(n)).map(row => row.Sentence)
    expect(sentences(11)).toContain(`Biogenic CO2 of ${scope3GroupDecimal(category(fixture, 11).profile.biogenicCo2.display)} kg CO2 is reported separately, outside every total.`)
    expect(sentences(11)).toContain("Use of sold products counts the expected lifetime use-phase emissions of the products sold in the reporting year.")
    expect(sentences(15)).toContain(`Reported separately and not in any total: projected lifetime emissions, ${scope3GroupDecimal(category(fixture, 15).profile.memoItems.projected_lifetime_emissions.display)} kg CO2e.`)
    expect(sentences(15)).toContain("Projected lifetime emissions of project finance are reported separately as memo items, never in the total.")
    for (const n of [11, 12]) expect(sentences(n).some(text => text!.startsWith("Assumption or limitation:") && text!.includes("released in full during use (category 11)"))).toBe(true)
  })
})

describe("I-07: the decoder refuses biogenic CO2 or memo items folded into a total, or in another shape", () => {
  test("mutation cases", () => {
    const fold = (r: any) => {
      // The biogenic CO2 folded into the line's total, its category subtotal and the known-source total.
      const line = biogenicLine(r), bio = line.result.biogenicCo2.mass
      const plus = (x: any) => { const v = add(dec(x.unrounded), dec(bio)); x.unrounded = fixedText(roundHalfEven(v, 12), 12).replace(/\.?0+$/, ""); x.display = fixedText(roundHalfEven(v, 4), 4) }
      plus(line.result.total); plus(category(r, 11).subtotal); plus(r.coverage.knownSourceSubtotal)
    }
    const cases: Array<[string, (r: any) => void]> = [
      ["biogenic CO2 folded into the totals", fold],
      ["biogenic CO2 also shown as a CO2 gas (CO2e 0, total unchanged)", r => { const line = biogenicLine(r); line.result.gases.co2 = { mass: line.result.biogenicCo2.mass, massUnit: "kg CO2", co2e: "0", co2eUnit: "kg CO2e" } }],
      ["a gas CO2e that the total doesn't add up to", r => { biogenicLine(r).result.gases.ch4.co2e = "1" }],
      ["a CO2e-only component that the total doesn't add up to", r => { lineOf(r, "sold_ghg_product").result.co2eWithoutGasSplit.co2e = "1" }],
      ["biogenic CO2 in kg CO2e", r => { biogenicLine(r).result.biogenicCo2.massUnit = "kg CO2e" }],
      ["biogenic CO2 without its basis", r => { delete biogenicLine(r).result.biogenicCo2.basis }],
      ["biogenic CO2 with another key", r => { biogenicLine(r).result.biogenicCo2.inTotal = false }],
      ["negative biogenic CO2", r => { biogenicLine(r).result.biogenicCo2.mass = "-1" }],
      ["a category biogenic figure that isn't its lines' sum", r => { const b = category(r, 11).profile.biogenicCo2; b.unrounded = "9451"; b.display = "9451.0000" }],
      ["a memo item not reported separately", r => { memoLine(r).result.memoItems[0].reportedSeparately = false }],
      ["a memo item in kg CO2", r => { memoLine(r).result.memoItems[0].unit = "kg CO2" }],
      ["a memo item with another key", r => { memoLine(r).result.memoItems[0].inTotal = false }],
      ["a memo item code twice (the second 0 kg)", r => { const items = memoLine(r).result.memoItems; items.push({ ...items[0], kg: "0" }) }],
      ["a negative memo item", r => { memoLine(r).result.memoItems[0].kg = "-7500000000" }],
      ["a category memo item that isn't its lines' sum", r => { const m = category(r, 15).profile.memoItems.projected_lifetime_emissions; m.unrounded = "1"; m.display = "1.0000" }],
      ["a methodology without the biogenic sentence", r => { category(r, 11).methodology = category(r, 11).methodology.filter((s: any) => s.topic !== "biogenic") }],
    ]
    expect(decodes(copy())).toBe(true)
    for (const [name, tamper] of cases) { const r = copy(); tamper(r); expect([name, decodes(r)]).toEqual([name, false]) }
  })
})
/* eslint-enable @typescript-eslint/no-explicit-any */
