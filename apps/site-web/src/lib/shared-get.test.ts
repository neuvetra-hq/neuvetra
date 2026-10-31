// Round 3 lane C (PR-3; Claude, 31 October 2026): the screens a Fix round trip opens read the same resources at once
// (journey status, the Activity screen, company setup). Identical GETs of one signed-in user share one request while it
// runs and for two seconds after; any write by that user clears the shared answers. A GET answered 429 is retried once
// after the server's Retry-After (at most 5 s), so a burst of Fix clicks does not end on an error page.
import { afterEach, describe, expect, test } from "bun:test"
import { clearSharedGets, configureSharedGets, sharedFetch } from "./shared-get"

const original = globalThis.fetch
afterEach(() => { globalThis.fetch = original; clearSharedGets(); configureSharedGets({ ttlMs: 0 }) })
const actor = { userId: "u1", accessToken: "t" }

describe("shared GETs and the 429 retry", () => {
  test("identical GETs at once and (as the app configures it) within two seconds are one request; each caller gets its own body", async () => {
    configureSharedGets({ ttlMs: 2_000 })
    let calls = 0
    globalThis.fetch = (async () => { calls++; await new Promise(r => setTimeout(r, 5)); return Response.json({ n: calls }) }) as unknown as typeof fetch
    const [a, b] = await Promise.all([sharedFetch(actor, "/workspace-api/x", { method: "GET" }), sharedFetch(actor, "/workspace-api/x", { method: "GET" })])
    expect(await a.json()).toEqual({ n: 1 }); expect(await b.json()).toEqual({ n: 1 })
    expect(await (await sharedFetch(actor, "/workspace-api/x", { method: "GET" })).json()).toEqual({ n: 1 })
    expect(calls).toBe(1)
    // Another user, or another path, is its own request.
    await sharedFetch({ ...actor, userId: "u2" }, "/workspace-api/x", { method: "GET" }); await sharedFetch(actor, "/workspace-api/y", { method: "GET" })
    expect(calls).toBe(3)
  })
  test("a write clears the shared answers (the next GET reads again); failed answers are never shared", async () => {
    configureSharedGets({ ttlMs: 2_000 })
    let calls = 0
    globalThis.fetch = (async (_: unknown, init?: RequestInit) => { calls++; return init?.method === "POST" ? Response.json({}, { status: 201 }) : calls === 1 ? Response.json({ error: "down" }, { status: 503 }) : Response.json({ n: calls }) }) as unknown as typeof fetch
    expect((await sharedFetch(actor, "/workspace-api/x", { method: "GET" })).status).toBe(503)
    expect(await (await sharedFetch(actor, "/workspace-api/x", { method: "GET" })).json()).toEqual({ n: 2 })
    await sharedFetch(actor, "/workspace-api/x", { method: "POST", body: "{}" })
    expect(await (await sharedFetch(actor, "/workspace-api/x", { method: "GET" })).json()).toEqual({ n: 4 })
  })
  test("a GET answered 429 is retried once after Retry-After; a write is never retried", async () => {
    const seen: string[] = []
    globalThis.fetch = (async (_: unknown, init?: RequestInit) => { seen.push(init?.method ?? "GET"); return seen.length === 1 || init?.method === "POST" ? new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers: { "retry-after": "0" } }) : Response.json({ ok: true }) }) as unknown as typeof fetch
    expect((await sharedFetch(actor, "/workspace-api/x", { method: "GET" })).status).toBe(200)
    expect(seen).toEqual(["GET", "GET"])
    expect((await sharedFetch(actor, "/workspace-api/x", { method: "POST", body: "{}" })).status).toBe(429)
    expect(seen).toEqual(["GET", "GET", "POST"])
  })
  test("by default (tests, other hosts) a finished GET is not reused: only requests running at once are shared", async () => {
    let calls = 0
    globalThis.fetch = (async () => { calls++; await new Promise(r => setTimeout(r, 5)); return Response.json({ n: calls }) }) as unknown as typeof fetch
    await Promise.all([sharedFetch(actor, "/workspace-api/x", { method: "GET" }), sharedFetch(actor, "/workspace-api/x", { method: "GET" })])
    expect(calls).toBe(1)
    expect(await (await sharedFetch(actor, "/workspace-api/x", { method: "GET" })).json()).toEqual({ n: 2 })
  })
})
