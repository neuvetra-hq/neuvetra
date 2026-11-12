/* eslint-disable @typescript-eslint/no-explicit-any -- The injected hook harness runs the actual Results component without a browser DOM. */
// B02 (Request B, 14 October 2026): a record the calculation engine held (input needed, review required) or excluded
// still has route outcome "calculated", but it is in no subtotal. The summary, the Results cards, the printed list and
// the CSV must count it and give its reasons. Runs the actual ResultsReport component with injected hooks, the same
// technique as StagingWorkspace.test.tsx. Claude, 15 October 2026.
import { describe, expect, test } from "bun:test"
import * as journeyStatus from "@/lib/journey-status"
import * as plainLanguage from "@/lib/plain-language"
import * as resultsApi from "@/lib/results-api"
import * as resultsView from "@/lib/results-view"
import * as scope3ResultsApi from "@/lib/scope3-results-api"
import * as scope3Results from "./Scope3Results"
import * as scope3Checklist from "@/lib/scope3-checklist"
import * as scope3ResultsText from "@/lib/scope3-results-text"
import { formatTimeR2E } from "../../../../packages/neuvetra-database/src/scope3-text-r2e"
import type { Coverage } from "@/lib/journey-status"
import type { ResultRow, ResultsResponse } from "@/lib/results-api"
// Round 3 lane D: the display rules and texts the Scope 3 panel now uses (decision 5, PR-7..PR-13).
import * as scope3DisplayR3d from "@/lib/scope3-display-r3d"
import * as scope3TextR3d from "@/lib/scope3-text-r3d"

const source = await Bun.file(new URL("./ResultsReport.tsx", import.meta.url)).text()
const script = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } })
  .transformSync(source.replace(/^import .*\n/gm, "").replace("export function ResultsReport", "function ResultsReport")) + "\nreturn { ResultsReport, completeness }"
type Node = { type: unknown; props: Record<string, any>; children: any[] }
const flatten = (value: any): Node[] => Array.isArray(value) ? value.flatMap(flatten) : value && typeof value === "object" && "children" in value ? [value, ...value.children.flatMap(flatten)] : []
const text = (value: any): string => Array.isArray(value) ? value.map(text).join("") : value && typeof value === "object" && "children" in value ? text(value.children) : value == null || typeof value === "boolean" ? "" : String(value)
const READY: Coverage = { state: "ready", setupOpen: [], gaps: [] }
/** CSV lines with a line that is one quoted cell unquoted, so a check reads the text whether or not it needed quoting. */
const csvLines = (csv: string) => csv.split("\n").map(line => /^"[^\n]*"$/.test(line) ? line.slice(1, -1).replace(/""/g, '"') : line)

/** Renders the Results screen once for these results, clicks Download CSV, and returns what each surface says. */
function render(results: ResultsResponse, coverage: Coverage = READY, scope3Override?: Partial<scope3ResultsApi.Scope3State>) {
  let csv = ""
  const env: Record<string, unknown> = {
    ...journeyStatus, ...plainLanguage, ...resultsApi, ...resultsView, ...scope3ResultsApi, ...scope3Results, ...scope3Checklist, ...scope3ResultsText, ...scope3DisplayR3d, ...scope3TextR3d, formatTimeR2E,
    // Round 2 lane D: the Results screen renders the panel through its stateful wrapper; here the pure panel stands in.
    Scope3ResultsPanel: scope3Results.Scope3Panel,
    h: (type: any, props: any, ...children: any[]) => typeof type === "function" ? type({ ...props, children }) : { type, props: props ?? {}, children },
    React: { Fragment: "fragment" }, Icon: () => null,
    useReducer: () => [{ results, error: null, busy: false }, () => {}], useState: (initial: any) => [initial === scope3ResultsApi.INITIAL_SCOPE3_STATE && scope3Override ? { ...initial, ...scope3Override } : initial, () => {}], useRef: (current: any) => ({ current }),
    useEffect: () => {}, useCallback: (fn: any) => fn, useMemo: (fn: any) => fn(),
    Blob: class { constructor(parts: string[]) { csv = parts.join("") } },
    URL: { createObjectURL: () => "blob:results", revokeObjectURL: () => {} },
    document: { createElement: () => ({ click: () => {} }), getElementById: () => null },
    window: { setTimeout: () => 0, print: () => {} },
  }
  const { ResultsReport, completeness } = new Function(...Object.keys(env), script)(...Object.values(env))
  const tree = ResultsReport({ actor: {}, workspaceId: results.companyId, headingRef: { current: null }, coverage, onRetryCoverage() {}, canManage: true, onNavigate() {}, onFix() {} })
  const nodes = flatten(tree)
  nodes.find(node => node.type === "button" && text(node).includes("Download CSV"))!.props.onClick()
  const article = flatten(nodes.find(node => node.props.id === "draft-report")).find(node => node.type === "article")!
  const parts = article.children.flat(Infinity)
  const listAfter = (heading: string) => flatten(parts[parts.findIndex((node: any) => node?.type === "h3" && text(node) === heading) + 1]).filter(node => node.type === "li").map(text)
  return {
    completeness: completeness(results, coverage) as { scope1: string; scope2Location: string; scope2Market: string },
    notCounted: listAfter("Not counted, incomplete and possible gaps"),
    printed: text(article),
    totals: nodes.filter(node => node.props.className === "nv-stat__value").map(text),
    totalNotes: nodes.filter(node => node.props.className === "nv-stat__foot").map(text),
    lead: text(nodes.find(node => node.props.className === "nv-lead")),
    footer: text(nodes.find(node => node.props.className === "nv-subtle" && text(node).startsWith("Activity types covered"))),
    liveLabel: nodes.filter(node => node.props.className === "nv-live-draft").map(text),
    actionsLabelled: nodes.filter(node => node.type === "button" && /Print or save|Download CSV/.test(text(node))).map(node => node.props["aria-describedby"]),
    tableRegions: nodes.filter(node => typeof node.props.className === "string" && node.props.className.startsWith("nv-report__scroll")).map(node => ({ role: node.props.role, label: node.props["aria-label"], tabIndex: node.props.tabIndex })),
    warnings: nodes.filter(node => node.props.className === "nv-stat__warn").map(text),
    banner: nodes.filter(node => node.props.className === "nv-notice nv-notice--warn").map(text).find(line => / counted yet| partly calculated|possible duplicates? to confirm/.test(line)) ?? null,
    csv,
  }
}

const company = "29600000-0000-4000-8000-000000000001"
const id = (n: number) => `29600000-0000-4000-8000-${String(n).padStart(12, "0")}`
const ENGINE1 = "6fdcfa3926698250d577df8d456b4d567ec3e9569788f3c96373421276fa36a4", REGISTER1 = "f5351cd375a54072c03061dc3fab6740bed1cf78e05db9de575dca7f2d5c0c02"
const ENGINE2 = "8d259406feb989372592269c0daef156733ebe67a2b12b87a39e897642a8c320", REGISTER2 = "4873b8c08dbab395336a2273501724118661cf505ad19fa48a6f625661e3a14d"
const kg = (display: string) => ({ unrounded: display, display, unit: "kg CO2e", rounding: "half_even_4dp" })
let n = 0
function row(sourceId: string, kind: string, scope: 1 | 2, fields: Record<string, unknown>): ResultRow {
  n++
  return { recordId: id(n), versionId: id(100 + n), revision: 1, kind, scope, sourceId, locationId: id(900), locationName: "Office", period: { start: "2025-01-01", endExclusive: "2026-01-01" },
    quantity: { value: "100", unit: "therm" }, quality: "actual", estimateBasis: null, evidenceCount: 0, evidence: [], plan: { action: "calculate", status: null, reasons: [], notes: [] }, periodCheck: "inside",
    outcome: "calculated", inSubtotal: { scope1: false, scope2LocationBased: false, scope2MarketBased: false }, refusalCode: null, scope1: null, scope2: null, ...fields } as unknown as ResultRow
}
const s1 = (methodVersionId: string, status: string, fields: Record<string, unknown> = {}) => ({ methodVersionId, engineSha256: ENGINE1, registerSha256: REGISTER1, gwpSetId: "AR5-100", status,
  gases: {}, missingGases: [], estimates: [], findings: [], memo: null, factorsUsed: [], total: null, resultSha256: (n + 1).toString(16).padStart(64, "0"), ...fields })
const GAS = "scope1.stationary.natural_gas.v2", GEN = "scope1.stationary.distillate_no2.v2", FUG = "scope1.fugitive.material_balance.v2", VAN = "scope1.mobile.onroad_diesel.v2", POWER = "scope2.electricity.egrid2023_greene2025.v3"
const held = (status: "withdrawn" | "excluded" | "input_needed", reasons: string[]) => ({ outcome: "held", plan: { action: "hold", status, reasons, notes: [] } })

// One of each case: counted, partial, adapter held, engine held (input needed, review required), engine excluded,
// memo-only, excluded site, withdrawn, and a meter counted location-based only. The Request B shape, plus the cases it lacks.
const rows = [
  row("GAS-1", "natural_gas", 1, { quality: "unknown", inSubtotal: { scope1: true, scope2LocationBased: false, scope2MarketBased: false }, scope1: s1(GAS, "complete", { total: kg("531.1450") }) }),
  row("GAS-UNKNOWN", "natural_gas", 1, { quantity: { value: "unknown", unit: "therm" }, ...held("input_needed", ["quantity_not_calculable"]) }),
  row("GEN-PURCHASES", "distillate_no2", 1, { quality: "unknown", scope1: s1(GEN, "input_needed", { findings: ["tank_levels_required_for_purchases"] }) }),
  row("RTU-UNKNOWN", "fugitive", 1, { scope1: s1(FUG, "input_needed", { findings: ["boundary_membership_unknown"] }) }),
  row("RTU-STOCK", "fugitive", 1, { scope1: s1(FUG, "review_required", { findings: ["simplified_method_not_applicable"] }) }),
  row("RTU-TENANT", "fugitive", 1, { scope1: s1(FUG, "excluded", { findings: ["outside_declared_boundary"] }) }),
  row("RTU-R22", "fugitive", 1, { scope1: s1(FUG, "memo_only", { memo: { gas: "HCFC-22", massKg: "2.041165665", treatment: "reported_separately_outside_scope1_total" } }) }),
  row("VAN-NO-MILES", "vehicle", 1, { inSubtotal: { scope1: true, scope2LocationBased: false, scope2MarketBased: false }, scope1: s1(VAN, "partial", { total: kg("100.0000"), missingGases: ["ch4", "n2o"], estimates: ["ch4_n2o_missing"] }) }),
  row("GAS-W", "natural_gas", 1, held("excluded", ["location_excluded_by_company_setup"])),
  row("GAS-OLD", "natural_gas", 1, held("withdrawn", [])),
  row("M-BLANK", "electricity", 2, { quantity: { value: "10000", unit: "kWh" }, inSubtotal: { scope1: false, scope2LocationBased: true, scope2MarketBased: false },
    scope2: { methodVersionId: POWER, engineSha256: ENGINE2, registerSha256: REGISTER2, gwpSetId: "AR5-100", status: "input_needed", findings: ["instrument_mwh_required"], estimates: [], activity: { mwh: "10", instrumentMwh: null, subregion: "CAMX" },
      locationBased: { status: "complete", findings: [], gases: {}, total: kg("1950.2612") }, marketBased: { status: "input_needed", findings: ["instrument_mwh_required"], gases: null, total: null, residualMix: null }, factorsUsed: [], resultSha256: "f".repeat(64) } }),
]
const method = (methodVersionId: string, scope: 1 | 2) => ({ methodVersionId, scope, engineSha256: scope === 1 ? ENGINE1 : ENGINE2, registerSha256: scope === 1 ? REGISTER1 : REGISTER2, releaseStatus: "unreleased_beta", releaseId: null, releaseLabel: null })
const synthetic = {
  profile: resultsApi.RESULTS_PROFILE, label: resultsApi.DRAFT_LABEL, syntheticOnly: true, environment: "synthetic_staging", generatedAt: "2026-10-15T00:00:00.000Z", companyId: company, setup: null, warnings: [],
  methods: [method(FUG, 1), method(VAN, 1), method(GEN, 1), method(GAS, 1), method(POWER, 2)], records: rows,
  counts: { records: 11, calculated: 4, held: 3, withdrawn: 1, excluded: 2, inputNeeded: 4, outsidePeriod: 0, unavailable: 0 },
  scope1: { knownSourceSubtotal: kg("631.1450"), includedResults: [rows[0]!.scope1!.resultSha256, rows[7]!.scope1!.resultSha256], incompleteResults: [{ resultSha256: rows[7]!.scope1!.resultSha256, missingGases: ["ch4", "n2o"] }],
    notCalculated: [2, 3, 4, 5].map(i => ({ resultSha256: rows[i]!.scope1!.resultSha256, status: rows[i]!.scope1!.status, findings: rows[i]!.scope1!.findings })),
    reportedOutsideScopes: [{ gas: "HCFC-22", massKg: "2.041165665", treatment: "reported_separately_outside_scope1_total" }], resultCount: 7, complete: false },
  scope2: { resultCount: 1, locationBasedSubtotal: kg("1950.2612"), locationBasedIncluded: ["f".repeat(64)], locationBasedComplete: true, marketBasedSubtotal: kg("0.0000"), marketBasedIncluded: [], marketBasedProvisional: [], marketBasedComplete: false },
} as unknown as ResultsResponse
const reason = plainLanguage.reasonText

// BF-07 (S3C-02): a headline is the unrounded kg moved to tonnes and rounded once (half-even, 2 dp), never the 4-dp kg display
// rounded again. The kg column and the CSV keep the engine's display. The CSV's 3-dp tonnes and the screen's 2-dp tonnes are both
// correct roundings, so nothing here asks the screen to equal the CSV.
describe("BF-07: Scope 1 and 2 headline tonnes are rounded once from the unrounded figure", () => {
  test("a display that rounds up to a tie does not round the headline up twice", () => {
    const doubled = structuredClone(synthetic)
    doubled.scope1!.knownSourceSubtotal = { unrounded: "5014.99996", display: "5015.0000", unit: "kg CO2e", rounding: "half_even_4dp" }
    doubled.scope2!.locationBasedSubtotal = { unrounded: "1014.99996", display: "1015.0000", unit: "kg CO2e", rounding: "half_even_4dp" }
    doubled.scope2!.marketBasedIncluded = ["f".repeat(64)]
    doubled.scope2!.marketBasedSubtotal = { unrounded: "2354.99996", display: "2355.0000", unit: "kg CO2e", rounding: "half_even_4dp" }
    const view = render(doubled)
    expect(view.totals).toEqual(["5.01t CO2e", "1.01t CO2e", "2.35t CO2e"])
    // The printed table: tonnes from the unrounded figure, kg as the engine displays it.
    expect(view.printed).toContain("5,015.0000")
    expect(view.printed).toContain("5.01")
    expect(view.printed).not.toContain("5.02")
    // The CSV prints the display kg exactly as before.
    expect(view.csv.split("\n").find(line => line.startsWith("Subtotal,Scope 1,"))).toContain("5015.0000")
  })
  test("a figure that needs no second rounding is unchanged", () => {
    expect(render(synthetic).totals).toEqual(["0.63t CO2e", "1.95t CO2e", "—t CO2e"])
  })
})

describe("B02: records the engine held are counted and explained everywhere", () => {
  test("an unresolved coverage gap does not claim saved fuel records are absent in the report or CSV", () => {
    const gap = { id: "legacy-stationary", scope: 1 as const, title: "Setup says you have fuel-burning equipment; natural gas records and generator fuel records are saved. Confirm which fuels or equipment still need records", detail: "Saved records alone do not establish complete fuel coverage.", note: null, noteFrom: "source" as const }
    expect(synthetic.records.some(row => row.kind === "natural_gas")).toBe(true)
    expect(synthetic.records.some(row => row.kind === "distillate_no2")).toBe(true)
    const view = render(synthetic, { state: "ready", setupOpen: [], gaps: [gap] })
    expect(view.completeness.scope1).toContain("1 possible coverage gap")
    expect(view.printed).toContain("1 possible coverage gap")
    expect(csvLines(view.csv).find(line => line.startsWith("# Completeness, Scope 1:"))).toContain("1 possible coverage gap")
    expect(view.printed + view.csv).not.toContain("expected source with no records")
    expect(view.csv).toContain(gap.title)
    expect(view.totals).toEqual(render(synthetic).totals)
  })
  test("empty aggregate membership is unavailable, while a genuinely calculated zero remains zero", () => {
    const empty = render(synthetic)
    expect(empty.totals[2]).toBe("—t CO2e")
    expect(empty.totalNotes[2]).toContain("No market-based results calculated")
    expect(empty.csv.split("\n").find(line => line.startsWith("Subtotal,Scope 2 market-based,"))).not.toContain("0.0000")
    expect(empty.printed).toContain("Market-based——")
    const validZero = structuredClone(synthetic)
    validZero.scope2!.marketBasedIncluded = ["f".repeat(64)]
    validZero.scope2!.marketBasedComplete = true
    const zero = render(validZero)
    expect(zero.totals[2]).toBe("0.00t CO2e")
    expect(zero.csv.split("\n").find(line => line.startsWith("Subtotal,Scope 2 market-based,"))).toContain("0.0000")
    validZero.scope2!.marketBasedComplete = false
    expect(render(validZero).totals[2]).toBe("0.00t CO2e")
    const allHeld = structuredClone(synthetic)
    allHeld.scope1!.includedResults = []
    allHeld.scope2!.locationBasedIncluded = []
    expect(render(allHeld).totals).toEqual(["—t CO2e", "—t CO2e", "—t CO2e"])
  })
  test("summary, Results card, printed list and CSV count the engine's holds and give their reasons", () => {
    const view = render(synthetic)
    // Four records are not yet counted: one held before the engine, two input needed and one review required by it.
    expect(view.completeness).toEqual({
      scope1: "Incomplete — 4 records not yet counted; some results only partly calculated",
      scope2Location: "No known gaps — each source type and included site in company setup has at least one record",
      scope2Market: "Incomplete — some results only partly calculated",
    })
    expect(view.warnings[0]).toBe("4 records not counted yet · some results partly calculated")
    expect(csvLines(view.csv)).toContain("# Completeness, Scope 1: Incomplete — 4 records not yet counted; some results only partly calculated")
    // Every record outside its subtotal is listed once with its status and reasons; the counted and memo-only ones are not.
    expect(view.notCounted).toEqual([
      `Natural gas · GAS-UNKNOWN — Input needed: ${reason("quantity_not_calculable")}`,
      `Generator diesel or fuel oil · GEN-PURCHASES — Input needed: ${reason("tank_levels_required_for_purchases")}`,
      `Refrigerants and fire suppression · RTU-UNKNOWN — Input needed: ${reason("boundary_membership_unknown")}`,
      `Refrigerants and fire suppression · RTU-STOCK — Review required: ${reason("simplified_method_not_applicable")}`,
      `Refrigerants and fire suppression · RTU-TENANT — Excluded: ${reason("outside_declared_boundary")}`,
      `Company vehicles · VAN-NO-MILES — Partial calculation: ${reason("ch4_n2o_missing")}`,
      `Natural gas · GAS-W — Excluded: ${reason("location_excluded_by_company_setup")}`,
      "Natural gas · GAS-OLD — Withdrawn: ",
      `Purchased electricity · M-BLANK — Partial calculation: ${reason("instrument_mwh_required")}`,
    ])
    // A record the engine held is not a "calculated record" with unknown data quality.
    expect(view.printed).toContain("1 calculated record has data quality “Unknown”.")
    // Memo-only R-22 stays outside the total and is not called uncounted; partial figures stay in their subtotal.
    expect(view.printed).toContain("Reported outside the Scope 1 total: HCFC-22 2.041165665 kg.")
    expect(view.notCounted.some(line => line.includes("RTU-R22"))).toBe(false)
  })

  // BF2 (Request B closure P3): the banner used to say "7 records are not fully counted" beside "4 input needed" in the
  // header. It now names the two kinds separately, matching the header (partly calculated records are calculated).
  test("BF2: the attention banner separates records not counted yet from records only partly calculated", () => {
    expect(render(synthetic).banner).toBe("4 records aren’t counted yet and 2 records are only partly calculated. Fix them to complete your totals.")
  })

  test("engineHold and notYetCounted follow the engine, not the route outcome", () => {
    const by = (sourceId: string) => rows.find(item => item.sourceId === sourceId)!
    expect(rows.map(item => [item.sourceId, resultsView.engineHold(item), resultsView.notYetCounted(item)])).toEqual([
      ["GAS-1", null, false], ["GAS-UNKNOWN", null, true], ["GEN-PURCHASES", "input_needed", true], ["RTU-UNKNOWN", "input_needed", true],
      ["RTU-STOCK", "review_required", true], ["RTU-TENANT", "excluded", false], ["RTU-R22", null, false], ["VAN-NO-MILES", null, false],
      ["GAS-W", null, false], ["GAS-OLD", null, false], ["M-BLANK", null, false],
    ])
    // Electricity follows its location-based basis: a location-based hold is a hold, a market-based-only one is partial.
    const meter = by("M-BLANK")
    const heldMeter = { ...meter, scope2: { ...meter.scope2!, locationBased: { ...meter.scope2!.locationBased, status: "review_required" as const } } }
    expect([resultsView.engineHold(heldMeter), resultsView.notYetCounted(heldMeter)]).toEqual(["review_required", true])
    // A record that is withdrawn or excluded by the company is never counted as "not yet counted", whatever the engine said.
    const withdrawnHold = { ...by("GEN-PURCHASES"), plan: { ...by("GEN-PURCHASES").plan, status: "withdrawn" as const } }
    expect(resultsView.notYetCounted(withdrawnHold)).toBe(false)
  })
})

// Request B (14 October 2026) actual hosted captures and CSV downloads, bound by SHA-256. Run with
// NEUVETRA_REQUEST_B_CAPTURES set to the folder holding them (notes\reviews\2026-10-14-request-b-integrated-qa);
// skipped without it, never fetched.
const captures = process.env.NEUVETRA_REQUEST_B_CAPTURES
describe("B02 on the actual Request B captures", () => {
  const companies = [
    { name: "A", api: "company-a-results-api.json", apiSha256: "c769faa06e62ddfeac905828fb24d7408c719c3a14157d8370d08b4251b44f33", csv: "company-a-results.csv", csvSha256: "4a708e594ab08a262bed7f0e403c01f03308d7caead0f2e4e3080e45fb4a9cff" },
    { name: "B", api: "company-b-results-api.json", apiSha256: "ceabb84edc1e8a93a81dddcd1ead793289ee61e257e5187e5aa62dca22047b03", csv: "company-b-results.csv", csvSha256: "16112dec1088f0d4adede94de928aa97ed0675ce725807a2b1e67f16baffb22f" },
  ]
  for (const item of companies) test.skipIf(!captures)(`Company ${item.name}: four Scope 1 records are not yet counted and each engine hold's reason is printed`, async () => {
    const read = async (name: string, sha256: string) => {
      const bytes = await Bun.file(`${captures}/${name}`).bytes()
      expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(sha256)
      return new TextDecoder().decode(bytes)
    }
    const raw = JSON.parse(await read(item.api, item.apiSha256))
    const results = resultsApi.decodeResults(raw, raw.companyId)
    const downloaded = await read(item.csv, item.csvSha256)
    // Independent rule (Codex's B02 probe): a non-memo Scope 1 record outside the subtotal, neither withdrawn nor excluded.
    const unresolved = results.records.filter(row => row.scope === 1 && !row.inSubtotal.scope1 && row.scope1?.status !== "memo_only" && row.plan.status !== "withdrawn" && row.plan.status !== "excluded")
    expect(unresolved.map(row => row.sourceId).sort()).toEqual(["RB-20261014-gas-unknown-quantity", "RB-20261014-generator-purchases-only", "RB-20261014-refrigerant-stock", "RB-20261014-refrigerant-unknown"])
    // The hosted CSV said one; the corrected component says four. Scope 2 wording is unchanged.
    expect(csvLines(downloaded)).toContain("# Completeness, Scope 1: Incomplete — 1 record not yet counted; some results only partly calculated")
    const view = render(results)
    expect(view.completeness).toEqual({
      scope1: "Incomplete — 4 records not yet counted; some results only partly calculated",
      scope2Location: "No known gaps — each source type and included site in company setup has at least one record",
      scope2Market: "Incomplete — some results only partly calculated",
    })
    expect(view.warnings[0]).toBe("4 records not counted yet · some results partly calculated")
    expect(csvLines(view.csv)).toContain("# Completeness, Scope 1: Incomplete — 4 records not yet counted; some results only partly calculated")
    // Every unresolved record is printed with each of its reasons: the three engine holds were missing before.
    for (const row of unresolved) expect(view.notCounted).toContain(`${plainLanguage.kindLabel(row.kind)} · ${row.sourceId} — ${resultsView.rowStatus(row).label}: ${resultsView.rowReasons(row).join(" ")}`)
    expect(view.notCounted).toHaveLength(7)
    expect(view.notCounted.some(line => line.includes("refrigerant-r22"))).toBe(false)
    // No figure changes: the three subtotal rows are byte-identical to the hosted download.
    const subtotals = (csv: string) => csv.split("\n").filter(line => line.startsWith("Subtotal,"))
    expect(subtotals(view.csv)).toEqual(subtotals(downloaded))
    expect(subtotals(view.csv)).toHaveLength(3)
  })
})

// Round 2 polish, lane D (Claude, 31 October 2026; product review UX-21): the Results header and the printed "Prepared" time
// use the Activity screens' one format, date and 24-hour time in UTC, labelled (it was "Oct 15, 2026, 12:00 AM" in the
// browser's zone).
describe("round 2 polish: one time format on Results", () => {
  test("the header and the printed report say when the results were calculated as YYYY-MM-DD HH:MM UTC", () => {
    const view = render({ ...synthetic, generatedAt: "2026-10-15T21:07:09.000Z" } as ResultsResponse)
    expect(view.lead).toContain("calculated 2026-10-15 21:07 UTC")
    expect(view.printed).toContain("Prepared2026-10-15 21:07 UTC")
  })
})

describe("WO-11: honest Scope 3 footer, live-draft label and focusable table regions", () => {
  const footerFor = (scope3: Partial<scope3ResultsApi.Scope3State> | undefined) => render(synthetic as unknown as ResultsResponse, READY, scope3).footer
  test("Scope 3 switched off says so; a failed load says it could not be loaded; neither says 'not calculated'", () => {
    expect(footerFor({ unavailable: true })).toContain("Scope 3 isn’t switched on in this workspace")
    expect(footerFor({ message: "Server error" })).toContain("Scope 3 results couldn’t be loaded — use Try again in the Scope 3 section")
    for (const state of [{ unavailable: true }, { message: "Server error" }, undefined]) expect(footerFor(state as any)).not.toMatch(/not calculated/i)
  })
  test("the live-draft label sits next to Print and CSV on screen, and is not in the CSV or the printed report", () => {
    const out = render(synthetic as unknown as ResultsResponse)
    expect(out.liveLabel).toEqual(["Live draft — not a frozen version"])
    expect(out.actionsLabelled).toEqual(["live-draft-label", "live-draft-label"])
    expect(out.csv).not.toContain("Live draft")
    expect(out.printed).not.toContain("Live draft")
  })
  test("every wide table is a labelled, focusable region", () => {
    const regions = render(synthetic as unknown as ResultsResponse).tableRegions
    expect(regions.length).toBeGreaterThan(0)
    for (const region of regions) { expect(region.role).toBe("region"); expect(region.tabIndex).toBe(0); expect(region.label).toMatch(/table$/) }
  })
})

// BF-01 (part A): a possible duplicate record is disclosed on Results, in the report and in the CSV, in both policy modes.
describe("BF-01: possible duplicate records", () => {
  const keeper = row("GAS-1", "natural_gas", 1, { inSubtotal: { scope1: true, scope2LocationBased: false, scope2MarketBased: false }, scope1: s1(GAS, "complete", { total: kg("5311.4500") }) })
  ;(keeper.plan as any).notes = ["has_possible_duplicates:1"]
  const base = (records: ResultRow[], extra: Record<string, unknown> = {}) => ({ ...synthetic, records, methods: [method(GAS, 1)], scope2: null,
    scope1: { knownSourceSubtotal: kg("5311.4500"), includedResults: [keeper.scope1!.resultSha256], incompleteResults: [], notCalculated: [], reportedOutsideScopes: [], resultCount: 1, complete: true }, ...extra }) as unknown as ResultsResponse
  // QA (PR #48): the named record is identifiable by site and period as well as its source ID and record ID.
  const named = `Possible duplicate of GAS-1 at Office, ${plainLanguage.periodLabel("2025-01-01", "2026-01-01")} (record ${keeper.recordId}).`
  test("hold mode: the duplicate is input needed, named everywhere, and the totals say incomplete", () => {
    const dup = row("GAS-1", "natural_gas", 1, { outcome: "held", plan: { action: "hold", status: "input_needed", reasons: ["possible_duplicate_record"], notes: [`possible_duplicate_of:${keeper.recordId}`] } })
    const view = render(base([keeper, dup]))
    expect(resultsView.rowStatus(dup)).toEqual({ label: "Input needed", tone: "warn" })
    expect(view.completeness.scope1).toBe("Incomplete — 1 record not yet counted")
    expect(view.notCounted.some(line => line.includes(reason("possible_duplicate_record")) && line.includes(named))).toBe(true)
    const line = csvLines(view.csv).find(text => text.includes(reason("possible_duplicate_record")))!
    expect(line).toContain(named)
    expect(line).toContain("input_needed")
    // Held, not counted: it never says it is counted, and no subtotal is flagged.
    expect(line).not.toContain(reason("possible_duplicate_counted"))
    expect(view.warnings.some(text => text.includes("possible duplicate"))).toBe(false)
    expect(view.printed).not.toContain("‡")
  })
  test("count mode: the counted duplicate is never \"No known gaps\", and the CSV says it is counted", () => {
    const dup = row("GAS-1", "natural_gas", 1, { inSubtotal: { scope1: true, scope2LocationBased: false, scope2MarketBased: false }, plan: { action: "calculate", status: null, reasons: [], notes: [`possible_duplicate_of:${keeper.recordId}`] }, scope1: s1(GAS, "complete", { total: kg("5311.4500") }) })
    const results = base([keeper, dup], { warnings: ["These totals include 1 possible duplicate: a record that matches another active record for overlapping dates. Both records are counted. If they are the same record, withdraw or correct one of them; if they are different records, no action is needed."],
      scope1: { knownSourceSubtotal: kg("10622.9000"), includedResults: [keeper.scope1!.resultSha256, dup.scope1!.resultSha256], incompleteResults: [], notCalculated: [], reportedOutsideScopes: [], resultCount: 2, complete: true } })
    const view = render(results)
    expect(resultsView.rowStatus(dup)).toEqual({ label: "Counted — possible duplicate", tone: "warn" })
    expect(resultsView.needsWork(dup)).toBe(true)
    expect(view.completeness.scope1).toBe("Incomplete — 1 possible duplicate counted")
    expect(view.notCounted.some(line => line.includes(reason("possible_duplicate_counted")) && line.includes(named))).toBe(true)
    expect(csvLines(view.csv).some(text => text.includes(reason("possible_duplicate_counted")) && text.includes(named))).toBe(true)
    expect(reason("possible_duplicate_counted")).toContain("Both records are included in the total.")
  })
  // WO-13 (QA follow-up 1 of PR #55): the records banner follows the ruling: both are counted, check them, withdraw one if it
  // is a repeat, nothing to do if they are different. It never says "Fix them to complete your totals" of a duplicate.
  test("WO-13: a counted possible duplicate's banner says both are counted and to check it, never to fix it or to complete the totals", () => {
    const dup = row("GAS-1", "natural_gas", 1, { inSubtotal: { scope1: true, scope2LocationBased: false, scope2MarketBased: false }, plan: { action: "calculate", status: null, reasons: [], notes: [`possible_duplicate_of:${keeper.recordId}`] }, scope1: s1(GAS, "complete", { total: kg("5311.4500") }) })
    const results = base([keeper, dup], { scope1: { knownSourceSubtotal: kg("10622.9000"), includedResults: [keeper.scope1!.resultSha256, dup.scope1!.resultSha256], incompleteResults: [], notCalculated: [], reportedOutsideScopes: [], resultCount: 2, complete: true } })
    const banner = render(results).banner
    expect(banner).toBe("1 possible duplicate to confirm: it may repeat another record, and both records are counted. Check it: if it is a repeat, withdraw one of the two; if they are different records, nothing needs doing.")
    expect(banner).not.toMatch(/complete|Fix /)
    // With a record that isn't counted yet as well: "Fix it" names only that record, and the duplicate keeps its own words.
    const held = row("GAS-9", "natural_gas", 1, { outcome: "held", plan: { action: "hold", status: "input_needed", reasons: ["quantity_not_calculable"], notes: [] } })
    expect(render(base([keeper, dup, held], { scope1: results.scope1 })).banner).toBe("1 record isn’t counted yet. Fix it to complete your totals. 1 possible duplicate to confirm: it may repeat another record, and both records are counted. Check it: if it is a repeat, withdraw one of the two; if they are different records, nothing needs doing.")
  })
  // WO-13 (QA F1 of PR #56): a possible duplicate that is also only partly calculated is counted in "Fix" too (so the
  // banner's counts match the Overview's), and is never told "nothing needs doing".
  test("WO-13 F1: a partly calculated possible duplicate is in the Fix count and never gets “nothing needs doing”", () => {
    const dup = row("GAS-1", "natural_gas", 1, { inSubtotal: { scope1: true, scope2LocationBased: false, scope2MarketBased: false }, plan: { action: "calculate", status: null, reasons: [], notes: [`possible_duplicate_of:${keeper.recordId}`] }, scope1: s1(GAS, "partial", { total: kg("5311.4500") }) })
    expect(resultsView.partlyCalculated(dup)).toBe(true)
    const results = base([keeper, dup], { scope1: { knownSourceSubtotal: kg("10622.9000"), includedResults: [keeper.scope1!.resultSha256, dup.scope1!.resultSha256], incompleteResults: [], notCalculated: [], reportedOutsideScopes: [], resultCount: 2, complete: false } })
    const banner = render(results).banner!
    expect(banner).toBe("1 record is only partly calculated. Fix it to complete your totals. 1 possible duplicate to confirm: it may repeat another record, and both records are counted. Check it: if it is a repeat, withdraw one of the two; if they are different records, keep both — it still needs the fix above.")
    expect(banner).not.toContain("nothing needs doing")
    // QA's example: 8 partly calculated vehicles, 4 of them possible duplicates.
    const text = resultsView.attentionBannerText
    expect(text({ notCounted: 0, partly: 8, duplicates: 4, duplicatesAlsoFix: 4 }, true)).toBe("8 records are only partly calculated. Fix them to complete your totals. 4 possible duplicates to confirm: each may repeat another record, and both records of each pair are counted. Check them: if a record is a repeat, withdraw one of the pair; if they are different records, keep both — they still need the fix above.")
    expect(text({ notCounted: 0, partly: 3, duplicates: 2, duplicatesAlsoFix: 1 }, true)).toContain("keep both — 1 of them still needs the fix above.")
    expect(text({ notCounted: 0, partly: 1, duplicates: 1, duplicatesAlsoFix: 1 }, false)).toBe("1 record is only partly calculated. 1 possible duplicate to confirm: it may repeat another record, and both records are counted. If one is a repeat, an owner or admin can withdraw it. It also isn’t fully calculated yet.")
    expect(text({ notCounted: 0, partly: 3, duplicates: 3, duplicatesAlsoFix: 2 }, false)).toContain("2 of them also aren’t fully calculated yet.")
    for (const manage of [true, false]) for (const [d, a] of [[1, 1], [4, 4], [3, 1]]) expect(text({ notCounted: 0, partly: 5, duplicates: d!, duplicatesAlsoFix: a }, manage)).not.toContain("nothing needs doing")
  })
  test("WO-13: the banner's wording for several duplicates and for a view-only member", () => {
    const text = resultsView.attentionBannerText
    expect(text({ notCounted: 0, partly: 0, duplicates: 2 }, true)).toBe("2 possible duplicates to confirm: each may repeat another record, and both records of each pair are counted. Check them: if a record is a repeat, withdraw one of the pair; if they are different records, nothing needs doing.")
    expect(text({ notCounted: 0, partly: 0, duplicates: 1 }, false)).toBe("1 possible duplicate to confirm: it may repeat another record, and both records are counted. If one is a repeat, an owner or admin can withdraw it; if they are different records, nothing needs doing.")
    expect(text({ notCounted: 4, partly: 2, duplicates: 0 }, true)).toBe("4 records aren’t counted yet and 2 records are only partly calculated. Fix them to complete your totals.")
    expect(text({ notCounted: 1, partly: 0, duplicates: 0 }, false)).toBe("1 record isn’t counted yet.")
    for (const n of [1, 2, 5]) for (const manage of [true, false]) expect(text({ notCounted: 0, partly: 0, duplicates: n }, manage)).not.toMatch(/complete|[Ff]ix/)
  })
  test("count mode: the totals themselves are flagged on screen, in the draft report (print) and in the CSV subtotal row", () => {
    const dup = row("GAS-1", "natural_gas", 1, { inSubtotal: { scope1: true, scope2LocationBased: false, scope2MarketBased: false }, plan: { action: "calculate", status: null, reasons: [], notes: [`possible_duplicate_of:${keeper.recordId}`] }, scope1: s1(GAS, "complete", { total: kg("5311.4500") }) })
    const results = base([keeper, dup], { scope1: { knownSourceSubtotal: kg("10622.9000"), includedResults: [keeper.scope1!.resultSha256, dup.scope1!.resultSha256], incompleteResults: [], notCalculated: [], reportedOutsideScopes: [], resultCount: 2, complete: true } })
    const view = render(results)
    const flag = "Includes 1 possible duplicate: this figure may be overstated"
    expect(resultsApi.possibleDuplicateTotalText(1)).toBe(flag)
    // Screen: the Scope 1 card carries the flag.
    expect(view.warnings).toContain(flag)
    expect(view.totalNotes[0]).toContain(flag)
    // Draft report and print: the Scope 1 figure is marked ‡ and the note names the subtotal.
    expect(view.printed).toContain("10,622.9000 ‡")
    expect(view.printed).toContain(`‡ Scope 1: ${flag}.`)
    // CSV: the Scope 1 subtotal row says it, and only that row.
    const subtotals = csvLines(view.csv).filter(line => line.startsWith("Subtotal,"))
    expect(subtotals.find(line => line.startsWith("Subtotal,Scope 1,"))).toContain(`${flag}.`)
    expect(subtotals.filter(line => line.includes(flag))).toHaveLength(1)
  })
  test("count mode: a possible duplicate held for another reason is not called counted", () => {
    const dup = row("GAS-1", "natural_gas", 1, { outcome: "held", plan: { action: "hold", status: "input_needed", reasons: ["quantity_required"], notes: [`possible_duplicate_of:${keeper.recordId}`] } })
    const view = render(base([keeper, dup]))
    expect(resultsView.countedDuplicate(dup)).toBe(false)
    expect(resultsView.rowReasons(dup)).not.toContain(reason("possible_duplicate_counted"))
    expect(view.completeness.scope1).toBe("Incomplete — 1 record not yet counted")
    expect(view.notCounted.some(line => line.includes(named))).toBe(true)
  })
  test("no duplicates: the keeper note alone changes nothing on screen", () => {
    const plain = row("GAS-1", "natural_gas", 1, { inSubtotal: { scope1: true, scope2LocationBased: false, scope2MarketBased: false }, scope1: s1(GAS, "complete", { total: kg("5311.4500") }) })
    expect(render(base([plain])).completeness.scope1).toBe(render(base([keeper])).completeness.scope1)
    expect(resultsView.rowStatus(keeper)).toEqual({ label: "Calculated", tone: "ready" })
  })
})
