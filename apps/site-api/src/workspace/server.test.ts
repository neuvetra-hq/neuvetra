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
  const originalCalculationEnabled = Bun.env.M56_SYNTHETIC_BILL_CALCULATION
  const originalRuntime = Bun.env.NODE_ENV
  afterEach(async () => {
    await close?.()
    close = undefined
    if (originalEnabled === undefined) delete Bun.env.M54_SYNTHETIC_WORKSPACE
    else Bun.env.M54_SYNTHETIC_WORKSPACE = originalEnabled
    if (originalBillEnabled === undefined) delete Bun.env.M55_SYNTHETIC_BILL
    else Bun.env.M55_SYNTHETIC_BILL = originalBillEnabled
    if (originalCalculationEnabled === undefined) delete Bun.env.M56_SYNTHETIC_BILL_CALCULATION
    else Bun.env.M56_SYNTHETIC_BILL_CALCULATION = originalCalculationEnabled
    if (originalRuntime === undefined) delete Bun.env.NODE_ENV
    else Bun.env.NODE_ENV = originalRuntime
  })

  test("creates, revisits and withholds the same real SQL-backed workspace", async () => {
    Bun.env.M54_SYNTHETIC_WORKSPACE = "enabled"
    Bun.env.M55_SYNTHETIC_BILL = "enabled"
    Bun.env.M56_SYNTHETIC_BILL_CALCULATION = "enabled"
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
    for (const [enabled, billEnabled, calculationEnabled, runtime] of [[undefined, "enabled", "enabled", "development"], ["enabled", undefined, "enabled", "development"], ["enabled", "enabled", undefined, "development"], ["enabled", "enabled", "enabled", undefined], ["enabled", "enabled", "enabled", "staging"], ["enabled", "enabled", "enabled", "production"]] as const) {
      if (enabled === undefined) delete Bun.env.M54_SYNTHETIC_WORKSPACE
      else Bun.env.M54_SYNTHETIC_WORKSPACE = enabled
      if (billEnabled === undefined) delete Bun.env.M55_SYNTHETIC_BILL
      else Bun.env.M55_SYNTHETIC_BILL = billEnabled
      if (calculationEnabled === undefined) delete Bun.env.M56_SYNTHETIC_BILL_CALCULATION
      else Bun.env.M56_SYNTHETIC_BILL_CALCULATION = calculationEnabled
      if (runtime === undefined) delete Bun.env.NODE_ENV
      else Bun.env.NODE_ENV = runtime
      await expect(createDevelopmentWorkspaceServer()).rejects.toThrow("explicit development/test enable flags")
    }
  })

  test("refuses non-owner bootstrap before creating any partial workspace", async () => {
    Bun.env.M54_SYNTHETIC_WORKSPACE = "enabled"
    Bun.env.M55_SYNTHETIC_BILL = "enabled"
    Bun.env.M56_SYNTHETIC_BILL_CALCULATION = "enabled"
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
    Bun.env.M56_SYNTHETIC_BILL_CALCULATION = "enabled"
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

    const prematureCalculation = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}/calculate`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
    }))
    expect(prematureCalculation.status).toBe(409)

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
    const overriddenCalculation = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}/calculate`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ quantity: "999" }),
    }))
    expect(overriddenCalculation.status).toBe(422)

    const memberCalculation = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}/calculate`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M55_MEMBER_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
    }))
    expect(memberCalculation.status).toBe(403)
    const calculationKey = crypto.randomUUID()
    const concurrentCalculations = await Promise.all(Array.from({ length: 3 }, () => app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}/calculate`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M55_ADMIN_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: calculationKey }),
    }))))
    expect(concurrentCalculations.every((response) => response.status === 200)).toBe(true)
    const calculationBodies = await Promise.all(concurrentCalculations.map((response) => response.json())) as Array<{ draftCalculation: { id: string; activityVersionId: string; billVersionId: string; sourceQuantityKwh: string; normalizedQuantityMwh: string; method: { reviewedEngineSha256: string }; factor: { value: string; totalOutputCell: string }; total: { unrounded: string; display: string }; reconciliation: { componentSum: string; componentRoundingDelta: string }; record: Record<string, unknown>; billVersionPayloadSha256: string; createdBy: string; createdAt: string } }>
    expect(new Set(calculationBodies.map((value) => value.draftCalculation.id)).size).toBe(1)
    const calculationBody = calculationBodies[0]!
    expect(calculationBody.draftCalculation).toMatchObject({
      activityVersionId: linkedBody.draftActivity.id,
      billVersionId: reviewed.versions[1]!.id,
      sourceQuantityKwh: "12346.000",
      normalizedQuantityMwh: "12.346000",
      method: { reviewedEngineSha256: "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c" },
      factor: { value: "195.0402888", totalOutputCell: "AI6" },
      total: { unrounded: "2407.9674055248", display: "2407.9674" },
      reconciliation: { componentSum: "2407.8330020304", componentRoundingDelta: "0.1344034944" },
    })
    const repeatedCalculation = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}/calculate`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: calculationKey }),
    }))
    expect(repeatedCalculation.status).toBe(200)
    expect((await repeatedCalculation.json() as { draftCalculation: { id: string } }).draftCalculation.id).toBe(calculationBody.draftCalculation.id)
    const replayed = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}/calculate/replay`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M55_ADMIN_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), record: calculationBody.draftCalculation.record }),
    }))
    expect(replayed.status).toBe(200)
    expect((await replayed.json() as { draftCalculation: { id: string } }).draftCalculation.id).toBe(calculationBody.draftCalculation.id)
    const tamperedRecord = structuredClone(calculationBody.draftCalculation.record) as Record<string, any>
    tamperedRecord.result.total.display = "2407.9675"
    const refusedReplay = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}/calculate/replay`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M55_ADMIN_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), record: tamperedRecord }),
    }))
    expect(refusedReplay.status).toBe(409)
    expect(await refusedReplay.json()).toEqual({ error: "Replay could not be verified." })
    const memberCalculatedRead = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}`, { headers: { origin: ORIGIN, authorization: `Bearer ${M55_MEMBER_TOKEN}` } }))
    expect((await memberCalculatedRead.json() as { draftCalculation: { id: string } }).draftCalculation.id).toBe(calculationBody.draftCalculation.id)

    const foreign = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}`, {
      headers: { origin: ORIGIN, authorization: `Bearer ${M54_OUTSIDER_TOKEN}` },
    }))
    expect(foreign.status).toBe(404)
    expect(await foreign.json()).toEqual({ error: "Evidence not found." })
    const signedOut = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}`))
    expect(signedOut.status).toBe(401)
  })
})
