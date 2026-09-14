import type { VerifiedPassages } from '../research-passages/types'

/** Explicit reviewed deployment binding, supplied privately by the coordinator. */
export interface CloudTarget {
  supabaseHost: string; schema: string; bucket: string
  pineconeHost: string; pineconeIndex: string
  scopeId: string; buildId: string; namespace: string
  releaseSha256: string; profileSha256: string; expectedReaderUserId: string
  /** Reviewed private resource authorization deadline; never renewed at startup. */
  reviewExpiresAt: string
}
export interface CloudBinding {
  scopeId: string; buildId: string; namespace: string
  releaseId: string; releaseVersion: string; releaseSha256: string; profileSha256: string
  sourceSha256: string[]
}
export interface CloudEvidence {
  verified: VerifiedPassages
  binding: CloudBinding
  /** Ranked candidates, not a permission boundary or the complete catalog. */
  candidateIds: string[]
}
export interface CloudRepositoryConfig {
  target: CloudTarget
  supabasePublishableKey: string
  pineconeApiKey: string
  readerJwt: string | (() => Promise<string>)
  fetch?: (url: string, init: RequestInit) => Promise<Response>
  now?: () => number
}
export type CloudErrorCode = 'cloud_configuration_invalid' | 'cloud_identity_unavailable' | 'cloud_unauthorized'
  | 'cloud_membership_invalid' | 'cloud_build_changed' | 'cloud_source_unavailable' | 'cloud_source_stale'
  | 'cloud_metadata_invalid' | 'cloud_profile_invalid' | 'cloud_search_invalid' | 'cloud_no_candidates'
  | 'cloud_provider_unavailable' | 'cloud_response_too_large' | 'cloud_cancelled'

export interface CloudRepository {
  loadForQuestion(question: string, signal: AbortSignal): Promise<CloudEvidence>
  recheck(binding: CloudBinding, signal: AbortSignal): Promise<void>
}
