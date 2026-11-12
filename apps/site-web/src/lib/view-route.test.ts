// WO-07: viewHash and parseViewHash moved here from StagingWorkspace.tsx unchanged, except that every #/earlier/<x> is now the
// static list (#/earlier). These tests pin the behaviour WO-05a (session return) and WO-06 (record view) rely on.
import { expect, test } from "bun:test"
import { parseViewHash, viewHash, type WorkspaceView } from "./view-route"

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
