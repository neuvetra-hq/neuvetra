import { DevelopmentWorkspaceDatabase } from "@neuvetra/database"
import { Elysia } from "elysia"
import type { AuthenticatedUser } from "../lib/auth"
import { runEngine } from "../calculation/server"
import { createWorkspaceRoutes } from "./routes"
import { INVENTORY_WARNINGS, type InventoryDecisionInput } from "./types"

const HOST = "127.0.0.1"
const PORT = Number(Bun.env.M54_WORKSPACE_PORT ?? 3015)
const ORIGINS = ["http://127.0.0.1:5174", "http://127.0.0.1:5175", "http://127.0.0.1:5176"] as const
export const M54_OWNER_ID = "11111111-1111-4111-8111-111111111111"
export const M54_OUTSIDER_ID = "22222222-2222-4222-8222-222222222222"
export const M55_ADMIN_ID = "33333333-3333-4333-8333-333333333333"
export const M55_MEMBER_ID = "44444444-4444-4444-8444-444444444444"
export const M54_OWNER_TOKEN = "m54-synthetic-owner"
export const M54_OUTSIDER_TOKEN = "m54-synthetic-outsider"
export const M55_ADMIN_TOKEN = "m55-synthetic-admin"
export const M55_MEMBER_TOKEN = "m55-synthetic-member"

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`
}

export async function createDevelopmentWorkspaceServer() {
  if (Bun.env.M54_SYNTHETIC_WORKSPACE !== "enabled" || Bun.env.M55_SYNTHETIC_BILL !== "enabled" || Bun.env.M56_SYNTHETIC_BILL_CALCULATION !== "enabled" || Bun.env.M57_SYNTHETIC_INVENTORY_REVIEW !== "enabled" || Bun.env.M58_SYNTHETIC_ANNUAL_REGISTER !== "enabled" || (Bun.env.NODE_ENV !== "development" && Bun.env.NODE_ENV !== "test")) {
    throw new Error("The M54-M58 synthetic workspace server requires explicit development/test enable flags.")
  }
  const database = await DevelopmentWorkspaceDatabase.create([M54_OWNER_ID, M54_OUTSIDER_ID, M55_ADMIN_ID, M55_MEMBER_ID])
  const calculationFlights = new Map<string, Promise<Awaited<ReturnType<typeof database.createSyntheticBillCalculation>>>>()
  const users: Record<string, AuthenticatedUser> = {
    [M54_OWNER_TOKEN]: { id: M54_OWNER_ID, phone: null, email: "owner@example.invalid", fullName: "Synthetic owner" },
    [M54_OUTSIDER_TOKEN]: { id: M54_OUTSIDER_ID, phone: null, email: "outsider@example.invalid", fullName: "Synthetic outsider" },
    [M55_ADMIN_TOKEN]: { id: M55_ADMIN_ID, phone: null, email: "admin@example.invalid", fullName: "Synthetic administrator" },
    [M55_MEMBER_TOKEN]: { id: M55_MEMBER_ID, phone: null, email: "member@example.invalid", fullName: "Synthetic member" },
  }
  const routes = createWorkspaceRoutes({
    allowedOrigins: ORIGINS,
    validateUser: async (token) => users[token] ?? null,
    store: {
      create: async (userId, input) => {
        if (userId !== M54_OWNER_ID) throw new Error("Only the fixed synthetic owner can create this workspace.")
        const existing = await database.findSyntheticWorkspaceForUser(userId)
        if (existing) return existing
        try {
          return await database.createWorkspaceWithSyntheticMembers(userId, input, [
            { userId: M55_ADMIN_ID, role: "admin" }, { userId: M55_MEMBER_ID, role: "member" },
          ])
        } catch {
          const raced = await database.findSyntheticWorkspaceForUser(userId)
          if (raced) return raced
          throw new Error("Workspace could not be created.")
        }
      },
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
          const response = await runEngine({
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
    },
  })
  const app = new Elysia({ normalize: false })
    .onRequest(({ set }) => { set.headers["cache-control"] = "no-store" })
    .get("/status", () => ({
      status: "ready",
      mode: "local_synthetic_development",
      persistence: "memory_only",
      customer_data: false,
    }))
    .use(routes)
  return { app, database }
}

if (import.meta.main) {
  const { app, database } = await createDevelopmentWorkspaceServer()
  const server = app.listen({ hostname: HOST, port: PORT, maxRequestBodySize: 16_384 })
  const stop = async () => {
    await server.stop()
    await database.close()
    process.exit(0)
  }
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
  console.info(`Neuvetra M58 synthetic annual register workspace listening on http://${HOST}:${PORT}`)
}
