import { createPassageProvider, disabledPassageProvider } from './provider'
import { createPassageLoader } from './release'

export function readPassageConfig(env: Record<string, string | undefined>) {
  const port = Number(env.RESEARCH_PORT ?? 3012)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid RESEARCH_PORT.')
  const allowedOrigins = (env.RESEARCH_ALLOWED_ORIGINS ?? 'http://localhost:5174,http://127.0.0.1:5174').split(',').map(v => v.trim())
  if (!allowedOrigins.length || allowedOrigins.some(value => { try { const u = new URL(value); return u.origin !== value || !['http:', 'https:'].includes(u.protocol) || !['localhost', '127.0.0.1'].includes(u.hostname) } catch { return true } })) throw new Error('Research origins must be loopback origins.')
  let provider = disabledPassageProvider()
  if (env.RESEARCH_PROVIDER === 'anthropic') {
    // Legacy model/output controls configure the planner; draft/review profiles are fixed.
    try { provider = createPassageProvider({ apiKey: env.RESEARCH_ANTHROPIC_API_KEY ?? '', model: env.RESEARCH_MODEL ?? 'claude-sonnet-5', maxCalls: Number(env.RESEARCH_MAX_CALLS ?? 30), maxOutputTokens: Number(env.RESEARCH_MAX_OUTPUT_TOKENS ?? 1200), maxSpendUsd: Number(env.RESEARCH_MAX_SPEND_USD ?? 15), callReservationUsd: Number(env.RESEARCH_CALL_RESERVATION_USD ?? 0.50) }) } catch { /* Disabled unless all provider configuration is valid. */ }
  }
  let sourceRoots: string[] = []
  try { const raw: unknown = JSON.parse(env.RESEARCH_SOURCE_ROOTS ?? '[]'); if (Array.isArray(raw) && raw.every(v => typeof v === 'string')) sourceRoots = raw } catch { /* Evidence remains unavailable. */ }
  return { port, allowedOrigins, provider, loadRelease: createPassageLoader({ releasePath: env.RESEARCH_PASSAGES_RELEASE_PATH ?? '', expectedSha256: env.RESEARCH_PASSAGES_RELEASE_SHA256 ?? '', sourceRoots }) }
}
