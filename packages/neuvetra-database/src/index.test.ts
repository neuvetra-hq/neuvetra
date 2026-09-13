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
})
