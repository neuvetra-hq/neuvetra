import { test, expect } from 'bun:test'
import { cloudReadOperation, observeCloudReads, safeTransportCode } from './cloud-read-diagnostics'

test('fixed operation labels omit credentials, query and arbitrary paths', () => {
  expect(cloudReadOperation('https://icockcoguyadhryzydvl.supabase.co/rest/v1/research_memberships?secret=never')).toBe('research_memberships')
  for (const url of ['https://evil.test/rest/v1/research_memberships', 'https://secret@icockcoguyadhryzydvl.supabase.co/auth/v1/user', 'http://icockcoguyadhryzydvl.supabase.co/auth/v1/user', 'https://icockcoguyadhryzydvl.supabase.co/rest/v1/users']) expect(cloudReadOperation(url)).toBe('unrecognized')
  expect(safeTransportCode({ message: 'secret', code: 'secret', cause: { code: 'ENOTFOUND' } })).toBe('ENOTFOUND')
  expect(safeTransportCode({ name: 'secret', message: 'secret' })).toBe('unclassified_transport')
})
test('observer preserves response/error while recording only allowlisted metadata', async () => {
  const rows: unknown[] = [], url = 'https://api.pinecone.io/indexes/neuvetra-ghg-dev'
  const response = new Response('secret body', { status: 503, headers: { 'secret-header': 'secret' } })
  const observed = observeCloudReads(async () => response, row => rows.push(row), () => 5)
  expect(await observed(url, { method: 'GET', headers: { 'Api-Key': 'secret' } })).toBe(response)
  const error = Object.assign(new Error('secret url and body'), { code: 'ECONNRESET' })
  await expect(observeCloudReads(async () => { throw error }, row => rows.push(row), () => 5)(url, {})).rejects.toBe(error)
  expect(JSON.stringify(rows)).not.toContain('secret')
  expect(rows).toEqual([{ operation: 'pinecone_describe', outcome: 'headers', http_status: 503, elapsed_ms: 0 }, { operation: 'pinecone_describe', outcome: 'transport_error', transport_code: 'ECONNRESET', elapsed_ms: 0 }])
})
test('unknown destination is refused before transport', async () => {
  let calls = 0
  await expect(observeCloudReads(async () => { calls++; return new Response() }, () => {})('https://evil.test', {})).rejects.toThrow('diagnostic_destination_refused')
  expect(calls).toBe(0)
})
test('broken observation sink does not change response or original failure', async () => {
  const url = 'https://api.pinecone.io/indexes/neuvetra-ghg-dev', response = new Response('ok'), fail = new Error('original')
  const sink = () => { throw new Error('sink') }
  expect(await observeCloudReads(async () => response, sink)(url, {})).toBe(response)
  await expect(observeCloudReads(async () => { throw fail }, sink)(url, {})).rejects.toBe(fail)
})
