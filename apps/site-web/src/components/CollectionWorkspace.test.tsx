import { describe, expect, spyOn, test } from "bun:test"
import type { CollectionActivity } from "../../../../packages/neuvetra-database/src/collection-contract"
import * as collectionApi from "../lib/collection-api"
import { automaticZipSelection, collectionReadinessFindings, exclusivePeriodEnd, inclusivePeriodEnd, isDefiniteUploadFailure, locationReadinessFindings, notCalculableReasons, periodsOverlap, replaceSavedCollectionRecord, requiresCurrentLocationReselection, saveAndVerifyCollectionActivity, thousandsSeparatorSuggestion } from "./CollectionWorkspace"

const base = (): CollectionActivity => ({
  kind: "natural_gas",
  locationId: crypto.randomUUID(),
  setupVersionId: crypto.randomUUID(),
  sourceId: "GAS-ACCOUNT-1",
  state: "active",
  withdrawalReason: null,
  quantity: { originalValue: "1234.5", originalUnit: "therm", normalizedValue: "1234.5", normalizedUnit: "therm" },
  quality: "actual",
  estimateBasis: null,
  period: { start: "2025-01-01", endExclusive: "2025-02-01" },
  reference: "Synthetic bill",
  notes: "",
  evidenceIds: [],
  payload: { heatContent: null },
})

describe("collection form accounting boundaries", () => {
  test("collects an inclusive last day and converts it to the exclusive engine boundary", () => {
    expect(exclusivePeriodEnd("2025-01-31")).toBe("2025-02-01")
    expect(inclusivePeriodEnd("2026-01-01")).toBe("2025-12-31")
    expect(exclusivePeriodEnd("2025-02-28")).toBe("2025-03-01")
  })

  test("requires explicit acceptance before removing thousands separators", () => {
    expect(thousandsSeparatorSuggestion("1,234.5")).toBe("1234.5")
    expect(thousandsSeparatorSuggestion("1234.5")).toBeNull()
    const activity = base()
    activity.quantity.originalValue = "1,234.5"
    expect(notCalculableReasons(activity)).toContain("Quantity uses thousands separators. Confirm the plain-decimal suggestion before calculation.")
  })

  test("requires heat content only for volumetric natural-gas units", () => {
    const therm = base()
    expect(notCalculableReasons(therm)).toEqual([])
    const ccf = base()
    ccf.quantity.originalUnit = "ccf"
    ccf.quantity.normalizedUnit = "ccf"
    expect(notCalculableReasons(ccf)).toContain("Bill heat content is missing.")
  })

  test("finds overlapping periods but allows adjacent periods", () => {
    expect(periodsOverlap({ start: "2025-01-01", endExclusive: "2025-02-01" }, { start: "2025-01-31", endExclusive: "2025-03-01" })).toBe(true)
    expect(periodsOverlap({ start: "2025-01-01", endExclusive: "2025-02-01" }, { start: "2025-02-01", endExclusive: "2025-03-01" })).toBe(false)
  })

  test("keeps withdrawn records and rejected evidence out of calculable state", () => {
    const withdrawn = base()
    withdrawn.state = "withdrawn"
    withdrawn.withdrawalReason = "Entered twice"
    expect(notCalculableReasons(withdrawn)).toEqual(["Withdrawn: Entered twice"])

    const electricity: CollectionActivity = {
      ...base(),
      kind: "electricity",
      sourceId: "METER-1",
      quantity: { originalValue: "100", originalUnit: "MWh", normalizedValue: "100", normalizedUnit: "MWh" },
      payload: { meterOrAccountNumber: "METER-1", utilityName: "Synthetic utility", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: null, instruments: [{ type: "energy_attribute_certificate", mwh: "100", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", generationTechnology: "wind", rateLbPerMwh: null }] },
      evidenceIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
    }
    const evidence = [{ id: electricity.evidenceIds[0]!, quarantineStatus: "rejected" }] as Parameters<typeof notCalculableReasons>[1]
    expect(notCalculableReasons(electricity, evidence)).toContain("Market-based instrument 1 evidence was rejected and must be removed.")
  })

  test("auto-populates a sole verified utility for a single-subregion ZIP", () => {
    const sole = { zip: "94105", subregions: ["CAMX"], utilities: [{ subregion: "CAMX", utility: "Synthetic utility", eiaId: "123", state: "CA", predominantUtility: true }], needsUtilityChoice: false, found: true, source: "Pinned lookup" }
    expect(automaticZipSelection(sole)).toEqual({ subregion: "CAMX", utilityName: "Synthetic utility", utilityEiaId: "123" })
    expect(automaticZipSelection({ ...sole, utilities: [...sole.utilities, { ...sole.utilities[0]!, utility: "Second utility", eiaId: "456" }] })).toEqual({ subregion: "CAMX", utilityName: "", utilityEiaId: null })
    expect(automaticZipSelection({ ...sole, subregions: ["CAMX", "NWPP"], needsUtilityChoice: true })).toBeNull()
  })

  test("labels vehicle partial results and fugitive engine outcomes accurately", () => {
    const vehicle: CollectionActivity = { ...base(), kind: "vehicle", sourceId: "FLEET-1", quantity: { originalValue: "100", originalUnit: "US_gallon", normalizedValue: "100", normalizedUnit: "US_gallon" }, payload: { vehicleGroupId: "FLEET-1", fuel: "diesel", vehicleType: "diesel_light_duty_truck", modelYear: 2020, gallons: "100", vehicleCount: null, miles: null, fuelEconomy: null } }
    expect(collectionReadinessFindings(vehicle)).toContainEqual({ status: "partial", reason: "CO2 can calculate from gallons, but miles or fuel economy is needed to calculate CH4 and N2O." })
    vehicle.payload.fuelEconomy = { mpg: "20", source: "fleet_record" }
    expect(collectionReadinessFindings(vehicle)).toEqual([])

    const fugitive: CollectionActivity = { ...base(), kind: "fugitive", sourceId: "CHILLER-1", quantity: { originalValue: "1.000", originalUnit: "kg", normalizedValue: "1.000", normalizedUnit: "kg" }, payload: { gas: "R-410A", unit: "kg", terms: { PN: "0", CN: "0", PS: "1", CD: "0", RD: "0" }, insideBoundary: true, maintainsRefrigerantStock: true, retrofitInPeriod: null, contractorRecordsComplete: true, eventChronologyComplete: true } }
    expect(collectionReadinessFindings(fugitive)).toContainEqual({ status: "review_required", reason: "The simplified method is not applicable when refrigerant stock is maintained or equipment was retrofitted." })
    expect(collectionReadinessFindings(fugitive).some(finding => finding.reason.includes("unknown"))).toBe(false)
    fugitive.payload.insideBoundary = false
    expect(collectionReadinessFindings(fugitive)).toContainEqual({ status: "excluded", reason: "Equipment is outside the declared reporting boundary." })
  })

  test("holds legacy vehicle tokens and non-included locations pending correction", () => {
    const vehicle: CollectionActivity = { ...base(), kind: "vehicle", sourceId: "FLEET-1", quantity: { originalValue: "100", originalUnit: "US_gallon", normalizedValue: "100", normalizedUnit: "US_gallon" }, payload: { vehicleGroupId: "FLEET-1", fuel: "Diesel", vehicleType: "Light-Duty Trucks", modelYear: 2020, gallons: "100", vehicleCount: null, miles: null, fuelEconomy: null } }
    expect(collectionReadinessFindings(vehicle)).toEqual(expect.arrayContaining([
      { status: "input_needed", reason: "Vehicle fuel “Diesel” is a legacy or unsupported value. Choose gasoline or diesel before calculation." },
      { status: "input_needed", reason: "Vehicle type “Light-Duty Trucks” is a legacy, unsupported, or incompatible value. Choose a vehicle type for the selected fuel before calculation." },
    ]))
    vehicle.payload.fuel = "diesel"
    vehicle.payload.vehicleType = "diesel_light_duty_truck"
    expect(collectionReadinessFindings(vehicle)).toContainEqual({ status: "partial", reason: "CO2 can calculate from gallons, but miles or fuel economy is needed to calculate CH4 and N2O." })

    const context = { companyId: crypto.randomUUID(), setupVersionId: vehicle.setupVersionId, setupRevision: 1, locations: [{ id: vehicle.locationId, name: "Excluded warehouse", inclusion: "excluded" as const, control: "operational_control" }] }
    expect(locationReadinessFindings(vehicle, context)).toEqual([{ status: "excluded", reason: "Held: location excluded by company setup (location_excluded_by_company_setup)." }])
    expect(locationReadinessFindings(vehicle, { ...context, locations: [{ ...context.locations[0]!, inclusion: "unknown" as const }] })).toEqual([{ status: "input_needed", reason: "Held: location inclusion is undecided (location_inclusion_unknown)." }])
  })

  test("treats only a pre-storage file mismatch 422 as definite", () => {
    expect(isDefiniteUploadFailure(new collectionApi.CollectionApiError("File type does not match its content.", 422, "file_type_mismatch"))).toBe(true)
    expect(isDefiniteUploadFailure(new collectionApi.CollectionApiError("Registration failed after storage.", 422))).toBe(false)
    expect(isDefiniteUploadFailure(new collectionApi.CollectionApiError("Temporary failure.", 500))).toBe(false)
  })

  test("uses the save read-back without requesting the full company history again", async () => {
    const companyId = "11111111-1111-4111-8111-111111111111"
    const recordId = "22222222-2222-4222-8222-222222222222"
    const versionId = "33333333-3333-4333-8333-333333333333"
    const actorId = "44444444-4444-4444-8444-444444444444"
    const activity = base()
    const version = { id: versionId, recordId, companyId, revision: 1, previousVersionId: null, correctionReason: null, activity, payloadSha256: "a".repeat(64), createdBy: actorId, createdAt: "2026-09-29T12:00:00.000Z" }
    const { activity: _activity, ...summary } = version
    const record = { id: recordId, companyId, kind: activity.kind, currentVersion: version, history: [summary] }
    const input = { idempotencyKey: "55555555-5555-4555-8555-555555555555", expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity }
    const list = spyOn(collectionApi, "listCollectionActivities").mockRejectedValue(new Error("full-list read must not run after save"))
    const originalFetch = globalThis.fetch
    const requests: Array<{ url: string; method: string }> = []
    globalThis.fetch = (async (request, init) => {
      requests.push({ url: String(request), method: init?.method ?? "GET" })
      return Response.json({ record, version, replayed: false }, { status: 201 })
    }) as typeof fetch
    try {
      const result = await saveAndVerifyCollectionActivity(companyId, recordId, input, { userId: actorId, accessToken: "synthetic-token", role: "owner" })
      expect(result.record).toEqual(record)
      expect(requests).toEqual([{ url: `/workspace-api/workspace/${companyId}/collection/activities/${recordId}`, method: "POST" }])
      expect(list).toHaveBeenCalledTimes(0)
      expect(replaceSavedCollectionRecord([
        { ...record, id: "00000000-0000-4000-8000-000000000001" },
        { ...record, id: recordId, currentVersion: { ...version, revision: 0 } },
        { ...record, id: "ffffffff-ffff-4fff-8fff-ffffffffffff" },
      ], record).map(item => item.id)).toEqual(["00000000-0000-4000-8000-000000000001", recordId, "ffffffff-ffff-4fff-8fff-ffffffffffff"])
    } finally {
      globalThis.fetch = originalFetch
      list.mockRestore()
    }
  })

  test("requires a fresh location selection only when the saved setup link is stale", () => {
    const activity = base()
    const current = { companyId: crypto.randomUUID(), setupVersionId: activity.setupVersionId, setupRevision: 2, locations: [{ id: activity.locationId, name: "Current office", inclusion: "included" as const, control: "operational_control" }] }
    expect(requiresCurrentLocationReselection(activity, current)).toBe(false)
    expect(requiresCurrentLocationReselection(activity, { ...current, setupVersionId: crypto.randomUUID() })).toBe(true)
    expect(requiresCurrentLocationReselection(activity, { ...current, locations: [] })).toBe(true)
  })
})
