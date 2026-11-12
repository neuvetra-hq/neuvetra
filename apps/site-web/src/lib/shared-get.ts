/**
 * Round 3 lane C (PR-3; Claude, 31 October 2026): shared GETs for the workspace API. A Fix round trip (Results → Activity
 * → Results) used to read collection, setup and activities three times each (journey status, the Activity screen, its
 * panels) and a few quick fixes hit the server's per-user limit. Identical GETs of one signed-in user now share one
 * request while it runs and, in the app, for two seconds after (each caller gets its own copy of the body); any write by that user
 * clears every shared answer, so a read after a save is always fresh. A GET answered 429 is retried once after the
 * server's Retry-After (at most 5 s); writes are never retried. Only successful answers are shared.
 */
/** How long a finished GET is reused: 0 (only while it runs) unless the app configures it (staging.tsx: 2 s). */
import { withRequestTimeout, type RequestKind } from "./request-timeout"

let ttlMs = 0
const MAX_RETRY_WAIT_MS = 5_000
export function configureSharedGets(options: { ttlMs: number }) { ttlMs = Math.max(0, options.ttlMs) }
type Entry = { at: number; response: Promise<Response>; done: boolean }
const shared = new Map<string, Entry>()

export function clearSharedGets(userId?: string) {
  if (userId === undefined) shared.clear()
  else for (const key of [...shared.keys()]) if (key.startsWith(`${userId}\u0000`)) shared.delete(key)
}

async function withRetry(path: string, init: RequestInit, retry: boolean): Promise<Response> {
  const response = await fetch(path, init)
  if (response.status !== 429 || !retry) return response
  const seconds = Number(response.headers.get("retry-after"))
  await new Promise(resolve => setTimeout(resolve, Math.min(MAX_RETRY_WAIT_MS, Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 2_000)))
  init.signal?.throwIfAborted()
  return fetch(path, init)
}

/** WO-04b: completed writes (any non-GET answered 2xx), by user and path. Returns the unsubscribe. */
export type CompletedWrite = { userId: string; path: string }
const writeListeners = new Set<(write: CompletedWrite) => void>()
export function subscribeWrites(listener: (write: CompletedWrite) => void): () => void {
  writeListeners.add(listener)
  return () => { writeListeners.delete(listener) }
}
/**
 * WO-04c: tells the listeners about one completed write. `sharedFetch` calls it for its own writes; the Scope 3 assessment
 * and report clients (their own fetch) call it too, so no view that depends on saved data can go stale.
 */
export function notifyWrite(write: CompletedWrite): void {
  for (const listener of [...writeListeners]) { try { listener(write) } catch { /* a listener never breaks a write */ } }
}

/** fetch for one signed-in user: GETs shared and retried once on 429; writes clear the shared GETs. */
/** WO-09: each request (a write, or the one shared GET) is limited by its kind's timeout and reported when slow. */
export async function sharedFetch(actor: { userId: string; signal?: AbortSignal }, path: string, init: RequestInit, options: { kind?: RequestKind } = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase()
  const kind = options.kind ?? "default"
  if (method !== "GET") {
    clearSharedGets(actor.userId)
    try {
      const response = await withRequestTimeout(kind, init.signal, signal => withRetry(path, { ...init, signal }, false))
      // WO-04b: a completed write tells the workspace, so readiness that depends on saved data (Scope 3) is checked again.
      if (response.ok) notifyWrite({ userId: actor.userId, path })
      return response
    } finally { clearSharedGets(actor.userId) }
  }
  const key = `${actor.userId}\u0000${path}`
  const now = Date.now(), hit = shared.get(key)
  if (hit && (now - hit.at < ttlMs || !hit.done)) { const response = await hit.response; actor.signal?.throwIfAborted(); return response.clone() }
  // The shared request is not tied to one caller's signal (another screen may still want it); each caller checks its own.
  // WO-09: it has its own time limit, so a GET that never answers can't keep later callers waiting on it.
  const response = withRequestTimeout(kind, undefined, signal => withRetry(path, { ...init, signal }, true))
  const entry: Entry = { at: now, response, done: false }
  shared.set(key, entry)
  try {
    const answer = await response
    entry.done = true; entry.at = Date.now()
    if (!answer.ok && shared.get(key) === entry) shared.delete(key)
    actor.signal?.throwIfAborted()
    return answer.clone()
  } catch (error) { if (shared.get(key) === entry) shared.delete(key); throw error }
}
