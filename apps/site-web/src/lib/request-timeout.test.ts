// WO-09 (P0-08, QA-280; Claude, 11 November 2026): client timeouts, the slow mark and the busy text. The limits are
// shortened here (configureRequestTimeouts); their production values are pinned in the first test.
import { afterEach, describe, expect, test } from "bun:test"
import { configureRequestTimeouts, isRequestTimeout, REQUEST_TIMEOUT_TEXT, requestTimeoutMs, RequestTimeoutError, SERVER_BUSY_TEXT, SLOW_REQUEST_TEXT, serverErrorText, slowRequestCount, subscribeRequestEvents, withRequestTimeout, type RequestEvent } from "./request-timeout"
import { CollectionApiError, downloadCollectionEvidence, listCollectionActivities, saveCollectionActivity, uploadCollectionEvidence } from "./collection-api"
import { loadScope3Results, Scope3ResultsApiError } from "./scope3-results-api"
import { loadResults, ResultsApiError } from "./results-api"
import { loadScope3Reports, prepareScope3Report, Scope3ReportApiError } from "./scope3-report-api"
import { clearSharedGets } from "./shared-get"

const original = globalThis.fetch
afterEach(() => { globalThis.fetch = original; configureRequestTimeouts(); clearSharedGets() })
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
/** A fetch that never answers; it only ends when its signal aborts (as a real one does). */
const hang = (_: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
  init?.signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")), { once: true })
})
const company = "00000000-0000-4000-8000-000000000001", record = "00000000-0000-4000-8000-000000000002", upload = "00000000-0000-4000-8000-000000000003"
const actor = { accessToken: "t", userId: "00000000-0000-4000-8000-0000000000aa", role: "owner" as const }

describe("limits and texts", () => {
  test("design §6 P0-08: 35 s by default, 60 s for Scope 1 and 2 results (BI-01b), 95 s for Scope 3 results, 125 s for report prepare and uploads; slow at 8 s", async () => {
    expect([requestTimeoutMs("default"), requestTimeoutMs("results"), requestTimeoutMs("scope3Results"), requestTimeoutMs("reportPrepare"), requestTimeoutMs("upload")]).toEqual([35_000, 60_000, 95_000, 125_000, 125_000])
    expect(SLOW_REQUEST_TEXT).toBe("Taking longer than usual…")
    expect(REQUEST_TIMEOUT_TEXT).toBe("Neuvetra didn't answer in time. Nothing was lost — Try again.")
    expect(SERVER_BUSY_TEXT).toBe("Neuvetra is busy — try again in a moment.")
    // The slow mark is 8 s: a request still running at 7.9 s isn't slow (checked with a scaled run below).
    configureRequestTimeouts({ default: 1_000 })
    const events: RequestEvent[] = []
    const stop = subscribeRequestEvents(event => events.push(event))
    await withRequestTimeout("default", undefined, async () => { await sleep(20); return 1 })
    stop()
    expect(events).toEqual([{ type: "settled", kind: "default", wasSlow: false, timedOut: false }])
  })
  test("a 503 without a specific code reads busy; capability and specific busy codes keep the server's words", () => {
    expect(serverErrorText(503, null, "Read failed")).toBe(SERVER_BUSY_TEXT)
    expect(serverErrorText(503, "something_new", "x")).toBe(SERVER_BUSY_TEXT)
    for (const code of ["collection_unavailable", "scope3_unavailable", "scope3_schema_30_required", "company_busy", "write_timed_out", "report_prepare_busy"]) expect(serverErrorText(503, code, "server words")).toBe("server words")
    expect(serverErrorText(500, null, "server words")).toBe("server words")
  })
})

describe("withRequestTimeout", () => {
  test("QA-280: a request that never answers is reported slow, then aborted at its limit with the Try again text", async () => {
    configureRequestTimeouts({ default: 60, slowAfterMs: 15 })
    const events: RequestEvent[] = []
    const stop = subscribeRequestEvents(event => events.push(event))
    let seen: AbortSignal | undefined
    const run = withRequestTimeout("default", undefined, signal => { seen = signal; return hang(null, { signal }) })
    await sleep(30)
    expect(slowRequestCount()).toBe(1)
    const error = await run.catch(cause => cause)
    stop()
    expect(error).toBeInstanceOf(RequestTimeoutError)
    expect(error.message).toBe(REQUEST_TIMEOUT_TEXT)
    expect(seen?.aborted).toBe(true)
    expect(slowRequestCount()).toBe(0)
    expect(events).toEqual([{ type: "slow", kind: "default" }, { type: "settled", kind: "default", wasSlow: true, timedOut: true }])
  })
  test("a slow answer before the limit succeeds and the slow mark clears (the 20 s case, scaled)", async () => {
    configureRequestTimeouts({ default: 200, slowAfterMs: 10 })
    const run = withRequestTimeout("default", undefined, async () => { await sleep(40); return "ok" })
    await sleep(20)
    expect(slowRequestCount()).toBe(1)
    expect(await run).toBe("ok")
    expect(slowRequestCount()).toBe(0)
  })
  test("the limit holds even if the work ignores its signal; overlapping slow requests are counted, not repeated", async () => {
    configureRequestTimeouts({ default: 40, slowAfterMs: 5 })
    const slowEvents: RequestEvent[] = []
    const stop = subscribeRequestEvents(event => { if (event.type === "slow") slowEvents.push(event) })
    const deaf = () => new Promise<never>(() => {})
    const both = Promise.allSettled([withRequestTimeout("default", undefined, deaf), withRequestTimeout("default", undefined, deaf)])
    await sleep(20)
    expect(slowRequestCount()).toBe(2)
    const results = await both
    stop()
    expect(results.every(result => result.status === "rejected" && isRequestTimeout(result.reason))).toBe(true)
    expect(slowEvents).toHaveLength(2)
    expect(slowRequestCount()).toBe(0)
  })
  test("the caller's own abort still rejects with the caller's reason, not a timeout", async () => {
    configureRequestTimeouts({ default: 1_000 })
    const controller = new AbortController()
    const run = withRequestTimeout("default", controller.signal, signal => hang(null, { signal }))
    controller.abort(new DOMException("left the screen", "AbortError"))
    const error = await run.catch(cause => cause)
    expect(isRequestTimeout(error)).toBe(false)
    expect(error.name).toBe("AbortError")
  })
})

describe("the request paths", () => {
  test("acceptance: save, time out, retry → the server sees the same idempotencyKey and records exactly one version", async () => {
    configureRequestTimeouts({ default: 40, slowAfterMs: 10 })
    // The server records the first save but its answer never arrives; the retry is answered as a replay.
    const versions = new Map<string, { id: string; revision: number }>()
    const keys: string[] = []
    let calls = 0
    globalThis.fetch = (async (_: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      keys.push(body.idempotencyKey)
      const replayed = versions.has(body.idempotencyKey)
      if (!replayed) versions.set(body.idempotencyKey, { id: crypto.randomUUID(), revision: versions.size + 1 })
      if (++calls === 1) return hang(null, init)
      return Response.json({ record: { id: record }, version: versions.get(body.idempotencyKey), replayed })
    }) as unknown as typeof fetch
    const input = { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity: {} } as unknown as Parameters<typeof saveCollectionActivity>[2]
    const first = await saveCollectionActivity(company, record, input, actor).catch(cause => cause)
    expect(isRequestTimeout(first)).toBe(true)
    expect(first.message).toBe(REQUEST_TIMEOUT_TEXT)
    const retry = await saveCollectionActivity(company, record, input, actor)
    expect(keys).toEqual([input.idempotencyKey, input.idempotencyKey])
    expect(versions.size).toBe(1)
    expect(retry.replayed).toBe(true)
  })
  test("a hung shared GET is aborted at its limit and does not hold later readers", async () => {
    configureRequestTimeouts({ default: 30, slowAfterMs: 10 })
    let calls = 0
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => ++calls === 1 ? hang(input, init) : Response.json({ profile: "p", records: [] })) as unknown as typeof fetch
    expect(isRequestTimeout(await listCollectionActivities(company, actor).catch(cause => cause))).toBe(true)
    expect(await listCollectionActivities(company, actor)).toEqual([])
    expect(calls).toBe(2)
  })
  test("each kind uses its own limit: uploads, Scope 3 results and report prepare", async () => {
    configureRequestTimeouts({ default: 10_000, upload: 20, scope3Results: 20, reportPrepare: 20 })
    globalThis.fetch = hang as unknown as typeof fetch
    const file = new File(["a,b\n"], "bill.csv", { type: "text/csv" })
    const uploaded = await uploadCollectionEvidence(company, file, upload, actor).catch(cause => cause)
    expect(uploaded).toBeInstanceOf(RequestTimeoutError); expect(uploaded.kind).toBe("upload")
    const results = await loadScope3Results(company, actor).catch(cause => cause)
    expect(results).toBeInstanceOf(RequestTimeoutError); expect(results.kind).toBe("scope3Results")
    const prepared = await prepareScope3Report(company, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }, actor).catch(cause => cause)
    expect(prepared).toBeInstanceOf(RequestTimeoutError); expect(prepared.kind).toBe("reportPrepare")
  })
  test("an injected 503 shows the busy text on every path; status and code are kept", async () => {
    globalThis.fetch = (async () => Response.json({ error: "Read failed" }, { status: 503 })) as unknown as typeof fetch
    const collection = await listCollectionActivities(company, actor).catch(cause => cause)
    expect(collection).toBeInstanceOf(CollectionApiError); expect(collection.message).toBe(SERVER_BUSY_TEXT); expect(collection.status).toBe(503)
    const results = await loadScope3Results(company, actor).catch(cause => cause)
    expect(results).toBeInstanceOf(Scope3ResultsApiError); expect(results.message).toBe(SERVER_BUSY_TEXT)
    const reports = await loadScope3Reports(company, actor).catch(cause => cause)
    expect(reports).toBeInstanceOf(Scope3ReportApiError); expect(reports.message).toBe(SERVER_BUSY_TEXT)
    // A proxy's 503 page (no JSON) reads busy as well.
    globalThis.fetch = (async () => new Response("<html>Service Unavailable</html>", { status: 503 })) as unknown as typeof fetch
    expect((await loadScope3Reports(company, actor).catch(cause => cause)).message).toBe(SERVER_BUSY_TEXT)
  })
  test("QA follow-up: evidence download keeps the server's uncoded 503 integrity message; other collection calls still read busy", async () => {
    globalThis.fetch = (async () => Response.json({ error: "Evidence integrity could not be verified." }, { status: 503 })) as unknown as typeof fetch
    const download = await downloadCollectionEvidence(company, upload, actor).catch(cause => cause)
    expect(download).toBeInstanceOf(CollectionApiError); expect(download.status).toBe(503)
    expect(download.message).toBe("Evidence integrity could not be verified.")
    expect((await listCollectionActivities(company, actor).catch(cause => cause)).message).toBe(SERVER_BUSY_TEXT)
  })
  test("control: a 503 that means 'not switched on' keeps its code and words, so the screens still tell it apart", async () => {
    globalThis.fetch = (async () => Response.json({ code: "scope3_schema_30_required", error: "This Scope 3 feature needs database schema 30." }, { status: 503 })) as unknown as typeof fetch
    const reports = await loadScope3Reports(company, actor).catch(cause => cause)
    expect(reports.unavailable).toBe(true); expect(reports.message).toBe("This Scope 3 feature needs database schema 30.")
    globalThis.fetch = (async () => Response.json({ code: "scope3_unavailable", error: "Scope 3 results are not available yet." }, { status: 503 })) as unknown as typeof fetch
    const results = await loadScope3Results(company, actor).catch(cause => cause)
    expect(results.code).toBe("scope3_unavailable"); expect(results.message).toBe("Scope 3 results are not available yet.")
  })
})

describe("BI-01b: Scope 1 and 2 results have their own limit", () => {
  test("a results request is stopped at the results limit, not the default one, and its error offers Try again", async () => {
    // Before BI-01b this request had no limit: a server that never answered left Results loading forever.
    configureRequestTimeouts({ default: 20, results: 120, slowAfterMs: 1_000 })
    let seen: AbortSignal | undefined
    globalThis.fetch = (async (_: unknown, init?: RequestInit) => { seen = init?.signal ?? undefined; return hang(_, init) }) as typeof fetch
    const started = performance.now()
    const error = await loadResults(company, actor).catch(cause => cause)
    expect(error).toBeInstanceOf(RequestTimeoutError)
    expect((error as RequestTimeoutError).kind).toBe("results")
    expect(error.message).toBe(REQUEST_TIMEOUT_TEXT)
    expect(performance.now() - started).toBeGreaterThanOrEqual(100)  // well past the 20 ms default
    expect(seen?.aborted).toBe(true)
  })
  test("an answer after the default limit but inside the results limit is used; a server error keeps its words", async () => {
    configureRequestTimeouts({ default: 20, results: 400, slowAfterMs: 1_000 })
    globalThis.fetch = (async () => { await sleep(60); return Response.json({ error: "Results could not be prepared. Try again shortly.", code: "results_engine_unavailable" }, { status: 503 }) }) as unknown as typeof fetch
    const error = await loadResults(company, actor).catch(cause => cause)
    expect(error).toBeInstanceOf(ResultsApiError)
    expect([error.message, error.status]).toEqual(["Results could not be prepared. Try again shortly.", 503])
  })
  test("only the results request uses the results kind; Scope 3 results keep theirs", async () => {
    const kinds: string[] = []
    const stop = subscribeRequestEvents(event => { if (event.type === "settled") kinds.push(event.kind) })
    globalThis.fetch = (async () => Response.json({ error: "x" }, { status: 500 })) as unknown as typeof fetch
    await loadResults(company, actor).catch(() => null)
    await loadScope3Results(company, actor).catch(() => null)
    stop()
    expect(kinds).toEqual(["results", "scope3Results"])
  })
})
