/**
 * In-memory IP-based rate limiter for `/chat`.
 *
 * Single-process. If `site-api` ever scales horizontally on Railway, swap the
 * `Map` for a Redis-backed counter — the public surface (`check(key)`) stays
 * the same.
 *
 * Why custom over `@elysiajs/rate-limit`: keeps the dep tree minimal and lets
 * the bucket be unit-tested without spinning up an Elysia instance.
 */

export interface RateLimitConfig {
  /** Max requests allowed per window per identifier. */
  max: number
  /** Window duration in milliseconds. */
  windowMs: number
  /**
   * Hard cap on tracked identifiers — guards against unbounded memory growth
   * if the limiter is hit by many distinct IPs. Oldest entries are evicted
   * when the cap is reached. Defaults to 10,000.
   */
  maxBuckets?: number
  /** Clock source — overridden in tests. */
  now?: () => number
}

export interface RateLimitVerdict {
  allowed: boolean
  /** Wall-clock ms when this bucket resets. */
  resetAt: number
  /** Requests remaining in the current window after this check. */
  remaining: number
}

export interface RateLimiter {
  check(key: string): RateLimitVerdict
}

export interface ReleasableRateLimiter extends RateLimiter {
  /**
   * Gives back one request counted by a `check` that returned `verdict`, if
   * that window is still current. Used when a request turns out not to belong
   * to the budget it was provisionally counted against.
   */
  release(key: string, verdict: RateLimitVerdict): void
}

interface Bucket {
  count: number
  resetAt: number
}

export function createRateLimiter(config: RateLimitConfig): ReleasableRateLimiter {
  const now = config.now ?? (() => Date.now())
  const maxBuckets = config.maxBuckets ?? 10_000
  // Insertion-ordered Map gives us O(1) eviction of the oldest entry.
  const buckets = new Map<string, Bucket>()

  return {
    check(key) {
      const t = now()
      let bucket = buckets.get(key)

      if (!bucket || t >= bucket.resetAt) {
        bucket = { count: 0, resetAt: t + config.windowMs }
        // Re-insert at the end of the Map so eviction order tracks freshness.
        buckets.delete(key)
        buckets.set(key, bucket)

        if (buckets.size > maxBuckets) {
          const oldest = buckets.keys().next().value
          if (oldest !== undefined && oldest !== key) {
            buckets.delete(oldest)
          }
        }
      }

      if (bucket.count >= config.max) {
        return { allowed: false, resetAt: bucket.resetAt, remaining: 0 }
      }

      bucket.count += 1
      return {
        allowed: true,
        resetAt: bucket.resetAt,
        remaining: config.max - bucket.count,
      }
    },
    release(key, verdict) {
      if (!verdict.allowed) return
      const bucket = buckets.get(key)
      if (bucket && bucket.resetAt === verdict.resetAt && bucket.count > 0) bucket.count -= 1
    },
  }
}

/**
 * Best-effort client IP. Trusts the leftmost `x-forwarded-for` hop; Railway's
 * proxy populates this. Falls back to `x-real-ip`, then the direct address
 * passed by the caller, then a sentinel string so untraceable callers still
 * share a bucket (rather than each getting their own fresh allowance).
 */
export function extractClientIp(
  headers: Headers,
  directAddress: string | undefined,
): string {
  const xff = headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  const real = headers.get("x-real-ip")
  if (real) {
    const trimmed = real.trim()
    if (trimmed) return trimmed
  }
  return directAddress ?? "unknown"
}

/**
 * Client address for per-address limits on the private staging server, which
 * runs behind Railway's edge proxy (the socket peer is always a Railway-internal
 * address, so it cannot tell clients apart).
 *
 * Railway's edge writes `x-real-ip` itself and replaces any copy the caller
 * sent. For `x-forwarded-for`, Railway staff have described both stripping and
 * appending, so its leftmost entry may be caller-controlled: it is never used.
 * Order: `x-real-ip`, else the rightmost `x-forwarded-for` hop (the one the
 * edge wrote), else one shared "unknown" key. Where more than one value is
 * present (a duplicated header is joined with ", "), the last one is taken.
 * The failure mode of a wrong guess is a coarser bucket (several clients share
 * one key), never a caller choosing its own key from the leftmost hop.
 */
export function extractProxiedClientAddress(headers: Headers): string {
  for (const name of ["x-real-ip", "x-forwarded-for"]) {
    const last = headers.get(name)?.split(",").pop()?.trim()
    if (last) return last.slice(0, 64)
  }
  return "unknown"
}
