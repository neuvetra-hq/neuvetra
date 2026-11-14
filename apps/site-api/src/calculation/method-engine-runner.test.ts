// Scope 3 completion I-01 (DESIGN 4.2, 8.3): the engine runner's opt-in FIFO queue, request and response cap and
// per-action timeouts, against a stand-in engine; and the unchanged no-queue behaviour the Scope 1 and 2 engines keep.
import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createEngineRunner, EngineRefusal, KILL_GRACE_MS, ownedProcesses, type EngineRunnerConfig } from './method-engine-runner'

const python = process.env.NEUVETRA_PYTHON ?? 'python3'
const dir = mkdtempSync(path.join(tmpdir(), 'neuvetra-runner-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
// A stand-in engine: optionally logs its call number, sleeps, and answers ok (or refuses) with an optional padding.
const engine = path.join(dir, 'stand_in_engine.py')
writeFileSync(engine, [
  'import json, sys, time',
  'v = json.loads(sys.stdin.buffer.read())',
  "if v.get('log'):",
  "    open(v['log'], 'a').write(str(v['n']) + '\\n')",
  "if v.get('gate'):",
  "    open(v['gate'] + '/started-' + str(v['n']), 'w').close()",
  "    for _ in range(3000):",
  "        if __import__('os').path.exists(v['gate'] + '/go-' + str(v['n'])): break",
  "        time.sleep(0.01)",
  "time.sleep(v.get('sleepMs', 0) / 1000)",
  "if v.get('refuse'):",
  "    print(json.dumps({'status': 'refused', 'code': v['refuse']})); sys.exit(1)",
  "print(json.dumps({'status': 'ok', 'n': v.get('n'), 'received': len(json.dumps(v)), 'pad': 'x' * v.get('pad', 0)}))",
  '',
].join('\n'))
const expectedEngineSha256 = new Bun.CryptoHasher('sha256').update(readFileSync(engine)).digest('hex')
const runner = (config: Partial<EngineRunnerConfig> = {}, timeoutMs?: number) =>
  createEngineRunner({ engine, data: [], unavailable: 'Stand-in engine unavailable.', ...config }, { python, expectedEngineSha256, timeoutMs })
const settle = (calls: Array<Promise<Record<string, unknown>>>) => Promise.allSettled(calls)
const TIMEOUT = 60_000

describe('engine runner without a queue (Scope 1 and 2, unchanged)', () => {
  test('a third concurrent call is refused as unavailable; the first two succeed', async () => {
    const run = runner()
    const results = await settle([0, 1, 2].map(n => run({ action: 'calculate', n, sleepMs: 400 })))
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled', 'rejected'])
    expect((results[2] as PromiseRejectedResult).reason.message).toBe('Stand-in engine unavailable.')
    // After they finish, capacity is back.
    expect((await run({ action: 'calculate', n: 3 })).n).toBe(3)
  }, TIMEOUT)

  test('4 MiB request and response caps and a 5 second default timeout', async () => {
    const run = runner()
    await expect(run({ action: 'calculate', blob: 'x'.repeat(4 * 1024 * 1024) })).rejects.toThrow('Stand-in engine unavailable.')
    await expect(run({ action: 'calculate', pad: 4 * 1024 * 1024 + 10 })).rejects.toThrow('Stand-in engine unavailable.')
    expect((await run({ action: 'calculate', pad: 1000 })).pad).toHaveLength(1000)
    const short = runner({}, 300)
    await expect(short({ action: 'calculate', sleepMs: 1500 })).rejects.toThrow('Stand-in engine unavailable.')
  }, TIMEOUT)

  test('refusal codes pass through; a changed engine never runs', async () => {
    await expect(runner()({ action: 'calculate', refuse: 'invalid_quantity' })).rejects.toEqual(new EngineRefusal('invalid_quantity'))
    const other = createEngineRunner({ engine, data: [], unavailable: 'Stand-in engine unavailable.' }, { python, expectedEngineSha256: '0'.repeat(64) })
    await expect(other({ action: 'describe' })).rejects.toThrow('Stand-in engine unavailable.')
  }, TIMEOUT)
})

describe('engine runner with the Scope 3 queue (DESIGN 4.2)', () => {
  test('third and fourth concurrent calls wait their turn and succeed; never more than two at once', async () => {
    const run = runner({ queue: { maxConcurrent: 2, maxQueued: 32 } })
    const started = Date.now()
    const results = await Promise.all([0, 1, 2, 3].map(n => run({ action: 'calculate', n, sleepMs: 500 })))
    expect(results.map(r => r.n)).toEqual([0, 1, 2, 3])
    // Four 500 ms calls, two at a time, take at least two rounds.
    expect(Date.now() - started).toBeGreaterThanOrEqual(1000)
  }, TIMEOUT)

  test('first in, first out; the 33rd queued call is unavailable; the rest succeed', async () => {
    const run = runner({ queue: { maxConcurrent: 2, maxQueued: 32 } })
    // BF-29: admission order, not process start order. Each call holds its slot until the test releases it (a gate file), and
    // each start writes a marker, so the test sees exactly which calls hold a slot at every step, however slow the host is.
    // (Comparing the order in which the processes happened to write their first line made this test depend on host load.)
    const gate = path.join(dir, 'gate')
    mkdirSync(gate)
    const started = () => readdirSync(gate).filter(name => name.startsWith('started-')).map(name => Number(name.slice('started-'.length))).sort((a, b) => a - b)
    const until = async (count: number) => { for (let waited = 0; started().length < count; waited += 10) { if (waited > 45_000) throw new Error(`only ${started().length} of ${count} calls started`); await Bun.sleep(10) } }
    // 2 running + 32 queued = 34 accepted; the 35th call is the 33rd that would queue and is refused at once.
    const calls = Array.from({ length: 35 }, (_, n) => run({ action: 'calculate', n, gate }))
    const results = settle(calls)
    await until(2)
    expect(started()).toEqual([0, 1])
    // Release one slot at a time, newest running call first so the release order differs from the arrival order: the next
    // call to start is always the oldest one still waiting, whichever slot freed up.
    const running = [0, 1]
    for (let next = 2; next < 34; next++) {
      const freed = running.pop()!
      writeFileSync(path.join(gate, `go-${freed}`), '')
      await until(next + 1)
      expect(started()).toEqual(Array.from({ length: next + 1 }, (_, n) => n))
      running.unshift(next)
    }
    for (const n of running) writeFileSync(path.join(gate, `go-${n}`), '')
    const settled = await results
    expect(settled.map(r => r.status)).toEqual([...Array(34).fill('fulfilled'), 'rejected'])
    expect((settled[34] as PromiseRejectedResult).reason.message).toBe('Stand-in engine unavailable.')
    // Every accepted call ran exactly once, in admission order, and the refused one never started.
    expect(started()).toEqual(Array.from({ length: 34 }, (_, n) => n))
    expect(existsSync(path.join(gate, 'started-34'))).toBe(false)
    // A failed call frees its slot for the next one in the queue.
    const failing = await settle([run({ action: 'calculate', refuse: 'x', sleepMs: 200 }), run({ action: 'calculate', refuse: 'y', sleepMs: 200 }), run({ action: 'calculate', n: 99 })])
    expect(failing.map(r => r.status)).toEqual(['rejected', 'rejected', 'fulfilled'])
  }, TIMEOUT)

  test('16 MiB caps and per-action timeouts', async () => {
    const run = runner({ queue: { maxConcurrent: 2, maxQueued: 32 }, maxBytes: 16 * 1024 * 1024, timeouts: { calculate: 300, calculate_many: 5000 } })
    const five = await run({ action: 'calculate_many', blob: 'x'.repeat(5 * 1024 * 1024) })
    expect(five.received).toBeGreaterThan(5 * 1024 * 1024)
    expect((await run({ action: 'calculate_many', pad: 6 * 1024 * 1024 })).pad).toHaveLength(6 * 1024 * 1024)
    await expect(run({ action: 'calculate_many', blob: 'x'.repeat(16 * 1024 * 1024) })).rejects.toThrow('Stand-in engine unavailable.')
    await expect(run({ action: 'calculate', sleepMs: 1000 })).rejects.toThrow('Stand-in engine unavailable.')
    expect((await run({ action: 'calculate_many', n: 7, sleepMs: 1000 })).n).toBe(7)
  }, TIMEOUT)

  test('an invalid configuration is refused', () => {
    expect(() => runner({ queue: { maxConcurrent: 0, maxQueued: 1 } })).toThrow('Invalid engine runner configuration.')
    expect(() => runner({ maxBytes: 0 })).toThrow('Invalid engine runner configuration.')
  })
})

// Scope 3 completion I-03 (DESIGN 4.2): a call's own deadline (`timeoutMs`), for a route that passes what remains of its
// time budget; queue wait included. Without it a call behaves exactly as before (the tests above).
describe('engine runner: a call\'s own deadline (I-03)', () => {
  test('a running call stops at its own deadline when that comes first; the action timeout still applies when it is shorter', async () => {
    const run = runner({ queue: { maxConcurrent: 2, maxQueued: 32 }, timeouts: { calculate: 300, calculate_many: 5000 } })
    const started = Date.now()
    await expect(run({ action: 'calculate_many', sleepMs: 2000 }, { timeoutMs: 300 })).rejects.toThrow('Stand-in engine unavailable.')
    expect(Date.now() - started).toBeLessThan(1500)
    expect((await run({ action: 'calculate_many', n: 1, sleepMs: 200 }, { timeoutMs: 5000 })).n).toBe(1)
    await expect(run({ action: 'calculate', sleepMs: 1000 }, { timeoutMs: 10_000 })).rejects.toThrow('Stand-in engine unavailable.')
  }, TIMEOUT)

  test('a call whose deadline passes while it waits leaves the queue as unavailable; the calls behind it still run in order', async () => {
    const run = runner({ queue: { maxConcurrent: 2, maxQueued: 32 } })
    const busy = [run({ action: 'calculate', n: 0, sleepMs: 1000 }), run({ action: 'calculate', n: 1, sleepMs: 1000 })]
    const started = Date.now()
    const late = run({ action: 'calculate', n: 2 }, { timeoutMs: 200 })
    const after = run({ action: 'calculate', n: 3 })
    await expect(late).rejects.toThrow('Stand-in engine unavailable.')
    expect(Date.now() - started).toBeLessThan(800)          // it gave up while the two slow calls were still running
    expect((await Promise.all([...busy, after])).map(r => r.n)).toEqual([0, 1, 3])
    // Nothing leaked: two more calls run at once afterwards.
    expect((await Promise.all([run({ action: 'calculate', n: 4 }), run({ action: 'calculate', n: 5 })])).map(r => r.n)).toEqual([4, 5])
  }, TIMEOUT)

  test('an invalid call timeout is refused before anything runs', async () => {
    const run = runner({ queue: { maxConcurrent: 2, maxQueued: 32 } })
    for (const timeoutMs of [0, -5, 1.5, Number.NaN]) await expect(run({ action: 'calculate' }, { timeoutMs })).rejects.toThrow('Invalid engine call timeout.')
    expect((await run({ action: 'calculate', n: 9 }, {})).n).toBe(9)
  }, TIMEOUT)
})

// BI-10 (backend audit, 12 November 2026): an engine that ignores SIGTERM or leaves a child holding its output used to
// keep the call (and its engine slot) for 30-60 s past a 5 s timeout. Each stand-in below writes its process IDs first.
describe('BI-10: a stopped engine is killed with its process group, and the call never waits for its pipes', () => {
  const stub = (name: string, body: string[]) => {
    const file = path.join(dir, name)
    writeFileSync(file, ['import json, os, signal, subprocess, sys, time', 'v = json.loads(sys.stdin.buffer.read())', ...body, ''].join('\n'))
    return { file, sha: new Bun.CryptoHasher('sha256').update(readFileSync(file)).digest('hex') }
  }
  // Writes "<pid> [<grandchild pid>]" to v['pids'] before misbehaving.
  const ignoresTerm = stub('ignores_term.py', ["signal.signal(signal.SIGTERM, signal.SIG_IGN)", "open(v['pids'], 'w').write(str(os.getpid()))", 'time.sleep(60)'])
  const grandchildHangs = stub('grandchild_hangs.py', ["c = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])", "open(v['pids'], 'w').write(f'{os.getpid()} {c.pid}')", 'time.sleep(60)'])
  const grandchildOutlives = stub('grandchild_outlives.py', ["c = subprocess.Popen([sys.executable, '-c', 'import signal, time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(60)'])",
    "open(v['pids'], 'w').write(f'{os.getpid()} {c.pid}')", "print(json.dumps({'status': 'ok'}))", 'sys.stdout.flush()', 'os._exit(0)'])
  const sleeper = stub('sleeper.py', ["open(v['pids'], 'w').write(str(os.getpid()))", "time.sleep(v.get('sleepMs', 0) / 1000)", "print(json.dumps({'status': 'ok', 'n': v.get('n')}))"])
  const make = (s: { file: string; sha: string }, config: Partial<EngineRunnerConfig> = {}, timeoutMs = 600) =>
    createEngineRunner({ engine: s.file, data: [], unavailable: 'Stand-in engine unavailable.', ...config }, { python, expectedEngineSha256: s.sha, timeoutMs })
  let calls = 0
  const pidsFile = () => path.join(dir, `pids-${++calls}.txt`)
  // A killed process whose parent has gone may stay a zombie until init reaps it: that is not running.
  const alive = (pid: number) => {
    try { process.kill(pid, 0) } catch { return false }
    try { return !/^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, 'utf8')) } catch { return true }
  }
  const pidsOf = async (file: string) => { for (let i = 0; i < 100 && !Bun.file(file).size; i++) await Bun.sleep(20); return readFileSync(file, 'utf8').trim().split(' ').map(Number) }
  const timed = async (call: Promise<unknown>) => { const start = performance.now(); const outcome = await call.then(() => 'ok', (error: Error) => error.message); return { outcome, ms: performance.now() - start } }

  for (const [label, engine] of [['ignores SIGTERM', ignoresTerm], ['leaves a child holding its output and hangs', grandchildHangs], ['answers, exits and leaves a child holding its output', grandchildOutlives]] as const)
    test(`an engine that ${label} is unavailable at its timeout, and every process of it is gone within the grace`, async () => {
      const run = make(engine), pids = pidsFile()
      const { outcome, ms } = await timed(run({ action: 'calculate', pids }))
      expect(outcome).toBe('Stand-in engine unavailable.')
      expect(ms).toBeLessThan(600 + 400)  // rejected on the timer (before: 30-60 s)
      await Bun.sleep(KILL_GRACE_MS + 300)
      expect((await pidsOf(pids)).filter(alive)).toEqual([])
      // Both slots are free again.
      const again = make(sleeper)
      expect((await Promise.all([1, 2].map(n => again({ action: 'calculate', n, pids: pidsFile() })))).map(r => r.n)).toEqual([1, 2])
    }, TIMEOUT)

  test('the slot is held until the stopped engine has exited, so never more than two run at once', async () => {
    const run = make(ignoresTerm)
    const pids = [pidsFile(), pidsFile()]
    await Promise.allSettled(pids.map(file => run({ action: 'calculate', pids: file })))
    // Both calls have been rejected, but both engines are still in their grace: a third call is refused, not started.
    await expect(run({ action: 'calculate', pids: pidsFile() })).rejects.toThrow('Stand-in engine unavailable.')
    await Bun.sleep(KILL_GRACE_MS + 300)
    for (const file of pids) expect((await pidsOf(file)).filter(alive)).toEqual([])
  }, TIMEOUT)

  test('an aborted call stops its engine at once; an aborted waiting call leaves the queue and the others run in order', async () => {
    const run = make(sleeper, { queue: { maxConcurrent: 1, maxQueued: 4 } }, 10_000)
    const controller = new AbortController(), pids = pidsFile()
    const running = timed(run({ action: 'calculate', n: 1, sleepMs: 5000, pids }, { signal: controller.signal }))
    const waitingController = new AbortController()
    const waiting = run({ action: 'calculate', n: 2, pids: pidsFile() }, { signal: waitingController.signal })
    const after = run({ action: 'calculate', n: 3, pids: pidsFile() })
    const [pid] = await pidsOf(pids)
    waitingController.abort()
    await expect(waiting).rejects.toThrow('Stand-in engine unavailable.')
    controller.abort()
    const { outcome, ms } = await running
    expect(outcome).toBe('Stand-in engine unavailable.')
    expect(ms).toBeLessThan(3000)
    expect((await after).n).toBe(3)
    expect(alive(pid!)).toBe(false)
    // A signal that has already aborted never starts an engine.
    const gone = new AbortController(); gone.abort()
    await expect(run({ action: 'calculate', n: 4, pids: pidsFile() }, { signal: gone.signal })).rejects.toThrow('Stand-in engine unavailable.')
  }, TIMEOUT)
})

describe('BI-01: pinned entry scripts and queued actions', () => {
  const entryFile = path.join(dir, 'entry.py')
  writeFileSync(entryFile, ['import json, sys', 'v = json.loads(sys.stdin.buffer.read())', "print(json.dumps({'status': 'ok', 'via': 'entry', 'pad': 'x' * v.get('pad', 0)}))", ''].join('\n'))
  const entrySha = new Bun.CryptoHasher('sha256').update(readFileSync(entryFile)).digest('hex')

  test('an action with an entry runs that script, which is hashed before every call; the engine is still hashed too', async () => {
    const run = runner({ entries: { many: { path: entryFile, sha256: entrySha, maxBytes: 6 * 1024 * 1024 } } })
    expect((await run({ action: 'many' })).via).toBe('entry')
    expect((await run({ action: 'calculate', n: 1 })).n).toBe(1)  // other actions still run the engine
    // Its own cap: 5 MiB is over the engine's 4 MiB but within the entry's 6 MiB.
    expect(((await run({ action: 'many', pad: 5 * 1024 * 1024 })).pad as string).length).toBe(5 * 1024 * 1024)
    await expect(run({ action: 'many', pad: 7 * 1024 * 1024 })).rejects.toThrow('Stand-in engine unavailable.')
    await expect(runner({ entries: { many: { path: entryFile, sha256: '0'.repeat(64), maxBytes: 1024 } } })({ action: 'many' })).rejects.toThrow('Stand-in engine unavailable.')
    const changedEngine = createEngineRunner({ engine, data: [], unavailable: 'Stand-in engine unavailable.', entries: { many: { path: entryFile, sha256: entrySha, maxBytes: 1024 } } }, { python, expectedEngineSha256: '0'.repeat(64) })
    await expect(changedEngine({ action: 'many' })).rejects.toThrow('Stand-in engine unavailable.')
    expect(() => runner({ entries: { many: { path: entryFile, sha256: 'nope', maxBytes: 1024 } } })).toThrow('Invalid engine runner configuration.')
  }, TIMEOUT)

  test('with queuedActions only those actions wait; any other action is refused when both slots are busy (A18)', async () => {
    const run = runner({ queue: { maxConcurrent: 2, maxQueued: 4 }, queuedActions: ['calculate_many'] })
    const busy = [0, 1].map(n => run({ action: 'calculate_many', n, sleepMs: 600 }))
    await Bun.sleep(150)
    const waits = run({ action: 'calculate_many', n: 2 })
    await expect(run({ action: 'calculate', n: 3 })).rejects.toThrow('Stand-in engine unavailable.')
    expect((await Promise.all([...busy, waits])).map(r => r.n)).toEqual([0, 1, 2])
  }, TIMEOUT)
})

// BI-01b (QA follow-up 2 of PR #68): the delayed SIGKILL, and the clean-up after a finished engine, used kill(-pgid). Once the
// engine has been reaped its process ID can be reused, and a new process group with that ID would have been signalled.
describe('BI-01b: only processes proven to be the engine\'s own are ever signalled', () => {
  const pgid = 4242, spawnedAt = 1000, out = 'socket:[777]', err = 'socket:[778]'
  const proc = (pid: number, start: number, pgrp = pgid, pipes: string[] = [], zombie = false) => ({ pid, pgrp, start, zombie, pipes })
  const group = { pgid, leaderStart: 1001, spawnedAt, pipes: [out, err] }
  test('while the engine itself exists with its own start time, every member of its group is ours', () => {
    expect(ownedProcesses(group, [proc(pgid, 1001, pgid, [out, err]), proc(5000, 1002), proc(5001, 1500), proc(6000, 1100, 77)]).map(p => p.pid)).toEqual([pgid, 5000, 5001])
  })
  test('a reused engine ID (another start time) and its new group are never signalled; a process holding our output still is', () => {
    // Our engine ended and was reaped. ID 4242 was then reused by a process that made its own group 4242 with a child.
    // Our leftover (start 1100) still holds the engine's stdout, in the old group or after leaving it.
    expect(ownedProcesses(group, [proc(pgid, 1300), proc(7000, 1310), proc(5000, 1100, pgid, [out]), proc(5005, 1100, 99, [err])]).map(p => p.pid)).toEqual([5000, 5005])
    // No reused ID and no holder: nothing at all, even if the old group still has members (they can't be proven ours).
    expect(ownedProcesses(group, [proc(5000, 1100), proc(5001, 1200)])).toEqual([])
    // Zombies, and processes older than the spawn (which cannot be the engine's), are left alone.
    expect(ownedProcesses(group, [proc(5000, 1100, pgid, [out], true), proc(5002, 999, pgid, [out])])).toEqual([])
  })
  // Not covered on purpose (QA follow-up 1 of PR #71): a detached leftover that has closed the engine's output survives a
  // normal finish, since it can no longer be proven ours. The engines and the batch entry point never start processes.
  test('a real leftover holding the output is killed after the engine answered and exited; a bystander never is', async () => {
    const bystander = Bun.spawn([python, '-c', 'import time; time.sleep(30)'], { detached: true, stdout: 'ignore', stderr: 'ignore' })
    try {
      const file = path.join(dir, 'leftover.py')
      writeFileSync(file, ['import json, os, subprocess, sys', 'v = json.loads(sys.stdin.buffer.read())',
        // The leftover leaves the engine's group (its own session) and ignores SIGTERM, but keeps stdout.
        "c = subprocess.Popen([sys.executable, '-c', 'import os, signal, time; os.setsid(); signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(60)'])",
        "open(v['pids'], 'w').write(str(c.pid))", "print(json.dumps({'status': 'ok'}))", 'sys.stdout.flush()', 'os._exit(0)', ''].join('\n'))
      const sha = new Bun.CryptoHasher('sha256').update(readFileSync(file)).digest('hex')
      const pids = path.join(dir, `leftover-${Date.now()}.txt`)
      const run = createEngineRunner({ engine: file, data: [], unavailable: 'Stand-in engine unavailable.' }, { python, expectedEngineSha256: sha, timeoutMs: 600 })
      await expect(run({ action: 'calculate', pids })).rejects.toThrow('Stand-in engine unavailable.')
      await Bun.sleep(KILL_GRACE_MS + 300)
      const running = (pid: number) => { try { process.kill(pid, 0) } catch { return false } try { return !/^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, 'utf8')) } catch { return true } }
      expect(running(Number(readFileSync(pids, 'utf8')))).toBe(false)
      expect(running(bystander.pid)).toBe(true)
    } finally { bystander.kill('SIGKILL') }
  }, TIMEOUT)
})
