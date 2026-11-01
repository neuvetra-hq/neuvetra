// PR 22 bug hunt C (Claude, 1 November 2026): regressions reproduced live in the web app on the local end-to-end server
// (C1 and C4 loaded from the r4 pack) and fixed in the web files. Each test failed on 4fec227. The Playwright evidence is
// kept outside the repository (scratchpad pr22/c-tools/e2e).
import { describe, expect, test } from "bun:test"

// C-03: "Open the spend import", the "Spend import and mapping" jump link and a category's "Fix N records" scroll their
// target to the top of the window (block "start"), under the sticky top bar (69 px; 118 px with the step bar under
// 1080 px), so the focused heading was hidden (reproduced live: c-tools/e2e/obscured.mjs). Each target keeps a scroll
// margin taller than the sticky chrome at both widths.
describe("jump targets land below the sticky chrome", () => {
  test("journey.css gives each target a scroll margin taller than the sticky bars", async () => {
    const css = (await Bun.file(new URL("../journey.css", import.meta.url)).text()).replace(/\/\*[\s\S]*?\*\//g, "")
    const margin = (block: string, selector: string) => [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selectors]) => selectors!.split(",").map(item => item.trim()).includes(selector))
      .map(([, , body]) => /scroll-margin-top:\s*(\d+)px/.exec(body!)?.[1]).filter(Boolean).map(Number).at(-1) ?? 0
    const mobile = [...css.matchAll(/@media \(max-width: 1080px\) \{([\s\S]*?\})\s*\}/g)].map(match => match[1]!).join("\n")
    const desktop = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*\s*\}/g, "")
    for (const selector of [".nv-app #spend-import", ".nv-app [data-spend-review-heading]", ".nv-app #scope3-todo", ".nv-app .s3-todo__group"]) {
      expect([selector, margin(desktop, selector) > 69]).toEqual([selector, true])
      expect([selector, margin(mobile, selector) > 118]).toEqual([selector, true])
    }
    // The "New activity record" jump link's editor keeps its 90 px on wide screens and clears the step bar under 1080 px.
    expect(margin(mobile, ".nv-app #collection-record-editor")).toBeGreaterThan(118)
  })
})
