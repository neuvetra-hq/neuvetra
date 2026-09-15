import type { WorkspaceDatabase } from "@neuvetra/database"
import { runEngine } from "../calculation/server"
import { INVENTORY_WARNINGS, type InventoryDecisionInput, type WorkspaceStore } from "./types"

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`
}

export function createWorkspaceStore(database: WorkspaceDatabase, createWorkspace: WorkspaceStore["create"], calculate = runEngine): WorkspaceStore {
  const calculationFlights = new Map<string, Promise<Awaited<ReturnType<typeof database.createSyntheticBillCalculation>>>>()
  return {
      create: createWorkspace,
      findById: (userId, workspaceId) => database.findWorkspace(userId, workspaceId),
      canManage: (userId, workspaceId) => database.canManageWorkspace(userId, workspaceId),
      ingestBill: (userId, workspaceId, bytes, sha256) => database.ingestSyntheticBill(userId, workspaceId, bytes, sha256),
      correctBill: (userId, workspaceId, evidenceId, facilityId) => database.correctSyntheticBill(userId, workspaceId, evidenceId, facilityId),
      linkBill: (userId, workspaceId, evidenceId, boundaryId) => database.linkSyntheticBill(userId, workspaceId, evidenceId, boundaryId),
      calculateBill: async (userId, workspaceId, evidenceId, idempotencyKey) => {
        const [workspace, bill, lineage] = await Promise.all([
          database.findWorkspace(userId, workspaceId),
          database.findSyntheticBill(userId, workspaceId, evidenceId),
          database.findSyntheticCalculationLineage(userId, workspaceId, evidenceId),
        ])
        const activity = bill?.draftActivity
        const reviewed = bill?.versions.find((version) => version.version === 2)
        if (!workspace || !bill || !lineage || !activity || !reviewed?.facilityId || reviewed.id !== activity.billVersionId || lineage.previousBillVersionId !== bill.versions[0]?.id) throw new Error("Linked draft evidence required.")
        const binding = {
          company_id: workspace.id, evidence_id: bill.id, bill_version_id: reviewed.id, activity_version_id: activity.id,
          facility_id: workspace.facility.id, boundary_id: workspace.boundary.id, bill_version: 2, activity_version: lineage.activityVersion,
          extraction_id: lineage.extractionId, parser_version: lineage.parserVersion, previous_bill_version_id: lineage.previousBillVersionId,
          evidence_sha256: bill.sha256, source_quantity_kwh: reviewed.electricityKwh, normalized_quantity_mwh: activity.quantityMwh,
          correction_reason: reviewed.correctionReason, service_period: { start: bill.servicePeriodStart, end: bill.servicePeriodEnd },
          facility: { name: workspace.facility.name, country: "United States", state: "California", egrid_subregion: workspace.facility.egridSubregion },
          boundary: { reporting_year: workspace.boundary.reportingYear, approach: workspace.boundary.approach, status: workspace.boundary.status, version: workspace.boundary.version },
        }
        const inputHash = new Bun.CryptoHasher("sha256").update(canonicalJson(binding)).digest("hex")
        const operationFingerprint = new Bun.CryptoHasher("sha256").update(`${workspace.id}:${activity.id}:scope2-location-based-egrid-subregion:2023-r2-camx-v1:${inputHash}`).digest("hex")
        const priorRequest = await database.findSyntheticCalculationIdempotency(userId, workspace.id, idempotencyKey)
        if (priorRequest) {
          if (priorRequest.operationFingerprint !== operationFingerprint) throw new Error("Calculation request conflicts.")
          return bill.draftCalculation ? bill : (await database.findSyntheticBill(userId, workspace.id, evidenceId))!
        }
        const flightKey = `${workspace.id}:${activity.id}:2023-r2-camx-v1`
        const existingFlight = calculationFlights.get(flightKey)
        if (existingFlight) return existingFlight
        const flight = (async () => {
          const response = await calculate({
            action: "calculate_linked_bill",
            binding,
          }) as { status?: unknown; record?: Record<string, unknown> }
          if (response.status !== "ok" || !response.record) throw new Error("Calculation unavailable.")
          if (response.record.input_snapshot_sha256 !== inputHash) throw new Error("Calculation unavailable.")
          return database.createSyntheticBillCalculation(userId, workspaceId, evidenceId, activity.id, idempotencyKey, operationFingerprint, response.record)
        })()
        calculationFlights.set(flightKey, flight)
        try { return await flight } finally { calculationFlights.delete(flightKey) }
      },
      findBill: (userId, workspaceId, evidenceId) => database.findSyntheticBill(userId, workspaceId, evidenceId),
      findInventory: (userId, workspaceId) => database.findSyntheticInventory(userId, workspaceId),
      createInventory: async (userId, workspaceId, calculationId, idempotencyKey) => {
        const existing = await database.findSyntheticInventory(userId, workspaceId)
        if (existing) {
          if (existing.calculationId !== calculationId) throw new Error("Inventory request conflicts.")
          return existing
        }
        const workspace = await database.findWorkspace(userId, workspaceId)
        if (!workspace) throw new Error("Inventory source not found.")
        const snapshot = {
          profile: "m57-synthetic-scope2-inventory-v1", companyId: workspaceId, boundaryId: workspace.boundary.id, calculationId,
          calculationResultSha256: "", reportingYear: 2023, scope: "scope_2_location_based",
          coverage: { expectedFacilities: 1, coveredFacilities: 1, expectedPeriods: 12, coveredPeriods: 1, coveredMonths: ["2023-01"], missingMonths: ["2023-02","2023-03","2023-04","2023-05","2023-06","2023-07","2023-08","2023-09","2023-10","2023-11","2023-12"] },
          warnings: [...INVENTORY_WARNINGS], complete: false, releaseEligible: false,
        }
        const allBills = await database.findSyntheticBillByCalculation(userId, workspaceId, calculationId)
        if (!allBills?.draftCalculation || allBills.draftCalculation.id !== calculationId) throw new Error("Inventory source not found.")
        snapshot.calculationResultSha256 = allBills.draftCalculation.resultPayloadSha256
        const snapshotSha = new Bun.CryptoHasher("sha256").update(canonicalJson(snapshot)).digest("hex")
        const fingerprint = new Bun.CryptoHasher("sha256").update(`${workspaceId}:${calculationId}:${snapshotSha}`).digest("hex")
        const prior = await database.findSyntheticInventoryIdempotency(userId, workspaceId, idempotencyKey)
        if (prior && prior.operationFingerprint !== fingerprint) throw new Error("Inventory request conflicts.")
        return database.createSyntheticInventory(userId, workspaceId, calculationId, idempotencyKey, fingerprint, snapshotSha)
      },
      decideInventory: async (userId, workspaceId, inventoryId, input: InventoryDecisionInput) => {
        const inventory = await database.findSyntheticInventory(userId, workspaceId)
        if (!inventory || inventory.id !== inventoryId || inventory.snapshotSha256 !== input.expectedInventorySnapshotSha256) throw new Error("Inventory review conflicts.")
        const fingerprint = new Bun.CryptoHasher("sha256").update(canonicalJson({ userId, inventoryId, ...input, idempotencyKey: undefined })).digest("hex")
        const prior = await database.findSyntheticInventoryIdempotency(userId, workspaceId, input.idempotencyKey)
        if (prior && prior.operationFingerprint !== fingerprint) throw new Error("Inventory review conflicts.")
        return database.recordSyntheticInventoryReview(userId, workspaceId, inventoryId, input.decision, input.reasonCode, input.acknowledgedWarnings, input.idempotencyKey, fingerprint)
      },
      findAnnualRegisters: (userId, workspaceId) => database.findAnnualRegisters(userId, workspaceId),
      createAnnualRegister: (userId, workspaceId, previousInventoryVersionId, idempotencyKey) => database.createAnnualRegister(userId, workspaceId, previousInventoryVersionId, idempotencyKey),
      completeAnnualRegister: (userId, workspaceId, registerId, expectedSnapshotSha256, idempotencyKey) => database.completeAnnualRegister(userId, workspaceId, registerId, expectedSnapshotSha256, idempotencyKey),
      findAnnualInventory: (userId, workspaceId) => database.findAnnualInventory(userId, workspaceId),
      createAnnualInventory: (userId, workspaceId, registerId, idempotencyKey) => database.createAnnualInventory(userId, workspaceId, registerId, idempotencyKey),
      reviewAnnualInventory: (userId, workspaceId, inventoryId, input) => database.reviewAnnualInventory(userId, workspaceId, inventoryId, input.decision, input.reasonCode, input.acknowledgedWarnings, input.expectedInventorySnapshotSha256, input.idempotencyKey),
      createAnnualEvidencePack: (userId, workspaceId, inventoryId, expectedSnapshot, idempotencyKey) => database.createAnnualEvidencePack(userId, workspaceId, inventoryId, expectedSnapshot, idempotencyKey),
      findAnnualEvidencePack: (userId, workspaceId, inventoryId) => database.findAnnualEvidencePack(userId, workspaceId, inventoryId),
      replayAnnualEvidencePack: (userId, workspaceId, inventoryId, packId, archive) => database.replayAnnualEvidencePack(userId, workspaceId, inventoryId, packId, archive),
      createDraftInventoryReport:(userId,workspaceId,inventoryId,packId,inventorySha,archiveSha,key)=>database.createDraftInventoryReport(userId,workspaceId,inventoryId,packId,inventorySha,archiveSha,key),
      findDraftInventoryReport:(userId,workspaceId,inventoryId)=>database.findDraftInventoryReport(userId,workspaceId,inventoryId),
      reviewDraftInventoryReport:(userId,workspaceId,inventoryId,reportId,input)=>database.reviewDraftInventoryReport(userId,workspaceId,inventoryId,reportId,input),
      findDraftInventoryReportReview:(userId,workspaceId,inventoryId,reportId)=>database.findDraftInventoryReportReview(userId,workspaceId,inventoryId,reportId),
  }
}
