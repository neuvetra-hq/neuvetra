import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const path = '.superpowers/m78-get-route-comparative-candidate1.ts';
const expectedSha256 = '07aed9f62893ab21c37537d568d375108c8f90a2a63ae46ab7c63c98124cd748';

test('candidate1 reproduction: resource construction is outside failure cleanup', async () => {
  const bytes = await readFile(path);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(expectedSha256);
  const source = bytes.toString('utf8');
  const lock = source.indexOf('await writeFile(LOCK');
  const admin = source.indexOf('const admin=createPostgresConnection');
  const runtime = source.indexOf('const runtime=createPostgresConnection');
  const guarded = source.indexOf(' try{', runtime);
  expect(lock).toBeGreaterThan(0);
  expect(admin).toBeGreaterThan(lock);
  expect(runtime).toBeGreaterThan(admin);
  expect(guarded).toBeGreaterThan(runtime);
});

test('candidate1 reproduction: admission does not bind independent route and guard receipts', async () => {
  const source = await readFile(path, 'utf8');
  expect(source).toContain("admission.status==='m78_get_route_comparative_source_admitted'");
  expect(source).not.toContain('m78_get_route_independent_source_review_passed');
  expect(source).not.toContain('m78_get_probe_guard_independent_review_passed');
  expect(source).not.toContain('materialFindingsOpen');
  expect(source).not.toContain('reviewerId');
});
