// WO-12b QA round 1: every hold, exclusion and engine finding code the calculation adapters, the results routes and the
// three engines can return (read from their source by hold-codes-wo12b.ts) is classified in hold-classification-wo12b.json,
// with one line of reasoning. A new code in the code base fails here until it is classified; a code classified as a
// notice (record, site or company level) is exactly a code the record form's notice handles (record-holds-wo12b.ts).
import { describe, expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import classification from "./hold-classification-wo12b.json"
import { HOLD_CODE_SOURCES, pythonCodes, pythonRefusalCodes, REFUSAL_HELPERS, typescriptCodes, variableRefusals } from "./hold-codes-wo12b"
import { RECORD_HOLD_LEVELS } from "./record-holds-wo12b"

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url))
const LEVELS = ["field", "record", "site", "company", "waiting", "derived", "results", "state", "shadowed", "refusal"] as const
type Entry = { level: typeof LEVELS[number]; why: string }
const table = classification as Record<string, Entry>

async function codesInCodeBase(): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>()
  for (const [file, language] of HOLD_CODE_SOURCES) {
    const source = await Bun.file(ROOT + file).text()
    for (const code of language === "ts" ? typescriptCodes(source) : [...pythonCodes(source), ...pythonRefusalCodes(source)]) found.set(code, [...new Set([...found.get(code) ?? [], file])])
  }
  return found
}

describe("WO-12b: every hold code is classified (field-level, record-level notice, company-level notice, …)", () => {
  test("the extraction reads every source file and finds the codes it should", async () => {
    const found = await codesInCodeBase()
    expect(found.size).toBeGreaterThan(150)
    // One code per kind of source, so a broken pattern can't pass quietly.
    for (const code of ["finance_lease_in_scope1_2", "equity_share_not_supported", "term_PN_not_numeric", "heat_content_outside_scf_range", "possible_duplicate_record", "replacing_record_not_counted",
      "outside_declared_boundary", "instrument_quality_criteria_not_met", "natural_gas_use_unknown", "utility_required_for_multi_subregion_zip"]) expect([code, found.has(code)]).toEqual([code, true])
    for (const status of ["complete", "excluded", "review_required", "input_needed"]) expect(found.has(status)).toBe(false)
  })
  test("QA round 2: pending codes and the engines' refusal codes are read too; the only refusals not read literally are the three helpers'", async () => {
    const found = await codesInCodeBase()
    for (const code of ["upstream_factor_not_available_for_fuel", "invalid_input_shape", "invalid_date"]) expect([code, found.has(code)]).toEqual([code, true])
    // `pending(kind, optional)` names a kind, not a code.
    for (const kind of ["building_average", "hotel_stay"]) expect(found.has(kind)).toBe(false)
    // Every `raise Refused(<variable>)` sits in one of the helpers whose callers' literal codes are read: pinned, so a new
    // family of variable refusal codes fails here until it is read or listed.
    const variable: string[] = []
    for (const [file, language] of HOLD_CODE_SOURCES) if (language === "py") variable.push(...variableRefusals(await Bun.file(ROOT + file).text()).map(fn => `${file.split("/").at(-1)}:${fn}`))
    expect(variable.sort()).toEqual(["scope1_engine.py:quantity", "scope2_engine.py:quantity", "scope3_engine.py:_choice", "scope3_engine.py:integer", "scope3_engine.py:quantity"])
    expect(variable.every(entry => (REFUSAL_HELPERS as readonly string[]).includes(entry.split(":")[1]!))).toBe(true)
    expect(Object.values(table).filter(entry => entry.level === "refusal").length).toBe(84)
  })
  test("every code in the code base is classified, with a level and a line of reasoning; nothing classified is gone", async () => {
    const found = await codesInCodeBase()
    expect([...found.keys()].filter(code => !(code in table)).sort()).toEqual([])
    expect(Object.keys(table).filter(code => !found.has(code)).sort()).toEqual([])
    for (const [code, entry] of Object.entries(table)) {
      expect([code, (LEVELS as readonly string[]).includes(entry.level)]).toEqual([code, true])
      expect([code, entry.why.length > 30]).toEqual([code, true])
    }
  })
  test("the codes classified as notices are exactly the ones the record form's notice handles, at the same level", () => {
    for (const level of ["company", "site", "record"] as const)
      expect([level, Object.entries(table).filter(([, entry]) => entry.level === level).map(([code]) => code).sort()]).toEqual([level, [...RECORD_HOLD_LEVELS[level]].sort()])
  })
})
