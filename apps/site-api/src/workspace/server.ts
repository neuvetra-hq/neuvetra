import { DevelopmentWorkspaceDatabase } from "@neuvetra/database"
import { Elysia } from "elysia"
import type { AuthenticatedUser } from "../lib/auth"
import { createWorkspaceStore } from "./service"
import { createWorkspaceRoutes } from "./routes"

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

export async function createDevelopmentWorkspaceServer() {
  if (Bun.env.M54_SYNTHETIC_WORKSPACE !== "enabled" || Bun.env.M55_SYNTHETIC_BILL !== "enabled" || Bun.env.M56_SYNTHETIC_BILL_CALCULATION !== "enabled" || Bun.env.M57_SYNTHETIC_INVENTORY_REVIEW !== "enabled" || Bun.env.M58_SYNTHETIC_ANNUAL_REGISTER !== "enabled" || Bun.env.M59_SYNTHETIC_EVIDENCE_PACK !== "enabled" || Bun.env.M60_SYNTHETIC_DRAFT_REPORT !== "enabled" || Bun.env.M61_SYNTHETIC_DRAFT_REPORT_REVIEW !== "enabled" || (Bun.env.NODE_ENV !== "development" && Bun.env.NODE_ENV !== "test")) {
    throw new Error("The M54-M61 synthetic workspace server requires explicit development/test enable flags.")
  }
  const database = await DevelopmentWorkspaceDatabase.create([M54_OWNER_ID, M54_OUTSIDER_ID, M55_ADMIN_ID, M55_MEMBER_ID])
  const users: Record<string, AuthenticatedUser> = {
    [M54_OWNER_TOKEN]: { id: M54_OWNER_ID, phone: null, email: "owner@example.invalid", fullName: "Synthetic owner" },
    [M54_OUTSIDER_TOKEN]: { id: M54_OUTSIDER_ID, phone: null, email: "outsider@example.invalid", fullName: "Synthetic outsider" },
    [M55_ADMIN_TOKEN]: { id: M55_ADMIN_ID, phone: null, email: "admin@example.invalid", fullName: "Synthetic administrator" },
    [M55_MEMBER_TOKEN]: { id: M55_MEMBER_ID, phone: null, email: "member@example.invalid", fullName: "Synthetic member" },
  }
  const routes = createWorkspaceRoutes({
    allowedOrigins: ORIGINS,
    validateUser: async (token) => users[token] ?? null,
    store: createWorkspaceStore(database, async (userId, input) => {
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
      }),
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
  const server = app.listen({ hostname: HOST, port: PORT, maxRequestBodySize: 300_000 })
  const stop = async () => {
    await server.stop()
    await database.close()
    process.exit(0)
  }
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
  console.info(`Neuvetra M61 synthetic draft-report review workspace listening on http://${HOST}:${PORT}`)
}
