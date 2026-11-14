// BF-18 (QA of PR #72, F-2): a plain reason for every apply_failed that tools/staging/apply-existing.ts prints. Before this,
// any failure that was not a PostgreSQL error printed only `"sqlstate":null`, which could mean a role without BYPASSRLS, a
// receipt mismatch, a network error or a refused migration. Only fixed codes and fixed sentences are printed, never an
// error's own message (it could carry a host name or a connection detail). Operator tooling only; the server never imports it.

export const STAGING_APPLY_FAILURE_REASONS = {
  inputs_invalid: "The command's inputs were refused before anything was contacted: check the plan fingerprint, that the output name is new, the export file and that you are in the repository root.",
  role_without_bypassrls: "The database role in the export file does not bypass row-level security, so the migration cannot read its receipts or backfill. Nothing was applied. Stop and ask the CTO.",
  plan_drift: "The database's containment plan is not the reviewed plan file. Nothing was applied. Make a new plan (C1) and check it again.",
  containment_not_verified: "The containment check failed after the plan's statements ran. The transaction rolled back and nothing was applied. Stop and ask the CTO.",
  legacy_containment_not_verified: "The legacy containment or the Storage guard grants were not verified before migrating. Nothing was applied. Stop and ask the CTO.",
  receipts_mismatch: "The database's migration receipts are not a prefix of this folder's migrations (or the role cannot read them). Nothing was applied. Stop and ask the CTO.",
  migration_would_expose: "A migration would have exposed something to anon or authenticated, or lost a Storage guard grant, so it was rolled back. Nothing was applied. Stop and ask the CTO.",
  connection_lost: "The connection to the database failed or was closed. If it happened at the very end, the migration may have been applied: check /ready before anything else, and tell the CTO what it says.",
  database_refused: "The database refused a statement (see sqlstate). The migration runs in one transaction, so it was rolled back unless /ready says otherwise.",
  other: "An unexpected failure. Do not retry. Send the CTO this line, the output file and the time, and check /ready.",
} as const
export type StagingApplyFailureReason = keyof typeof STAGING_APPLY_FAILURE_REASONS

/** Thrown by apply-existing.ts for a refusal of its own, with its reason. */
export class StagingApplyRefusal extends Error {
  constructor(readonly reason: StagingApplyFailureReason) { super(reason) }
}

const MESSAGES: ReadonlyArray<[string, StagingApplyFailureReason]> = [
  ["Confirmed existing project reuse and verified legacy containment required.", "legacy_containment_not_verified"],
  ["Unknown staging migration baseline.", "receipts_mismatch"],
  ["Unknown or changed staging migration baseline.", "receipts_mismatch"],
  ["A migration would break the verified legacy containment.", "migration_would_expose"],
  ["Database client disconnected.", "connection_lost"],
  ["Database connection is closed.", "connection_lost"],
  ["Transaction client is unavailable.", "connection_lost"],
  ["Transaction did not commit.", "connection_lost"],
]
const NETWORK_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "EPIPE", "EHOSTUNREACH", "ENETUNREACH", "ConnectionRefused", "ConnectionClosed"])

/** The reason and the SQLSTATE (only a real five-character one) for a failure of apply-existing.ts. */
export function stagingApplyFailure(error: unknown): { reason: StagingApplyFailureReason; sqlstate: string | null; detail: string } {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : ""
  const message = error instanceof Error ? error.message : ""
  const sqlstate = /^[0-9A-Z]{5}$/.test(code) && !NETWORK_CODES.has(code) ? code : null
  const reason: StagingApplyFailureReason = error instanceof StagingApplyRefusal ? error.reason
    : sqlstate ? "database_refused"
    : MESSAGES.find(([text]) => text === message)?.[1]
      ?? (NETWORK_CODES.has(code) || /^(Connection terminated|timeout exceeded when trying to connect|Client has encountered a connection error)/.test(message) ? "connection_lost" : "other")
  return { reason, sqlstate, detail: STAGING_APPLY_FAILURE_REASONS[reason] }
}
