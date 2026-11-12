import { describe, expect, test } from "bun:test"
import { createRateLimiter, extractClientIp, extractProxiedClientAddress } from "./rate-limit"

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

  // API-02 (QA F3): /chat uses the same trusted order as the staging server; the caller-controlled leftmost hop is ignored.
  test("never uses the caller-controlled leftmost x-forwarded-for hop; takes the rightmost (edge-written) one", () => {
    const headers = make({ "x-forwarded-for": "8.8.8.8, 10.0.0.1, 203.0.113.1" })
    expect(extractClientIp(headers, undefined)).toBe("203.0.113.1")
    expect(extractClientIp(make({ "x-forwarded-for": "1.2.3.4, 203.0.113.1" }), undefined)).toBe(extractClientIp(make({ "x-forwarded-for": "5.6.7.8, 203.0.113.1" }), undefined))
  })

  test("trims whitespace around the rightmost hop", () => {
    const headers = make({ "x-forwarded-for": "10.0.0.1,  203.0.113.1  " })
    expect(extractClientIp(headers, undefined)).toBe("203.0.113.1")
  })

  test("prefers x-real-ip over x-forwarded-for", () => {
    expect(extractClientIp(make({ "x-real-ip": "203.0.113.5" }), undefined)).toBe("203.0.113.5")
    expect(extractClientIp(make({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.1" }), "198.51.100.7")).toBe("203.0.113.5")
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

describe("RateLimiter.release()", () => {
  test("gives back one request from the same window", () => {
    const now = 1_000
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => now })
    const first = limiter.check("a")
    expect(limiter.check("a").allowed).toBe(false)
    limiter.release("a", first)
    expect(limiter.check("a").allowed).toBe(true)
  })

  test("never gives back into a later window, for a refused check, or below zero", () => {
    let now = 1_000
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => now })
    const stale = limiter.check("a")
    now = 2_500
    expect(limiter.check("a").allowed).toBe(true)
    limiter.release("a", stale)
    const refused = limiter.check("a")
    expect(refused.allowed).toBe(false)
    limiter.release("a", refused)
    expect(limiter.check("a").allowed).toBe(false)
    limiter.release("missing", stale)
  })
})

describe("extractProxiedClientAddress()", () => {
  const make = (init: Record<string, string>) => new Headers(init)

  test("prefers the edge-written x-real-ip", () => {
    expect(extractProxiedClientAddress(make({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.5")
  })

  test("uses the rightmost x-forwarded-for hop, never the caller-controlled leftmost", () => {
    expect(extractProxiedClientAddress(make({ "x-forwarded-for": "8.8.8.8, 203.0.113.9" }))).toBe("203.0.113.9")
  })

  test("takes the last value of a duplicated x-real-ip", () => {
    expect(extractProxiedClientAddress(make({ "x-real-ip": "8.8.8.8, 203.0.113.5" }))).toBe("203.0.113.5")
  })

  test("falls back to one shared 'unknown' key", () => {
    expect(extractProxiedClientAddress(make({}))).toBe("unknown")
    expect(extractProxiedClientAddress(make({ "x-forwarded-for": " , " }))).toBe("unknown")
  })
})
