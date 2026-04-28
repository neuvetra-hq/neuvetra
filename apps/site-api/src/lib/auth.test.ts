import { describe, expect, mock, test } from "bun:test"
import { extractBearerToken, validateUserFromToken } from "./auth"
import type { SupabaseClient } from "@supabase/supabase-js"

describe("extractBearerToken()", () => {
  test("returns the token when Authorization header is present and well-formed", () => {
    const headers = new Headers({ authorization: "Bearer abc.def.ghi" })
    expect(extractBearerToken(headers)).toBe("abc.def.ghi")
  })

  test("returns null when Authorization header is absent", () => {
    expect(extractBearerToken(new Headers({}))).toBeNull()
  })

  test("returns null when Authorization header is malformed (no Bearer prefix)", () => {
    const headers = new Headers({ authorization: "Basic dXNlcjpwYXNz" })
    expect(extractBearerToken(headers)).toBeNull()
  })

  test("trims whitespace and accepts case-insensitive Bearer prefix", () => {
    const headers = new Headers({ authorization: "  bearer   abc.def.ghi  " })
    expect(extractBearerToken(headers)).toBe("abc.def.ghi")
  })

  test("returns null when Bearer prefix is present but the token is empty", () => {
    const headers = new Headers({ authorization: "Bearer  " })
    expect(extractBearerToken(headers)).toBeNull()
  })
})

describe("validateUserFromToken()", () => {
  /**
   * Builds a minimal SupabaseClient stand-in with just enough surface for
   * `validateUserFromToken` — only `auth.getUser` is consulted.
   */
  function buildMockClient(
    getUserImpl: (token: string) => Promise<{
      data: { user: any | null }
      error: { message: string } | null
    }>,
  ): SupabaseClient {
    return {
      auth: { getUser: mock(getUserImpl) },
    } as unknown as SupabaseClient
  }

  test("returns a user object on success, projecting Supabase shape onto AuthenticatedUser", async () => {
    const client = buildMockClient(async () => ({
      data: {
        user: {
          id: "u_123",
          phone: "+15551234567",
          email: "alice@example.com",
          user_metadata: { full_name: "Alice" },
        },
      },
      error: null,
    }))

    const user = await validateUserFromToken("valid.jwt", client)

    expect(user).toEqual({
      id: "u_123",
      phone: "+15551234567",
      email: "alice@example.com",
      fullName: "Alice",
    })
  })

  test("returns null when Supabase reports an error (invalid / expired token)", async () => {
    const client = buildMockClient(async () => ({
      data: { user: null },
      error: { message: "JWT expired" },
    }))

    const user = await validateUserFromToken("expired.jwt", client)

    expect(user).toBeNull()
  })

  test("returns null when Supabase returns no user even without an explicit error", async () => {
    const client = buildMockClient(async () => ({
      data: { user: null },
      error: null,
    }))

    const user = await validateUserFromToken("unknown.jwt", client)

    expect(user).toBeNull()
  })

  test("nulls out missing optional fields rather than passing through undefined", async () => {
    const client = buildMockClient(async () => ({
      data: {
        user: {
          id: "u_456",
          // No phone, no email, no user_metadata
        },
      },
      error: null,
    }))

    const user = await validateUserFromToken("valid.jwt", client)

    expect(user).toEqual({
      id: "u_456",
      phone: null,
      email: null,
      fullName: null,
    })
  })

  test("passes the token through to supabase.auth.getUser verbatim", async () => {
    const getUserImpl = mock(async () => ({ data: { user: null }, error: null }))
    const client = { auth: { getUser: getUserImpl } } as unknown as SupabaseClient

    await validateUserFromToken("the-exact-token", client)

    expect(getUserImpl).toHaveBeenCalledWith("the-exact-token")
  })
})
