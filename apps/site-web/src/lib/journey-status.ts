import type { CompanySetupView } from "../../../../packages/neuvetra-database/src/company-setup-contract"
import type { CollectionActivityRecord, CollectionContext, CollectionEvidenceMetadata } from "./collection-api"
import { listCollectionActivities, listCollectionEvidence, loadCollectionContext } from "./collection-api"
import { loadCompanySetup } from "./company-setup-api"
import type { HostedWorkspaceActor } from "./workspace-api"
import { recordReadiness, type CollectionReadinessFinding } from "@/components/CollectionWorkspace"
import { kindLabel, periodLabel, type RecordState } from "./plain-language"

export type JourneyPanel = "home" | "setup" | "collection" | "results"
export interface JourneyRecord { id: string; kind: string; label: string; sourceId: string; locationId: string; site: string; state: RecordState; reasons: string[]; evidenceCount: number; quality: string }
/** A company-setup answer that is still open. `scopes` lists the totals it can leave incomplete (empty: it doesn't affect totals). */
export interface SetupOpenItem { id: string; title: string; detail: string; scopes: Array<1 | 2> }
/** Something the saved setup says should exist but no record covers yet. Shown as a gap, never as complete. */
export interface CoverageGap { id: string; scope: 1 | 2; title: string; detail: string; note: string | null; noteFrom: "site" | "source" }
export interface JourneyStatus {
  canManage: boolean
  setup: { saved: boolean; revision: number | null; legalName: string; period: { start: string | null; endExclusive: string | null }; boundary: string; sites: { total: number; included: number; excluded: number; undecided: number }; missing: SetupOpenItem[] }
  collection: { total: number; active: number; ready: number; attention: number; held: number; partial: number; withdrawn: number; excluded: number; noEvidence: number; qualityUnknown: number; olderSetup: number; byKind: Record<string, number>; records: JourneyRecord[] }
  gaps: CoverageGap[]
  evidence: { total: number; checking: number; cleared: number; rejected: number }
  next: { panel: JourneyPanel; title: string; body: string; action: string; recordId?: string; secondary?: { panel: JourneyPanel; action: string } }
  progress: { setup: "done" | "in_progress" | "not_started"; collection: "done" | "in_progress" | "not_started"; results: "ready" | "waiting" }
}

/** One record's journey state from the same readiness rules the activity screen shows. */
export function recordState(findings: CollectionReadinessFinding[]): RecordState {
  const statuses = new Set(findings.map(finding => finding.status))
  if (statuses.has("withdrawn")) return "withdrawn"
  if (statuses.has("excluded")) return "excluded"
  if (statuses.has("input_needed")) return "input_needed"
  if (statuses.has("review_required")) return "review_required"
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
  else if (setup.reportingPeriod.start < BETA_PERIOD.start || setup.reportingPeriod.endExclusive > BETA_PERIOD.endExclusive) missing.push({ id: "beta-period", title: `This beta covers activity in calendar 2025 only — your reporting period is ${periodLabel(setup.reportingPeriod.start, setup.reportingPeriod.endExclusive)}`, detail: "02 Reporting period. Activity outside 2025 can’t be added yet, so this period can’t be completed in the beta. Records outside the period are held, not counted.", scopes: [1, 2] })
  if (setup.boundary.approach === "unknown") missing.push({ id: "boundary", title: "Choose a boundary approach", detail: "03 Entities & boundary. It decides which sites and sources belong in the inventory.", scopes: [1, 2] })
  if (!setup.locations.length) missing.push({ id: "sites", title: "Add at least one site", detail: "04 Locations.", scopes: [1, 2] })
  for (const location of setup.locations) if (location.inclusion === "unknown") missing.push({ id: `site-${location.id}`, title: `Decide whether ${location.name || "an unnamed site"} is included`, detail: "04 Locations. Its records aren’t counted until the site is included.", scopes: [1, 2] })
  for (const row of setup.screening) if (row.state === "unknown") {
    const family = FAMILY_KINDS[row.category]
    missing.push({ id: `screen-${row.id}`, title: `Answer “${row.category}” — still “Not sure yet”`, detail: `06 Source activities. Until it’s answered, ${family ? family.noun : "these sources"} may be missing from Scope 1.`, scopes: [1] })
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
    if (row.state !== "yes") continue
    const family = FAMILY_KINDS[row.category]
    if (!family) continue
    const note = (row.details ?? "").trim() || null
    if (family.kind === null) gaps.push({ id: `screen-${row.id}`, scope: 1, title: `Setup says you have ${family.noun}`, detail: "These aren’t calculated in this beta. Describe them in 06 Source activities so the reviewer can see them.", note, noteFrom: "source" })
    else if (!counted.some(record => record.kind === family.kind)) gaps.push({ id: `screen-${row.id}`, scope: 1, title: `Setup says you have ${family.noun}, but there are no ${family.records} yet`, detail: "Add a record, or change the setup answer if it doesn’t apply.", note, noteFrom: "source" })
  }
  for (const location of setup.locations) {
    if (location.inclusion !== "included") continue
    if (!counted.some(record => record.kind === "electricity" && record.locationId === location.id)) gaps.push({ id: `electricity-${location.id}`, scope: 2, title: `No electricity record for ${location.name || "an unnamed site"}`, detail: "Add the site’s electricity bill. If the site buys no electricity (for example, the landlord pays), say so in that site’s “Operator / control details” in company setup (04 Locations) — the note is printed with this gap in the report.", note: (location.operatorDetails ?? "").trim() || null, noteFrom: "site" })
  }
  return gaps
}

export function computeJourneyStatus(input: { setup: CompanySetupView | null; context: CollectionContext | null; records: CollectionActivityRecord[]; evidence: CollectionEvidenceMetadata[]; canManage: boolean }): JourneyStatus {
  const setupVersion = input.setup?.currentVersion ?? null
  const setup = setupVersion?.setup
  const locations = setup?.locations ?? []
  const sites = { total: locations.length, included: locations.filter(item => item.inclusion === "included").length, excluded: locations.filter(item => item.inclusion === "excluded").length, undecided: locations.filter(item => item.inclusion === "unknown").length }
  const missing = setupMissing(input.setup)
  const siteName = (id: string) => input.context?.locations.find(location => location.id === id)?.name ?? "Unknown site"
  const period = setup?.reportingPeriod ?? null
  const records: JourneyRecord[] = input.records.map(row => {
    const activity = row.currentVersion.activity
    const findings = recordReadiness(activity, input.context, input.evidence)
    let state = recordState(findings)
    const reasons = findings.map(finding => finding.reason)
    // Same check as the results route: a record not wholly inside the reporting period is held, never counted.
    const fit = periodFit(activity.period, period)
    if ((fit === "outside" || fit === "partial") && state !== "withdrawn" && state !== "excluded") {
      const dates = periodLabel(activity.period.start, activity.period.endExclusive), reporting = periodLabel(period!.start, period!.endExclusive)
      reasons.unshift(fit === "outside"
        ? `Its dates (${dates}) fall outside the reporting period in company setup (${reporting}). Change the reporting period in Company setup (02 Reporting period), or correct the record if its dates are wrong.`
        : `Its dates (${dates}) are only partly inside the reporting period in company setup (${reporting}). Change the reporting period in Company setup (02 Reporting period), or save the bill as separate records that each sit inside the period.`)
      if (state !== "input_needed") state = "held_period"
    }
    return { id: row.id, kind: row.kind, label: kindLabel(row.kind), sourceId: activity.sourceId, locationId: activity.locationId, site: siteName(activity.locationId), state, reasons, evidenceCount: activity.evidenceIds.length, quality: activity.quality }
  })
  const byKind: Record<string, number> = {}
  for (const row of records) if (row.state !== "withdrawn") byKind[row.kind] = (byKind[row.kind] ?? 0) + 1
  const active = records.filter(row => row.state !== "withdrawn")
  const attentionRows = active.filter(row => row.state === "input_needed" || row.state === "review_required")
  const heldRows = active.filter(row => row.state === "held_period")
  const counted = active.filter(row => row.state !== "excluded")
  // Records saved against an earlier setup version must have their site chosen again when next edited (owner rule).
  const currentSetupVersion = input.context?.setupVersionId ?? null
  const olderSetup = currentSetupVersion ? input.records.filter(row => row.currentVersion.activity.state !== "withdrawn" && row.currentVersion.activity.setupVersionId && row.currentVersion.activity.setupVersionId !== currentSetupVersion).length : 0
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
  else if (attentionRows.length) next = { panel: "collection", title: manage ? `Finish ${plural(attentionRows.length, "record")} that need${attentionRows.length === 1 ? "s" : ""} input` : `${plural(attentionRows.length, "record")} need${attentionRows.length === 1 ? "s" : ""} input`, body: `${attentionRows[0]!.label} · ${attentionRows[0]!.sourceId}: ${attentionRows[0]!.reasons[0] ?? "More information is needed."}`, action: manage ? "Fix records" : "View records", recordId: attentionRows[0]!.id }
  else if (heldRows.length) next = { panel: "setup", title: `Your reporting period doesn’t match ${plural(heldRows.length, "record")}`, body: `${heldRows[0]!.label} · ${heldRows[0]!.sourceId}: ${heldRows[0]!.reasons[0]} Held records aren’t counted.`, action: manage ? "Open company setup" : "View company setup", secondary: { panel: "results", action: "View draft results" } }
  else if (openSetup.length) next = { panel: "setup", title: manage ? `Finish company setup: ${plural(openSetup.length, "open answer")}` : `Company setup has ${plural(openSetup.length, "open answer")}`, body: `${openSetup[0]!.title}. ${openSetup[0]!.detail}`, action: manage ? "Open company setup" : "View company setup", secondary: { panel: "results", action: "View draft results" } }
  else next = { panel: "results", title: "Review your draft results", body: gaps.length
    ? `${plural(gaps.length, "possible gap")} ${gaps.length === 1 ? "is" : "are"} listed with the results and in the report. Add the missing records, or note why a source doesn’t apply.`
    : collection.partial ? "Your records can be calculated. Some are only partly calculated — the results page shows what would complete them." : "Your records are ready to calculate. Review the figures, then print or download the draft report.", action: "View results", secondary: gaps.length && manage ? { panel: "collection", action: "Add records" } : undefined }
  return {
    canManage: input.canManage,
    setup: { saved: Boolean(setupVersion), revision: setupVersion?.revision ?? null, legalName: setup?.company.legalName ?? "", period: { start: setup?.reportingPeriod.start ?? null, endExclusive: setup?.reportingPeriod.endExclusive ?? null }, boundary: setup?.boundary.approach ?? "unknown", sites, missing },
    collection, gaps, evidence, next,
    progress: {
      setup: !setupVersion ? "not_started" : missing.length ? "in_progress" : "done",
      collection: !active.length ? "not_started" : attentionRows.length || heldRows.length || gaps.length || collection.partial ? "in_progress" : "done",
      results: collection.ready ? "ready" : "waiting",
    },
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
  return lines.length ? lines : ["No open setup answers or possible gaps: each source type and included site in company setup has at least one record."]
}

export async function loadJourneyStatus(workspaceId: string, actor: HostedWorkspaceActor): Promise<JourneyStatus> {
  // Any failed request fails the whole status, so a failed setup read is never mistaken for "setup not saved" and the
  // results page reports coverage as unchecked instead of guessing.
  const [setup, context, records, evidence] = await Promise.all([
    loadCompanySetup(workspaceId, actor),
    loadCollectionContext(workspaceId, actor),
    listCollectionActivities(workspaceId, actor),
    listCollectionEvidence(workspaceId, actor),
  ])
  return computeJourneyStatus({ setup, context, records, evidence, canManage: actor.role === "owner" || actor.role === "admin" })
}

/** Answers the user's progress question from their own saved data, never from a model. */
export function progressAnswer(status: JourneyStatus | null, failed = false): string[] {
  if (!status) return [failed ? "Your progress couldn’t be loaded, so I can’t answer from your records right now. Try again from the Overview." : "I can’t see your progress yet — it’s still loading. Try again in a moment."]
  const lines = [`Next step: ${status.next.title}. ${status.next.body}`]
  if (status.setup.missing.length) lines.push(`Company setup still needs: ${status.setup.missing.map(item => item.title).join("; ")}.`)
  const attention = status.collection.records.filter(row => row.state === "input_needed" || row.state === "review_required")
  if (attention.length) lines.push(`Records with input needed: ${attention.slice(0, 4).map(row => `${row.label} · ${row.sourceId} (${row.reasons[0] ?? "more information needed"})`).join("; ")}${attention.length > 4 ? `; and ${attention.length - 4} more` : ""}.`)
  const held = status.collection.records.filter(row => row.state === "held_period")
  if (held.length) lines.push(`Outside the reporting period (not counted): ${held.slice(0, 4).map(row => `${row.label} · ${row.sourceId}`).join("; ")}${held.length > 4 ? `; and ${held.length - 4} more` : ""}. Check the reporting period in Company setup.`)
  if (status.gaps.length) lines.push(`Possible gaps: ${status.gaps.slice(0, 4).map(gap => gap.title).join("; ")}${status.gaps.length > 4 ? `; and ${status.gaps.length - 4} more` : ""}.`)
  const improve: string[] = []
  if (status.collection.partial) improve.push(`${status.collection.partial} record${status.collection.partial === 1 ? " is" : "s are"} only partly calculated`)
  if (status.collection.noEvidence) improve.push(`${status.collection.noEvidence} record${status.collection.noEvidence === 1 ? " has" : "s have"} no evidence linked`)
  if (status.collection.qualityUnknown) improve.push(`${status.collection.qualityUnknown} record${status.collection.qualityUnknown === 1 ? " has" : "s have"} data quality “Unknown”`)
  if (improve.length) lines.push(`Can be improved: ${improve.join("; ")}.`)
  if (!status.setup.missing.length && !attention.length && !held.length && !status.gaps.length && !improve.length) lines.push("Nothing else is flagged. Open Results & report to review the draft — it is still a draft until an independent reviewer checks it.")
  return lines
}
