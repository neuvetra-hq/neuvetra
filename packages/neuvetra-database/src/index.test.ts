import { afterEach, describe, expect, test } from "bun:test"
import { DevelopmentWorkspaceDatabase, type SyntheticWorkspaceInput } from "./index"

const OWNER = "11111111-1111-4111-8111-111111111111"
const OUTSIDER = "22222222-2222-4222-8222-222222222222"
const input: SyntheticWorkspaceInput = {
  companyName: "Synthetic Acme, Inc.",
  facilityName: "Synthetic California office",
  countryCode: "US",
  stateCode: "CA",
  egridSubregion: "CAMX",
  reportingYear: 2023,
  approach: "operational_control",
}
const billFixture = new URL("../../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf", import.meta.url)

describe("M54 development workspace database", () => {
  let database: DevelopmentWorkspaceDatabase | undefined
  afterEach(async () => database?.close())

  test("creates and revisits an owner workspace while hiding it from another user", async () => {
    database = await DevelopmentWorkspaceDatabase.create([OWNER, OUTSIDER])
    const created = await database.createWorkspace(OWNER, input)
    expect(created).toMatchObject({ companyName: input.companyName, facility: { name: input.facilityName }, boundary: { version: 1 } })
    expect(await database.findWorkspace(OWNER, created.id)).toEqual(created)
    expect(await database.findWorkspace(OUTSIDER, created.id)).toBeNull()
  })

  test("refuses a duplicate synthetic company atomically", async () => {
    database = await DevelopmentWorkspaceDatabase.create([OWNER])
    const first = await database.createWorkspace(OWNER, input)
    await expect(database.createWorkspace(OWNER, input)).rejects.toThrow()
    expect(await database.findWorkspace(OWNER, first.id)).toEqual(first)
  })

  test("preserves a fixed bill, reviewed correction and version-pinned draft link", async () => {
    database = await DevelopmentWorkspaceDatabase.create([OWNER, OUTSIDER])
    const workspace = await database.createWorkspace(OWNER, input)
    const bytes = new Uint8Array(await Bun.file(billFixture).arrayBuffer())
    const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    const extracted = await database.ingestSyntheticBill(OWNER, workspace.id, bytes, hash)
    expect(extracted.state).toBe("needs_review")
    expect(extracted.versions).toEqual([expect.objectContaining({ version: 1, facilityId: null, electricityKwh: "12345.000", correctionReason: null })])
    expect(extracted.draftActivity).toBeNull()
    expect((await database.ingestSyntheticBill(OWNER, workspace.id, bytes, hash)).id).toBe(extracted.id)
    expect(await database.findSyntheticBill(OUTSIDER, workspace.id, extracted.id)).toBeNull()

    const reviewed = await database.correctSyntheticBill(OWNER, workspace.id, extracted.id, workspace.facility.id)
    expect(reviewed.state).toBe("reviewed")
    expect(reviewed.versions).toHaveLength(2)
    expect(reviewed.versions[1]).toMatchObject({ version: 2, facilityId: workspace.facility.id, electricityKwh: "12346.000", correctionReason: "Synthetic review exercise" })
    expect((await database.correctSyntheticBill(OWNER, workspace.id, extracted.id, workspace.facility.id)).versions).toHaveLength(2)

    const linked = await database.linkSyntheticBill(OWNER, workspace.id, extracted.id, workspace.boundary.id)
    expect(linked.state).toBe("linked_draft")
    expect(linked.draftActivity).toMatchObject({ billVersionId: reviewed.versions[1]!.id, quantityMwh: "12.346000", status: "draft" })
    expect((await database.linkSyntheticBill(OWNER, workspace.id, extracted.id, workspace.boundary.id)).draftActivity?.id).toBe(linked.draftActivity?.id)
  })

  test("converges concurrent duplicate bill commands on one lineage", async () => {
    database = await DevelopmentWorkspaceDatabase.create([OWNER])
    const workspace = await database.createWorkspace(OWNER, input)
    const bytes = new Uint8Array(await Bun.file(billFixture).arrayBuffer())
    const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    const ingested = await Promise.all(Array.from({ length: 3 }, () => database!.ingestSyntheticBill(OWNER, workspace.id, bytes, hash)))
    expect(new Set(ingested.map((bill) => bill.id)).size).toBe(1)
    const reviewed = await Promise.all(Array.from({ length: 3 }, () => database!.correctSyntheticBill(OWNER, workspace.id, ingested[0]!.id, workspace.facility.id)))
    expect(reviewed.every((bill) => bill.versions.length === 2 && bill.versions[1]!.id === reviewed[0]!.versions[1]!.id)).toBe(true)
    const linked = await Promise.all(Array.from({ length: 3 }, () => database!.linkSyntheticBill(OWNER, workspace.id, ingested[0]!.id, workspace.boundary.id)))
    expect(linked.every((bill) => bill.draftActivity?.id === linked[0]!.draftActivity?.id)).toBe(true)
  })

  test("rolls back the whole workspace when fixed membership seeding fails", async () => {
    const admin = "33333333-3333-4333-8333-333333333333"
    database = await DevelopmentWorkspaceDatabase.create([OWNER, admin])
    await expect(database.createWorkspaceWithSyntheticMembers(OWNER, input, [
      { userId: admin, role: "admin" }, { userId: admin, role: "member" },
    ])).rejects.toThrow()
    const created = await database.createWorkspace(OWNER, input)
    expect(created.companyName).toBe(input.companyName)
  })
})
