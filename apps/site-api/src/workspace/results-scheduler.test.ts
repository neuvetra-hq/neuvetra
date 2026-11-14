// API-01 (Scope 3 package 2 r2, Claude, 27 October 2026): results runs are one per company at a time, and a follow-up run
// is shared only by requests from the same actor, so no response is read under another member's access.
import { describe, expect, test } from "bun:test"
import { createResultsScheduler } from "./results-scheduler"

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r }); return { promise, resolve } }
const tick = () => Bun.sleep(5)

describe("results scheduler", () => {
  test("one run per company at a time, whoever asks; another company isn't blocked", async () => {
    const schedule = createResultsScheduler<string>(), gate = deferred(), started: string[] = []
    const run = (label: string, wait?: Promise<void>) => async () => { started.push(label); if (wait) await wait; return label }
    const a = schedule("company-1", "actor-a", run("a", gate.promise))
    const b = schedule("company-1", "actor-b", run("b"))
    const other = schedule("company-2", "actor-b", run("other"))
    await tick()
    expect(started).toEqual(["a", "other"]) // b waits for a; another company runs at once
    gate.resolve()
    expect(await Promise.all([a, b, other])).toEqual(["a", "b", "other"])
    expect(started).toEqual(["a", "other", "b"])
  })

  test("requests from the same actor during a run share one follow-up; another actor's request runs its own compute", async () => {
    const schedule = createResultsScheduler<string>(), gate = deferred(), started: string[] = []
    let count = 0
    const run = (actor: string, wait?: Promise<void>) => async () => { const label = `${actor}#${++count}`; started.push(label); if (wait) await wait; return label }
    const first = schedule("company-1", "actor-a", run("a", gate.promise))
    await tick()
    const again = [schedule("company-1", "actor-a", run("a")), schedule("company-1", "actor-a", run("a"))]
    const member = schedule("company-1", "actor-b", run("b"))
    await tick()
    expect(started).toEqual(["a#1"])
    gate.resolve()
    const [x, y, z, w] = await Promise.all([first, ...again, member])
    expect(x).toBe("a#1")
    expect(y).toBe(z) // the same actor's two later requests got one follow-up run
    expect(w.startsWith("b#")).toBe(true) // the other member's request was computed with its own reads
    expect(started).toHaveLength(3)
    // Nothing stays queued: a later request runs at once.
    expect(await schedule("company-1", "actor-a", run("a"))).toBe("a#4")
  })

  test("a failed run doesn't block or fail the runs behind it", async () => {
    const schedule = createResultsScheduler<string>()
    const failing = schedule("company-1", "actor-a", async () => { await tick(); throw new Error("engine unavailable") })
    const next = schedule("company-1", "actor-b", async () => "b")
    expect(await failing.catch((error: Error) => error.message)).toBe("engine unavailable")
    expect(await next).toBe("b")
  })

  test("BI-01: a run is stopped only when every request waiting for it has gone; a later request gets a fresh run", async () => {
    const schedule = createResultsScheduler<string>(), gate = deferred(), seen: AbortSignal[] = []
    let count = 0
    const run = (wait?: Promise<void>) => async (signal: AbortSignal) => { seen.push(signal); const label = `run#${++count}`; if (wait) await wait; if (signal.aborted) throw new Error("stopped"); return label }
    // The first request's run: stopped when that request goes.
    const first = new AbortController()
    const a = schedule("company-1", "actor-a", run(gate.promise), first.signal)
    await tick()
    // Two later requests share the follow-up; one of them goes, the other still waits, so the follow-up is not stopped.
    const later = [new AbortController(), new AbortController()]
    const b = schedule("company-1", "actor-a", run(), later[0]!.signal), c = schedule("company-1", "actor-a", run(), later[1]!.signal)
    first.abort()
    expect(seen[0]!.aborted).toBe(true)
    later[0]!.abort()
    gate.resolve()
    expect(await a.catch((error: Error) => error.message)).toBe("stopped")
    expect(await b).toBe(await c)
    expect(seen[1]!.aborted).toBe(false)
    // A request without a signal never has its run stopped; a follow-up whose requests all went is replaced for a newcomer.
    const hold = deferred()
    const d = schedule("company-1", "actor-a", run(hold.promise))
    await tick()
    const gone = new AbortController()
    const e = schedule("company-1", "actor-a", run(), gone.signal)
    gone.abort()
    const f = schedule("company-1", "actor-a", run())
    hold.resolve()
    expect(await d).toMatch(/^run#/)
    expect(await e.catch((error: Error) => error.message)).toBe("stopped")
    expect(await f).toMatch(/^run#/)
  })
})
