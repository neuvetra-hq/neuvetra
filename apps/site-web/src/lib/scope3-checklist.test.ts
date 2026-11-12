import { decodeScope3Results } from "@/lib/scope3-results-decode"
/* eslint-disable @typescript-eslint/no-explicit-any -- tests mutate decoded fixtures freely. */
// Round 2, lane D (Claude, 31 October 2026): the Scope 3 to-do list, Fix targets, readiness, units, review flags, grouped
// disclosures and record filters derived from the results response (round-1 product review UX-2, UX-3, UX-9, UX-10;
// ROUND2 decisions 5 and 7). Every case uses the repository fixtures (never a path outside the repository).
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { reasonText } from "./plain-language"
import { type Scope3ResultsResponse } from "./scope3-results-api"
import { scope3MethodologyStatement } from "../../../../packages/neuvetra-database/src/scope3-methodology"
import {
  scope3CategoryAction, scope3DisclosureGroups, scope3FilterRecords, scope3FixFields, scope3PartialText, scope3RatioPercent, scope3ReadinessIssues, scope3Todos, scope3Tonnes,
  scope3VisibleReviewFlags, SCOPE3_DEFAULT_RECORD_FILTER, SCOPE3_FIX_FIELDS, SCOPE3_WITHDRAW_CONTROL,
} from "./scope3-checklist"
import { findFieldControl, focusRecordEditor, requestRecordFieldFocus, takeRecordFieldFocus } from "./scope3-fix-target"

const fixture: Scope3ResultsResponse = JSON.parse(readFileSync(new URL("./scope3-results.fixture.json", import.meta.url), "utf8"))
const downstream: Scope3ResultsResponse = JSON.parse(readFileSync(new URL("./scope3-results-downstream.fixture.json", import.meta.url), "utf8"))
const clone = <T,>(value: T): T => structuredClone(value)

describe("UX-2: the Scope 3 to-do list", () => {
  test("every held line is listed by its source ID with every reason and a working Fix; withdrawn, excluded and calculated lines are not", () => {
    const todos = scope3Todos(fixture)
    const lines = todos.filter(item => item.kind === "line")
    // The fixture's held lines: waste W-2 (material) and transport =HYPERLINK("x") (vehicle). Withdrawn T-2 and the excluded M-2 lines are not to-dos.
    expect(lines.map(item => item.title).sort()).toEqual(["Freight transport · =HYPERLINK(\"x\")", "Waste · W-2"].sort())
    for (const item of lines) {
      const row = fixture.records.find(line => item.title.endsWith(line.sourceId) && line.recordId === item.recordId)!
      for (const code of row.plan.reasons) expect(item.reasons).toContain(reasonText(code))
      expect(item.actions[0]).toMatchObject({ type: "fix", recordId: row.recordId, label: "Fix" })
      expect(item.blocking).toBe(true) // both categories (5, 9) need input
    }
    expect(lines.find(item => item.title.endsWith("W-2"))!.actions[0]).toMatchObject({ fields: ["Material"] })
    // Round 3 lane D (PR-7): vehicle_not_an_engine_token now lands on the freight form's "Vehicle" field (it focused the heading).
    expect(lines.find(item => item.title.includes("HYPERLINK"))!.actions[0]).toMatchObject({ fields: ["Vehicle"] })
  })

  test("category steps: an included category without an assessment blocks approval and opens the assessment inline; an unscreened one goes to setup; an included one without records adds a record", () => {
    const steps = scope3Todos(fixture).filter(item => item.kind === "category")
    const missing = fixture.coverage.categories.filter(row => row.screening.decision === "included" && row.assessment === null).map(row => row.category)
    expect(steps.filter(item => item.key.endsWith(":assessment_missing")).map(item => item.category)).toEqual(missing)
    for (const item of steps.filter(step => step.key.endsWith(":assessment_missing"))) { expect(item.blocking).toBe(true); expect(item.actions).toEqual([{ type: "assessment", category: item.category, label: "Add the assessment" }]) }
    const notScreened = steps.filter(item => item.key.endsWith(":not_screened"))
    expect(notScreened.map(item => item.category)).toEqual(fixture.coverage.categories.filter(row => row.status === "not_screened").map(row => row.category))
    expect(notScreened.every(item => !item.blocking && item.actions[0]!.type === "setup")).toBe(true)
    const data = clone(fixture) as any
    Object.assign(data.coverage.categories[7], { status: "no_records", screening: { decision: "included", reason: null } })
    const noRecords = scope3Todos(data).find(item => item.key === "category:8:no_records")!
    expect(noRecords.actions.map((action: any) => action.type)).toEqual(["collection", "setup"])
    expect(noRecords.blocking).toBe(true)
  })

  test("a screening conflict (today review_required; lane B's screening_conflict) lists every counted line with Withdraw and Change the screening, and blocks approval", () => {
    for (const status of ["review_required", "screening_conflict"]) {
      const data = clone(fixture) as any
      const four = data.coverage.categories[3]
      Object.assign(four, { status, screening: { decision: "not_relevant", reason: "No freight." } })
      const todos = scope3Todos(data)
      const line = todos.find(item => item.kind === "line" && item.category === 4)!
      expect(line.title).toBe("Freight transport · LANE-1")
      expect(line.blocking).toBe(true)
      expect(line.actions).toEqual([{ type: "fix", recordId: data.records.find((r: any) => r.sourceId === "LANE-1").recordId, fields: [SCOPE3_WITHDRAW_CONTROL], label: "Withdraw or correct" }, { type: "setup", label: "Change the screening" }])
      expect(line.reasons[0]).toContain("which company setup screens out")
      expect(todos.find(item => item.key === `category:4:${status}`)!.blocking).toBe(true)
      expect(scope3ReadinessIssues(data).map(issue => issue.key)).toContain(`category:4:${status === "review_required" ? "needs_review" : "screening_conflict"}`)
      expect(scope3CategoryAction(four, todos)).toEqual({ type: "setup", label: "Change the screening" })
    }
  })

  test("a derived line held for its source record is fixed on that record (Scope 1/2 source: its own item; Scope 3 source: joins the source's item)", () => {
    const data = clone(fixture) as any
    const gas = data.records.find((row: any) => row.kind === "fuel_upstream")
    Object.assign(gas, { outcome: "held", result: null, methodType: null, effectiveDataQuality: null, plan: { action: "hold", status: "input_needed", reasons: ["source_scope1_record_held", "heat_content_required_for_volume"], notes: [] } })
    const item = scope3Todos(data).find(entry => entry.recordId === gas.recordId)!
    expect(item.actions[0]).toEqual({ type: "fix", recordId: gas.derivedFrom.recordId, fields: ["Bill heat content"], label: `Fix ${gas.sourceId}` })
    expect(item.reasons.at(-1)).toBe(`Follows its natural gas record ${gas.sourceId}: fix that record and this line recalculates.`)
    // A derived line whose source is itself a held Scope 3 line joins that line's item instead of repeating it.
    const w2 = data.records.find((row: any) => row.sourceId === "W-2")
    data.records.push({ ...clone(gas), kind: "energy_resold_upstream", sourceId: "W-2", derivedFrom: { recordId: w2.recordId, kind: "waste" } })
    const todos = scope3Todos(data)
    expect(todos.filter(entry => entry.reasons.some(reason => reason.includes("W-2")) || entry.title.endsWith("W-2"))).toHaveLength(1)
    expect(todos.find(entry => entry.title.endsWith("W-2"))!.reasons.at(-1)).toBe("Also held for the same reason: Upstream of energy resold (3D).")
  })

  test("a method-pending line offers the record and the category assessment (documented exclusion), and does not block approval", () => {
    const data = clone(fixture) as any
    const t1 = data.records.find((row: any) => row.sourceId === "T-1")
    Object.assign(t1, { outcome: "held", result: null, methodType: null, effectiveDataQuality: null, plan: { action: "hold", status: "method_pending", reasons: ["hotel_country_not_in_factor_set"], notes: [] } })
    const item = scope3Todos(data).find(entry => entry.recordId === t1.recordId)!
    expect(item.blocking).toBe(false)
    expect(item.actions.map((action: any) => action.type)).toEqual(["fix", "assessment"])
    expect(item.actions[0]).toMatchObject({ fields: ["Hotel country (two-letter code)"] })
  })

  test("the category row action: Fix N records when lines block, else the first category step, else none", () => {
    const todos = scope3Todos(fixture)
    const row = (n: number) => fixture.coverage.categories[n - 1]!
    expect(scope3CategoryAction(row(5), todos)).toEqual({ type: "todo", category: 5, label: "Fix 1 record" })
    expect(scope3CategoryAction(row(7), todos)).toEqual({ type: "assessment", category: 7, label: "Add the assessment" })
    expect(scope3CategoryAction(row(4), todos)).toBeNull()
  })
})

describe("decision 7: readiness", () => {
  test("open issues are the categories needing input, in conflict or needing review, and relevant categories without an assessment; keys are stable", () => {
    const issues = scope3ReadinessIssues(fixture)
    expect(issues.filter(issue => issue.code === "input_needed").map(issue => issue.key)).toEqual(["category:5:input_needed", "category:9:input_needed"])
    expect(issues.filter(issue => issue.code === "assessment_missing").map(issue => issue.category)).toEqual([3, 5, 6, 7, 9])
    expect(issues.find(issue => issue.key === "category:5:input_needed")!.text).toBe("Category 5 needs input: some of its records aren’t counted yet.")
    // Every to-do that blocks approval belongs to a category with an open issue, and every open issue has a blocking to-do.
    const blocking = scope3Todos(fixture).filter(item => item.blocking)
    expect([...new Set(blocking.map(item => item.category))].sort()).toEqual([...new Set(issues.map(issue => issue.category))].sort())
  })
  test("ready when nothing is open", () => {
    const data = clone(fixture) as any
    for (const row of data.coverage.categories) { if (row.status === "input_needed") row.status = "calculated"; if (row.screening.decision === "included") row.assessment = fixture.coverage.categories[0]!.assessment }
    expect(scope3ReadinessIssues(data)).toEqual([])
  })
})

describe("UX-3: Fix lands on the field the hold names", () => {
  test("hold reasons map to the record editor's own labels, and every mapped label exists in the form sources", () => {
    expect(scope3FixFields(["natural_gas_use_unknown", "finance_lease_in_scope1_2"])).toEqual(["Does the building use natural gas?", "Lease"])
    expect(scope3FixFields(["unknown_code"])).toEqual([])
    // Round 2 integration (lane F's sold-fuel code): Fix on a sold-fuel hold still focuses the sold-fuel form's "Fuel".
    expect(scope3FixFields(["sold_fuel_not_an_engine_token"])).toEqual(["Fuel"])
    const dir = new URL("../components/", import.meta.url), scope3Dir = new URL("../components/scope3/", import.meta.url)
    const sources = [...readdirSync(dir).filter(name => name.endsWith(".tsx") && !name.includes(".test.")).map(name => readFileSync(new URL(name, dir), "utf8")),
      ...readdirSync(scope3Dir).filter(name => name.endsWith(".tsx")).map(name => readFileSync(new URL(name, scope3Dir), "utf8")), readFileSync(new URL("./scope3-form-defaults.ts", import.meta.url), "utf8"),
      // Round 2 polish: lane E's form labels kept as package texts (COPY_TEXT_R2E).
      readFileSync(new URL("../../../../packages/neuvetra-database/src/scope3-text-r2e.ts", import.meta.url), "utf8")].join("\n")
    for (const [code, labels] of Object.entries(SCOPE3_FIX_FIELDS)) for (const label of labels) expect([code, sources.includes(`"${label}"`) || sources.includes(`'${label}'`) || sources.includes(`label="${label}"`)]).toEqual([code, true])
    expect(sources.includes(`>Withdraw this record<`)).toBe(true)
  })

  test("a focus request is used once, for its record only", () => {
    requestRecordFieldFocus("r1", ["Lease"])
    expect(takeRecordFieldFocus("r2")).toEqual([])
    requestRecordFieldFocus("r1", ["Lease"])
    expect(takeRecordFieldFocus("r1")).toEqual(["Lease"])
    expect(takeRecordFieldFocus("r1")).toEqual([])
  })

  test("the control is found by its exact label, a checkbox label or a button; disabled controls are skipped", () => {
    const el = (tag: string, props: Record<string, any> = {}, children: any[] = []): any => {
      const node: any = { tagName: tag.toUpperCase(), ...props, children, parent: null }
      for (const child of children) child.parent = node
      node.textContent = props.text ?? children.map((child: any) => child.textContent ?? "").join("")
      node.closest = (selector: string) => { let at = node; while (at) { if (selector === "fieldset:disabled" && at.tagName === "FIELDSET" && at.disabled) return at; if (selector === "label" && at.tagName === "LABEL") return at; at = at.parent } return null }
      const all = (): any[] => children.flatMap((child: any) => [child, ...child.querySelectorAll("*")])
      node.querySelectorAll = (selector: string) => selector === "*" ? all() : all().filter((x: any) => selector.split(",").map(s => s.trim()).some(s => x.tagName === s.toUpperCase()))
      node.querySelector = (selector: string) => selector === ":scope > span" ? children.find((child: any) => child.tagName === "SPAN") ?? null : node.querySelectorAll(selector)[0] ?? null
      return node
    }
    const lease = el("select"), gas = el("select", { disabled: true }), check = el("input"), withdraw = el("button", { text: "Withdraw this record" })
    const root = el("div", {}, [el("label", {}, [el("span", { text: "Lease" }), lease]), el("label", {}, [el("span", { text: "Does the building use natural gas?" }), gas]),
      el("label", {}, [check, el("text", { text: " The electricity resold is kept out of the company’s own Scope 2 electricity records" })]), withdraw])
    expect(findFieldControl(root, ["Lease"])).toBe(lease)
    expect(findFieldControl(root, ["Does the building use natural gas?"])).toBeNull()
    expect(findFieldControl(root, ["Does the building use natural gas?", "Lease"])).toBe(lease)
    expect(findFieldControl(root, ["The electricity resold is kept out of the company’s own Scope 2 electricity records"])).toBe(check)
    expect(findFieldControl(root, [SCOPE3_WITHDRAW_CONTROL])).toBe(withdraw)
    expect(findFieldControl(root, ["Leas"])).toBeNull() // exact label, not a prefix
  })

  test("a partial-boundary line says why instead of offering Fix", () => {
    const m1 = fixture.records.find(row => row.kind === "electricity_upstream" && row.outcome === "calculated")!
    // Round 3, lane A (owner decision 2): the fully counted fuels with their share (mapped minus coal), coal with its own share
    // (mine methane only), the other fossil fuels not counted, other fuels, solar-thermal co-firing and the static note; never "cover".
    const a = m1.result!.activity as any, pct = scope3RatioPercent
    const full = (BigInt(a.mappedFossilHeatInputShare.replace(".", "")) - BigInt(a.coalHeatInputShare.replace(".", ""))).toString().padStart(13, "0")  // both 12 dp
    expect(scope3PartialText(m1, false)).toBe(`Partial boundary: natural gas and oil are fully counted (${pct(`${full.slice(0, -12)}.${full.slice(-12)}`)}% of the fossil heat input); `
      + `coal (${pct(a.coalHeatInputShare)}% of the fossil heat input) counts mine methane only: the energy to mine it and the CO2 of transporting it aren’t included (a screening range is shown as a memo); `
      + `other fossil fuels (${pct(a.unmappedFossilHeatInputShare)}% of the fossil heat input) aren’t quantified; other fuels (eGRID “other fuel”) aren’t quantified; gas co-fired at solar-thermal plants isn’t counted; `
      + "the upstream of nuclear, biomass and renewable plants, where present in the subregion’s mix, isn’t counted. None of this is treated as zero.")
    expect(scope3PartialText(m1, true)).toBe("Partial boundary: Its upstream line is calculated separately, so the category counts this boundary as met.")
    expect(scope3PartialText(fixture.records.find(row => row.sourceId === "T-1")!, false)).toBeNull()
    expect([scope3RatioPercent("0.703573344393"), scope3RatioPercent("1"), scope3RatioPercent("0.12345"), scope3RatioPercent("0.12355"), scope3RatioPercent("0.1235")]).toEqual(["70.4", "100.0", "12.3", "12.4", "12.4"])
  })
})

describe("UX-9: one unit, quiet review flags, grouped disclosures, record filters", () => {
  test("t CO2e with 2 fixed decimals, half-even from the engine's kg; a non-zero figure below 0.005 t says so", () => {
    expect(["1862047.0754", "15.0000", "5.0000", "0.0001", "0.0000", "-25.0000", "999995.0000"].map(scope3Tonnes)).toEqual(["1,862.05", "0.02", "< 0.01", "< 0.01", "0.00", "−0.02", "1,000.00"])
    expect(scope3Tonnes(null)).toBe("—")
  })

  test("the 10% flag needs at least 5 counted lines; the half-of-total flag needs a second category with a figure", () => {
    const row = (counted: number, flags: string[]) => ({ reviewFlags: flags, counts: { ...fixture.coverage.categories[0]!.counts, calculated: counted, partialBoundary: 0 } })
    const two = [{ subtotal: { display: "1" } }, { subtotal: { display: "2" } }] as any, one = [{ subtotal: { display: "1" } }, { subtotal: null }] as any
    expect(scope3VisibleReviewFlags(row(4, ["largest_record_over_tenth_of_category"]), two)).toEqual([])
    expect(scope3VisibleReviewFlags(row(5, ["largest_record_over_tenth_of_category"]), two)).toEqual(["largest_record_over_tenth_of_category"])
    expect(scope3VisibleReviewFlags(row(9, ["category_over_half_of_known_total"]), one)).toEqual([])
    expect(scope3VisibleReviewFlags(row(9, ["category_over_half_of_known_total"]), two)).toEqual(["category_over_half_of_known_total"])
    // In both fixtures, no category shows the 10% flag any more (each has fewer than 5 counted lines), though the engine sends it on nearly all.
    for (const data of [fixture, downstream]) {
      const sent = data.coverage.categories.filter(c => c.reviewFlags.includes("largest_record_over_tenth_of_category")).length
      const shown = data.coverage.categories.filter(c => scope3VisibleReviewFlags(c, data.coverage.categories).includes("largest_record_over_tenth_of_category")).length
      expect([sent > 2, shown]).toEqual([true, data.coverage.categories.filter(c => c.counts.calculated + c.counts.partialBoundary >= 5 && c.reviewFlags.includes("largest_record_over_tenth_of_category")).length])
    }
  })

  test("disclosures are grouped by category (across-Scope-3 first) and sorted within each group; nothing is lost", () => {
    const groups = scope3DisclosureGroups(fixture)
    for (const group of groups) expect(group.items.map(item => item.text)).toEqual([...group.items.map(item => item.text)].sort((a, b) => a.localeCompare(b, "en")))
    const listed = new Set(groups.flatMap(group => group.items.map(item => item.code)))
    expect([...listed].sort()).toEqual(fixture.coverage.disclosures.map(item => item.code).sort())
    expect(groups.filter(group => group.key !== "all").map(group => Number(group.key))).toEqual([...groups.filter(group => group.key !== "all").map(group => Number(group.key))].sort((a, b) => a - b))
  })

  test("record filters: by category, status, activity and source ID; grouped by category in category order", () => {
    const all = scope3FilterRecords(fixture, SCOPE3_DEFAULT_RECORD_FILTER)
    expect(all.reduce((n, group) => n + group.rows.length, 0)).toBe(fixture.records.length)
    expect(all.map(group => group.category)).toEqual([...all.map(group => group.category)].sort((a, b) => a - b))
    const attention = scope3FilterRecords(fixture, { ...SCOPE3_DEFAULT_RECORD_FILTER, status: "attention" }).flatMap(group => group.rows.map(row => row.sourceId))
    expect(attention.sort()).toEqual(["=HYPERLINK(\"x\")", "W-2"].sort())
    expect(scope3FilterRecords(fixture, { ...SCOPE3_DEFAULT_RECORD_FILTER, category: 3 }).flatMap(group => group.rows).every(row => row.category === 3)).toBe(true)
    expect(scope3FilterRecords(fixture, { ...SCOPE3_DEFAULT_RECORD_FILTER, kind: "waste" }).flatMap(group => group.rows.map(row => row.sourceId)).sort()).toEqual(["W-1", "W-2"])
    expect(scope3FilterRecords(fixture, { ...SCOPE3_DEFAULT_RECORD_FILTER, search: "lane" }).flatMap(group => group.rows.map(row => row.sourceId))).toEqual(["LANE-1"])
    const counted = scope3FilterRecords(fixture, { ...SCOPE3_DEFAULT_RECORD_FILTER, status: "counted" }).flatMap(group => group.rows)
    const notCounted = scope3FilterRecords(fixture, { ...SCOPE3_DEFAULT_RECORD_FILTER, status: "not_counted" }).flatMap(group => group.rows)
    expect(counted.length + notCounted.length).toBe(fixture.records.length)
  })

  test("the derivations accept a decoded response as is (the fixture still decodes; methodology unchanged)", () => {
    const decoded = decodeScope3Results(clone(fixture), fixture.companyId)
    expect(decoded.coverage.categories.map(row => scope3MethodologyStatement(row, decoded.records, decoded.coverage.categories))).toEqual(decoded.coverage.categories.map(row => row.methodology))
    expect(scope3Todos(decoded).length).toBe(scope3Todos(fixture).length)
  })
})

// Round 2 polish, lane D (the empty-company walk): Fix on a freight line without its load basis and on a category 4-6 spend
// line awaiting the overlap confirmation landed on the editor heading; they now land on the field that resolves them.
describe("round 2 polish: Fix lands on the load-basis and overlap fields", () => {
  test("load_basis_required and spend_overlap_not_confirmed name their form fields", () => {
    expect(scope3FixFields(["load_basis_required"])).toEqual(["Did the goods have the vehicle to themselves?"])
    expect(scope3FixFields(["spend_overlap_not_confirmed"])).toEqual(["Covered by another record?"])
    // The adapter's code for a negative spend line (the map named a code that is never emitted).
    expect(scope3FixFields(["negative_amount_not_supported"])).toEqual(["Amount spent"])
    // An operating lease under operational control: the "no operational control" explanation, then the lease type.
    expect(scope3FixFields(["lease_in_scope1_2_under_boundary"])).toEqual(["If the company has no operational control over this asset, why?", "Lease"])
  })
})

// Round 2 polish, lane D (the empty-company walk): since lane E made the record forms load on first use, the editor shows
// the record before its form chunk has rendered the fields, so Fix landed on the editor heading. The heading is focused at
// once and the named field as soon as it renders (within a few seconds).
describe("round 2 polish: Fix waits for a lazily loaded form's field", () => {
  test("the heading first, then the field once the form renders; nothing is waited for without a field", () => {
    const timers: Array<() => void> = [], focused: string[] = []
    const view = { setTimeout: (fn: () => void) => { timers.push(fn); return timers.length }, innerHeight: 900 }
    const box = { top: 10, bottom: 50 }
    const heading: any = { tagName: "H2", tabIndex: 0, scrollIntoView: () => {}, focus: () => focused.push("heading"), getBoundingClientRect: () => box }
    const select: any = { tagName: "SELECT", disabled: false, closest: (selector: string) => selector === "label" ? label : null, scrollIntoView: () => {}, focus: () => focused.push("select"), addEventListener: () => {}, getBoundingClientRect: () => box }
    const span: any = { textContent: "Covered by another record?" }
    const label: any = { dataset: {}, style: {}, querySelector: (selector: string) => selector === ":scope > span" ? span : select, textContent: "Covered by another record?" }
    let rendered = false
    const editor: any = { querySelectorAll: (selector: string) => selector === "label" && rendered ? [label] : [], querySelector: () => heading }
    const doc: any = { getElementById: () => editor, defaultView: view }
    requestRecordFieldFocus("r1", ["Covered by another record?"])
    expect(focusRecordEditor("r1", doc)).toBe(heading)
    expect(focused).toEqual(["heading"])
    timers.splice(0).forEach(fn => fn()) // the form chunk is still loading
    rendered = true
    timers.splice(0).forEach(fn => fn())
    expect(focused).toEqual(["heading", "select"])
    expect(label.dataset.fixTarget).toBe("true")
    // A Fix that names no field focuses the heading and waits for nothing.
    focused.length = 0; timers.length = 0
    requestRecordFieldFocus("r2", [])
    expect(focusRecordEditor("r2", doc)).toBe(heading)
    timers.splice(0).forEach(fn => fn())
    expect(focused).toEqual(["heading"])
  })
})

// BF-01 (part A): a held possible duplicate is resolved by withdrawing or correcting it; a counted one is named.
describe("BF-01: possible duplicate Scope 3 records", () => {
  test("hold mode: the to-do names the reason and offers Withdraw or correct on the record", () => {
    const data = clone(fixture) as any
    const line = data.records.find((r: any) => r.sourceId === "W-2")
    line.plan = { ...line.plan, reasons: ["possible_duplicate_record"], notes: ["possible_duplicate_of:93000000-0000-4000-8000-000000001002"] }
    const item = scope3Todos(data).find(todo => todo.kind === "line" && todo.recordId === line.recordId)!
    expect(item.reasons).toContain(reasonText("possible_duplicate_record"))
    expect(item.actions).toEqual([{ type: "fix", recordId: line.recordId, fields: [SCOPE3_WITHDRAW_CONTROL], label: "Withdraw or correct" }])
  })
  test("count mode: a counted line with the note carries the possible_duplicate_counted reason (screen, print and CSV)", async () => {
    const { scope3LineReasonCodes } = await import("./scope3-results-api")
    const data = clone(fixture) as any
    const line = data.records.find((r: any) => r.outcome === "calculated" && r.derivedFrom === null)
    expect(scope3LineReasonCodes(line)).not.toContain("possible_duplicate_counted")
    line.plan = { ...line.plan, notes: [...line.plan.notes, "possible_duplicate_of:93000000-0000-4000-8000-000000001002"] }
    expect(scope3LineReasonCodes(line)).toContain("possible_duplicate_counted")
    expect(reasonText("possible_duplicate_counted")).toContain("It is counted in these totals")
  })
})
