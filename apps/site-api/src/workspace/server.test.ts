import { afterEach, describe, expect, test } from "bun:test"
import { createDevelopmentWorkspaceServer, M54_OUTSIDER_TOKEN, M54_OWNER_TOKEN, M55_ADMIN_TOKEN, M55_MEMBER_TOKEN } from "./server"

const ORIGIN = "http://127.0.0.1:5174"
const body = {
  companyName: "Synthetic Acme, Inc.",
  facilityName: "Synthetic California office",
  countryCode: "US",
  stateCode: "CA",
  egridSubregion: "CAMX",
  reportingYear: 2023,
  approach: "operational_control",
}
const billFixture = new URL("../../../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf", import.meta.url)

describe("M54 composed development server", () => {
  let close: (() => Promise<void>) | undefined
  const originalEnabled = Bun.env.M54_SYNTHETIC_WORKSPACE
  const originalBillEnabled = Bun.env.M55_SYNTHETIC_BILL
  const originalRuntime = Bun.env.NODE_ENV
  afterEach(async () => {
    await close?.()
    close = undefined
    if (originalEnabled === undefined) delete Bun.env.M54_SYNTHETIC_WORKSPACE
    else Bun.env.M54_SYNTHETIC_WORKSPACE = originalEnabled
    if (originalBillEnabled === undefined) delete Bun.env.M55_SYNTHETIC_BILL
    else Bun.env.M55_SYNTHETIC_BILL = originalBillEnabled
    if (originalRuntime === undefined) delete Bun.env.NODE_ENV
    else Bun.env.NODE_ENV = originalRuntime
  })

  test("creates, revisits and withholds the same real SQL-backed workspace", async () => {
    Bun.env.M54_SYNTHETIC_WORKSPACE = "enabled"
    Bun.env.M55_SYNTHETIC_BILL = "enabled"
    Bun.env.NODE_ENV = "test"
    const { app, database } = await createDevelopmentWorkspaceServer()
    close = () => database.close()
    const createdResponse = await app.handle(new Request("http://localhost/workspace", {
      method: "POST",
      headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }))
    expect(createdResponse.status).toBe(201)
    const created = await createdResponse.json() as { id: string }

    const ownerResponse = await app.handle(new Request(`http://localhost/workspace/${created.id}`, {
      headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}` },
    }))
    expect(ownerResponse.status).toBe(200)

    const outsiderResponse = await app.handle(new Request(`http://localhost/workspace/${created.id}`, {
      headers: { origin: ORIGIN, authorization: `Bearer ${M54_OUTSIDER_TOKEN}` },
    }))
    expect(outsiderResponse.status).toBe(404)
    expect(await outsiderResponse.json()).toEqual({ error: "Workspace not found." })
  })

  test("requires both an explicit enable flag and a development/test runtime", async () => {
    for (const [enabled, billEnabled, runtime] of [[undefined, "enabled", "development"], ["enabled", undefined, "development"], ["enabled", "enabled", undefined], ["enabled", "enabled", "staging"], ["enabled", "enabled", "production"]] as const) {
      if (enabled === undefined) delete Bun.env.M54_SYNTHETIC_WORKSPACE
      else Bun.env.M54_SYNTHETIC_WORKSPACE = enabled
      if (billEnabled === undefined) delete Bun.env.M55_SYNTHETIC_BILL
      else Bun.env.M55_SYNTHETIC_BILL = billEnabled
      if (runtime === undefined) delete Bun.env.NODE_ENV
      else Bun.env.NODE_ENV = runtime
      await expect(createDevelopmentWorkspaceServer()).rejects.toThrow("explicit development/test enable flags")
    }
  })

  test("refuses non-owner bootstrap before creating any partial workspace", async () => {
    Bun.env.M54_SYNTHETIC_WORKSPACE = "enabled"
    Bun.env.M55_SYNTHETIC_BILL = "enabled"
    Bun.env.NODE_ENV = "test"
    const { app, database } = await createDevelopmentWorkspaceServer()
    close = () => database.close()
    const adminAttempt = await app.handle(new Request("http://localhost/workspace", {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M55_ADMIN_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(body),
    }))
    expect(adminAttempt.status).toBe(409)
    const ownerAttempt = await app.handle(new Request("http://localhost/workspace", {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(body),
    }))
    expect(ownerAttempt.status).toBe(201)
  })

  test("intakes, reviews, links and tenant-isolates the fixed synthetic bill", async () => {
    Bun.env.M54_SYNTHETIC_WORKSPACE = "enabled"
    Bun.env.M55_SYNTHETIC_BILL = "enabled"
    Bun.env.NODE_ENV = "test"
    const { app, database } = await createDevelopmentWorkspaceServer()
    close = () => database.close()
    const createResponse = await app.handle(new Request("http://localhost/workspace", {
      method: "POST",
      headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }))
    const workspace = await createResponse.json() as { id: string; facility: { id: string }; boundary: { id: string } }
    const bytes = await Bun.file(billFixture).arrayBuffer()
    const form = new FormData()
    form.set("file", new File([bytes], "neuvetra-m55-synthetic-electricity-bill.pdf", { type: "application/pdf" }))
    const upload = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}` }, body: form,
    }))
    expect(upload.status).toBe(200)
    const extracted = await upload.json() as { id: string; state: string; versions: Array<{ id: string }> }
    expect(extracted.state).toBe("needs_review")

    const duplicateForm = new FormData()
    duplicateForm.set("file", new File([bytes], "neuvetra-m55-synthetic-electricity-bill.pdf", { type: "application/pdf" }))
    const duplicate = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}` }, body: duplicateForm,
    }))
    expect((await duplicate.json() as { id: string }).id).toBe(extracted.id)

    const changedBytes = new Uint8Array(bytes); changedBytes[100] ^= 1
    const changedForm = new FormData()
    changedForm.set("file", new File([changedBytes], "neuvetra-m55-synthetic-electricity-bill.pdf", { type: "application/pdf" }))
    const changed = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}` }, body: changedForm,
    }))
    expect(changed.status).toBe(422)

    const staleCorrection = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}/corrections`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ facilityId: workspace.facility.id, priorVersionId: "ffffffff-ffff-4fff-8fff-ffffffffffff", electricityKwh: "12346.000", reason: "Synthetic review exercise" }),
    }))
    expect(staleCorrection.status).toBe(409)

    const memberRead = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}`, { headers: { origin: ORIGIN, authorization: `Bearer ${M55_MEMBER_TOKEN}` } }))
    expect(memberRead.status).toBe(200)
    const memberCorrection = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}/corrections`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M55_MEMBER_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ facilityId: workspace.facility.id, priorVersionId: extracted.versions[0]!.id, electricityKwh: "12346.000", reason: "Synthetic review exercise" }),
    }))
    expect(memberCorrection.status).toBe(403)

    const corrected = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}/corrections`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M55_ADMIN_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ facilityId: workspace.facility.id, priorVersionId: extracted.versions[0]!.id, electricityKwh: "12346.000", reason: "Synthetic review exercise" }),
    }))
    expect(corrected.status).toBe(200)
    const reviewed = await corrected.json() as { state: string; versions: Array<{ id: string }> }
    expect(reviewed).toMatchObject({ state: "reviewed" })
    expect(reviewed.versions).toHaveLength(2)

    const linked = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}/link`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M55_ADMIN_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ boundaryId: workspace.boundary.id, billVersionId: reviewed.versions[1]!.id }),
    }))
    expect(linked.status).toBe(200)
    const linkedBody = await linked.json() as { id: string; state: string; draftActivity: { id: string; quantityMwh: string; status: string } }
    expect(linkedBody).toMatchObject({ state: "linked_draft", draftActivity: { quantityMwh: "12.346000", status: "draft" } })
    const repeatedLink = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}/link`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M55_ADMIN_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ boundaryId: workspace.boundary.id, billVersionId: reviewed.versions[1]!.id }),
    }))
    expect(repeatedLink.status).toBe(200)
    expect((await repeatedLink.json() as { draftActivity: { id: string } }).draftActivity.id).toBe(linkedBody.draftActivity.id)

    const foreign = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}`, {
      headers: { origin: ORIGIN, authorization: `Bearer ${M54_OUTSIDER_TOKEN}` },
    }))
    expect(foreign.status).toBe(404)
    expect(await foreign.json()).toEqual({ error: "Evidence not found." })
    const signedOut = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}`))
    expect(signedOut.status).toBe(401)
  })
})
