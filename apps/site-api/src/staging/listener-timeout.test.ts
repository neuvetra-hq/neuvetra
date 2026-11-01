// Round 2c integration (Claude, 31 October 2026; DESIGN 13.8). The staged listener closes a connection that stays idle for
// 30 seconds (Bun.serve `idleTimeout`), and a request whose response has not started counts as idle. Preparing a Scope 3
// report at the line cap took 38 s natively, so the browser saw a reset connection while the server went on to store the
// version. The prepare route alone got a longer per-request limit; every other request keeps the listener's.
// Round 3 (EN-7, lane B): the listener no longer grants that limit by path before authentication. It hands the server an
// `extendTimeout` capability, and the server uses it only after the bearer token named a user with staging access and the
// route matched (server.test.ts checks the server's side); an unauthenticated request keeps the 30 s.
import { describe, expect, test } from "bun:test"
import { SCOPE3_REPORT_PREPARE_TIMEOUT_SECONDS, SCOPE3_RESULTS_TIMEOUT_SECONDS, stagingListenerFetch, type StagingFetchOptions } from "./server"

const company = "93990000-0000-4000-8000-000000000001"
/**
 * A listener with a 1-second idle timeout, as the staged server's own wrapper wires it, whose handler answers after `ms`.
 * The handler stands in for the server: it extends the limit only for an authenticated request (bearer "ok").
 */
async function slowListener(ms: number) {
  const app = { fetch: async (request: Request, options?: StagingFetchOptions) => {
    if (request.headers.get("authorization") === "Bearer ok") options?.extendTimeout?.(SCOPE3_REPORT_PREPARE_TIMEOUT_SECONDS)
    await Bun.sleep(ms)
    return new Response("stored")
  } }
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 1, fetch: stagingListenerFetch(app) })
  // An empty body: Bun (1.3/1.4) never applies the idle limit to a request whose body had bytes, so only an empty body shows
  // the limit (probe in the round-3 lane-B log).
  const call = (path: string, method = "POST", token?: string) => fetch(`http://127.0.0.1:${server.port}${path}`, { method, body: method === "POST" ? "" : undefined, headers: token ? { authorization: `Bearer ${token}` } : {} })
    .then(async response => ({ status: response.status, body: await response.text() }), (error: unknown) => ({ status: 0, body: String(error) }))
  return { call, stop: () => server.stop(true) }
}

describe("the staged listener's per-request time limit (round 2c; round 3 EN-7)", () => {
  test("only a request the server extends after authentication outlives the idle timeout; an unauthenticated prepare does not", async () => {
    // Bun checks idle sockets every few seconds (about 4 s granularity), so a 1-second limit closes an unanswered request
    // within about 8 s; this handler answers after 9 s.
    const listener = await slowListener(9000)
    try {
      const path = `/workspace-api/workspace/${company}/scope3/reports`
      const [authenticated, anonymous, read] = await Promise.all([listener.call(path, "POST", "ok"), listener.call(path, "POST"), listener.call(path, "GET")])
      expect(authenticated).toEqual({ status: 200, body: "stored" })
      // Round 2c granted the longer limit to this path before authentication (this request would have answered 200).
      expect([anonymous.status, read.status]).toEqual([0, 0])
      // Bun reports a reset differently on Windows. Both requests must fail at the socket, never return a response.
      for (const response of [anonymous, read]) expect(response.body).toMatch(/ECONNRESET|The socket connection was closed unexpectedly/)
    } finally { listener.stop() }
  }, 30_000)

  test("the limits cover the measured times at the cap with room to spare, inside Bun's maximum, and the listener uses the wrapper", async () => {
    // Measured natively: prepare at the cap 30-40 s; one results run about 10 s (two at once about 20 s).
    expect(SCOPE3_REPORT_PREPARE_TIMEOUT_SECONDS).toBe(120)
    expect(SCOPE3_RESULTS_TIMEOUT_SECONDS).toBe(90)
    expect(Math.max(SCOPE3_REPORT_PREPARE_TIMEOUT_SECONDS, SCOPE3_RESULTS_TIMEOUT_SECONDS)).toBeLessThanOrEqual(255)
    const source = await Bun.file(new URL("./server.ts", import.meta.url)).text()
    expect(source).toContain("idleTimeout: 30, fetch: stagingListenerFetch(app)")
  })
})
