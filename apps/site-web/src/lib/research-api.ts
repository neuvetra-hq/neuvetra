export type AnswerStatus = "supported" | "qualified" | "needs_input" | "needs_review" | "unsupported" | "stale_or_conflicting" | "unavailable"

export interface ResearchAnswer {
  status: AnswerStatus
  message: string
  claims: { id: string; text: string; qualifications: string[]; evidence_ids: string[] }[]
  evidence: { id: string; source_id: string; locator: string; excerpt: string }[]
  sources: { id: string; title: string; version: string; status: string; canonical_url: string }[]
  release: { id: string; version: string } | null
  provider: { mode: "live" | "disabled"; model: string | null }
  missing_context: string[]
}

export const ANSWER_LABELS: Record<AnswerStatus, string> = {
  supported: "Supported by the reviewed sources",
  qualified: "Supported, with qualifications",
  needs_input: "More context is needed",
  needs_review: "This answer needs further review",
  unsupported: "Outside this demo’s coverage",
  stale_or_conflicting: "The source status needs clarification",
  unavailable: "Answering is unavailable",
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0)
}

const CONTEXT_IDS = new Set(["location", "reporting_period", "electricity_supply"])
const PUBLISHER_HOSTS = new Set(["epa.gov", "www.epa.gov", "ghgprotocol.org", "www.ghgprotocol.org"])

export function isResearchAnswer(value: unknown): value is ResearchAnswer {
  if (!record(value) || typeof value.status !== "string" || !Object.prototype.hasOwnProperty.call(ANSWER_LABELS, value.status) || typeof value.message !== "string") return false
  if (!Array.isArray(value.claims) || !value.claims.every((item) => record(item) && typeof item.id === "string" && typeof item.text === "string" && stringList(item.qualifications) && stringList(item.evidence_ids))) return false
  if (!Array.isArray(value.evidence) || !value.evidence.every((item) => record(item) && typeof item.id === "string" && typeof item.source_id === "string" && typeof item.locator === "string" && typeof item.excerpt === "string")) return false
  if (!Array.isArray(value.sources) || !value.sources.every((item) => record(item) && typeof item.id === "string" && typeof item.title === "string" && typeof item.version === "string" && typeof item.status === "string" && typeof item.canonical_url === "string" && publisherUrl(item.canonical_url) !== null)) return false
  if (value.release !== null && (!record(value.release) || typeof value.release.id !== "string" || typeof value.release.version !== "string")) return false
  if (!record(value.provider) || (value.provider.mode !== "live" && value.provider.mode !== "disabled") || !(value.provider.model === null || typeof value.provider.model === "string") || !stringList(value.missing_context)) return false
  const answer = value as unknown as ResearchAnswer
  if (answer.missing_context.some((item) => !CONTEXT_IDS.has(item)) || new Set(answer.missing_context).size !== answer.missing_context.length) return false
  if ((answer.status === "needs_input") !== (answer.missing_context.length > 0)) return false
  const hasAnswer = answer.status === "supported" || answer.status === "qualified"
  if (!hasAnswer) return answer.claims.length === 0 && answer.evidence.length === 0 && answer.sources.length === 0
  if (answer.provider.mode !== "live" || !answer.provider.model || !answer.release?.id || !answer.release.version || !answer.claims.length || !answer.evidence.length || !answer.sources.length) return false
  for (const items of [answer.claims, answer.evidence, answer.sources]) {
    if (items.some((item) => !item.id.trim()) || new Set(items.map((item) => item.id)).size !== items.length) return false
  }
  const evidenceIds = new Set(answer.evidence.map((item) => item.id))
  const sourceIds = new Set(answer.sources.map((item) => item.id))
  const usedEvidence = new Set<string>()
  for (const claim of answer.claims) {
    if (!claim.text.trim() || !claim.evidence_ids.length || new Set(claim.evidence_ids).size !== claim.evidence_ids.length) return false
    for (const id of claim.evidence_ids) { if (!evidenceIds.has(id)) return false; usedEvidence.add(id) }
  }
  if (usedEvidence.size !== evidenceIds.size || answer.evidence.some((item) => !sourceIds.has(item.source_id) || !item.locator.trim() || !item.excerpt.trim())) return false
  if (new Set(answer.evidence.map((item) => item.source_id)).size !== sourceIds.size) return false
  return (answer.status === "qualified") === answer.claims.some((item) => item.qualifications.length > 0)
}

export function publisherUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !PUBLISHER_HOSTS.has(url.hostname)) return null
    return url.href
  } catch {
    return null
  }
}

export async function requestResearchAnswer(question: string, signal: AbortSignal): Promise<ResearchAnswer> {
  const response = await fetch("/research-api/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  })
  const body: unknown = await response.json().catch(() => null)
  if (!isResearchAnswer(body)) throw new Error("The research service did not return a usable answer. Please try again.")
  if (!response.ok && body.status !== "unavailable" && body.status !== "needs_review") throw new Error("The research service could not complete this request.")
  return body
}
