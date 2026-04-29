import "./instrumentation"

import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { createChatRoutes } from "./routes/chat"
import { streamChat } from "./lib/chat-handler"
import { greeterAgent } from "./agents/greeter"
import { createRateLimiter } from "./lib/rate-limit"
import { ALLOWED_ORIGINS } from "./config/allowed-origins"
import { env } from "./env"

const chatRoutes = createChatRoutes({
  streamChat,
  agent: greeterAgent,
  rateLimiter: createRateLimiter({
    max: env.CHAT_RATE_LIMIT_MAX,
    windowMs: env.CHAT_RATE_LIMIT_WINDOW_MS,
  }),
  allowedOrigins: ALLOWED_ORIGINS,
})

const app = new Elysia()
  .use(cors({
    origin: [...ALLOWED_ORIGINS],
    credentials: true,
  }))
  .get("/health", () => ({ status: "ok" }))
  .use(chatRoutes)
  .listen({
    hostname: "0.0.0.0",
    port: Number(Bun.env.PORT ?? 3001),
  })

export type App = typeof app

console.log(`API running at ${app.server?.hostname}:${app.server?.port}`)
