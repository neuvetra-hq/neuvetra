export type AnswerStatus = 'supported' | 'qualified' | 'needs_input' | 'needs_review' | 'unsupported' | 'stale_or_conflicting' | 'unavailable'

export interface Source {
  id: string
  title: string
  version: string
  source_type: string
  status: string
  canonical_url: string
  local_path: string
  sha256: string
  document_date: string | null
  rights_review: string
  rights_scope: string
  review_status: string
}

export interface Evidence {
  id: string
  source_id: string
  locator: string
  excerpt: string
  review_status: string
}

export interface Proposition {
  id: string
  text: string
  evidence_ids: string[]
  qualifications: string[]
  keywords: string[]
  topic: string
}

export interface Release {
  schema_version: 1
  release_id: string
  version: string
  status: string
  commercial_runtime_approval: false
  scope: { topics: string[]; excluded: string[] }
  review: { author: string; reviewer: string | null; reviewed_at: string | null; expires_at: string | null; approved_proposition_ids: string[] }
  sources: Source[]
  evidence: Evidence[]
  propositions: Proposition[]
}

export interface VerifiedRelease {
  release: Release
  sha256: string
  propositions: Proposition[]
}

export interface ModelInput {
  question: string
  propositions: Proposition[]
  evidence: Evidence[]
}

export interface ProviderLimits {
  max_calls: number
  remaining_calls: number
  max_output_tokens: number
  max_spend_usd: number
  reserved_spend_usd: number
}

export interface AnswerProvider {
  mode: 'live' | 'disabled'
  model: string | null
  available(): boolean
  limits(): ProviderLimits
  select(input: ModelInput): Promise<unknown>
}

export interface AnswerResponse {
  status: AnswerStatus
  message: string
  claims: Pick<Proposition, 'id' | 'text' | 'qualifications' | 'evidence_ids'>[]
  evidence: Pick<Evidence, 'id' | 'source_id' | 'locator' | 'excerpt'>[]
  sources: Pick<Source, 'id' | 'title' | 'version' | 'status' | 'canonical_url'>[]
  release: { id: string; version: string; sha256: string } | null
  provider: { mode: 'live' | 'disabled'; model: string | null }
  missing_context: string[]
}
