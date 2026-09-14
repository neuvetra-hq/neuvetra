import unitCatalog from '../../../../data/research/answer-units/scope2-website.epa-acquisition.v1.json'
// Only evidence IDs and their exact reviewed notes enter the browser module graph.
import unitPassages from '../data/reviewed-qualifications.json'
import { PREVIEW_PAUSED_MESSAGE } from './research-maintenance'

export type AnswerStatus = "supported" | "qualified" | "needs_input" | "needs_review" | "unsupported" | "stale_or_conflicting" | "unavailable"

export interface ResearchAnswer {
  answer_mode?: "reviewed_statements" | "passage_grounded" | "cloud_passage_grounded" | "cloud_reviewed_composition"
  status: AnswerStatus
  message: string
  claims: { id: string; text: string; qualifications: string[]; evidence_ids: string[] }[]
  evidence: { id: string; source_id: string; locator: string; excerpt: string }[]
  sources: { id: string; title: string; version: string; status: string; canonical_url: string }[]
  release: { id: string; version: string; sha256?: string } | null
  provider: { mode: "live" | "disabled"; model: string | null }
  missing_context: string[]
  scope_gaps?: { question_fragment: string; reason: 'coverage_missing' | 'action_out_of_scope' | 'context_required'; context_ids: string[] }[]
  retrieval?: { mode: "cloud"; store: "Supabase"; search: "Pinecone"; build_id: string; release_sha256: string; candidate_ids: string[]; selected_ids: string[]; checked_at: string } | null
  correction_attempted?: boolean
  correction_kind?: 'draft_contract' | 'source_review' | 'selection_size' | 'selection_contract' | null
  composition?: {catalog_id:string;version:string;sha256:string;wording:'reviewed_verbatim';units:{id:string;title:string;type:'source_summary'|'reviewed_interpretation'}[]}|null
}

export const ANSWER_LABELS: Record<AnswerStatus, string> = {
  supported: "Supported by the reviewed sources",
  qualified: "Supported, with qualifications",
  needs_input: "More context is needed",
  needs_review: "This answer needs further review",
  unsupported: "More source coverage is needed",
  stale_or_conflicting: "The source status needs clarification",
  unavailable: "Answering is unavailable",
}

export function answerHeading(answer: ResearchAnswer): string {
  if (answer.status === 'unsupported' && answer.scope_gaps?.some(gap => gap.reason === 'action_out_of_scope')) return 'This request is outside the preview'
  return ANSWER_LABELS[answer.status]
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0)
}

export const CONTEXT_LABELS: Record<string, string> = {
  referenced_requirement: "Which requirement or guidance change you mean (its name, date or a public link)",
  referenced_subject: "What the referenced phrase refers to",
  intended_use: "What you want to understand or use the information for",
  factor_description: "What the supplied figure represents, including its stated units and period",
  supplier_documentation: "The supplier's public explanation of its method or product",
  base_year_method: "Which accounting method the base-year question concerns",
  target_method: "Which target or tracking method the question concerns",
  change_description: "Which change you are comparing",
  location: "The relevant region or electricity grid",
  reporting_period: "The reporting year or period relevant to the question",
  electricity_supply: "The kind of supply or contractual arrangement relevant to the question",
}
const CONTEXT_IDS = new Set(Object.keys(CONTEXT_LABELS))
const PUBLISHER_HOSTS = new Set(["epa.gov", "www.epa.gov", "ghgprotocol.org", "www.ghgprotocol.org"])

export function isResearchAnswer(value: unknown): value is ResearchAnswer {
  if (!record(value) || typeof value.status !== "string" || !Object.prototype.hasOwnProperty.call(ANSWER_LABELS, value.status) || typeof value.message !== "string") return false
  if (value.answer_mode !== undefined && value.answer_mode !== "reviewed_statements" && value.answer_mode !== "passage_grounded" && value.answer_mode !== "cloud_passage_grounded" && value.answer_mode !== "cloud_reviewed_composition") return false
  if (!Array.isArray(value.claims) || !value.claims.every((item) => record(item) && typeof item.id === "string" && typeof item.text === "string" && stringList(item.qualifications) && stringList(item.evidence_ids))) return false
  if (!Array.isArray(value.evidence) || !value.evidence.every((item) => record(item) && typeof item.id === "string" && typeof item.source_id === "string" && typeof item.locator === "string" && typeof item.excerpt === "string")) return false
  if (!Array.isArray(value.sources) || !value.sources.every((item) => record(item) && typeof item.id === "string" && typeof item.title === "string" && typeof item.version === "string" && typeof item.status === "string" && typeof item.canonical_url === "string" && publisherUrl(item.canonical_url) !== null)) return false
  if (value.release !== null && (!record(value.release) || typeof value.release.id !== "string" || typeof value.release.version !== "string")) return false
  if (!record(value.provider) || (value.provider.mode !== "live" && value.provider.mode !== "disabled") || !(value.provider.model === null || typeof value.provider.model === "string") || !stringList(value.missing_context)) return false
  const answer = value as unknown as ResearchAnswer
  if (answer.release?.id === "scope2-passages" && answer.answer_mode !== "passage_grounded") return false
  if (answer.release?.id === "scope2-website" && answer.answer_mode !== "cloud_passage_grounded" && answer.answer_mode !== "cloud_reviewed_composition") return false
  if (answer.missing_context.some((item) => !CONTEXT_IDS.has(item)) || new Set(answer.missing_context).size !== answer.missing_context.length) return false
  if ((answer.status === "needs_input") !== (answer.missing_context.length > 0)) return false
  const hasAnswer = answer.status === "supported" || answer.status === "qualified"
  if (answer.answer_mode === "cloud_passage_grounded" || answer.answer_mode === "cloud_reviewed_composition") {
    const correctionKinds = answer.answer_mode === 'cloud_reviewed_composition' ? ['selection_size', 'selection_contract', 'source_review'] : ['draft_contract', 'source_review']
    if (typeof answer.correction_attempted !== "boolean" || (answer.correction_attempted ? !correctionKinds.includes(String(answer.correction_kind)) : answer.correction_kind !== null)) return false
    if (hasAnswer) {
      const r = answer.retrieval
      if (!record(r) || r.mode !== "cloud" || r.store !== "Supabase" || r.search !== "Pinecone" || typeof r.build_id !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(r.build_id) || typeof r.release_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(r.release_sha256) || answer.release?.sha256 !== r.release_sha256 || answer.release?.id !== "scope2-website" || !stringList(r.candidate_ids) || !r.candidate_ids.length || r.candidate_ids.length > 32 || new Set(r.candidate_ids).size !== r.candidate_ids.length || !stringList(r.selected_ids) || !r.selected_ids.length || r.selected_ids.length > 32 || new Set(r.selected_ids).size !== r.selected_ids.length || typeof r.checked_at !== "string" || !Number.isFinite(Date.parse(r.checked_at))) return false
      if (answer.evidence.some(e => !r.selected_ids.includes(e.id)) || answer.sources.some(s => s.status !== "published_guidance")) return false
    } else if (answer.retrieval !== null) return false
  }
  if (answer.answer_mode === "cloud_reviewed_composition") {
    if (!Array.isArray(answer.scope_gaps) || answer.scope_gaps.length > 12 || answer.scope_gaps.some(gap => !record(gap) || Object.keys(gap).length !== 3 || typeof gap.question_fragment !== 'string' || !gap.question_fragment.trim() || gap.question_fragment.length > 2000 || !['coverage_missing', 'action_out_of_scope', 'context_required'].includes(gap.reason) || !stringList(gap.context_ids) || new Set(gap.context_ids).size !== gap.context_ids.length || gap.context_ids.some(id => !CONTEXT_IDS.has(id)) || (gap.reason === 'context_required' ? gap.context_ids.length < 1 || gap.context_ids.length > 3 : gap.context_ids.length !== 0))) return false
    const gapReasons = answer.scope_gaps.map(gap => gap.reason)
    if (answer.scope_gaps.reduce((n, gap) => n + gap.question_fragment.length, 0) > 2000) return false
    if (answer.status === 'needs_input') {
      if (!gapReasons.length || gapReasons.some(reason => reason !== 'context_required') || JSON.stringify(answer.missing_context) !== JSON.stringify([...new Set(answer.scope_gaps.flatMap(gap => gap.context_ids))])) return false
    } else if (answer.status === 'unsupported') {
      if (!gapReasons.some(reason => reason === 'coverage_missing' || reason === 'action_out_of_scope')) return false
    } else if (gapReasons.length) return false
    if (answer.correction_kind !== null && answer.correction_kind !== 'source_review' && answer.correction_kind !== 'selection_size' && answer.correction_kind !== 'selection_contract') return false
    if (!hasAnswer) { if (answer.composition !== null) return false }
    else {
      const composition = answer.composition
      if (!record(composition) || composition.catalog_id !== unitCatalog.catalog_id || composition.version !== unitCatalog.version || composition.sha256 !== '97b2c4e0f4121c1d2ea7fa33d569f53344193f12a80e9d1349577c3a86e17e50' || composition.wording !== 'reviewed_verbatim' || !Array.isArray(composition.units) || !composition.units.length || composition.units.length > 8 || composition.units.length !== answer.claims.length || answer.release?.sha256 !== unitCatalog.source_release_sha256) return false
      const ids = answer.claims.map(c=>c.id)
      const approved = unitCatalog.units.filter(u=>ids.includes(u.id))
      if (approved.length !== ids.length || approved.some((u,i)=>u.id!==ids[i]) || approved.reduce((n,u)=>n+u.text.length+u.title.length,0)>4000) return false
      for(let i=0;i<approved.length;i++) {
        const u=approved[i]!, claim=answer.claims[i]!, label:unknown=composition.units[i]
        const qualifications = [...new Set(unitPassages.filter(p=>u.passage_ids.includes(p.id)).flatMap(p=>p.qualifications))]
        if (!record(label) || Object.keys(label).length!==3 || label.id!==u.id || label.title!==u.title || label.type!==u.type || claim.text!==u.text || JSON.stringify(claim.evidence_ids)!==JSON.stringify(u.passage_ids) || JSON.stringify(claim.qualifications)!==JSON.stringify(qualifications) || u.required_unit_ids.some(id=>!ids.includes(id))) return false
      }
    }
  } else if (answer.composition !== undefined) return false
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

/** Keep every claim association while displaying each identical source note once.
 * Unit text is never shortened: its same-claim prerequisites stay in place.
 */
export function qualificationNotes(answer: ResearchAnswer) {
  const notes: { id: string; text: string; claim_ids: string[] }[] = []
  for (const claim of answer.claims) for (const text of claim.qualifications) {
    const found = notes.find(note => note.text === text)
    if (found) { if (!found.claim_ids.includes(claim.id)) found.claim_ids.push(claim.id) }
    else notes.push({ id: `answer-note-${notes.length + 1}`, text, claim_ids: [claim.id] })
  }
  return notes
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

export async function requestResearchAnswer(question: string, signal: AbortSignal, paused = false): Promise<ResearchAnswer> {
  if (paused) throw new Error(PREVIEW_PAUSED_MESSAGE)
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
