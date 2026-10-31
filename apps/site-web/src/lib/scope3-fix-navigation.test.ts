/* eslint-disable @typescript-eslint/no-explicit-any -- minimal focus DOM observations. */
import { afterEach, describe, expect, test } from "bun:test"
import { scope3FixFields } from "./scope3-checklist"
import { focusRecordEditor, requestRecordFieldFocus, takeRecordFieldFocus } from "./scope3-fix-target"

afterEach(() => { takeRecordFieldFocus("clear") })

function editor() {
  const scrolls: unknown[] = [], focus: unknown[] = []
  const heading = { tabIndex: 0, scrollIntoView: (options: unknown) => scrolls.push(options), focus: (options: unknown) => focus.push(options) }
  const form = { querySelector: () => heading, querySelectorAll: () => [] }
  const doc = { getElementById: () => form, defaultView: null } as any
  return { heading, doc, scrolls, focus }
}

describe("Scope 3 Fix navigation remains visible below fixed navigation", () => {
  test("survey overlap opens its existing attestation field", () => {
    expect(scope3FixFields(["commuting_overlap_not_confirmed"])).toEqual(["Covered by distance-based commuting records?"])
  })
  test("category-incompatible NAICS opens the existing code picker", () => {
    expect(scope3FixFields(["naics_not_valid_for_category"])).toEqual(["Search NAICS codes"])
  })
  test("an unmatched Scope 3 Fix still centers its fallback heading", () => {
    const e = editor()
    requestRecordFieldFocus("scope3-record", [])
    expect(focusRecordEditor("scope3-record", e.doc)).toBe(e.heading as any)
    expect(e.scrolls).toEqual([{ block: "center" }])
    expect(e.focus).toEqual([{ preventScroll: true }])
    expect(e.heading.tabIndex).toBe(-1)
  })
  test("ordinary record editing retains its original alignment", () => {
    const e = editor()
    focusRecordEditor("ordinary-record", e.doc)
    expect(e.scrolls).toEqual([{ block: "start" }])
  })
  test("a request for a different record cannot change this editor", () => {
    const e = editor()
    requestRecordFieldFocus("other-record", [])
    focusRecordEditor("ordinary-record", e.doc)
    expect(e.scrolls).toEqual([{ block: "start" }])
  })
  test("the centered fallback is consumed once", () => {
    const e = editor()
    requestRecordFieldFocus("scope3-record", [])
    focusRecordEditor("scope3-record", e.doc)
    focusRecordEditor("scope3-record", e.doc)
    expect(e.scrolls).toEqual([{ block: "center" }, { block: "start" }])
  })
})
