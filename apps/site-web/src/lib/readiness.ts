/**
 * WO-04b (PROD-B01 full fix, QA-130–136, J9; Claude, 12 November 2026): readiness by the design's §8 definitions, as pure
 * functions, so the Overview, the side navigation, the Menu sheet and Ask read one source and agree.
 *
 * - R0: while any input is loading the state is "Checking…", after a failure "Couldn't check": never a ✓ and never a
 *   count of zero. No label says complete, ready to file, compliant, approved or assured.
 * - S1 (setup): "All setup questions answered · vN", otherwise "Saved vN · N open answers". With Scope 3 on, every Scope 3
 *   category must be decided and each decided category needs its assessment (the Scope 3 to-do's category steps).
 * - S2 (activity): "Nothing waiting on you in Activity", with the hint (BF-13, BF-13b) that this checks records per source
 *   type, electricity per included site and each site's period coverage within its coverage dates, not each unit's coverage.
 * - S3 (results): "Draft results available · N open · M block internal approval", or "· nothing open". Never a ✓.
 * - One list, in the next-step order: (1) input needed, (2) held, (3) open setup answers, (4) Scope 3 decisions and
 *   assessments, (5) Scope 3 included categories without records, (6) Scope 1 and 2 possible gaps; Scope 3 lines waiting on
 *   a method follow as a non-blocking count (decision O-3); then (7) "Review your draft results".
 *
 * N is the length of that list. Its Scope 3 part is exactly the Results screen's Scope 3 to-do (`scope3Todos`, "N to do ·
 * M block approval"), and M is that to-do's blocking count, so each figure can be checked by following its link.
 */
import type { JourneyPanel, JourneyRecord, JourneyStatus } from "./journey-status"
import type { SpendImportTab } from "./spend-import-target"
import type { HostedWorkspaceActor } from "./workspace-api"
import type { Scope3ResultsResponse } from "./scope3-results-api"

/** Where an item's action goes: a view, one record (its own address) or the spend import's grouped review at a tab. */
export type ReadinessTarget = { type: "view"; view: Exclude<JourneyPanel, "home"> } | { type: "record"; recordId: string } | { type: "spend"; tab: SpendImportTab }
  /** Checks Scope 3 again (the Overview's and Ask's Try again), when its check failed. */
  | { type: "retryScope3" }
  /** WO-04c: one Scope 3 category's assessment, opened inline in the Results to-do. */
  | { type: "assessment"; category: number }
/**
 * "duplicate" (CEO ruling, 12 November 2026) is not an open group: a possible duplicate is counted and warned about, and when
 * the two records are really different there is nothing to do yet. It is listed to confirm, never counted in "N open" and
 * never the next step, but while any is listed step 2 shows no ✓.
 */
export type ReadinessGroup = "input" | "held" | "setup" | "scope3-decision" | "scope3-no-records" | "gap" | "method" | "duplicate"
/** The next-step order (§8); "method" (Scope 3 lines waiting on a method) is a non-blocking count after the six groups. */
export const READINESS_GROUPS: readonly ReadinessGroup[] = ["input", "held", "setup", "scope3-decision", "scope3-no-records", "gap", "method"]
export const READINESS_GROUP_TEXT: Readonly<Record<ReadinessGroup, string>> = {
  input: "Input needed",
  held: "Held — outside the reporting period",
  setup: "Open company setup answers",
  "scope3-decision": "Scope 3 decisions and assessments",
  "scope3-no-records": "Scope 3 categories included without records",
  gap: "Possible gaps in Scope 1 and 2",
  method: "Scope 3 lines waiting on a method (not blocking)",
  duplicate: "To confirm: possible duplicates (both are counted)",
}
/** The action of a possible duplicate (CEO ruling): never "Add what's missing". */
export const DUPLICATE_ACTION = "Check a possible duplicate"
export interface ReadinessItem {
  key: string
  group: ReadinessGroup
  scope: "1-2" | "3"
  title: string
  detail: string
  target: ReadinessTarget
  /** The action's visible label; its accessible name is "<label>: <title>". */
  action: string
  /** True for a Scope 3 item that blocks internal approval of a Scope 3 report version (the Results to-do's own flag). */
  blocking: boolean
}
/** What the Scope 3 part of readiness knows: switched off, still loading, failed, or the to-do's items. */
export type Scope3Part = { state: "off" } | { state: "checking" } | { state: "failed"; message: string | null } | { state: "ready"; items: ReadinessItem[] }
export interface StepLabel { text: string; done: boolean }
export interface NextStep { title: string; body: string; action: string; target: ReadinessTarget; secondary?: { action: string; target: ReadinessTarget } }
export type Readiness =
  | { state: "checking" }
  | { state: "failed"; message: string | null }
  | {
    state: "ready"
    canManage: boolean
    /** The Scope 3 part's own state; "checking" and "failed" leave every label that depends on it unresolved. */
    scope3: Scope3Part["state"]
    /** Every open item, in the next-step order (the Overview's list; Ask lists the same, in the same order). */
    items: ReadinessItem[]
    /** Possible duplicates to confirm (both records are counted): listed apart, not open items, never the next step. */
    duplicates: ReadinessItem[]
    /**
     * `total` is `items.length` (possible duplicates excluded). While Scope 3 is checking or failed, `scope3` and `blocking`
     * are null (never 0). `scope3Duplicates`: the Scope 3 to-do's counted possible duplicates, listed apart here, so the
     * Results to-do count is `scope3 + scope3Duplicates`.
     */
    open: { total: number; scope12: number; scope3: number | null; blocking: number | null; duplicates: number; scope3Duplicates: number }
    s1: StepLabel; s2: StepLabel; s3: StepLabel
    /** The S2 hint, shown with the Activity step. */
    s2Hint: string
    next: NextStep
  }

export const READINESS_TEXT = {
  checking: "Checking…",
  failed: "Couldn’t check",
  notStarted: "Not started",
  scope3Checking: "Scope 3: Checking…",
  scope3Failed: "Scope 3: Couldn’t check",
  s1Done: (revision: number | null) => `All setup questions answered · v${revision}`,
  s1Open: (revision: number | null, open: number, scope12: number, scope3: number | null) => `Saved v${revision} · ${plural(open, "open answer")}${scope3 && scope12 ? ` (${scope12} Scope 1 and 2 · ${scope3} Scope 3)` : scope3 ? " (all Scope 3)" : ""}`,
  s1Saved: (revision: number | null) => `Saved v${revision}`,
  s2Done: "Nothing waiting on you in Activity",
  s2Hint: "This checks that each source type in company setup has records and each included site has electricity records, and that at each included site the records of each Scope 1 and 2 source type it has cover every day of the reporting period that the site's coverage dates include — not whether each meter, vehicle and piece of equipment has its own records covering those days, or whether a site uses a Scope 1 source type recorded only at other sites.",
  s2Open: (records: number, open: number) => `${plural(records, "record")} · ${open} waiting on you`,
  s2NothingWaiting: "Nothing waiting on you",
  duplicatesSuffix: (count: number) => ` · ${plural(count, "possible duplicate")} to confirm`,
  s2Records: (records: number) => plural(records, "record"),
  s3Open: (open: number, blocking: number | null) => `Draft results available · ${open} open${blocking === null ? "" : ` · ${blocking === 0 ? "none block" : blocking === 1 ? "1 blocks" : `${blocking} block`} internal approval`}`,
  s3Nothing: "Draft results available · nothing open",
  s3Partial: (open: number) => `Draft results available${open ? ` · ${open} open in Scope 1 and 2` : ""}`,
  s3NothingToCalculate: "Nothing to calculate yet",
  review: { title: "Review your draft results", action: "View results" },
  reviewBody: (scope3On: boolean) => `Nothing is waiting on you${scope3On ? " in Scope 1, 2 or 3" : ""}. Review the draft figures, then print or download the draft report. Figures are drafts from beta methods and have not been reviewed by an independent assurance provider.`,
  openSummary: (total: number, scope12: number, scope3: number | null, blocking: number | null, scope3Duplicates = 0) => `${plural(total, "open item")}${scope3 === null ? "" : ` · ${scope12} in Scope 1 and 2 · ${scope3} in Scope 3 (${scope3Duplicates ? resultsScope3Note(scope3, scope3Duplicates) : `Results lists the same ${scope3} in its Scope 3 to-do`})`}${blocking ? ` · ${blocking} block${blocking === 1 ? "s" : ""} internal approval` : ""}`,
  /**
   * WO-04c (QA follow-up 1 of PR #51): how Results' Scope 3 to-do counts the Scope 3 possible duplicates listed here. Shown
   * whenever there is one, also when nothing is open, because Results lists them "to confirm (counted)".
   */
  resultsScope3Note: (scope3: number, duplicates: number) => resultsScope3Note(scope3, duplicates),
  /** While Scope 3 is checking or failed: the count covers Scope 1 and 2 so far (QA follow-up 1). */
  openSummaryPartial: (scope12: number, failed: boolean) => `${scope12 ? `${plural(scope12, "open item")} in Scope 1 and 2 so far` : "Nothing open in Scope 1 and 2"} · Scope 3 ${failed ? "couldn’t be checked, so its items aren’t counted" : "is still being checked"}`,
  duplicatesSummary: (count: number) => `${plural(count, "possible duplicate")} to confirm (both records are counted; not counted as open)`,
  /** WO-13 (QA follow-up 2 of PR #55): the Next step's note, with "is" for one and "are" for several. */
  duplicatesListed: (count: number) => `${plural(count, "possible duplicate")} to confirm (both records are counted; not counted as open) ${count === 1 ? "is" : "are"} listed under “What needs attention”.`,
  failedNext: { title: "Couldn’t check Scope 3", body: "Scope 1 and 2 have nothing waiting on you. Scope 3’s open items couldn’t be loaded, so none are listed or counted. Try again, or open Results & report to see them.", action: "Try again" },
  more: (others: number) => others ? ` ${plural(others, "more open item")} ${others === 1 ? "is" : "are"} listed under “What needs attention” on the Overview.` : "",
} as const

/** WO-04b: the Overview's Scope 3 row while its part of readiness is off, checking or failed (no count of zero, no ✓). */
export const OVERVIEW_SCOPE3_TEXT = {
  off: "Scope 3 isn’t switched on in this workspace",
  checking: "Checking Scope 3…",
  checkingDetail: "Scope 1 and 2 are shown above. Scope 3’s open items are added here when the check finishes; Results lists them too.",
  failed: "Couldn’t check Scope 3",
  failedDetail: "Scope 3’s open items couldn’t be loaded, so none are counted here. Results lists them, or try again.",
  retry: "Try again",
  openResults: "Open Results",
  nothingOpen: "Nothing is waiting on you. Figures are drafts from beta methods and have not been reviewed by an independent assurance provider.",
  improveNote: "Not counted as open items.",
} as const

function plural(count: number, one: string, many = `${one}s`) { return `${count} ${count === 1 ? one : many}` }
function resultsScope3Note(scope3: number, duplicates: number) {
  return `Results’ Scope 3 to-do shows ${scope3 ? `the same ${scope3} to do and ` : ""}${duplicates} to confirm (counted): the possible duplicate${duplicates === 1 ? "" : "s"} listed below`
}
/** WO-04c: one side of a possible-duplicate pair (its site and period, in words, when known). */
export interface DuplicateSide { id: string; label: string; sourceId: string; site?: string | null; period?: string | null; fuel?: string | null; modelYear?: number | null }
/**
 * WO-04c (QA follow-up 2 of PR #51): a pair's title names both records so they can be told apart: "Natural gas · GAS-A and
 * Natural gas · gas-a" when the names differ; otherwise each side adds what differs (site, period), or failing that its
 * period and record ID.
 */
export function duplicatePairTitle(a: DuplicateSide, b: DuplicateSide | null): string {
  const name = (side: DuplicateSide) => `${side.label} · ${side.sourceId}`
  if (!b) return `${name(a)} and an earlier record`
  if (name(a) !== name(b)) return `${name(a)} and ${name(b)}`
  const differs = (key: "site" | "period" | "fuel" | "modelYear") => Boolean(a[key] && b[key] && a[key] !== b[key])
  // WO-13 (QA follow-up 3 of PR #55): a vehicle group's pair with the same site and period is told apart by its fuel, then
  // its model year, before the full record ID.
  const vehicle = (side: DuplicateSide) => differs("fuel") ? side.fuel!.replace(/_/g, " ") : differs("modelYear") ? `model year ${side.modelYear}` : null
  const extra = (side: DuplicateSide) => {
    const parts = [differs("site") ? side.site : null, differs("period") ? side.period : null].filter(Boolean) as string[]
    const told = parts.length ? parts : [vehicle(side)].filter(Boolean) as string[]
    return (told.length ? told : [side.period ?? null, `record ${side.id}`].filter(Boolean) as string[]).join(", ")
  }
  return `${name(a)} (${extra(a)}) and ${name(b)} (${extra(b)})`
}
/**
 * WO-04c: the Overview's "What needs attention" line. Its parts are joined with " · " (QA follow-up 3); with Scope 3
 * possible duplicates and nothing open it still says how Results counts them (follow-up 1).
 */
export function overviewSummary(readiness: Extract<Readiness, { state: "ready" }>, hasRecords: boolean): string {
  const { items, duplicates, open } = readiness
  const resolved = readiness.scope3 === "off" || readiness.scope3 === "ready"
  const parts = [!resolved ? READINESS_TEXT.openSummaryPartial(open.scope12, readiness.scope3 === "failed")
    : items.length ? READINESS_TEXT.openSummary(open.total, open.scope12, open.scope3, open.blocking, open.scope3Duplicates)
      : !hasRecords ? "No records yet — start with the next step above"
        : duplicates.length ? "Nothing is waiting on you" : OVERVIEW_SCOPE3_TEXT.nothingOpen]
  if (duplicates.length) parts.push(READINESS_TEXT.duplicatesSummary(duplicates.length))
  if (resolved && !items.length && open.scope3Duplicates) parts.push(resultsScope3Note(0, open.scope3Duplicates))
  const text = parts.join(" · ")
  return text.endsWith(".") ? text : `${text}.`
}
const view = (name: Exclude<JourneyPanel, "home">): ReadinessTarget => ({ type: "view", view: name })

/** Scope 1 and 2 items from the journey status: records needing input or review, held records, setup answers and gaps. */
export function scope12Items(status: JourneyStatus): ReadinessItem[] {
  const manage = status.canManage
  const scope12 = (row: JourneyRecord) => SCOPE12.has(row.kind)
  const records = status.collection.records.filter(scope12)
  const items: ReadinessItem[] = []
  for (const row of records) {
    if (row.state === "input_needed" || row.state === "review_required") items.push({ key: `record:${row.id}`, group: "input", scope: "1-2", title: `${row.label} · ${row.sourceId}`, detail: [row.reasons[0] ?? "More information is needed.", row.wouldRepeatCounted ?? ""].filter(Boolean).join(" "), target: { type: "record", recordId: row.id }, action: manage ? "Fix" : "View", blocking: false })
    else if (row.possibleDuplicate) items.push({ key: `duplicate:${row.id}`, group: "duplicate", scope: "1-2", title: duplicatePairTitle({ id: row.id, label: row.label, sourceId: row.sourceId, site: row.site, period: row.period ?? null, fuel: row.fuel ?? null, modelYear: row.modelYear ?? null }, row.possibleDuplicateOther ?? null), detail: `${row.possibleDuplicate} Both records are counted. If they are the same record, withdraw or correct one of them; if they are different records, nothing needs doing.`, target: { type: "record", recordId: row.id }, action: manage ? DUPLICATE_ACTION : "View", blocking: false })
  }
  for (const row of records) if (row.state === "held_period") items.push({ key: `held:${row.id}`, group: "held", scope: "1-2", title: `${row.label} · ${row.sourceId}`, detail: row.reasons[0] ?? "Outside the reporting period, so it isn’t counted.", target: view("setup"), action: manage ? "Open setup" : "View setup", blocking: false })
  for (const item of status.setup.missing) items.push({ key: `setup:${item.id}`, group: "setup", scope: "1-2", title: item.title, detail: `Company setup · ${item.detail}`, target: view("setup"), action: manage ? "Open" : "View", blocking: false })
  for (const gap of status.gaps) items.push({ key: `gap:${gap.id}`, group: "gap", scope: "1-2", title: gap.title, detail: [manage ? gap.detail : "", gap.note ? `Note: ${gap.note}` : ""].filter(Boolean).join(" ") || "Compare company setup with the saved records.", target: view("collection"), action: manage ? "Add" : "View", blocking: false })
  return items
}
/** The Scope 1 and 2 kinds (Scope 3 kinds and imported spend lines come only from the Scope 3 to-do). */
const SCOPE12: ReadonlySet<string> = new Set(["natural_gas", "vehicle", "distillate_no2", "fugitive", "electricity"])

/** Readiness from the journey status (null while loading), whether it failed, and the Scope 3 part. */
export function computeReadiness(input: { status: JourneyStatus | null; statusFailed: boolean; statusError?: string | null; scope3: Scope3Part }): Readiness {
  const { status } = input
  if (!status) return input.statusFailed ? { state: "failed", message: input.statusError ?? null } : { state: "checking" }
  // A status without Scope 3 is "off", whatever the Scope 3 part says (it may still hold an earlier answer).
  const scope3: Scope3Part = status.scope3 ? input.scope3.state === "off" ? { state: "checking" } : input.scope3 : { state: "off" }
  const scope3Items = scope3.state === "ready" ? scope3.items : []
  const all = [...scope12Items(status), ...scope3Items]
  const items = READINESS_GROUPS.flatMap(group => all.filter(item => item.group === group))
  const duplicates = all.filter(item => item.group === "duplicate")
  const resolved = scope3.state === "off" || scope3.state === "ready"
  const scope12Count = items.filter(item => item.scope === "1-2").length
  const scope3Count = scope3.state === "ready" ? scope3Items.filter(item => item.group !== "duplicate").length : scope3.state === "off" ? 0 : null
  const blocking = scope3.state === "ready" ? scope3Items.filter(item => item.blocking).length : null
  const open = { total: items.length, scope12: scope12Count, scope3: scope3.state === "off" ? null : scope3Count, blocking, duplicates: duplicates.length, scope3Duplicates: duplicates.filter(item => item.scope === "3").length }
  const dupSuffix = duplicates.length ? READINESS_TEXT.duplicatesSuffix(duplicates.length) : ""
  const pending = scope3.state === "checking" ? READINESS_TEXT.scope3Checking : scope3.state === "failed" ? READINESS_TEXT.scope3Failed : ""
  const withPending = (text: string) => pending ? `${text} · ${pending}` : text

  // S1: company setup, and with Scope 3 on its decisions and assessments.
  const { setup, collection } = status
  const setupScope12 = items.filter(item => item.group === "setup").length
  const setupScope3 = items.filter(item => item.group === "scope3-decision").length
  let s1: StepLabel
  if (!setup.saved) s1 = { text: READINESS_TEXT.notStarted, done: false }
  else if (!resolved) s1 = { text: withPending(setupScope12 ? READINESS_TEXT.s1Open(setup.revision, setupScope12, setupScope12, null) : READINESS_TEXT.s1Saved(setup.revision)), done: false }
  else if (setupScope12 + setupScope3) s1 = { text: READINESS_TEXT.s1Open(setup.revision, setupScope12 + setupScope3, setupScope12, scope3.state === "ready" ? setupScope3 : null), done: false }
  else s1 = { text: READINESS_TEXT.s1Done(setup.revision), done: true }

  // S2: what is waiting on the user in Activity (input, held, Scope 3 categories without records, possible gaps).
  const activityOpen = items.filter(item => item.group === "input" || item.group === "held" || item.group === "scope3-no-records" || item.group === "gap").length
  let s2: StepLabel
  if (!collection.active) s2 = { text: READINESS_TEXT.notStarted, done: false }
  else if (!resolved) s2 = { text: withPending(`${activityOpen ? READINESS_TEXT.s2Open(collection.active, activityOpen) : READINESS_TEXT.s2Records(collection.active)}${dupSuffix}`), done: false }
  else if (activityOpen) s2 = { text: `${READINESS_TEXT.s2Open(collection.active, activityOpen)}${dupSuffix}`, done: false }
  // CEO ruling: a possible duplicate to confirm keeps the ✓ off, though nothing is waiting on the user.
  else if (duplicates.length) s2 = { text: `${READINESS_TEXT.s2NothingWaiting}${dupSuffix}`, done: false }
  else s2 = { text: READINESS_TEXT.s2Done, done: true }

  // S3: never a ✓.
  let s3: StepLabel
  if (!collection.active) s3 = { text: READINESS_TEXT.notStarted, done: false }
  else if (!collection.ready) s3 = { text: withPending(READINESS_TEXT.s3NothingToCalculate), done: false }
  else if (!resolved) s3 = { text: withPending(`${READINESS_TEXT.s3Partial(scope12Count)}${dupSuffix}`), done: false }
  else s3 = { text: `${items.length ? READINESS_TEXT.s3Open(items.length, scope3.state === "ready" ? blocking : null) : READINESS_TEXT.s3Nothing}${dupSuffix}`, done: false }

  return { state: "ready", canManage: status.canManage, scope3: scope3.state, items, duplicates, open, s1, s2, s3, s2Hint: READINESS_TEXT.s2Hint, next: nextStep(status, items, duplicates, scope3.state) }
}

const NEXT_PREFIX: Readonly<Record<ReadinessGroup, (title: string) => string>> = {
  input: title => `Add what’s missing: ${title}`,
  held: title => `Check the dates: ${title}`,
  setup: title => title,
  "scope3-decision": title => `Scope 3 decision: ${title}`,
  "scope3-no-records": title => `Add Scope 3 records: ${title}`,
  gap: title => `Check a possible gap: ${title}`,
  method: title => title,
  duplicate: title => title,
}
/**
 * The Overview's "Next step": the journey's first steps (setup, a site, a first record) while those are missing, else the
 * first item of the list (Scope 3 lines waiting on a method are never a next step), else "Review your draft results".
 */
function nextStep(status: JourneyStatus, items: ReadinessItem[], duplicates: ReadinessItem[], scope3State: Scope3Part["state"]): NextStep {
  const scope3On = scope3State !== "off"
  const early = !status.setup.saved || !status.setup.sites.included || !status.collection.active
  if (early) return { title: status.next.title, body: status.next.body, action: status.next.action, target: status.next.spendImport ? { type: "spend", tab: "code" } : status.next.recordId ? { type: "record", recordId: status.next.recordId } : view(status.next.panel === "home" ? "setup" : status.next.panel) }
  const actionable = items.filter(item => item.group !== "method")
  const first = actionable[0]
  const results = status.collection.ready ? { action: "View draft results", target: view("results") } : undefined
  if (first) return { title: NEXT_PREFIX[first.group](first.title), body: `${first.detail}${READINESS_TEXT.more(items.length - 1)}`, action: first.action, target: first.target, ...(first.target.type === "view" && first.target.view === "results" ? {} : results ? { secondary: results } : {}) }
  // B2 (QA of PR #51): a failed Scope 3 check says so, with Try again, as every other line does.
  if (scope3State === "failed") return { title: READINESS_TEXT.failedNext.title, body: READINESS_TEXT.failedNext.body, action: READINESS_TEXT.failedNext.action, target: { type: "retryScope3" }, secondary: { action: "Open Results", target: view("results") } }
  if (scope3State === "checking") return { title: "Checking Scope 3", body: "Scope 1 and 2 have nothing waiting on you. Scope 3 is still being checked; its open items appear here when the check finishes, and on Results.", action: READINESS_TEXT.review.action, target: view("results") }
  const confirm = duplicates.length ? ` ${READINESS_TEXT.duplicatesListed(duplicates.length)}` : ""
  return { title: READINESS_TEXT.review.title, body: `${READINESS_TEXT.reviewBody(scope3On)}${items.length ? READINESS_TEXT.more(items.length) : ""}${confirm}`, action: READINESS_TEXT.review.action, target: view("results") }
}

/** The view an item's or the next step's action opens (the spend import and a record open on Activity). */
export const targetView = (target: ReadinessTarget): JourneyPanel => target.type === "view" ? target.view : target.type === "retryScope3" ? "home" : target.type === "assessment" ? "results" : "collection"

/** Answers the user's progress question from the same readiness as the Overview: the same items, in the same order. */
export function progressAnswer(readiness: Readiness, improve: string[] = []): string[] {
  if (readiness.state === "checking") return ["I can’t see your progress yet — it’s still loading. Try again in a moment."]
  if (readiness.state === "failed") return ["Your progress couldn’t be checked, so I can’t answer from your records right now. Try again from the Overview."]
  const lines = [`Next step: ${readiness.next.title}. ${readiness.next.body}`]
  if (readiness.items.length) {
    lines.push(`${readiness.scope3 === "checking" || readiness.scope3 === "failed" ? READINESS_TEXT.openSummaryPartial(readiness.open.scope12, readiness.scope3 === "failed") : READINESS_TEXT.openSummary(readiness.open.total, readiness.open.scope12, readiness.open.scope3, readiness.open.blocking, readiness.open.scope3Duplicates)}, in the Overview’s order:`)
    readiness.items.forEach((item, index) => lines.push(`${index + 1}. ${READINESS_GROUP_TEXT[item.group]} — ${item.title}${item.blocking ? " (blocks internal approval)" : ""}.`))
  }
  if (readiness.duplicates.length) {
    // WO-04c: with nothing open, the line also says how Results' Scope 3 to-do counts them, as the Overview does.
    const note = !readiness.items.length && readiness.open.scope3Duplicates ? ` · ${resultsScope3Note(0, readiness.open.scope3Duplicates)}` : ""
    lines.push(`${READINESS_GROUP_TEXT.duplicate} — ${READINESS_TEXT.duplicatesSummary(readiness.duplicates.length)}${note}:`)
    readiness.duplicates.forEach(item => lines.push(`• ${item.title}.`))
  }
  if (readiness.scope3 === "checking") lines.push("Scope 3 is still being checked, so its open items aren’t listed yet. Ask again in a moment, or open Results & report.")
  // WO-04c (QA follow-up 4): Ask's own Try again below checks Scope 3 again.
  if (readiness.scope3 === "failed") lines.push(`Scope 3 couldn’t be checked just now, so its open items aren’t listed. Use Try again below, or open Results & report to see them.`)
  if (improve.length) lines.push(`Can be improved (not counted as open): ${improve.join("; ")}.`)
  if (!readiness.items.length && !readiness.duplicates.length && (readiness.scope3 === "off" || readiness.scope3 === "ready")) lines.push("Nothing is waiting on you. Open Results & report to review the draft — it stays a draft until an independent reviewer checks it.")
  return lines
}

/** "Can be improved" (never counted as open): partly calculated records, records without evidence or with unknown quality. */
export function improveLines(status: JourneyStatus): string[] {
  const { collection } = status
  const out: string[] = []
  if (collection.partial) out.push(`${plural(collection.partial, "record is", "records are")} only partly calculated`)
  if (collection.noEvidence) out.push(`${plural(collection.noEvidence, "record has", "records have")} no evidence linked`)
  if (collection.qualityUnknown) out.push(`${plural(collection.qualityUnknown, "record has", "records have")} data quality “Unknown”`)
  return out
}

/** The Scope 3 part's one request (the lazy chunk, so the entry chunk doesn't carry the Scope 3 checklist). */
export async function loadScope3ReadinessLazy(workspaceId: string, actor: HostedWorkspaceActor, canManage: boolean): Promise<ReadinessItem[]> {
  return (await import("./readiness-scope3")).loadScope3Readiness(workspaceId, actor, canManage)
}
/** Results' own Scope 3 answer as readiness items (the same lazy chunk). */
export async function scope3ItemsLazy(results: Scope3ResultsResponse, canManage: boolean): Promise<ReadinessItem[]> {
  return (await import("./readiness-scope3")).scope3ReadinessItems(results, canManage)
}
