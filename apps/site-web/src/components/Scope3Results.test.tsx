import { decodeScope3Results } from "@/lib/scope3-results-decode"
/* eslint-disable @typescript-eslint/no-explicit-any -- The injected harness runs the actual Scope 3 components without a browser DOM. */
// Scope 3 package 2 (Claude, 26 October 2026), S3-04 and S3-13: the Scope 3 section of the Results screen, the printed
// report and the Scope 3 CSV show the same statuses and the same engine figures, for the route's own output.
import { describe, expect, test } from "bun:test"
import * as plainLanguage from "@/lib/plain-language"
import * as resultsApi from "@/lib/results-api"
import * as scope3ResultsApi from "@/lib/scope3-results-api"
import type { Scope3ResultsResponse } from "@/lib/scope3-results-api"
import { scope3RestampResults } from "../../../../packages/neuvetra-database/test-support/scope3-results-restamp"
import * as scope3Checklist from "@/lib/scope3-checklist"
import * as scope3ResultsText from "@/lib/scope3-results-text"
import * as scope3FixTarget from "@/lib/scope3-fix-target"
// Round 3 lane D: the display rules and texts the Scope 3 panel now uses (decision 5, PR-7..PR-13).
import * as scope3DisplayR3d from "@/lib/scope3-display-r3d"
import * as scope3TextR3d from "@/lib/scope3-text-r3d"
import { scope3ClosedLines, scope3LineState } from "../../../../packages/neuvetra-database/src/scope3-trace"
import { scope3SpendConversionNote } from "../../../../packages/neuvetra-database/src/scope3-spend-currency"
import { validateScope3ReportDocument } from "../../../../packages/neuvetra-database/src/scope3-report-document"

const fixture: Scope3ResultsResponse = await Bun.file(new URL("../lib/scope3-results.fixture.json", import.meta.url)).json()
const downstreamFixture: unknown = await Bun.file(new URL("../lib/scope3-results-downstream.fixture.json", import.meta.url)).json()
const source = await Bun.file(new URL("./Scope3Results.tsx", import.meta.url)).text()
const script = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } })
  .transformSync(source.replace(/^import .*\n/gm, "").replace(/^export /gm, "")) + "\nreturn { Scope3Panel, Scope3ReportSection, INITIAL_SCOPE3_STATE }"
type Node = { type: unknown; props: Record<string, any>; children: any[] }
const flatten = (value: any): Node[] => Array.isArray(value) ? value.flatMap(flatten) : value && typeof value === "object" && "children" in value ? [value, ...value.children.flatMap(flatten)] : []
const text = (value: any): string => Array.isArray(value) ? value.map(text).join("") : value && typeof value === "object" && "children" in value ? text(value.children) : value == null || typeof value === "boolean" ? "" : String(value)
/** Round 2 lane D (UX-9): record cards are grouped by category, so a line's card is found by its title, not its index. */
const cardOf = (nodes: Node[], row: { kind: string; sourceId: string; category: number }) => nodes.filter(node => node.props.className === "nv-record-card").find(card => text(flatten(card).find(node => node.props.className === "nv-record-card__title")!) === `${plainLanguage.kindLabel(row.kind)} · ${row.sourceId} · category ${row.category}`)!

function load() {
  let csv = "", filename = ""
  const env: Record<string, unknown> = {
    ...plainLanguage, ...resultsApi, ...scope3ResultsApi, ...scope3Checklist, ...scope3ResultsText, ...scope3DisplayR3d, ...scope3TextR3d, ...scope3FixTarget, scope3ClosedLines, scope3LineState, scope3SpendConversionNote,
    h: (type: any, props: any, ...children: any[]) => typeof type === "function" ? type({ ...props, children }) : { type, props: props ?? {}, children },
    React: { Fragment: "fragment" }, Icon: () => null, Scope3ReportVersions: () => null,
    Blob: class { constructor(parts: string[]) { csv = parts.join("") } },
    URL: { createObjectURL: () => "blob:scope3", revokeObjectURL: () => {} },
    document: { createElement: () => { const link: any = { click: () => { filename = link.download } }; return link } },
    window: { setTimeout: () => 0, requestAnimationFrame: () => 0 },
  }
  const components = new Function(...Object.keys(env), script)(...Object.values(env))
  return { ...components, csv: () => csv, filename: () => filename }
}

describe("the Scope 3 section (S3-04, S3-13)", () => {
  test("screen, print and CSV agree on every category and record", () => {
    const { Scope3Panel, Scope3ReportSection, csv, filename } = load()
    const fixes: string[] = []
    const screen = flatten(Scope3Panel({ state: { data: fixture, message: null, unavailable: false, busy: false }, canManage: true, onFix: (id: string) => fixes.push(id), onRetry() {} }))
    const printed = flatten(Scope3ReportSection({ results: fixture }))
    screen.find(node => node.type === "button" && text(node).includes("Download Scope 3 CSV"))!.props.onClick()
    expect(filename()).toBe(`neuvetra-draft-scope3-${fixture.generatedAt.slice(0, 10)}.csv`)
    expect(csv()).toBe(scope3ResultsApi.scope3Csv(fixture, { kind: plainLanguage.kindLabel, reason: plainLanguage.reasonText, period: plainLanguage.periodLabel, quality: code => plainLanguage.QUALITY_LABELS[code] ?? code, unit: code => plainLanguage.shortUnit(code) }))

    const screenText = text(screen), printedText = text(printed)
    expect(screenText).toContain("Never added to Scope 1 or Scope 2.")
    expect(printedText).toContain("Scope 3 is never added to the Scope 1 and 2 totals above.")
    const total = fixture.coverage.knownSourceSubtotal!.display
    // Round 2 lane D (UX-9): the screen shows t CO2e (2 decimals); the exact kg is in print, the CSV and on hover.
    expect(screenText).toContain(`${plainLanguage.kgToTonnes(fixture.coverage.knownSourceSubtotal!.unrounded)}t CO2e`)
    expect(screenText).not.toContain(plainLanguage.groupDigits(total))
    expect(printedText).toContain(`Known-source subtotal: ${plainLanguage.groupDigits(total)} kg CO2e`)
    expect(screenText).toContain(fixture.coverage.proposedMandatory.line)
    expect(printedText).toContain(fixture.coverage.proposedMandatory.line)

    // Category tables: the same status words on screen and in print, and "—" (never 0) where nothing was calculated.
    const tableRows = (nodes: Node[]) => flatten(nodes.find(node => node.type === "tbody")).filter(node => node.type === "tr").map(row => row.children.flat(Infinity).filter((cell: any) => cell?.type === "td").map(text))
    const screenCategories = tableRows(screen), printedCategories = tableRows(printed)
    expect(screenCategories).toHaveLength(15)
    expect(printedCategories).toHaveLength(15)
    fixture.coverage.categories.forEach((category, index) => {
      const status = scope3ResultsApi.SCOPE3_STATUS_TEXT[category.status]
      expect(screenCategories[index]![1]!.startsWith(status)).toBe(true)
      expect(printedCategories[index]![1]).toBe(status)
      // I-06 (assurance-ux M9): t CO2e is the engine's own figure (profile), with kg beside it in print and on hover on screen.
      expect(printedCategories[index]![3]).toBe(category.profile ? plainLanguage.groupDigits(category.profile.subtotalTonnes.display) : "—")
      expect(printedCategories[index]![4]).toBe(category.subtotal ? plainLanguage.groupDigits(category.subtotal.display) : "—")
      // Round 2 lane D (UX-9): on screen, t CO2e to 2 fixed decimals (half-even from the engine's kg).
      expect(screenCategories[index]![4]!.startsWith(category.subtotal ? scope3Checklist.scope3Tonnes(category.subtotal.unrounded) : "—")).toBe(true)
    })

    // Record cards and printed record rows: the same status and the engine's own figure.
    const cards = screen.filter(node => node.props.className === "nv-record-card")
    expect(cards).toHaveLength(fixture.records.length)
    const printedRecords = flatten(printed.filter(node => node.type === "tbody")[1]).filter(node => node.type === "tr").map(row => row.children.flat(Infinity).filter((cell: any) => cell?.type === "td").map(text))
    expect(printedRecords).toHaveLength(fixture.records.length)
    fixture.records.forEach((record, index) => {
      const card = cardOf(screen, record)
      const chip = text(flatten(card).find(node => String(node.props.className ?? "").startsWith("nv-chip"))!)
      expect(printedRecords[index]![5]!.startsWith(chip)).toBe(true)
      expect(printedRecords[index]![6]).toBe(record.result?.total ? plainLanguage.groupDigits(record.result.total.display) : "—")
      // Round 2 lane D (UX-9): the card shows t CO2e; the exact kg is in its calculation details.
      if (record.result?.total) { expect(text(card)).toContain(`${scope3Checklist.scope3Tonnes(record.result.total.unrounded)} t CO2e`); expect(text(card)).toContain(`${record.result.total.unrounded} kg CO2e before display rounding`) }
    })

    // Fix opens the record; a grid-loss line is fixed on its electricity record, so it has no Fix button of its own (I-12u: nor
    // have the 3C upstream, 3B and 3A lines, fixed on their electricity or fuel record).
    // Round 2 lane D: the cards' own Fix buttons (the to-do list above has its own, tested separately).
    for (const button of cards.flatMap(card => flatten(card)).filter(node => node.type === "button" && text(node) === "Fix")) button.props.onClick()
    expect(fixes.sort()).toEqual(fixture.records.filter(row => !["td_losses", "td_losses_upstream", "electricity_upstream", "fuel_upstream"].includes(row.kind) && row.outcome !== "calculated" && row.plan.status !== "withdrawn" && row.plan.status !== "excluded").map(row => row.recordId).sort())
    expect(printedText).toContain("unreleased beta")
  })

  // BF-07 (S3C-02): the engine's 4-dp display of 5014.99996 is 5015.0000; rounding that again gives 5.02 t. The screen rounds the
  // unrounded figure once (5.01 t); the kg beside it (hover, print) stays the engine's display, and the CSV bytes do not change.
  test("BF-07: headline, category and record tonnes round the unrounded kg once, not the 4-dp display", () => {
    const { Scope3Panel } = load()
    const data = structuredClone(fixture)
    const tie = { unrounded: "5014.99996", display: "5015.0000", unit: "kg CO2e", rounding: "half_even_4dp_once" }
    data.coverage.knownSourceSubtotal = tie as never
    const category = data.coverage.categories.find(row => row.subtotal)!
    category.subtotal = tie as never
    const screenText = text(Scope3Panel({ state: { data, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} }))
    expect(screenText).toContain("5.01t CO2e")
    expect(screenText).not.toContain("5.02")
    expect(plainLanguage.kgToTonnes(tie.display)).toBe("5.02") // the old, double-rounded figure this replaces
  })

  test("before schema 29, or while loading, the section says so and shows no figure", () => {
    const { Scope3Panel, INITIAL_SCOPE3_STATE } = load()
    const props = { canManage: true, onFix() {}, onRetry() {} }
    expect(text(Scope3Panel({ ...props, state: { ...INITIAL_SCOPE3_STATE, unavailable: true } }))).toContain("Scope 3 isn’t switched on in this environment yet.")
    expect(text(Scope3Panel({ ...props, state: { ...INITIAL_SCOPE3_STATE, busy: true } }))).toBe("Scope 3Calculating Scope 3…")
    expect(Scope3Panel({ ...props, state: INITIAL_SCOPE3_STATE })).toBeNull()
    let retried = 0
    const failed = flatten(Scope3Panel({ ...props, onRetry: () => retried++, state: { ...INITIAL_SCOPE3_STATE, message: "Scope 3 results could not be prepared or verified. Try again shortly." } }))
    expect(text(failed)).toContain("could not be prepared or verified")
    failed.find(node => node.type === "button")!.props.onClick()
    expect(retried).toBe(1)
  })
})

// API-02 (Scope 3 package 2 r2, Claude, 27 October 2026): the decoder refuses every response the screen, print or CSV
// can't show truthfully, and anything it accepts renders on all three.
describe("API-02: a response the decoder accepts always renders, and never shows a figure it shouldn't", () => {
  const company = fixture.companyId
  const decodes = (response: unknown) => { try { decodeScope3Results(structuredClone(response), company); return true } catch { return false } }
  const calculated = (r: any) => r.records.find((row: any) => row.outcome === "calculated" && row.result.status === "complete")
  const emptyCategory = (r: any) => r.coverage.categories.find((row: any) => row.subtotal === null)

  test("the review's malformed responses are refused", () => {
    const cases: [string, (r: any) => void][] = [
      ["a category without its screening", r => { delete r.coverage.categories[0].screening }],
      ["a complete result without its boundary", r => { delete calculated(r).result.boundary }],
      ["a record without its period", r => { delete calculated(r).period }],
      ["a figure beside Needs input", r => { calculated(r).result.status = "input_needed" }],
      ["a category with nothing calculated, no counts and a zero subtotal", r => { const row = emptyCategory(r); row.counts = {}; row.subtotal = { unrounded: "0", display: "0.0000", unit: "kg CO2e", rounding: "half_even_4dp_once" }; row.subtotalBasis = "all_counted_records" }],
      ["a known-source subtotal that isn't the sum of the lines", r => { r.coverage.knownSourceSubtotal = { ...r.coverage.knownSourceSubtotal, unrounded: "123.4", display: "123.4000" } }],
      ["a category subtotal that isn't the sum of its lines", r => { const row = r.coverage.categories.find((c: any) => c.subtotal); row.subtotal = { ...row.subtotal, unrounded: "1", display: "1.0000" } }],
      ["a total whose display isn't its rounded value", r => { calculated(r).result.total.display = "9.9999" }],
      ["a negative total", r => { const t = calculated(r).result.total; t.unrounded = `-${t.unrounded}`; t.display = `-${t.display}` }],
      ["counts that don't add up", r => { r.coverage.categories.find((c: any) => c.counts.records > 0).counts.records += 1 }],
      ["counts that don't match the category's lines", r => { const row = r.coverage.categories.find((c: any) => c.counts.calculated > 0); row.counts.calculated -= 1; row.counts.inputNeeded += 1 }],
      ["fractional counts", r => { r.coverage.categories[0].counts.records = 0.5 }],
      ["a status the counts contradict", r => { r.coverage.categories.find((c: any) => c.status === "input_needed").status = "calculated" }],
      ["an unknown record kind", r => { calculated(r).kind = "hotel_stays" }],
      ["a kind in the wrong category", r => { const row = r.records.find((x: any) => x.kind === "employee_commuting"); row.category = 4 }],
      ["an unknown evidence status", r => { r.records[0].evidence = [{ id: "93000000-0000-4000-8000-0000000000e9", name: "x.pdf", sha256: null, status: "infected" }] }],
      ["a warning that isn't text", r => { r.warnings = [{ text: "x" }] }],
      ["unmatched screening that isn't a list of names", r => { r.unmatchedScreening = "legacy" }],
      ["a missing CARB line", r => { delete r.coverage.proposedMandatory.line }],
      ["a disclosure without text", r => { r.coverage.disclosures[0].text = null }],
      ["no generatedAt", r => { delete r.generatedAt }],
      ["grid losses without a count", r => { r.gridLosses.electricityRecords = "two" }],
    ]
    expect(decodes(fixture)).toBe(true)
    for (const [name, tamper] of cases) {
      const response = structuredClone(fixture) as any
      tamper(response)
      expect([name, decodes(response)]).toEqual([name, false])
    }
  })

  test("sweep: every field deleted, nulled or given the wrong type is either refused or still renders on screen, print and CSV", () => {
    const { Scope3Panel, Scope3ReportSection } = load()
    const paths: (string | number)[][] = []
    const walk = (value: unknown, path: (string | number)[]) => {
      if (path.length) paths.push(path)
      if (Array.isArray(value)) value.forEach((item, index) => walk(item, [...path, index]))
      else if (value && typeof value === "object") for (const key of Object.keys(value)) walk((value as Record<string, unknown>)[key], [...path, key])
    }
    walk(fixture, [])
    const mutations: [string, (parent: any, key: string | number) => void][] = [
      ["deleted", (parent, key) => { if (Array.isArray(parent)) parent.splice(Number(key), 1); else delete parent[key] }],
      ["null", (parent, key) => { parent[key] = null }],
      ["text", (parent, key) => { parent[key] = "x" }],
      ["number", (parent, key) => { parent[key] = 7 }],
      ["object", (parent, key) => { parent[key] = {} }],
    ]
    let accepted = 0, refused = 0
    for (const path of paths) for (const [how, mutate] of mutations) {
      const response = structuredClone(fixture) as any
      const parent = path.slice(0, -1).reduce((node: any, key) => node[key], response)
      mutate(parent, path[path.length - 1]!)
      let decoded: scope3ResultsApi.Scope3ResultsResponse
      try { decoded = decodeScope3Results(response, company) } catch { refused++; continue }
      accepted++
      const where = `${path.join(".")} ${how}`
      expect([where, (() => {
        try {
          text(Scope3Panel({ state: { data: decoded, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} }))
          text(Scope3ReportSection({ results: decoded }))
          scope3ResultsApi.scope3Csv(decoded, { kind: plainLanguage.kindLabel, reason: plainLanguage.reasonText, period: plainLanguage.periodLabel, quality: code => plainLanguage.QUALITY_LABELS[code] ?? code, unit: code => plainLanguage.shortUnit(code) })
          return "renders"
        } catch (error) { return `throws ${(error as Error).message}` }
      })()]).toEqual([where, "renders"])
    }
    expect(refused).toBeGreaterThan(accepted / 4) // the sweep reached the checks
    console.log(`API-02 sweep: ${paths.length} fields x ${mutations.length} mutations, ${refused} refused, ${accepted} accepted and rendered`)
  }, 300_000) // about 6,700 decodes and renders (I-12u: about 9,700, the fixture has five more category 3 lines): a loaded runner passes 120 s
})

describe("ACCT-01 and ACCT-02: the Scope 3 section claims nothing it doesn't know, and names every unmatched screening answer", () => {
  test("ACCT-01: before schema 29 it says Scope 1 and 2 are still available, never that they are complete", () => {
    const { Scope3Panel, INITIAL_SCOPE3_STATE } = load()
    const said = text(Scope3Panel({ canManage: true, onFix() {}, onRetry() {}, state: { ...INITIAL_SCOPE3_STATE, unavailable: true } }))
    expect(said).toContain("The Scope 1 and 2 results above are still available; Scope 3 never changes them.")
    expect(said).not.toMatch(/complete/i)
  })

  test("ACCT-02: unmatched screening answers are listed by name on screen, in print and in the CSV, with the warning", () => {
    const { Scope3Panel, Scope3ReportSection, csv } = load()
    const warning = "Some Scope 3 screening answers in company setup name a category that isn't one of the 15; they are listed separately."
    const results = decodeScope3Results({ ...structuredClone(fixture), unmatchedScreening: ["legacy_purchased_services", "=hotel stays"], warnings: [warning] }, fixture.companyId)
    const screen = flatten(Scope3Panel({ state: { data: results, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} }))
    const printed = text(Scope3ReportSection({ results }))
    screen.find(node => node.type === "button" && text(node).includes("Download Scope 3 CSV"))!.props.onClick()
    for (const name of ["legacy_purchased_services", "=hotel stays"]) {
      expect(text(screen)).toContain(`“${name}”`)
      expect(printed).toContain(`“${name}”`)
      expect(csv()).toContain(`# Unmatched Scope 3 screening answer (not one of the 15 categories, not counted for any category): ${name}`)
    }
    expect(text(screen)).toContain(warning)
    expect(printed).toContain(warning) // print used to omit the warning
    // Without unmatched answers nothing is added.
    const plain = flatten(Scope3Panel({ state: { data: fixture, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} }))
    expect(text(plain)).not.toContain("aren’t one of the 15 categories")
    expect(text(Scope3ReportSection({ results: fixture }))).not.toContain("not matched")
  })
})

// Scope 3 completion I-04: audit D14 (every reason on the record card, as print and CSV), the provisional SB 253 deadline,
// the calendar-2025 limitation and the base-year statement on screen and in print, and lines awaiting a factor source.
describe("I-04: reasons, statements and method-pending lines", () => {
  const panel = (data: Scope3ResultsResponse) => flatten(load().Scope3Panel({ state: { data, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} }))
  test("D14: a record card shows every reason, not the first three", () => {
    const data = structuredClone(fixture)
    const row = data.records.find(item => item.outcome === "held" && item.plan.status === "input_needed")!
    row.plan.reasons = ["unit_not_an_engine_token", "material_not_an_engine_token", "treatment_not_an_engine_token", "quantity_not_calculable", "location_inclusion_unknown"]
    const decoded = decodeScope3Results(data, fixture.companyId)
    const card = cardOf(panel(decoded), row)
    const shown = flatten(card).filter(node => node.props.className === "nv-record-card__reason").map(text)
    expect(shown).toEqual(row.plan.reasons.map(plainLanguage.reasonText))
  })

  test("the provisional deadline, the limitation and the base year appear on screen and in print", () => {
    const lines = scope3ResultsApi.scope3StatementLines(fixture)
    expect(lines).toEqual(["Provisional first SB 253 Scope 3 report: due 10 November 2027, for the fiscal year ending 31 December 2026. Provisional: CARB has not adopted the 2027 Scope 3 rule; Scope 3 is not required for 2026 reporting (17 CCR 96076(a)).",
      "Scope 3 records may cover 2025 and 2026 in this beta (fiscal year 2026, the first expected SB 253 Scope 3 report, and fiscal years spanning two calendar years), inside the reporting period in company setup. Factors stay the latest published editions, disclosed on each later line; Scope 1 and 2 for periods after 2025 are a separate package.", "Scope 3 base year: not yet established."])
    const screen = text(panel(fixture)), printed = text(load().Scope3ReportSection({ results: fixture }))
    for (const line of lines) { expect(screen).toContain(line); expect(printed).toContain(line) }
    // No reporting period end: no deadline line, the other two stay.
    expect(scope3ResultsApi.scope3StatementLines({ setup: null })).toEqual(lines.slice(1))
  })

  test("a method-pending line says it awaits its factor source (or is optional), with no Fix button", () => {
    const data = structuredClone(fixture) as any
    const base = data.records.find((row: any) => row.kind === "waste" && row.outcome === "held")
    for (const optional of [false, true]) data.records.push({ ...structuredClone(base), recordId: crypto.randomUUID(), versionId: crypto.randomUUID(), kind: "business_travel", category: 6,
      plan: { action: "hold", status: "method_pending", reasons: ["factor_source_not_yet_loaded"], notes: [], ...(optional ? { optional: true } : {}) } })
    Object.assign(data.coverage.categories[5].counts, { records: data.coverage.categories[5].counts.records + 2, methodPending: 1, optionalPending: 1 })
    Object.assign(data.coverage.categories[5], { status: "awaiting_factor_source", subtotalBasis: "known_sources_only" })
    // I-06: the methodology statement the route would send for the changed category (the decoder checks it).
    scope3RestampResults(data) // round 2: every field the decoder re-derives from the lines
    const decoded = decodeScope3Results(data, fixture.companyId)
    // Both added lines share a title (same source ID and kind): their cards are the category 6 group's last two.
    const titled = (row: typeof decoded.records[number]) => `${plainLanguage.kindLabel(row.kind)} · ${row.sourceId} · category ${row.category}`
    const cards = panel(decoded).filter(node => node.props.className === "nv-record-card" && text(flatten(node).find(x => x.props.className === "nv-record-card__title")!) === titled(decoded.records.at(-1)!)).slice(-2)
    expect(cards.map(card => text(flatten(card).find(node => String(node.props.className ?? "").startsWith("nv-chip"))!))).toEqual(["Awaiting factor source", "Optional, not yet quantified"])
    expect(cards.every(card => !flatten(card).some(node => node.type === "button"))).toBe(true)
    expect(text(panel(decoded))).toContain(scope3ResultsApi.SCOPE3_STATUS_TEXT.awaiting_factor_source)
  })
})

// Scope 3 completion I-06 (DESIGN 6.2; assurance-ux M4, M6, M9): every line's calculation details (folded on screen,
// open in print), the category profile columns, the methodology statement, the exclusion register and the total line.
describe("I-06: calculation details, profiles, methodology, exclusion register and the total line", () => {
  const { Scope3Panel, Scope3ReportSection } = load()
  const screen = flatten(Scope3Panel({ state: { data: fixture, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} }))
  const printed = flatten(Scope3ReportSection({ results: fixture }))
  const screenText = text(screen), printedText = text(printed)

  test("each record card folds its calculation details: factors with source cells, conversions, gases, GWP set and both SHA-256", () => {
    fixture.records.forEach(row => {
      const details = flatten(cardOf(screen, row)).find(node => node.type === "details")!
      expect(text(details.children[0])).toBe("Calculation details")
      const shown = text(details)
      expect(shown).toContain(row.recordId)
      if (!row.result) { expect(shown).toContain("Not calculated: no engine result for this record."); return }
      for (const f of row.result.factorsUsed as Array<{ key: string; value: string; cell: string }>) expect(shown).toContain(`${f.key} = ${f.value}`)
      // Round 3 lane D (PR-8): the cell's transcription tag is in words ("transcribed from the source document (read twice)").
      for (const f of row.result.factorsUsed as Array<{ cell: string }>) expect(shown).toContain(`cell ${scope3DisplayR3d.scope3ProvenanceText(f.cell)}`)
      expect(shown).not.toContain("webfetch_double_read")
      expect(shown).toContain(row.result.inputSha256)
      expect(shown).toContain(row.result.resultSha256)
      expect(shown).toContain(`GWP set ${row.result.gwpSetId}`)
      for (const c of row.result.conversions as Array<{ result: string }>) expect(shown).toContain(c.result)
      if (row.result.total) expect(shown).toContain(`${row.result.total.unrounded} kg CO2e before display rounding`)
    })
    // The spend line's company-set rating is marked as set by the user; method defaults as default.
    const spend = cardOf(screen, fixture.records.find(row => row.kind === "purchase_spend")!)
    const badges = flatten(spend).filter(node => node.props.className === "nv-badge").map(text)
    expect(badges).toContain("Ti very good · set by user")
    expect(badges).toContain("T poor · default")
  })

  test("print shows every line's details open, the profile columns, the methodology and the exclusion register", () => {
    expect(printed.some(node => node.type === "details")).toBe(false)
    for (const row of fixture.records.filter(item => item.result)) expect(printedText).toContain(row.result!.resultSha256)
    for (const row of fixture.coverage.categories) for (const sentence of row.methodology) { expect(printedText).toContain(sentence.text); expect(screenText).toContain(sentence.text) }
    const two = fixture.coverage.categories[1]!
    // Round 2 lane D (UX-9): print keeps kg; the screen shows t CO2e.
    expect(printedText).toContain(`spend-based ${plainLanguage.groupDigits(two.profile!.methodTypes.spend_based!.display)} kg`)
    expect(screenText).toContain(`spend-based ${scope3Checklist.scope3Tonnes(two.profile!.methodTypes.spend_based!.display)} t`)
    for (const shown of [screenText, printedText]) {
      expect(shown).toContain("22.8%")
      expect(shown).toContain("Exclusion register")
      expect(shown).toContain("Magnitudes are the company’s own estimates; they are never added to any total.")
    }
    // Round 3 lane D (decision 5): the indicator scores and the weighted score as numbers; the label is the capped one.
    expect(printedText).toContain("T 3.32 / Ti 1.23 / G 1.77 / C 2.77 / R 3.00 / weighted 2.42")
    expect(screenText).toContain("goodweighted score 2.42")
  })

  test("the total line names the categories it includes and leaves out, and is known sources only (M9)", () => {
    const total = scope3ResultsApi.scope3TotalStatement(fixture.coverage.categories)
    expect(total.basis).toBe("known_sources_only")
    expect(total.includes).toEqual(fixture.coverage.categories.filter(row => row.subtotal).map(row => row.category))
    // Round 2 lane D (UX-9): print states the exact tonnes and kg; the screen t CO2e to 2 decimals.
    expect(printedText).toContain(`Scope 3 total (known sources only): ${plainLanguage.groupDigits(scope3ResultsApi.scope3KgToTonnesExact(fixture.coverage.knownSourceSubtotal!.display))} t CO2e`)
    expect(screenText).toContain(`Scope 3 total (known sources only): ${scope3Checklist.scope3Tonnes(fixture.coverage.knownSourceSubtotal!.display)} t CO2e`)
    for (const shown of [screenText, printedText]) for (const line of total.lines) expect(shown).toContain(line)
    expect(total.lines[0]).toBe(`Includes categories ${total.includes.join(", ")}.`)
  })
})

describe("I-07: biogenic CO2 and memo items on screen and in print, beside the totals and never in them", () => {
  const downstream: Scope3ResultsResponse = decodeScope3Results(downstreamFixture, "93900000-0000-4000-8000-000000000001")
  const { Scope3Panel, Scope3ReportSection } = load()
  const screen = flatten(Scope3Panel({ state: { data: downstream, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} }))
  const printed = flatten(Scope3ReportSection({ results: downstream }))
  const eleven = downstream.coverage.categories[10]!, fifteen = downstream.coverage.categories[14]!
  const bioLine = downstream.records.find(row => row.result?.biogenicCo2)!, memoLine = downstream.records.find(row => row.result?.memoItems?.some(m => m.code === "projected_lifetime_emissions"))!

  test("the category table's biogenic column and the memo line name the engine's figures; the total is the known-source total alone", () => {
    // Round 2 lane D (UX-9): print keeps kg; the screen shows the same figures in t (t CO2 for biogenic), 2 decimals.
    expect(text(screen)).toContain(`${scope3Checklist.scope3Tonnes(eleven.profile!.biogenicCo2!.display)} t CO2`)
    // Round 3, lane A (owner decision 3): category 11 now also memos the gas left in sold products at end of life (its own words).
    const eol = eleven.profile!.memoItems.ghg_product_end_of_life_remaining_charge!.display
    expect(text(screen)).toContain(`Reported separately (memo, not in any total): category 11: gas left in sold products at end of life, upper bound ${scope3Checklist.scope3Tonnes(eol)} t CO2e; category 15: projected lifetime emissions ${scope3Checklist.scope3Tonnes(fifteen.profile!.memoItems.projected_lifetime_emissions!.display)} t CO2e.`)
    expect(text(printed)).toContain(`${plainLanguage.groupDigits(eleven.profile!.biogenicCo2!.display)} kg CO2`)
    expect(text(printed)).toContain(`Reported separately (memo, not in any total): category 11: gas left in sold products at end of life, upper bound ${plainLanguage.groupDigits(eol)} kg CO2e; category 15: projected lifetime emissions ${plainLanguage.groupDigits(fifteen.profile!.memoItems.projected_lifetime_emissions!.display)} kg CO2e.`)
    expect(text(printed)).toContain(`Scope 3 total (known sources only): ${plainLanguage.groupDigits(scope3ResultsApi.scope3KgToTonnesExact(downstream.coverage.knownSourceSubtotal!.display))} t CO2e`)
    for (const shown of [text(screen), text(printed)]) {
      for (const row of downstream.coverage.categories) for (const sentence of row.methodology) expect(shown).toContain(sentence.text)
    }
  })

  test("the line's calculation details show its biogenic CO2 with its basis, and its memo item, apart from the exact total", () => {
    const details = (row: typeof bioLine) => text(flatten(cardOf(screen, row)).find(node => node.type === "details")!)
    expect(details(bioLine)).toContain(`Biogenic CO2 (outside totals)${bioLine.result!.biogenicCo2!.mass} kg CO2 · ${bioLine.result!.biogenicCo2!.basis}`)
    expect(details(bioLine)).toContain(`Exact total${bioLine.result!.total!.unrounded} kg CO2e before display rounding`)
    expect(details(memoLine)).toContain(`Reported separately (memo, not in any total)projected lifetime emissions: ${memoLine.result!.memoItems![0]!.kg} kg CO2e`)
    for (const row of [bioLine, memoLine]) expect(text(printed)).toContain(row.result!.resultSha256)
    expect(text(printed)).toContain(bioLine.result!.biogenicCo2!.basis)
  })
})

// Round 2, lane D (Claude, 31 October 2026): the to-do list on Results (UX-2), Fix landing on its field and never on a line
// with nothing to fix (UX-3), the inline assessment (UX-5), one unit, quiet review flags, grouped disclosures and record
// filters (UX-9), and the empty company's call to action (UX-23).
describe("round 2: the Scope 3 to-do list, Fix, units, filters and the empty company", () => {
  const ui = (extra: Record<string, unknown> = {}) => {
    const calls: any[] = []
    return { calls, ui: { filter: scope3Checklist.SCOPE3_DEFAULT_RECORD_FILTER, setFilter: (f: unknown) => calls.push(["filter", f]), limit: 25, setLimit: (n: number) => calls.push(["limit", n]), assessment: null, setAssessment: (c: number | null) => calls.push(["assessment", c]), todosOpen: true, setTodosOpen: (o: boolean) => calls.push(["todos", o]), renderAssessment: (c: number) => ({ type: "inline-assessment", props: { category: c }, children: [] }), ...extra } }
  }
  const render = (data: Scope3ResultsResponse, extra: Record<string, unknown> = {}, props: Record<string, unknown> = {}) => {
    const fixes: string[] = [], navigations: string[] = [], u = ui(extra)
    const nodes = flatten(load().Scope3Panel({ state: { data, message: null, unavailable: false, busy: false }, canManage: true, onFix: (id: string) => fixes.push(id), onRetry() {}, onNavigate: (v: string) => navigations.push(v), reports: { companyId: data.companyId, actor: {} }, ui: u.ui, ...props }))
    return { nodes, fixes, navigations, calls: u.calls }
  }
  const todoSection = (nodes: Node[]) => nodes.find(node => node.props.id === "scope3-todo")!

  test("every to-do is listed with its reasons and actions; Fix asks the editor to focus the named field and opens the record", () => {
    const { nodes, fixes } = render(fixture)
    const section = todoSection(nodes), todos = scope3Checklist.scope3Todos(fixture)
    const items = flatten(section).filter(node => node.props.className === "s3-todo__item")
    expect(items).toHaveLength(todos.length)
    expect(text(section)).toContain(`${todos.length} to do · ${todos.filter(t => t.blocking).length} block approval`)
    for (const todo of todos) for (const reason of todo.reasons) expect(text(section)).toContain(reason)
    const w2 = items.find(item => text(item).includes("Waste · W-2"))!
    flatten(w2).find(node => node.type === "button" && text(node) === "Fix")!.props.onClick()
    const row = fixture.records.find(r => r.sourceId === "W-2")!
    expect(fixes).toEqual([row.recordId])
    expect(scope3FixTarget.takeRecordFieldFocus(row.recordId)).toEqual(["Material"])
    // Fix buttons carry the item in their accessible name.
    expect(flatten(w2).find(node => node.type === "button")!.props["aria-label"]).toBe("Fix: Waste · W-2")
  })

  test("category rows: reasons per record behind a count, the next step as a button; the inline assessment opens in the to-do list", () => {
    const { nodes, calls, navigations } = render(fixture)
    const rows = flatten(nodes.find(node => node.type === "tbody")).filter(node => node.type === "tr")
    const five = rows[4]!
    expect(text(flatten(five).find(node => node.props.className === "s3-issues")!)).toContain("Waste · W-2:")
    const button = flatten(five).find(node => node.type === "button")!
    expect(text(button)).toBe("Fix 1 record")
    const seven = rows[6]!
    flatten(seven).find(node => node.type === "button")!.props.onClick()
    expect(calls).toContainEqual(["assessment", 7])
    // Not screened categories go to company setup.
    const eight = rows[7]!
    flatten(eight).find(node => node.type === "button")!.props.onClick()
    expect(navigations).toEqual(["setup"])
    // With category 7 open, its editor is rendered inside the to-do list's category 7 group.
    const open = render(fixture, { assessment: 7 })
    const group = flatten(todoSection(open.nodes)).find(node => node.props.id === "scope3-todo-cat-7")!
    expect(flatten(group).some(node => node.type === "inline-assessment" && node.props.category === 7)).toBe(true)
  })

  test("UX-3: no Fix on a calculated partial-boundary derived line: its reason is shown instead", () => {
    const { nodes } = render(fixture)
    const m1 = fixture.records.find(r => r.kind === "electricity_upstream" && r.outcome === "calculated")!
    const card = cardOf(nodes, m1)
    expect(flatten(card).some(node => node.type === "button")).toBe(false)
    // Round 3, lane A (owner decision 2): the fully counted fuels and coal apart (mine methane only), never "cover 100%".
    expect(text(card)).toContain("Partial boundary: natural gas and oil are fully counted (")
    expect(text(card)).toContain("% of the fossil heat input) counts mine methane only")
    expect(text(card)).not.toContain("upstream factors cover")
  })

  test("UX-9: the screen shows t CO2e only (kg in details and on hover); the 10% flag no longer fires on small categories; disclosures are grouped", () => {
    const { nodes } = render(fixture)
    const table = nodes.find(node => node.type === "table")!
    expect(text(table)).not.toMatch(/\d kg/)
    expect(text(table)).not.toContain("a single record is more than 10%")
    for (const card of nodes.filter(node => node.props.className === "nv-record-card")) {
      const side = flatten(card).find(node => node.props.className === "nv-record-card__side")!
      expect(text(side)).not.toMatch(/\d kg/)
    }
    const groups = nodes.filter(node => node.props.className === "s3-disclosures")
    expect(groups.map(group => text(group.children[0]))).toEqual(scope3Checklist.scope3DisclosureGroups(fixture).map(group => group.title))
  })

  test("UX-9: record filters drive the list (category, status, activity, search) and lines are grouped by category", () => {
    const { nodes, calls } = render(fixture)
    const filters = nodes.find(node => node.props.className === "s3-filters")!
    const control = (label: string) => flatten(filters).find(node => node.props.className?.startsWith("s3-filter") && text(node.children[0]) === label)!.children.flat(Infinity).find((x: any) => x?.type === "select" || x?.type === "input")
    control("Status").props.onChange({ target: { value: "attention" } })
    expect(calls).toContainEqual(["filter", { ...scope3Checklist.SCOPE3_DEFAULT_RECORD_FILTER, status: "attention" }])
    const attention = render(fixture, { filter: { ...scope3Checklist.SCOPE3_DEFAULT_RECORD_FILTER, status: "attention" } })
    expect(attention.nodes.filter(node => node.props.className === "nv-record-card")).toHaveLength(2)
    const headings = render(fixture).nodes.filter(node => node.props.className === "s3-record-group__title").map(text)
    expect(headings[0]).toMatch(/^2\. /)
    const page = render(fixture, { limit: 3 })
    expect(page.nodes.filter(node => node.props.className === "nv-record-card")).toHaveLength(3)
    flatten(page.nodes).find(node => node.type === "button" && /^Show \d+ more$/.test(text(node)))!.props.onClick()
    expect(page.calls).toContainEqual(["limit", 28])
  })

  test("UX-23: an empty company gets one call to action to screen its categories, and no empty CSV", () => {
    const data = structuredClone(fixture) as any
    data.records = []
    for (const row of data.coverage.categories) Object.assign(row, { status: "not_screened", screening: { decision: "not_screened", reason: null }, assessment: null, profile: null, subtotal: null, subtotalBasis: null, reviewFlags: [], reasons: [], disclosures: [], methods: [],
      counts: { records: 0, calculated: 0, partialBoundary: 0, inputNeeded: 0, outsidePeriod: 0, excluded: 0, withdrawn: 0, unavailable: 0, methodPending: 0, optionalPending: 0 } })
    const { nodes, navigations } = render(data)
    expect(nodes.some(node => node.type === "button" && text(node).includes("Download Scope 3 CSV"))).toBe(false)
    expect(text(nodes)).toContain("Start Scope 3 by screening the 15 categories")
    nodes.find(node => node.type === "button" && text(node) === "Screen your 15 categories")!.props.onClick()
    expect(navigations).toEqual(["setup"])
    expect(nodes.some(node => node.props.id === "scope3-todo")).toBe(false)
  })
})

// Round 2 polish, lane D (the empty-company walk): the category table and the printed section said only "included" for an
// included category, although company setup says what the category covers (round 2 decision 6 carries it in the results).
describe("round 2 polish: the screening column quotes setup's description of an included category", () => {
  test("screen and print show the description; a screened-out category keeps its reason; an older document without the field still renders", () => {
    const data = structuredClone(fixture) as any
    data.coverage.categories[2].screening.description = "Upstream of the gas and electricity we buy, and grid losses"
    const cell = (nodes: Node[], category: number) => text(flatten(nodes.find(node => node.type === "tr" && text(node.children[0]).startsWith(`${category}. `))).find(node => node.props["data-label"] === "Screening")!)
    const nodes = flatten(load().Scope3Panel({ state: { data, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} }))
    // Round 3 lane D (PR-9): the decision in setup's words ("Included", "Excluded", "Not applicable").
    expect(cell(nodes, 3)).toBe("Included: Upstream of the gas and electricity we buy, and grid losses")
    expect(cell(nodes, 1)).toStartWith("Excluded: Synthetic screening reason.")
    expect(text(load().Scope3ReportSection({ results: data }))).toContain("Included: Upstream of the gas and electricity we buy, and grid losses")
    delete data.coverage.categories[2].screening.description
    const old = flatten(load().Scope3Panel({ state: { data, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} }))
    expect(cell(old, 3)).toBe("Included")
  })
})

describe("round 3 lane D: one data-quality label, screened-out categories, plural units, the CSV per section", () => {
  const dqCell = (nodes: Node[], category: number) => text(flatten(nodes.find(node => node.type === "tr" && text(node.children[0]).startsWith(`${category}. `))).find(node => node.props["data-label"] === "Data quality")!)
  const printRow = (nodes: Node[], category: number) => flatten(nodes.find(node => node.type === "tr" && text(node.children[0]).startsWith(`${category}. `))).filter(node => node.type === "td").map(node => text(node))
  test("decision 5 (AC-3, PR-2): screen and print show the capped label, with the weighted score as a number; the engine's label word never", () => {
    const { Scope3Panel, Scope3ReportSection } = load()
    const screen = flatten(Scope3Panel({ state: { data: fixture, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} }))
    const printed = flatten(Scope3ReportSection({ results: fixture }))
    for (const row of fixture.coverage.categories.filter(item => item.dataQualityLabel.capped)) {
      const score = row.profile!.dataQuality.overall.score!.display
      expect(dqCell(screen, row.category)).toBe(`fair (capped)weighted score ${score}`)
      const cells = printRow(printed, row.category)
      expect(cells).toContain(`fair (capped) — Capped at fair because ${row.dataQualityLabel.reasons.map(code => code === "lines_not_quantified" ? "lines held for input or waiting for a factor source are not quantified" : "lines with a partial boundary are not documented as within-category exclusions").join(" and ")}.`)
      expect(cells.some(cell => cell.endsWith(`weighted ${score}`))).toBe(true)
      // The engine's own label ("good") is in no table cell of the category, on screen or in print.
      expect(cells.join(" | ")).not.toMatch(/\bgood\b/)
      expect(dqCell(screen, row.category)).not.toMatch(/\bgood\b/)
    }
    expect(text(printed)).not.toContain("stored before data-quality labels were capped")
  })
  test("PR-10, PR-7, PR-9: the headline names a screened-out category's tonnes; its calculated lines offer “Resolve the screening”, never Fix", () => {
    const data = structuredClone(fixture) as any
    const two = data.coverage.categories[1]
    two.screening = { decision: "excluded", reason: "No capital purchases.", description: null }; two.status = "screening_conflict"
    data.coverage.categories[9].screening = { decision: "not_relevant", reason: "No downstream processing.", description: null }; data.coverage.categories[9].status = "not_relevant"
    const { Scope3Panel } = load()
    const nodes = flatten(Scope3Panel({ state: { data, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} }))
    const all = text(nodes)
    expect(all).toContain(`Includes ${scope3Checklist.scope3Tonnes(two.subtotal.display)} t from category 2, screened out in company setup (screening conflict).`)
    expect(all).toContain("Records exist for a category you screened out as excluded: change the screening or withdraw the records.")
    expect(all).not.toContain("you marked not relevant")
    const ten = text(nodes.find(node => node.type === "tr" && text(node.children[0]).startsWith("10. "))!)
    expect(ten).toContain("Not applicable (no such activity)")
    expect(ten).toContain("Not applicable: No downstream processing.")
    expect(ten).not.toMatch(/not relevant/i)
    for (const row of fixture.records.filter(item => item.category === 2)) {
      const card = cardOf(nodes, row)!
      const buttons = flatten(card).filter(node => node.type === "button").map(node => text(node))
      expect(buttons).toEqual(["Resolve the screening"])
    }
    // Without a conflict there is no note.
    expect(text(flatten(Scope3Panel({ state: { data: fixture, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} })))).not.toContain("screened out in company setup (screening conflict)")
  })
  test("PR-8: record cards and print give units in the right number with grouped digits; PR-13: the CSV is offered as one file or as a ZIP per section", () => {
    const { Scope3Panel, Scope3ReportSection } = load()
    const screen = flatten(Scope3Panel({ state: { data: fixture, message: null, unavailable: false, busy: false }, canManage: true, onFix() {}, onRetry() {} }))
    const printed = text(flatten(Scope3ReportSection({ results: fixture })))
    const travel = fixture.records.find(row => row.quantity.unit === "passenger-mile")!
    const shown = `${plainLanguage.groupDigits(travel.quantity.value)} passenger-miles`
    expect(text(cardOf(screen, travel)!)).toContain(shown)
    expect(printed).toContain(shown)
    expect(text(screen)).not.toMatch(/\d passenger-mile\b/)
    expect(screen.find(node => node.type === "button" && node.props["aria-label"] === "Download as ZIP (one CSV per section): the Scope 3 CSV with one CSV file per section")).toBeDefined()
  })
})

test('the authentic v2 frozen golden renders its stored methodology without rewriting its bytes', async () => {
  const golden = await Bun.file(new URL('../../../../packages/neuvetra-database/src/testdata/scope3-report-v2-golden.json', import.meta.url)).json()
  const document = validateScope3ReportDocument(JSON.parse(golden.reportText), golden.companyId)
  const before = JSON.stringify(document)
  const rendered = load().Scope3ReportSection({results:document.results})
  const words = text(rendered)
  for (const row of document.results.coverage.categories) for (const sentence of row.methodology) expect(words).toContain(sentence.text)
  expect(JSON.stringify(document)).toBe(before)
  expect(words).toContain('Scope 3 (reported separately)')
})

test('currency provenance appears in Results details and printed report', () => {
  const f = structuredClone(fixture), row = f.records.find(r => r.kind === 'purchase_spend')!
  row.currencyConversion = {currency:'EUR',amount:'100',rate:'1.2',usd:'120',rateSource:'ECB reference',rateDate:'2025-02-03'}
  const c=load(), words=text(c.Scope3ReportSection({results:f}))
  expect(words).toContain('Currency conversion: EUR 100 × 1.2 USD per EUR = USD 120')
  expect(words).toContain('ECB reference; rate date: 2025-02-03')
})

// Bug hunt D (1 November 2026): the printed proposed-mandatory line followed the known-source subtotal with no label, so
// "Incomplete: category 1 …; category 3 …; category 5 …" read as the whole Scope 3 state although category 9 also needs
// input (it is not one of CARB's proposed five). The screen and the CSV name it; the print (draft and frozen) must too.
test("bug hunt D: the printed CARB line names CARB's proposed five, as the screen and the CSV do", () => {
  const c = load()
  expect(fixture.coverage.categories.find(row => row.category === 9)!.status).toBe("input_needed")
  expect(fixture.coverage.proposedMandatory.line).not.toContain("category 9")
  const paragraph = (nodes: Node[]) => text(nodes.find(node => node.type === "p" && text(node).includes(fixture.coverage.proposedMandatory.line))!)
  const live = paragraph(flatten(c.Scope3ReportSection({ results: fixture })))
  expect(live).toContain(`CARB’s proposed five categories (a proposal, not adopted): ${fixture.coverage.proposedMandatory.line}`)
  expect(live).toContain("Scope 3 is never added to the Scope 1 and 2 totals above.")
  // A frozen version prints alone (journey.css hides the live draft report), so there are no Scope 1 and 2 totals "above".
  const frozen = paragraph(flatten(c.Scope3ReportSection({ results: fixture, frozen: true })))
  expect(frozen).toContain(`CARB’s proposed five categories (a proposal, not adopted): ${fixture.coverage.proposedMandatory.line}`)
  expect(frozen).not.toContain("totals above")
  expect(frozen).toContain("Scope 3 is never added to the Scope 1 and 2 totals.")
})
