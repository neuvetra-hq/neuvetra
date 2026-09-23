import { expect, test } from 'bun:test';
import { assertProbeSqlAllowed } from './m78-continuation4-get-perf-probe';

test('QA requires every nested function call to be explicitly allowed', () => {
  expect(() => assertProbeSqlAllowed('select neuvetra.some_mutator(coalesce(1, 2))')).toThrow('Unlisted SELECT function refused');
  expect(() => assertProbeSqlAllowed(
    'select neuvetra.some_mutator(neuvetra.m78_lock($1, false))',
    ['company'],
  )).toThrow('Unlisted SELECT function refused');
});

test('QA requires native lock writing=false even through nested expressions', () => {
  expect(() => assertProbeSqlAllowed(
    'select neuvetra.m78_lock($1, coalesce($2, false)) allowed',
    ['company', true],
  )).toThrow('requires exact writing=false');
  expect(() => assertProbeSqlAllowed(
    'select neuvetra.m78_lock($1, (($2))) allowed',
    ['company', true],
  )).toThrow('requires exact writing=false');
});

test('QA preserves exact setter restrictions', () => {
  expect(assertProbeSqlAllowed('set local role authenticated')).toBeTrue();
  expect(assertProbeSqlAllowed("select set_config('request.jwt.claim.sub', $1, true)", ['actor'])).toBeTrue();
  for (const [sql, values] of [
    ['set local role postgres', []],
    ['set search_path=public', []],
    ["select set_config('role', 'postgres', true)", []],
    ["select set_config('request.jwt.claim.sub', $1, false)", ['actor']],
    ["select set_config('request.jwt.claim.sub', $1, true) from neuvetra.scope1_heads", ['actor']],
  ] as [string, unknown[]][]) {
    expect(() => assertProbeSqlAllowed(sql, values)).toThrow();
  }
});

test('QA refuses cast-based arbitrary SELECT as outside a pinned template set', () => {
  expect(() => assertProbeSqlAllowed('select $1::neuvetra.side_effect_type', ['value'])).toThrow();
});
