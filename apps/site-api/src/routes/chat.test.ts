import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { Elysia } from "elysia"
import { createChatRoutes } from "./chat"
import type { Agent } from "../agents/types"
import { createRateLimiter, type RateLimiter } from "../lib/rate-limit"

const TEST_ORIGIN = "https://www.neuvetra.ai"
const ALLOWED_ORIGINS = [TEST_ORIGIN] as const

const stubAgent = (): Agent => ({
  id: "test-agent",
  promptKey: "test-agent:v1",
  systemPrompt: "you are a test",
  model: { specificationVersion: "v1", provider: "test", modelId: "test-model" } as any,
  tools: {},
  subAgents: [],
})

const permissiveLimiter = (): RateLimiter => ({
  check: () => ({ allowed: true, remaining: 999, resetAt: Date.now() + 60_000 }),
})

/**
 * A minimal stand-in for AI SDK 6's `StreamTextResult`. `toUIMessageStreamResponse`
 * is the only method the route calls; we return a real Response with a
 * dummy SSE-shaped body so Elysia accepts it.
 */
const fakeStreamResult = () => ({
  toUIMessageStreamResponse: (_opts?: unknown) =>
    new Response("", {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }),
})

const buildApp = (
  streamChat: any,
  rateLimiter: RateLimiter = permissiveLimiter(),
  allowedOrigins: readonly string[] = ALLOWED_ORIGINS,
  validateUser: (token: string) => Promise<{
    id: string
    phone: string | null
    email: string | null
    fullName: string | null
  } | null> = async () => null,
) =>
  new Elysia().use(
    createChatRoutes({
      streamChat,
      agent: stubAgent(),
      rateLimiter,
      allowedOrigins,
      validateUser,
    } as any),
  )

const post = (
  app: ReturnType<typeof buildApp>,
  body: unknown,
  headers: Record<string, string> = {},
) => {
  // Default to a valid Origin so legacy tests don't trip the origin check.
  // Pass `origin: ""` explicitly to omit it.
  const finalHeaders: Record<string, string> = {
    "content-type": "application/json",
    origin: TEST_ORIGIN,
    ...headers,
  }
  if (finalHeaders.origin === "") delete finalHeaders.origin
  return app.handle(
    new Request("http://localhost/chat", {
      method: "POST",
      headers: finalHeaders,
      body: JSON.stringify(body),
    }),
  )
}

describe("POST /chat", () => {
  let originalConsoleError: typeof console.error
  let originalConsoleWarn: typeof console.warn
  let consoleErrorSpy: ReturnType<typeof mock>
  let consoleWarnSpy: ReturnType<typeof mock>

  beforeEach(() => {
    originalConsoleError = console.error
    originalConsoleWarn = console.warn
    consoleErrorSpy = mock((..._args: any[]) => {})
    consoleWarnSpy = mock((..._args: any[]) => {})
    console.error = consoleErrorSpy as unknown as typeof console.error
    console.warn = consoleWarnSpy as unknown as typeof console.warn
  })

  afterEach(() => {
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
  })

  test("returns 200 + a streaming Response on success", async () => {
    const streamChat = mock(() => fakeStreamResult())
    const app = buildApp(streamChat)

    const res = await post(app, { messages: [{ role: "user", content: "hi" }] })

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
    expect(streamChat).toHaveBeenCalledTimes(1)
  })

  test("returns 500 + sanitized error body when streamChat throws synchronously (pre-stream config error)", async () => {
    const streamChat = mock(() => {
      throw new Error("anthropic 401: invalid x-api-key sk-ant-...")
    })
    const app = buildApp(streamChat)

    const res = await post(app, { messages: [{ role: "user", content: "hi" }] })

    expect(res.status).toBe(500)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBeDefined()
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain("anthropic")
    expect(serialized).not.toContain("api-key")
    expect(serialized).not.toContain("sk-ant-")
    expect(consoleErrorSpy).toHaveBeenCalled()
    const args = consoleErrorSpy.mock.calls[0]!
    const loggedError = args[1]
    expect(loggedError).toBeInstanceOf(Error)
    expect((loggedError as Error).message).toContain("anthropic 401")
  })

  test("rejects oversize messages with a 4xx without invoking the handler", async () => {
    const streamChat = mock(() => fakeStreamResult())
    const app = buildApp(streamChat)

    const res = await post(app, {
      messages: [{ role: "user", content: "x".repeat(5000) }],
    })

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(streamChat).not.toHaveBeenCalled()
  })

  test("rejects empty messages array with a 4xx without invoking the handler", async () => {
    const streamChat = mock(() => fakeStreamResult())
    const app = buildApp(streamChat)

    const res = await post(app, { messages: [] })

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(streamChat).not.toHaveBeenCalled()
  })

  test("returns 429 with Retry-After when the rate limiter rejects the request", async () => {
    const streamChat = mock(() => fakeStreamResult())
    let now = 1_700_000_000_000
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, now: () => now })
    const app = buildApp(streamChat, limiter)

    const headers = { "x-forwarded-for": "203.0.113.1" }
    const first = await post(app, { messages: [{ role: "user", content: "hi" }] }, headers)
    expect(first.status).toBe(200)

    const second = await post(app, { messages: [{ role: "user", content: "hi" }] }, headers)
    expect(second.status).toBe(429)
    expect(second.headers.get("retry-after")).toBeDefined()
    const body = (await second.json()) as { error: string }
    expect(typeof body.error).toBe("string")
    expect(streamChat).toHaveBeenCalledTimes(1)
  })

  test("rate-limits per IP — different x-forwarded-for values get independent buckets", async () => {
    const streamChat = mock(() => fakeStreamResult())
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 })
    const app = buildApp(streamChat, limiter)

    const a1 = await post(app, { messages: [{ role: "user", content: "hi" }] }, {
      "x-forwarded-for": "203.0.113.1",
    })
    expect(a1.status).toBe(200)

    const b1 = await post(app, { messages: [{ role: "user", content: "hi" }] }, {
      "x-forwarded-for": "203.0.113.2",
    })
    expect(b1.status).toBe(200)

    const a2 = await post(app, { messages: [{ role: "user", content: "hi" }] }, {
      "x-forwarded-for": "203.0.113.1",
    })
    expect(a2.status).toBe(429)
  })

  test("returns 403 when Origin is not in the allowlist", async () => {
    const streamChat = mock(() => fakeStreamResult())
    const app = buildApp(streamChat)

    const res = await post(
      app,
      { messages: [{ role: "user", content: "hi" }] },
      { origin: "https://attacker.example" },
    )

    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(typeof body.error).toBe("string")
    expect(streamChat).not.toHaveBeenCalled()
    // Server-side log captures the rejected origin so abuse can be triaged.
    expect(consoleWarnSpy).toHaveBeenCalled()
  })

  test("returns 403 when Origin header is missing", async () => {
    const streamChat = mock(() => fakeStreamResult())
    const app = buildApp(streamChat)

    // origin: "" is the helper's signal to omit the header entirely.
    const res = await post(
      app,
      { messages: [{ role: "user", content: "hi" }] },
      { origin: "" },
    )

    expect(res.status).toBe(403)
    expect(streamChat).not.toHaveBeenCalled()
  })

  test("origin check runs before rate limit — bad origin doesn't burn rate-limit budget", async () => {
    const streamChat = mock(() => fakeStreamResult())
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 })
    const app = buildApp(streamChat, limiter)

    // First: bad origin → 403, no bucket increment.
    const bad = await post(
      app,
      { messages: [{ role: "user", content: "hi" }] },
      { "x-forwarded-for": "203.0.113.5", origin: "https://attacker.example" },
    )
    expect(bad.status).toBe(403)

    // Second from the same IP with a good origin → still allowed under max=1.
    const good = await post(
      app,
      { messages: [{ role: "user", content: "hi" }] },
      { "x-forwarded-for": "203.0.113.5" },
    )
    expect(good.status).toBe(200)
  })

  test("when a valid Bearer token is present, validates it and includes user identity in the agent input", async () => {
    const streamChat = mock(() => fakeStreamResult())
    const validateUser = mock(async (token: string) =>
      token === "valid.jwt"
        ? { id: "u1", phone: "+15551234567", email: null, fullName: "Alice" }
        : null,
    )
    const app = buildApp(streamChat, undefined, undefined, validateUser)

    await post(
      app,
      { messages: [{ role: "user", content: "hi" }] },
      { authorization: "Bearer valid.jwt" },
    )

    expect(validateUser).toHaveBeenCalledWith("valid.jwt")
    expect(streamChat).toHaveBeenCalledTimes(1)
    const calls = streamChat.mock.calls as unknown as Array<[{ user?: { id: string; phone: string | null } }]>
    const args = calls[0]![0]
    expect(args.user).toMatchObject({ id: "u1", phone: "+15551234567" })
  })

  test("when no Bearer token is present, the request runs anonymously (no user passed to handler, validateUser not invoked)", async () => {
    const streamChat = mock(() => fakeStreamResult())
    const validateUser = mock(async () => null)
    const app = buildApp(streamChat, undefined, undefined, validateUser)

    await post(app, { messages: [{ role: "user", content: "hi" }] })

    expect(validateUser).not.toHaveBeenCalled()
    expect(streamChat).toHaveBeenCalledTimes(1)
    const anonCalls = streamChat.mock.calls as unknown as Array<[{ user?: unknown }]>
    const anonArgs = anonCalls[0]![0]
    expect(anonArgs.user).toBeUndefined()
  })

  test("when a Bearer token is present but invalid, the request runs anonymously and is not rejected", async () => {
    const streamChat = mock(() => fakeStreamResult())
    const validateUser = mock(async () => null)
    const app = buildApp(streamChat, undefined, undefined, validateUser)

    const res = await post(
      app,
      { messages: [{ role: "user", content: "hi" }] },
      { authorization: "Bearer expired.jwt" },
    )

    expect(res.status).toBe(200)
    expect(validateUser).toHaveBeenCalledWith("expired.jwt")
    const expiredCalls = streamChat.mock.calls as unknown as Array<[{ user?: unknown }]>
    const expiredArgs = expiredCalls[0]![0]
    expect(expiredArgs.user).toBeUndefined()
  })
})
