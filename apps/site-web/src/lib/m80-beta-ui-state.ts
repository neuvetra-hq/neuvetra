import type { M80FoundationView } from "./m80-beta-api"

export function m80SetupPermissions(foundation: Pick<M80FoundationView, "canManage" | "currentVersion"> | null, editing: boolean, hasDraft: boolean) {
  const canManage = foundation?.canManage === true
  return { canManage, canEdit: canManage && hasDraft && (foundation?.currentVersion === null || editing), showCorrection: canManage && foundation?.currentVersion !== null && !editing }
}

export function prioritizeM80Eligibility(results: M80FoundationView["eligibility"]["results"]) {
  const priority = { missing_facts: 0, unsupported: 1, held_candidate: 2 } as const
  return [...results].sort((a, b) => priority[a.state] - priority[b.state])
}

export function m80LoadIsCurrent(requestContext: string, currentContext: string, aborted: boolean) { return requestContext === currentContext && !aborted }
