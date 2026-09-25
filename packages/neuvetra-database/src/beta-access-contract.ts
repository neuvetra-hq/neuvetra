export const BETA_ACCESS_PROFILE = "neuvetra.beta-access.synthetic-rehearsal.v1" as const
export const BETA_ACCESS_SCHEMA_VERSION = 1 as const
export const BETA_ACCESS_TOKEN_BYTES = 32
export const BETA_ACCESS_TOKEN_PATTERN = /^[0-9a-f]{64}$/
export const BETA_ACCESS_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const BETA_ACCESS_EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

export type BetaRole = "owner" | "member"
export type BetaAccessState = "access_admitted_setup_pending"

export interface BetaAccessRecord {
  companyId: string
  role: BetaRole
  membershipGeneration: number
  state: BetaAccessState
  displayLabel?: string
}

export interface BetaRedeemRequest { token: string; requestId: string }

export function normalizeBetaEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (!BETA_ACCESS_EMAIL_PATTERN.test(normalized) || !/^[\x00-\x7f]+$/.test(normalized) || normalized.length > 254) throw new Error("Verified email required.")
  return normalized
}

export function parseBetaRedeemRequest(value: unknown): BetaRedeemRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request.")
  const record = value as Record<string, unknown>
  if (Object.keys(record).sort().join(",") !== "requestId,token" || typeof record.token !== "string" || typeof record.requestId !== "string" || !BETA_ACCESS_TOKEN_PATTERN.test(record.token) || !BETA_ACCESS_UUID_PATTERN.test(record.requestId)) throw new Error("Invalid request.")
  return { token: record.token, requestId: record.requestId }
}
