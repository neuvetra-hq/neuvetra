/**
 * When a results run happens (BF1; API-01, Scope 3 package 2 r2). Used by the Scope 1/2 and the Scope 3 results routes.
 *
 * - At most one run per company computes at a time: the engines admit two concurrent processes in total.
 * - A request that arrives while a run is in progress waits for a follow-up run, so it always reflects saves made before
 *   it was sent (BF1).
 * - A follow-up run is shared only by requests from the same actor. Each run reads with its own actor's access checks,
 *   so a request never receives data that was read under another member's access. API-01: a member whose staging access
 *   was revoked after the first context check used to receive another member's queued results.
 */
export function createResultsScheduler<T>(): (companyId: string, actorId: string, compute: () => Promise<T>) => Promise<T> {
  type Slot = { current: Promise<T>; next: Promise<T> | null }
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
  return (companyId, actorId, compute) => {
    const key = `${companyId}\u0000${actorId}`
    const slot = slots.get(key)
    if (slot) return slot.next ??= slot.current.then(() => exclusive(companyId, compute), () => exclusive(companyId, compute))
    const entry: Slot = { current: exclusive(companyId, compute), next: null }
    const settle = (): void => {
      if (slots.get(key) !== entry) return
      if (!entry.next) { slots.delete(key); return }
      entry.current = entry.next; entry.next = null
      entry.current.then(settle, settle)
    }
    slots.set(key, entry)
    entry.current.then(settle, settle)
    return entry.current
  }
}
