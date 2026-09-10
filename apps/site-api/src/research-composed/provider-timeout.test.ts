import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { classifyComposedFailure, composedProfiles, composedRequestBody, createComposedProvider, type ComposedStageEvent } from './provider'
import { CompositionError } from './catalog'
import { PassageError } from '../research-passages/release'
import type { AttemptBudget } from '../research-cloud/budget'
import { analysisInput } from './question-analysis'

// Synthetic transport tests only. No source fixtures, questions, live endpoints
// or model requests are read/sent. Native deadline creation is spied on locally
// to trigger the actual composed AbortSignal path without a 180-second wait.
const secret = 'synthetic-private-error-marker'
const active = () => new AbortController()
const aborted = () => { const controller = active(); controller.abort(secret); return controller }
const wire = (extra: Record<string, unknown> = {}) => ({ model: 'claude-opus-5', stop_reason: 'end_turn', content: [{ type: 'text', text: '{"ok":true}' }], ...extra })
const budget = (): AttemptBudget & { reservations: string[] } => {
  const reservations: string[] = []
  return { reservations, maxCalls: 5, remaining: () => 5 - reservations.length, reserve: stage => { reservations.push(stage); return reservations.length } }
}
const restores: (() => void)[] = []
afterEach(() => { while (restores.length) restores.pop()!() })
const stageClock = () => {
  const deadline = active()
  const mock = spyOn(AbortSignal, 'timeout').mockImplementation(ms => { expect(ms).toBe(180000); return deadline.signal })
  restores.push(() => mock.mockRestore())
  return deadline
}
const harness = (fetcher: (url: string, init: RequestInit) => Promise<Response>) => {
  const events: ComposedStageEvent[] = [], attempts = budget()
  const provider = createComposedProvider({ apiKey: secret, budget: attempts, fetch: fetcher, onStage: event => events.push(event) })
  return { events, attempts, provider }
}
const failed = (events: ComposedStageEvent[]) => {
  expect(events.map(event => event.phase)).toEqual(['started', 'failed'])
  const terminal = events[1]!
  expect(Number.isSafeInteger(terminal.elapsed_ms)).toBe(true)
  expect(terminal.elapsed_ms).toBeGreaterThanOrEqual(0)
  expect(terminal).not.toHaveProperty('input')
  expect(terminal).not.toHaveProperty('output')
  expect(JSON.stringify(terminal)).not.toContain(secret)
  for (const key of ['message', 'stack', 'body', 'headers', 'thinking', 'partial_content', 'reason']) expect(terminal).not.toHaveProperty(key)
  return terminal
}

describe('Composed failure classification uses only actual abort signals', () => {
  test('deadline abort is a local typed provider_timeout', () => {
    const result = classifyComposedFailure(new Error(secret), active().signal, aborted().signal)
    expect(result.error).toBeInstanceOf(CompositionError)
    expect(result.error.code).toBe('provider_timeout')
    expect(result.abort_source).toBe('stage_deadline')
    expect(result.error.message).toBe('provider_timeout')
  })
  test('caller cancellation takes precedence when both signals are aborted', () => {
    const result = classifyComposedFailure(new Error(secret), aborted().signal, aborted().signal)
    expect(result.error).toBeInstanceOf(PassageError)
    expect(result.error.code).toBe('request_cancelled')
    expect(result.abort_source).toBe('caller')
  })
  test('TimeoutError and AbortError names alone cannot establish a deadline or caller abort', () => {
    for (const name of ['TimeoutError', 'AbortError']) {
      const result = classifyComposedFailure(new DOMException(secret, name), active().signal, active().signal)
      expect(result.error.code).toBe('provider_failure')
      expect(result.abort_source).toBe('none')
      expect(result.error.message).not.toContain(secret)
    }
  })
  test('known safe provider truncation survives without retaining the original error text or stack', () => {
    const original = new PassageError('provider_truncated'); original.message = secret; original.stack = secret
    const result = classifyComposedFailure(original, active().signal, active().signal)
    expect(result.error.code).toBe('provider_truncated')
    expect(result.error).not.toBe(original)
    expect(result.error.message).toBe('provider_truncated')
    expect(result.error.stack).not.toContain(secret)
    expect(result.abort_source).toBe('none')
  })
})

describe('Composed transport failures retain bounded phase diagnostics', () => {
  test('stage deadline while awaiting headers uses the actual fetch abort path, with one reservation and no retry', async () => {
    const deadline = stageClock()
    let fetches = 0
    const h = harness(async (_url, init) => {
      fetches++
      return await new Promise<Response>((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(new Error(secret)), { once: true })
        deadline.abort(secret)
      })
    })
    await expect(h.provider.invoke('verify', {}, active().signal)).rejects.toThrow('provider_timeout')
    expect(failed(h.events)).toMatchObject({ code: 'provider_timeout', failure_phase: 'awaiting_headers', abort_source: 'stage_deadline' })
    expect(h.events[1]).not.toHaveProperty('http_status')
    expect(h.events[1]).not.toHaveProperty('usage')
    expect(h.events[1]).not.toHaveProperty('stop_reason')
    expect(fetches).toBe(1); expect(h.attempts.reservations).toEqual(['verify'])
  })
  test('caller cancellation while awaiting headers is distinguished from an unexpired stage deadline', async () => {
    stageClock(); const caller = active()
    const h = harness(async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new Error(secret)), { once: true })
      caller.abort(secret)
    }))
    await expect(h.provider.invoke('verify', {}, caller.signal)).rejects.toThrow('request_cancelled')
    expect(failed(h.events)).toMatchObject({ code: 'request_cancelled', failure_phase: 'awaiting_headers', abort_source: 'caller' })
    expect(h.attempts.reservations).toEqual(['verify'])
  })
  test('an ordinary pre-header transport error remains provider_failure without guessing timeout', async () => {
    stageClock()
    const h = harness(async () => { throw new DOMException(secret, 'TimeoutError') })
    await expect(h.provider.invoke('verify', {}, active().signal)).rejects.toThrow('provider_failure')
    expect(failed(h.events)).toMatchObject({ failure_phase: 'awaiting_headers', abort_source: 'none' })
  })
  test.each(['stage_deadline', 'caller'] as const)('%s during body reading retains only the received HTTP status', async source => {
    const deadline = stageClock(), caller = active()
    const h = harness(async (_url, init) => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"partial":"' + secret))
        init.signal!.addEventListener('abort', () => controller.error(new Error(secret)), { once: true })
      },
      pull() { (source === 'caller' ? caller : deadline).abort(secret) },
    }), { status: 200 }))
    await expect(h.provider.invoke('verify', {}, caller.signal)).rejects.toThrow(source === 'caller' ? 'request_cancelled' : 'provider_timeout')
    expect(failed(h.events)).toMatchObject({ failure_phase: 'reading_body', abort_source: source, http_status: 200 })
    expect(h.events[1]).not.toHaveProperty('usage'); expect(h.events[1]).not.toHaveProperty('stop_reason')
  })
  test('invalid response JSON is decoding failure without logging body or raw exception', async () => {
    stageClock()
    const h = harness(async () => new Response('{"private":"' + secret))
    await expect(h.provider.invoke('verify', {}, active().signal)).rejects.toThrow('provider_failure')
    expect(failed(h.events)).toMatchObject({ failure_phase: 'decoding', abort_source: 'none', http_status: 200 })
  })
  test('invalid UTF-8 is a decoding failure', async () => {
    stageClock()
    const h = harness(async () => new Response(new Uint8Array([0xff, 0xfe])))
    await expect(h.provider.invoke('verify', {}, active().signal)).rejects.toThrow('provider_failure')
    expect(failed(h.events)).toMatchObject({ failure_phase: 'decoding', abort_source: 'none' })
  })
  test('invalid model JSON retains only enumerated stop reason and nonnegative integer usage', async () => {
    stageClock()
    const h = harness(async () => Response.json(wire({ content: [{ type: 'text', text: secret }], usage: { input_tokens: 12, output_tokens: -1, secret } })))
    await expect(h.provider.invoke('verify', {}, active().signal)).rejects.toThrow('provider_failure')
    expect(failed(h.events)).toMatchObject({ failure_phase: 'decoding', abort_source: 'none', stop_reason: 'end_turn', usage: { input_tokens: 12 } })
  })
  test('the existing 250000-byte response limit still refuses before decoding', async () => {
    stageClock()
    const h = harness(async () => new Response('a'.repeat(250001)))
    await expect(h.provider.invoke('verify', {}, active().signal)).rejects.toThrow('provider_failure')
    expect(failed(h.events)).toMatchObject({ failure_phase: 'reading_body', abort_source: 'none' })
  })
  test('provider truncation stays distinct and logs no partial answer or thinking', async () => {
    stageClock()
    const h = harness(async () => Response.json(wire({ stop_reason: 'max_tokens', usage: { input_tokens: 123, output_tokens: 16384, output_tokens_details: { thinking_tokens: 12000, private: secret } }, content: [{ type: 'thinking', thinking: secret, signature: secret }, { type: 'text', text: secret }] })))
    await expect(h.provider.invoke('verify', {}, active().signal)).rejects.toThrow('provider_truncated')
    expect(failed(h.events)).toMatchObject({ code: 'provider_truncated', failure_phase: 'decoding', abort_source: 'none', stop_reason: 'max_tokens', usage: { input_tokens: 123, output_tokens: 16384, thinking_tokens: 12000 } })
  })
  test('a late fetch success after its stage abort cannot release output', async () => {
    const deadline = stageClock()
    const h = harness(async () => { deadline.abort(secret); return Response.json(wire()) })
    await expect(h.provider.invoke('verify', {}, active().signal)).rejects.toThrow('provider_timeout')
    expect(failed(h.events)).toMatchObject({ failure_phase: 'awaiting_headers', abort_source: 'stage_deadline' })
  })
  test('terminal elapsed milliseconds use the monotonic clock and are floored to an integer', async () => {
    stageClock()
    const now = spyOn(performance, 'now').mockReturnValueOnce(100.25).mockReturnValueOnce(145.99)
    restores.push(() => now.mockRestore())
    const wall = spyOn(Date, 'now').mockReturnValue(-900000)
    restores.push(() => wall.mockRestore())
    const h = harness(async () => Response.json(wire()))
    expect(await h.provider.invoke('verify', {}, active().signal)).toEqual({ ok: true })
    expect(h.events[1]).toMatchObject({ phase: 'completed', elapsed_ms: 45 })
    expect(h.events[1]).not.toHaveProperty('failure_phase'); expect(h.events[1]).not.toHaveProperty('abort_source')
  })
  test('pre-cancelled callers reserve nothing and do not emit a stage', async () => {
    const h = harness(async () => { throw new Error('must not be called') })
    await expect(h.provider.invoke('verify', {}, aborted().signal)).rejects.toThrow('request_cancelled')
    expect(h.attempts.reservations).toEqual([]); expect(h.events).toEqual([])
  })
  test('source-blind input validation and request/token limits remain intact', async () => {
    const h = harness(async () => { throw new Error('must not be called') })
    const input = analysisInput('Explain a synthetic conceptual distinction.')
    await expect(h.provider.invoke('analyze', { ...input, source_catalog: secret }, active().signal)).rejects.toThrow('question_analysis_invalid')
    await expect(h.provider.invoke('verify', { text: 'a'.repeat(64000) }, active().signal)).rejects.toThrow('context_limit')
    expect(h.attempts.reservations).toEqual([]); expect(h.events).toEqual([])
    expect(composedProfiles.analyze.max_tokens).toBe(8192); expect(composedProfiles.verify.max_tokens).toBe(16384)
    expect(JSON.parse(composedRequestBody('analyze', input)).max_tokens).toBe(8192)
  })
})

test('successful transport retains numeric breakdown without private text', async () => {
 stageClock(); const h=harness(async()=>Response.json(wire({ usage: { input_tokens: 8, output_tokens: 16, output_tokens_details: { thinking_tokens: 10, text: secret }, private: secret } })));
 expect(await h.provider.invoke('verify', {}, active().signal)).toEqual({ok:true});
 expect(h.events[1]).toMatchObject({ phase:'completed', usage:{ input_tokens:8, output_tokens:16, thinking_tokens:10 } });
 expect(JSON.stringify(h.events[1])).not.toContain(secret);
});
