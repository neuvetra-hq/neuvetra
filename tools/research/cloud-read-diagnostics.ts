/** Operator-only metadata observer. No I/O on import; no bodies, headers, URLs or error messages retained. */
import { PROJECT_HOST, PINECONE_HOST } from '../../apps/site-api/src/research-cloud/repository'

type Fetch = (url: string, init: RequestInit) => Promise<Response>
export interface CloudReadObservation {
  operation: string; outcome: 'headers' | 'transport_error'; http_status?: number;
  elapsed_ms: number; transport_code?: string
}
export function cloudReadOperation(raw: string, method = 'GET'): string {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return 'unrecognized'
    if (u.hostname === PROJECT_HOST) {
      if (u.pathname === '/auth/v1/token' && method === 'POST') return 'reader_session'
      if (u.pathname === '/auth/v1/user' && method === 'GET') return 'reader_identity'
      const tables = ['research_memberships', 'research_active_builds', 'research_releases', 'research_objects', 'research_sources', 'research_passages']
      for (const table of tables) if (u.pathname === `/rest/v1/${table}` && method === 'GET') return table
      if (u.pathname.startsWith('/storage/v1/object/authenticated/neuvetra-research-dev/') && method === 'GET') {
        for (const kind of ['release.json', 'source.pdf', 'extraction.json']) if (u.pathname.endsWith(`/${kind}`)) return `object_${kind.split('.')[0]}`
      }
    }
    if (u.hostname === 'api.pinecone.io' && u.pathname === '/indexes/neuvetra-ghg-dev' && method === 'GET') return 'pinecone_describe'
    if (u.hostname === PINECONE_HOST && /^\/records\/namespaces\/nv-[a-f0-9]{32}\/search$/.test(u.pathname) && method === 'POST') return 'pinecone_search'
  } catch { /* Only a fixed label leaves this function. */ }
  return 'unrecognized'
}
export function safeTransportCode(error: unknown): string {
  const allowed = new Set(['TimeoutError', 'AbortError', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ConnectionRefused', 'ConnectionClosed', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'])
  try {
    if (error && typeof error === 'object') {
      const e = error as { name?: unknown; code?: unknown; cause?: { code?: unknown } }
      for (const code of [e.code, e.cause?.code, e.name]) if (typeof code === 'string' && allowed.has(code)) return code
    }
  } catch { /* Do not trust error getters. */ }
  return 'unclassified_transport'
}
export function observeCloudReads(fetcher: Fetch, record: (row: CloudReadObservation) => void, now = Date.now): Fetch {
  const emit = (row: CloudReadObservation) => { try { record(row) } catch { /* Observation cannot change transport semantics. */ } }
  return async (url, init) => {
    const operation = cloudReadOperation(url, init.method), start = now()
    // Diagnostics cannot accidentally widen the existing cloud destination set.
    if (operation === 'unrecognized') throw new Error('diagnostic_destination_refused')
    const elapsed = () => Math.max(0, Math.min(600_000, Math.round(now() - start)))
    try {
      const response = await fetcher(url, init)
      emit({ operation, outcome: 'headers', http_status: response.status, elapsed_ms: elapsed() })
      return response
    } catch (error) {
      emit({ operation, outcome: 'transport_error', transport_code: safeTransportCode(error), elapsed_ms: elapsed() })
      throw error
    }
  }
}
