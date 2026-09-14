import { createAnthropicProvider, disabledProvider } from './provider'
import { createReleaseLoader } from './release'
import type { ResearchRoutesOptions } from './routes'

export function readResearchConfig(env: Record<string, string | undefined>): ResearchRoutesOptions & { port: number } {
  const port = Number(env.RESEARCH_PORT ?? 3012)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid RESEARCH_PORT.')
  const allowedOrigins = (env.RESEARCH_ALLOWED_ORIGINS ?? 'http://localhost:5174,http://127.0.0.1:5174').split(',').map(value => value.trim())
  if (!allowedOrigins.length || allowedOrigins.some(value => {
    try { const url = new URL(value); return url.origin !== value || !['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) } catch { return true }
  })) throw new Error('Research preview origins must be loopback origins.')
  let provider = disabledProvider()
  // No eager inherited env, telemetry, database or API startup imports. Merely
  // having a credential in the environment never enables paid calls.
  if (env.RESEARCH_PROVIDER === 'anthropic') {
    try {
      provider = createAnthropicProvider({
        apiKey: env.RESEARCH_ANTHROPIC_API_KEY ?? '', model: env.RESEARCH_MODEL ?? 'claude-sonnet-5',
        maxCalls: Number(env.RESEARCH_MAX_CALLS ?? 30), maxOutputTokens: Number(env.RESEARCH_MAX_OUTPUT_TOKENS ?? 1200),
        maxSpendUsd: Number(env.RESEARCH_MAX_SPEND_USD ?? 2), callReservationUsd: Number(env.RESEARCH_CALL_RESERVATION_USD ?? 0.06),
      })
    } catch { /* Missing/invalid provider configuration stays explicitly disabled. */ }
  }
  let sourceRoots: string[] = []
  try { const parsed: unknown = JSON.parse(env.RESEARCH_SOURCE_ROOTS ?? '[]'); if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) sourceRoots = parsed } catch { /* Invalid paths leave evidence unavailable. */ }
  return { port, allowedOrigins, provider, loadRelease: createReleaseLoader({
    releasePath: env.RESEARCH_RELEASE_PATH ?? '', expectedSha256: env.RESEARCH_RELEASE_SHA256 ?? '', sourceRoots,
  }) }
}
