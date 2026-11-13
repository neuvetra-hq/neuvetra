import type { CompanySetupView } from "../../../../packages/neuvetra-database/src/company-setup-contract"
import { savedAgainstCurrentSetup } from "../../../../packages/neuvetra-database/src/collection-contract"
import { instrumentEvidenceClaims } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import type { CollectionActivityRecord, CollectionContext, CollectionEvidenceMetadata } from "./collection-api"
import { listCollectionActivities, listCollectionEvidence, loadCollectionOverview } from "./collection-api"
import { loadCompanySetup } from "./company-setup-api"
import type { HostedWorkspaceActor } from "./workspace-api"
import { recordReadiness, type CollectionReadinessFinding } from "@/components/CollectionWorkspace"
import { kindLabel, periodLabel, sourceCategoryLabel, type RecordState } from "./plain-language"
import { TODO_SPEND_TEXT_R3C } from "./scope3-text-r3c"
import { scope3ReadinessOptions, scope3SetupFacts, scope3SpendLineChoices } from "./scope3-forms"
import { possibleDuplicateOfText, possibleDuplicatePairs, wouldRepeatCountedText } from "../../../../packages/neuvetra-database/src/collection-duplicates"
import { COVERAGE_TEXT, periodCoverageGaps } from "./period-coverage"
/** BF-13: the coverage statements, re-exported so every surface that reads coverage reads one wording. */
export { COVERAGE_TEXT }

export type JourneyPanel = "home" | "setup" | "collection" | "results"
export interface JourneyRecord { id: string; kind: string; label: string; sourceId: string; locationId: string; site: string; state: RecordState; reasons: string[]; evidenceCount: number; quality: string
  /** BF-13: the record's own dates (half-open ISO), for the period-coverage check. */
  periodStart: string; periodEndExclusive: string
  /** Round 3 lane C (PR-3): a line of a spend import (its holds are fixed in the spend import's grouped review). */
  importedSpend?: true
  /**
   * WO-04b (BF-01A, count mode): a counted Scope 1 or 2 record that may repeat an earlier record, named in words ("Possible
   * duplicate of GAS-1 at Office, …"). The same rule and records as the Scope 1 and 2 results route, so Results flags it too.
   */
  possibleDuplicate?: string
  /** WO-04b: the other record of the pair (its kind label and source ID), so the Overview names both records. WO-04c: and
   * its site and period, so a pair with the same name can be told apart. */
  possibleDuplicateOther?: { id: string; label: string; sourceId: string; site?: string; period?: string; fuel?: string; modelYear?: number }
  /** BF-01e: on a record that isn't counted but matches a counted one: completing it would count the activity twice. */
  wouldRepeatCounted?: string
  /** WO-04c: the record's own period, in words. */
  period?: string
  /** WO-13: a vehicle group's fuel and model year, which tell apart a possible-duplicate pair with the same period. */
  fuel?: string; modelYear?: number }
/** A company-setup answer that is still open. `scopes` lists the totals it can leave incomplete (empty: it doesn't affect totals). */
export interface SetupOpenItem { id: string; title: string; detail: string; scopes: Array<1 | 2> }
/** A possible coverage gap: missing records, an unsupported source or an unresolved legacy source family. */
export interface CoverageGap { id: string; scope: 1 | 2; title: string; detail: string; note: string | null; noteFrom: "site" | "source" }
export interface JourneyStatus {
  canManage: boolean
  setup: { saved: boolean; revision: number | null; legalName: string; period: { start: string | null; endExclusive: string | null }; boundary: string; sites: { total: number; included: number; excluded: number; undecided: number }; missing: SetupOpenItem[] }
  collection: { total: number; active: number; ready: number; attention: number; held: number; partial: number; withdrawn: number; excluded: number; noEvidence: number; qualityUnknown: number; olderSetup: number; byKind: Record<string, number>; records: JourneyRecord[] }
  gaps: CoverageGap[]
  evidence: { total: number; checking: number; cleared: number; rejected: number }
  next: { panel: JourneyPanel; title: string; body: string; action: string; recordId?: string; secondary?: { panel: JourneyPanel; action: string }
    /** Round 3 lane C (PR-3): the action opens the spend import's grouped review (at "Needs a code"). */
    spendImport?: true }
  progress: { setup: "done" | "in_progress" | "not_started"; collection: "done" | "in_progress" | "not_started"; results: "ready" | "waiting" }
  /** Round 2 lane E (UX-8): present (true) when the server stores Scope 3 activity, so the overview can say so. */
  scope3?: true
}

/** One record's journey state from the same readiness rules the activity screen shows. */
export function recordState(findings: CollectionReadinessFinding[]): RecordState {
  const statuses = new Set(findings.map(finding => finding.status))
  if (statuses.has("withdrawn")) return "withdrawn"
  if (statuses.has("excluded")) return "excluded"
  if (statuses.has("input_needed")) return "input_needed"
  if (statuses.has("review_required")) return "review_required"
  // I-08: waiting for a factor source is neither ready nor something to fix.
  if (statuses.has("method_pending")) return "method_pending"
  if (statuses.has("memo_only")) return "memo_only"
  if (statuses.has("partial")) return "partial"
  return "ready"
}

const FAMILY_KINDS: Record<string, { kind: string | null; noun: string; records: string }> = {
  "Heating & process equipment": { kind: "natural_gas", noun: "heating or process equipment", records: "natural gas records" },
  "Backup generators": { kind: "distillate_no2", noun: "backup generators", records: "generator fuel records" },
  "Road & off-road vehicles": { kind: "vehicle", noun: "vehicles", records: "vehicle records" },
  "Cooling & fire suppression": { kind: "fugitive", noun: "cooling or fire-suppression equipment", records: "refrigerant records" },
  "Processes & other direct releases": { kind: null, noun: "process or other direct emissions", records: "" },
}
/** The Scope 1 and 2 kinds (the results route's rule: every other saved kind is Scope 3). */
const SCOPE12_KINDS: ReadonlySet<string> = new Set(["natural_gas", "vehicle", "distillate_no2", "fugitive", "electricity"])
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`
/** Half-open ISO date ranges; mirrors checkPeriod in the results route. */
export function periodFit(record: { start: string; endExclusive: string }, period: { start: string | null; endExclusive: string | null } | null): "inside" | "partial" | "outside" | "no_period" {
  if (!period?.start || !period.endExclusive) return "no_period"
  if (record.start >= period.start && record.endExclusive <= period.endExclusive) return "inside"
  if (record.endExclusive <= period.start || record.start >= period.endExclusive) return "outside"
  return "partial"
}
/** Activity records in this beta can only be dated inside calendar 2025 (collection contract). */
const BETA_PERIOD = { start: "2025-01-01", endExclusive: "2026-01-01" }

/** Setup answers that are still open, named one by one. "Not sure yet" stays visible here until it is answered. */
export function setupMissing(view: CompanySetupView | null): SetupOpenItem[] {
  const setup = view?.currentVersion?.setup
  if (!setup) return [{ id: "setup", title: "Save your company setup", detail: "Company setup lists your sites and the kinds of sources you have, so nothing is left out.", scopes: [1, 2] }]
  const missing: SetupOpenItem[] = []
  if (!setup.company.legalName.trim()) missing.push({ id: "legal-name", title: "Add the company’s legal name", detail: "01 Company.", scopes: [] })
  if (!setup.reportingPeriod.start || !setup.reportingPeriod.endExclusive) missing.push({ id: "period", title: "Set the reporting period", detail: "02 Reporting period. Records are checked against it.", scopes: [1, 2] })
  else if (setup.reportingPeriod.start < BETA_PERIOD.start || setup.reportingPeriod.endExclusive > BETA_PERIOD.endExclusive) missing.push({ id: "beta-period", title: `This beta covers activity in calendar 2025 only — your reporting period is ${periodLabel(setup.reportingPeriod.start, setup.reportingPeriod.endExclusive)}`, detail: "02 Reporting period. Activity outside 2025 can’t be added yet, so the beta can’t cover this whole period. Records outside the period are held, not counted.", scopes: [1, 2] })
  if (setup.boundary.approach === "unknown") missing.push({ id: "boundary", title: "Choose a boundary approach", detail: "03 Entities & boundary. It decides which sites and sources belong in the inventory.", scopes: [1, 2] })
  if (!setup.locations.length) missing.push({ id: "sites", title: "Add at least one site", detail: "04 Locations.", scopes: [1, 2] })
  for (const location of setup.locations) if (location.inclusion === "unknown") missing.push({ id: `site-${location.id}`, title: `Decide whether ${location.name || "an unnamed site"} is included`, detail: "04 Locations. Its records aren’t counted until the site is included.", scopes: [1, 2] })
  for (const row of setup.screening) if (row.state === "unknown" && (row.scope === 1 || row.scope === 2)) {
    const family = FAMILY_KINDS[row.category]
    missing.push({ id: `screen-${row.id}`, title: `Answer “${sourceCategoryLabel(row.category)}” — still “Not sure yet”`, detail: `06 Source activities. Until it’s answered, ${family ? family.noun : "these sources"} may be missing from Scope ${row.scope}.`, scopes: [row.scope] })
  }
  return missing
}

/** Compares what company setup says exists with the records saved so far. */
export function coverageGaps(view: CompanySetupView | null, records: JourneyRecord[]): CoverageGap[] {
  const setup = view?.currentVersion?.setup
  if (!setup) return []
  const counted = records.filter(row => row.state !== "withdrawn" && row.state !== "excluded")
  const gaps: CoverageGap[] = []
  for (const row of setup.screening) {
    if (row.state !== "yes" || (row.scope !== 1 && row.scope !== 2)) continue
    const family = row.scope === 1 ? FAMILY_KINDS[row.category] : ["Purchased electricity", "purchased_electricity", "electricity"].includes(row.category)
      ? { kind: "electricity", noun: "purchased electricity", records: "electricity records" } : undefined
    const note = (row.details ?? "").trim() || null
    // The saved aggregate category does not tell us which fuels or equipment exist.
    if (row.scope === 1 && row.category === "stationary_combustion") {
      const saved = [["natural_gas", "natural gas records"], ["distillate_no2", "generator fuel records"]]
        .filter(([kind]) => counted.some(record => record.kind === kind && (!row.locationId || record.locationId === row.locationId)))
        .map(([, label]) => label)
      gaps.push({ id: `screen-${row.id}`, scope: 1, title: `Setup says you have fuel-burning equipment; ${saved.length ? `${saved.join(" and ")} are saved` : "there are no natural gas or generator fuel records yet"}. Confirm which fuels or equipment still need records`, detail: "Review 06 Source activities and identify all fuels and equipment, then add any missing records. Saved records alone do not establish complete fuel, equipment or reporting-period coverage.", note, noteFrom: "source" })
    }
    else if (!family || family.kind === null) gaps.push({ id: `screen-${row.id}`, scope: row.scope, title: `Setup says you have ${family?.noun ?? sourceCategoryLabel(row.category)}`, detail: "These aren’t calculated in this beta. Describe them in 06 Source activities so the reviewer can see them.", note, noteFrom: "source" })
    else if (!counted.some(record => record.kind === family.kind && (!row.locationId || record.locationId === row.locationId))) gaps.push({ id: `screen-${row.id}`, scope: row.scope, title: `Setup says you have ${family.noun}, but there are no ${family.records} yet`, detail: "Add a record, or change the setup answer if it doesn’t apply.", note, noteFrom: "source" })
  }
  for (const location of setup.locations) {
    if (location.inclusion !== "included") continue
    if (!counted.some(record => record.kind === "electricity" && record.locationId === location.id)) gaps.push({ id: `electricity-${location.id}`, scope: 2, title: `No electricity record for ${location.name || "an unnamed site"}`, detail: "Add the site’s electricity bill. If the site buys no electricity (for example, the landlord pays), say so in that site’s “Operator / control details” in company setup (04 Locations) — the note is printed with this gap in the report.", note: (location.operatorDetails ?? "").trim() || null, noteFrom: "site" })
  }
  // BF-13: and whether each included site's counted records of each Scope 1 or 2 kind cover the whole period there.
  gaps.push(...periodCoverageGaps({ reportingPeriod: setup.reportingPeriod, locations: setup.locations, records: counted }, { kind: kindLabel, period: periodLabel }))
  return gaps
}

/** WO-13: a vehicle record's fuel and model year, when its payload has them. */
function vehicleFacts(kind: string, payload: unknown): { fuel?: string; modelYear?: number } {
  if (kind !== "vehicle" || !payload || typeof payload !== "object") return {}
  const { fuel, modelYear } = payload as { fuel?: unknown; modelYear?: unknown }
  return { ...(typeof fuel === "string" && fuel.trim() ? { fuel: fuel.trim() } : {}), ...(typeof modelYear === "number" && Number.isInteger(modelYear) ? { modelYear } : {}) }
}

export function computeJourneyStatus(input: { setup: CompanySetupView | null; context: CollectionContext | null; records: CollectionActivityRecord[]; evidence: CollectionEvidenceMetadata[]; canManage: boolean; scope3?: boolean; scope3MappingKeys?: ReadonlyMap<string, string> }): JourneyStatus {
  const setupVersion = input.setup?.currentVersion ?? null
  const setup = setupVersion?.setup
  const locations = setup?.locations ?? []
  const sites = { total: locations.length, included: locations.filter(item => item.inclusion === "included").length, excluded: locations.filter(item => item.inclusion === "excluded").length, undecided: locations.filter(item => item.inclusion === "unknown").length }
  const missing = setupMissing(input.setup)
  const siteName = (id: string) => input.context?.locations.find(location => location.id === id)?.name ?? "Unknown site"
  const period = setup?.reportingPeriod ?? null
  // A-01: certificate claims are counted across the company, as Results counts them.
  const claims = input.context ? instrumentEvidenceClaims(input.records.map(row => row.currentVersion.activity), input.context, input.evidence) : undefined
  // Overview and Ask use Activity's same saved setup and cross-record Scope 3 rules.
  const scope3Options = input.scope3 && input.context ? scope3ReadinessOptions({
    setup: scope3SetupFacts(input.setup ?? { currentVersion: null }), context: input.context, records: input.records,
    mappingKeys: input.scope3MappingKeys ?? new Map(), evidence: input.evidence,
  }) : undefined
  // BF-01e: whether the results routes count each record (the readiness panel's plan) and whether it is placed outside every total.
  const countedById = new Map<string, boolean>(), placedOutside = new Map<string, boolean>()
  const records: JourneyRecord[] = input.records.map(row => {
    const activity = row.currentVersion.activity
    const outcome: { counted?: boolean; placedOutside?: boolean } = {}
    const findings = recordReadiness(activity, input.context, input.evidence, claims, scope3Options ? { options: scope3Options, recordId: row.id } : undefined, outcome)
    countedById.set(row.id, outcome.counted === true); placedOutside.set(row.id, outcome.placedOutside === true)
    // BF2: a file still in quarantine review is waiting, not something to fix, so it never makes the record need input
    // (Results counts it as calculated). A-03: its market-based result is held meanwhile, so the record is partial.
    // Pending files are listed separately.
    let state = recordState(findings)
    const reasons = findings.map(finding => finding.reason)
    // Same check as the results route: a record not wholly inside the reporting period is held, never counted.
    const fit = periodFit(activity.period, period)
    if ((fit === "outside" || fit === "partial") && state !== "withdrawn" && state !== "excluded") {
      const dates = periodLabel(activity.period.start, activity.period.endExclusive), reporting = periodLabel(period!.start, period!.endExclusive)
      reasons.unshift(fit === "outside"
        ? `Its dates (${dates}) fall outside the reporting period in company setup (${reporting}). Change the reporting period in Company setup (02 Reporting period), or correct the record if its dates are wrong.`
        : `Its dates (${dates}) are only partly inside the reporting period in company setup (${reporting}). Change the reporting period in Company setup (02 Reporting period), or save the bill as separate records that each sit inside the period.`)
      // BF2: outside the period takes precedence, as on the Results screen and in its counts: fix the period first.
      state = "held_period"
    }
    const imported = row.kind === "purchase_spend" && typeof (activity.payload as { importId?: unknown }).importId === "string"
    return { id: row.id, kind: row.kind, label: kindLabel(row.kind), sourceId: activity.sourceId, locationId: activity.locationId, site: siteName(activity.locationId), state, reasons, evidenceCount: activity.evidenceIds.length, quality: activity.quality, periodStart: activity.period.start, periodEndExclusive: activity.period.endExclusive, period: periodLabel(activity.period.start, activity.period.endExclusive), ...vehicleFacts(row.kind, activity.payload), ...(imported ? { importedSpend: true as const } : {}) }
  })
  // WO-04b (BF-01A): Scope 1 and 2 possible duplicates, by the results route's own rule over the same records (Scope 3
  // duplicates come from the Scope 3 results). Withdrawn, excluded and held records keep their precedence, as there.
  const scope12 = input.records.filter(row => SCOPE12_KINDS.has(row.kind))
  // BF-01e (CEO ruling, 13 November 2026): a pair is "both counted" only when both records are; a record that isn't counted
  // but matches a counted one gets the caution instead (completing it would repeat the counted record).
  const isCounted = (id: string) => countedById.get(id) === true && records.find(row => row.id === id)?.state !== "held_period"
  const pairs = possibleDuplicatePairs(scope12, isCounted, id => placedOutside.get(id) !== true && !["withdrawn", "excluded", "held_period", "method_pending"].includes(records.find(row => row.id === id)?.state ?? "withdrawn"))
  for (const row of records) {
    const cautionId = pairs.cautions.get(row.id)
    const caution = cautionId === undefined ? undefined : scope12.find(item => item.id === cautionId)?.currentVersion.activity
    if (cautionId !== undefined) row.wouldRepeatCounted = wouldRepeatCountedText(cautionId, caution ? { sourceId: caution.sourceId, locationName: input.context?.locations.find(location => location.id === caution.locationId)?.name ?? null, period: periodLabel(caution.period.start, caution.period.endExclusive) } : null)
    const otherId = pairs.counted.get(row.id)
    if (otherId === undefined) continue
    const other = scope12.find(item => item.id === otherId)?.currentVersion.activity
    const otherRecord = scope12.find(item => item.id === otherId)
    if (otherRecord) row.possibleDuplicateOther = { id: otherId, label: kindLabel(otherRecord.kind), sourceId: otherRecord.currentVersion.activity.sourceId, site: siteName(otherRecord.currentVersion.activity.locationId), period: periodLabel(otherRecord.currentVersion.activity.period.start, otherRecord.currentVersion.activity.period.endExclusive), ...vehicleFacts(otherRecord.kind, otherRecord.currentVersion.activity.payload) }
    row.possibleDuplicate = possibleDuplicateOfText(otherId, other ? { sourceId: other.sourceId, locationName: input.context?.locations.find(location => location.id === other.locationId)?.name ?? null, period: periodLabel(other.period.start, other.period.endExclusive) } : null)
  }
  const byKind: Record<string, number> = {}
  for (const row of records) if (row.state !== "withdrawn") byKind[row.kind] = (byKind[row.kind] ?? 0) + 1
  const active = records.filter(row => row.state !== "withdrawn")
  const attentionRows = active.filter(row => row.state === "input_needed" || row.state === "review_required")
  const heldRows = active.filter(row => row.state === "held_period")
  const counted = active.filter(row => row.state !== "excluded")
  // Records saved against an earlier setup version must have their site chosen again when next edited (owner rule).
  // BF2: setup content is compared, not version IDs, so an identical restore doesn't flag every record.
  const context = input.context
  const olderSetup = context?.setupVersionId ? input.records.filter(row => row.currentVersion.activity.state !== "withdrawn" && row.currentVersion.activity.setupVersionId && !savedAgainstCurrentSetup(row.currentVersion.activity.setupVersionId, context)).length : 0
  const collection = { total: records.length, active: active.length, ready: active.filter(row => row.state === "ready" || row.state === "partial" || row.state === "memo_only").length, attention: attentionRows.length, held: heldRows.length, olderSetup, partial: active.filter(row => row.state === "partial").length, withdrawn: records.length - active.length, excluded: active.filter(row => row.state === "excluded").length, noEvidence: counted.filter(row => row.evidenceCount === 0).length, qualityUnknown: counted.filter(row => row.quality === "unknown").length, byKind, records }
  const gaps = coverageGaps(input.setup, records)
  const evidence = { total: input.evidence.length, checking: input.evidence.filter(file => file.quarantineStatus === "pending" || file.quarantineStatus === "error").length, cleared: input.evidence.filter(file => file.quarantineStatus === "clean").length, rejected: input.evidence.filter(file => file.quarantineStatus === "rejected").length }
  const manage = input.canManage
  const openSetup = missing.filter(item => item.scopes.length)
  let next: JourneyStatus["next"]
  if (!setupVersion) next = manage
    ? { panel: "setup", title: "Set up your company", body: "Start with your legal name, reporting year, boundary and sites. It takes about ten minutes, and you can leave anything you’re unsure of as “Not sure yet”.", action: "Start company setup" }
    : { panel: "setup", title: "Company setup hasn’t been saved yet", body: "An owner or admin of your company starts with the legal name, reporting year, boundary and sites.", action: "View company setup" }
  else if (!sites.included) next = { panel: "setup", title: manage ? "Include at least one site" : "No site is included yet", body: "Activity records belong to a site. Sites are added in company setup (04 Locations) and marked as included when they’re inside your boundary.", action: manage ? "Add sites" : "View company setup" }
  else if (!active.length) next = manage
    ? { panel: "collection", title: "Add your first activity record", body: "Start with a gas or electricity bill for one site. Each record takes a couple of minutes, and you can attach the bill as you go.", action: "Add activity" }
    : { panel: "collection", title: "No activity records yet", body: "Draft results appear once an owner or admin adds activity records.", action: "View records" }
  // Round 3 lane C (PR-3): imported spend lines are fixed in the spend import's grouped review, never one by one.
  else if (attentionRows.some(row => row.importedSpend)) {
    const spend = attentionRows.filter(row => row.importedSpend).length
    next = manage ? { panel: "collection", title: TODO_SPEND_TEXT_R3C.nextTitle(spend), body: TODO_SPEND_TEXT_R3C.nextBody(attentionRows.length - spend), action: TODO_SPEND_TEXT_R3C.open, spendImport: true }
      : { panel: "collection", title: `${plural(attentionRows.length, "record")} need${attentionRows.length === 1 ? "s" : ""} input`, body: TODO_SPEND_TEXT_R3C.nextBody(attentionRows.length - spend), action: "View records" }
  }
  else if (attentionRows.length) next = { panel: "collection", title: manage ? `Finish ${plural(attentionRows.length, "record")} that need${attentionRows.length === 1 ? "s" : ""} input` : `${plural(attentionRows.length, "record")} need${attentionRows.length === 1 ? "s" : ""} input`, body: `${attentionRows[0]!.label} · ${attentionRows[0]!.sourceId}: ${attentionRows[0]!.reasons[0] ?? "More information is needed."}`, action: manage ? "Fix records" : "View records", recordId: attentionRows[0]!.id }
  else if (heldRows.length) next = { panel: "setup", title: `Your reporting period doesn’t match ${plural(heldRows.length, "record")}`, body: `${heldRows[0]!.label} · ${heldRows[0]!.sourceId}: ${heldRows[0]!.reasons[0]} Held records aren’t counted.`, action: manage ? "Open company setup" : "View company setup", secondary: { panel: "results", action: "View draft results" } }
  else if (openSetup.length) next = { panel: "setup", title: manage ? `Finish company setup: ${plural(openSetup.length, "open answer")}` : `Company setup has ${plural(openSetup.length, "open answer")}`, body: `${openSetup[0]!.title}. ${openSetup[0]!.detail}`, action: manage ? "Open company setup" : "View company setup", secondary: { panel: "results", action: "View draft results" } }
  else next = { panel: "results", title: "Review your draft results", body: gaps.length
    ? `${plural(gaps.length, "possible gap")} ${gaps.length === 1 ? "is" : "are"} listed with the results and in the report. Add the missing records, or note why a source doesn’t apply.`
    : collection.partial ? "Your records can be calculated. Some are only partly calculated — the results page shows what each one still needs." : "Your records are ready to calculate. Review the figures, then print or download the draft report.", action: "View results", secondary: gaps.length && manage ? { panel: "collection", action: "Add records" } : undefined }
  return {
    canManage: input.canManage,
    setup: { saved: Boolean(setupVersion), revision: setupVersion?.revision ?? null, legalName: setup?.company.legalName ?? "", period: { start: setup?.reportingPeriod.start ?? null, endExclusive: setup?.reportingPeriod.endExclusive ?? null }, boundary: setup?.boundary.approach ?? "unknown", sites, missing },
    collection, gaps, evidence, next,
    progress: {
      setup: !setupVersion ? "not_started" : missing.length ? "in_progress" : "done",
      collection: !active.length ? "not_started" : attentionRows.length || heldRows.length || gaps.length || collection.partial ? "in_progress" : "done",
      results: collection.ready ? "ready" : "waiting",
    },
    ...(input.scope3 ? { scope3: true as const } : {}),
  }
}

/** Where a gap's note was written, so the report names the right place. */
export const noteLabel = (gap: CoverageGap) => gap.noteFrom === "site" ? "Site note (04 Locations)" : "Setup note (06 Source activities)"
/** What the results page knows about coverage: checked against company setup, still loading, or unavailable. */
export type Coverage = { state: "ready"; setupOpen: SetupOpenItem[]; gaps: CoverageGap[] } | { state: "loading" } | { state: "unavailable" }
/** Coverage issues that can leave one scope's totals incomplete. `unchecked` means coverage couldn't be compared at all. */
export function coverageIssues(coverage: Coverage, scope: 1 | 2): { open: number; gaps: number; unchecked: boolean } {
  if (coverage.state !== "ready") return { open: 0, gaps: 0, unchecked: true }
  return { open: coverage.setupOpen.filter(item => item.scopes.includes(scope)).length, gaps: coverage.gaps.filter(gap => gap.scope === scope).length, unchecked: false }
}
/** Plain-text coverage lines for the CSV header and the report, so a download never drops the gaps. */
export function coverageLines(coverage: Coverage): string[] {
  if (coverage.state !== "ready") return ["Coverage check unavailable — these records were not compared with company setup, so totals may be incomplete."]
  const lines = [
    ...coverage.setupOpen.map(item => `Open in company setup: ${item.title}. ${item.detail}`),
    ...coverage.gaps.map(gap => `Possible gap (Scope ${gap.scope}): ${gap.title}.${gap.note ? ` ${noteLabel(gap)}: ${gap.note}` : ""}`),
  ]
  return lines.length ? lines : [COVERAGE_TEXT.csvNoGaps]
}

export async function loadJourneyStatus(workspaceId: string, actor: HostedWorkspaceActor): Promise<JourneyStatus> {
  // Any failed request fails the whole status, so a failed setup read is never mistaken for "setup not saved" and the
  // results page reports coverage as unchecked instead of guessing.
  const [setup, overview, records, evidence] = await Promise.all([
    loadCompanySetup(workspaceId, actor),
    loadCollectionOverview(workspaceId, actor),
    listCollectionActivities(workspaceId, actor),
    listCollectionEvidence(workspaceId, actor),
  ])
  const spendLines = overview.scope3 ? await scope3SpendLineChoices(records) : []
  return computeJourneyStatus({ setup, context: overview.context, records, evidence, canManage: actor.role === "owner" || actor.role === "admin", scope3: overview.scope3,
    scope3MappingKeys: new Map(spendLines.map(line => [line.mappingKeyInput, line.mappingKey])) })
}
