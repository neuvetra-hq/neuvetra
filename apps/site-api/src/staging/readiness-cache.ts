/**
 * BF-19 (lead 5): the readiness guard runs before every workspace request's own SQL. It now keeps a success for at most
 * `ttlMs` (5 s), so a burst of requests costs one readiness check instead of one each, and it never keeps a failure: the
 * next caller checks again. Concurrent callers share one check in flight. `fresh` (the /ready probe) never takes a kept
 * success, but its answer replaces the kept one, so /ready seeing a new schema or a lost database updates every request at
 * once. A kept success therefore hides a schema change or a lost database for at most `ttlMs`, and every check it keeps
 * passed the full validation (receipts, schema bridge, containment) the caller supplies.
 */
export interface ReadinessCache<T> { get(options?: { fresh?: boolean }): Promise<T>; clear(): void }

export const READINESS_CACHE_MS = 5_000

export function createReadinessCache<T>(check: () => Promise<T>, options: { ttlMs?: number; now?: () => number } = {}): ReadinessCache<T> {
  const ttlMs = options.ttlMs ?? READINESS_CACHE_MS, now = options.now ?? (() => performance.now())
  let kept: { value: T; at: number } | null = null
  let inFlight: Promise<T> | null = null
  const run = () => {
    if (inFlight) return inFlight
    const started = now()
    const attempt = (async () => {
      try {
        const value = await check()
        kept = { value, at: started }
        return value
      } catch (error) {
        kept = null
        throw error
      } finally { inFlight = null }
    })()
    inFlight = attempt
    return attempt
  }
  return {
    get(request = {}) {
      if (!request.fresh && kept) {
        const age = now() - kept.at
        // A clock that went backwards never extends a kept success.
        if (age >= 0 && age < ttlMs) return Promise.resolve(kept.value)
        kept = null
      }
      return run()
    },
    clear() { kept = null },
  }
}
