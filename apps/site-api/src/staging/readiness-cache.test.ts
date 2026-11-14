// BF-19 (lead 5): the readiness guard keeps a success for 5 s, never a failure; /ready (fresh) always checks and its answer
// replaces the kept one; concurrent callers share one check.
import { describe, expect, test } from "bun:test"
import { createReadinessCache, READINESS_CACHE_MS } from "./readiness-cache"

describe("BF-19 readiness cache", () => {
  test("a success is kept for less than 5 s, then checked again", async () => {
    let clock = 0, checks = 0, version = 31
    const cache = createReadinessCache(async () => { checks++; return version }, { now: () => clock })
    expect(READINESS_CACHE_MS).toBe(5_000)
    expect(await cache.get()).toBe(31)
    version = 32
    clock = 4_999
    expect([await cache.get(), checks]).toEqual([31, 1])
    clock = 5_000
    expect([await cache.get(), checks]).toEqual([32, 2])
  })

  test("a failure is never kept, and it drops the kept success", async () => {
    let clock = 0, healthy = true, checks = 0
    const cache = createReadinessCache(async () => { checks++; if (!healthy) throw new Error("lost"); return "ok" }, { now: () => clock })
    await cache.get()
    healthy = false
    expect(await cache.get({ fresh: true }).catch((error: Error) => error.message)).toBe("lost")
    // The next ordinary caller checks again (no kept success), and keeps failing until the database is back.
    expect(await cache.get().catch((error: Error) => error.message)).toBe("lost")
    expect(await cache.get().catch((error: Error) => error.message)).toBe("lost")
    expect(checks).toBe(4)
    healthy = true
    expect(await cache.get()).toBe("ok")
    expect(checks).toBe(5)
  })

  test("fresh always checks, and its answer serves the ordinary callers after it", async () => {
    let clock = 0, version = 30, checks = 0
    const cache = createReadinessCache(async () => { checks++; return version }, { now: () => clock })
    await cache.get()
    version = 31
    expect(await cache.get({ fresh: true })).toBe(31)
    expect(await cache.get()).toBe(31)
    expect(checks).toBe(2)
  })

  test("concurrent callers share one check in flight", async () => {
    let checks = 0, release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const cache = createReadinessCache(async () => { checks++; await gate; return "ok" })
    const all = Promise.all([cache.get(), cache.get(), cache.get({ fresh: true })])
    release()
    expect(await all).toEqual(["ok", "ok", "ok"])
    expect(checks).toBe(1)
  })

  test("a clock that goes backwards never extends a kept success", async () => {
    let clock = 10_000, checks = 0
    const cache = createReadinessCache(async () => { checks++; return "ok" }, { now: () => clock })
    await cache.get()
    clock = 0
    await cache.get()
    expect(checks).toBe(2)
  })
})
