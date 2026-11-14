// BF-21 (CEO ruling, 13 November 2026): from schema 32 a company setup save that includes category 3 can carry `warnings`
// (it took the stored Scope 3 lines past 3,000; the save stands). The decoder must accept the key, or a saved setup would look
// failed. Correctness only: the saved setup is decoded exactly as before, and anything else unexpected is still refused.
import { afterEach, describe, expect, test } from "bun:test"
import { saveCompanySetup, type CompanySetupSaveInput } from "./company-setup-api"

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

const company = "82000000-0000-4000-8000-000000000001", actorId = "82000000-0000-4000-8000-000000000002", versionId = "82000000-0000-4000-8000-000000000003"
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`
}
const sha256 = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value))))].map(byte => byte.toString(16).padStart(2, "0")).join("")
const setup = { screening: [{ id: "s3-3", scope: 3, category: "fuel_and_energy_related_activities", state: "yes" }] } as unknown as CompanySetupSaveInput["setup"]
const input: CompanySetupSaveInput = { idempotencyKey: "82000000-0000-4000-8000-000000000004", expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup }
const actor = { accessToken: "token", userId: actorId, role: "owner" as const }

async function saved(extra: Record<string, unknown>) {
  const summary = { id: versionId, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: await sha256(setup), createdBy: actorId, createdAt: "2026-11-13T12:00:00.000Z" }
  const version = { ...summary, setup }
  return { foundation: { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, currentVersion: version, history: [summary] }, savedVersion: version, replayed: false, ...extra }
}
const answer = (body: unknown) => { globalThis.fetch = (async () => Response.json(body, { status: 201 })) as unknown as typeof fetch }

describe("BF-21: the setup save decoder tolerates the line-budget warning", () => {
  test("the answer without warnings decodes as before; with a warnings array it decodes the same saved setup", async () => {
    answer(await saved({}))
    const plain = await saveCompanySetup(company, input, actor)
    answer(await saved({ warnings: [{ code: "scope3_line_budget_exceeded", lineBudget: { max: 3000, used: 3002 }, message: "Company setup is saved. …" }] }))
    const warned = await saveCompanySetup(company, input, actor)
    expect(warned).toEqual(plain)
    expect(warned.savedVersion.id).toBe(versionId)
  })
  test("anything else is still refused: a non-array warnings value, a non-object item, or another unknown key", async () => {
    for (const extra of [{ warnings: "scope3_line_budget_exceeded" }, { warnings: ["scope3_line_budget_exceeded"] }, { warnings: [null] }, { notes: [] }]) {
      answer(await saved(extra))
      await expect(saveCompanySetup(company, input, actor)).rejects.toThrow("The company setup response was not recognized.")
    }
  })
})
