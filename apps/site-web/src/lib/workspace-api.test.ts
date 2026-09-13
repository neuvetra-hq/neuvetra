import { describe, expect, test } from "bun:test"
import { correctSyntheticBill, createSyntheticWorkspace, decodeSyntheticBill, decodeWorkspace, linkSyntheticBill, revisitSyntheticWorkspace, uploadSyntheticBill } from "./workspace-api"

const fixture = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  companyName: "Synthetic Acme, Inc.",
  countryCode: "US",
  stateCode: "CA",
  facility: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Synthetic California office", egridSubregion: "CAMX" },
  boundary: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", reportingYear: 2023, approach: "operational_control", status: "draft", version: 1 },
}

const billFixture = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", companyId: fixture.id,
  originalName: "neuvetra-m55-synthetic-electricity-bill.pdf", mediaType: "application/pdf", byteLength: 4605,
  sha256: "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135", parserVersion: "m55-fixed-pdf-v1", state: "needs_review",
  supplierName: "Synthetic Golden State Electric", accountLabel: "SYNTHETIC-0001", billNumber: "SYN-CA-2023-01",
  servicePeriodStart: "2023-01-01", servicePeriodEnd: "2023-01-31",
  sourceLocators: { servicePeriod: { startByte: 3119, endByte: 3147 }, electricityKwh: { startByte: 3384, endByte: 3394 } },
  versions: [{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", version: 1, facilityId: null, electricityKwh: "12345.000", correctionReason: null }], draftActivity: null,
} as const

describe("M54 workspace browser boundary", () => {
  test("accepts only the fixed synthetic workspace contract", () => {
    expect(decodeWorkspace(fixture)).toEqual(fixture)
    for (const changed of [
      { ...fixture, ownerId: "injected" },
      { ...fixture, companyName: "Other" },
      { ...fixture, boundary: { ...fixture.boundary, version: 2 } },
      { ...fixture, facility: { ...fixture.facility, egridSubregion: "NWPP" } },
    ]) expect(() => decodeWorkspace(changed)).toThrow("not recognized")
  })

  test("sends only a synthetic bearer identity outside the body", async () => {
    let observed: { url: string; init?: RequestInit } | undefined
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      observed = { url: String(url), init }
      return Response.json(fixture, { status: 201 })
    }) as typeof fetch
    await createSyntheticWorkspace("owner", fetcher)
    expect(observed?.url).toBe("/workspace-api/workspace")
    expect(new Headers(observed?.init?.headers).get("authorization")).toBe("Bearer m54-synthetic-owner")
    expect(JSON.parse(String(observed?.init?.body))).not.toHaveProperty("userId")
  })

  test("keeps foreign and absent responses claim-free", async () => {
    const fetcher = (async () => Response.json({ error: "Workspace not found." }, { status: 404 })) as typeof fetch
    await expect(revisitSyntheticWorkspace(fixture.id, "outsider", fetcher)).rejects.toThrow("Workspace not found")
  })

  test("makes signed-out creation fail through the server contract", async () => {
    let headers: HeadersInit | undefined
    const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
      headers = init?.headers
      return Response.json({ error: "Authentication required." }, { status: 401 })
    }) as typeof fetch
    await expect(createSyntheticWorkspace("signed_out", fetcher)).rejects.toThrow("Authentication required")
    expect(new Headers(headers).has("authorization")).toBe(false)
  })
})

describe("M55 bill browser boundary", () => {
  test("accepts only the exact bounded bill response", () => {
    expect(decodeSyntheticBill(billFixture)).toEqual(billFixture)
    expect(() => decodeSyntheticBill({ ...billFixture, rawBytes: "injected" })).toThrow("not recognized")
    expect(() => decodeSyntheticBill({ ...billFixture, byteLength: 4606 })).toThrow("not recognized")
    expect(() => decodeSyntheticBill({ ...billFixture, versions: [{ ...billFixture.versions[0], facilityId: "foreign" }] })).toThrow("not recognized")
    expect(() => decodeSyntheticBill({ ...billFixture, state: "reviewed" })).toThrow("not recognized")
    expect(() => decodeSyntheticBill({ ...billFixture, servicePeriodStart: "2023-11-01" })).toThrow("not recognized")
    expect(() => decodeSyntheticBill({ ...billFixture, sourceLocators: { ...billFixture.sourceLocators, electricityKwh: { startByte: 0, endByte: 10 } } })).toThrow("not recognized")
  })

  test("uploads multipart without setting its content type", async () => {
    let observed: RequestInit | undefined
    const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => { observed = init; return Response.json(billFixture) }) as typeof fetch
    const file = new File([new Uint8Array(4605)], billFixture.originalName, { type: "application/pdf" })
    await uploadSyntheticBill(fixture.id, "owner", file, fetcher)
    expect(new Headers(observed?.headers).get("authorization")).toBe("Bearer m54-synthetic-owner")
    expect(new Headers(observed?.headers).has("content-type")).toBe(false)
    expect(observed?.body).toBeInstanceOf(FormData)
  })

  test("sends only the fixed correction and boundary link", async () => {
    const bodies: unknown[] = []
    const correctionFetcher = (async (_url: string | URL | Request, init?: RequestInit) => { if (init?.body) bodies.push(JSON.parse(String(init.body))); return Response.json(billFixture) }) as typeof fetch
    await correctSyntheticBill(fixture, billFixture.id, "owner", correctionFetcher)
    const reviewedFixture = { ...billFixture, state: "reviewed", versions: [...billFixture.versions, { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", version: 2, facilityId: fixture.facility.id, electricityKwh: "12346.000", correctionReason: "Synthetic review exercise" }] }
    const linkFetcher = (async (_url: string | URL | Request, init?: RequestInit) => { if (init?.body) bodies.push(JSON.parse(String(init.body))); return Response.json(reviewedFixture) }) as typeof fetch
    await linkSyntheticBill(fixture, billFixture.id, "owner", linkFetcher)
    expect(bodies).toEqual([
      { facilityId: fixture.facility.id, priorVersionId: billFixture.versions[0].id, electricityKwh: "12346.000", reason: "Synthetic review exercise" },
      { boundaryId: fixture.boundary.id, billVersionId: reviewedFixture.versions[1].id },
    ])
  })
})
