/**
 * WO-09 (P0-08, QA-280; Claude, 11 November 2026): client timeouts for workspace requests. A request that never answers
 * no longer spins forever: after 8 s it is reported as slow (SlowRequestNotice shows "Taking longer than usual…"), and at
 * its limit it is aborted with a RequestTimeoutError whose text offers Try again. The limits by kind of request:
 * 35 s by default, 95 s for Scope 3 results, 125 s for preparing a report version and 125 s for an evidence upload.
 *
 * A timeout changes nothing about the request itself: the same body (and so the same idempotency key) is sent again
 * by a retry, which the server answers as a replay instead of recording a second version.
 */
export type RequestKind = "default" | "scope3Results" | "reportPrepare" | "upload"

export const SLOW_REQUEST_TEXT = "Taking longer than usual…"
export const REQUEST_TIMEOUT_TEXT = "Neuvetra didn't answer in time. Nothing was lost — Try again."
export const SERVER_BUSY_TEXT = "Neuvetra is busy — try again in a moment."

const DEFAULT_LIMITS: Readonly<Record<RequestKind, number>> = { default: 35_000, scope3Results: 95_000, reportPrepare: 125_000, upload: 125_000 }
const DEFAULT_SLOW_AFTER_MS = 8_000
let limits: Record<RequestKind, number> = { ...DEFAULT_LIMITS }
let slowAfterMs = DEFAULT_SLOW_AFTER_MS

/** Tests shorten the limits; `configureRequestTimeouts()` with no argument restores the defaults. */
export function configureRequestTimeouts(options?: Partial<Record<RequestKind, number>> & { slowAfterMs?: number }) {
  const { slowAfterMs: slow, ...kinds } = options ?? {}
  limits = options ? { ...limits, ...kinds } : { ...DEFAULT_LIMITS }
  slowAfterMs = options ? slow ?? slowAfterMs : DEFAULT_SLOW_AFTER_MS
}
export const requestTimeoutMs = (kind: RequestKind) => limits[kind]

export class RequestTimeoutError extends Error {
  override readonly name = "RequestTimeoutError"
  constructor(readonly kind: RequestKind, readonly timeoutMs: number) { super(REQUEST_TIMEOUT_TEXT) }
}
export const isRequestTimeout = (value: unknown): value is RequestTimeoutError => value instanceof RequestTimeoutError

/**
 * 503 codes whose server text says more than "busy" (a capability not switched on, or a busy state with its own advice).
 * Any other 503 (no code, an unknown code, or a proxy's page) is shown as SERVER_BUSY_TEXT. Status and code are kept.
 */
const SPECIFIC_503_CODES = new Set(["collection_unavailable", "scope3_unavailable", "scope3_schema_30_required", "company_busy", "write_timed_out", "report_prepare_busy"])
export function serverErrorText(status: number, code: string | null, text: string): string {
  return status === 503 && (code === null || !SPECIFIC_503_CODES.has(code)) ? SERVER_BUSY_TEXT : text
}

export type RequestEvent = { type: "slow"; kind: RequestKind } | { type: "settled"; kind: RequestKind; wasSlow: boolean; timedOut: boolean }
const listeners = new Set<(event: RequestEvent) => void>()
let slowCount = 0
/** How many requests are running past the slow mark right now. */
export const slowRequestCount = () => slowCount
export function subscribeRequestEvents(listener: (event: RequestEvent) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function emit(event: RequestEvent) { for (const listener of [...listeners]) { try { listener(event) } catch { /* a listener never breaks a request */ } } }

/**
 * Runs `run` with a signal that aborts when `outer` aborts or the kind's limit passes. An outer abort rejects with the
 * outer reason, as before; the limit rejects with RequestTimeoutError even if `run` ignores its signal.
 */
export async function withRequestTimeout<T>(kind: RequestKind, outer: AbortSignal | null | undefined, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  outer?.throwIfAborted()
  const controller = new AbortController()
  const timeout = new RequestTimeoutError(kind, limits[kind])
  let wasSlow = false, timedOut = false
  const onOuterAbort = () => controller.abort(outer?.reason)
  outer?.addEventListener("abort", onOuterAbort, { once: true })
  const slowTimer = setTimeout(() => { wasSlow = true; slowCount++; emit({ type: "slow", kind }) }, slowAfterMs)
  const limitTimer = setTimeout(() => { timedOut = true; controller.abort(timeout) }, limits[kind])
  try {
    return await new Promise<T>((resolve, reject) => {
      controller.signal.addEventListener("abort", () => reject(timedOut ? timeout : controller.signal.reason), { once: true })
      run(controller.signal).then(resolve, reject)
    })
  } catch (error) {
    throw timedOut ? timeout : error
  } finally {
    clearTimeout(slowTimer); clearTimeout(limitTimer)
    outer?.removeEventListener("abort", onOuterAbort)
    if (wasSlow) slowCount--
    emit({ type: "settled", kind, wasSlow, timedOut })
  }
}
