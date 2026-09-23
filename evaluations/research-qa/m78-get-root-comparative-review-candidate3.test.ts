import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const path = '.superpowers/m78-get-route-comparative.ts';
const expected = '7da53e0014fc6f499b8341c03246388244b608e76f2da10742f56808d34b0fbc';

test('candidate3 binds exact independent route and guard receipts before lock', async () => {
  const bytes = await readFile(path);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected);
  const source = bytes.toString('utf8');
  const routeReceipt = source.indexOf('m78_get_route_independent_source_review_passed');
  const guardReceipt = source.indexOf('m78_get_probe_guard_independent_review_passed');
  const reviewer = source.indexOf("receipt.reviewerId==='/root/m78_transport_probe'");
  const open = source.indexOf('receipt.materialFindingsOpen===0');
  const receiptHash = source.indexOf("check(hash(raw)===pin.sha256,'QA receipt changed')");
  const lock = source.indexOf('await writeFile(LOCK');
  for (const position of [routeReceipt, guardReceipt, reviewer, open, receiptHash]) {
    expect(position).toBeGreaterThan(0);
    expect(position).toBeLessThan(lock);
  }
});

test('candidate3 covers construction and both closes before writing pass', async () => {
  const source = await readFile(path, 'utf8');
  const guarded = source.indexOf(' try{');
  const admin = source.indexOf('admin=createPostgresConnection');
  const runtime = source.indexOf('runtime=createPostgresConnection');
  const allSettled = source.indexOf('const closed=await Promise.allSettled');
  const runtimeClose = source.indexOf('runtime?.close()', allSettled);
  const adminClose = source.indexOf('admin?.close()', allSettled);
  const cleanupFailure = source.indexOf("failures.push('connection_cleanup')", allSettled);
  const failureWrite = source.indexOf("status:'m78_get_route_local_comparison_failed'", cleanupFailure);
  const passWrite = source.indexOf('await writeFile(OUT,JSON.stringify(successResult', failureWrite);
  expect(guarded).toBeGreaterThan(0);
  expect(admin).toBeGreaterThan(guarded);
  expect(runtime).toBeGreaterThan(admin);
  expect(allSettled).toBeGreaterThan(runtime);
  expect(runtimeClose).toBeGreaterThan(allSettled);
  expect(adminClose).toBeGreaterThan(allSettled);
  expect(cleanupFailure).toBeGreaterThan(adminClose);
  expect(failureWrite).toBeGreaterThan(cleanupFailure);
  expect(passWrite).toBeGreaterThan(failureWrite);
  expect(source).toContain('successResult.localConnectionsClosed=true');
});
