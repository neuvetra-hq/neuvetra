import type { AnswerResponse } from '../research/types'

export type ReasonCode = 'none' | 'coverage_missing' | 'action_out_of_scope' | 'context_required' | 'source_unavailable' | 'source_stale' | 'selection_invalid' | 'draft_invalid' | 'draft_empty' | 'numeric_output_not_allowed' | 'support_not_verified' | 'context_limit' | 'provider_disabled' | 'provider_failure' | 'provider_truncated' | 'budget_exhausted' | 'request_in_progress' | 'request_timeout' | 'request_cancelled'
export type Action = 'conceptual_research' | 'numeric_factor_selection' | 'calculation' | 'legal_applicability' | 'company_diagnosis' | 'unsupported'
export interface PassageSource {
  id: string; title: string; version: string; status: string; canonical_url: string
  local_path: string; sha256: string; bytes?: number
  review_status: string; rights_review: string; rights_scope: string
}
export interface Extraction {
  id: string; source_id: string; source_sha256: string; local_path: string; sha256: string
  format: 'normalized_pages_json_v1'; normalization: 'nfkc_whitespace_v1'
  tool: { name: string; version: string }
}
export interface PassageSpan {
  pdf_page_1_based: number; printed_page: string; context_start: number; context_end_exclusive: number
  normalized_page_sha256: string; context_sha256: string
}
export interface Passage {
  id: string; source_id: string; extraction_id: string; title: string; coverage: string[]
  text: string; sha256: string; locator: string
  locator_detail: { normalization: string; spans: PassageSpan[] }
  required_passage_ids: string[]; qualifications: string[]; exclusions: string[]
  review_status: string; rights_scope: string
}
export interface PassageRelease {
  schema_version: 2; release_id: string; version: string; status: string; commercial_runtime_approval: false
  scope: { jurisdictions: string[]; allowed_actions: string[]; exclusions: string[] }
  review: { author: string; reviewer: string | null; reviewed_at: string | null; expires_at: string | null; approved_passage_ids: string[] }
  sources: PassageSource[]; extractions: Extraction[]; passages: Passage[]
}
export interface VerifiedPassages { release: PassageRelease; sha256: string; passages: Passage[] }
export type Stage = 'plan' | 'draft' | 'verify'
export interface StageProfile {
  model: 'claude-sonnet-5' | 'claude-opus-5'; max_output_tokens: number
  thinking: 'disabled' | 'adaptive'; effort: 'high' | null
}
export interface StageProvider {
  mode: 'live' | 'disabled'; model: string | null
  stageProfiles: Record<Stage, StageProfile> | null
  preflight(stage: Stage, input: unknown): void
  available(): boolean
  limits(): { max_calls: number; remaining_calls: number; max_output_tokens: number; max_spend_usd: number; reserved_spend_usd: number }
  invoke(stage: Stage, input: unknown, signal: AbortSignal): Promise<unknown>
}
export type PassageAnswer = AnswerResponse & { answer_mode: 'passage_grounded'; reason_code: ReasonCode; provider: AnswerResponse['provider'] & { stages: Record<Stage, StageProfile> | null } }
export interface Plan {
  action: Action; decision: 'answer' | 'needs_input' | 'unsupported' | 'stale_or_conflicting'
  passage_ids: string[]; facets: { id: string; request: string; passage_ids: string[] }[]; missing_context: string[]
}
export const draftLimits = { maxClaims: 6, claimCharacters: 400, totalCharacters: 1600 } as const
export const draftTargetFraction = 0.75
export const draftTargets = { claimCharacters: Math.floor(draftLimits.claimCharacters * draftTargetFraction), totalCharacters: Math.floor(draftLimits.totalCharacters * draftTargetFraction) } as const
export const facetLimits = (count: number) => ({ max_claims: Math.ceil(draftLimits.maxClaims / count), text_characters: Math.floor(draftLimits.totalCharacters / count), target_text_characters: Math.floor(Math.floor(draftLimits.totalCharacters / count) * draftTargetFraction) })
export interface DraftClaim { text: string; passage_ids: string[] }
export interface CheckedClaim extends DraftClaim { id: string; facet_id: string; qualifications: string[] }
