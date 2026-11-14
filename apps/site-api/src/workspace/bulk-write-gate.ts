import { scope3RespondRetry } from "./scope3-route-helpers"

/**
 * BF-19 (BI-02): at most one bulk write per API instance at a time: a spend import, a currency conversion, a spend mapping
 * save (which corrects every line of its group) and an import withdrawal. Each holds a database connection for seconds;
 * several at once took every connection of the pool and stalled other companies' ordinary requests for up to 16 s. A
 * bulk write that cannot start is refused at once with 503 `bulk_write_busy` and Retry-After, after the caller is
 * authorised for the company and before anything is written, so no idempotency receipt is spent and a later retry is a
 * first attempt. Built like the report prepare gate, which stays separate (`createScope3PrepareGate`).
 *
 * Fairness (QA follow-up 1 of PR #74): a company that has had a turn (held the gate at any moment) since another company
 * was refused cannot take the gate again while that company is still waiting. So a company that keeps re-sending its own
 * bulk writes cannot keep another out: the waiting company gets in on its next attempt once the running write ends, and a
 * company waits at most one turn per other active company. A company that has not had such a turn (for example a new one)
 * is not held back. A waiting company is remembered only while it keeps asking: it stops counting `waitLapseMs` after its
 * last refusal (Retry-After is 10 s), so a company that went away holds nobody back for long, and a company alone is never
 * slowed. At most `maxWaiting` waiting companies and their turn ends are remembered; nothing else is.
 *
 * `tryAcquire` returns a release function (null when refused). A release is idempotent and frees only its own hold. A
 * hold that is never released (a database call that never settles) frees itself after `maxHoldMs`, so the gate can never
 * block every import until a restart; the only cost is that a second bulk write may then start beside the stuck one.
 */
export interface BulkWriteGate { tryAcquire(companyId: string): (() => void) | null; readonly held: number; readonly waiting: number; readonly remembered: number }

export const BULK_WRITE_LIMIT = 1
export const BULK_WRITE_RETRY_SECONDS = 10
/** Longer than any bulk write can legitimately run (statement timeout 15 s per statement; the slowest measured 11 s). */
export const BULK_WRITE_MAX_HOLD_MS = 120_000
/** A waiting company keeps its place this long after its last refusal (three times Retry-After, for a slow retry). */
export const BULK_WRITE_WAIT_LAPSE_MS = 30_000
export const BULK_WRITE_MAX_WAITING = 1_000
/** True for every bulk action and for a refusal while the gate is free but another company is next. */
export const BULK_WRITE_BUSY = { code: "bulk_write_busy", error: "Another large spend change (an import, currency conversion, mapping or withdrawal) is in progress or next in line. Try again in a moment." } as const

export function createBulkWriteGate(options: { limit?: number; maxHoldMs?: number; waitLapseMs?: number; maxWaiting?: number; now?: () => number } = {}): BulkWriteGate {
  const limit = options.limit ?? BULK_WRITE_LIMIT, maxHoldMs = options.maxHoldMs ?? BULK_WRITE_MAX_HOLD_MS
  const waitLapseMs = options.waitLapseMs ?? BULK_WRITE_WAIT_LAPSE_MS, maxWaiting = options.maxWaiting ?? BULK_WRITE_MAX_WAITING
  const now = options.now ?? (() => performance.now())
  let held = 0
  /** Company -> its first refusal (since when it waits) and its latest refusal (keeps it waiting). */
  const waiting = new Map<string, { since: number; seen: number }>()
  /** Company -> when its last turn ended; kept only while some company has waited since before then. */
  const turnEnded = new Map<string, number>()
  const lapse = (at: number) => {
    for (const [company, entry] of waiting) if (at - entry.seen >= waitLapseMs || at < entry.seen) waiting.delete(company)
    let oldest = Infinity
    for (const entry of waiting.values()) oldest = Math.min(oldest, entry.since)
    for (const [company, ended] of turnEnded) if (ended < oldest) turnEnded.delete(company)
  }
  const refuse = (companyId: string, at: number) => {
    const entry = waiting.get(companyId)
    if (entry) entry.seen = at
    else if (waiting.size < maxWaiting) waiting.set(companyId, { since: at, seen: at })
    return null
  }
  return {
    get held() { return held },
    get waiting() { lapse(now()); return waiting.size },
    get remembered() { lapse(now()); return waiting.size + turnEnded.size },
    tryAcquire(companyId: string) {
      const at = now()
      lapse(at)
      if (held >= limit) return refuse(companyId, at)
      // A company whose last turn ended after another company began waiting lets that company go first.
      const ended = turnEnded.get(companyId)
      if (ended !== undefined) for (const [other, entry] of waiting) if (other !== companyId && entry.since <= ended) return refuse(companyId, at)
      waiting.delete(companyId)
      held += 1
      let released = false
      const release = () => {
        if (released) return
        released = true
        clearTimeout(timer)
        held -= 1
        // Remembered only if someone waits (the next tryAcquire drops it otherwise); bounded like the waiting companies.
        if (waiting.size > 0 && (turnEnded.has(companyId) || turnEnded.size < maxWaiting)) turnEnded.set(companyId, now())
      }
      const timer = setTimeout(release, maxHoldMs)
      ;(timer as { unref?: () => void }).unref?.()
      return release
    },
  }
}

/** The refusal of a bulk write while another runs on this instance or another company is next (nothing was saved). */
export function bulkWriteBusyResponse(): Response {
  return scope3RespondRetry(503, BULK_WRITE_BUSY, BULK_WRITE_RETRY_SECONDS)
}
