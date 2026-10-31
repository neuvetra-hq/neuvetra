import { groupDigits, kgToTonnes, kindLabel, reasonText } from "./plain-language"
import { scope3LineReasonCodes, type Scope3ResultsResponse, type Scope3Row } from "./scope3-results-api"
import { scope3ClosedLines, scope3LineState, type Scope3LineState } from "../../../../packages/neuvetra-database/src/scope3-trace"
import { SCOPE3_DISCLOSURE_TEXT } from "../../../../packages/neuvetra-database/src/scope3-text"
import { COPY_TEXT_R2E } from "../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { scope3UpstreamPartialText } from "../../../../packages/neuvetra-database/src/scope3-r3a"
import { SCOPE3_ACTION_TEXT, SCOPE3_DISCLOSURE_GROUP_TEXT, SCOPE3_PARTIAL_TEXT, SCOPE3_READINESS_TEXT, SCOPE3_TODO_TEXT, SCOPE3_UNIT_TEXT } from "./scope3-results-text"
// Round 3 lane C (PR-3): imported spend lines are grouped by hold reason and open the spend import's grouped review.
import { SCOPE3_SPEND_MAPPING_REASONS, spendAmountSum, type SpendImportTab } from "./spend-import-target"
import { TODO_SPEND_TEXT_R3C } from "./scope3-text-r3c"
import { scope3SpendGroupKeyInput } from "../../../../packages/neuvetra-database/src/scope3-spend-grouping"
import { SCOPE3_CONFLICT_TEXT_R3D } from "./scope3-text-r3d"
import { scope3VisibleReviewFlags as sharedVisibleReviewFlags } from "../../../../packages/neuvetra-database/src/scope3-trace"

/**
 * The Scope 3 to-do list, readiness and display rules of the Results screen (round 2, lane D; Claude, 31 October 2026;
 * round-1 product review UX-2, UX-3, UX-9, UX-10; ROUND2 decisions 5 and 7). Pure derivations from the decoded results
 * response only: nothing here calculates emissions. Formatting (tonnes to 2 decimals) is the same exact half-even rule as
 * the Results headline (`kgToTonnes`).
 */
type Category = Scope3ResultsResponse["coverage"]["categories"][number]
/** Lane B (decision 5) adds `screening_conflict`; `review_required` is today's status for the same situation. */
export type Scope3CategoryStatusR2 = Category["status"] | "screening_conflict"
const statusOf = (row: Pick<Category, "status">): Scope3CategoryStatusR2 => row.status as Scope3CategoryStatusR2
export const SCOPE3_CONFLICT_STATUSES: ReadonlySet<string> = new Set(["review_required", "screening_conflict"])

// --- Units (UX-9): one unit on screen, t CO2e with 2 fixed decimals ---

/** Engine kg (exact display string) as t CO2e with 2 decimals; a non-zero figure that rounds to 0.00 says so ("< 0.01"). */
export function scope3Tonnes(kg: string | null | undefined): string {
  if (!kg) return "—"
  const t = kgToTonnes(kg)
  if (t === "—") return t
  if (/^[−-]?0\.00$/.test(t) && /[1-9]/.test(kg)) return kg.startsWith("-") ? SCOPE3_UNIT_TEXT.aboveNegativeDisplay : SCOPE3_UNIT_TEXT.belowDisplay
  return t
}
/** The exact kg figure for hover and details (grouped digits, the engine's own string). */
export const scope3KgText = (kg: string) => groupDigits(kg)

// --- Review flags (UX-9): shown only where they say something ---

/** A category needs at least this many counted lines before "a single record is more than 10%" is worth showing. */
export const SCOPE3_REVIEW_FLAG_MIN_LINES = 5
/**
 * The common v3 review prompts. Stored older methodology remains unchanged.
 */
export function scope3VisibleReviewFlags(row: Pick<Category, "reviewFlags" | "counts">, categories: ReadonlyArray<Pick<Category, "subtotal">>): string[] {
  return sharedVisibleReviewFlags(row, categories)
}

// --- Fix: which field of the record editor the hold reason names (UX-3) ---

/**
 * Hold reason → the labels (as the record editor shows them) of the field to focus, in order of preference. The labels are
 * the forms' own (a test checks each one exists in the form sources). Codes ending in `_not_an_engine_token` name their
 * field by the token's name.
 */
export const SCOPE3_FIX_FIELDS: Readonly<Record<string, readonly string[]>> = {
  // Round 2 integration: lane C's spend form asks for the line's date or its period itself ("Invoice or posting date",
  // "First day covered"); the generic period fields are hidden for spend lines.
  outside_reporting_period: ["Period start", "First day covered"], partly_outside_reporting_period: ["Period start", "First day covered"],
  spend_line_date_outside_reporting_period: ["Invoice or posting date", "First day covered"],
  capital_goods_must_be_full_cost: ["Is the amount the full acquisition cost (not depreciation)?"],
  currency_not_supported: ["Currency"], negative_spend_not_counted: ["Amount spent"], negative_amount_not_supported: ["Amount spent"],
  naics_code_required: ["Search NAICS codes"], trade_sector_naics_maps_margin_only: ["Search NAICS codes"], naics_code_not_in_factor_set: ["Search NAICS codes"],
  possible_duplicate_spend_line: ["This is a different purchase, not a duplicate"],
  finance_lease_in_scope1_2: ["Lease"], lease_type_required: ["Lease"],
  // Round 2 polish (lane D): the freight load basis and the category 4-6 spend overlap confirmation.
  load_basis_required: ["Did the goods have the vehicle to themselves?"], spend_overlap_not_confirmed: ["Covered by another record?"],
  lease_in_scope1_2_under_boundary: [COPY_TEXT_R2E.leaseNoControlLabel, "Lease"],
  natural_gas_use_unknown: ["Does the building use natural gas?"],
  hotel_country_not_in_factor_set: ["Hotel country (two-letter code)"], hotel_country_required: ["Hotel country (two-letter code)"],
  treatment_split_unknown: ["Treatment split"], treatment_split_must_total_100: ["Treatment split"],
  // Round 3 lane D (PR-7): the waste hold is about the treatment (the end-of-life form's is its split); then the material.
  no_published_factor_for_material_and_treatment: ["Treatment", "Treatment split", "Material"],
  // Round 3 lane D (PR-7): freight without a listed vehicle, a declared-haul flight without its basis, a vehicle that can't take
  // the load basis, and the flight count of air by distance (the adapter's code) land on their fields, not the heading.
  vehicle_not_an_engine_token: ["Vehicle"], haul_basis_required: ["How do you know the haul length?"],
  load_basis_not_available_for_vehicle: ["Did the goods have the vehicle to themselves?", "Vehicle"],
  passenger_segments_required: ["One-way flights (passenger segments) at this distance"],
  resold_energy_in_scope2_not_confirmed: ["The electricity resold is kept out of the company’s own Scope 2 electricity records"],
  energy_resold_record_held: ["The electricity resold is kept out of the company’s own Scope 2 electricity records"],
  investee_emissions_required: ["Investee’s scope 1 and 2 emissions (metric tons CO2e)", "What the figure is based on"],
  investee_naics_code_required: ["Search NAICS codes"],
  use_region_not_an_engine_token: ["Where the products are used"], energy_unit_not_an_engine_token: ["Energy unit"],
  fuel_not_an_engine_token: ["Fuel"], vehicle_type_not_an_engine_token: ["Vehicle type"],
  // Round 2 integration (lane F): the sold-fuel hold has its own code; the sold-fuel form's field is labelled "Fuel" too.
  sold_fuel_not_an_engine_token: ["Fuel"],
  heat_content_required_for_volume: ["Bill heat content"],
  flight_segments_required: ["One-way flights (passenger segments) at this distance"],
  material_not_an_engine_token: ["Material"], treatment_not_an_engine_token: ["Treatment"], mode_not_an_engine_token: ["Mode"], unit_not_an_engine_token: ["Unit"],
}
/** The editor labels to focus for a line's reasons (first match wins in the editor); empty when no reason names a field. */
export function scope3FixFields(codes: readonly string[]): string[] {
  const out: string[] = []
  for (const code of codes) for (const label of SCOPE3_FIX_FIELDS[code.split(":")[0]!] ?? []) if (!out.includes(label)) out.push(label)
  return out
}
/** The editor control that withdraws a record (a screening conflict is resolved by withdrawing or correcting it). */
export const SCOPE3_WITHDRAW_CONTROL = "Withdraw this record"

// --- Partial boundary (UX-3): the reason instead of a Fix button ---

/** A ratio (exact decimal string, 0..1) as a percent with one decimal, rounded half-even (display only). */
export function scope3RatioPercent(ratio: string): string {
  const [whole = "0", fraction = ""] = ratio.split(".")
  const digits = fraction.padEnd(3, "0"), rest = digits.slice(3)
  let permille = BigInt(whole + digits.slice(0, 3))
  if (rest && /[1-9]/.test(rest)) { const r = BigInt(rest), half = 5n * 10n ** BigInt(rest.length - 1); if (r > half || (r === half && permille % 2n === 1n)) permille += 1n }
  return `${permille / 10n}.${permille % 10n}`
}
const PARTIAL_NOTES = ["fossil_fuel_upstream_not_mapped", "upstream_of_resold_energy_excluded", "combustion_only_upstream_of_lost_energy_excluded", "building_other_energy_sources_not_included", "nuclear_biomass_byproduct_fuels_upstream_excluded"]
/** Why a calculated line's minimum boundary isn't met, in words; null for a line that isn't partial. */
export function scope3PartialText(row: Scope3Row, closed: boolean): string | null {
  const r = row.result
  if (row.outcome !== "calculated" || r?.status !== "complete" || r.boundary.minimumBoundary === "met") return null
  if (closed) return `${SCOPE3_PARTIAL_TEXT.prefix} ${SCOPE3_PARTIAL_TEXT.closed}`
  // Round 3, lane A (owner decision 2): an upstream electricity line names its fully counted fuels and their share, coal with its
  // share (mine methane only), the fuels not counted and the static notes, from its own fields; never "cover 100%".
  const upstream = scope3UpstreamPartialText((r.activity ?? {}) as Record<string, unknown>, r.boundary.notes, scope3RatioPercent)
  if (upstream !== null) return `${SCOPE3_PARTIAL_TEXT.prefix} ${upstream}`
  const notes = r.boundary.notes.filter(note => PARTIAL_NOTES.includes(note)).map(note => SCOPE3_DISCLOSURE_TEXT[note]).filter((text): text is string => !!text)
  return `${SCOPE3_PARTIAL_TEXT.prefix} ${notes.length ? notes.join(" ") : SCOPE3_PARTIAL_TEXT.generic}`
}

// --- The to-do list (UX-2) ---

export type Scope3TodoAction =
  /** Opens the record editor on `recordId` and focuses the first of `fields` (the editor's labels) that exists. */
  | { type: "fix"; recordId: string; fields: readonly string[]; label: string }
  /** Opens the category's assessment inline. */
  | { type: "assessment"; category: number; label: string }
  /** Company setup (screening). */
  | { type: "setup"; label: string }
  /** The Activity screen, to add a record. */
  | { type: "collection"; category: number; label: string }
  /** Round 3 lane C (PR-3): the spend import's grouped review on the Activity screen, at one tab. */
  | { type: "spend"; tab: SpendImportTab; label: string }
export interface Scope3TodoItem {
  /** Round 3 lane C: "spend" is one item for every imported spend line held for the same reason (`lines` of them). */
  key: string; category: number; kind: "line" | "category" | "spend"
  lines?: number
  /** True when the item is one of decision 7's open issues (approval needs it resolved or acknowledged). */
  blocking: boolean
  title: string
  /** The record the item is about (its source ID is in the title), or null for a category step. */
  recordId: string | null
  reasons: string[]
  actions: Scope3TodoAction[]
}
const TODO_STATES: ReadonlySet<Scope3LineState> = new Set(["inputNeeded", "methodPending", "optionalPending", "outsidePeriod", "unavailable"])
const COUNTED_STATES: ReadonlySet<Scope3LineState> = new Set(["calculated", "partialBoundary", "inputNeeded", "methodPending", "optionalPending", "unavailable"])

/** True when a line is on the to-do list: not counted (held, pending, outside the period, unavailable) or counted in a category screened out. */
export function scope3LineNeedsAttention(state: Scope3LineState, category: Pick<Category, "status"> | undefined): boolean {
  return TODO_STATES.has(state) || (!!category && SCOPE3_CONFLICT_STATUSES.has(statusOf(category)) && COUNTED_STATES.has(state))
}
/** Every Scope 3 line that isn't counted (held, pending, outside the period) or sits in a conflicting category, and every open category step. */
export function scope3Todos(results: Scope3ResultsResponse): Scope3TodoItem[] {
  const closed = scope3ClosedLines(results.records)
  const categories = new Map(results.coverage.categories.map(row => [row.category, row]))
  const items: Scope3TodoItem[] = [], bySource = new Map<string, Scope3TodoItem>()
  const issues = new Map(scope3ReadinessIssues(results).map(issue => [`${issue.category}:${issue.code}`, issue]))
  const issueOf = (category: number) => [...issues.values()].some(issue => issue.category === category && issue.code !== "assessment_missing")
  // Saved records first, so a derived line held for its Scope 3 source record joins that record's item.
  const lines = [...results.records].sort((a, b) => Number(a.derivedFrom !== null) - Number(b.derivedFrom !== null))
  const spendGroups = new Map<string, { category: number; tab: SpendImportTab; reason: string; rows: Scope3Row[]; blocking: boolean; vendors: Set<string> }>()
  for (const row of lines) {
    const state = scope3LineState(row, closed.has(row)), category = categories.get(row.category)
    const conflict = !!category && SCOPE3_CONFLICT_STATUSES.has(statusOf(category)) && COUNTED_STATES.has(state)
    if (!scope3LineNeedsAttention(state, category)) continue
    const codes = scope3LineReasonCodes(row), target = row.derivedFrom?.recordId ?? row.recordId
    // Round 3 lane C (PR-3): an imported spend line held for input joins its reason's group (the spend import maps by
    // vendor and account, many lines at once); a screening conflict or a pending line stays its own item.
    const payload = (row.payload ?? {}) as { importId?: unknown; supplierName?: unknown; glAccount?: unknown }
    if (row.kind === "purchase_spend" && typeof payload.importId === "string" && !conflict && state === "inputNeeded" && codes.length) {
      const bare = codes.map(code => code.split(":")[0]!)
      const other = bare.filter(code => !SCOPE3_SPEND_MAPPING_REASONS.has(code))
      const reason = other.includes("possible_duplicate_spend_line") ? "possible_duplicate_spend_line" : other[0] ?? "mapping"
      const tab: SpendImportTab = reason === "mapping" ? "code" : reason === "possible_duplicate_spend_line" ? "duplicates" : "other"
      const key = `${row.category}:${reason}`
      const group = spendGroups.get(key) ?? { category: row.category, tab, reason, rows: [], blocking: false, vendors: new Set<string>() }
      group.rows.push(row); group.blocking ||= issueOf(row.category)
      // The spend import's own vendor-and-account grouping (legal suffixes, case and punctuation ignored), so the counts agree.
      group.vendors.add(scope3SpendGroupKeyInput({ glAccount: String(payload.glAccount ?? ""), supplierName: String(payload.supplierName ?? "") }) ?? row.recordId)
      spendGroups.set(key, group)
      continue
    }
    const source = row.derivedFrom ? results.records.find(line => line.recordId === row.derivedFrom!.recordId && line.derivedFrom === null) : undefined
    const merged = source ? bySource.get(source.recordId) : undefined
    if (merged) { merged.reasons.push(SCOPE3_TODO_TEXT.alsoHolds([kindLabel(row.kind)])); continue }
    const reasons = [...(conflict ? [SCOPE3_TODO_TEXT.conflictLine(row.category)] : []), ...codes.map(reasonText),
      ...(state === "methodPending" ? [SCOPE3_TODO_TEXT.pendingLine] : state === "optionalPending" ? [SCOPE3_TODO_TEXT.optionalPendingLine] : []),
      // A derived line held for its source names that record; a pending one (no factor yet) has nothing to fix there.
      ...(row.derivedFrom && state !== "methodPending" && state !== "optionalPending" ? [SCOPE3_TODO_TEXT.derivedFrom(kindLabel(row.derivedFrom.kind), row.sourceId)] : [])]
    const fix = (label: string, fields = scope3FixFields(codes)): Scope3TodoAction => ({ type: "fix", recordId: target, fields, label })
    const actions: Scope3TodoAction[] = conflict ? [fix(SCOPE3_ACTION_TEXT.withdraw, [SCOPE3_WITHDRAW_CONTROL]), { type: "setup", label: SCOPE3_ACTION_TEXT.changeScreening }]
      : state === "methodPending" || state === "optionalPending" ? [fix(SCOPE3_ACTION_TEXT.openRecord), { type: "assessment", category: row.category, label: SCOPE3_ACTION_TEXT.documentExclusion }]
        : [fix(row.derivedFrom ? SCOPE3_ACTION_TEXT.fixSource(row.sourceId) : SCOPE3_ACTION_TEXT.fix)]
    const item: Scope3TodoItem = { key: `line:${row.recordId}:${row.kind}`, category: row.category, kind: "line", blocking: (conflict || state === "inputNeeded") && issueOf(row.category),
      title: SCOPE3_TODO_TEXT.lineTitle(kindLabel(row.kind), row.sourceId), recordId: row.recordId, reasons: [...new Set(reasons)], actions }
    items.push(item)
    if (!row.derivedFrom) bySource.set(row.recordId, item)
  }
  for (const [key, group] of spendGroups) {
    const usd = group.rows.filter(row => row.quantity.unit === "USD").map(row => row.quantity.value)
    items.push({ key: `spend:${key}`, category: group.category, kind: "spend", lines: group.rows.length, blocking: group.blocking, recordId: null,
      title: group.reason === "mapping" ? TODO_SPEND_TEXT_R3C.mapTitle(group.rows.length, group.vendors.size, usd.length ? spendAmountSum(usd) : null) : TODO_SPEND_TEXT_R3C.otherTitle(group.rows.length, reasonText(group.reason)),
      reasons: [group.reason === "mapping" ? TODO_SPEND_TEXT_R3C.mapReason : TODO_SPEND_TEXT_R3C.otherReason(group.tab)],
      actions: [{ type: "spend", tab: group.tab, label: TODO_SPEND_TEXT_R3C.open }] })
  }
  for (const row of results.coverage.categories) {
    const status = statusOf(row), decision = row.screening.decision
    const add = (code: string, blocking: boolean, reason: string, actions: Scope3TodoAction[]) => items.push({ key: `category:${row.category}:${code}`, category: row.category, kind: "category", blocking, title: SCOPE3_TODO_TEXT.step[code] ?? SCOPE3_TODO_TEXT.category(row.category, row.title), recordId: null, reasons: [reason], actions })
    if (SCOPE3_CONFLICT_STATUSES.has(status)) add(status, true, SCOPE3_CONFLICT_TEXT_R3D.todo(row.category, decision, row.counts.records - row.counts.withdrawn - row.counts.excluded - row.counts.outsidePeriod), [{ type: "setup", label: SCOPE3_ACTION_TEXT.changeScreening }])
    if (status === "not_screened") add("not_screened", false, SCOPE3_TODO_TEXT.notScreened(row.category), [{ type: "setup", label: SCOPE3_ACTION_TEXT.screen }])
    if (decision === "included" && row.assessment === null) add("assessment_missing", true, SCOPE3_TODO_TEXT.assessmentMissing(row.category), [{ type: "assessment", category: row.category, label: SCOPE3_ACTION_TEXT.assessment }])
    if ((decision === "excluded" || decision === "not_relevant") && row.assessment === null && !SCOPE3_CONFLICT_STATUSES.has(status)) add("assessment_excluded", false, SCOPE3_TODO_TEXT.assessmentExcluded(row.category), [{ type: "assessment", category: row.category, label: SCOPE3_ACTION_TEXT.assessment }])
    if (status === "no_records" && decision === "included") add("no_records", true, SCOPE3_TODO_TEXT.noRecords(row.category), [{ type: "collection", category: row.category, label: SCOPE3_ACTION_TEXT.addRecord(row.category) }, { type: "setup", label: SCOPE3_ACTION_TEXT.changeScreening }])
  }
  // By category; within it the category steps, then blocking lines, then the rest (stable).
  return items.map((item, index) => ({ item, index })).sort((a, b) => a.item.category - b.item.category || Number(a.item.kind !== "category") - Number(b.item.kind !== "category") || Number(b.item.blocking) - Number(a.item.blocking) || a.index - b.index).map(({ item }) => item)
}

/** The action a category row offers (UX-2): the most useful next step for that category, or null when nothing is open. */
export function scope3CategoryAction(row: Category, todos: readonly Scope3TodoItem[]): Scope3TodoAction | { type: "todo"; category: number; label: string } | null {
  const mine = todos.filter(item => item.category === row.category)
  const lines = mine.filter(item => item.kind === "line")
  const status = statusOf(row)
  if (SCOPE3_CONFLICT_STATUSES.has(status)) return { type: "setup", label: SCOPE3_ACTION_TEXT.changeScreening }
  // Round 3 lane C (PR-3): a category whose open lines are all imported spend opens the spend import's review.
  const spend = mine.filter(item => item.kind === "spend")
  if (!lines.length && spend.length) return { type: "spend", tab: spend[0]!.actions[0]!.type === "spend" ? (spend[0]!.actions[0] as { tab: SpendImportTab }).tab : "code", label: TODO_SPEND_TEXT_R3C.categoryAction(spend.reduce((n, item) => n + (item.lines ?? 0), 0)) }
  if (lines.length) return { type: "todo", category: row.category, label: lines.some(item => item.blocking) ? SCOPE3_ACTION_TEXT.fixRecords(lines.length) : SCOPE3_ACTION_TEXT.review(lines.length) }
  const step = mine.find(item => item.kind === "category")
  return step?.actions[0] ?? null
}

// --- Readiness (decision 7; UX-10) ---

export type Scope3OpenIssueCode = "input_needed" | "screening_conflict" | "needs_review" | "assessment_missing" | "included_category_has_no_records"
export interface Scope3OpenIssue { key: string; category: number; code: Scope3OpenIssueCode; text: string }
/**
 * Decision 7's open issues, by category: a category that needs input, has a screening conflict or needs review, and a
 * category screened relevant with no assessment. Keys are stable (`category:<n>:<code>`) so an approval can name exactly
 * the issues the approver saw. A frozen version's issues come from its own stored results.
 */
export function scope3ReadinessIssues(results: Pick<Scope3ResultsResponse, "coverage">): Scope3OpenIssue[] {
  const out: Scope3OpenIssue[] = []
  for (const row of results.coverage.categories) {
    const status = statusOf(row)
    const code: Scope3OpenIssueCode | null = status === "input_needed" ? "input_needed" : status === "screening_conflict" ? "screening_conflict" : status === "review_required" ? "needs_review" : null
    if (code) out.push({ key: `category:${row.category}:${code}`, category: row.category, code, text: SCOPE3_READINESS_TEXT.issue[code]!(row.category) })
    if (row.screening.decision === "included" && row.assessment === null) out.push({ key: `category:${row.category}:assessment_missing`, category: row.category, code: "assessment_missing", text: SCOPE3_READINESS_TEXT.issue.assessment_missing!(row.category) })
  }
  return out
}

/** An open issue in lane B's stored form (`{ category, code }`) with its key and words. */
export function scope3IssueOf(issue: { category: number; code: string }): Scope3OpenIssue {
  const text = SCOPE3_READINESS_TEXT.issue[issue.code]
  return { key: `category:${issue.category}:${issue.code}`, category: issue.category, code: issue.code as Scope3OpenIssueCode, text: text ? text(issue.category) : `Category ${issue.category}: ${issue.code.replace(/_/g, " ")}.` }
}
type StoredReadiness = { readiness?: { openIssues?: Array<{ category: number; code: string }> } }
/** The live open issues: lane B's `results.readiness` when the response carries it, else derived here (same rule, same order). */
export function scope3LiveOpenIssues(results: Pick<Scope3ResultsResponse, "coverage">): Scope3OpenIssue[] {
  const stored = (results as StoredReadiness).readiness?.openIssues
  return Array.isArray(stored) ? stored.map(scope3IssueOf) : scope3ReadinessIssues(results)
}
/**
 * A frozen version's open issues: lane B's version summary (`openIssues`, stored when it was prepared), else its frozen
 * results' `readiness`, else derived from its own stored results — never from the live ones.
 */
export function scope3FrozenOpenIssues(report: { version?: unknown; document: { results: Pick<Scope3ResultsResponse, "coverage"> } }): Scope3OpenIssue[] {
  const summary = (report.version as { openIssues?: Array<{ category: number; code: string }> } | undefined)?.openIssues
  return Array.isArray(summary) ? summary.map(scope3IssueOf) : scope3LiveOpenIssues(report.document.results)
}

// --- Disclosures grouped by category and sorted (UX-9) ---

export interface Scope3DisclosureGroup { key: string; title: string; items: Array<{ code: string; text: string }> }
export function scope3DisclosureGroups(results: Scope3ResultsResponse): Scope3DisclosureGroup[] {
  const sorted = (items: Array<{ code: string; text: string }>) => [...items].sort((a, b) => a.text.localeCompare(b.text, "en"))
  const groups: Scope3DisclosureGroup[] = []
  const across = results.coverage.disclosures.filter(item => item.categories.length === 0)
  if (across.length) groups.push({ key: "all", title: SCOPE3_DISCLOSURE_GROUP_TEXT.across, items: sorted(across) })
  for (const row of results.coverage.categories) {
    const items = results.coverage.disclosures.filter(item => item.categories.includes(row.category))
    if (items.length) groups.push({ key: String(row.category), title: SCOPE3_DISCLOSURE_GROUP_TEXT.group(row.category, row.title, items.length), items: sorted(items) })
  }
  return groups
}

// --- Record filters (UX-9) ---

export type Scope3RecordStatusFilter = "all" | "attention" | "counted" | "not_counted"
export interface Scope3RecordFilter { category: number | null; status: Scope3RecordStatusFilter; kind: string | null; search: string }
export const SCOPE3_DEFAULT_RECORD_FILTER: Scope3RecordFilter = { category: null, status: "all", kind: null, search: "" }
/** The lines that match a filter, grouped by category in category order (lines keep the response order within a category). */
export function scope3FilterRecords(results: Scope3ResultsResponse, filter: Scope3RecordFilter): Array<{ category: number; title: string; rows: Scope3Row[] }> {
  const closed = scope3ClosedLines(results.records)
  const categories = new Map(results.coverage.categories.map(row => [row.category, row]))
  const query = filter.search.trim().toLowerCase()
  const match = (row: Scope3Row) => {
    const state = scope3LineState(row, closed.has(row))
    if (filter.category !== null && row.category !== filter.category) return false
    if (filter.kind !== null && row.kind !== filter.kind) return false
    if (query && !`${row.sourceId} ${row.reference}`.toLowerCase().includes(query)) return false
    if (filter.status === "attention") return scope3LineNeedsAttention(state, categories.get(row.category))
    if (filter.status === "counted") return state === "calculated" || state === "partialBoundary"
    if (filter.status === "not_counted") return !(state === "calculated" || state === "partialBoundary")
    return true
  }
  return results.coverage.categories.map(row => ({ category: row.category, title: row.title, rows: results.records.filter(line => line.category === row.category && match(line)) })).filter(group => group.rows.length > 0)
}

// --- Round 2 polish (lane D, UX-5): a new assessment starts from what company setup says ---

/** What a category's new assessment is prefilled with: setup's description of an included category (activities) and its
 * reason for a category screened out (justification). Null when setup said nothing the assessment can start from. */
export interface Scope3AssessmentPrefill { activitiesIncluded: string; justification: string }
export function scope3AssessmentPrefill(row: Pick<Category, "screening">): Scope3AssessmentPrefill | null {
  const { decision, description, reason } = row.screening
  const activitiesIncluded = decision === "included" ? (description ?? "").trim() : ""
  const justification = decision === "excluded" || decision === "not_relevant" ? (reason ?? "").trim() : ""
  return activitiesIncluded || justification ? { activitiesIncluded, justification } : null
}

// --- Round 2 polish (lane D, UX-15): the within-category exclusions an assessment offers are the category's own ---

/** The categories each documentable within-category exclusion belongs to (the categories its words name). */
export const SCOPE3_EXCLUDABLE_NOTE_CATEGORIES: Readonly<Record<string, readonly number[]>> = {
  nuclear_biomass_byproduct_fuels_upstream_excluded: [3], third_party_facilities_not_included: [4, 9], building_other_energy_sources_not_included: [8, 13, 14],
}
/** The notes a category's assessment offers: its own, plus any the saved revision already documents (never hidden). */
export function scope3ExcludableNotesFor(category: number, documented: readonly string[], notes: readonly string[]): string[] {
  return notes.filter(note => (SCOPE3_EXCLUDABLE_NOTE_CATEGORIES[note] ?? []).includes(category) || documented.includes(note))
}
