/**
 * When a results run happens (BF1; API-01, Scope 3 package 2 r2). Used by the Scope 1/2 and the Scope 3 results routes.
 *
 * - At most one run per company computes at a time: the engines admit two concurrent processes in total.
 * - A request that arrives while a run is in progress waits for a follow-up run, so it always reflects saves made before
 *   it was sent (BF1).
 * - A follow-up run is shared only by requests from the same actor. Each run reads with its own actor's access checks,
 *   so a request never receives data that was read under another member's access. API-01: a member whose staging access
 *   was revoked after the first context check used to receive another member's queued results.
 * - BI-01 (12 November 2026): a request may pass its AbortSignal (the client went away or its time ran out). A run whose
 *   every request has gone is stopped: `compute` receives a signal that aborts then, so the engines it started are
 *   stopped and their slots released. A run with any request still waiting is never stopped, and a request that joins a
 *   follow-up run that was already stopped gets a fresh one. A request without a signal always keeps its run.
 */
export type ResultsScheduler<T> = (companyId: string, actorId: string, compute: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal) => Promise<T>
export function createResultsScheduler<T>(): ResultsScheduler<T> {
  type Run = { promise: Promise<T>; controller: AbortController; waiters: number; done: boolean }
  type Slot = { current: Run; next: Run | null }
  const slots = new Map<string, Slot>()
  const tails = new Map<string, Promise<void>>()
  // Runs `compute` after every run already queued for this company has settled.
  const exclusive = (companyId: string, compute: () => Promise<T>): Promise<T> => {
    const run = (tails.get(companyId) ?? Promise.resolve()).then(compute)
    const tail = run.then(() => undefined, () => undefined)
    tails.set(companyId, tail)
    void tail.then(() => { if (tails.get(companyId) === tail) tails.delete(companyId) })
    return run
  }
  const create = (start: (compute: () => Promise<T>) => Promise<T>, compute: (signal: AbortSignal) => Promise<T>): Run => {
    const controller = new AbortController()
    const run: Run = { promise: null as unknown as Promise<T>, controller, waiters: 0, done: false }
    run.promise = start(() => compute(controller.signal))
    run.promise.then(() => { run.done = true }, () => { run.done = true })
    return run
  }
  // One more request waits for `run`; when every request waiting for it has aborted, the run is stopped.
  const join = (run: Run, signal: AbortSignal | undefined): Promise<T> => {
    run.waiters++
    if (!signal) return run.promise
    const leave = () => { if (--run.waiters === 0 && !run.done) run.controller.abort(new DOMException("Every request for this run has gone.", "AbortError")) }
    if (signal.aborted) leave()
    else { signal.addEventListener("abort", leave, { once: true }); run.promise.then(() => signal.removeEventListener("abort", leave), () => signal.removeEventListener("abort", leave)) }
    return run.promise
  }
  return (companyId, actorId, compute, signal) => {
    const key = `${companyId}\u0000${actorId}`
    const slot = slots.get(key)
    if (slot) {
      if (!slot.next || slot.next.controller.signal.aborted) {
        const after = slot.current.promise
        slot.next = create(next => after.then(() => exclusive(companyId, next), () => exclusive(companyId, next)), compute)
      }
      return join(slot.next, signal)
    }
    const entry: Slot = { current: create(first => exclusive(companyId, first), compute), next: null }
    const settle = (): void => {
      if (slots.get(key) !== entry) return
      if (!entry.next) { slots.delete(key); return }
      entry.current = entry.next; entry.next = null
      entry.current.promise.then(settle, settle)
    }
    slots.set(key, entry)
    entry.current.promise.then(settle, settle)
    return join(entry.current, signal)
  }
}
