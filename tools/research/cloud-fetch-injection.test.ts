import { test, expect } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { startComposedPreview } from '../../apps/site-api/src/research-composed-server'
import { PROJECT_HOST, PINECONE_HOST, PROFILE_SHA256, RESEARCH_SCOPE } from '../../apps/site-api/src/research-cloud/repository'
import { SESSION_RUN_MARKER } from '../../apps/site-api/src/research-cloud/session'

test('private factory forwards cloud transport to both session and repository and fails before listening/model', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'neuvetra-cloud-injection-'))
  const user = '90000000-0000-4000-8000-000000000001', build = '90000000-0000-4000-8000-000000000002'
  const metadata = { scope_id: RESEARCH_SCOPE, run_marker: SESSION_RUN_MARKER, kind: 'private_research_reader' }
  const token = `header.${Buffer.from(JSON.stringify({ sub: user, role: 'authenticated', aud: 'authenticated', iss: `https://${PROJECT_HOST}/auth/v1`, exp: Math.floor(Date.now()/1000)+3600, app_metadata: metadata })).toString('base64url')}.synthetic`
  const calls: string[] = []; let persisted = 0, models = 0
  try {
    await expect(startComposedPreview({ target: { supabaseHost: PROJECT_HOST, pineconeHost: PINECONE_HOST, pineconeIndex: 'neuvetra-ghg-dev', schema: 'neuvetra_research_dev', bucket: 'neuvetra-research-dev', scopeId: RESEARCH_SCOPE, buildId: build, namespace: `nv-${build.replaceAll('-', '')}`, releaseSha256: 'a'.repeat(64), profileSha256: PROFILE_SHA256, expectedReaderUserId: user, reviewExpiresAt: new Date(Date.now()+3600000).toISOString() },
      supabasePublishableKey: 'sb_publishable_synthetic_0123456789', pineconeApiKey: 'synthetic', anthropicApiKey: 'synthetic', readerEmail: 'synthetic@neuvetra.invalid', readerPassword: 'synthetic', budgetDirectory: directory, runId: 'cloud-injection-offline', maxCalls: 5,
      persistSession() { persisted++ }, providerFetch: async () => { models++; throw new Error('model forbidden') },
      cloudFetch: async (url, init) => {
        calls.push(new URL(url).pathname)
        expect(init.redirect).toBe('error'); expect(init.signal).toBeInstanceOf(AbortSignal)
        if (calls.length === 1) return Response.json({ access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', user: { id: user, role: 'authenticated', app_metadata: metadata } })
        return new Response(null, { status: 503 })
      } })).rejects.toThrow('cloud_provider_unavailable')
    expect(calls).toEqual(['/auth/v1/token', '/auth/v1/user'])
    expect(persisted).toBe(1); expect(models).toBe(0)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
