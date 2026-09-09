import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createAttemptBudget } from './budget'
import { cloudRequestBody, createCloudProvider, profileSha256, decodeDraftParagraphs } from './provider'
const dir = () => mkdtempSync(path.join(tmpdir(), 'neuvetra-cloud-budget-'))
const policy = { runId: 'unit-run', maxCalls: 5, reservationUsd: 1, profileSha256 }
describe('Cloud provider and durable attempts', () => {
  test('restarts preserve every reserved attempt and changed policies fail', () => {
    const d = dir()
    try {
      const a = createAttemptBudget(d, policy); a.reserve('plan', 'a'.repeat(64))
      const b = createAttemptBudget(d, policy); expect(b.remaining()).toBe(4)
      expect(() => createAttemptBudget(d, { ...policy, maxCalls: 6 })).toThrow('differs')
      for (let i = 0; i < 4; i++) b.reserve('draft', 'b'.repeat(64))
      expect(() => a.reserve('verify', 'a'.repeat(64))).toThrow('budget_exhausted')
      expect(readdirSync(d)).toHaveLength(6)
    } finally { rmSync(d, { recursive: true }) }
  })
  test('preflight bounds exact body bytes without trimming', () => {
    expect(() => cloudRequestBody('draft', { text: '漢'.repeat(30000) })).toThrow('context_limit')
    const body = JSON.parse(cloudRequestBody('draft', { question: 'Q' }))
    expect(body.model).toBe('claude-opus-5'); expect(body.max_tokens).toBe(8192)
    expect(body.output_config.format.type).toBe('json_schema')
    expect(body.messages[0].content).toBe('{"question":"Q"}')
  })
  test('transport failures reserve before I/O, never retry and redact error details', async () => {
    const d = dir(); let calls = 0
    try {
      const budget = createAttemptBudget(d, policy)
      const p = createCloudProvider({ apiKey: 'private-test-key', budget, fetch: async (_url, init) => { calls++; expect(budget.remaining()).toBe(4); expect(init.redirect).toBe('error'); throw new Error('credential-shaped-private-error') } })
      await expect(p.invoke('plan', { question: 'Q' }, new AbortController().signal)).rejects.toThrow('provider_failure')
      expect(calls).toBe(1); expect(budget.remaining()).toBe(4)
      expect(readFileSync(path.join(d, 'attempt-001.json'), 'utf8')).not.toContain('private-test-key')
    } finally { rmSync(d, { recursive: true }) }
  })
  test('wrong model, truncation, malformed final block and oversized responses are rejected', async () => {
    for (const raw of [
      { model: 'wrong', stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }] },
      { model: 'claude-opus-5', stop_reason: 'max_tokens', content: [{ type: 'text', text: '{}' }] },
      { model: 'claude-opus-5', stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }, { type: 'tool_use' }] },
      { model: 'claude-opus-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'x'.repeat(260000) }] },
    ]) {
      const d = dir()
      try { const p = createCloudProvider({ apiKey: 'private', budget: createAttemptBudget(d, policy), fetch: async () => Response.json(raw) }); await expect(p.invoke('draft', {}, new AbortController().signal)).rejects.toThrow() }
      finally { rmSync(d, { recursive: true }) }
    }
  })
  test('recognized thinking stays out of evaluation events', async () => {
    const d = dir(), events: unknown[] = []
    try {
      const p = createCloudProvider({ apiKey: 'private', budget: createAttemptBudget(d, policy), onStage: e => { events.push(e) }, fetch: async () => Response.json({ model: 'claude-opus-5', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'private-reasoning', signature: 'sig' }, { type: 'text', text: '{"answers":[]}' }], usage: { input_tokens: 10, output_tokens: 20 } }) })
      expect(await p.invoke('draft', { question: 'Q' }, new AbortController().signal)).toEqual({ answers: [] })
      expect(events).toHaveLength(2); expect(JSON.stringify(events)).not.toContain('private-reasoning')
    } finally { rmSync(d, { recursive: true }) }
  })
})

describe('singular draft wire grammar', () => {
  const paragraph = { text: 'A complete conceptual paragraph with conditions.', passage_ids: ['S01'], support: [{ passage_id: 'S01', quote: 'An exact supporting source sentence.' }] }
  test('wire object maps without editing text, citations or anchors', () => {
    expect(decodeDraftParagraphs({ answers: [{ facet_id: 'f1', paragraph }] })).toEqual({ answers: [{ facet_id: 'f1', claims: [paragraph] }] })
    expect(decodeDraftParagraphs({ answers: [] })).toEqual({ answers: [] })
    const wire = JSON.parse(cloudRequestBody('draft', {})).output_config.format.schema
    expect(wire.properties.answers.items.properties.paragraph.type).toBe('object')
    expect(JSON.stringify(wire)).not.toContain('maxItems')
  })
  test('arrays, missing fields and extra fields fail; nothing is truncated or silently dropped', () => {
    for (const raw of [null, { answers: [], extra: true }, { answers: [{ facet_id: 'f1', paragraph: [paragraph, paragraph] }] },
      { answers: [{ facet_id: 'f1', paragraph, extra: true }] }, { answers: [{ facet_id: 'f1', claims: [paragraph] }] },
      { answers: [{ facet_id: 'f1', paragraph: { ...paragraph, extra: true } }] }, { answers: [{ facet_id: 'f1', paragraph: { text: 'Missing evidence.' } }] }]) {
      expect(() => decodeDraftParagraphs(raw)).toThrow('draft_invalid')
    }
  })
  test('private completed event retains original wire output while caller receives internal group', async () => {
    const d = dir(), events: unknown[] = [], wire = { answers: [{ facet_id: 'f1', paragraph }] }
    try {
      const p = createCloudProvider({ apiKey: 'private', budget: createAttemptBudget(d, policy), onStage: e => events.push(e), fetch: async () => Response.json({ model: 'claude-opus-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(wire) }] }) })
      expect(await p.invoke('draft', {}, new AbortController().signal)).toEqual(decodeDraftParagraphs(wire))
      expect(events[1]).toHaveProperty('output', wire)
    } finally { rmSync(d, { recursive: true }) }
  })
})
