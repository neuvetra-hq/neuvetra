import type { CompanySetupView } from "../../../../packages/neuvetra-database/src/company-setup-contract"
import type { CollectionActivityRecord, CollectionContext, CollectionEvidenceMetadata } from "./collection-api"
import { listCollectionActivities, listCollectionEvidence, loadCollectionContext } from "./collection-api"
import { loadCompanySetup } from "./company-setup-api"
import type { HostedWorkspaceActor } from "./workspace-api"
import { collectionReadinessFindings, locationReadinessFindings, type CollectionReadinessFinding } from "@/components/CollectionWorkspace"
import { kindLabel, type RecordState } from "./plain-language"

export type JourneyPanel = "home" | "setup" | "collection" | "results"
export interface JourneyRecord { id: string; kind: string; label: string; sourceId: string; site: string; state: RecordState; reasons: string[] }
export interface JourneyStatus {
  canManage: boolean
  setup: { saved: boolean; revision: number | null; legalName: string; period: { start: string | null; endExclusive: string | null }; boundary: string; sites: { total: number; included: number; excluded: number; undecided: number }; missing: string[] }
  collection: { total: number; active: number; ready: number; attention: number; withdrawn: number; excluded: number; byKind: Record<string, number>; records: JourneyRecord[] }
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
    return { id: row.id, kind: row.kind, label: kindLabel(row.kind), sourceId: activity.sourceId, site: siteName(activity.locationId), state: recordState(findings), reasons: findings.map(finding => finding.reason) }
  })
  const byKind: Record<string, number> = {}
  for (const row of records) if (row.state !== "withdrawn") byKind[row.kind] = (byKind[row.kind] ?? 0) + 1
  const active = records.filter(row => row.state !== "withdrawn")
  const attentionRows = active.filter(row => row.state === "input_needed" || row.state === "review_required")
  const collection = { total: records.length, active: active.length, ready: active.filter(row => row.state === "ready" || row.state === "partial" || row.state === "memo_only").length, attention: attentionRows.length, withdrawn: records.length - active.length, excluded: active.filter(row => row.state === "excluded").length, byKind, records }
  const evidence = { total: input.evidence.length, checking: input.evidence.filter(file => file.quarantineStatus === "pending" || file.quarantineStatus === "error").length, cleared: input.evidence.filter(file => file.quarantineStatus === "clean").length, rejected: input.evidence.filter(file => file.quarantineStatus === "rejected").length }
  let next: JourneyStatus["next"]
  if (!setupVersion) next = { panel: "setup", title: "Set up your company", body: "Start with your legal name, reporting year, boundary and sites. It takes about ten minutes, and you can leave anything you’re unsure of as “Not sure yet”.", action: "Start company setup" }
  else if (!sites.included) next = { panel: "setup", title: "Include at least one site", body: "Activity records belong to a site. Add your sites in company setup and mark the ones inside your boundary as included.", action: "Add sites" }
  else if (!active.length) next = { panel: "collection", title: "Add your first activity record", body: "Start with a gas or electricity bill for one site. Each record takes a couple of minutes, and you can attach the bill as you go.", action: "Add activity" }
  else if (attentionRows.length) next = { panel: "collection", title: `Finish ${attentionRows.length} record${attentionRows.length === 1 ? "" : "s"} that need${attentionRows.length === 1 ? "s" : ""} input`, body: `${attentionRows[0]!.label} · ${attentionRows[0]!.sourceId}: ${attentionRows[0]!.reasons[0] ?? "More information is needed."}`, action: "Fix records", recordId: attentionRows[0]!.id }
  else next = { panel: "results", title: "Review your draft results", body: "Your records are ready to calculate. Review the figures, then print or download the draft report.", action: "View results" }
  return {
    canManage: input.canManage,
    setup: { saved: Boolean(setupVersion), revision: setupVersion?.revision ?? null, legalName: setup?.company.legalName ?? "", period: { start: setup?.reportingPeriod.start ?? null, endExclusive: setup?.reportingPeriod.endExclusive ?? null }, boundary: setup?.boundary.approach ?? "unknown", sites, missing },
    collection, evidence, next,
    progress: {
      setup: !setupVersion ? "not_started" : missing.length ? "in_progress" : "done",
      collection: !active.length ? "not_started" : attentionRows.length ? "in_progress" : "done",
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
  if (!status.setup.missing.length && !attention.length) lines.push("Nothing else is waiting on you. Open Results & report to review the draft.")
  return lines
}

