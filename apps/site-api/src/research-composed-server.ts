import { readFileSync } from 'node:fs';
import { hash } from './research-passages/release';
import { Elysia } from 'elysia';
import { createCloudRepository } from './research-cloud/repository';
import { createReaderSession, SESSION_RUN_MARKER, type ReaderSessionSnapshot } from './research-cloud/session';
import { createAttemptBudget } from './research-cloud/budget';
import { createComposedProvider, profileSha256, openrouterProfileSha256 } from './research-composed/provider';
import type { OpenRouterSpending } from './research-composed/openrouter';
import { createComposedAnswerService } from './research-composed/answer';
import { CAPABILITY_SHA } from './research-composed/capabilities';
import type { ComposedStageEvent } from './research-composed/provider';
import { createCloudRoutes } from './research-cloud/routes';
import type { CloudTarget } from './research-cloud/types';
export interface PrivateComposedPreviewConfig {
    /** Candidate QA and reviewed local website have separate fixed listeners. */
    port?: 3016 | 3012;
    target: CloudTarget;
    supabasePublishableKey: string;
    pineconeApiKey: string;
    anthropicApiKey?: string;
    providerTransport?: 'anthropic' | 'openrouter';
    openrouterApiKey?: string;
    openrouterSpending?: OpenRouterSpending;
    readerEmail: string;
    readerPassword: string;
    budgetDirectory: string;
    runId: string;
    maxCalls: number;
    /** Coordinator's frozen local launch manifest; public identity contains no keys. */
    launchManifestSha256?: string;
    /** The private launcher owns encrypted persistence, outside Git and the browser. */
    persistSession: (snapshot: Readonly<ReaderSessionSnapshot>) => void | Promise<void>;
    /** Optional private evaluation trace; do not enable for customer data. */
    onStage?: (event: ComposedStageEvent) => void;
    /** Optional private transport observer; the ordinary provider default is unchanged. */
    providerFetch?: (url: string, init: RequestInit) => Promise<Response>;
    /** Optional private evidence transport observer; default transport and evidence checks are unchanged. */
    cloudFetch?: (url: string, init: RequestInit) => Promise<Response>;
    /** Optional private ingress isolation; never passed to the answering provider. */
    requestGate?: (request: Request) => Promise<Response | undefined>;
    /** Explicit private browser origins; the ordinary local preview default is unchanged. */
    allowedOrigins?: readonly string[];
}
/** A rejected or failed gate ends the request before the existing answer route. */
export function createPrivatePreviewRoutes(service: { status(): Promise<unknown>; answer(question: string, signal?: AbortSignal): Promise<unknown> },
    allowedOrigins: readonly string[], requestGate?: PrivateComposedPreviewConfig['requestGate']) {
    const app = new Elysia();
    if (requestGate !== undefined) {
        if (typeof requestGate !== 'function') throw new Error('Private request gate is invalid.');
        app.onRequest(async ({ request }) => {
            try {
                const response = await requestGate(request);
                if (response === undefined || response instanceof Response) return response;
            } catch { /* An unavailable isolation controller cannot open the answering route. */ }
            return new Response(JSON.stringify({ error: 'Private preview admission refused.' }), { status: 403, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
        });
    }
    return app.use(createCloudRoutes(service, allowedOrigins));
}
/** Explicit private startup, with no environment-export or inherited API imports. */
export async function startComposedPreview(config: PrivateComposedPreviewConfig) {
    const transport = config.providerTransport ?? 'anthropic';
    const providerKey = transport === 'openrouter' ? config.openrouterApiKey : config.anthropicApiKey;
    if (!['anthropic', 'openrouter'].includes(transport) || !providerKey || (transport === 'openrouter' && !config.openrouterSpending))
        throw new Error('Explicit private provider configuration is required.');
    const selectedProfileSha256 = transport === 'openrouter' ? openrouterProfileSha256 : profileSha256;
    const port = config.port ?? 3016;
    if (port !== 3016 && port !== 3012)
        throw new Error('Private preview port refused.');
    if (typeof config.persistSession !== 'function')
        throw new Error('Private session persistence is required.');
    if (config.launchManifestSha256 !== undefined && !/^[a-f0-9]{64}$/.test(config.launchManifestSha256))
        throw new Error('Private launch manifest pin is invalid.');
    const session = createReaderSession({ supabaseHost: config.target.supabaseHost, publishableKey: config.supabasePublishableKey,
        email: config.readerEmail, password: config.readerPassword, expectedUserId: config.target.expectedReaderUserId,
        expectedAppMetadata: { scope_id: config.target.scopeId, run_marker: SESSION_RUN_MARKER, kind: 'private_research_reader' }, onSession: config.persistSession, fetch: config.cloudFetch });
    const repository = createCloudRepository({ target: config.target, supabasePublishableKey: config.supabasePublishableKey,
        pineconeApiKey: config.pineconeApiKey, readerJwt: session.getJwt, fetch: config.cloudFetch });
    const budget = createAttemptBudget(config.budgetDirectory, { runId: config.runId, maxCalls: config.maxCalls, reservationUsd: 1, profileSha256: selectedProfileSha256 });
    const provider = createComposedProvider({ apiKey: providerKey, budget, onStage: config.onStage, fetch: config.providerFetch, transport, spending: config.openrouterSpending });
    const catalogBytes = readFileSync(new URL('../../../data/research/answer-units/scope2-website.epa-acquisition.v1.json', import.meta.url));
    const catalogSha256 = '97b2c4e0f4121c1d2ea7fa33d569f53344193f12a80e9d1349577c3a86e17e50';
    if (hash(catalogBytes) !== catalogSha256)
        throw new Error('Reviewed explanation catalog pin mismatch.');
    const capabilityBytes = readFileSync(new URL('../../../data/research/capabilities/scope2-website.epa-limitations.v1.json', import.meta.url));
    if (hash(capabilityBytes) !== CAPABILITY_SHA)
        throw new Error('Reviewed capability catalog pin mismatch.');
    const service = createComposedAnswerService({ repository, provider, catalogBytes, catalogSha256, capabilityBytes, capabilitySha256: CAPABILITY_SHA });
    // Auth/cloud integrity must succeed before opening the answering endpoint.
    await service.initialize();
    const runtimeBinding = config.launchManifestSha256 === undefined ? undefined : {
        run_id: config.runId, manifest_sha256: config.launchManifestSha256,
        profile_sha256: selectedProfileSha256, process_id: process.pid, port,
    };
    const boundService = { answer: service.answer.bind(service), status: async () => ({
        ...await service.status(), ...(runtimeBinding ? { runtime_binding: runtimeBinding } : {}),
    }) };
    const server = createPrivatePreviewRoutes(boundService, config.allowedOrigins ?? ['http://localhost:5174', 'http://127.0.0.1:5174'], config.requestGate)
        .listen({ hostname: '127.0.0.1', port, maxRequestBodySize: 16384, idleTimeout: 250 });
    console.info(`Neuvetra private reviewed-composition research preview is ready on loopback port ${port}.`);
    return { server, service: boundService, repository, provider, runtimeBinding };
}
if (import.meta.main) {
    console.error('Use the explicit private launcher described in the website cloud runbook. No credentials or source files were loaded.');
    process.exitCode = 1;
}
