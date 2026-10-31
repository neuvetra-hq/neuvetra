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
})
