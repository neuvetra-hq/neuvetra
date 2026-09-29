import { readFile } from 'node:fs/promises'
const text = await readFile('.superpowers/m80-backup-v2-rehearsal.ts', 'utf8')
const start = text.indexOf('async function verifyRuntimeBoundary(')
const end = text.indexOf('\nasync function createOutputs(', start)
if (start < 0 || end < 0) throw Error('exact function boundary unavailable')
const source = new Bun.Transpiler({loader: 'ts'}).transformSync(text.slice(start, end))
const results: Record<string, unknown>[] = []
for (const code of ['42501', '23503', 'ECONNRESET', null]) {
  let closed = false
  const runtime = {
    transaction: async (fn: any) => fn({query: async (sql: string) => ({rows: sql.includes('select status') ? Array.from({length: 4}, () => ({status: 'held_candidate'})) : []}), exec: async () => {}}),
    exec: async () => { if (code) throw Object.assign(Error('synthetic failure'), {code}) },
    close: async () => { closed = true },
  }
  const verify = new Function('createPostgresConnection', 'check', source + '\nreturn verifyRuntimeBoundary;')(() => runtime, (value: unknown, message: string) => { if (!value) throw Error(message) })
  let accepted = false
  try { await verify('m80_backup_foundation_1234567890123', '00000000-0000-4000-8000-000000000001'); accepted = true } catch {}
  results.push({injectedErrorCode: code, claimedBoundaryAccepted: accepted, closed})
}
console.log(JSON.stringify({method: 'Exact frozen function extracted unchanged; injected runtime only; no DB or archive access', results}))
