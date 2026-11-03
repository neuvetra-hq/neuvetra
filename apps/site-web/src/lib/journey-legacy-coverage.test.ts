import { describe, expect, test } from "bun:test"
import { createSyntheticCompanySetup } from "../../../../packages/neuvetra-database/src/company-setup-fixture"
import type { CompanySetupView } from "./company-setup-api"
import { coverageGaps, coverageIssues, coverageLines, setupMissing, type JourneyRecord } from "./journey-status"

function setupView(category = "stationary_combustion") {
  const setup = createSyntheticCompanySetup()
  // Saved Redwood shape: affirmative, location-specific legacy screening plus a source note.
  setup.screening = [{ ...setup.screening[0]!, category, state: "yes", details: "Synthetic gas bill entered without file evidence" }]
  return { currentVersion: { setup } } as CompanySetupView
}
const site = createSyntheticCompanySetup().locations[0]!.id
const record = (kind: string, state: JourneyRecord["state"] = "ready", locationId = site): JourneyRecord => ({ id: kind, kind, locationId, state, label: "Synthetic", sourceId: "Synthetic", site: "Synthetic depot", reasons: [], evidenceCount: 0, quality: "unknown" })
const gaps = (view: CompanySetupView, records: JourneyRecord[]) => coverageGaps(view, records).filter(gap => gap.id === "screen-stationary")

describe("legacy source coverage", () => {
  test.each([
    [[record("natural_gas")], "natural gas records"],
    [[record("distillate_no2")], "generator fuel records"],
    [[record("natural_gas"), record("distillate_no2")], "natural gas records and generator fuel records"],
  ] as const)("saved stationary records retain a clarification, not an unsupported assertion: %j", (records, label) => {
    const view = setupView()
    const original = JSON.stringify(view)
    const result = gaps(view, [...records])
    expect(result).toHaveLength(1)
    expect(result[0]!.title).toContain(label)
    expect(result[0]!.title).toContain("Confirm which fuels or equipment still need records")
    expect(result[0]!.title).not.toMatch(/[.?!]$/)
    expect(result[0]!.note).toBe("Synthetic gas bill entered without file evidence")
    expect(JSON.stringify(result)).not.toMatch(/stationary_combustion|aren’t calculated/)
    expect(coverageIssues({ state: "ready", setupOpen: [], gaps: result }, 1).gaps).toBe(1)
    expect(coverageLines({ state: "ready", setupOpen: [], gaps: result }).join(" ")).toContain("Confirm which fuels or equipment still need records")
    expect(JSON.stringify(view)).toBe(original)
  })
  test.each([[[]], [[record("natural_gas", "withdrawn")]], [[record("distillate_no2", "excluded")]], [[record("natural_gas", "ready", "other-site")]], [[record("vehicle")]]])("absent or ineligible stationary records stay missing: %j", records => {
    const result = gaps(setupView(), records)
    expect(result).toHaveLength(1)
    expect(result[0]!.title).toContain("no natural gas or generator fuel records yet")
    expect(result[0]!.title).toContain("Confirm which fuels or equipment still need records")
    expect(JSON.stringify(result)).not.toMatch(/stationary_combustion|aren’t calculated/)
  })
  test("company-wide legacy screening recognizes records across sites without closing coverage", () => {
    const view = setupView()
    view.currentVersion!.setup.screening[0]!.locationId = null
    expect(gaps(view, [record("natural_gas", "ready", "other-site")])[0]!.title).toContain("natural gas records are saved")
  })
  test.each([
    ["Heating & process equipment", "natural_gas"], ["Backup generators", "distillate_no2"],
    ["Road & off-road vehicles", "vehicle"], ["Cooling & fire suppression", "fugitive"],
    ["Purchased electricity", "electricity"], ["purchased_electricity", "electricity"], ["electricity", "electricity"],
  ])("current supported family %s keeps missing and matched behavior", (category, kind) => {
    const view = setupView(category)
    if (kind === "electricity") view.currentVersion!.setup.screening[0]!.scope = 2
    expect(gaps(view, [record(kind)])).toEqual([])
    expect(gaps(view, [record(kind, "withdrawn")])[0]!.title).toContain("but there are no")
    expect(gaps(view, [record(kind, "excluded")])[0]!.title).toContain("but there are no")
    expect(gaps(view, [record(kind, "ready", "other-site")])[0]!.title).toContain("but there are no")
    expect(gaps(view, [])[0]!.title).toContain("but there are no")
  })
  test.each(["Processes & other direct releases", "custom_process", "purchased_heat"])("unsupported or unknown %s is still flagged in plain language", category => {
    const view = setupView(category)
    if (category === "purchased_heat") view.currentVersion!.setup.screening[0]!.scope = 2
    const result = gaps(view, [record("natural_gas"), record("distillate_no2")])
    expect(result).toHaveLength(1)
    expect(result[0]!.detail).toContain("aren’t calculated in this beta")
    expect(result[0]!.title).not.toContain("_")
  })
  test.each(["stationary_combustion", "purchased_electricity", "custom_process"])("unanswered saved category %s has no raw code", category => {
    const view = setupView(category)
    view.currentVersion!.setup.screening[0]!.state = "unknown"
    expect(setupMissing(view).find(item => item.id === "screen-stationary")!.title).not.toContain("_")
    expect(gaps(view, [])).toEqual([])
  })
})
