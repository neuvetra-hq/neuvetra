/**
 * Runs a pinned Python method engine: re-hashes the engine and its data files before every call.
 * expectedEngineSha256 is required (re-review P3-4): pass the engine_sha256 of the current release.
 *
 * Scope 3 completion I-01 (DESIGN 4.2): a runner may opt in to a FIFO queue, a larger request and response cap and
 * per-action timeouts. Without a queue (the Scope 1 and 2 engines) it behaves exactly as before: at most two engine
 * processes at a time, a third concurrent call refused as unavailable, 4 MiB caps and a 5 second timeout (A18).
 *
 * Scope 3 completion I-03 (DESIGN 4.2): a call may also carry its own `timeoutMs`, a deadline for the whole call (waiting
 * in the queue and running), so a route with a time budget can pass what remains of it. A call still waiting when its
 * deadline passes leaves the queue unavailable; a running one is stopped at the earlier of its action's timeout and its
 * deadline. Without it, a call behaves exactly as before.
 *
 * BI-01 (12 November 2026): an action may be served by its own entry script (`entries`), such as the Scope 1 and 2
 * batch entry point that loads the engine file and calls its per-record `handle` for many records in one process. The
 * entry script is pinned and re-hashed before every call like the engine and its data; the engine file is still hashed
 * against expectedEngineSha256. With `queuedActions`, only those actions may wait in the queue; every other action keeps
 * the no-wait rule. A call may carry an AbortSignal: a waiting call leaves the queue, a running one is stopped.
 *
 * BI-10: the engine runs in its own process group. A call that times out, is aborted or writes too much is rejected at
 * once (it never waits for the pipes to close); the group gets SIGTERM and, after KILL_GRACE_MS, SIGKILL, so an engine
 * that ignores SIGTERM or leaves a child holding its output cannot keep running. The engine slot is released when the
 * engine process has exited.
 */
import { readdirSync, readFileSync, readlinkSync } from 'node:fs'
import path from 'node:path'

export class EngineRefusal extends Error { constructor(readonly code: string) { super(`Input refused: ${code}`) } }

const MAX_BYTES = 4 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 5000
/** BI-10: from SIGTERM to SIGKILL of a stopped engine's process group. */
export const KILL_GRACE_MS = 500
// A new process group needs POSIX (Bun's `detached`); on Windows only the engine process itself can be signalled.
const PROCESS_GROUPS = process.platform !== 'win32'

/**
 * BI-01b (QA follow-up 2 of PR #68): which processes a stop may signal. A process group is named by its leader's process ID,
 * and an ID can be reused once nothing uses it any more, so the runner never signals by group ID (`kill(-pgid)`). It signals
 * processes one by one, each one it can prove is its own:
 * - while the engine itself still exists with the start time it had when it was spawned (running, or ended but not yet
 *   reaped), its ID cannot have been reused, so every member of its group is ours;
 * - any process holding the engine's own stdout or stderr (Bun gives the engine one end of a socket pair for each, named by
 *   its inode, which stays the same object while any process still holds it) is ours, whatever its group, since it is what
 *   keeps the call from finishing.
 * Nothing else is signalled: a process that left the pipes and outlived an engine that has been reaped is left alone,
 * because its ownership can no longer be proven. Start times are /proc clock ticks since boot.
 */
export interface ProcessFacts { pid: number; pgrp: number; start: number; zombie: boolean; pipes: readonly string[] }
export interface EngineGroup { pgid: number; leaderStart: number | null; spawnedAt: number; pipes: readonly string[] }
export function ownedProcesses(group: EngineGroup, processes: readonly ProcessFacts[]): Array<{ pid: number; start: number }> {
  const leader = processes.find(p => p.pid === group.pgid)
  const leaderIsOurs = leader !== undefined && group.leaderStart !== null && leader.start === group.leaderStart
  return processes.filter(p => !p.zombie && p.start >= group.spawnedAt
    && ((leaderIsOurs && p.pgrp === group.pgid) || p.pipes.some(pipe => group.pipes.includes(pipe)))).map(p => ({ pid: p.pid, start: p.start }))
}
/** Linux only (null elsewhere): one process's group, start time (clock ticks since boot) and whether it is a zombie. */
function processFacts(pid: number, withPipes = false): ProcessFacts | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')  // fields 3 onwards: state, ppid, pgrp, ..., starttime (22)
    return { pid, pgrp: Number(fields[2]), start: Number(fields[19]), zombie: fields[0] === 'Z', pipes: withPipes ? pipesOf(pid) : [] }
  } catch { return null }
}
function pipesOf(pid: number): string[] {
  try { return readdirSync(`/proc/${pid}/fd`).map(fd => { try { return readlinkSync(`/proc/${pid}/fd/${fd}`) } catch { return '' } }).filter(link => link.startsWith('pipe:') || link.startsWith('socket:')) } catch { return [] }
}
const HAS_PROC = (() => { try { readFileSync('/proc/self/stat'); return true } catch { return false } })()
/** Every process that started at or after `since` (only those can be an engine's), with the pipes it holds. */
const processesSince = (since: number): ProcessFacts[] => readdirSync('/proc').filter(name => /^[0-9]+$/.test(name)).map(name => processFacts(Number(name)))
  .filter((p): p is ProcessFacts => p !== null && p.start >= since && p.pid !== process.pid).map(p => ({ ...p, pipes: pipesOf(p.pid) }))
/** Clock ticks since boot (USER_HZ is 100 on Linux), the unit of a process's start time. */
const bootTicks = () => Math.floor(Number(readFileSync('/proc/uptime', 'utf8').split(' ')[0]) * 100)
const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
export const sortedKeys = (v: unknown): unknown => Array.isArray(v) ? v.map(sortedKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1).map(([k, x]) => [k, sortedKeys(x)])) : v

export interface EngineOptions { python?: string; expectedEngineSha256: string; timeoutMs?: number
  /** BI-01 (Scope 1 and 2 only): the pinned SHA-256 of scope12_batch.py. With it the bridge offers calculateMany. */
  expectedBatchSha256?: string }
/** FIFO queue: up to `maxConcurrent` engine processes; up to `maxQueued` further calls wait their turn; beyond that a call is unavailable. */
export interface EngineQueue { maxConcurrent: number; maxQueued: number }
/** One call's own limit (I-03): `timeoutMs`, a positive whole number of milliseconds for the whole call. BI-01: `signal` stops it. */
export interface EngineCallOptions { timeoutMs?: number; signal?: AbortSignal }
/** BI-01: a pinned entry script that serves one action instead of the engine file, with its own request and response cap. */
export interface EngineEntry { path: string; sha256: string; maxBytes: number }
export interface EngineRunnerConfig {
  engine: string
  data: Array<{ url: URL; sha256: string }>
  unavailable: string
  /** Request and response cap in bytes (default 4 MiB). */
  maxBytes?: number
  /** Opt-in queue (Scope 3 only). Without it a third concurrent call is refused, as before. */
  queue?: EngineQueue
  /** Timeout per action in ms (for example calculate_many and aggregate); other actions use options.timeoutMs or 5 s. */
  timeouts?: Readonly<Record<string, number>>
  /** BI-01: actions served by their own pinned entry script (re-hashed before every call, as the engine is). */
  entries?: Readonly<Record<string, EngineEntry>>
  /** BI-01: with `queue`, only these actions may wait their turn; any other action is unavailable when no slot is free. */
  queuedActions?: readonly string[]
}

export function createEngineRunner(config: EngineRunnerConfig, options: EngineOptions) {
  if (!/^[0-9a-f]{64}$/.test(options?.expectedEngineSha256 ?? '')) throw new Error('An expected engine SHA-256 is required.')
  const maxBytes = config.maxBytes ?? MAX_BYTES
  // No queue: two at a time and nobody waits, which is exactly the original "active >= 2 is unavailable" rule.
  const queue = config.queue ?? { maxConcurrent: 2, maxQueued: 0 }
  const entries = config.entries ?? {}
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(queue.maxConcurrent) || queue.maxConcurrent < 1 || !Number.isSafeInteger(queue.maxQueued) || queue.maxQueued < 0
    || Object.values(entries).some(entry => !/^[0-9a-f]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.maxBytes) || entry.maxBytes < 1))
    throw new Error('Invalid engine runner configuration.')
  const entryFor = (action: string) => Object.prototype.hasOwnProperty.call(entries, action) ? entries[action] : undefined
  let active = 0
  const waiting: Array<() => void> = []
  const acquire = async (deadline: number | null, mayWait: boolean, signal: AbortSignal | undefined) => {
    if (signal?.aborted) throw new Error(config.unavailable)
    if (active < queue.maxConcurrent) { active++; return }
    if (!mayWait || waiting.length >= queue.maxQueued) throw new Error(config.unavailable)
    // The slot is handed over by release(), so `active` already counts this call when it resumes.
    if (deadline === null && !signal) { await new Promise<void>(resolve => waiting.push(resolve)); return }
    // I-03: a call whose deadline passes (BI-01: or whose signal aborts) while it waits leaves the queue (it never held
    // a slot, so nothing is released).
    await new Promise<void>((resolve, reject) => {
      let expiry: ReturnType<typeof setTimeout> | undefined
      const leave = () => { const at = waiting.indexOf(resume); if (at >= 0) { waiting.splice(at, 1); clearTimeout(expiry); reject(new Error(config.unavailable)) } }
      const resume = () => { clearTimeout(expiry); signal?.removeEventListener('abort', leave); resolve() }
      waiting.push(resume)
      if (deadline !== null) expiry = setTimeout(leave, Math.max(0, deadline - Date.now()))
      signal?.addEventListener('abort', leave, { once: true })
    })
  }
  const release = () => { const next = waiting.shift(); if (next) next(); else active-- }
  return async (payload: unknown, call: EngineCallOptions = {}): Promise<Record<string, unknown>> => {
    if (call.timeoutMs !== undefined && (!Number.isSafeInteger(call.timeoutMs) || call.timeoutMs < 1)) throw new Error('Invalid engine call timeout.')
    const deadline = call.timeoutMs === undefined ? null : Date.now() + call.timeoutMs
    const action = payload && typeof payload === 'object' && typeof (payload as { action?: unknown }).action === 'string' ? (payload as { action: string }).action : ''
    const entry = entryFor(action)
    const cap = entry?.maxBytes ?? maxBytes
    const encoded = JSON.stringify(payload)
    if (new TextEncoder().encode(encoded).length > cap) throw new Error(config.unavailable)
    await acquire(deadline, !config.queuedActions || config.queuedActions.includes(action), call.signal)
    let child: ReturnType<typeof Bun.spawn> | undefined, timer: ReturnType<typeof setTimeout> | undefined, stopping = false
    let group: EngineGroup | null = null
    // BI-01b: SIGTERM goes to the processes proven ours at that moment; SIGKILL, after the grace, to the same processes
    // (each re-checked by start time) and to any new one still proven ours. The engine itself is also signalled through Bun
    // while it hasn't ended (that handle is never a reused ID).
    let targets: Array<{ pid: number; start: number }> = []
    const signalOurs = (signal: 'SIGTERM' | 'SIGKILL') => {
      if (!child) return
      if (PROCESS_GROUPS && HAS_PROC && group) {
        const now = ownedProcesses(group, processesSince(group.spawnedAt))
        const still = targets.filter(t => { const p = processFacts(t.pid); return p !== null && !p.zombie && p.start === t.start })
        targets = [...new Map([...still, ...now].map(t => [t.pid, t])).values()]
        for (const t of targets) try { process.kill(t.pid, signal) } catch { /* already gone */ }
      }
      try { if (child.exitCode === null && child.signalCode === null) child.kill(signal) } catch { /* already gone */ }
    }
    let halt = (_reason: string) => {}
    const onAbort = () => halt('aborted')
    try {
      if (sha256(await Bun.file(config.engine).bytes()) !== options.expectedEngineSha256) throw new Error('engine')
      for (const d of config.data) if (sha256(await Bun.file(d.url).bytes()) !== d.sha256) throw new Error('data')
      if (entry && sha256(await Bun.file(entry.path).bytes()) !== entry.sha256) throw new Error('entry')
      if (call.signal?.aborted) throw new Error('aborted')
      const spawnedAt = HAS_PROC ? bootTicks() : 0
      child = Bun.spawn([options.python ?? process.env.NEUVETRA_PYTHON ?? 'python', entry?.path ?? config.engine], {
        stdin: new Blob([encoded]), stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', PYTHONIOENCODING: 'utf-8' },
        // BI-10: its own process group, so a stop reaches any process it started. The Scope 1, 2 and 3 engines and the batch
        // entry point never start processes; a detached leftover (one that left the engine's output) is not killed after a
        // normal finish, because it can no longer be proven the engine's own (BI-01b; QA follow-up 1 of PR #71).
        detached: PROCESS_GROUPS,
      })
      if (PROCESS_GROUPS && HAS_PROC) {
        // The engine's start time and its stdout and stderr pipes, read while it cannot have ended unnoticed.
        const leader = processFacts(child.pid)
        const output = [1, 2].map(fd => { try { return readlinkSync(`/proc/${child!.pid}/fd/${fd}`) } catch { return '' } }).filter(link => link.startsWith('pipe:') || link.startsWith('socket:'))
        group = { pgid: child.pid, leaderStart: leader?.start ?? null, spawnedAt, pipes: output }
      }
      const readers: Array<ReadableStreamDefaultReader<Uint8Array>> = []
      // BI-10: a stop rejects the call at once; the pipes are cancelled, not waited for.
      const stopped = new Promise<never>((_, reject) => {
        halt = reason => {
          if (stopping) return
          stopping = true
          // The processes are found before the pipes are cancelled, while the runner still holds their read ends.
          signalOurs('SIGTERM')
          setTimeout(() => signalOurs('SIGKILL'), KILL_GRACE_MS)
          for (const reader of readers) reader.cancel().catch(() => {})
          reject(new Error(reason))
        }
      })
      stopped.catch(() => {})
      call.signal?.addEventListener('abort', onAbort, { once: true })
      const actionMs = (config.timeouts && Object.prototype.hasOwnProperty.call(config.timeouts, action) ? config.timeouts[action] : undefined) ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS
      timer = setTimeout(() => halt('timeout'), deadline === null ? actionMs : Math.max(0, Math.min(actionMs, deadline - Date.now())))
      const read = async (stream: ReadableStream<Uint8Array>) => {
        const reader = stream.getReader(); readers.push(reader); const chunks: Uint8Array[] = []; let size = 0
        for (;;) { const r = await reader.read(); if (r.done) break; size += r.value.length; if (size > cap) { halt('output'); throw new Error('output') } chunks.push(r.value) }
        return Buffer.concat(chunks).toString('utf8')
      }
      const finished = Promise.all([read(child.stdout as ReadableStream<Uint8Array>), read(child.stderr as ReadableStream<Uint8Array>), child.exited])
      finished.catch(() => {})
      const [stdout, , code] = await Promise.race([finished, stopped])
      if (stopping) throw new Error('stopped')
      const value = JSON.parse(stdout) as Record<string, unknown>
      if (code === 1 && value.status === 'refused' && typeof value.code === 'string') throw new EngineRefusal(value.code)
      if (code !== 0 || value.status !== 'ok') throw new Error('status')
      return value
    } catch (error) {
      if (error instanceof EngineRefusal) throw error
      throw new Error(config.unavailable)
    } finally {
      if (timer) clearTimeout(timer)
      call.signal?.removeEventListener('abort', onAbort)
      const ran = child
      // An engine that finished closed its pipes and was reaped: what it may have left behind can no longer be proven ours
      // (BI-01b), so nothing is signalled. A process still holding its pipes keeps the call open until the timeout stops it.
      // The slot stays taken until the engine process has exited, so no more than maxConcurrent ever run.
      if (ran) void ran.exited.then(release, release)
      else release()
    }
  }
}

/**
 * BI-01 (12 November 2026): the Scope 1 and 2 batch entry point (scope12_batch.py). It loads the unchanged engine file
 * and calls its per-record `handle` for every item, so each item is exactly what a per-record call returns. Pinned by
 * REVIEWED_SCOPE12_BATCH_SHA256 (collection-results-routes.ts) and re-hashed before every call.
 */
export const SCOPE12_BATCH_ENGINE = path.join(import.meta.dir, 'scope12_batch.py')
/** One batch call: at most 400 items (the active-record cap) and 8 MiB of requests; its response may be up to 32 MiB. */
export const SCOPE12_BATCH_MAX_ITEMS = 400
export const SCOPE12_BATCH_MAX_BYTES = 8 * 1024 * 1024
export const SCOPE12_BATCH_RESPONSE_MAX_BYTES = 32 * 1024 * 1024
/** A whole batch gets 30 s (as Scope 3's calculate_many); a results run passes less when its budget has less left. */
export const SCOPE12_BATCH_TIMEOUT_MS = 30_000
/** The runner settings a Scope 1 or 2 engine gets when its batch entry point is pinned (see createScope1Engine). */
export function scope12BatchConfig(expectedBatchSha256: string) {
  return {
    entries: { calculate_many: { path: SCOPE12_BATCH_ENGINE, sha256: expectedBatchSha256, maxBytes: SCOPE12_BATCH_RESPONSE_MAX_BYTES } },
    timeouts: { calculate_many: SCOPE12_BATCH_TIMEOUT_MS },
    // Results calls wait their turn (bounded by the run's budget) instead of failing when two engines are busy; describe,
    // lookup_zip and single calculate keep the original no-wait rule (A18). Still at most two processes per engine.
    queue: { maxConcurrent: 2, maxQueued: 32 }, queuedActions: ['calculate_many', 'aggregate'],
  } satisfies Partial<EngineRunnerConfig>
}

/** One item of a batch, in request order: the result, the engine's refusal code, or unavailable (no figure). */
export type EngineBatchItem<R> = { status: 'ok'; result: R } | { status: 'refused'; code: string } | { status: 'unavailable'; code: null }
const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length
/**
 * Runs per-record payloads through the batch entry point in chunks, one after another. Each item gets what its own
 * per-record call would give: the result (`accept` checks it, as the per-record bridge does), the refusal code, or
 * unavailable. An item over the per-record 4 MiB request or response cap is unavailable, as a per-record call would be.
 * A chunk the engine could not run (crash, timeout, abort, refused envelope) makes only its own items unavailable.
 */
export async function runEngineBatch<R>(run: (payload: unknown, call?: EngineCallOptions) => Promise<Record<string, unknown>>, engine: 'scope1' | 'scope2',
  payloads: unknown[], accept: (result: R, index: number) => boolean, options: EngineCallOptions = {}): Promise<Array<EngineBatchItem<R>>> {
  if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1)) throw new Error('Invalid engine call timeout.')
  const deadline = options.timeoutMs === undefined ? null : Date.now() + options.timeoutMs
  const unavailable = { status: 'unavailable', code: null } as const
  const out: Array<EngineBatchItem<R>> = payloads.map(() => unavailable)
  // Per-record request cap: such an item never reaches an engine, exactly as before.
  const runnable = payloads.map((payload, index) => ({ payload, index })).filter(({ payload }) => byteLength(payload) <= MAX_BYTES)
  let start = 0
  while (start < runnable.length) {
    let end = start, size = 0
    while (end < runnable.length && end - start < SCOPE12_BATCH_MAX_ITEMS) {
      const next = byteLength(runnable[end]!.payload) + 1
      if (end > start && size + next > SCOPE12_BATCH_MAX_BYTES) break
      size += next; end++
    }
    const chunk = runnable.slice(start, end)
    start = end
    const left = deadline === null ? null : deadline - Date.now()
    if ((left !== null && left < 1) || options.signal?.aborted) continue  // no time left or nobody waiting: unavailable, not run
    let items: unknown = null
    try { items = (await run({ action: 'calculate_many', engine, items: chunk.map(item => item.payload) }, { ...(left === null ? {} : { timeoutMs: left }), ...(options.signal ? { signal: options.signal } : {}) })).results } catch { items = null }
    if (!Array.isArray(items) || items.length !== chunk.length) continue
    chunk.forEach(({ index }, i) => {
      const item = items[i] as { status?: unknown; result?: R; code?: unknown } | null
      // Per-record response cap: the engine's own output line for this item.
      if (!item || typeof item !== 'object' || byteLength(item) + 1 > MAX_BYTES) return
      if (item.status === 'ok' && item.result && accept(item.result, index)) out[index] = { status: 'ok', result: item.result }
      else if (item.status === 'refused' && typeof item.code === 'string') out[index] = { status: 'refused', code: item.code }
    })
  }
  return out
}
