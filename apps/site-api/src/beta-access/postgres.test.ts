import { describe, expect, test } from "bun:test"
import { runLocalBetaAccessRehearsal } from "../../../../tools/beta-access/local-rehearsal"

const enabled = process.env.M80_BETA_ACCESS_NATIVE === "enabled"

describe("M80 beta access native PostgreSQL", () => {
  test.skipIf(!enabled)("exercises real HTTP, restricted SQL, revocation and restored state", async () => {
    const result = await runLocalBetaAccessRehearsal()
    expect(result.assertions).toBeGreaterThanOrEqual(15)
    expect(result.identityProvider).toBe("mocked_getUser_response")
    expect(result.database).toBe("native_restricted_postgresql")
  }, 120_000)
})
