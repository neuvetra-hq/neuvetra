import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {m78ContinuationSourcePins} from '../../tools/staging/m78-continuation-source-pins';
import {m78NativeContinuationSourcePins} from '../../tools/staging/m78-continuation-native';
const sha=(b:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(b).digest('hex');
test('independent complete runtime union rejects missing and stale runtime pins',async()=>{
 const actual=await m78ContinuationSourcePins(),native=await m78NativeContinuationSourcePins();
 const complete=(pins:typeof actual)=>pins.length===new Set(pins.map(p=>p.path)).size&&native.every(n=>pins.some(p=>p.path===n.path&&p.sha256===n.sha256));
 expect(complete(actual)).toBe(true);
 for(const path of ['apps/site-api/src/workspace/m78-routes.ts','packages/neuvetra-database/src/m78.ts','packages/neuvetra-database/src/hosted.ts']){
  expect(actual.some(p=>p.path===path)).toBe(true);
  expect(complete(actual.filter(p=>p.path!==path))).toBe(false);
  expect(complete(actual.map(p=>p.path===path?{...p,sha256:'0'.repeat(64)}:p))).toBe(false);
 }
 expect(complete([...actual,actual[0]!])).toBe(false);
 const old=JSON.parse(await readFile('evaluations/research-qa/m78-continuation-journey-preparation.json','utf8'));
 expect(complete(old.sourcePins)).toBe(false);
 for(const pin of actual)expect(pin.sha256).toBe(sha(await readFile(pin.path)));
});
test('candidate3 snapshot preserves exact raw and embedded bytes',async()=>{
 const raw=await readFile('operations/agent-improvement/snapshots/M78-CONTINUATION-PREP-01-CANDIDATE3.json');
 expect(sha(raw)).toBe('86162b175694bbbb630f801d7c832275b186585febae5dbd9a732e5c54f7613f');
 for(const pin of JSON.parse(raw.toString()).artifacts){expect(sha(pin.text)).toBe(pin.sha256);expect(sha(await readFile(pin.path))).toBe(pin.sha256)}
});
