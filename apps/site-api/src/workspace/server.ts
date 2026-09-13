import { DevelopmentWorkspaceDatabase } from "@neuvetra/database"
import { Elysia } from "elysia"
import type { AuthenticatedUser } from "../lib/auth"
import { createWorkspaceRoutes } from "./routes"

const HOST = "127.0.0.1"
const PORT = Number(Bun.env.M54_WORKSPACE_PORT ?? 3015)
const ORIGIN = "http://127.0.0.1:5174"
export const M54_OWNER_ID = "11111111-1111-4111-8111-111111111111"
export const M54_OUTSIDER_ID = "22222222-2222-4222-8222-222222222222"
export const M55_ADMIN_ID = "33333333-3333-4333-8333-333333333333"
export const M55_MEMBER_ID = "44444444-4444-4444-8444-444444444444"
export const M54_OWNER_TOKEN = "m54-synthetic-owner"
export const M54_OUTSIDER_TOKEN = "m54-synthetic-outsider"
export const M55_ADMIN_TOKEN = "m55-synthetic-admin"
export const M55_MEMBER_TOKEN = "m55-synthetic-member"

export async function createDevelopmentWorkspaceServer() {
  if (Bun.env.M54_SYNTHETIC_WORKSPACE !== "enabled" || Bun.env.M55_SYNTHETIC_BILL !== "enabled" || (Bun.env.NODE_ENV !== "development" && Bun.env.NODE_ENV !== "test")) {
    throw new Error("The M54/M55 synthetic workspace server requires explicit development/test enable flags.")
  }
  const database = await DevelopmentWorkspaceDatabase.create([M54_OWNER_ID, M54_OUTSIDER_ID, M55_ADMIN_ID, M55_MEMBER_ID])
  const users: Record<string, AuthenticatedUser> = {
    [M54_OWNER_TOKEN]: { id: M54_OWNER_ID, phone: null, email: "owner@example.invalid", fullName: "Synthetic owner" },
    [M54_OUTSIDER_TOKEN]: { id: M54_OUTSIDER_ID, phone: null, email: "outsider@example.invalid", fullName: "Synthetic outsider" },
    [M55_ADMIN_TOKEN]: { id: M55_ADMIN_ID, phone: null, email: "admin@example.invalid", fullName: "Synthetic administrator" },
    [M55_MEMBER_TOKEN]: { id: M55_MEMBER_ID, phone: null, email: "member@example.invalid", fullName: "Synthetic member" },
  }
  const routes = createWorkspaceRoutes({
    allowedOrigins: [ORIGIN],
    validateUser: async (token) => users[token] ?? null,
    store: {
      create: async (userId, input) => {
        if (userId !== M54_OWNER_ID) throw new Error("Only the fixed synthetic owner can create this workspace.")
        return database.createWorkspaceWithSyntheticMembers(userId, input, [
          { userId: M55_ADMIN_ID, role: "admin" }, { userId: M55_MEMBER_ID, role: "member" },
        ])
      },
      findById: (userId, workspaceId) => database.findWorkspace(userId, workspaceId),
      canManage: (userId, workspaceId) => database.canManageWorkspace(userId, workspaceId),
      ingestBill: (userId, workspaceId, bytes, sha256) => database.ingestSyntheticBill(userId, workspaceId, bytes, sha256),
      correctBill: (userId, workspaceId, evidenceId, facilityId) => database.correctSyntheticBill(userId, workspaceId, evidenceId, facilityId),
      linkBill: (userId, workspaceId, evidenceId, boundaryId) => database.linkSyntheticBill(userId, workspaceId, evidenceId, boundaryId),
      findBill: (userId, workspaceId, evidenceId) => database.findSyntheticBill(userId, workspaceId, evidenceId),
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
  console.info(`Neuvetra M55 synthetic evidence workspace listening on http://${HOST}:${PORT}`)
}
