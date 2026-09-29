import { describe, expect, test } from "bun:test"
import { BETA_ACCESS_PROFILE } from "../../../../packages/neuvetra-database/src/beta-access-contract"
import { createBetaAccessServer, createBetaRateLimiter } from "./server"

const identity = { id: "10000000-0000-4000-8000-000000000001", email: "owner@beta.invalid" }
const config = { profile: BETA_ACCESS_PROFILE, origin: "http://127.0.0.1:3080", databaseUrl: "postgres://unused", databaseName: "m80_beta_access_unit000001", runtimeRole: "m80_beta_access_runtime_unit000001", port: 3080 } as const

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://127.0.0.1${path}`, { ...init, headers: { origin: config.origin, authorization: "Bearer synthetic", ...(init.headers ?? {}) } })
}

describe("beta access server boundary", () => {
  test("bounds buckets and reclaims only expired capacity", () => {
    let now = 0
    const rate = createBetaRateLimiter(2, 1000, 2, () => now)
    expect(rate.check("a")).toBeTrue(); expect(rate.check("b")).toBeTrue(); expect(rate.check("c")).toBeFalse()
    expect(rate.check("a")).toBeTrue(); expect(rate.check("a")).toBeFalse()
    now = 1000
    expect(rate.check("c")).toBeTrue()
  })

  test("rejects origin, duplicate keys and oversized streamed bodies without logging authority", async () => {
    const logs: unknown[] = []
    const database = {
      checkReadiness: async () => ({ profile: BETA_ACCESS_PROFILE, schemaVersion: 1 }), close: async () => {},
      redeem: async () => { throw new Error("must not reach") }, readSession: async () => [], readWorkspace: async () => null,
    }
    const app = await createBetaAccessServer(config, { database: database as never, validateIdentity: async () => identity, log: event => logs.push(event) })
    try {
      const forbidden = request("/beta-api/session"); forbidden.headers.set("origin", "http://evil.invalid")
      expect((await app.fetch(forbidden)).status).toBe(403)
      const duplicate = JSON.stringify({ token: "a".repeat(64), requestId: crypto.randomUUID() }).replace("}", `,"token":"${"b".repeat(64)}"}`)
      expect((await app.fetch(request("/beta-api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: duplicate }))).status).toBe(422)
      const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1025)); controller.enqueue(new Uint8Array(1025)); controller.close() } })
      const oversized = await app.fetch(request("/beta-api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit))
      expect(oversized.status).toBe(413); expect(oversized.headers.get("connection")).toBe("close")
      expect(JSON.stringify(logs)).not.toContain("a".repeat(64)); expect(JSON.stringify(logs)).not.toContain(identity.email)
    } finally { await app.close() }
  })

  test("uses explicit HTTP denial classes and response security headers", async () => {
    const database = { checkReadiness: async () => ({ profile: BETA_ACCESS_PROFILE, schemaVersion: 1 }), close: async () => {}, redeem: async () => { throw new Error("must not reach") }, readSession: async () => [], readWorkspace: async () => null }
    const app = await createBetaAccessServer(config, { database: database as never, validateIdentity: async token => token === "timeout" ? Promise.reject(new Error("timeout")) : token === "invalid" ? null : identity, log: () => {} })
    try {
      expect((await app.fetch(new Request("http://127.0.0.1/beta-api/session", { headers: { origin: config.origin } }))).status).toBe(401)
      expect((await app.fetch(new Request("http://127.0.0.1/beta-api/session", { headers: { origin: config.origin, authorization: "Bearer invalid" } }))).status).toBe(401)
      expect((await app.fetch(new Request("http://127.0.0.1/beta-api/session", { headers: { origin: config.origin, authorization: "Bearer timeout" } }))).status).toBe(503)
      expect((await app.fetch(request("/beta-api/session", { method: "POST" }))).status).toBe(405)
      expect((await app.fetch(request("/beta-api/invitations/redeem", { method: "POST", body: "{}" }))).status).toBe(415)
      const extra = JSON.stringify({ token: "a".repeat(64), requestId: crypto.randomUUID(), actor: identity.id })
      expect((await app.fetch(request("/beta-api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: extra }))).status).toBe(422)
      expect((await app.fetch(request("/beta-api/nope"))).status).toBe(404)
      const response = await app.fetch(request("/beta-api/session"))
      expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store"); expect(response.headers.get("x-frame-options")).toBe("DENY")
    } finally { await app.close() }
  })
})
