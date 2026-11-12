// WO-07: viewHash and parseViewHash moved here from StagingWorkspace.tsx unchanged, except that every #/earlier/<x> is now the
// static list (#/earlier). These tests pin the behaviour WO-05a (session return) and WO-06 (record view) rely on.
import { expect, test } from "bun:test"
import { acceptedViewHash, forgetReturnView, parseViewHash, peekReturnView, rememberReturnView, RETURN_VIEW_KEY, takeReturnView, viewHash, type WorkspaceView } from "./view-route"

const id = "29500000-0000-4000-8000-000000000001"

test("each view has one canonical address", () => {
  const expected: Record<WorkspaceView, string> = { home: "#/overview", setup: "#/setup", collection: "#/activity", results: "#/results", archive: "#/earlier" }
  for (const [panel, hash] of Object.entries(expected) as Array<[WorkspaceView, string]>) {
    expect(viewHash(panel)).toBe(hash)
    expect(viewHash(panel, null)).toBe(hash)
    expect(parseViewHash(hash)).toEqual({ panel, recordId: null })
  }
})

test("a record ID goes into the address only for Activity & evidence", () => {
  expect(viewHash("collection", id)).toBe(`#/activity/${id}`)
  expect(viewHash("results", id)).toBe("#/results")
  expect(viewHash("archive", id)).toBe("#/earlier")
  expect(parseViewHash(`#/activity/${id}`)).toEqual({ panel: "collection", recordId: id })
  expect(parseViewHash(`#/activity/${id.toUpperCase()}`)).toEqual({ panel: "collection", recordId: id.toUpperCase() })
})

test("a record ID that is not a UUID is dropped, and Activity & evidence opens without a record", () => {
  for (const detail of ["123", "not-a-record", `${id}0`]) expect(parseViewHash(`#/activity/${detail}`)).toEqual({ panel: "collection", recordId: null })
})

test("a detail on any other view is ignored", () => {
  expect(parseViewHash(`#/results/${id}`)).toEqual({ panel: "results", recordId: null })
  expect(parseViewHash("#/setup/review")).toEqual({ panel: "setup", recordId: null })
})

test("every #/earlier/<x> is the static list", () => {
  for (const detail of ["gas", "annual", "worksheet", "example", "legacy-setup", "setup", "collection", "anything"]) {
    expect(parseViewHash(`#/earlier/${detail}`)).toEqual({ panel: "archive", recordId: null })
  }
})

test("unknown, malformed or hostile addresses are the Overview", () => {
  for (const hash of ["", "#", "#/", "#workspace-main", "#/unknown", "#/Overview", "#/activity/", "#/a/b/c", "#/javascript:alert(1)", "#/https://example.com", "#//evil.example", "overview", "#/overview?x=1"]) {
    expect(parseViewHash(hash)).toEqual({ panel: "home", recordId: null })
  }
})

test("parsing then printing gives the canonical address", () => {
  const cases: Array<[string, string]> = [["#/earlier/gas", "#/earlier"], ["#/nope", "#/overview"], [`#/activity/${id}`, `#/activity/${id}`], ["#/activity/123", "#/activity"]]
  for (const [hash, canonical] of cases) { const route = parseViewHash(hash); expect(viewHash(route.panel, route.recordId)).toBe(canonical) }
})

// WO-05a (QA-145): only our own view addresses are stored or passed on; anything else is ignored.
test("acceptedViewHash returns the canonical address of a real view and null for anything else", () => {
  expect(acceptedViewHash(`#/activity/${id}`)).toBe(`#/activity/${id}`)
  expect(acceptedViewHash("#/results")).toBe("#/results")
  expect(acceptedViewHash("#/overview")).toBe("#/overview")
  expect(acceptedViewHash("#/earlier/gas")).toBe("#/earlier")
  expect(acceptedViewHash("#/activity/not-a-record")).toBe("#/activity")
  for (const tampered of ["https://evil.example/#/results", "javascript:alert(1)", "#javascript:alert(1)", "//evil.example/#/results", "#//evil.example", "#/results?next=https://evil.example",
    "#/unknown", "#/", "", "#/activity/../../x", "#/RESULTS", `#/activity/${id}/x`, " #/results", "#/results\n", `#/activity/${"a".repeat(80)}`, null, 42, { hash: "#/results" }])
    expect([tampered, acceptedViewHash(tampered)]).toEqual([tampered, null])
})

function memory() {
  const map = new Map<string, string>()
  return { map, storage: { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value) }, removeItem: (key: string) => { map.delete(key) } } }
}
const user = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222"

test("a stored return view is read by the same person within 24 hours, and removed when anyone else reads it", () => {
  const { map, storage } = memory()
  rememberReturnView(storage, user, `#/activity/${id}`, 1_000)
  expect(takeReturnView(storage, user, 2_000)).toBe(`#/activity/${id}`)
  // The tab the session ended in and the sign-in link's new tab may both read it.
  expect(takeReturnView(storage, user, 3_000)).toBe(`#/activity/${id}`)
  expect(takeReturnView(storage, other, 4_000)).toBeNull()
  expect(map.size).toBe(0)
  rememberReturnView(storage, user, "#/results", 1_000)
  expect(takeReturnView(storage, user, 1_000 + 24 * 60 * 60 * 1000 + 1)).toBeNull()
  expect(map.size).toBe(0)
  rememberReturnView(storage, user, "#/results", 5_000)
  expect(takeReturnView(storage, user, 4_000)).toBeNull()
})

test("a tampered stored return view is ignored and removed (QA-145)", () => {
  const { map, storage } = memory()
  for (const raw of [JSON.stringify({ hash: "https://evil.example/#/results", userId: user, savedAt: 1 }), JSON.stringify({ hash: "javascript:alert(1)", userId: user, savedAt: 1 }),
    JSON.stringify({ hash: "#//evil.example", userId: user, savedAt: 1 }), JSON.stringify({ hash: "#/results", userId: user, savedAt: "1" }), JSON.stringify(["#/results"]), "not json", "null"]) {
    map.set(RETURN_VIEW_KEY, raw)
    expect([raw, takeReturnView(storage, user, 2)]).toEqual([raw, null])
    expect(map.has(RETURN_VIEW_KEY)).toBe(false)
  }
  // An address that isn't ours is never written; it removes any earlier one.
  rememberReturnView(storage, user, "#/results", 1)
  rememberReturnView(storage, user, "javascript:alert(1)", 1)
  expect(map.size).toBe(0)
  rememberReturnView(storage, user, "#/results", 1)
  forgetReturnView(storage)
  expect(map.size).toBe(0)
})

test("storage that throws never breaks the session flow", () => {
  const broken = { getItem: () => { throw new Error("denied") }, setItem: () => { throw new Error("denied") }, removeItem: () => { throw new Error("denied") } }
  expect(() => rememberReturnView(broken, user, "#/results")).not.toThrow()
  expect(takeReturnView(broken, user)).toBeNull()
  expect(() => forgetReturnView(broken)).not.toThrow()
  expect(takeReturnView(null, user)).toBeNull()
})

test("peekReturnView reads the stored view without removing it, under the same rules", () => {
  const { map, storage } = memory()
  rememberReturnView(storage, user, "#/results", 1_000)
  expect(peekReturnView(storage, user, 2_000)).toBe("#/results")
  expect(peekReturnView(storage, other, 2_000)).toBeNull()
  expect(map.has(RETURN_VIEW_KEY)).toBe(true)
  expect(peekReturnView(storage, other, 2_000)).toBeNull()
  expect(map.has(RETURN_VIEW_KEY)).toBe(true)
})
