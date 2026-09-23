import {expect, test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {m78Continuation2SourcePins} from '../../tools/staging/m78-continuation2-source-pins';
import {m78Continuation3SourcePins} from '../../tools/staging/m78-continuation3-source-pins';
import {m78Continuation4SourcePins} from '../../tools/staging/m78-continuation4-source-pins';

const sha = (bytes: Uint8Array) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');

test('the reviewed GET repair cannot reuse any historical continuation source admission', async () => {
  const historicalPath = 'evaluations/research-qa/m78-continuation4-preparation-source-pins.json';
  const historicalBytes = await readFile(historicalPath);
  expect(sha(historicalBytes)).toBe('e1d0cd97046e21b308894d5f8757f8fc1fa580550e3ec700aa7ab0e1519bbb92');
  const historical: {path: string; sha256: string}[] = JSON.parse(historicalBytes.toString());
  const route = 'apps/site-api/src/workspace/m78-routes.ts';
  expect(historical.find(pin => pin.path === route)?.sha256).toBe('ab5018c64668dfe197755849aee1a2b3c5947f6c3da21e8d18869e998f3f9e01');
  expect(sha(await readFile(route))).toBe('fd9b1115130d523629e58b5fcef06fe5355eedc8afd12d6dacc998623c89ff37');
  for (const gate of [m78Continuation2SourcePins, m78Continuation3SourcePins, m78Continuation4SourcePins]) {
    await expect(gate()).rejects.toThrow('Admitted155 graph changed');
  }
  expect(sha(await readFile(historicalPath))).toBe(sha(historicalBytes));
});
