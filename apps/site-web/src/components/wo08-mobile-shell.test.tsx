import { describe, expect, test } from "bun:test"
import { createSyntheticCompanySetup } from "../../../../packages/neuvetra-database/src/company-setup-fixture"
import { computeJourneyStatus } from "@/lib/journey-status"
import type { CompanySetupView } from "@/lib/company-setup-api"
import { CONTEXT_TEXT, contextValues, PERIOD_BY_SCOPE } from "@/lib/context-values"

// WO-08 (QA-200): the context bar's values are the API's company setup values, through the journey status.
function view(revision: number, edit: (setup: ReturnType<typeof createSyntheticCompanySetup>) => void = () => {}): CompanySetupView {
  const setup = createSyntheticCompanySetup()
  edit(setup)
  return { currentVersion: { id: "29900000-0000-4000-8000-000000000001", revision, setup } } as unknown as CompanySetupView
}
const status = (setup: CompanySetupView | null, scope3 = false) => computeJourneyStatus({ setup, context: null, records: [], evidence: [], canManage: true, scope3 })

describe("context bar values", () => {
  test("company, period, boundary and setup version equal the saved setup", () => {
    const api = view(7, setup => { setup.company.legalName = "Synthetic Bayline Co"; setup.reportingPeriod.start = "2025-01-01"; setup.reportingPeriod.endExclusive = "2026-01-01"; setup.boundary.approach = "financial_control" })
    expect(contextValues(status(api))).toEqual({ company: "Synthetic Bayline Co", period: "Jan 1 – Dec 31, 2025", boundary: "Financial control", setup: "Setup v7", periodNotes: [PERIOD_BY_SCOPE.scope12] })
  })
  test("O-5: the Scope 3 period sentence shows only while Scope 3 is on", () => {
    expect(contextValues(status(view(1), true)).periodNotes).toEqual(["Scope 1 and 2: calendar 2025 in this beta.", "Scope 3 records may cover 2025–2026; each line shows its own dates."])
  })
  test("no saved setup or no legal name is said plainly, never left blank", () => {
    expect(contextValues(status(null))).toMatchObject({ company: CONTEXT_TEXT.noName, period: "Period not set", boundary: "Not decided yet", setup: "Setup not saved" })
    expect(contextValues(status(view(2, setup => { setup.company.legalName = "  " }))).company).toBe("Company name not set")
  })
})

describe("shell markup and CSS", async () => {
  const sheet = await Bun.file(new URL("./MenuSheet.tsx", import.meta.url)).text()
  const bar = await Bun.file(new URL("./ContextBar.tsx", import.meta.url)).text()
  const workspace = await Bun.file(new URL("./StagingWorkspace.tsx", import.meta.url)).text()
  const css = await Bun.file(new URL("../styles/wo08.css", import.meta.url)).text()
  const entry = await Bun.file(new URL("../staging.tsx", import.meta.url)).text()
  test("QA-181: the sheet is a named modal dialog with Esc, a Tab trap and focus return to the trigger", () => {
    expect(sheet).toContain(`role="dialog" aria-modal="true" aria-labelledby="nv-menu-sheet-title"`)
    expect(sheet).toContain(`event.key === "Escape"`)
    expect(sheet).toContain(`event.key !== "Tab"`)
    expect(sheet).toContain("button?.focus()")
    expect(workspace).toContain(`aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls={MENU_SHEET_ID}`)
  })
  test("the context bar's Details is a disclosure; values are marked for QA", () => {
    expect(bar).toContain("aria-expanded={open} aria-controls={id}")
    for (const key of ["company", "period", "boundary", "setup", "state", "access"]) expect(bar).toContain(`data-context="${key}"`)
  })
  test("the sticky chrome uses measured heights, and short viewports keep only the top bar (or a form's action bar) sticky", () => {
    expect(css).toContain("--nv-topbar-h: var(--nv-topbar-measured, 61px)")
    expect(css).toContain("--nv-contextbar-h: var(--nv-contextbar-measured, 41px)")
    expect(css).toMatch(/@media \(max-height: 37\.5rem\) \{\n {2}:root \{ --nv-contextbar-h: 0px; \}/)
    expect(css).toContain(".nv-app:has(.setup-actions) .nv-topbar { position: relative; }")
    expect(css).toContain("@media (max-width: 1080px) { .nv-app .nv-layout > .nv-sidenav { display: none; } }")
    expect(bar).toContain("--nv-topbar-measured")
  })
  test("the retrying notice is the context bar's last row (in the sticky flow, under the sheet), not a fixed overlay", () => {
    expect(workspace).toContain("notice={notice} />")
    expect(bar).toContain("{notice}")
    expect(css).toContain(".nv-contextbar .nv-reconnecting-wrap { position: static; inset: auto; z-index: auto;")
  })
  test("WO-08 CSS is its own unlayered file, imported after the earlier order files", () => {
    expect(css).not.toContain("@layer")
    expect(entry.indexOf(`import "./styles/wo08.css"`)).toBeGreaterThan(entry.indexOf(`import "./spend-import.css"`))
  })
})
