import { afterEach, describe, expect, test } from "bun:test"
import { CollectionApiError, loadCollectionContext, loadCollectionOverview, lookupCollectionZip, uploadCollectionEvidence } from "./collection-api"

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const setupVersionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const locationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const actor = { userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", accessToken: "synthetic-token", role: "owner" as const }
const originalFetch = globalThis.fetch

afterEach(() => { globalThis.fetch = originalFetch })

describe("collection context and ZIP browser boundary", () => {
  test("preserves boundary metadata and rejects malformed supplied boundary fields", async () => {
    const location = { id: locationId, name: "Direct company office", inclusion: "included", control: "reporting_company", entityId: null, entity: null,
      start: null, endExclusive: null, startMode: "period_start", endMode: "period_end" }
    const context = { companyId, setupVersionId, setupRevision: 2, boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [location] }
    const respond = (body: unknown) => { globalThis.fetch = (async () => Response.json({ context: body })) as typeof fetch }
    respond(context)
    expect(await loadCollectionContext(companyId, actor)).toEqual(context)
    for (const bad of [{ ...context, boundaryApproach: "guess" }, { ...context, reportingPeriod: null },
      { ...context, locations: [{ ...location, startMode: "calendar_year" }] },
      { ...context, locations: [{ ...location, entityId: locationId, entity: { id: companyId, inclusion: "included", control: "operational_control", ownershipPercent: "50" } }] },
      { ...context, locations: [{ ...location, entityId: locationId, entity: { id: locationId, inclusion: "included", control: "operational_control", ownershipPercent: "150" } }] }]) {
      respond(bad)
      await expect(loadCollectionContext(companyId, actor)).rejects.toThrow("not recognized")
    }
  })
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

  test("BF2: accepts the same-content setup versions only as UUIDs that include the current version", async () => {
    const earlier = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
    const respond = (context: Record<string, unknown>) => { globalThis.fetch = (async () => Response.json({ context: { companyId, setupVersionId, setupRevision: 3, locations: [], ...context } })) as typeof fetch }
    respond({ sameContentSetupVersionIds: [setupVersionId, earlier] })
    expect((await loadCollectionContext(companyId, actor)).sameContentSetupVersionIds).toEqual([setupVersionId, earlier])
    respond({})
    expect((await loadCollectionContext(companyId, actor)).sameContentSetupVersionIds).toBeUndefined()
    respond({ setupVersionId: null, setupRevision: null, sameContentSetupVersionIds: [] })
    expect((await loadCollectionContext(companyId, actor)).sameContentSetupVersionIds).toEqual([])
    for (const bad of [{ sameContentSetupVersionIds: [earlier] }, { sameContentSetupVersionIds: [setupVersionId, "not-a-uuid"] }, { sameContentSetupVersionIds: [setupVersionId, setupVersionId] },
      { sameContentSetupVersionIds: setupVersionId }, { sameContentSetupVersionIds: null }, { setupVersionId: null, setupRevision: null, sameContentSetupVersionIds: [earlier] }]) {
      respond(bad)
      await expect(loadCollectionContext(companyId, actor)).rejects.toThrow("not recognized")
    }
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

  test("declares text/csv for a CSV that Windows with Excel reports as application/vnd.ms-excel, and sends the file unchanged", async () => {
    const uploadId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
    const sent: { url: string; method?: string; headers: Headers; body: unknown }[] = []
    globalThis.fetch = (async (input, init) => {
      sent.push({ url: String(input), method: init?.method, headers: new Headers(init?.headers), body: init?.body })
      return Response.json({ receipt: { evidenceId: uploadId, reused: false } }, { status: 201 })
    }) as typeof fetch
    const upload = async (name: string, type: string) => {
      const file = new File(["fuel,gallons\nDiesel,12\n"], name, { type })
      await uploadCollectionEvidence(companyId, file, uploadId, actor)
      const request = sent.at(-1)!
      expect(request.body).toBe(file)
      return request.headers.get("content-type")
    }
    expect(await upload("Fuel Log.CSV", "application/vnd.ms-excel")).toBe("text/csv")
    expect(sent[0]).toMatchObject({ url: `/workspace-api/workspace/${companyId}/collection/evidence`, method: "POST" })
    expect(sent[0]!.headers.get("x-neuvetra-original-name")).toBe(encodeURIComponent("Fuel Log.CSV"))
    expect(sent[0]!.headers.get("x-neuvetra-upload-id")).toBe(uploadId)
    expect(await upload("fuel-log.csv", "")).toBe("text/csv")
    expect(await upload("meters.xlsx", "")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    expect(await upload("fuel-log.csv", "text/csv")).toBe("text/csv")
    // A different explicit type is kept, and an unknown file with no type is still sent as octet-stream: the server decides.
    expect(await upload("fuel-log.csv", "image/png")).toBe("image/png")
    expect(await upload("old-meters.xls", "application/vnd.ms-excel")).toBe("application/vnd.ms-excel")
    expect(await upload("notes", "")).toBe("application/octet-stream")
  })
})

describe("I-02: the per-kind Scope 3 capability", () => {
  const respond = (capabilities: unknown) => { globalThis.fetch = (async () => Response.json({ profile: "neuvetra.collection.v1", context: { companyId, setupVersionId, setupRevision: 1, locations: [] }, capabilities })) as typeof fetch }
  test("lists the kinds the server's database stores; an older server means the four 0029 kinds", async () => {
    respond({ scope3: { gridLossLineage: true, calculations: true, kinds: ["transport", "purchase_spend", "made_up_kind"], completion: true } })
    expect((await loadCollectionOverview(companyId, actor)).scope3Kinds).toEqual(["transport", "purchase_spend"])
    respond({ scope3: { gridLossLineage: true, calculations: true } })
    expect((await loadCollectionOverview(companyId, actor)).scope3Kinds).toEqual(["transport", "waste", "business_travel", "employee_commuting"])
    respond({ scope3: { gridLossLineage: true, calculations: false, kinds: ["transport"] } })
    expect(await loadCollectionOverview(companyId, actor)).toMatchObject({ scope3: false, scope3Kinds: [] })
    respond(undefined)
    expect(await loadCollectionOverview(companyId, actor)).toMatchObject({ scope3: false, scope3Kinds: [] })
  })
  // I-08: data quality and business travel v2 are offered only when the server's database has 0030 (schema 30).
  test("the 0030 payload additions are offered only when the server says completion is available", async () => {
    respond({ scope3: { gridLossLineage: true, calculations: true, kinds: ["transport"], completion: true } })
    expect((await loadCollectionOverview(companyId, actor)).scope3Completion).toBe(true)
    for (const scope3 of [{ gridLossLineage: true, calculations: true, kinds: ["transport"], completion: false }, { gridLossLineage: true, calculations: true }, { calculations: false, completion: true }]) {
      respond({ scope3 })
      expect((await loadCollectionOverview(companyId, actor)).scope3Completion).toBe(false)
    }
    respond(undefined)
    expect((await loadCollectionOverview(companyId, actor)).scope3Completion).toBe(false)
  })
})
