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
 */
export class EngineRefusal extends Error { constructor(readonly code: string) { super(`Input refused: ${code}`) } }

const MAX_BYTES = 4 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 5000
const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
export const sortedKeys = (v: unknown): unknown => Array.isArray(v) ? v.map(sortedKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1).map(([k, x]) => [k, sortedKeys(x)])) : v

export interface EngineOptions { python?: string; expectedEngineSha256: string; timeoutMs?: number }
/** FIFO queue: up to `maxConcurrent` engine processes; up to `maxQueued` further calls wait their turn; beyond that a call is unavailable. */
export interface EngineQueue { maxConcurrent: number; maxQueued: number }
/** One call's own limit (I-03): `timeoutMs`, a positive whole number of milliseconds for the whole call. */
export interface EngineCallOptions { timeoutMs?: number }
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
}

export function createEngineRunner(config: EngineRunnerConfig, options: EngineOptions) {
  if (!/^[0-9a-f]{64}$/.test(options?.expectedEngineSha256 ?? '')) throw new Error('An expected engine SHA-256 is required.')
  const maxBytes = config.maxBytes ?? MAX_BYTES
  // No queue: two at a time and nobody waits, which is exactly the original "active >= 2 is unavailable" rule.
  const queue = config.queue ?? { maxConcurrent: 2, maxQueued: 0 }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(queue.maxConcurrent) || queue.maxConcurrent < 1 || !Number.isSafeInteger(queue.maxQueued) || queue.maxQueued < 0)
    throw new Error('Invalid engine runner configuration.')
  let active = 0
  const waiting: Array<() => void> = []
  const acquire = async (deadline: number | null) => {
    if (active < queue.maxConcurrent) { active++; return }
    if (waiting.length >= queue.maxQueued) throw new Error(config.unavailable)
    // The slot is handed over by release(), so `active` already counts this call when it resumes.
    if (deadline === null) { await new Promise<void>(resolve => waiting.push(resolve)); return }
    // I-03: a call whose deadline passes while it waits leaves the queue (it never held a slot, so nothing is released).
    await new Promise<void>((resolve, reject) => {
      let expiry: ReturnType<typeof setTimeout> | undefined
      const resume = () => { clearTimeout(expiry); resolve() }
      waiting.push(resume)
      expiry = setTimeout(() => { const at = waiting.indexOf(resume); if (at >= 0) { waiting.splice(at, 1); reject(new Error(config.unavailable)) } }, Math.max(0, deadline - Date.now()))
    })
  }
  const release = () => { const next = waiting.shift(); if (next) next(); else active-- }
  return async (payload: unknown, call: EngineCallOptions = {}): Promise<Record<string, unknown>> => {
    if (call.timeoutMs !== undefined && (!Number.isSafeInteger(call.timeoutMs) || call.timeoutMs < 1)) throw new Error('Invalid engine call timeout.')
    const deadline = call.timeoutMs === undefined ? null : Date.now() + call.timeoutMs
    const encoded = JSON.stringify(payload)
    if (new TextEncoder().encode(encoded).length > maxBytes) throw new Error(config.unavailable)
    await acquire(deadline)
    const action = payload && typeof payload === 'object' && typeof (payload as { action?: unknown }).action === 'string' ? (payload as { action: string }).action : ''
    let child: ReturnType<typeof Bun.spawn> | undefined, timer: ReturnType<typeof setTimeout> | undefined
    try {
      if (sha256(await Bun.file(config.engine).bytes()) !== options.expectedEngineSha256) throw new Error('engine')
      for (const d of config.data) if (sha256(await Bun.file(d.url).bytes()) !== d.sha256) throw new Error('data')
      child = Bun.spawn([options.python ?? process.env.NEUVETRA_PYTHON ?? 'python', config.engine], {
        stdin: new Blob([encoded]), stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', PYTHONIOENCODING: 'utf-8' },
      })
      const actionMs = (config.timeouts && Object.prototype.hasOwnProperty.call(config.timeouts, action) ? config.timeouts[action] : undefined) ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS
      timer = setTimeout(() => child?.kill(), deadline === null ? actionMs : Math.max(0, Math.min(actionMs, deadline - Date.now())))
      const read = async (stream: ReadableStream<Uint8Array>) => {
        const reader = stream.getReader(); const chunks: Uint8Array[] = []; let size = 0
        for (;;) { const r = await reader.read(); if (r.done) break; size += r.value.length; if (size > maxBytes) { child?.kill(); throw new Error('output') } chunks.push(r.value) }
        return Buffer.concat(chunks).toString('utf8')
      }
      const [stdout, , code] = await Promise.all([read(child.stdout as ReadableStream<Uint8Array>), read(child.stderr as ReadableStream<Uint8Array>), child.exited])
      const value = JSON.parse(stdout) as Record<string, unknown>
      if (code === 1 && value.status === 'refused' && typeof value.code === 'string') throw new EngineRefusal(value.code)
      if (code !== 0 || value.status !== 'ok') throw new Error('status')
      return value
    } catch (error) {
      if (error instanceof EngineRefusal) throw error
      throw new Error(config.unavailable)
    } finally { if (timer) clearTimeout(timer); release() }
  }
}
