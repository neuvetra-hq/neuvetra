import { describe, expect, test } from "bun:test"
import { createSyntheticCompanySetup } from "../../../../packages/neuvetra-database/src/company-setup-fixture"
import { CompanySetupApiError, type CompanySetupSaveInput, type CompanySetupVersion, type CompanySetupView } from "@/lib/company-setup-api"
import { harness, loadComponent } from "./component-harness"

const company = "93500000-0000-4000-8000-000000000001", setupId = "93500000-0000-4000-8000-000000000002", user = "93500000-0000-4000-8000-0000000000a1"

describe("saved legacy source display and correction", () => {
  test.each(["yes", "unknown"] as const)("renders a readable %s source and saves its original category", async state => {
    const setup = createSyntheticCompanySetup()
    setup.screening[0]!.state = state
    const version: CompanySetupVersion = { id: setupId, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: user, createdAt: "2025-06-01T00:00:00.000Z", setup }
    const view: CompanySetupView = { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, currentVersion: version, history: [version] }
    const sent: CompanySetupSaveInput[] = []
    const make = await loadComponent("./CompanySetup.tsx", "CompanySetup", {
      CompanySetupApiError, loadCompanySetup: async () => structuredClone(view), loadCompanySetupVersion: async () => null,
      saveCompanySetup: async (_company: string, input: CompanySetupSaveInput) => {
        sent.push(structuredClone(input))
        const savedVersion = { ...version, id: "93500000-0000-4000-8000-000000000003", revision: 2, previousVersionId: setupId, correctionReason: input.correctionReason, setup: structuredClone(input.setup) }
        return { foundation: { ...view, currentVersion: savedVersion, history: [...view.history, savedVersion] }, savedVersion, replayed: false }
      }, window: { confirm: () => true },
    })
    const app = harness(make, () => ({ actor: { userId: user, role: "owner", accessToken: "synthetic-test-only" }, workspaceId: company, headingRef: { current: null } }))
    await app.settle()
    app.button("06 Source activities")!.props.onClick(); await app.settle()
    const text = app.text().replace(/\s+/g, " ")
    expect(text).toContain("Scope 1 · Fuel-burning equipment")
    expect(text).toContain("Scope 2 · purchased electricity")
    expect(text).not.toMatch(/stationary_combustion|purchased_electricity/)
    expect(sent).toEqual([])
    app.nodes().find(node => node.props.label === "Equipment / activity names and notes")!.props.onChange("Gas boiler; other fuels still under review."); await app.settle()
    app.button("07 Review")!.props.onClick(); await app.settle()
    app.byLabel("Reason for this correction")!.props.onChange("Clarified equipment notes."); await app.settle()
    app.button("Save correction")!.props.onClick(); await app.settle()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.setup.screening.map(row => row.category)).toEqual(setup.screening.map(row => row.category))
    expect(sent[0]!.setup.screening[0]).toEqual({ ...setup.screening[0]!, details: "Gas boiler; other fuels still under review." })
    expect(app.text()).toContain("Saved. The previous version remains in correction history.")
    expect(setup.screening[0]!.details).toBe("")
  })
})
