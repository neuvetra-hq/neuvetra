/**
 * WO-04b: the Scope 3 part of readiness, loaded lazily (its own chunk, with the Scope 3 checklist) so the entry chunk
 * doesn't grow. Every Scope 3 item comes only from the Results screen's to-do list (`scope3Todos`) over the existing
 * `/results/scope3` response, in the same number: one readiness item per to-do item, with the same blocking flag.
 */
import { scope3CountedDuplicate, scope3LineNeedsAttention, scope3Todos, type Scope3TodoAction, type Scope3TodoItem } from "./scope3-checklist"
import { loadScope3Results, type Scope3ResultsResponse } from "./scope3-results-api"
import { scope3ClosedLines, scope3LineState } from "../../../../packages/neuvetra-database/src/scope3-trace"
import { possibleDuplicateOf, possibleDuplicateOfText } from "../../../../packages/neuvetra-database/src/collection-duplicates"
import { kindLabel, periodLabel } from "./plain-language"
import { DUPLICATE_ACTION } from "./readiness"
import type { ReadinessGroup, ReadinessItem, ReadinessTarget } from "./readiness"
import type { Scope3Row } from "./scope3-results-api"
import type { HostedWorkspaceActor } from "./workspace-api"

/** Category steps by their to-do code: decisions and assessments (S1), or an included category without records (S2). */
const CATEGORY_GROUP: Readonly<Record<string, ReadinessGroup>> = {
  not_screened: "scope3-decision", assessment_missing: "scope3-decision", assessment_excluded: "scope3-decision",
  screening_conflict: "scope3-decision", review_required: "scope3-decision", no_records: "scope3-no-records",
}

function targetOf(action: Scope3TodoAction | undefined): ReadinessTarget {
  if (!action) return { type: "view", view: "results" }
  switch (action.type) {
    case "fix": return { type: "record", recordId: action.recordId }
    case "spend": return { type: "spend", tab: action.tab }
    case "setup": return { type: "view", view: "setup" }
    case "collection": return { type: "view", view: "collection" }
    // Assessments are written inline on Results, next to the to-do item.
    case "assessment": return { type: "view", view: "results" }
  }
}

/** One readiness item per Scope 3 to-do item, in the to-do's own order (`computeReadiness` then sorts by group, stably). */
export function scope3ReadinessItems(results: Scope3ResultsResponse, canManage: boolean): ReadinessItem[] {
  const todos: Scope3TodoItem[] = scope3Todos(results)
  const closed = scope3ClosedLines(results.records)
  const titles = new Map(results.coverage.categories.map(row => [row.category, row.title]))
  const categories = new Map(results.coverage.categories.map(row => [row.category, row]))
  return todos.map(item => {
    let group: ReadinessGroup = "input"
    let row: Scope3Row | undefined
    if (item.kind === "category") group = CATEGORY_GROUP[item.key.split(":")[2] ?? ""] ?? "scope3-decision"
    else if (item.kind === "line") {
      const [, recordId, kind] = item.key.split(":")
      row = results.records.find(line => line.recordId === recordId && line.kind === kind)
      const state = row ? scope3LineState(row, closed.has(row)) : "inputNeeded"
      group = state === "outsidePeriod" ? "held" : state === "methodPending" || state === "optionalPending" ? "method" : "input"
      // CEO ruling: a counted possible duplicate with nothing else open is listed to confirm, not as an open item (it never
      // blocks: the to-do's blocking flag needs input or a screening conflict).
      if (row && scope3CountedDuplicate(row) && !scope3LineNeedsAttention(state, categories.get(row.category)) && !item.blocking) group = "duplicate"
    }
    const action = item.actions[0]
    const category = `Category ${item.category}${titles.get(item.category) ? ` (${titles.get(item.category)})` : ""}`
    if (group === "duplicate" && row) {
      const otherId = possibleDuplicateOf(row.plan.notes ?? [])
      const other = otherId ? results.records.find(line => line.recordId === otherId) : undefined
      return { key: `scope3:${item.key}`, group, scope: "3" as const, title: `${category}: ${kindLabel(row.kind)} · ${row.sourceId} and ${other ? `${kindLabel(other.kind)} · ${other.sourceId}` : "an earlier record"}`,
        detail: `${possibleDuplicateOfText(otherId ?? "unknown", other ? { sourceId: other.sourceId, locationName: other.locationName, period: periodLabel(other.period.start, other.period.endExclusive) } : null)} ${item.reasons.join(" ")}`,
        target: targetOf(action), action: canManage ? DUPLICATE_ACTION : "View", blocking: false }
    }
    return {
      key: `scope3:${item.key}`, group, scope: "3" as const,
      title: item.kind === "spend" ? item.title : `${category}: ${item.title}`,
      detail: item.reasons.join(" "),
      target: targetOf(action),
      action: canManage ? action?.label ?? "Open Results" : "View",
      blocking: item.blocking,
    }
  })
}

/** The one extra request: the existing `/results/scope3`, decoded and turned into readiness items. */
export async function loadScope3Readiness(workspaceId: string, actor: HostedWorkspaceActor, canManage: boolean): Promise<ReadinessItem[]> {
  return scope3ReadinessItems(await loadScope3Results(workspaceId, actor), canManage)
}
