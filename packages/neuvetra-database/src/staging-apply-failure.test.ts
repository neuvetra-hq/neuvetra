// BF-18 (QA of PR #72, F-2): every apply_failed of tools/staging/apply-existing.ts names a plain reason; a real SQLSTATE is
// still printed; an error's own message never is.
import { expect, test } from "bun:test"
import { STAGING_APPLY_FAILURE_REASONS, StagingApplyRefusal, stagingApplyFailure } from "./staging-apply-failure"

const coded = (code: string, message = "private detail db.example:5432") => Object.assign(new Error(message), { code })

test("the tool's own refusals keep their reason", () => {
  for (const reason of ["inputs_invalid", "role_without_bypassrls", "plan_drift", "containment_not_verified"] as const)
    expect(stagingApplyFailure(new StagingApplyRefusal(reason))).toEqual({ reason, sqlstate: null, detail: STAGING_APPLY_FAILURE_REASONS[reason] })
})

test("the migration runner's refusals, which used to print only sqlstate null, are told apart", () => {
  expect(stagingApplyFailure(new Error("Unknown staging migration baseline.")).reason).toBe("receipts_mismatch")
  expect(stagingApplyFailure(new Error("Unknown or changed staging migration baseline.")).reason).toBe("receipts_mismatch")
  expect(stagingApplyFailure(new Error("Confirmed existing project reuse and verified legacy containment required.")).reason).toBe("legacy_containment_not_verified")
  expect(stagingApplyFailure(new Error("A migration would break the verified legacy containment.")).reason).toBe("migration_would_expose")
  for (const failure of [new Error("A migration would break the verified legacy containment."), new Error("Unknown staging migration baseline.")]) expect(stagingApplyFailure(failure).sqlstate).toBeNull()
})

test("connection failures are connection_lost (with the advice to check /ready), never a SQLSTATE", () => {
  for (const error of [coded("ECONNREFUSED"), coded("ECONNRESET"), coded("ENOTFOUND"), coded("ETIMEDOUT"), coded("EPIPE"), new Error("Connection terminated unexpectedly"), new Error("Database client disconnected."), new Error("Transaction did not commit."), new Error("timeout exceeded when trying to connect")]) {
    const failure = stagingApplyFailure(error)
    expect([failure.reason, failure.sqlstate]).toEqual(["connection_lost", null])
    expect(failure.detail).toContain("/ready")
  }
})

test("a database refusal keeps its SQLSTATE; anything else is other; no message is ever repeated", () => {
  for (const code of ["55P03", "55000", "42501", "57P01"]) expect(stagingApplyFailure(coded(code))).toEqual({ reason: "database_refused", sqlstate: code, detail: STAGING_APPLY_FAILURE_REASONS.database_refused })
  expect(stagingApplyFailure(new Error("private detail db.example:5432"))).toEqual({ reason: "other", sqlstate: null, detail: STAGING_APPLY_FAILURE_REASONS.other })
  expect(stagingApplyFailure("not an error").reason).toBe("other")
  for (const detail of Object.values(STAGING_APPLY_FAILURE_REASONS)) expect(detail).not.toContain("db.example")
})
