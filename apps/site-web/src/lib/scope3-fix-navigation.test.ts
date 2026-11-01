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

// Bug hunt C (pr22, Claude, 1 November 2026), C-02: on a first Fix the record form's chunk is still loading, so the editor
// heading is focused first and the named field a poll later. The heading's own "keep in view" re-checks (250 and 800 ms)
// then saw the heading off-screen (the page had scrolled to the field) and scrolled the heading back, leaving the focused
// field ~2,600 px below the viewport (reproduced live: c-tools/e2e/fix-shift.mjs, Fix C1-PURCHASE_SPEND-110 at 1360 px).
describe("Fix: a field found after the form loads stays in view", () => {
  /** `html { scroll-behavior: smooth }`: a scroll lands ~300 ms after it is asked for, and a newer one replaces it. */
  function lazyEditor() {
    const timers: Array<{ at: number; run: () => void }> = []
    let now = 0, current = "none", smooth: { name: string; at: number } | null = null
    const scrolledTo = () => { if (smooth && now >= smooth.at) { current = smooth.name; smooth = null } return current }
    const scrolls: string[] = []
    const doc: any = { activeElement: null }
    const node: Record<string, any> = {}
    const element = (name: string, away: number) => ({ name, tabIndex: 0, dataset: {} as Record<string, string>, style: {} as Record<string, string>, disabled: false,
      scrollIntoView: () => { scrolls.push(name); smooth = { name, at: now + 300 } }, focus: () => { doc.activeElement = node[name] },
      getBoundingClientRect: () => { const top = scrolledTo() === name ? 430 : away; return { top, bottom: top + 40 } }, closest: () => null, addEventListener() {} })
    node.heading = element("heading", -2200)
    node.field = element("field", 3086)
    const label = { querySelector: (selector: string) => selector === ":scope > span" ? { textContent: "Invoice or posting date" } : node.field, textContent: "Invoice or posting date" }
    let rendered = false
    const editor = { querySelector: () => node.heading, querySelectorAll: (selector: string) => selector === "label" && rendered ? [label] : [] }
    doc.getElementById = () => editor
    doc.defaultView = { innerHeight: 900, setTimeout: (run: () => void, ms: number) => { timers.push({ at: now + ms, run }); return timers.length } }
    const runAll = () => { while (timers.length) { timers.sort((a, b) => a.at - b.at); const next = timers.shift()!; now = next.at; next.run() } now += 1000 }
    return { doc, node, scrolls, render: () => { rendered = true }, runAll, get scrolledTo() { return scrolledTo() } }
  }
  test("the heading's re-checks never scroll the page away from the field that took focus", () => {
    const e = lazyEditor()
    requestRecordFieldFocus("lazy-record", ["Invoice or posting date"])
    expect(focusRecordEditor("lazy-record", e.doc)).toBe(e.node.heading)
    e.render() // the form's chunk arrives before the first poll
    e.runAll()
    expect(e.doc.activeElement).toBe(e.node.field)
    expect(e.scrolledTo).toBe("field")
    expect(e.scrolls.at(-1)).toBe("field")
  })
})
