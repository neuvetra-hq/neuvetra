import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { webhooks } from "./routes/webhooks"
import { businessesRoutes } from "./routes/businesses"
import { billingRoutes } from "./routes/billing"
import { calendarRoutes } from "./routes/calendar"
import { voiceRoutes } from "./routes/voice"
import { neuvetraRoutes } from "./routes/neuvetra"
import { authRoutes } from "./routes/auth"
import { searchAvailableNumbers } from "./services/twilio"

const app = new Elysia()
  .use(cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://neuvetra.com",
      "https://www.neuvetra.com",
    ],
    credentials: true,
  }))
  .get("/health", () => ({ status: "ok" }))

  // Public endpoint — search available numbers before a business exists
  .get("/available-numbers", async ({ query }) => {
    const areaCode = (query as Record<string, string>).areaCode ?? "415"
    const numbers = await searchAvailableNumbers(areaCode)
    return { numbers }
  })

  .use(webhooks)
  .use(businessesRoutes)
  .use(billingRoutes)
  .use(calendarRoutes)
  .use(voiceRoutes)
  .use(neuvetraRoutes)
  .use(authRoutes)
  .listen(Bun.env.PORT ?? 3000)

export type App = typeof app

console.log(`API running at ${app.server?.hostname}:${app.server?.port}`)
