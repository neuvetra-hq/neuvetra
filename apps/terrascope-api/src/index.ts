import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { chatRoutes } from "./routes/chat"
import { factorsRoutes } from "./routes/factors"
import { companiesRoutes } from "./routes/companies"
import { reportsRoutes } from "./routes/reports"

const app = new Elysia()
  .use(cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://neuvetra.ai",
      "https://www.neuvetra.ai",
    ],
    credentials: true,
  }))
  .get("/health", () => ({ status: "ok" }))
  .use(chatRoutes)
  .use(factorsRoutes)
  .use(companiesRoutes)
  .use(reportsRoutes)
  .listen(Bun.env.PORT ?? 3002)

console.log(`Terrascope API running on port ${app.server?.port}`)

export type App = typeof app
