import { readFileSync } from 'node:fs'
import { hash } from './research-passages/release'
import { Elysia } from 'elysia'
import { createCloudRepository } from './research-cloud/repository'
import { createReaderSession, SESSION_RUN_MARKER, type ReaderSessionSnapshot } from './research-cloud/session'
import { createAttemptBudget } from './research-cloud/budget'
import { createCloudProvider, profileSha256, type StageEvent } from './research-cloud/provider'
import { createCloudAnswerService } from './research-cloud/answer'
import { createCloudRoutes } from './research-cloud/routes'
import type { CloudTarget } from './research-cloud/types'

export interface PrivateCloudPreviewConfig {
  /** Candidate QA and reviewed local website have separate fixed listeners. */
  port?: 3016 | 3012
  target: CloudTarget
  supabasePublishableKey: string; pineconeApiKey: string; anthropicApiKey: string
  readerEmail: string; readerPassword: string
  budgetDirectory: string; runId: string; maxCalls: number
  /** The private launcher owns encrypted persistence, outside Git and the browser. */
  persistSession: (snapshot: Readonly<ReaderSessionSnapshot>) => void | Promise<void>
  /** Optional private evaluation trace; do not enable for customer data. */
  onStage?: (event: StageEvent) => void
}

/** Explicit private startup, with no environment-export or inherited API imports. */
export async function startCloudPreview(config: PrivateCloudPreviewConfig) {
  const port = config.port ?? 3016
  if (port !== 3016 && port !== 3012) throw new Error('Private preview port refused.')
  if (typeof config.persistSession !== 'function') throw new Error('Private session persistence is required.')
  const session = createReaderSession({ supabaseHost: config.target.supabaseHost, publishableKey: config.supabasePublishableKey,
    email: config.readerEmail, password: config.readerPassword, expectedUserId: config.target.expectedReaderUserId,
    expectedAppMetadata: { scope_id: config.target.scopeId, run_marker: SESSION_RUN_MARKER, kind: 'private_research_reader' }, onSession: config.persistSession })
  const repository = createCloudRepository({ target: config.target, supabasePublishableKey: config.supabasePublishableKey,
    pineconeApiKey: config.pineconeApiKey, readerJwt: session.getJwt })
  const budget = createAttemptBudget(config.budgetDirectory, { runId: config.runId, maxCalls: config.maxCalls, reservationUsd: 1, profileSha256 })
  const provider = createCloudProvider({ apiKey: config.anthropicApiKey, budget, onStage: config.onStage })
  const conditionBytes = readFileSync(new URL('../../../data/research/conditions/scope2-website.v1.json', import.meta.url))
  if (hash(conditionBytes) !== '063adbadbe9c70493a81228931c4e4ec4a833633d12c83e2ab48616bd876d2c6') throw new Error('Condition review policy pin mismatch.')
  const service = createCloudAnswerService({ repository, provider, conditionCatalog: JSON.parse(conditionBytes.toString('utf8')) })
  // Auth/cloud integrity must succeed before opening the answering endpoint.
  await service.initialize()
  const server = new Elysia().use(createCloudRoutes(service, ['http://localhost:5174', 'http://127.0.0.1:5174']))
    .listen({ hostname: '127.0.0.1', port, maxRequestBodySize: 16384, idleTimeout: 250 })
  console.info(`Neuvetra private cloud research preview is ready on loopback port ${port}.`)
  return { server, service, repository, provider }
}

if (import.meta.main) {
  console.error('Use the explicit private launcher described in the website cloud runbook. No credentials or source files were loaded.')
  process.exitCode = 1
}
