import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hash } from '../../apps/site-api/src/research-passages/release';
import { reservationNanoUsd } from '../../tools/research/m69-canary-runtime';

const root = path.resolve(import.meta.dir, '../..');
const read = (relative: string) => readFileSync(path.join(root, relative));
const json = (relative: string) => JSON.parse(read(relative).toString());
const candidateSha = '97edd66e74705418e759e56a41a091faf363bca50a1de4fd7e2f6206ac419007';
const executableSha = 'aa66fc95bfa373e2716bbecaa1f44bfff88685729cc0770c1a102dae73daf126';

test('candidate, compiled executable and all candidate pins are exact', () => {
  expect(hash(read('docs/research/m69-live-candidate.json'))).toBe(candidateSha);
  expect(hash(read('.superpowers/m69-build/m69-canary.exe'))).toBe(executableSha);
  const candidate = json('docs/research/m69-live-candidate.json');
  expect(candidate.reservation_nano_usd).toBe(reservationNanoUsd);
  expect(candidate.pins).toHaveLength(36);
  for (const pin of candidate.pins) expect(hash(read(pin.path))).toBe(pin.sha256);
});

test('board, endpoint and source records bind the candidate while account evidence fails closed', () => {
  const board = json('operations/m69-preflight/board-decision.json');
  expect(board).toMatchObject({ disposition: 'pass', authority: 'board', candidate_sha256: candidateSha,
    executable_sha256: executableSha, maximum_stages: 5, retry: false, carry: false,
    one_use: true, reservation_nano_usd: reservationNanoUsd, customer_data: false });
  const endpoint = json('operations/m69-preflight/endpoint-evidence.json');
  expect(endpoint.disposition).toBe('pass');
  expect(endpoint.candidate_sha256).toBe(candidateSha);
  expect(endpoint.fallbacks).toBe(false);
  for (const stage of ['analyze','plan','verify']) expect(endpoint.stages[stage].provider_tag).toBe('anthropic');
  const source = json('operations/m69-preflight/source-review.json');
  expect(source).toMatchObject({ disposition: 'pass', candidate_sha256: candidateSha,
    expires_at: '2026-09-15T23:20:32Z', scope: 'internal_public_synthetic_epa_only' });
  const account = json('operations/m69-preflight/account-evidence.json');
  expect(account.disposition).toBe('blocked');
  expect(account.available_balance_nano_usd).toBeNull();
  expect(account.available_balance_sufficient).toBe(true);
  expect(account.privacy_controls_verified).toBe(true);
  expect(account.credential_accessed).toBe(false);
  expect(account.credential_sha256).toBeNull();
  expect(account.credential_binding_verified).toBe(false);
});

test('independent product and security reviews bind the frozen candidate', () => {
  const review = json('operations/m69-preflight/independent-review.json');
  expect(review).toMatchObject({ disposition: 'pass', candidate_sha256: candidateSha,
    executable_sha256: executableSha, reservation_nano_usd: reservationNanoUsd,
    pins_verified: 36, provider_requests: 0, paid_cost_nano_usd: 0,
    live_provider_accuracy: 'unproven', account_gate: 'blocked' });
  expect(hash(read(review.product.path))).toBe(review.product.sha256);
  expect(hash(read(review.product.snapshot_path))).toBe(review.product.snapshot_sha256);
  expect(hash(read(review.security.path))).toBe(review.security.sha256);
});
