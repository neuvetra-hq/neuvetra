import { describe, expect, test } from "bun:test"
import { checkOrigin } from "./origin-check"

const allowedOrigins = [
  "http://localhost:5173",
  "https://www.neuvetra.ai",
  "https://neuvetra.ai",
] as const

describe("checkOrigin()", () => {
  const make = (init: Record<string, string>) => new Headers(init)

  test("allows an origin that exactly matches the allowlist", () => {
    const result = checkOrigin(make({ origin: "https://www.neuvetra.ai" }), allowedOrigins)
    expect(result).toEqual({ allowed: true, origin: "https://www.neuvetra.ai" })
  })

  test("rejects an origin not in the allowlist", () => {
    const result = checkOrigin(make({ origin: "https://attacker.example" }), allowedOrigins)
    expect(result).toEqual({ allowed: false, origin: "https://attacker.example" })
  })

  test("rejects when the Origin header is missing (strict mode)", () => {
    const result = checkOrigin(make({}), allowedOrigins)
    expect(result).toEqual({ allowed: false, origin: null })
  })

  test("rejects an explicit Origin: null (sandboxed iframes, file://)", () => {
    const result = checkOrigin(make({ origin: "null" }), allowedOrigins)
    expect(result.allowed).toBe(false)
  })

  test("is case-sensitive on the scheme + host (matches the allowlist exactly)", () => {
    const result = checkOrigin(make({ origin: "https://WWW.NEUVETRA.AI" }), allowedOrigins)
    expect(result.allowed).toBe(false)
  })

  test("does not silently allow trailing slashes or paths", () => {
    expect(checkOrigin(make({ origin: "https://www.neuvetra.ai/" }), allowedOrigins).allowed).toBe(false)
    expect(checkOrigin(make({ origin: "https://www.neuvetra.ai/anywhere" }), allowedOrigins).allowed).toBe(false)
  })
})
