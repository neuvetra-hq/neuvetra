// WO-06: the Activity list's filters live in its address (#/activity?status=&type=&page=). These tests pin the parsing
// and printing, and that every earlier address (and every hostile one) still parses exactly as view-route.test.ts says.
import { expect, test } from "bun:test"
import { acceptedViewHash, activityListHash, canonicalViewHash, DEFAULT_ACTIVITY_LIST_QUERY, parseActivityListQuery, parseViewHash, viewHash } from "./view-route"

const id = "29500000-0000-4000-8000-000000000001"

test("an Activity list address with filters is the Activity list, and its filters are read", () => {
  expect(parseViewHash("#/activity?status=attention&type=natural_gas&page=2")).toEqual({ panel: "collection", recordId: null })
  expect(parseActivityListQuery("#/activity?status=attention&type=natural_gas&page=2")).toEqual({ status: "attention", type: "natural_gas", page: 2 })
  expect(parseActivityListQuery("#/activity?page=3")).toEqual({ status: "all", type: "", page: 3 })
  expect(parseActivityListQuery("#/activity")).toEqual(DEFAULT_ACTIVITY_LIST_QUERY)
  expect(parseActivityListQuery("#/activity?")).toEqual(DEFAULT_ACTIVITY_LIST_QUERY)
})

test("unknown or malformed filter values fall back to their defaults", () => {
  for (const hash of ["#/activity?status=everything", "#/activity?status=", "#/activity?type=1gas", "#/activity?page=0", "#/activity?page=01", "#/activity?page=10000", "#/activity?page=2=3", "#/activity?colour=red", "#/activity?status"])
    expect([hash, parseActivityListQuery(hash)]).toEqual([hash, DEFAULT_ACTIVITY_LIST_QUERY])
  expect(parseActivityListQuery("#/activity?status=ready&status=withdrawn")).toEqual({ ...DEFAULT_ACTIVITY_LIST_QUERY, status: "withdrawn" })
})

test("filters are read only from the Activity list address", () => {
  for (const hash of [`#/activity/${id}`, "#/results", "#/overview?status=ready", "#/results?status=ready", "#/setup?page=2"]) expect(parseActivityListQuery(hash)).toEqual(DEFAULT_ACTIVITY_LIST_QUERY)
})

test("a query on any other view, or with any other character, is still the Overview (hostile values stay rejected)", () => {
  for (const hash of ["#/overview?x=1", "#/results?next=https://evil.example", "#/activity?next=https://evil.example", "#/activity?status=<script>", "#/activity?type=a%20b",
    "#/activity?javascript:alert(1)", "#/activity?status=ready#x", `#/activity/${id}?status=ready`, "#/activity?STATUS=ready", `#/activity?${"a".repeat(121)}`, "#/activity ?status=ready"])
    expect([hash, parseViewHash(hash)]).toEqual([hash, { panel: "home", recordId: null }])
})

test("the list address prints only the filters that differ from the defaults, in a fixed order", () => {
  expect(activityListHash(DEFAULT_ACTIVITY_LIST_QUERY)).toBe("#/activity")
  expect(activityListHash({})).toBe("#/activity")
  expect(activityListHash({ page: 2, type: "waste", status: "ready" })).toBe("#/activity?status=ready&type=waste&page=2")
  expect(activityListHash({ status: "all", type: "", page: 1 })).toBe("#/activity")
  // Values that could not be read back are never printed.
  expect(activityListHash({ status: "nope" as never, type: "a b", page: 1.5 })).toBe("#/activity")
  for (const query of [{ status: "withdrawn", type: "purchase_spend", page: 12 }, { status: "attention", type: "", page: 1 }] as const)
    expect(parseActivityListQuery(activityListHash(query))).toEqual(query)
})

test("canonicalViewHash keeps valid list filters and is viewHash for everything else", () => {
  const cases: Array<[string, string]> = [["#/activity?page=2&status=ready", "#/activity?status=ready&page=2"], ["#/activity?status=bogus", "#/activity"], [`#/activity/${id}`, `#/activity/${id}`],
    ["#/earlier/gas", "#/earlier"], ["#/nope", "#/overview"], ["#/overview?x=1", "#/overview"], ["#/results", "#/results"]]
  for (const [hash, canonical] of cases) expect([hash, canonicalViewHash(hash)]).toEqual([hash, canonical])
  for (const hash of ["#/overview", "#/setup", "#/activity", "#/results", "#/earlier", `#/activity/${id}`]) { const route = parseViewHash(hash); expect(canonicalViewHash(hash)).toBe(viewHash(route.panel, route.recordId)) }
})

// WO-06 with WO-05a: a filtered list is a view to return to after the session ends; nothing else about the rules changes.
test("acceptedViewHash keeps the Activity list's filters, canonically, and still refuses everything it refused", () => {
  expect(acceptedViewHash("#/activity?page=2&type=waste")).toBe("#/activity?type=waste&page=2")
  expect(acceptedViewHash("#/activity?status=bogus")).toBe("#/activity")
  expect(acceptedViewHash("#/activity")).toBe("#/activity")
  for (const tampered of ["#/overview?x=1", "#/results?status=ready", "#/activity?next=https://evil.example", "#/activity?status=<x>", `#/activity/${id}?page=2`, `#/activity?type=${"a".repeat(60)}`, "#/activity?Status=ready"])
    expect([tampered, acceptedViewHash(tampered)]).toEqual([tampered, null])
})
