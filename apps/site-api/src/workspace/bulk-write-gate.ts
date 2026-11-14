import { scope3RespondRetry } from "./scope3-route-helpers"

/**
 * BF-19 (BI-02): at most one bulk write per API instance at a time: a spend import, a currency conversion, a spend mapping
 * save (which corrects every line of its group) and an import withdrawal. Each holds a database connection for seconds;
 * several at once took every connection of the pool and stalled other companies' ordinary requests for up to 16 s. A
 * second bulk write is refused at once with 503 `bulk_write_busy` and Retry-After, before it reads or writes anything, so
 * no idempotency receipt is spent and a later retry is a first attempt. Built like the report prepare gate, which stays
 * separate (`createScope3PrepareGate`).
 *
 * `tryAcquire` returns a release function (null when busy). A release is idempotent and frees only its own hold. A hold
 * that is never released (a database call that never settles) frees itself after `maxHoldMs`, so the gate can never block
 * every import until a restart; the only cost is that a second bulk write may then start beside the stuck one.
 */
export interface BulkWriteGate { tryAcquire(): (() => void) | null; readonly held: number }

export const BULK_WRITE_LIMIT = 1
export const BULK_WRITE_RETRY_SECONDS = 10
/** Longer than any bulk write can legitimately run (statement timeout 15 s per statement; the slowest measured 11 s). */
export const BULK_WRITE_MAX_HOLD_MS = 120_000
export const BULK_WRITE_BUSY = { code: "bulk_write_busy", error: "Another large import or conversion is running. Try again in a moment." } as const

export function createBulkWriteGate(options: { limit?: number; maxHoldMs?: number } = {}): BulkWriteGate {
  const limit = options.limit ?? BULK_WRITE_LIMIT, maxHoldMs = options.maxHoldMs ?? BULK_WRITE_MAX_HOLD_MS
  let held = 0
  return {
    get held() { return held },
    tryAcquire() {
      if (held >= limit) return null
      held += 1
      let released = false
      const release = () => {
        if (released) return
        released = true
        clearTimeout(timer)
        held -= 1
      }
      const timer = setTimeout(release, maxHoldMs)
      ;(timer as { unref?: () => void }).unref?.()
      return release
    },
  }
}

/** The refusal of a bulk write while another runs on this instance (nothing was read or saved). */
export function bulkWriteBusyResponse(): Response {
  return scope3RespondRetry(503, BULK_WRITE_BUSY, BULK_WRITE_RETRY_SECONDS)
}
