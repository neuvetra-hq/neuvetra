import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

test('candidate2 reproduction: pass result precedes connection closure', async () => {
  const bytes = await readFile('.superpowers/m78-get-route-comparative-candidate2.ts');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('0574c0a6682ddfe19181d2991e7490f368fcfe7911d02b22d94866cde126ebe8');
  const source = bytes.toString('utf8');
  const passed = source.indexOf("status:'m78_get_route_local_comparison_passed'");
  const passWrite = source.indexOf("await writeFile(OUT,JSON.stringify(result");
  const finallyBlock = source.indexOf('}finally{', passWrite);
  const close = source.indexOf('runtime?.close()', finallyBlock);
  expect(passed).toBeGreaterThan(0);
  expect(passWrite).toBeGreaterThan(passed);
  expect(finallyBlock).toBeGreaterThan(passWrite);
  expect(close).toBeGreaterThan(finallyBlock);
});
