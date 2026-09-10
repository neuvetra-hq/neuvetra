import { afterEach, expect, spyOn, test } from 'bun:test';
import { composedRequestBody, createComposedProvider, openrouterProfileSha256, profileSha256, type ComposedStageEvent } from './provider';
import { estimateOpenRouterNanoUsd, openrouterPolicy, reconcileOpenRouterCost, usdToNanoUsd, validateOpenRouterResponse, type OpenRouterSpending, type OpenRouterStage } from './openrouter';
import { analysisInput } from './question-analysis';
import { planTestInput } from './test-plan-input';

const input = analysisInput('Explain a synthetic conceptual distinction.');
const wire = (stage: OpenRouterStage = 'analyze'): any => ({
    model: openrouterPolicy.models[stage], provider: 'Anthropic', stop_reason: 'end_turn',
    content: [{ type: 'text', text: '{"ok":true}' }], usage: { input_tokens: 90, output_tokens: 10, cost: 0.001 },
    openrouter_metadata: { requested: openrouterPolicy.models[stage], strategy: 'direct', attempt: 1, is_byok: false, endpoints: { total: 1, available: [{ provider: 'Anthropic', model: openrouterPolicy.models[stage], selected: true }] }, pipeline: [] },
});
function spending(): OpenRouterSpending & { rows: unknown[]; pending: boolean; stopped: boolean } {
    return {
        rows: [], pending: false, stopped: false,
        check() { if (this.pending || this.stopped) throw Error('unavailable'); },
        reserve(attempt, stage, body) { this.pending = true; this.rows.push(['reserved', attempt, stage, estimateOpenRouterNanoUsd(stage, body)]); },
        settle(attempt, cost, source) { this.rows.push(['settled', attempt, cost, source]); this.pending = false; },
        uncertain(attempt) { this.rows.push(['uncertain', attempt]); this.stopped = true; },
    };
}
function harness(fetcher: (url: string, init: RequestInit) => Promise<Response>) {
    const ledger = spending(), events: ComposedStageEvent[] = []; let stages = 0;
    const provider = createComposedProvider({ apiKey: 'synthetic-key-must-never-escape', transport: 'openrouter', spending: ledger, budget: { maxCalls: 5, remaining: () => 5 - stages, reserve: () => ++stages }, onStage: e => events.push(e), fetch: fetcher });
    return { provider, ledger, events, stages: () => stages };
}
const restorers: (() => void)[] = [];
afterEach(() => { while (restorers.length) restorers.pop()!(); });

test('new profile and explicit transport preserve every existing semantic request value', () => {
    expect(openrouterProfileSha256).not.toBe(profileSha256);
    for (const stage of ['analyze', 'plan', 'verify'] as const) {
        const request = stage === 'analyze' ? input : planTestInput();
        const direct = JSON.parse(composedRequestBody(stage, request));
        const routed = JSON.parse(composedRequestBody(stage, request, 'openrouter'));
        const { provider, speed, stream, plugins, ...semantic } = routed;
        expect(semantic).toEqual({ ...direct, model: openrouterPolicy.models[stage] });
        expect(provider.only).toEqual(['anthropic']); expect(provider.ignore).toEqual(['anthropic/fast']);
        expect(provider.allow_fallbacks).toBe(false); expect(provider.require_parameters).toBe(true);
        expect(provider.max_price).toEqual(stage === 'plan' ? { prompt: '2', completion: '10' } : { prompt: '5', completion: '25' });
        expect(speed).toBe('standard'); expect(stream).toBe(false);
        expect(plugins.map((p: any) => p.id)).toEqual(['auto-router', 'auto-beta-router', 'web', 'file-parser', 'response-healing', 'context-compression', 'pareto-router', 'fusion']);
        expect(plugins.every((p: any) => p.enabled === false)).toBe(true);
        expect(routed).not.toHaveProperty('fallbacks'); expect(routed).not.toHaveProperty('models');
    }
    expect(Object.isFrozen(openrouterPolicy.routing.only)).toBe(true);
});

test('transport bytes are checked after adding routing and schema controls, before any reserve', async () => {
    const simple = { ...planTestInput(), padding: '' };
    const size = new TextEncoder().encode(composedRequestBody('plan', simple)).length;
    simple.padding = 'a'.repeat(64000 - size);
    expect(new TextEncoder().encode(composedRequestBody('plan', simple)).length).toBe(64000);
    let calls = 0; const h = harness(async () => { calls++; return Response.json(wire()); });
    await expect(h.provider.invoke('plan', simple, new AbortController().signal)).rejects.toThrow('context_limit');
    expect(h.stages()).toBe(0); expect(h.ledger.rows).toEqual([]); expect(calls).toBe(0);
});

test('one native POST uses bearer only and records strict safe identity with reconciled cost', async () => {
    const calls: [string, RequestInit][] = [];
    const h = harness(async (url, init) => { calls.push([url, init]); return Response.json(wire()); });
    expect(await h.provider.invoke('analyze', input, new AbortController().signal)).toEqual({ ok: true });
    expect(calls.length).toBe(1); expect(calls[0]![0]).toBe(openrouterPolicy.endpoint);
    const headers = new Headers(calls[0]![1].headers);
    expect(headers.get('authorization')).toBe('Bearer synthetic-key-must-never-escape');
    expect(headers.has('x-api-key')).toBe(false); expect(headers.get('x-openrouter-cache')).toBe('false');
    expect(headers.get('x-openrouter-metadata')).toBe('enabled');
    expect(h.ledger.rows[1]).toEqual(['settled', 1, 1000000, 'response']);
    expect(h.events.map(e => e.phase)).toEqual(['started', 'completed']);
    expect(h.events[1]!.openrouter?.reported_attempt).toBe(1);
    expect(JSON.stringify(h.events)).not.toContain('synthetic-key-must-never-escape');
    expect(h.provider.model).toBe('anthropic/claude-opus-5');
});

test('conflicting or missing routing evidence cannot pass or invoke another model', () => {
    const bad: ((r: any) => void)[] = [
        r => { delete r.openrouter_metadata; }, r => { r.model = 'claude-opus-5'; }, r => { r.model += '-other'; },
        r => { r.provider = 'Google'; }, r => { r.openrouter_metadata.strategy = 'fallback'; },
        r => { r.openrouter_metadata.requested = 'openrouter/auto'; }, r => { r.openrouter_metadata.attempt = 2; },
        r => { r.openrouter_metadata.is_byok = true; }, r => { r.usage.is_byok = true; },
        r => { r.openrouter_metadata.endpoints.available[0].provider = 'Google'; },
        r => { r.openrouter_metadata.endpoints.available[0].model = 'anthropic/claude-sonnet-5'; },
        r => { r.openrouter_metadata.endpoints.available[0].selected = false; },
        r => { r.openrouter_metadata.endpoints.available.push(r.openrouter_metadata.endpoints.available[0]); },
        r => { r.openrouter_metadata.attempts = [{ provider: 'Google', model: r.model, status: 200 }]; },
        r => { r.openrouter_metadata.attempts = [{ provider: 'Anthropic', model: r.model, status: 500 }]; },
        r => { r.openrouter_metadata.attempts = [{ provider: 'Anthropic', model: r.model, status: 200 }, { provider: 'Anthropic', model: r.model, status: 200 }]; },
        r => { r.openrouter_metadata.pipeline = [{ type: 'unknown', data: { secret: 'forbidden' } }]; },
        r => { r.openrouter_metadata.pipeline = null; }, r => { r.input_transformations = [{}]; },
        r => { r.context_management = {}; }, r => { r.error = { message: 'forbidden' }; },
    ];
    for (const mutate of bad) { const raw = wire(); mutate(raw); expect(() => validateOpenRouterResponse('analyze', raw)).toThrow('provider_failure'); }
    const good = wire(); good.openrouter_metadata.attempts = [{ provider: 'Anthropic', model: good.model, status: 200 }];
    expect(validateOpenRouterResponse('analyze', good).reported_attempt).toBe(1);
});

test('HTTP failure preserves immediate failure and uncertain money with no cost lookup/retry', async () => {
    let calls = 0; const h = harness(async () => { calls++; return new Response('sensitive vendor error', { status: 400 }); });
    await expect(h.provider.invoke('analyze', input, new AbortController().signal)).rejects.toThrow('provider_failure');
    expect(calls).toBe(1); expect(h.ledger.stopped).toBe(true); expect(h.events[1]!.http_status).toBe(400);
    expect(JSON.stringify(h.events)).not.toContain('sensitive vendor error');
    await expect(h.provider.invoke('analyze', input, new AbortController().signal)).rejects.toThrow(); expect(calls).toBe(1);
});

test('valid cost survives truncation while partial text and reasoning remain private', async () => {
    const raw = wire(); raw.stop_reason = 'max_tokens'; raw.content = [{ type: 'thinking', thinking: 'private-thinking' }, { type: 'text', text: 'partial-private' }];
    const h = harness(async () => Response.json(raw));
    await expect(h.provider.invoke('analyze', input, new AbortController().signal)).rejects.toThrow('provider_truncated');
    expect(h.ledger.rows[1]).toEqual(['settled', 1, 1000000, 'response']);
    expect(JSON.stringify(h.events)).not.toMatch(/private-thinking|partial-private/);
});

test('missing or invalid truncation cost never initiates a lookup or overwrites the terminal reason', async () => {
    for (const cost of [undefined, null, -1]) {
        const raw = wire(); raw.stop_reason = 'max_tokens'; raw.usage.cost = cost;
        let calls = 0; const h = harness(async (_url, init) => {
            calls++; if (init.method === 'GET') return new Promise(() => {});
            return Response.json(raw, { headers: { 'X-Generation-Id': 'gen-truncated' } });
        });
        await expect(h.provider.invoke('analyze', input, new AbortController().signal)).rejects.toThrow('provider_truncated');
        expect(calls).toBe(1); expect(h.events[1]!.stop_reason).toBe('max_tokens');
        expect(h.events[1]!.usage).toEqual({ input_tokens: 90, output_tokens: 10 });
        expect(h.ledger.stopped).toBe(true);
    }
});

test('exact dated canonical aliases pass consistently; cache-hit contradictions fail', async () => {
    const raw = wire(); raw.model = openrouterPolicy.canonical_models['anthropic/claude-opus-5'];
    raw.openrouter_metadata.endpoints.available[0].model = raw.model;
    raw.openrouter_metadata.attempts = [{ provider: 'Anthropic', model: raw.model, status: 200 }];
    expect(validateOpenRouterResponse('analyze', raw).response_model).toBe(raw.model);
    const h = harness(async () => Response.json(raw));
    expect(await h.provider.invoke('analyze', input, new AbortController().signal)).toEqual({ ok: true });
    for (const status of ['HIT', 'unknown', '']) expect(() => validateOpenRouterResponse('analyze', wire(), new Response('', { headers: { 'X-OpenRouter-Cache-Status': status } }))).toThrow('provider_failure');
    expect(validateOpenRouterResponse('analyze', wire(), new Response('', { headers: { 'X-OpenRouter-Cache-Status': 'MISS' } })).reported_attempt).toBe(1);
});

test('HTTP200 error envelope cannot render or count as cost-free success', async () => {
    let calls = 0; const h = harness(async () => { calls++; return Response.json({ error: { type: 'api_error', error_type: 'provider_unavailable', message: 'private-marker' } }); });
    await expect(h.provider.invoke('analyze', input, new AbortController().signal)).rejects.toThrow('provider_failure');
    expect(calls).toBe(1); expect(h.events[1]!.phase).toBe('failed'); expect(h.ledger.stopped).toBe(true);
    expect(JSON.stringify(h.events)).not.toContain('private-marker');
});

test('missing native cost permits one exact associated metadata GET, not content retrieval', async () => {
    const raw = wire(); delete raw.usage.cost; const calls: string[] = [];
    const h = harness(async (url, init) => {
        calls.push(url);
        if (init.method === 'POST') return Response.json(raw, { headers: { 'X-Generation-Id': 'gen-example_1' } });
        expect(init.redirect).toBe('error');
        return Response.json({ data: { id: 'gen-example_1', model: raw.model, provider_name: 'Anthropic', is_byok: false, total_cost: 0.002, secret: 'never-log' } });
    });
    expect(await h.provider.invoke('analyze', input, new AbortController().signal)).toEqual({ ok: true });
    expect(calls).toEqual([openrouterPolicy.endpoint, 'https://openrouter.ai/api/v1/generation?id=gen-example_1']);
    expect(h.stages()).toBe(1); expect(h.ledger.rows[1]).toEqual(['settled', 1, 2000000, 'generation']);
    expect(JSON.stringify(h.events)).not.toContain('never-log'); expect(JSON.stringify(h.events)).not.toContain('gen-example_1');
});

test('unknown cost, unsafe ID, foreign association and invalid cost are not zero', async () => {
    for (const scenario of ['missing-id', 'unsafe-id', 'wrong-id', 'negative', 'nan', 'string', 'oversized']) {
        const raw = wire(); delete raw.usage.cost; let calls = 0;
        const h = harness(async (_url, init) => {
            calls++;
            if (init.method === 'POST') return Response.json(raw, { headers: scenario === 'missing-id' ? {} : { 'X-Generation-Id': scenario === 'unsafe-id' ? 'https://untrusted.invalid/' : 'gen-safe' } });
            if (scenario === 'oversized') return new Response(' '.repeat(16385));
            return Response.json({ data: { id: scenario === 'wrong-id' ? 'gen-foreign' : 'gen-safe', model: raw.model, provider_name: 'Anthropic', is_byok: false, total_cost: scenario === 'negative' ? -1 : scenario === 'nan' ? null : '0.01' } });
        });
        await expect(h.provider.invoke('analyze', input, new AbortController().signal)).rejects.toThrow('provider_failure');
        expect(calls).toBe(scenario === 'missing-id' || scenario === 'unsafe-id' ? 1 : 2);
        expect(h.ledger.stopped).toBe(true); expect(h.ledger.rows.some((r: any) => r[0] === 'settled')).toBe(false);
    }
    for (const bad of [-1, Infinity, NaN, null, '0.1']) expect(() => usdToNanoUsd(bad)).toThrow('provider_failure');
    expect(usdToNanoUsd(0.0000000001)).toBe(1);
});

test('bounded metadata timeout defeats a hostile pending body and preserves caller precedence', async () => {
    const deadline = new AbortController();
    const clock = spyOn(AbortSignal, 'timeout').mockImplementation(ms => ms === 5000 ? deadline.signal : new AbortController().signal);
    restorers.push(() => clock.mockRestore());
    const raw = wire(); delete raw.usage.cost; let canceled = false;
    const response = Response.json(raw, { headers: { 'X-Generation-Id': 'gen-safe' } });
    const lookup = reconcileOpenRouterCost({ stage: 'analyze', raw, response, apiKey: 'test', signal: new AbortController().signal, fetch: async () => new Response(new ReadableStream({ pull() { deadline.abort(); return new Promise(() => {}); }, cancel() { canceled = true; } })) });
    await expect(lookup).rejects.toThrow(); expect(canceled).toBe(true);
    const caller = new AbortController();
    const h = harness(async () => { caller.abort(); return new Response('', { status: 400 }); });
    await expect(h.provider.invoke('analyze', input, caller.signal)).rejects.toThrow('request_cancelled');
    expect(h.events[1]!.abort_source).toBe('caller');
});

test('non-OK metadata cancels its unread stream without delaying the original failure', async () => {
    let canceled = false, calls = 0;
    const raw = wire(); delete raw.usage.cost;
    const h = harness(async (_url, init) => {
        calls++;
        if (init.method === 'POST') return Response.json(raw, { headers: { 'X-Generation-Id': 'gen-safe' } });
        return new Response(new ReadableStream({ cancel() { canceled = true; return new Promise(() => {}); } }), { status: 503 });
    });
    await expect(h.provider.invoke('analyze', input, new AbortController().signal)).rejects.toThrow('provider_failure');
    expect(calls).toBe(2); expect(canceled).toBe(true); expect(h.ledger.stopped).toBe(true);
});
