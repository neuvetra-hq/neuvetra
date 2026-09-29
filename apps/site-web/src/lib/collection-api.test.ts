import { afterEach, describe, expect, test } from "bun:test"
import { CollectionApiError, loadCollectionContext, lookupCollectionZip, uploadCollectionEvidence } from "./collection-api"

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const setupVersionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const locationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const actor = { userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", accessToken: "synthetic-token", role: "owner" as const }
const originalFetch = globalThis.fetch

afterEach(() => { globalThis.fetch = originalFetch })

describe("collection context and ZIP browser boundary", () => {
  test("loads tenant-scoped company setup locations", async () => {
    let requested = ""
    globalThis.fetch = (async (input, init) => {
      requested = String(input)
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-token")
      return Response.json({ profile: "neuvetra.collection.v1", context: { companyId, setupVersionId, setupRevision: 2, locations: [{ id: locationId, name: "Synthetic office", inclusion: "included", control: "operational control" }] } })
    }) as typeof fetch
    const context = await loadCollectionContext(companyId, actor)
    expect(requested).toBe(`/workspace-api/workspace/${companyId}/collection`)
    expect(context.locations[0]?.id).toBe(locationId)
  })

  test("uses the ZIP lookup route and preserves the server's ambiguity decision", async () => {
    let requested = ""
    globalThis.fetch = (async input => {
      requested = String(input)
      return Response.json({ lookup: { zip: "94105", subregions: ["CAMX", "NWPP"], utilities: [{ subregion: "CAMX", utility: "Synthetic utility", eiaId: "123", state: "CA", predominantUtility: true }], needsUtilityChoice: true, found: true, source: "Pinned synthetic lookup" } })
    }) as typeof fetch
    const lookup = await lookupCollectionZip(companyId, "94105", actor)
    expect(requested).toBe(`/workspace-api/workspace/${companyId}/collection/zip-lookup?zip=94105`)
    expect(lookup.needsUtilityChoice).toBe(true)
    expect(lookup.utilities[0]?.eiaId).toBe("123")
  })

  test("rejects malformed context and lookup responses", async () => {
    globalThis.fetch = (async () => Response.json({ context: { companyId, setupVersionId: "wrong", setupRevision: 2, locations: [] } })) as typeof fetch
    await expect(loadCollectionContext(companyId, actor)).rejects.toThrow("not recognized")
    globalThis.fetch = (async () => Response.json({ lookup: { zip: "94105", subregions: "CAMX", utilities: [], needsUtilityChoice: false, found: true, source: "Pinned" } })) as typeof fetch
    await expect(lookupCollectionZip(companyId, "94105", actor)).rejects.toThrow("not recognized")
  })

  test("preserves the exact pre-storage file mismatch code without treating other 422s as equivalent", async () => {
    const file = new File(["not a PDF"], "bill.pdf", { type: "application/pdf" })
    const uploadId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
    globalThis.fetch = (async () => Response.json({ error: "Evidence file does not match its declared type.", code: "file_type_mismatch" }, { status: 422 })) as typeof fetch
    try {
      await uploadCollectionEvidence(companyId, file, uploadId, actor)
      throw new Error("Expected upload refusal.")
    } catch (cause) {
      expect(cause).toBeInstanceOf(CollectionApiError)
      expect((cause as CollectionApiError).code).toBe("file_type_mismatch")
    }
    globalThis.fetch = (async () => Response.json({ error: "Invalid or unsupported collection record." }, { status: 422 })) as typeof fetch
    try {
      await uploadCollectionEvidence(companyId, file, uploadId, actor)
      throw new Error("Expected upload refusal.")
    } catch (cause) {
      expect(cause).toBeInstanceOf(CollectionApiError)
      expect((cause as CollectionApiError).code).toBeNull()
    }
  })
})
