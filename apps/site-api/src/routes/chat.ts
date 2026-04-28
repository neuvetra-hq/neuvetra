import { Elysia, t } from "elysia"
import { streamChat } from "../lib/chat-handler"
import type { Agent } from "../agents/types"
import { extractClientIp, type RateLimiter } from "../lib/rate-limit"
import { checkOrigin } from "../lib/origin-check"
import {
  extractBearerToken,
  validateUserFromToken,
  type AuthenticatedUser,
} from "../lib/auth"
import { getSupabase } from "../lib/supabase"

const SANITIZED_ERROR_MESSAGE =
  "Sorry, something went wrong on our side. Please try again in a moment."

const RATE_LIMITED_MESSAGE =
  "You're sending messages a little too fast. Please slow down and try again in a moment."

const FORBIDDEN_MESSAGE = "Forbidden."

interface ChatRoutesDeps {
  streamChat: typeof streamChat
  agent: Agent
  rateLimiter: RateLimiter
  allowedOrigins: readonly string[]
  /**
   * Validates a Bearer JWT and returns the user, or null. Default: real
   * Supabase call via the singleton client. Tests inject a mock so the
   * test runner doesn't need real Supabase env vars.
   */
  validateUser?: (token: string) => Promise<AuthenticatedUser | null>
}

export const createChatRoutes = (deps: ChatRoutesDeps) => {
  const validateUser =
    deps.validateUser ?? ((token: string) => validateUserFromToken(token, getSupabase()))

  return new Elysia({ prefix: "/chat" }).post(
    "/",
    async ({ body, set, request, server }) => {
      // 1. Origin allowlist (CORS-bypass defense).
      const originResult = checkOrigin(request.headers, deps.allowedOrigins)
      if (!originResult.allowed) {
        console.warn("[/chat] origin rejected:", originResult.origin)
        set.status = 403
        return { error: FORBIDDEN_MESSAGE }
      }

      // 2. Per-IP rate limit.
      const directAddress = server?.requestIP(request)?.address
      const ip = extractClientIp(request.headers, directAddress)
      const verdict = deps.rateLimiter.check(ip)
      if (!verdict.allowed) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((verdict.resetAt - Date.now()) / 1000),
        )
        set.status = 429
        set.headers["retry-after"] = String(retryAfterSeconds)
        return { error: RATE_LIMITED_MESSAGE }
      }

      // 3. Optional auth — invalid/expired tokens fall through to anonymous,
      //    they don't reject the request. The agent handles the difference
      //    via system-prompt instructions (Task 5).
      let user: AuthenticatedUser | null = null
      const token = extractBearerToken(request.headers)
      if (token) {
        user = await validateUser(token)
      }

      // 4. Stream the chat.
      try {
        const result = deps.streamChat({
          agent: deps.agent,
          messages: body.messages,
          user: user ?? undefined,
        })
        return result.toUIMessageStreamResponse({
          onError: (err: unknown) => {
            console.error("[/chat] stream error:", err)
            return SANITIZED_ERROR_MESSAGE
          },
        })
      } catch (err) {
        console.error("[/chat] handler error:", err)
        set.status = 500
        return { error: SANITIZED_ERROR_MESSAGE }
      }
    },
    {
      body: t.Object({
        messages: t.Array(
          t.Object({
            role: t.Union([t.Literal("user"), t.Literal("assistant")]),
            content: t.String({ minLength: 1, maxLength: 4000 }),
          }),
          { minItems: 1, maxItems: 50 },
        ),
      }),
      response: {
        403: t.Object({ error: t.String() }),
        429: t.Object({ error: t.String() }),
        500: t.Object({ error: t.String() }),
      },
    },
  )
}
