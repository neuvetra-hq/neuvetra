import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { assertProbeSqlAllowed, M78_GET_SQL_TEMPLATES } from './m78-get-guard-independent-candidate3-fixture';

const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim();
const digest = (sql: string) => createHash('sha256').update(normalize(sql)).digest('hex');

test('candidate3 reproduction: exported frozen Map can widen the enforcement allowlist', async () => {
  expect(createHash('sha256').update(await readFile('evaluations/research-qa/m78-get-guard-independent-candidate3-fixture.ts')).digest('hex'))
    .toBe('b067b047735cc570fca9a6682c9499deed0662df68899bebb3c3ee71dc390d22');
  const arbitrary = 'select neuvetra.some_mutator()';
  expect(() => assertProbeSqlAllowed(arbitrary)).toThrow();
  expect(Object.isFrozen(M78_GET_SQL_TEMPLATES)).toBeTrue();
  const key = digest(arbitrary);
  try {
    M78_GET_SQL_TEMPLATES.set(key, { site: 'QA injected template', arity: 0 });
    expect(assertProbeSqlAllowed(arbitrary)).toBeTrue();
  } finally {
    M78_GET_SQL_TEMPLATES.delete(key);
  }
  expect(() => assertProbeSqlAllowed(arbitrary)).toThrow();
});
