/* eslint-disable @typescript-eslint/no-explicit-any */
// WO-09 (P0-08, QA-280; Claude, 11 November 2026). The Activity editor's save, driven through the real collection API
// with a server whose first answer never arrives: the timeout keeps the pending request (CollectionWorkspace `pending`),
// so the retry sends the same idempotency key and the server records one version. And the "Taking longer" notice.
import { afterEach, expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionSaveInput, withCurrentSetupVersion } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { reasonText } from "@/lib/plain-language"
import { CollectionApiError, saveCollectionActivity } from "@/lib/collection-api"
import { configureRequestTimeouts, REQUEST_TIMEOUT_TEXT, SLOW_REQUEST_TEXT, slowRequestCount, subscribeRequestEvents, withRequestTimeout } from "@/lib/request-timeout"
import { clearSharedGets } from "@/lib/shared-get"
import { harness, loadComponent } from "./component-harness"

const original = globalThis.fetch
afterEach(() => { globalThis.fetch = original; configureRequestTimeouts(); clearSharedGets() })
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const W = "29300000-0000-4000-8000-000000000001", A = "29300000-0000-4000-8000-0000000000aa", SITE = "29300000-0000-4000-8000-0000000000bb"
const context = { companyId: W, setupVersionId: A, setupRevision: 1, sameContentSetupVersionIds: [A], locations: [{ id: SITE, name: "Depot", inclusion: "included", control: "reporting_company" }] }

/** A server that stores each new idempotency key as one version and replays a key it has seen. */
function server(firstAnswerNeverArrives: boolean) {
  const versions = new Map<string, any>(), keys: string[] = []
  let posts = 0
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    if ((init?.method ?? "GET") !== "POST" || !/\/activities\/[0-9a-f-]+$/.test(url)) return Response.json({ error: "unexpected" }, { status: 404 })
    const body = JSON.parse(String(init?.body))
    validateCollectionSaveInput(body)
    keys.push(body.idempotencyKey)
    const recordId = url.split("/").pop()!
    const replayed = versions.has(body.idempotencyKey)
    if (!replayed) versions.set(body.idempotencyKey, { id: crypto.randomUUID(), recordId, companyId: W, revision: versions.size + 1, activity: body.activity })
    if (++posts === 1 && firstAnswerNeverArrives) return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }))
    const version = versions.get(body.idempotencyKey)
    const record = { id: recordId, companyId: W, currentVersion: version, history: [...versions.values()].map(item => ({ id: item.id, revision: item.revision })) }
    return Response.json({ record, version, replayed })
  }) as unknown as typeof fetch
  return { versions, keys }
}

async function editor() {
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion,
    listCollectionActivities: async () => [], listCollectionEvidence: async () => [], listGridLossLineages: async () => [],
    loadCollectionContext: async () => context,
    // The real request path: sharedFetch, the timeout and the error mapping.
    saveCollectionActivity,
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null, uploadCollectionEvidence: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0,
  })
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId: null, intro: null }))
  await app.settle()
  app.button("Road vehicle or vehicle group")!.props.onClick(); await app.settle()
  for (const [label, value] of [["Company-setup location", SITE], ["Vehicle or group ID", "VAN-WO09"], ["Fuel", "gasoline"], ["Vehicle type", "gasoline_passenger_car"]]) { app.byLabel(label)!.props.onChange(value); await app.settle() }
  return app
}

test("acceptance: save, time out, then retry produces exactly one new version — the server sees the same idempotencyKey", async () => {
  configureRequestTimeouts({ default: 60, slowAfterMs: 20 })
  const { versions, keys } = server(true)
  const app = await editor()
  app.button("Save activity")!.props.onClick()
  await sleep(35)
  expect(slowRequestCount()).toBe(1)
  await sleep(60); await app.settle()
  expect(app.text()).toContain(REQUEST_TIMEOUT_TEXT)
  expect(app.text()).toContain("Retry keeps the same save request.")
  expect(slowRequestCount()).toBe(0)
  // The server did record the first attempt; only its answer was lost.
  expect(versions.size).toBe(1)
  await app.button("Save activity")!.props.onClick(); await app.settle()
  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0]!)
  expect(versions.size).toBe(1)
  expect(app.text()).toContain("The earlier save was confirmed.")
})

test("control: a save that answers normally is one request and one version", async () => {
  const { versions, keys } = server(false)
  const app = await editor()
  await app.button("Save activity")!.props.onClick(); await app.settle()
  expect(keys).toHaveLength(1); expect(versions.size).toBe(1)
  expect(app.text()).not.toContain(REQUEST_TIMEOUT_TEXT)
})

test("the notice: one polite status region, text only while a request is slow, nothing focusable", async () => {
  configureRequestTimeouts({ default: 500, slowAfterMs: 10 })
  const make = await loadComponent("./SlowRequestNotice.tsx", "SlowRequestNotice", { SLOW_REQUEST_TEXT, slowRequestCount, subscribeRequestEvents })
  let subscribed = 0
  const app = harness(make, () => ({}), { useSyncExternalStore: (subscribe: (cb: () => void) => () => void, get: () => unknown) => { if (!subscribed++) subscribe(() => app.render()); return get() } })
  const region = () => app.nodes().find(node => node.props.role === "status")!
  expect(region().props["aria-live"]).toBe("polite")
  expect(app.text()).toBe("")
  const run = withRequestTimeout("default", undefined, () => sleep(40))
  await sleep(25)
  expect(app.text()).toBe(SLOW_REQUEST_TEXT)
  // A second slow request at the same time does not change the region's text (announced once).
  const second = withRequestTimeout("default", undefined, () => sleep(40))
  await sleep(25)
  expect(slowRequestCount()).toBe(1)
  expect(app.text()).toBe(SLOW_REQUEST_TEXT)
  await run; await second
  expect(app.text()).toBe("")
  expect(app.nodes().some(node => "tabIndex" in node.props || ["button", "a", "input"].includes(node.type as string))).toBe(false)
  expect(region().props.style.pointerEvents).toBe("none")
})
