/**
 * Runs a pinned Python method engine: re-hashes the engine and its data files before every call.
 * expectedEngineSha256 is required (re-review P3-4): pass the engine_sha256 of the current release.
 */
export class EngineRefusal extends Error { constructor(readonly code: string) { super(`Input refused: ${code}`) } }

const MAX_BYTES = 4 * 1024 * 1024
const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
export const sortedKeys = (v: unknown): unknown => Array.isArray(v) ? v.map(sortedKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1).map(([k, x]) => [k, sortedKeys(x)])) : v

export interface EngineOptions { python?: string; expectedEngineSha256: string; timeoutMs?: number }

export function createEngineRunner(config: { engine: string; data: Array<{ url: URL; sha256: string }>; unavailable: string }, options: EngineOptions) {
  if (!/^[0-9a-f]{64}$/.test(options?.expectedEngineSha256 ?? '')) throw new Error('An expected engine SHA-256 is required.')
  let active = 0
  return async (payload: unknown): Promise<Record<string, unknown>> => {
    const encoded = JSON.stringify(payload)
    if (new TextEncoder().encode(encoded).length > MAX_BYTES || active >= 2) throw new Error(config.unavailable)
    active++
    let child: ReturnType<typeof Bun.spawn> | undefined, timer: ReturnType<typeof setTimeout> | undefined
    try {
      if (sha256(await Bun.file(config.engine).bytes()) !== options.expectedEngineSha256) throw new Error('engine')
      for (const d of config.data) if (sha256(await Bun.file(d.url).bytes()) !== d.sha256) throw new Error('data')
      child = Bun.spawn([options.python ?? process.env.NEUVETRA_PYTHON ?? 'python', config.engine], {
        stdin: new Blob([encoded]), stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env.PATH ?? '', SYSTEMROOT: process.env.SYSTEMROOT ?? '', PYTHONIOENCODING: 'utf-8' },
      })
      timer = setTimeout(() => child?.kill(), options.timeoutMs ?? 5000)
      const read = async (stream: ReadableStream<Uint8Array>) => {
        const reader = stream.getReader(); const chunks: Uint8Array[] = []; let size = 0
        for (;;) { const r = await reader.read(); if (r.done) break; size += r.value.length; if (size > MAX_BYTES) { child?.kill(); throw new Error('output') } chunks.push(r.value) }
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
    } finally { if (timer) clearTimeout(timer); active-- }
  }
}
