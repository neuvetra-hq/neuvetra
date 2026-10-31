// Round 2 lane E (UX-7; Claude, 31 October 2026): no internal code reaches a screen, the print or the CSV. Every reason,
// disclosure, status, unit, material, location, subregion, method and form-choice label is rendered with the functions
// the screens use, and the test fails on snake_case, a raw token, the humanized-code fallback or "engine token" wording.
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import * as contract from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { ENGINE_SUBREGIONS } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { SCOPE3_COLLECTION_UNITS } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { SCOPE3_METHODS } from "../../../../packages/neuvetra-database/src/scope3-method-catalog"
import * as text from "../../../../packages/neuvetra-database/src/scope3-text"
import * as r2e from "../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { reasonText, reasonTextKnown, scope3FallbackText, SCOPE3_CSV_LABELS } from "../../../../packages/neuvetra-database/src/plain-language-labels"
import { scope3Csv } from "../../../../packages/neuvetra-database/src/scope3-report-csv"
import { kindLabel, RECORD_STATE_LABELS, shortUnit, unitLabel } from "./plain-language"
import { scope3TokenLabel } from "./scope3-forms"
import * as resultsText from "./scope3-results-text"

const SNAKE = /\b[A-Za-z0-9]+_[A-Za-z0-9_]+\b/
const ENGINE_WORDING = /engine tokens?|not_an_engine|_token\b/i
function plainWords(where: string, value: string) {
  expect({ where, value, snake: SNAKE.test(value), engine: ENGINE_WORDING.test(value) }).toEqual({ where, value, snake: false, engine: false })
}
const fixtures = ["./scope3-results.fixture.json", "./scope3-results-downstream.fixture.json"].map(file => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8")))
/** Every code a results response can carry on a line or a category: hold reasons, engine findings, estimates and boundary notes. */
function fixtureCodes(): string[] {
  const codes = new Set<string>()
  for (const response of fixtures) {
    for (const row of response.records) {
      for (const code of [...row.plan.reasons, ...(row.result?.findings ?? []), ...(row.result?.estimates ?? []), ...(row.result?.boundary?.notes ?? [])]) codes.add(code)
    }
    for (const row of response.coverage.categories) for (const code of [...row.reasons, ...row.disclosures]) codes.add(code)
  }
  return [...codes].filter(code => !code.includes(":")).sort()
}
const tableKeys = (prefix: string) => Object.entries(text).filter(([name, value]) => name.startsWith(prefix) && value && typeof value === "object").flatMap(([, value]) => Object.keys(value as object))

describe("round 2 lane E (UX-7): words, never codes, on screen, in print and in the CSV", () => {
  test("every reason and engine code has reviewed words (the humanized fallback never fires), and the words are plain", () => {
    // The codes the reviewer saw humanized on record cards and in the CSV (round 1, UX-7), plus every code in both fixtures
    // and every reason table key.
    const listed = ["cbecs_activity_average_intensity", "building_us_average_grid_rate", "us_average_grid_rate", "us_average_upstream_intensity", "economy_wide_price_index"]
    const codes = [...new Set([...listed, ...fixtureCodes(), ...tableKeys("SCOPE3_REASON_TEXT_")])]
    expect(codes.length).toBeGreaterThan(120)
    const unknown = codes.filter(code => !reasonTextKnown(code))
    expect(unknown).toEqual([])
    for (const code of codes) plainWords(`reason ${code}`, reasonText(code))
    // The fallback itself is what the test guards against: it would have shown "Us average grid rate.".
    expect(scope3FallbackText("us_average_grid_rate")).toBe("Us average grid rate.")
    expect(reasonText("us_average_grid_rate")).toBe(text.SCOPE3_DISCLOSURE_TEXT.us_average_grid_rate!)
  })

  test("every SCOPE3_REASON_TEXT_* block is spread into reasonText (a lane's new block cannot be forgotten)", () => {
    for (const [name, table] of Object.entries(text).filter(([name]) => name.startsWith("SCOPE3_REASON_TEXT_"))) {
      for (const [code, words] of Object.entries(table as Record<string, string>)) {
        // Every block's words are the words shown (round 2 integration: lane F gave the sold-fuel hold its own code, so no
        // block overrides the shipped Scope 1 vehicle text of `fuel_not_an_engine_token` and no exemption is needed).
        expect({ name, code, known: reasonTextKnown(code) }).toEqual({ name, code, known: true })
        expect({ name, code, words: reasonText(code) }).toEqual({ name, code, words })
      }
    }
  })

  test("every disclosure, status, method-type, record-state, GWP, origin and methodology table holds plain words", () => {
    for (const [code, words] of Object.entries(text.SCOPE3_DISCLOSURE_TEXT)) plainWords(`disclosure ${code}`, words)
    for (const [code, words] of Object.entries(text.SCOPE3_STATUS_TEXT)) plainWords(`status ${code}`, words)
    for (const [code, words] of Object.entries(text.SCOPE3_STATUS_PHRASE)) plainWords(`status phrase ${code}`, words!)
    for (const [code, words] of Object.entries(text.SCOPE3_METHOD_TYPE_TEXT)) plainWords(`method type ${code}`, words)
    for (const [code, words] of Object.entries(text.SCOPE3_REVIEW_FLAG_TEXT)) plainWords(`review flag ${code}`, words)
    for (const [code, words] of Object.entries(text.SCOPE3_ASSESSMENT_REASON_TEXT)) plainWords(`assessment reason ${code}`, words)
    for (const [code, words] of Object.entries(text.SCOPE3_EXCLUDABLE_NOTE_TEXT)) plainWords(`excludable note ${code}`, words)
    for (const [code, words] of Object.entries(text.SCOPE3_ORIGIN_TEXT)) plainWords(`origin ${code}`, words)
    for (const [code, words] of Object.entries(RECORD_STATE_LABELS)) plainWords(`record state ${code}`, words)
    for (const words of Object.values(text.SCOPE3_UNCERTAINTY_TEXT)) plainWords("uncertainty", words)
    for (const words of Object.values(r2e.SCOPE3_UNCERTAINTY_TEXT_R2E)) plainWords("uncertainty r2e", words)
    for (const category of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) plainWords(`setup note ${category}`, text.scope3CategoryMethodNote(category))
    // Method titles name their sources in words (the method id itself is shown only in the calculation details panel).
    for (const [id, method] of Object.entries(SCOPE3_METHODS)) plainWords(`method title ${id}`, method.title)
  })

  test("every kind and unit label, as the forms (unitLabel) and the CSV and print (shortUnit) show it", () => {
    const units = new Set<string>([...Object.values(SCOPE3_COLLECTION_UNITS).flat(), ...Object.values(contract.SCOPE3_UNIT_FAMILIES).flat(), ...contract.SCOPE3_WASTE_UNITS, "therm", "MMBtu", "scf", "ccf", "mcf", "US_gallon", "kg", "lb", "kWh", "MWh", "kg CO2e", "metric_ton CO2e"])
    for (const unit of units) { plainWords(`unit label ${unit}`, unitLabel(unit)); plainWords(`short unit ${unit}`, shortUnit(unit)) }
    for (const kind of [...contract.SCOPE3_COMPLETION_KINDS, "transport", "waste", "business_travel", "employee_commuting", "td_losses", "td_losses_upstream", "electricity_upstream", "fuel_upstream", "hotel_stay", "energy_resold_upstream", "natural_gas", "electricity", "vehicle", "distillate_no2", "fugitive"]) plainWords(`kind ${kind}`, kindLabel(kind))
  })

  test("every waste material and treatment uses EPA's own material name (the verified register's label), never a title-cased token", () => {
    const register = JSON.parse(readFileSync(new URL("../../../../packages/neuvetra-database/src/method-reference/verified-scope3-register-2025.json", import.meta.url), "utf8"))
    const entries: Array<{ id: string; label: string }> = Array.isArray(register.entries) ? register.entries : Object.entries(register.entries).map(([id, value]) => ({ id, ...(value as { label: string }) }))
    for (const material of contract.SCOPE3_WASTE_MATERIALS) {
      const words = r2e.SCOPE3_WASTE_MATERIAL_TEXT_R2E[material]
      expect({ material, words: typeof words }).toEqual({ material, words: "string" })
      const epa = entries.find(entry => entry.id.startsWith(`waste.${material}.`))!.label.split(", ").slice(0, -1).join(", ")
      expect({ material, startsWithEpaName: words!.startsWith(epa) }).toEqual({ material, startsWithEpaName: true })
      plainWords(`material ${material}`, words!)
    }
    for (const treatment of contract.SCOPE3_WASTE_TREATMENTS) plainWords(`treatment ${treatment}`, r2e.SCOPE3_WASTE_TREATMENT_TEXT_R2E[treatment]!)
    // The reviewer's examples (round 1, forms/05-waste.txt): "Hdpe", "Pet", "Crt displays", "Mixed msw".
    expect([r2e.SCOPE3_WASTE_MATERIAL_TEXT_R2E.hdpe, r2e.SCOPE3_WASTE_MATERIAL_TEXT_R2E.crt_displays, r2e.SCOPE3_WASTE_MATERIAL_TEXT_R2E.mixed_msw]).toEqual(["HDPE (high-density polyethylene)", "CRT Displays (cathode-ray tube)", "Mixed MSW (municipal solid waste)"])
  })

  test("every location answer, eGRID subregion, freight vehicle and freight answer has words", () => {
    for (const token of ["unknown", "included", "excluded"]) plainWords(`inclusion ${token}`, r2e.LOCATION_INCLUSION_TEXT_R2E[token]!)
    for (const token of ["unknown", "reporting_company", "related_entity", "landlord", "shared", "other"]) plainWords(`control ${token}`, r2e.LOCATION_CONTROL_TEXT_R2E[token]!)
    for (const code of ENGINE_SUBREGIONS) { expect(r2e.EGRID_SUBREGION_NAME_TEXT_R2E[code]).toBeString(); expect(r2e.egridSubregionLabel(code)).toBe(`${code}: ${r2e.EGRID_SUBREGION_NAME_TEXT_R2E[code]}`) }
    expect(Object.keys(r2e.EGRID_SUBREGION_NAME_TEXT_R2E).sort()).toEqual([...ENGINE_SUBREGIONS].sort())
    expect(r2e.egridSubregionLabel("CAMX")).toBe("CAMX: WECC California")
    for (const vehicle of Object.keys(contract.SCOPE3_TRANSPORT_VEHICLES)) plainWords(`vehicle ${vehicle}`, r2e.SCOPE3_TRANSPORT_VEHICLE_TEXT_R2E[vehicle]!)
    for (const token of ["dedicated_vehicle", "shared_vehicle", ...contract.SCOPE3_TRANSPORT_FACILITIES]) plainWords(`freight answer ${token}`, r2e.SCOPE3_TRANSPORT_ANSWER_TEXT_R2E[token]!)
  })

  test("every choice a record form offers (scope3TokenOptions) has its own words, never the title-cased token", () => {
    const sources = readdirSync(new URL("../components/scope3/", import.meta.url)).filter(file => file.endsWith(".tsx")).map(file => readFileSync(new URL(`../components/scope3/${file}`, import.meta.url), "utf8"))
    const calls = [...new Set(sources.flatMap(source => [...source.matchAll(/scope3TokenOptions\("([A-Za-z]+)", (\[[^\]]*\]|[A-Z0-9_]+)\)/g)].map(match => `${match[1]}|${match[2]}`)))]
    expect(calls.length).toBeGreaterThan(20)
    for (const call of calls) {
      const [field, list] = call.split("|") as [string, string]
      const tokens: readonly string[] = list.startsWith("[") ? JSON.parse(list) : (contract as unknown as Record<string, readonly string[]>)[list]!
      expect({ call, resolved: Array.isArray(tokens) }).toEqual({ call, resolved: true })
      for (const token of tokens) {
        expect({ field, token, worded: text.SCOPE3_FORM_TOKEN_TEXT_I08[field]?.[token] !== undefined }).toEqual({ field, token, worded: true })
        plainWords(`${field}.${token}`, scope3TokenLabel(field, token))
      }
    }
  })

  test("no screen says 'engine tokens' and no form label shows a unit token such as metric_ton", () => {
    const files = ["../components/CollectionWorkspace.tsx", ...readdirSync(new URL("../components/scope3/", import.meta.url)).filter(file => file.endsWith(".tsx")).map(file => `../components/scope3/${file}`)]
    for (const file of files) expect({ file, engineTokens: /Engine tokens/.test(readFileSync(new URL(file, import.meta.url), "utf8")) }).toEqual({ file, engineTokens: false })
    // The supplier form's factor label (round 1: "Factor (kg CO2e per metric_ton)").
    expect(readFileSync(new URL("../components/scope3/SupplierForm.tsx", import.meta.url), "utf8")).not.toContain("label={`Factor (${p.factorUnit")
    for (const unit of contract.SCOPE3_UNIT_FAMILIES.supplierProduct) plainWords(`factor unit ${unit}`, r2e.perUnitR2E(unit))
  })

  test("a calculated zero says why on its card (UX-12): a known-zero note's words, or where to look", () => {
    expect(r2e.scope3KnownZeroLineText("0.0000", ["combustion_only", "feedstock_not_combusted"], reasonText)).toBe(`Known zero: ${text.SCOPE3_DISCLOSURE_TEXT.feedstock_not_combusted}`)
    expect(r2e.scope3KnownZeroLineText("0.0000", ["non_motorized_known_zero"], reasonText)).toBe(`Known zero: ${text.SCOPE3_DISCLOSURE_TEXT.non_motorized_known_zero}`)
    expect(r2e.scope3KnownZeroLineText("0.0000", [], reasonText)).toStartWith("Calculated as zero:")
    expect(r2e.scope3KnownZeroLineText("12.5000", ["feedstock_not_combusted"], reasonText)).toBeNull()
    expect(r2e.scope3KnownZeroLineText(null, [], reasonText)).toBeNull()
  })

  // Round 2 integration (Claude, 31 October 2026): lanes A, B and D added codes and texts in parallel with this test; each
  // must have reviewed words, and every text they show (functions called with sample values) must be plain words.
  test("round 2 integration: lanes A, B and D's new codes and texts are plain words too", () => {
    // Lane A (owner decisions 1-4, ACC-7, ACC-14): engine notes and findings, adapter holds, the buildings note.
    const laneA = ["factor_vintage_precedes_period", "price_index_latest_published_year_used", "oil_fired_upstream_proxied_by_ulsd", "other_fuel_upstream_not_mapped", "no_fossil_generation_in_subregion",
      "cagreet3_vintage_superseded_by_cagreet4", "no_upstream_factor_for_subregion_fuels", "period_outside_method_envelope", "reporting_period_required_outside_2025", "building_other_energy_sources_not_included"]
    // Lane B (owner decisions 5, 9, ACC-11): the screening-conflict reason and the two new category disclosures.
    const laneB = ["screening_conflict_records_exist", "lines_without_evidence", "data_quality_label_capped"]
    for (const code of [...laneA, ...laneB]) {
      expect({ code, known: reasonTextKnown(code) }).toEqual({ code, known: true })
      plainWords(`round 2 code ${code}`, reasonText(code))
    }
    expect(text.SCOPE3_EXCLUDABLE_NOTE_TEXT.building_other_energy_sources_not_included).toBeString()
    // Lane B's new status (decision 5) and its phrase, the readiness codes (decision 7) and the data-quality cap reasons (decision 9).
    plainWords("status screening_conflict", text.SCOPE3_STATUS_TEXT.screening_conflict!)
    for (const [code, words] of Object.entries(text.SCOPE3_STATUS_PHRASE_R2B)) plainWords(`status phrase r2b ${code}`, words!)
    expect(Object.keys(text.SCOPE3_READINESS_TEXT).sort()).toEqual(["assessment_missing", "included_category_has_no_records", "input_needed", "needs_review", "screening_conflict"])
    expect(Object.keys(resultsText.SCOPE3_READINESS_TEXT.issue).sort()).toEqual(Object.keys(text.SCOPE3_READINESS_TEXT).sort())
    // Every text object the three lanes added: lane A's methodology, lane B's readiness, approval, capacity, data-quality and
    // methodology texts, and lane D's Results texts (to-do list, actions, units, filters, readiness gate, empty company).
    const tables: Record<string, unknown> = {
      SCOPE3_METHODOLOGY_TEXT_R2A: text.SCOPE3_METHODOLOGY_TEXT_R2A, SCOPE3_METHODOLOGY_TEXT_R2B: text.SCOPE3_METHODOLOGY_TEXT_R2B, SCOPE3_READINESS_TEXT: text.SCOPE3_READINESS_TEXT,
      SCOPE3_REPORT_APPROVAL_TEXT: text.SCOPE3_REPORT_APPROVAL_TEXT, SCOPE3_CAPACITY_TEXT: text.SCOPE3_CAPACITY_TEXT, SCOPE3_DQ_CAP_REASON_TEXT: text.SCOPE3_DQ_CAP_REASON_TEXT,
      ...Object.fromEntries(Object.entries(resultsText).map(([name, value]) => [`web ${name}`, value])),
    }
    let checked = 0
    const sample = (fn: (...args: unknown[]) => unknown): string => {
      for (const fill of [2, "Sample words", ["sample words"]]) {
        try { const out = fn(...Array.from({ length: Math.max(fn.length, 1) }, () => fill)); if (typeof out === "string") return out } catch { /* next sample kind */ }
      }
      throw new Error(`no sample renders ${fn.toString().slice(0, 80)}`)
    }
    const walk = (where: string, value: unknown) => {
      if (typeof value === "string") { plainWords(where, value); checked++ }
      else if (typeof value === "function") { plainWords(where, sample(value as (...args: unknown[]) => unknown)); checked++ }
      else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) walk(`${where}.${key}`, item)
    }
    for (const [name, value] of Object.entries(tables)) walk(name, value)
    expect(checked).toBeGreaterThan(120)
  })

  test("the Scope 3 CSV's Reasons columns are words for both fixtures (the CSV and print use the same reasonText)", () => {
    for (const response of fixtures) {
      const csv = scope3Csv(response, SCOPE3_CSV_LABELS)
      const rows = csv.split("\n").filter(line => !line.startsWith("#")).map(parseCsvLine)
      const header = (section: string) => rows.find(row => row[0] === "Section" && rows[rows.indexOf(row) + 1]?.[0] === section) ?? rows.find(row => row[0] === "Section")!
      for (const section of ["Record", "Category"]) {
        const head = header(section), at = head.indexOf("Reasons")
        if (at < 0) continue
        for (const row of rows.filter(row => row[0] === section)) for (const reason of (row[at] ?? "").split(" | ")) if (reason) plainWords(`${section} reason`, reason)
      }
    }
  })
})

function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cell = "", quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (quoted) { if (c === "\"" && line[i + 1] === "\"") { cell += "\""; i++ } else if (c === "\"") quoted = false; else cell += c }
    else if (c === "\"") quoted = true
    else if (c === ",") { out.push(cell); cell = "" }
    else cell += c
  }
  out.push(cell)
  return out
}
