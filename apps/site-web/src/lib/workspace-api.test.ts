import { describe, expect, test } from "bun:test"
import { createSyntheticWorkspace, decodeWorkspace, revisitSyntheticWorkspace } from "./workspace-api"

const fixture = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  companyName: "Synthetic Acme, Inc.",
  countryCode: "US",
  stateCode: "CA",
  facility: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Synthetic California office", egridSubregion: "CAMX" },
  boundary: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", reportingYear: 2023, approach: "operational_control", status: "draft", version: 1 },
}

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
