import { hash, PassageError, record } from '../research-passages/release';

export type OpenRouterStage = 'analyze' | 'plan' | 'verify';
export interface OpenRouterSpending {
    check(stage: OpenRouterStage, body: string): void;
    reserve(attempt: number, stage: OpenRouterStage, body: string): void;
    settle(attempt: number, costNanoUsd: number, source: 'response' | 'generation'): void;
    uncertain(attempt: number): void;
}
const models = { analyze: 'anthropic/claude-opus-5', plan: 'anthropic/claude-sonnet-5', verify: 'anthropic/claude-opus-5' } as const;
function deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object') { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); }
    return value;
}
export const openrouterPolicy = deepFreeze({
    version: 'openrouter-native-messages.v1',
    endpoint: 'https://openrouter.ai/api/v1/messages',
    models,
    canonical_models: { 'anthropic/claude-opus-5': 'anthropic/claude-opus-5-20260723', 'anthropic/claude-sonnet-5': 'anthropic/claude-sonnet-5-20260630' },
    endpoint_pins: { opus: 'b7ba606eb15a3f5a495a7ac48955cb9c07013d40390107691999ace82c83bcf7', sonnet: 'e578d4d898b4a839872044d1e35418773248df29144c76ca578545014e54456d' },
    headers: { 'content-type': 'application/json', 'X-OpenRouter-Metadata': 'enabled', 'X-OpenRouter-Cache': 'false' },
    routing: { only: ['anthropic'], order: ['anthropic'], ignore: ['anthropic/fast'], allow_fallbacks: false, require_parameters: true },
    max_price: { analyze: { prompt: '5', completion: '25' }, plan: { prompt: '2', completion: '10' }, verify: { prompt: '5', completion: '25' } },
    speed: 'standard', stream: false,
    plugins: [
        { id: 'auto-router', enabled: false }, { id: 'auto-beta-router', enabled: false },
        { id: 'web', enabled: false }, { id: 'file-parser', enabled: false },
        { id: 'response-healing', enabled: false }, { id: 'context-compression', enabled: false },
        { id: 'pareto-router', enabled: false }, { id: 'fusion', enabled: false },
    ],
    expected_provider: 'Anthropic', expected_strategy: 'direct', expected_attempt: 1, expected_byok: false,
    monetary_target_nano_usd: 10000000000,
    estimated_framing_tokens: 4096, estimated_margin_numerator: 125, estimated_margin_denominator: 100,
    input_reservation_nano_usd_per_token: { analyze: 10000, plan: 4000, verify: 10000 },
    output_reservation_nano_usd_per_token: { analyze: 25000, plan: 10000, verify: 25000 },
    output_token_limits: { analyze: 8192, plan: 3000, verify: 16384 },
    generation_lookup: { endpoint: 'https://openrouter.ai/api/v1/generation', maximum_bytes: 16384, timeout_ms: 5000, maximum_lookups: 1 },
    success_identity: 'Exact requested/response/selected model; no generic prefix normalization; conflicts in attempts/provider fail.',
    cost_policy: 'Serial conservative estimates, not hard billing guarantees; uncertain charges retained; unknown/unexpected cost stops later admission.',
} as const);

export interface SafeOpenRouterMetadata {
    requested_model: string;
    response_model: string;
    selected_provider: 'Anthropic';
    reported_attempt: 1;
    is_byok: false;
    generation_id_sha256?: string;
    cost_nano_usd?: number;
    cost_source?: 'response' | 'generation';
}
const fail = (): never => { throw new PassageError('provider_failure'); };
function expectedModel(stage: OpenRouterStage, value: unknown): value is string {
    return value === models[stage] || value === openrouterPolicy.canonical_models[models[stage]];
}

export function openrouterRequestBody(stage: OpenRouterStage, original: string): string {
    const base: unknown = JSON.parse(original);
    if (!record(base) || base.model !== models[stage].slice('anthropic/'.length)) return fail();
    const body = JSON.stringify({ ...base, model: models[stage], provider: { ...openrouterPolicy.routing, max_price: openrouterPolicy.max_price[stage] }, speed: openrouterPolicy.speed, stream: false, plugins: openrouterPolicy.plugins });
    if (new TextEncoder().encode(body).length > 64000) throw new PassageError('context_limit');
    return body;
}

/** Upward-rounded estimate includes the most expensive published input-cache rate.
 * It is a monitored admission estimate, not a claim about actual tokenization. */
export function estimateOpenRouterNanoUsd(stage: OpenRouterStage, body: string): number {
    const bytes = new TextEncoder().encode(body).length;
    if (bytes > 64000) throw new PassageError('context_limit');
    const input = BigInt(bytes + openrouterPolicy.estimated_framing_tokens) * BigInt(openrouterPolicy.input_reservation_nano_usd_per_token[stage]);
    const output = BigInt(openrouterPolicy.output_token_limits[stage]) * BigInt(openrouterPolicy.output_reservation_nano_usd_per_token[stage]);
    return Number(((input + output) * 125n + 99n) / 100n);
}

export function usdToNanoUsd(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000) return fail();
    const rounded = Math.ceil(value * 1e9);
    if (!Number.isSafeInteger(rounded)) return fail();
    return rounded;
}

export function validateOpenRouterResponse(stage: OpenRouterStage, raw: unknown, response?: Response): SafeOpenRouterMetadata {
    if (!record(raw) || raw.error !== undefined || !expectedModel(stage, raw.model) || !record(raw.openrouter_metadata)) return fail();
    const cache = response?.headers.get('X-OpenRouter-Cache-Status');
    if (cache != null && cache !== 'MISS') return fail();
    const m = raw.openrouter_metadata;
    if (m.requested !== models[stage] || m.strategy !== 'direct' || m.attempt !== 1 || m.is_byok !== false || !record(m.endpoints) || !Array.isArray(m.endpoints.available) || !Number.isSafeInteger(m.endpoints.total) || Number(m.endpoints.total) < m.endpoints.available.length) return fail();
    if (raw.provider !== undefined && raw.provider !== 'Anthropic') return fail();
    if (record(raw.usage) && raw.usage.is_byok !== undefined && raw.usage.is_byok !== false) return fail();
    if (record(raw.usage) && raw.usage.speed !== undefined && raw.usage.speed !== null && raw.usage.speed !== 'standard') return fail();
    if (m.pipeline !== undefined && (!Array.isArray(m.pipeline) || m.pipeline.length !== 0)) return fail();
    if (raw.input_transformations !== undefined && raw.input_transformations !== null && (!Array.isArray(raw.input_transformations) || raw.input_transformations.length !== 0)) return fail();
    if (raw.context_management !== undefined && raw.context_management !== null) return fail();
    const endpoints = m.endpoints.available;
    if (!endpoints.length || endpoints.length > 100 || !endpoints.every(e => record(e) && typeof e.selected === 'boolean')) return fail();
    const selected = endpoints.filter(e => e.selected);
    if (selected.length !== 1 || selected[0].provider !== 'Anthropic' || !expectedModel(stage, selected[0].model)) return fail();
    if (m.attempts !== undefined) {
        if (!Array.isArray(m.attempts) || m.attempts.length > 1) return fail();
        for (const a of m.attempts) if (!record(a) || a.provider !== 'Anthropic' || !expectedModel(stage, a.model) || a.status !== 200) return fail();
    }
    return { requested_model: models[stage], response_model: raw.model, selected_provider: 'Anthropic', reported_attempt: 1, is_byok: false };
}

function generationId(value: string | null): string | undefined {
    return value !== null && /^gen-[A-Za-z0-9_-]{1,196}$/.test(value) ? value : undefined;
}

function abortable<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const stop = () => { signal.removeEventListener('abort', stop); reject(new PassageError('provider_failure')); };
        task.then(value => { signal.removeEventListener('abort', stop); resolve(value); }, error => { signal.removeEventListener('abort', stop); reject(error); });
        if (signal.aborted) stop();
        else signal.addEventListener('abort', stop, { once: true });
    });
}

export function nativeOpenRouterCost(raw: unknown, response: Response): { cost_nano_usd: number; cost_source: 'response'; generation_id_sha256?: string } | undefined {
    if (!record(raw) || !record(raw.usage) || raw.usage.cost === undefined || raw.usage.cost === null) return undefined;
    const id = generationId(response.headers.get('X-Generation-Id'));
    return { cost_nano_usd: usdToNanoUsd(raw.usage.cost), cost_source: 'response', ...(id ? { generation_id_sha256: hash(id) } : {}) };
}

async function metadataBody(response: Response, signal: AbortSignal): Promise<unknown> {
    if (!response.ok || !response.body) {
        try { void response.body?.cancel().catch(() => {}); } catch { /* Cleanup cannot replace the metadata failure. */ }
        return fail();
    }
    const reader = response.body.getReader();
    let count = 0;
    const chunks: Uint8Array[] = [];
    try {
        while (true) {
            signal.throwIfAborted();
            const result = await abortable(reader.read(), signal);
            signal.throwIfAborted();
            if (result.done) break;
            count += result.value.length;
            if (count > 16384) return fail();
            chunks.push(result.value);
        }
        const bytes = new Uint8Array(count);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } finally {
        void reader.cancel().catch(() => {});
        try { reader.releaseLock(); } catch { /* Pending hostile reader stays detached after cancellation. */ }
    }
}

/** One associated metadata GET, only if the successful native response omits cost.
 * No stored-content endpoint, retries, prompts or unbounded metadata retention. */
export async function reconcileOpenRouterCost(options: {
    stage: OpenRouterStage; raw: unknown; response: Response; apiKey: string;
    fetch: (url: string, init: RequestInit) => Promise<Response>; signal: AbortSignal;
}): Promise<{ cost_nano_usd: number; cost_source: 'response' | 'generation'; generation_id_sha256?: string }> {
    if (!record(options.raw)) return fail();
    const id = generationId(options.response.headers.get('X-Generation-Id'));
    const identity = id ? { generation_id_sha256: hash(id) } : {};
    const nativeCost = nativeOpenRouterCost(options.raw, options.response);
    if (nativeCost) return nativeCost;
    if (!id) return fail();
    const signal = AbortSignal.any([options.signal, AbortSignal.timeout(5000)]);
    signal.throwIfAborted();
    const pending = options.fetch(`${openrouterPolicy.generation_lookup.endpoint}?id=${encodeURIComponent(id)}`, { method: 'GET', redirect: 'error', headers: { authorization: `Bearer ${options.apiKey}` }, signal });
    void pending.then(response => { if (signal.aborted) { try { void response.body?.cancel().catch(() => {}); } catch {} } }, () => {});
    const response = await abortable(pending, signal);
    const raw = await metadataBody(response, signal);
    if (!record(raw) || !record(raw.data) || raw.data.id !== id || !expectedModel(options.stage, raw.data.model) || raw.data.provider_name !== 'Anthropic' || raw.data.is_byok !== false) return fail();
    return { cost_nano_usd: usdToNanoUsd(raw.data.total_cost), cost_source: 'generation', ...identity };
}

/** Profile identity includes the finite helpers used by the public validators. */
export const openrouterImplementationContract = Object.freeze({
    request: openrouterRequestBody.toString(), response: validateOpenRouterResponse.toString(),
    expected_model: expectedModel.toString(), generation_id: generationId.toString(),
    metadata_body: metadataBody.toString(), bounded_abort: abortable.toString(),
    native_cost: nativeOpenRouterCost.toString(), reconcile: reconcileOpenRouterCost.toString(),
    estimate: estimateOpenRouterNanoUsd.toString(), decimal_ceiling: usdToNanoUsd.toString(),
});
