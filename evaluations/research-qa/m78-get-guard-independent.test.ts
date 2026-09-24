import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as guard from './m78-continuation4-get-perf-probe';

const guardSha256 = '8ffb4f7470e9b139201001b80b7a14f629f7d56a5f67187044e54dfb7492eb17';
const snapshotSha256 = '112b13cba11a4cbecdcf4e82004cc5a05784db631ef71426d06246c2a3f40cea';
const actor = '40000000-0000-4000-8000-000000000001';
const sourceCounts = new Map<string, number>([
  ['packages/neuvetra-database/src/hosted.ts', 2],
  ['packages/neuvetra-database/src/m71.ts', 2],
  ['packages/neuvetra-database/src/m73.ts', 2],
  ['packages/neuvetra-database/src/m74.ts', 2],
  ['packages/neuvetra-database/src/m75.ts', 2],
  ['packages/neuvetra-database/src/m76.ts', 2],
  ['packages/neuvetra-database/src/m76-diesel.ts', 2],
  ['packages/neuvetra-database/src/m77.ts', 2],
  ['packages/neuvetra-database/src/m78.ts', 2],
  ['packages/neuvetra-database/src/workspace.ts', 2],
]);
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim();

function staticSqlCalls(source: string, path: string) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const calls: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['query', 'exec'].includes(node.expression.name.text)) {
      const first = node.arguments[0];
      if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) calls.push(first.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return calls;
}

const acceptedValues = (sql: string) => {
  const candidates: unknown[][] = [[], [actor], [actor, false]];
  return candidates.filter((values) => {
    try { guard.assertProbeSqlAllowed(sql, values); return true; } catch { return false; }
  });
};

test('candidate4 bytes, private enforcement state and source pins are exact', async () => {
  expect(sha(await readFile('evaluations/research-qa/m78-continuation4-get-perf-probe.ts'))).toBe(guardSha256);
  expect(sha(await readFile('operations/agent-improvement/snapshots/M78-CONT4-GET-PERFORMANCE-PROBE-01-CANDIDATE4.json'))).toBe(snapshotSha256);
  expect(guard.M78_GET_SQL_TEMPLATE_COUNT).toBe(20);
  expect(guard.M78_GET_SQL_SOURCE_PIN_COUNT).toBe(10);
  expect(Object.keys(guard)).not.toContain('M78_GET_SQL_TEMPLATES');
  expect(Object.keys(guard)).not.toContain('M78_GET_SQL_SOURCE_PINS');
  expect(await guard.verifyM78GetSqlSourcePins()).toBeTrue();
});

test('the finite set is exactly the 20 static read templates in the ten pinned callers', async () => {
  const accepted = new Map<string, { sql: string; values: unknown[]; path: string }>();
  for (const [path, expected] of sourceCounts) {
    const sqlCalls = staticSqlCalls(await readFile(path, 'utf8'), path);
    const inFile = new Map<string, { sql: string; values: unknown[]; path: string }>();
    for (const sql of sqlCalls) {
      const matches = acceptedValues(sql);
      if (matches.length === 0) continue;
      expect(matches).toHaveLength(1);
      const item = { sql, values: matches[0]!, path };
      inFile.set(sha(normalize(sql)), item);
      accepted.set(sha(normalize(sql)), item);
    }
    expect(inFile.size).toBe(expected);
  }
  expect(accepted.size).toBe(20);
  for (const { sql, values } of accepted.values()) {
    expect(guard.assertProbeSqlAllowed(sql, values)).toBeTrue();
    expect(() => guard.assertProbeSqlAllowed(sql, [...values, 'extra'])).toThrow();
    if (values.length) expect(() => guard.assertProbeSqlAllowed(sql, values.slice(0, -1))).toThrow();
    if (/neuvetra\.m(?:75|76|77|78)_lock\(\$1,\$2\)/.test(sql)) {
      for (const writing of [true, 0, 'false', null, undefined]) {
        expect(() => guard.assertProbeSqlAllowed(sql, [actor, writing])).toThrow();
      }
    }
    if (/set_config\('request\.jwt\.claim\.sub'/.test(sql)) {
      for (const invalid of ['', null, 1]) expect(() => guard.assertProbeSqlAllowed(sql, [invalid])).toThrow();
    }
  }
});

test('nested calls, casts, writer forms, arbitrary setters and template mutations are refused', () => {
  const refused: [string, unknown[]][] = [
    ['select neuvetra.some_mutator(coalesce(1, 2))', []],
    ['select neuvetra.m78_lock($1, coalesce($2,false))', [actor, true]],
    ['select $1::neuvetra.side_effect_type', [actor]],
    ['select neuvetra.save_scope1_version($1)', [actor]],
    ["select pg_catalog.set_config('x','y',false)", []],
    ['set search_path=public', []],
    ['with changed as (update x set y=1 returning *) select * from changed', []],
    ['select neuvetra.m78_lock($1,$2)allowed; select 1', [actor, false]],
    ['select neuvetra."m78_lock"($1,$2)allowed', [actor, false]],
    ['select neuvetra.m78_lock($1,$2)allowed::text', [actor, false]],
    ['select neuvetra.m78_lock($1,$2)allowed /* diagnostic */', [actor, false]],
  ];
  for (const [sql, values] of refused) expect(() => guard.assertProbeSqlAllowed(sql, values)).toThrow();
});

test('historical result and baseline route remain exact without retroactive provenance claims', async () => {
  const resultBytes = await readFile('evaluations/research-qa/m78-continuation4-get-perf-result.json');
  expect(sha(resultBytes)).toBe('c0e7b9d455087318043e749a777ce8274493a22a736b48e0a94d8d6518b9a112');
  const result = JSON.parse(resultBytes.toString('utf8'));
  expect(result.sourcePins).toHaveLength(4);
  expect(result.tableCount).toBe(121);
  expect(result.rowsBeforeSha256).toBe(result.rowsAfterSha256);
  const baseline = await readFile('apps/site-api/src/workspace/m78-get-route-baseline-fixture.ts', 'utf8');
  expect(sha(baseline)).toBe('8ebe51aec86d8e5990a6f8391bb8e823c7cd661d2d7369e3b35909ef74722de3');
  const originalPin = result.sourcePins.find((pin: {path: string; sha256: string}) => pin.path === 'apps/site-api/src/workspace/m78-routes.ts');
  expect(originalPin?.sha256).toBe('ab5018c64668dfe197755849aee1a2b3c5947f6c3da21e8d18869e998f3f9e01');
  expect(sha(baseline.replace(/^\/\*\* Frozen baseline route fixture[^\n]*\n/, '').replace('createM78RoutesBaseline', 'createM78Routes'))).toBe(originalPin.sha256);
  const guardSource = await readFile('evaluations/research-qa/m78-continuation4-get-perf-probe.ts', 'utf8');
  expect(guardSource).toContain('createM78RoutesBaseline');
  expect(guardSource).toContain('await verifyM78GetSqlSourcePins()');
});
