/** Exact union of the unchanged admitted155 graph and the fresh adapter/test/evidence roots. */
import {readFile} from 'node:fs/promises';
import {m78ContinuationSourcePins,M78_CONTINUATION_EVIDENCE_PINS} from './m78-continuation-source-pins';
import {M78_CONTINUATION2_FAILURE,M78_CONTINUATION2_PATHS} from './check-m78-continuation2';
export const M78_CONTINUATION2_EVIDENCE_PINS=[...M78_CONTINUATION_EVIDENCE_PINS,{path:M78_CONTINUATION2_PATHS.failed,sha256:M78_CONTINUATION2_FAILURE.sha256}]as const;
const hash=(v:Uint8Array)=>new Bun.CryptoHasher('sha256').update(v).digest('hex');
export async function m78Continuation2SourcePins(){
 const path='evaluations/research-qa/m78-continuation-journey-preparation-final.json',bytes=await readFile(path);if(hash(bytes)!=='77aec359e20091baf4b2ca530d7a73d1383a191147a7eca926de0f50226b861b')throw Error('Historical source receipt changed');
 const base=await m78ContinuationSourcePins(),prior=JSON.parse(bytes.toString()).sourcePins;if(base.length!==155||JSON.stringify(base)!==JSON.stringify(prior))throw Error('Admitted155 graph changed');
 const extra=await Promise.all([path,'tools/staging/check-m78-continuation2.ts','tools/staging/check-m78-continuation2.test.ts','tools/staging/m78-continuation2-source-pins.ts','tools/staging/m78-continuation2-failed-baseline.jsonl'].map(async path=>({path,sha256:hash(await readFile(path))})));
 return [...base,...extra].sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
if(import.meta.main)console.log(JSON.stringify(await m78Continuation2SourcePins()));
