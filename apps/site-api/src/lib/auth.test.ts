import { describe, expect, mock, test } from "bun:test"
import { extractBearerToken, isPlausibleUnexpiredJwt, validateUserFromToken } from "./auth"
import { AuthApiError, AuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js"

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

// BF1: supabase-js returns (does not throw) network, timeout, 5xx and 429 failures. Staging asks for those to throw so the
// server answers 503 and the browser keeps its session and drafts, instead of reading an outage as "signed out" (401).
describe("validateUserFromToken() when the auth provider is unavailable (BF1)", () => {
  const client = (error: unknown) => ({ auth: { getUser: async () => ({ data: { user: null }, error }) } }) as unknown as SupabaseClient
  const outages = [new AuthRetryableFetchError("fetch failed", 0), new AuthApiError("upstream", 503, "unexpected_failure"), new AuthApiError("rate limited", 429, "over_request_rate_limit")]
  test("throws on an outage when asked, so staging can answer 503", async () => {
    for (const error of outages) await expect(validateUserFromToken("token", client(error), { throwWhenUnavailable: true })).rejects.toThrow("Authentication provider unavailable.")
  })
  test("a token the provider rejects is still signed out, and the default (legacy chat) behaviour is unchanged", async () => {
    expect(await validateUserFromToken("token", client(new AuthApiError("invalid JWT", 403, "bad_jwt")), { throwWhenUnavailable: true })).toBeNull()
    for (const error of outages) expect(await validateUserFromToken("token", client(error))).toBeNull()
  })
})

describe("isPlausibleUnexpiredJwt() (API-02 pre-check; no signature verification)", () => {
  const segment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
  const header = segment({ alg: "HS256", typ: "JWT" })
  const now = 1_800_000_000_000
  const token = (payload: unknown) => `${header}.${segment(payload)}.signature_-part`

  test("passes a three-segment token with JSON header and payload and a future, near-past or absent exp", () => {
    expect(isPlausibleUnexpiredJwt(token({ exp: now / 1000 + 3600 }), now)).toBe(true)
    expect(isPlausibleUnexpiredJwt(token({ exp: now / 1000 - 59 }), now)).toBe(true)
    expect(isPlausibleUnexpiredJwt(token({ sub: "x" }), now)).toBe(true)
  })

  test("refuses an exp further in the past than the clock skew, or a non-numeric exp", () => {
    expect(isPlausibleUnexpiredJwt(token({ exp: now / 1000 - 61 }), now)).toBe(false)
    expect(isPlausibleUnexpiredJwt(token({ exp: now / 1000 - 30 }), now, 10)).toBe(false)
    for (const exp of ["9999999999", null, true, {}]) expect(isPlausibleUnexpiredJwt(token({ exp }), now)).toBe(false)
  })

  test("refuses anything that is not structurally a JWT", () => {
    const bad = [
      "", "random", "a.b", "a.b.c", "a.b.c.d", `${header}.${segment({})}`, `${header}.${segment({})}.`, `.${segment({})}.sig`,
      `${header}.${segment({})}.sig=`, `${header}.${segment({})}.si+g`, `${header}.${segment([1, 2])}.sig`, `${header}.${segment("text")}.sig`,
      `${segment(null)}.${segment({})}.sig`, `${Buffer.from("{not json").toString("base64url")}.${segment({})}.sig`,
      `${header}.${Buffer.from([0xff, 0xfe, 0x7b, 0x7d]).toString("base64url")}.sig`, `${header}.${segment({}).slice(0, 1)}.sig`,
    ]
    for (const value of bad) expect([value, isPlausibleUnexpiredJwt(value, now)]).toEqual([value, false])
  })
})
