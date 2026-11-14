// BF-32 (F1, F2, F3): the screen's pre-save check is the server's save rule (the shared validator and field table), so a save
// the server accepts is never blocked and text the server refuses is refused with the same words.
import { describe, expect, test } from "bun:test"
import type { CollectionActivity } from "../../../../packages/neuvetra-database/src/collection-contract"
import { validateCollectionSaveInput } from "../../../../packages/neuvetra-database/src/collection-contract"
import { probeBases } from "../../../../packages/neuvetra-database/src/collection-text-rule-probe"
import { contractProblem, correctionReasonFor } from "./activity-save-checks"

const ids = { company: "94320000-0000-4000-8000-000000000001", setupVersion: "94320000-0000-4000-8000-0000000000aa", locationId: "94320000-0000-4000-8000-0000000000bb", owner: "94320000-0000-4000-8000-0000000000cc" }
const bases = probeBases(ids)
const base = bases[0]!.activity as unknown as CollectionActivity
const withText = (patch: Partial<CollectionActivity>): CollectionActivity => ({ ...structuredClone(base), ...patch })
const spend = bases.find(b => b.kind === "purchase_spend")!.activity as unknown as CollectionActivity
const spendWith = (description: string, extra: Record<string, unknown> = {}): CollectionActivity => ({ ...structuredClone(spend), ...extra, payload: { ...(spend.payload as object), description } } as unknown as CollectionActivity)
const DECOMPOSED = "é"

describe("BF-32 web pre-save check uses the server's rule", () => {
  test("F1: decomposed é ×600 in Reference (1,200 units, 600 after NFC) is accepted by both", () => {
    const activity = withText({ reference: DECOMPOSED.repeat(600) } as Partial<CollectionActivity>)
    expect(contractProblem(activity, null, null)).toBeNull()
    expect(() => validateCollectionSaveInput({ idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity } as never)).not.toThrow()
  })
  test("F1: text over the limit after NFC is refused with the server's wording and names the field", () => {
    const problem = contractProblem(withText({ reference: DECOMPOSED.repeat(1001) } as Partial<CollectionActivity>), null, null)
    expect(problem?.text).toContain("Reference is 1,001 characters; the limit is 1,000 (1 over).")
    expect(problem?.fields).toEqual(["reference"])
  })
  test("F2: a withdrawal reason that would push 'Withdrawn: ' + reason past 2,000 is refused as the withdrawal reason, with its own name", () => {
    const withdrawn = (reason: string) => withText({ state: "withdrawn", withdrawalReason: reason } as Partial<CollectionActivity>)
    const over = withdrawn("w".repeat(1990))
    const problem = contractProblem(over, null, correctionReasonFor(over, true, ""))
    expect(problem?.text).toContain("Withdrawal reason is 1,990 characters; the limit is 1,989")
    expect(problem?.text).not.toContain("Correction reason")
    expect(problem?.fields).toEqual(["withdrawalReason"])
    const fits = withdrawn("w".repeat(1989))
    expect(contractProblem(fits, null, correctionReasonFor(fits, true, ""))).toBeNull()
  })
  test("F3: text the save leaves as the corrected version stored it is not re-checked; a changed field must meet the rule", () => {
    // Legal under the old Scope 3 rule (101 code points of U+0958, limit 200), over the new one (202 units after NFC).
    const old = spendWith("\u0958".repeat(101))
    expect(contractProblem(old, null, null)?.text).toContain("Description is 202 characters; the limit is 200 (2 over).")
    expect(contractProblem({ ...old, notes: "corrected" } as CollectionActivity, old, "Fixing.")).toBeNull()
    const withdrawn = { ...old, state: "withdrawn", withdrawalReason: "Entered twice." } as CollectionActivity
    expect(contractProblem(withdrawn, old, correctionReasonFor(withdrawn, true, ""))).toBeNull()
    const edited = spendWith("\u0958".repeat(101) + "!")
    expect(contractProblem(edited, old, "Fixing.")?.text).toContain("Description is 203 characters; the limit is 200 (3 over).")
  })
})
