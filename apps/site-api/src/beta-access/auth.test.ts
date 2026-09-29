import { describe, expect, test } from "bun:test"
import { validateBetaIdentity } from "./auth"

function client(user: Record<string, unknown> | null, error: unknown = null) {
  return { auth: { getUser: async () => ({ data: { user }, error }) } } as never
}

describe("beta access identity adapter", () => {
  test("accepts only a current getUser subject with confirmed email", async () => {
    await expect(validateBetaIdentity("synthetic", client({ id: "10000000-0000-4000-8000-000000000001", email: "a@beta.invalid", email_confirmed_at: "2026-09-25T00:00:00Z" }))).resolves.toEqual({ id: "10000000-0000-4000-8000-000000000001", email: "a@beta.invalid" })
    await expect(validateBetaIdentity("synthetic", client({ id: "10000000-0000-4000-8000-000000000001", email: "a@beta.invalid", email_confirmed_at: null }))).resolves.toBeNull()
    await expect(validateBetaIdentity("synthetic", client({ id: "10000000-0000-4000-8000-000000000001", email: "a@beta.invalid", email_confirmed_at: "2026-09-25T00:00:00Z", banned_until: "2999-01-01T00:00:00Z" }))).resolves.toBeNull()
    await expect(validateBetaIdentity("synthetic", client(null, new Error("provider")))).resolves.toBeNull()
  })
})
