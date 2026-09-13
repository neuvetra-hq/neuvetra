import { DevelopmentWorkspaceDatabase } from "@neuvetra/database"
import { Elysia } from "elysia"
import type { AuthenticatedUser } from "../lib/auth"
import { createWorkspaceRoutes } from "./routes"

const HOST = "127.0.0.1"
const PORT = Number(Bun.env.M54_WORKSPACE_PORT ?? 3015)
const ORIGIN = "http://127.0.0.1:5174"
export const M54_OWNER_ID = "11111111-1111-4111-8111-111111111111"
export const M54_OUTSIDER_ID = "22222222-2222-4222-8222-222222222222"
export const M54_OWNER_TOKEN = "m54-synthetic-owner"
export const M54_OUTSIDER_TOKEN = "m54-synthetic-outsider"

export async function createDevelopmentWorkspaceServer() {
  if (Bun.env.M54_SYNTHETIC_WORKSPACE !== "enabled" || (Bun.env.NODE_ENV !== "development" && Bun.env.NODE_ENV !== "test")) {
    throw new Error("The M54 synthetic workspace server requires an explicit development/test enable flag.")
  }
  const database = await DevelopmentWorkspaceDatabase.create([M54_OWNER_ID, M54_OUTSIDER_ID])
  const users: Record<string, AuthenticatedUser> = {
    [M54_OWNER_TOKEN]: { id: M54_OWNER_ID, phone: null, email: "owner@example.invalid", fullName: "Synthetic owner" },
    [M54_OUTSIDER_TOKEN]: { id: M54_OUTSIDER_ID, phone: null, email: "outsider@example.invalid", fullName: "Synthetic outsider" },
  }
  const routes = createWorkspaceRoutes({
    allowedOrigins: [ORIGIN],
    validateUser: async (token) => users[token] ?? null,
    store: {
      create: (userId, input) => database.createWorkspace(userId, input),
      findById: (userId, workspaceId) => database.findWorkspace(userId, workspaceId),
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
  console.info(`Neuvetra M54 synthetic workspace listening on http://${HOST}:${PORT}`)
}
