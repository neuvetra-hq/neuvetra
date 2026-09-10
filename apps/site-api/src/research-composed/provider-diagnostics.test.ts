import { expect, test } from 'bun:test';
import { createComposedProvider, openrouterProfileSha256, profileSha256, providerDiagnosticContract, type ComposedStageEvent, type ProviderFailureDetail } from './provider';
import { openrouterImplementationContract, openrouterPolicy, type OpenRouterIdentityField, type OpenRouterSpending } from './openrouter';
import { analysisInput } from './question-analysis';
import { hash } from '../research-passages/release';

// Portable synthetic responses only: no source fixtures, private traces, credentials or I/O.
const input = analysisInput('Explain a synthetic conceptual distinction.');
const marker = 'synthetic-sensitive-vendor-marker';
const wire = (): any => ({ model: openrouterPolicy.models.analyze, provider: 'Anthropic', stop_reason: 'end_turn',
    content: [{ type: 'text', text: '{"ok":true}' }], usage: { cost: 0.001 },
    openrouter_metadata: { requested: openrouterPolicy.models.analyze, strategy: 'direct', attempt: 1, is_byok: false,
        endpoints: { total: 1, available: [{ provider: 'Anthropic', model: openrouterPolicy.models.analyze, selected: true }] } } });
function harness(response: () => Response, options: { settleThrows?: boolean; callbackThrows?: 'started' | 'completed' | 'failed' } = {}) {
    const events: ComposedStageEvent[] = [], accounting: string[] = []; let calls = 0;
    const spending: OpenRouterSpending = { check() {}, reserve() { accounting.push('reserve'); },
        settle() { accounting.push('settle'); if (options.settleThrows) throw new Error(marker); }, uncertain() { accounting.push('uncertain'); } };
    const provider = createComposedProvider({ apiKey: marker, transport: 'openrouter', spending,
        budget: { maxCalls: 1, remaining: () => 1, reserve: () => 1 },
        fetch: async () => { calls++; return response(); }, onStage(event) { events.push(event); if (event.phase === options.callbackThrows) throw new Error(marker); } });
    return { events, accounting, calls: () => calls, invoke: () => provider.invoke('analyze', input, new AbortController().signal) };
}
function safeFailure(h: ReturnType<typeof harness>, detail: ProviderFailureDetail, broad = 'decoding', identityField?: OpenRouterIdentityField) {
    const terminal = h.events.at(-1)!;
    expect(terminal).toMatchObject({ phase: 'failed', code: 'provider_failure', http_status: 200, failure_phase: broad, failure_detail: detail, abort_source: 'none' });
    if (identityField) expect(terminal.router_identity_field).toBe(identityField);
    else expect(terminal).not.toHaveProperty('router_identity_field');
    expect(providerDiagnosticContract.details).toContain(terminal.failure_detail!);
    expect(JSON.stringify(terminal)).not.toContain(marker);
    for (const key of ['input', 'output', 'headers', 'body', 'message', 'stack']) expect(terminal).not.toHaveProperty(key);
    expect(h.calls()).toBe(1);
}

test('HTTP200 failures distinguish UTF8, outer JSON, envelope and exact router identity field without accepting any', async () => {
    const invalidRoute = wire(); invalidRoute.openrouter_metadata.attempt = 2;
    const cases: readonly [BodyInit, ProviderFailureDetail, readonly string[], OpenRouterIdentityField?][] = [
        [new Uint8Array([0xff]), 'utf8_decode', ['reserve', 'uncertain']],
        ['{', 'outer_json', ['reserve', 'uncertain']],
        ['[]', 'response_envelope', ['reserve', 'uncertain']],
        ['{}', 'router_identity', ['reserve', 'uncertain'], 'response_model'],
        [JSON.stringify(invalidRoute), 'router_identity', ['reserve', 'settle'], 'attempt'],
    ];
    for (const [body, detail, accounting, identityField] of cases) {
        const h = harness(() => new Response(body, { status: 200 }));
        await expect(h.invoke()).rejects.toThrow('provider_failure'); safeFailure(h, detail, 'decoding', identityField);
        expect(h.accounting).toEqual([...accounting]);
    }
});
test('identity failure settles only valid native response cost without fabricating validated identity', async () => {
    const invalid = wire(); invalid.model = marker; invalid.openrouter_metadata.requested = marker;
    const h = harness(() => Response.json(invalid, { headers: { 'X-Generation-Id': 'gen-synthetic' } }));
    await expect(h.invoke()).rejects.toThrow('provider_failure');
    safeFailure(h, 'router_identity', 'decoding', 'response_model');
    const terminal = h.events.at(-1)!;
    expect(h.accounting).toEqual(['reserve', 'settle']);
    expect(terminal.openrouter_cost).toEqual({ cost_nano_usd: 1000000, cost_source: 'response', generation_id_sha256: hash('gen-synthetic') });
    expect(terminal).not.toHaveProperty('openrouter');
    expect(JSON.stringify(terminal)).not.toContain('gen-synthetic');
});
test('error envelopes and invalid identity-failure costs remain uncertain', async () => {
    for (const cost of [undefined, null, -1, '0.001', Number.POSITIVE_INFINITY]) {
        const invalid = wire(); invalid.model = marker; invalid.usage.cost = cost;
        const h = harness(() => Response.json(invalid));
        await expect(h.invoke()).rejects.toThrow('provider_failure');
        safeFailure(h, 'router_identity', 'decoding', 'response_model');
        expect(h.accounting).toEqual(['reserve', 'uncertain']);
        expect(h.events.at(-1)).not.toHaveProperty('openrouter_cost');
    }
    const errorEnvelope = wire(); errorEnvelope.error = { message: marker }; errorEnvelope.usage.cost = 0;
    const error = harness(() => Response.json(errorEnvelope));
    await expect(error.invoke()).rejects.toThrow('provider_failure');
    safeFailure(error, 'router_identity', 'decoding', 'error_envelope');
    expect(error.accounting).toEqual(['reserve', 'uncertain']);
    expect(error.events.at(-1)).not.toHaveProperty('openrouter_cost');
});
test('non-200 success-family statuses cannot satisfy the exact native billing authority', async () => {
    for (const status of [201, 202]) {
        const invalid = wire(); invalid.model = marker;
        const h = harness(() => Response.json(invalid, { status }));
        await expect(h.invoke()).rejects.toThrow('provider_failure');
        const terminal = h.events.at(-1)!;
        expect(terminal).toMatchObject({ phase: 'failed', code: 'provider_failure', http_status: status, failure_detail: 'router_identity', router_identity_field: 'response_model' });
        expect(h.accounting).toEqual(['reserve', 'uncertain']);
        expect(terminal).not.toHaveProperty('openrouter_cost');
    }
});
test('stop reason, missing content and inner JSON get separate details while valid native cost stays settled', async () => {
    for (const detail of ['stop_reason', 'content_shape', 'inner_json'] as const) {
        const value = wire();
        if (detail === 'stop_reason') value.stop_reason = 'refusal';
        if (detail === 'content_shape') value.content = [];
        if (detail === 'inner_json') value.content[0].text = marker;
        const h = harness(() => Response.json(value));
        await expect(h.invoke()).rejects.toThrow('provider_failure'); safeFailure(h, detail);
        expect(h.accounting).toEqual(['reserve', 'settle']);
    }
});
test('body absence, size and stream error remain bounded failure classes with original broad phase', async () => {
    const cases: [() => Response, ProviderFailureDetail][] = [
        [() => new Response(null, { status: 200 }), 'body_presence'],
        [() => new Response('x'.repeat(250001)), 'body_size'],
        [() => new Response(new ReadableStream({ start(controller) { controller.error(new Error(marker)); } })), 'body_read'],
    ];
    for (const [response, detail] of cases) {
        const h = harness(response); await expect(h.invoke()).rejects.toThrow('provider_failure');
        safeFailure(h, detail, 'reading_body'); expect(h.accounting).toEqual(['reserve', 'uncertain']);
    }
});
test('missing cost and ledger exception retain uncertainty without a retry or settlement fallback', async () => {
    const missingCost = wire(); delete missingCost.usage.cost;
    const missing = harness(() => Response.json(missingCost));
    await expect(missing.invoke()).rejects.toThrow('provider_failure'); safeFailure(missing, 'cost_reconciliation');
    expect(missing.accounting).toEqual(['reserve', 'uncertain']);
    const ledger = harness(() => Response.json(wire()), { settleThrows: true });
    await expect(ledger.invoke()).rejects.toThrow('provider_failure'); safeFailure(ledger, 'cost_settlement');
    expect(ledger.accounting).toEqual(['reserve', 'settle', 'uncertain']);
});
test('successful response keeps original result/accounting and has no failure metadata', async () => {
    const h = harness(() => Response.json(wire()));
    expect(await h.invoke()).toEqual({ ok: true }); expect(h.accounting).toEqual(['reserve', 'settle']);
    expect(h.events.at(-1)).not.toHaveProperty('failure_detail'); expect(h.events.at(-1)).not.toHaveProperty('failure_phase');
    expect(h.calls()).toBe(1);
});
test('mandatory trace callback exceptions retain historical propagation; diagnostic patch does not silently swallow them', async () => {
    const started = harness(() => Response.json(wire()), { callbackThrows: 'started' });
    await expect(started.invoke()).rejects.toThrow('provider_failure'); expect(started.calls()).toBe(0);
    expect(started.events.at(-1)?.failure_detail).toBe('stage_callback');
    const completed = harness(() => Response.json(wire()), { callbackThrows: 'completed' });
    await expect(completed.invoke()).rejects.toThrow('provider_failure'); safeFailure(completed, 'stage_callback');
    expect(completed.accounting).toEqual(['reserve', 'settle']);
    const failed = harness(() => new Response('{'), { callbackThrows: 'failed' });
    await expect(failed.invoke()).rejects.toThrow(marker); expect(failed.calls()).toBe(1);
    expect(failed.accounting).toEqual(['reserve', 'uncertain']);
});
test('actual OpenRouter fingerprint binds the finite policy and changed body-decoder helper', () => {
    expect(Object.isFrozen(providerDiagnosticContract)).toBe(true); expect(Object.isFrozen(providerDiagnosticContract.details)).toBe(true);
    expect(providerDiagnosticContract.bounded_body).toContain('utf8_decode');
    const contract = { answering_policy_sha256: profileSha256, transport: openrouterPolicy, implementation: openrouterImplementationContract,
        transport_execution: createComposedProvider.toString(), diagnostics: providerDiagnosticContract };
    expect(hash(JSON.stringify(contract))).toBe(openrouterProfileSha256);
    expect(hash(JSON.stringify({ ...contract, diagnostics: { ...providerDiagnosticContract, bounded_body: 'different decoder' } }))).not.toBe(openrouterProfileSha256);
});
