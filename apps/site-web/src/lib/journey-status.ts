import type { CompanySetupView } from "../../../../packages/neuvetra-database/src/company-setup-contract"
import type { CollectionActivityRecord, CollectionContext, CollectionEvidenceMetadata } from "./collection-api"
import { listCollectionActivities, listCollectionEvidence, loadCollectionContext } from "./collection-api"
import { loadCompanySetup } from "./company-setup-api"
import type { HostedWorkspaceActor } from "./workspace-api"
import { collectionReadinessFindings, locationReadinessFindings, type CollectionReadinessFinding } from "@/components/CollectionWorkspace"
import { kindLabel, type RecordState } from "./plain-language"

export type JourneyPanel = "home" | "setup" | "collection" | "results"
export interface JourneyRecord { id: string; kind: string; label: string; sourceId: string; locationId: string; site: string; state: RecordState; reasons: string[]; evidenceCount: number; quality: string }
/** Something the saved setup says should exist but no record covers yet. Shown as a gap, never as complete. */
export interface CoverageGap { id: string; scope: 1 | 2; title: string; detail: string }
export interface JourneyStatus {
  canManage: boolean
  setup: { saved: boolean; revision: number | null; legalName: string; period: { start: string | null; endExclusive: string | null }; boundary: string; sites: { total: number; included: number; excluded: number; undecided: number }; missing: string[] }
  collection: { total: number; active: number; ready: number; attention: number; partial: number; withdrawn: number; excluded: number; noEvidence: number; qualityUnknown: number; byKind: Record<string, number>; records: JourneyRecord[] }
  gaps: CoverageGap[]
  evidence: { total: number; checking: number; cleared: number; rejected: number }
  next: { panel: JourneyPanel; title: string; body: string; action: string; recordId?: string }
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

export function setupMissing(view: CompanySetupView | null): string[] {
  const setup = view?.currentVersion?.setup
  if (!setup) return ["Save your company setup"]
  const missing: string[] = []
  if (!setup.company.legalName.trim()) missing.push("Company legal name")
  if (!setup.reportingPeriod.start || !setup.reportingPeriod.endExclusive) missing.push("Reporting period")
  if (setup.boundary.approach === "unknown") missing.push("Boundary approach")
  if (!setup.locations.length) missing.push("At least one site")
  const undecided = setup.locations.filter(location => location.inclusion === "unknown").length
  if (undecided) missing.push(`Include or exclude ${undecided} site${undecided === 1 ? "" : "s"}`)
  const unanswered = setup.screening.filter(row => row.state === "unknown").length
  if (unanswered) missing.push(`${unanswered} source question${unanswered === 1 ? "" : "s"} still “Not sure yet”`)
  return missing
}

const FAMILY_KINDS: Record<string, { kind: string | null; noun: string }> = {
  "Heating & process equipment": { kind: "natural_gas", noun: "heating or process equipment" },
  "Backup generators": { kind: "distillate_no2", noun: "backup generators" },
  "Road & off-road vehicles": { kind: "vehicle", noun: "vehicles" },
  "Cooling & fire suppression": { kind: "fugitive", noun: "cooling or fire-suppression equipment" },
  "Processes & other direct releases": { kind: null, noun: "process or other direct emissions" },
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
    if (family.kind === null) gaps.push({ id: `screen-${row.id}`, scope: 1, title: `Setup says you have ${family.noun}`, detail: "These aren’t calculated in this beta. Describe them in your notes for the reviewer." })
    else if (!counted.some(record => record.kind === family.kind)) gaps.push({ id: `screen-${row.id}`, scope: 1, title: `Setup says you have ${family.noun}, but there are no ${kindLabel(family.kind).toLowerCase()} records yet`, detail: "Add a record, or change the setup answer if it doesn’t apply." })
  }
  for (const location of setup.locations) {
    if (location.inclusion !== "included") continue
    if (!counted.some(record => record.kind === "electricity" && record.locationId === location.id)) gaps.push({ id: `electricity-${location.id}`, scope: 2, title: `No electricity record for ${location.name || "an unnamed site"}`, detail: "Add the site’s electricity bill. If the site buys no electricity (for example, the landlord pays), note that for the reviewer." })
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
  const records: JourneyRecord[] = input.records.map(row => {
    const activity = row.currentVersion.activity
    const findings = [...collectionReadinessFindings(activity, input.evidence), ...locationReadinessFindings(activity, input.context)]
    return { id: row.id, kind: row.kind, label: kindLabel(row.kind), sourceId: activity.sourceId, locationId: activity.locationId, site: siteName(activity.locationId), state: recordState(findings), reasons: findings.map(finding => finding.reason), evidenceCount: activity.evidenceIds.length, quality: activity.quality }
  })
  const byKind: Record<string, number> = {}
  for (const row of records) if (row.state !== "withdrawn") byKind[row.kind] = (byKind[row.kind] ?? 0) + 1
  const active = records.filter(row => row.state !== "withdrawn")
  const attentionRows = active.filter(row => row.state === "input_needed" || row.state === "review_required")
  const counted = active.filter(row => row.state !== "excluded")
  const collection = { total: records.length, active: active.length, ready: active.filter(row => row.state === "ready" || row.state === "partial" || row.state === "memo_only").length, attention: attentionRows.length, partial: active.filter(row => row.state === "partial").length, withdrawn: records.length - active.length, excluded: active.filter(row => row.state === "excluded").length, noEvidence: counted.filter(row => row.evidenceCount === 0).length, qualityUnknown: counted.filter(row => row.quality === "unknown").length, byKind, records }
  const gaps = coverageGaps(input.setup, records)
  const evidence = { total: input.evidence.length, checking: input.evidence.filter(file => file.quarantineStatus === "pending" || file.quarantineStatus === "error").length, cleared: input.evidence.filter(file => file.quarantineStatus === "clean").length, rejected: input.evidence.filter(file => file.quarantineStatus === "rejected").length }
  let next: JourneyStatus["next"]
  if (!setupVersion) next = { panel: "setup", title: "Set up your company", body: "Start with your legal name, reporting year, boundary and sites. It takes about ten minutes, and you can leave anything you’re unsure of as “Not sure yet”.", action: "Start company setup" }
  else if (!sites.included) next = { panel: "setup", title: "Include at least one site", body: "Activity records belong to a site. Add your sites in company setup and mark the ones inside your boundary as included.", action: "Add sites" }
  else if (!active.length) next = { panel: "collection", title: "Add your first activity record", body: "Start with a gas or electricity bill for one site. Each record takes a couple of minutes, and you can attach the bill as you go.", action: "Add activity" }
  else if (attentionRows.length) next = { panel: "collection", title: `Finish ${attentionRows.length} record${attentionRows.length === 1 ? "" : "s"} that need${attentionRows.length === 1 ? "s" : ""} input`, body: `${attentionRows[0]!.label} · ${attentionRows[0]!.sourceId}: ${attentionRows[0]!.reasons[0] ?? "More information is needed."}`, action: "Fix records", recordId: attentionRows[0]!.id }
  else if (gaps.length) next = { panel: "collection", title: `Check ${gaps.length} possible gap${gaps.length === 1 ? "" : "s"} in your records`, body: `${gaps[0]!.title}. ${gaps[0]!.detail}`, action: "Add records" }
  else next = { panel: "results", title: "Review your draft results", body: collection.partial ? "Your records can be calculated. Some are only partly calculated — the results page shows what would complete them." : "Your records are ready to calculate. Review the figures, then print or download the draft report.", action: "View results" }
  return {
    canManage: input.canManage,
    setup: { saved: Boolean(setupVersion), revision: setupVersion?.revision ?? null, legalName: setup?.company.legalName ?? "", period: { start: setup?.reportingPeriod.start ?? null, endExclusive: setup?.reportingPeriod.endExclusive ?? null }, boundary: setup?.boundary.approach ?? "unknown", sites, missing },
    collection, gaps, evidence, next,
    progress: {
      setup: !setupVersion ? "not_started" : missing.length ? "in_progress" : "done",
      collection: !active.length ? "not_started" : attentionRows.length || gaps.length || collection.partial ? "in_progress" : "done",
      results: collection.ready ? "ready" : "waiting",
    },
  }
}

export async function loadJourneyStatus(workspaceId: string, actor: HostedWorkspaceActor): Promise<JourneyStatus> {
  const [setup, context, records, evidence] = await Promise.all([
    loadCompanySetup(workspaceId, actor).catch(() => null),
    loadCollectionContext(workspaceId, actor).catch(() => null),
    listCollectionActivities(workspaceId, actor),
    listCollectionEvidence(workspaceId, actor),
  ])
  return computeJourneyStatus({ setup, context, records, evidence, canManage: actor.role === "owner" || actor.role === "admin" })
}

/** Answers the user's progress question from their own saved data, never from a model. */
export function progressAnswer(status: JourneyStatus | null): string[] {
  if (!status) return ["I can’t see your progress yet — it’s still loading. Try again in a moment."]
  const lines = [`Next step: ${status.next.title}. ${status.next.body}`]
  if (status.setup.missing.length) lines.push(`Company setup still needs: ${status.setup.missing.join("; ")}.`)
  const attention = status.collection.records.filter(row => row.state === "input_needed" || row.state === "review_required")
  if (attention.length) lines.push(`Records with input needed: ${attention.slice(0, 4).map(row => `${row.label} · ${row.sourceId} (${row.reasons[0] ?? "more information needed"})`).join("; ")}${attention.length > 4 ? `; and ${attention.length - 4} more` : ""}.`)
  if (status.gaps.length) lines.push(`Possible gaps: ${status.gaps.slice(0, 4).map(gap => gap.title).join("; ")}${status.gaps.length > 4 ? `; and ${status.gaps.length - 4} more` : ""}.`)
  const improve: string[] = []
  if (status.collection.partial) improve.push(`${status.collection.partial} record${status.collection.partial === 1 ? " is" : "s are"} only partly calculated`)
  if (status.collection.noEvidence) improve.push(`${status.collection.noEvidence} record${status.collection.noEvidence === 1 ? " has" : "s have"} no evidence linked`)
  if (status.collection.qualityUnknown) improve.push(`${status.collection.qualityUnknown} record${status.collection.qualityUnknown === 1 ? " has" : "s have"} data quality “Unknown”`)
  if (improve.length) lines.push(`Can be improved: ${improve.join("; ")}.`)
  if (!status.setup.missing.length && !attention.length && !status.gaps.length && !improve.length) lines.push("Nothing else is flagged. Open Results & report to review the draft — it is still a draft until an independent reviewer checks it.")
  return lines
}
