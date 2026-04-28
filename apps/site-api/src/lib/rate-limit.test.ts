import { describe, expect, test } from "bun:test"
import { createRateLimiter, extractClientIp } from "./rate-limit"

describe("createRateLimiter()", () => {
  test("allows up to `max` requests per window for a given key", () => {
    let now = 0
    const limiter = createRateLimiter({ max: 3, windowMs: 1000, now: () => now })

    expect(limiter.check("ip-a")).toMatchObject({ allowed: true, remaining: 2 })
    expect(limiter.check("ip-a")).toMatchObject({ allowed: true, remaining: 1 })
    expect(limiter.check("ip-a")).toMatchObject({ allowed: true, remaining: 0 })
    expect(limiter.check("ip-a")).toMatchObject({ allowed: false, remaining: 0 })
  })

  test("resets the bucket once the window has elapsed", () => {
    let now = 0
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, now: () => now })

    limiter.check("ip-a")
    limiter.check("ip-a")
    expect(limiter.check("ip-a").allowed).toBe(false)

    now = 1000
    expect(limiter.check("ip-a")).toMatchObject({ allowed: true, remaining: 1 })
  })

  test("tracks distinct keys independently", () => {
    let now = 0
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => now })

    expect(limiter.check("ip-a").allowed).toBe(true)
    expect(limiter.check("ip-a").allowed).toBe(false)
    expect(limiter.check("ip-b").allowed).toBe(true)
    expect(limiter.check("ip-b").allowed).toBe(false)
  })

  test("evicts oldest entries when the cap is reached", () => {
    let now = 0
    const limiter = createRateLimiter({
      max: 1,
      windowMs: 60_000,
      maxBuckets: 2,
      now: () => now,
    })

    limiter.check("ip-a")
    limiter.check("ip-b")
    limiter.check("ip-c") // forces eviction of ip-a (oldest)

    // ip-b is still tracked and at its limit — this assertion must come first
    // because probing ip-a's missing bucket would in turn evict ip-b.
    expect(limiter.check("ip-b").allowed).toBe(false)
    // ip-a's bucket was evicted by the ip-c check, so it gets a fresh allowance.
    expect(limiter.check("ip-a").allowed).toBe(true)
  })

  test("returns the absolute resetAt time so callers can set Retry-After", () => {
    let now = 1_700_000_000_000
    const limiter = createRateLimiter({ max: 1, windowMs: 5_000, now: () => now })

    limiter.check("ip-a")
    const verdict = limiter.check("ip-a")
    expect(verdict.allowed).toBe(false)
    expect(verdict.resetAt).toBe(1_700_000_005_000)
  })
})

describe("extractClientIp()", () => {
  const make = (init: Record<string, string>) => new Headers(init)

  test("returns the leftmost x-forwarded-for hop", () => {
    const headers = make({ "x-forwarded-for": "203.0.113.1, 10.0.0.1, 10.0.0.2" })
    expect(extractClientIp(headers, undefined)).toBe("203.0.113.1")
  })

  test("trims whitespace around the leftmost hop", () => {
    const headers = make({ "x-forwarded-for": "  203.0.113.1  , 10.0.0.1" })
    expect(extractClientIp(headers, undefined)).toBe("203.0.113.1")
  })

  test("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = make({ "x-real-ip": "203.0.113.5" })
    expect(extractClientIp(headers, undefined)).toBe("203.0.113.5")
  })

  test("falls back to the supplied direct address when no forwarded header is present", () => {
    expect(extractClientIp(make({}), "198.51.100.7")).toBe("198.51.100.7")
  })

  test("returns 'unknown' when nothing is available", () => {
    expect(extractClientIp(make({}), undefined)).toBe("unknown")
  })

  test("ignores empty x-forwarded-for and falls through", () => {
    const headers = make({ "x-forwarded-for": "" })
    expect(extractClientIp(headers, "198.51.100.9")).toBe("198.51.100.9")
  })
})
