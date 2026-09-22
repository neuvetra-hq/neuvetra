import { expect, test } from 'bun:test';
import {
  verifyLifecycleDiagnostics,
  verifyRestartFreshForRevisit,
  type LifecycleAdmission,
} from './m78-continuation4-lifecycle-independent-review';
import { m78CanonicalJson as canonical } from '../../packages/neuvetra-database/src/m78-validation';

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(value).digest('hex');

type Mode = 'baseline' | 'exercise' | 'revisit';

function serialize(events: any[]) {
  return `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;
}

function rehash(events: any[]) {
  let previousSha256: string | null = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    event.sequence = index + 1;
    event.previousSha256 = previousSha256;
    const { sha256: _old, ...body } = event;
    event.sha256 = sha(canonical(body));
    previousSha256 = event.sha256;
  }
  return serialize(events);
}

function fixture(full: boolean) {
  const events: any[] = [];
  const parent = {
    priorFailure: { mainSha256: '1'.repeat(64), diagnosticsSha256: '2'.repeat(64) },
    interruption: { journalSha256: '3'.repeat(64) },
    disposition: { path: '.superpowers/prior.json', sha256: '4'.repeat(64) },
    journal: '.superpowers/m78-hosted-continuation4.jsonl',
    transport: { runtime: 'bun-fetch', pooling: 'disabled', keepalive: false, retries: 0 },
  };
  const add = (mode: Mode, kind: string, data: any) => {
    const body = {
      sequence: events.length + 1,
      previousSha256: events.at(-1)?.sha256 ?? null,
      profile: 'm78-continuation4-diagnostic-v1',
      mode,
      kind,
      data,
      createdAt: new Date(Date.UTC(2026, 0, 1) + events.length * 1_000).toISOString(),
    };
    events.push({ ...body, sha256: sha(canonical(body)) });
  };
  for (const mode of (full ? ['baseline', 'exercise', 'revisit'] : ['baseline', 'exercise']) as Mode[]) {
    add(mode, 'phase_started', structuredClone(parent));
    let ordinal = 0;
    for (let index = 0; index < 16; index += 1) {
      add(mode, 'request_intent', {
        ordinal: ++ordinal,
        method: 'POST',
        route: index < 8 ? 'auth:/auth/v1/token' : 'auth:/auth/v1/logout',
      });
      add(mode, 'response_headers', { ordinal, status: index < 8 ? 200 : 204, elapsedMs: 1 });
    }
    if (mode === 'exercise') {
      for (let index = 0; index < 37; index += 1) {
        add(mode, 'request_intent', {
          ordinal: ++ordinal,
          method: 'POST',
          route: 'application:/workspace-api/workspace/:id/scope1-inventory',
        });
        add(mode, 'response_headers', { ordinal, status: 201, elapsedMs: 1 });
      }
    }
    add(mode, 'phase_finished', {
      status: 'passed',
      paused: false,
      diagnosticsHealthy: true,
      applicationPostRequests: mode === 'exercise' ? 37 : 0,
      allCreatedAuthSessionsClosed: true,
    });
  }
  const text = serialize(events);
  const baselineEnd = events.findIndex((event) => event.mode === 'baseline' && event.kind === 'phase_finished');
  const baselineEvents = events.slice(0, baselineEnd + 1);
  const baselineText = serialize(baselineEvents);
  const baseline = {
    diagnosticSha256: sha(baselineText),
    diagnosticHead: baselineEvents.at(-1)!.sha256,
    diagnosticEvents: baselineEvents.length,
    diagnosticRequests: 16,
  };
  const admission: LifecycleAdmission = {
    journalSha256: '5'.repeat(64),
    journalHead: '6'.repeat(64),
    diagnosticsSha256: sha(text),
    diagnosticsHead: events.at(-1)!.sha256,
    baselineResult: { path: 'synthetic://baseline', sha256: '7'.repeat(64) },
  };
  return { events, text, baseline, admission };
}

function repin(value: ReturnType<typeof fixture>) {
  value.text = rehash(value.events);
  value.admission.diagnosticsSha256 = sha(value.text);
  value.admission.diagnosticsHead = value.events.at(-1)!.sha256;
}

test.each([false, true])('accepts exact continuous diagnostics, full=%s', (full) => {
  const value = fixture(full);
  const result = verifyLifecycleDiagnostics(
    value.text,
    value.admission,
    value.baseline,
    full,
    full ? { baseline: 16, exercise: 53, revisit: 16 } : { baseline: 16, exercise: 53 },
  );
  expect(result.events).toBe(full ? 176 : 142);
  expect(result.phases.map((phase) => [phase.mode, phase.requests])).toEqual(
    full ? [['baseline', 16], ['exercise', 53], ['revisit', 16]] : [['baseline', 16], ['exercise', 53]],
  );
});

test('rejects rehashed transport, auth, route, status, ordinal, outcome and closure mutations', () => {
  const mutations = [
    (events: any[]) => { events[0].data.transport.keepalive = true; },
    (events: any[]) => { events.find((event) => event.mode === 'exercise' && event.kind === 'phase_started').data.transport.retries = 1; },
    (events: any[]) => { events.find((event) => event.mode === 'exercise' && event.kind === 'request_intent' && event.data.route.endsWith('/token')).data.method = 'GET'; },
    (events: any[]) => { events.find((event) => event.mode === 'exercise' && event.kind === 'request_intent' && event.data.route.startsWith('application:')).data.route = 'other:/secret'; },
    (events: any[]) => { events.find((event) => event.mode === 'exercise' && event.kind === 'response_headers' && event.data.status === 201).data.status = 500; },
    (events: any[]) => { events.find((event) => event.mode === 'exercise' && event.kind === 'request_intent').data.ordinal = 9; },
    (events: any[]) => { events.splice(events.findIndex((event) => event.mode === 'exercise' && event.kind === 'response_headers'), 1); },
    (events: any[]) => { events.at(-1).data.applicationPostRequests = 1; },
  ];
  for (const mutate of mutations) {
    const value = fixture(false);
    mutate(value.events);
    repin(value);
    expect(() => verifyLifecycleDiagnostics(value.text, value.admission, value.baseline, false)).toThrow();
  }
});

test('binds the accepted baseline diagnostic hash, head, event count and request count', () => {
  for (const field of ['diagnosticSha256', 'diagnosticHead', 'diagnosticEvents', 'diagnosticRequests'] as const) {
    const value = fixture(false);
    (value.baseline as Record<string, string | number>)[field] =
      field.includes('Events') || field.includes('Requests') ? 0 : '0'.repeat(64);
    expect(() => verifyLifecycleDiagnostics(value.text, value.admission, value.baseline, false)).toThrow('accepted baseline diagnostics');
  }
});

test('rejects changed later-phase parent metadata and main/diagnostic request mismatch', () => {
  const changed = fixture(true);
  changed.events.find((event) => event.mode === 'revisit' && event.kind === 'phase_started').data.journal = '.superpowers/other.jsonl';
  repin(changed);
  expect(() => verifyLifecycleDiagnostics(changed.text, changed.admission, changed.baseline, true)).toThrow('parent metadata');

  const counts = fixture(false);
  expect(() => verifyLifecycleDiagnostics(
    counts.text,
    counts.admission,
    counts.baseline,
    false,
    { baseline: 16, exercise: 52 },
  )).toThrow('request count');
});

test('restart freshness is relative to revisit, allowing a delayed review before restart', () => {
  const exerciseFinished = Date.parse('2026-01-01T00:00:00.000Z');
  const restartObserved = new Date(exerciseFinished + 366 * 24 * 60 * 60_000).toISOString();
  const freshRevisit = new Date(Date.parse(restartObserved) + 15 * 60_000).toISOString();
  expect(() => verifyRestartFreshForRevisit(restartObserved, freshRevisit)).not.toThrow();
  const staleRevisit = new Date(Date.parse(restartObserved) + 15 * 60_000 + 1).toISOString();
  expect(() => verifyRestartFreshForRevisit(restartObserved, staleRevisit)).toThrow('restart fresh at revisit');
  const beforeRestart = new Date(Date.parse(restartObserved) - 1).toISOString();
  expect(() => verifyRestartFreshForRevisit(restartObserved, beforeRestart)).toThrow('restart fresh at revisit');
});
