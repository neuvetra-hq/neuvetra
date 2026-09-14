import { afterEach, beforeEach, describe, expect, test } from "bun:test"
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
  const originalInventoryEnabled = Bun.env.M57_SYNTHETIC_INVENTORY_REVIEW
  const originalAnnualEnabled = Bun.env.M58_SYNTHETIC_ANNUAL_REGISTER
  const originalPackEnabled = Bun.env.M59_SYNTHETIC_EVIDENCE_PACK
  const originalReportEnabled = Bun.env.M60_SYNTHETIC_DRAFT_REPORT
  const originalRuntime = Bun.env.NODE_ENV
  beforeEach(() => { Bun.env.M59_SYNTHETIC_EVIDENCE_PACK = "enabled"; Bun.env.M60_SYNTHETIC_DRAFT_REPORT = "enabled" })
  afterEach(async () => {
    await close?.()
    close = undefined
    if (originalEnabled === undefined) delete Bun.env.M54_SYNTHETIC_WORKSPACE
    else Bun.env.M54_SYNTHETIC_WORKSPACE = originalEnabled
    if (originalBillEnabled === undefined) delete Bun.env.M55_SYNTHETIC_BILL
    else Bun.env.M55_SYNTHETIC_BILL = originalBillEnabled
    if (originalCalculationEnabled === undefined) delete Bun.env.M56_SYNTHETIC_BILL_CALCULATION
    else Bun.env.M56_SYNTHETIC_BILL_CALCULATION = originalCalculationEnabled
    if (originalInventoryEnabled === undefined) delete Bun.env.M57_SYNTHETIC_INVENTORY_REVIEW
    else Bun.env.M57_SYNTHETIC_INVENTORY_REVIEW = originalInventoryEnabled
    if (originalAnnualEnabled === undefined) delete Bun.env.M58_SYNTHETIC_ANNUAL_REGISTER
    else Bun.env.M58_SYNTHETIC_ANNUAL_REGISTER = originalAnnualEnabled
    if (originalPackEnabled === undefined) delete Bun.env.M59_SYNTHETIC_EVIDENCE_PACK
    else Bun.env.M59_SYNTHETIC_EVIDENCE_PACK = originalPackEnabled
    if (originalReportEnabled === undefined) delete Bun.env.M60_SYNTHETIC_DRAFT_REPORT
    else Bun.env.M60_SYNTHETIC_DRAFT_REPORT = originalReportEnabled
    if (originalRuntime === undefined) delete Bun.env.NODE_ENV
    else Bun.env.NODE_ENV = originalRuntime
  })

  test("creates, revisits and withholds the same real SQL-backed workspace", async () => {
    Bun.env.M54_SYNTHETIC_WORKSPACE = "enabled"
    Bun.env.M55_SYNTHETIC_BILL = "enabled"
    Bun.env.M56_SYNTHETIC_BILL_CALCULATION = "enabled"
    Bun.env.M57_SYNTHETIC_INVENTORY_REVIEW = "enabled"
    Bun.env.M58_SYNTHETIC_ANNUAL_REGISTER = "enabled"
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
  }, 15_000)

  test("requires both an explicit enable flag and a development/test runtime", async () => {
    for (const [enabled, billEnabled, calculationEnabled, inventoryEnabled, annualEnabled, runtime] of [[undefined, "enabled", "enabled", "enabled", "enabled", "development"], ["enabled", undefined, "enabled", "enabled", "enabled", "development"], ["enabled", "enabled", undefined, "enabled", "enabled", "development"], ["enabled", "enabled", "enabled", undefined, "enabled", "development"], ["enabled", "enabled", "enabled", "enabled", undefined, "development"], ["enabled", "enabled", "enabled", "enabled", "enabled", undefined], ["enabled", "enabled", "enabled", "enabled", "enabled", "staging"], ["enabled", "enabled", "enabled", "enabled", "enabled", "production"]] as const) {
      if (enabled === undefined) delete Bun.env.M54_SYNTHETIC_WORKSPACE
      else Bun.env.M54_SYNTHETIC_WORKSPACE = enabled
      if (billEnabled === undefined) delete Bun.env.M55_SYNTHETIC_BILL
      else Bun.env.M55_SYNTHETIC_BILL = billEnabled
      if (calculationEnabled === undefined) delete Bun.env.M56_SYNTHETIC_BILL_CALCULATION
      else Bun.env.M56_SYNTHETIC_BILL_CALCULATION = calculationEnabled
      if (inventoryEnabled === undefined) delete Bun.env.M57_SYNTHETIC_INVENTORY_REVIEW
      else Bun.env.M57_SYNTHETIC_INVENTORY_REVIEW = inventoryEnabled
      if (annualEnabled === undefined) delete Bun.env.M58_SYNTHETIC_ANNUAL_REGISTER
      else Bun.env.M58_SYNTHETIC_ANNUAL_REGISTER = annualEnabled
      if (runtime === undefined) delete Bun.env.NODE_ENV
      else Bun.env.NODE_ENV = runtime
      await expect(createDevelopmentWorkspaceServer()).rejects.toThrow("explicit development/test enable flags")
    }
    Bun.env.M54_SYNTHETIC_WORKSPACE="enabled";Bun.env.M55_SYNTHETIC_BILL="enabled";Bun.env.M56_SYNTHETIC_BILL_CALCULATION="enabled";Bun.env.M57_SYNTHETIC_INVENTORY_REVIEW="enabled";Bun.env.M58_SYNTHETIC_ANNUAL_REGISTER="enabled";Bun.env.NODE_ENV="test";delete Bun.env.M59_SYNTHETIC_EVIDENCE_PACK
    await expect(createDevelopmentWorkspaceServer()).rejects.toThrow("explicit development/test enable flags")
  })

  test("refuses non-owner bootstrap before creating any partial workspace", async () => {
    Bun.env.M54_SYNTHETIC_WORKSPACE = "enabled"
    Bun.env.M55_SYNTHETIC_BILL = "enabled"
    Bun.env.M56_SYNTHETIC_BILL_CALCULATION = "enabled"
    Bun.env.M57_SYNTHETIC_INVENTORY_REVIEW = "enabled"
    Bun.env.M58_SYNTHETIC_ANNUAL_REGISTER = "enabled"
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
    Bun.env.M57_SYNTHETIC_INVENTORY_REVIEW = "enabled"
    Bun.env.M58_SYNTHETIC_ANNUAL_REGISTER = "enabled"
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

    const prepareKey = crypto.randomUUID()
    const preparedResponse = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/inventories/2023/scope2/versions`, {
      method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ calculationId: calculationBody.draftCalculation.id, idempotencyKey: prepareKey }),
    }))
    expect(preparedResponse.status).toBe(201)
    const prepared = await preparedResponse.json() as { id: string; reviewState: string; completeness: string; releaseEligible: boolean; snapshotSha256: string; warnings: string[]; coverage: { coveredPeriods: number; expectedPeriods: number; missingMonths: string[] }; line: { quantityMwh: string; subtotalKgCo2e: string }; submittedBy: string; submittedAt:string; decision: null }
    expect(prepared).toMatchObject({ reviewState: "awaiting_review", completeness: "incomplete", releaseEligible: false, coverage: { coveredPeriods: 1, expectedPeriods: 12 }, line: { quantityMwh: "12.346000", subtotalKgCo2e: "2407.9674" }, submittedBy: "11111111-1111-4111-8111-111111111111", decision: null })
    expect(prepared.coverage.missingMonths).toHaveLength(11)
    expect(prepared.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(prepared.warnings).toEqual(["annual_coverage_incomplete_1_of_12_months", "market_based_scope2_not_included", "factor_and_method_not_released", "synthetic_local_only_no_assurance"])

    const decisionBody = { decision: "approve_bounded_draft", expectedInventorySnapshotSha256: prepared.snapshotSha256, acknowledgedWarnings: prepared.warnings, reasonCode: "bounded_synthetic_scope_reviewed", idempotencyKey: crypto.randomUUID() }
    const selfReview = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/inventories/${prepared.id}/decisions`, { method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M54_OWNER_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(decisionBody) }))
    expect(selfReview.status).toBe(409)
    const approvedResponse = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/inventories/${prepared.id}/decisions`, { method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${M55_ADMIN_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ ...decisionBody, idempotencyKey: crypto.randomUUID() }) }))
    expect(approvedResponse.status).toBe(201)
    const approved = await approvedResponse.json() as { reviewState: string; completeness: string; releaseEligible: boolean; decision: { decidedBy: string; outcome: string } }
    expect(approved).toMatchObject({ reviewState: "approved_bounded_draft", completeness: "incomplete", releaseEligible: false, decision: { decidedBy: "33333333-3333-4333-8333-333333333333", outcome: "approved_bounded_draft" } })
    const memberInventory = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/inventories/2023/scope2`, { headers: { origin: ORIGIN, authorization: `Bearer ${M55_MEMBER_TOKEN}` } }))
    expect(memberInventory.status).toBe(200)
    const outsiderInventory = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/inventories/2023/scope2`, { headers: { origin: ORIGIN, authorization: `Bearer ${M54_OUTSIDER_TOKEN}` } }))
    expect(outsiderInventory.status).toBe(404)

    const registerKey=crypto.randomUUID()
    const concurrentRegisters=await Promise.all(Array.from({length:3},()=>database.createAnnualRegister(prepared.submittedBy,workspace.id,prepared.id,registerKey)))
    expect(new Set(concurrentRegisters.map((item)=>item.id)).size).toBe(1)
    expect((await database.createAnnualRegister(prepared.submittedBy,workspace.id,prepared.id,registerKey)).id).toBe(concurrentRegisters[0]!.id)
    expect((await database.createAnnualRegister(prepared.submittedBy,workspace.id,prepared.id,crypto.randomUUID())).id).toBe(concurrentRegisters[0]!.id)
    const registerResponse = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-registers/2023`, { method:"POST", headers:{ origin:ORIGIN, authorization:`Bearer ${M54_OWNER_TOKEN}`, "content-type":"application/json" }, body:JSON.stringify({ previousInventoryVersionId:prepared.id,idempotencyKey:crypto.randomUUID() }) }))
    expect(registerResponse.status).toBe(201)
    const initialRegister=await registerResponse.json() as any
    expect(initialRegister).toMatchObject({version:1,status:"incomplete",counts:{expected:12,resolved:1,reported:1,missing:11},totals:null})
    expect(initialRegister.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(initialRegister.periods.map((period:any)=>period.state)).toEqual(["reported",...Array(11).fill("missing")])
    const completionKey=crypto.randomUUID()
    const concurrentCompletions=await Promise.all(Array.from({length:3},()=>database.completeAnnualRegister(prepared.submittedBy,workspace.id,initialRegister.id,initialRegister.snapshotSha256,completionKey)))
    expect(new Set(concurrentCompletions.map((item)=>item.id)).size).toBe(1)
    expect((await database.completeAnnualRegister(prepared.submittedBy,workspace.id,initialRegister.id,initialRegister.snapshotSha256,completionKey)).id).toBe(concurrentCompletions[0]!.id)
    expect((await database.completeAnnualRegister(prepared.submittedBy,workspace.id,initialRegister.id,initialRegister.snapshotSha256,crypto.randomUUID())).id).toBe(concurrentCompletions[0]!.id)
    const completedResponse=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-registers/${initialRegister.id}/complete`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M54_OWNER_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({expectedRegisterSnapshotSha256:initialRegister.snapshotSha256,fixtureId:"m58-fixed-electricity-register-2023-v1",idempotencyKey:crypto.randomUUID()})}))
    expect(completedResponse.status).toBe(201)
    const completed=await completedResponse.json() as any
    expect(completed).toMatchObject({version:2,status:"resolved_with_exceptions",counts:{expected:12,resolved:12,reported:10,estimated:1,excluded:1,missing:0,calculationBearing:11},totals:{reportedMwh:"126.788000",reportedKgCo2e:"24728.7681363744",estimatedMwh:"12.493000",estimatedKgCo2e:"2436.6383279784",includedMwh:"139.281000",includedKgCo2e:"27165.4064643528",includedDisplayKgCo2e:"27165.4065"}})
    expect(completed.periods[10]).toMatchObject({month:"2023-11",state:"estimated",quantityMwh:"12.493000",method:"mean_of_prior_two_reported_months_v1",basisMonths:["2023-09","2023-10"]})
    expect(completed.periods[11]).toMatchObject({month:"2023-12",state:"excluded",quantityMwh:null,emissionsKgCo2e:null,reason:"outside_operational_control_after_lease_end"})
    const annualKey=crypto.randomUUID()
    const concurrentAnnuals=await Promise.all(Array.from({length:3},()=>database.createAnnualInventory(prepared.submittedBy,workspace.id,completed.id,annualKey)))
    expect(new Set(concurrentAnnuals.map((item)=>item.id)).size).toBe(1)
    expect((await database.createAnnualInventory(prepared.submittedBy,workspace.id,completed.id,annualKey)).id).toBe(concurrentAnnuals[0]!.id)
    expect((await database.createAnnualInventory(prepared.submittedBy,workspace.id,completed.id,crypto.randomUUID())).id).toBe(concurrentAnnuals[0]!.id)
    const annualResponse=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/2023/scope2/versions`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M54_OWNER_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({registerId:completed.id,idempotencyKey:crypto.randomUUID()})}))
    expect(annualResponse.status).toBe(201)
    const annual=await annualResponse.json() as any
    expect(annual).toMatchObject({version:2,periodResolution:"resolved_with_exceptions",overallInventoryCompleteness:"incomplete",releaseEligible:false,counts:{resolved:12,reported:10,estimated:1,excluded:1,missing:0},decision:null})
    expect(annual.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    const annualDecision={decision:"approve_bounded_annual_location_draft",reasonCode:"bounded_annual_location_register_reviewed",acknowledgedWarnings:annual.warnings,expectedInventorySnapshotSha256:annual.snapshotSha256,idempotencyKey:crypto.randomUUID()}
    const annualSelf=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/decisions`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M54_OWNER_TOKEN}`,"content-type":"application/json"},body:JSON.stringify(annualDecision)}))
    expect(annualSelf.status).toBe(409)
    const annualApproved=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/decisions`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M55_ADMIN_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({...annualDecision,idempotencyKey:crypto.randomUUID()})}))
    expect(annualApproved.status).toBe(201)
    expect(await annualApproved.json()).toMatchObject({overallInventoryCompleteness:"incomplete",releaseEligible:false,decision:{outcome:"approved_bounded_annual_location_draft",decidedBy:"33333333-3333-4333-8333-333333333333"}})
    const packKey=crypto.randomUUID()
    const packResponse=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/evidence-packs`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M54_OWNER_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({expectedInventorySnapshotSha256:annual.snapshotSha256,idempotencyKey:packKey})}))
    expect(packResponse.status).toBe(201)
    const pack=await packResponse.json() as any
    expect(pack).toMatchObject({companyId:workspace.id,inventoryId:annual.id,profile:"neuvetra.synthetic.inventory-evidence-pack.v1",entryCount:17})
    expect(pack.archiveSha256).toMatch(/^[0-9a-f]{64}$/);expect(pack.manifestSha256).toMatch(/^[0-9a-f]{64}$/);expect(pack.archiveByteLength).toBeGreaterThan(4605)
    const repeated=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/evidence-packs`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M54_OWNER_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({expectedInventorySnapshotSha256:annual.snapshotSha256,idempotencyKey:crypto.randomUUID()})}))
    expect(await repeated.json()).toEqual(pack)
    const memberCannotCreate=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/evidence-packs`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M55_MEMBER_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({expectedInventorySnapshotSha256:annual.snapshotSha256,idempotencyKey:crypto.randomUUID()})}));expect(memberCannotCreate.status).toBe(403)
    const download=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/evidence-packs/${pack.id}/download`,{headers:{origin:ORIGIN,authorization:`Bearer ${M55_MEMBER_TOKEN}`}}));expect(download.status).toBe(200);expect(download.headers.get("x-neuvetra-archive-sha256")).toBe(pack.archiveSha256)
    const archive=await download.arrayBuffer();expect(archive.byteLength).toBe(pack.archiveByteLength)
    const replayForm=new FormData();replayForm.set("file",new File([archive],`neuvetra-m59-${annual.id}.zip`,{type:"application/zip"}))
    const replay=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/evidence-packs/${pack.id}/replay`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M55_MEMBER_TOKEN}`},body:replayForm}));expect(replay.status).toBe(200);expect(await replay.json()).toMatchObject({status:"verified_match",entryCount:17,reconstructed:{includedMwh:"139.281000",includedKgCo2e:"27165.4064643528",includedDisplayKgCo2e:"27165.4065"},overallInventoryCompleteness:"incomplete",releaseEligible:false})
    const staleReport=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/draft-reports`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M54_OWNER_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({evidencePackId:pack.id,expectedArchiveSha256:"0".repeat(64),expectedInventorySnapshotSha256:annual.snapshotSha256,idempotencyKey:crypto.randomUUID()})}));expect(staleReport.status).toBe(409);const absentReport=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/draft-reports/current`,{headers:{origin:ORIGIN,authorization:`Bearer ${M55_MEMBER_TOKEN}`}}));expect(absentReport.status).toBe(404)
    const malformedReport=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/draft-reports`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M54_OWNER_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({evidencePackId:pack.id})}));expect(malformedReport.status).toBe(422)
    const reportResponse=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/draft-reports`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M54_OWNER_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({evidencePackId:pack.id,expectedArchiveSha256:pack.archiveSha256,expectedInventorySnapshotSha256:annual.snapshotSha256,idempotencyKey:crypto.randomUUID()})}));expect(reportResponse.status).toBe(201);const report=await reportResponse.json() as any;expect(report).toMatchObject({profile:"neuvetra.synthetic.inventory-draft-report.v1",evidencePackId:pack.id,sourceArchiveSha256:pack.archiveSha256,inventorySnapshotSha256:annual.snapshotSha256})
    const memberReportCreate=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/draft-reports`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M55_MEMBER_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({evidencePackId:pack.id,expectedArchiveSha256:pack.archiveSha256,expectedInventorySnapshotSha256:annual.snapshotSha256,idempotencyKey:crypto.randomUUID()})}));expect(memberReportCreate.status).toBe(403)
    const reportDownload=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/draft-reports/${report.id}/download`,{headers:{origin:ORIGIN,authorization:`Bearer ${M55_MEMBER_TOKEN}`}}));expect(reportDownload.status).toBe(200);expect(reportDownload.headers.get("x-neuvetra-report-sha256")).toBe(report.reportSha256);const reportHtml=await reportDownload.text();expect(reportHtml).toContain("27165.4064643528 kg CO2e");expect(reportHtml).toContain("2023-11");expect(reportHtml).toContain("2023-12")
    const outsiderReport=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/draft-reports/current`,{headers:{origin:ORIGIN,authorization:`Bearer ${M54_OUTSIDER_TOKEN}`}}));expect(outsiderReport.status).toBe(404);const signedOutReport=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/draft-reports/current`,{headers:{origin:ORIGIN}}));expect(signedOutReport.status).toBe(401)
    const tampered=new Uint8Array(archive);tampered[100]^=1;const tamperedForm=new FormData();tamperedForm.set("file",new File([tampered],"tampered.zip",{type:"application/zip"}));const refused=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/evidence-packs/${pack.id}/replay`,{method:"POST",headers:{origin:ORIGIN,authorization:`Bearer ${M55_MEMBER_TOKEN}`},body:tamperedForm}));expect(refused.status).toBe(409)
    const outsiderPack=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/evidence-packs/current`,{headers:{origin:ORIGIN,authorization:`Bearer ${M54_OUTSIDER_TOKEN}`}}));expect(outsiderPack.status).toBe(404)
    const privileged=(database as unknown as {db:{exec:(sql:string)=>Promise<unknown>}}).db
    await privileged.exec("alter table neuvetra.inventory_draft_reports disable trigger inventory_report_immutable; update neuvetra.inventory_draft_reports set report_bytes=report_bytes||decode('00','hex'),report_sha256=encode(sha256(report_bytes||decode('00','hex')),'hex'),report_byte_length=octet_length(report_bytes)+1; alter table neuvetra.inventory_draft_reports enable trigger inventory_report_immutable")
    const corruptedReport=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/draft-reports/current`,{headers:{origin:ORIGIN,authorization:`Bearer ${M55_MEMBER_TOKEN}`}}));expect(corruptedReport.status).toBe(503)
    await privileged.exec("alter table neuvetra.inventory_evidence_packs disable trigger evidence_pack_immutable; update neuvetra.inventory_evidence_packs set archive_bytes=set_byte(archive_bytes,0,0); alter table neuvetra.inventory_evidence_packs enable trigger evidence_pack_immutable")
    const corruptedRead=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-inventories/${annual.id}/evidence-packs/current`,{headers:{origin:ORIGIN,authorization:`Bearer ${M55_MEMBER_TOKEN}`}}));expect(corruptedRead.status).toBe(503);expect(await corruptedRead.json()).toEqual({error:"Workspace is unavailable."})
    const memberRegister=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-registers/2023`,{headers:{origin:ORIGIN,authorization:`Bearer ${M55_MEMBER_TOKEN}`}}));expect(memberRegister.status).toBe(200)
    const outsiderRegister=await app.handle(new Request(`http://localhost/workspace/${workspace.id}/annual-registers/2023`,{headers:{origin:ORIGIN,authorization:`Bearer ${M54_OUTSIDER_TOKEN}`}}));expect(outsiderRegister.status).toBe(404)

    const foreign = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}`, {
      headers: { origin: ORIGIN, authorization: `Bearer ${M54_OUTSIDER_TOKEN}` },
    }))
    expect(foreign.status).toBe(404)
    expect(await foreign.json()).toEqual({ error: "Evidence not found." })
    const signedOut = await app.handle(new Request(`http://localhost/workspace/${workspace.id}/bills/${extracted.id}`))
    expect(signedOut.status).toBe(401)
  })
})
