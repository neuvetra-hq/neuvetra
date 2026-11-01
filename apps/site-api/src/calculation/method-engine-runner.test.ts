// Scope 3 completion I-01 (DESIGN 4.2, 8.3): the engine runner's opt-in FIFO queue, request and response cap and
// per-action timeouts, against a stand-in engine; and the unchanged no-queue behaviour the Scope 1 and 2 engines keep.
import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createEngineRunner, EngineRefusal, type EngineRunnerConfig } from './method-engine-runner'

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
    const log = path.join(dir, 'order.log')
    // 2 running + 32 queued = 34 accepted; the 35th call is the 33rd that would queue.
    const results = await settle(Array.from({ length: 35 }, (_, n) => run({ action: 'calculate', n, sleepMs: 60, log })))
    expect(results.map(r => r.status)).toEqual([...Array(34).fill('fulfilled'), 'rejected'])
    expect((results[34] as PromiseRejectedResult).reason.message).toBe('Stand-in engine unavailable.')
    // Calls start in arrival order (two at a time, so neighbours may swap when their processes start together).
    const order = readFileSync(log, 'utf8').trim().split('\n').map(Number)
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 34 }, (_, n) => n))
    order.forEach((n, i) => expect(Math.abs(n - i)).toBeLessThanOrEqual(1))
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
